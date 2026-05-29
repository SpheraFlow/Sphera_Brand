/**
 * STORY-014 — Rotas do Agente por Cliente (IA especializada e persistente).
 *
 * Endpoints (todos exigem JWT + acesso ao cliente da sessão):
 *   POST   /api/agents/sessions                  Cria sessão (clienteId, agentType)
 *   GET    /api/agents/sessions?clienteId=        Lista sessões ativas do cliente
 *   POST   /api/agents/sessions/:id/messages      Envia mensagem → resposta do agente
 *   GET    /api/agents/sessions/:id/messages      Histórico paginado (limit, before)
 *   DELETE /api/agents/sessions/:id               Arquiva a sessão (soft delete)
 *
 * Isolamento por cliente: toda operação resolve o cliente_id da sessão e verifica
 * acesso do usuário via hasClientAccess (mesma regra de rag.ts / calendarItems).
 */
import { Router, Response } from "express";
import db from "../config/database";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth";
import logger from "../utils/logger";
import { agentRunner } from "../services/agentRunner";
import { isValidAgentType } from "../services/systemPromptBuilder";

const router = Router();
router.use(requireAuth);

const agentsLog = logger.child({ component: "agentsRoute" });

/** Default e teto de paginação do histórico de mensagens. */
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 200;

/** Verifica se o usuário autenticado tem acesso ao cliente (mesma regra de rag.ts). */
async function hasClientAccess(req: AuthRequest, clienteId: string): Promise<boolean> {
  const userRole = req.user?.role;
  const canManage = req.user?.permissions?.clients_manage;
  const userId = req.user?.id;
  if (userRole === "admin" || canManage) return true;
  const r = await db.query(
    "SELECT 1 FROM user_clientes WHERE user_id=$1 AND cliente_id=$2",
    [userId, clienteId]
  );
  return r.rows.length > 0;
}

/**
 * Carrega a sessão e garante que o usuário tem acesso ao cliente dela.
 * Retorna a linha da sessão ou null (já respondendo 403/404 quando aplicável).
 */
async function loadAccessibleSession(
  req: AuthRequest,
  res: Response,
  sessionId: string
): Promise<{ id: string; cliente_id: string; agent_type: string; status: string } | null> {
  const sessionResult = await db.query(
    "SELECT id, cliente_id, agent_type, status FROM agent_sessions WHERE id = $1",
    [sessionId]
  );
  if (sessionResult.rows.length === 0) {
    res.status(404).json({ success: false, error: "Sessão não encontrada." });
    return null;
  }
  const session = sessionResult.rows[0];
  if (!(await hasClientAccess(req, session.cliente_id))) {
    res.status(403).json({ success: false, error: "Sem acesso a este cliente." });
    return null;
  }
  return session;
}

// ─────────────────────────────────────────────────────────────────────────
// POST /api/agents/sessions — cria uma nova sessão (AC1)
// ─────────────────────────────────────────────────────────────────────────
router.post("/sessions", async (req: AuthRequest, res: Response) => {
  const { clienteId, agentType, title } = req.body || {};

  try {
    if (!clienteId || !isValidAgentType(agentType)) {
      return res.status(400).json({
        success: false,
        error: "clienteId e agentType (briefing|creative|strategy) são obrigatórios.",
      });
    }

    const clientExists = await db.query("SELECT 1 FROM clientes WHERE id = $1", [clienteId]);
    if (clientExists.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Cliente não encontrado." });
    }

    if (!(await hasClientAccess(req, clienteId))) {
      return res.status(403).json({ success: false, error: "Sem acesso a este cliente." });
    }

    const insert = await db.query(
      `INSERT INTO agent_sessions (cliente_id, user_id, agent_type, title, status, rolling_summary)
       VALUES ($1, $2, $3, $4, 'active', NULL)
       RETURNING id, cliente_id, user_id, agent_type, title, rolling_summary,
                 created_at, last_message_at, status`,
      [clienteId, req.user!.id, agentType, title ?? null]
    );

    agentsLog.info(
      {
        event: "agent_session_created",
        session_id: insert.rows[0].id,
        cliente_id: clienteId,
        agent_type: agentType,
        user_id: req.user?.id ?? null,
      },
      "Sessão de agente criada"
    );

    return res.status(201).json({ success: true, session: insert.rows[0] });
  } catch (error: any) {
    agentsLog.error(
      { event: "agent_session_create_failed", cliente_id: clienteId, err: error?.message },
      "POST /api/agents/sessions failed"
    );
    return res.status(500).json({ success: false, error: error?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/agents/sessions?clienteId= — lista sessões ativas do cliente (AC4)
// ─────────────────────────────────────────────────────────────────────────
router.get("/sessions", async (req: AuthRequest, res: Response) => {
  const clienteId = req.query.clienteId as string | undefined;

  try {
    if (!clienteId) {
      return res.status(400).json({ success: false, error: "clienteId obrigatório." });
    }

    if (!(await hasClientAccess(req, clienteId))) {
      return res.status(403).json({ success: false, error: "Sem acesso a este cliente." });
    }

    const result = await db.query(
      `SELECT id, cliente_id, agent_type, title, last_message_at, status,
              (rolling_summary IS NOT NULL) AS has_memory
         FROM agent_sessions
        WHERE cliente_id = $1 AND status = 'active'
        ORDER BY last_message_at DESC`,
      [clienteId]
    );

    return res.json({ success: true, sessions: result.rows });
  } catch (error: any) {
    agentsLog.error(
      { event: "agent_sessions_list_failed", cliente_id: clienteId, err: error?.message },
      "GET /api/agents/sessions failed"
    );
    return res.status(500).json({ success: false, error: error?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/agents/sessions/:id/messages — envia mensagem e responde (AC2/AC3)
// ─────────────────────────────────────────────────────────────────────────
router.post("/sessions/:id/messages", async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id;
  const { content } = req.body || {};

  try {
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "id da sessão obrigatório." });
    }
    const trimmed = String(content || "").trim();
    if (!trimmed) {
      return res.status(400).json({ success: false, error: "content não pode ser vazio." });
    }

    const session = await loadAccessibleSession(req, res, sessionId);
    if (!session) return; // resposta já enviada (403/404)

    if (session.status !== "active") {
      return res.status(409).json({ success: false, error: "Sessão arquivada — não aceita novas mensagens." });
    }

    const result = await agentRunner.runMessage(
      sessionId,
      trimmed,
      session.cliente_id,
      session.agent_type as any
    );

    return res.json({
      success: true,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
      summaryUpdated: result.summaryUpdated,
    });
  } catch (error: any) {
    agentsLog.error(
      { event: "agent_message_failed", session_id: sessionId, err: error?.message },
      "POST /api/agents/sessions/:id/messages failed"
    );
    return res.status(500).json({ success: false, error: error?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/agents/sessions/:id/messages — histórico paginado
// ─────────────────────────────────────────────────────────────────────────
router.get("/sessions/:id/messages", async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id;

  try {
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "id da sessão obrigatório." });
    }
    const session = await loadAccessibleSession(req, res, sessionId);
    if (!session) return;

    const rawLimit = parseInt(String(req.query.limit ?? ""), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_MESSAGE_LIMIT)
      : DEFAULT_MESSAGE_LIMIT;

    const before = req.query.before as string | undefined;

    const params: any[] = [sessionId];
    let beforeClause = "";
    if (before) {
      const beforeDate = new Date(before);
      if (Number.isNaN(beforeDate.getTime())) {
        return res.status(400).json({ success: false, error: "Parâmetro 'before' inválido (use ISO timestamp)." });
      }
      params.push(beforeDate.toISOString());
      beforeClause = ` AND created_at < $${params.length}`;
    }
    params.push(limit);

    // Pega as `limit` mensagens mais recentes (antes de `before`) e devolve em ASC.
    const result = await db.query(
      `SELECT * FROM (
          SELECT id, session_id, role, content, tokens_in, tokens_out,
                 retrieved_chunk_ids, created_at
            FROM agent_messages
           WHERE session_id = $1${beforeClause}
           ORDER BY created_at DESC
           LIMIT $${params.length}
       ) page
       ORDER BY created_at ASC`,
      params
    );

    return res.json({ success: true, messages: result.rows });
  } catch (error: any) {
    agentsLog.error(
      { event: "agent_messages_list_failed", session_id: sessionId, err: error?.message },
      "GET /api/agents/sessions/:id/messages failed"
    );
    return res.status(500).json({ success: false, error: error?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// DELETE /api/agents/sessions/:id — soft delete (arquiva) (AC5)
// ─────────────────────────────────────────────────────────────────────────
router.delete("/sessions/:id", async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id;

  try {
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "id da sessão obrigatório." });
    }
    const session = await loadAccessibleSession(req, res, sessionId);
    if (!session) return;

    await db.query("UPDATE agent_sessions SET status = 'archived' WHERE id = $1", [sessionId]);

    agentsLog.info(
      { event: "agent_session_archived", session_id: sessionId, user_id: req.user?.id ?? null },
      "Sessão de agente arquivada (soft delete)"
    );

    return res.json({ archived: true, session_id: sessionId });
  } catch (error: any) {
    agentsLog.error(
      { event: "agent_session_archive_failed", session_id: sessionId, err: error?.message },
      "DELETE /api/agents/sessions/:id failed"
    );
    return res.status(500).json({ success: false, error: error?.message });
  }
});

export default router;
