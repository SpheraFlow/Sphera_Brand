import { Router, Request, Response } from "express";
import db from "../config/database";
import {
  SUPPORTED_VARIABLES,
  REQUIRED_VARIABLES,
  extractPlaceholders,
  buildPreviewContext
} from "../services/promptVariables";

const router = Router();

// ─── Constantes de validação / contrato ────────────────────────────────────

/**
 * Campos que o template deve mencionar no contrato CANÔNICO de saída JSON.
 * Garante que o modelo vai gerar os campos esperados pelo frontend.
 * Contrato canônico PR4:
 *   { "dia": number, "tema": string, "formato": "Reels|Static|Carousel|Stories",
 *     "instrucoes_visuais": string, "copy_inicial": string,
 *     "objetivo": string, "cta": string, "palavras_chave": string[] }
 */
export const OUTPUT_CONTRACT_FIELDS = [
  '"dia"',
  '"tema"',
  '"formato"',
  '"instrucoes_visuais"',
  '"copy_inicial"',
  '"objetivo"',
  '"cta"',
  '"palavras_chave"',
];

/**
 * Campos do contrato LEGADO (anteriores ao PR4).
 * Templates com esses campos NÃO são bloqueados na geração, mas são avisados.
 * Usados apenas para emitir warnings no preview.
 */
export const LEGACY_CONTRACT_FIELDS = [
  '"data"',
  '"ideia_visual"',
  '"copy_sugestao"',
];

/** Padrões proibidos no corpo do template. */
const FORBIDDEN_PATTERNS: { re: RegExp; msg: string }[] = [
  { re: /responda em markdown/i, msg: 'Frase proibida: "responda em markdown"' },
];

export function validateTemplateBody(body: string): string[] {
  const errors: string[] = [];

  // 1. Placeholders obrigatórios
  for (const varKey of REQUIRED_VARIABLES) {
    if (!body.includes(`{{${varKey}}}`)) {
      errors.push(`Placeholder obrigatório ausente: {{${varKey}}}`);
    }
  }

  // 2. Contrato de saída (campos JSON)
  const missingFields = OUTPUT_CONTRACT_FIELDS.filter((f) => !body.includes(f));
  if (missingFields.length > 0) {
    errors.push(
      `Template não menciona campo(s) do contrato de saída: ${missingFields.join(", ")}`
    );
  }

  // 3. Padrões proibidos
  for (const { re, msg } of FORBIDDEN_PATTERNS) {
    if (re.test(body)) errors.push(msg);
  }

  // 4. Placeholders desconhecidos
  const usedPlaceholders = extractPlaceholders(body);
  const unknown = usedPlaceholders.filter(p => !SUPPORTED_VARIABLES.some(v => v.key === p));
  if (unknown.length > 0) {
    errors.push(`Variáveis desconhecidas ou não suportadas: ${unknown.map(u => `{{${u}}}`).join(', ')}`);
  }

  return errors;
}

// ─── Utilitário de substituição de variáveis ──────────────────────────────

/**
 * Substitui {{VAR}} pelo valor correspondente em vars.
 * Retorna { rendered, missing } onde missing lista vars sem valor encontrado.
 */
function renderTemplate(
  body: string,
  vars: Record<string, string>
): { rendered: string; missing: string[] } {
  const missing: string[] = [];
  const rendered = body.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (vars[key] !== undefined && vars[key] !== null) {
      return vars[key];
    }
    // Se a var existir mas for nullish, ou não existir nos vars mas for conhecida
    // a gente apenas mantém ela visível no preview.
    missing.push(match);
    return match; // mantém o placeholder visível no preview
  });
  return { rendered, missing };
}

// ─── ENDPOINTS ────────────────────────────────────────────────────────────
//
// ⚠️ ATENÇÃO: Rotas com prefixos estáticos DEVEM vir antes das rotas com
// parâmetros dinâmicos (ex: /:clienteId). Caso contrário, o Express captura
// "base", "detail", "preview" como valores de :clienteId.

// GET /api/prompt-templates/base — Template global ativo (sem client_id)
// DEVE ficar antes de /:clienteId para não ser capturado como clienteId.
router.get("/prompt-templates/base", async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, version, label, body, is_active, created_at, agent_id
       FROM prompt_templates
       WHERE cliente_id IS NULL AND is_active = true
       LIMIT 1`
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Template global não encontrado." });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Erro ao buscar template base.", error: error.message });
  }
});

// GET /api/prompt-templates/detail/:id — Versão específica (com body)
// DEVE ficar antes de /:clienteId para não ser capturado como clienteId.
router.get("/prompt-templates/detail/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM prompt_templates WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Template não encontrado." });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Erro ao buscar prompt template.", error: error.message });
  }
});

// GET /api/prompt-templates/:clienteId — Listar versões do cliente + global (sem body)
router.get("/prompt-templates/:clienteId", async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.params;
    const result = await db.query(
      `SELECT id, cliente_id, version, label, is_active, created_at, updated_at, agent_id
       FROM prompt_templates
       WHERE cliente_id = $1 OR cliente_id IS NULL
       ORDER BY (cliente_id IS NOT NULL) DESC, version DESC`,
      [clienteId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error("❌ Erro ao listar prompt templates:", error);
    return res.status(500).json({ success: false, message: "Erro ao listar prompt templates.", error: error.message });
  }
});

// GET /api/prompt-templates/:clienteId/active/:agentId — Versão ativa (com body); fallback global
router.get("/prompt-templates/:clienteId/active/:agentId", async (req: Request, res: Response) => {
  try {
    const { clienteId, agentId } = req.params;
    const result = await db.query(
      `SELECT * FROM prompt_templates
       WHERE (cliente_id = $1 OR cliente_id IS NULL) AND agent_id = $2 AND is_active = true
       ORDER BY (cliente_id IS NOT NULL) DESC
       LIMIT 1`,
      [clienteId, agentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Nenhum template ativo encontrado." });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Erro ao buscar template ativo.", error: error.message });
  }
});

// GET /api/prompt-templates/:clienteId/history — Histórico completo do cliente
router.get("/prompt-templates/:clienteId/history", async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.params;
    const result = await db.query(
      `SELECT id, cliente_id, version, label, is_active, created_at, updated_at, agent_id
       FROM prompt_templates
       WHERE cliente_id = $1 OR cliente_id IS NULL
       ORDER BY (cliente_id IS NOT NULL) DESC, version DESC`,
      [clienteId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Erro ao buscar histórico.", error: error.message });
  }
});

// POST /api/prompt-templates — Criar nova versão (draft, inativa)
router.post("/prompt-templates", async (req: Request, res: Response) => {
  try {
    const { clienteId, body, label, agentId = 'estrategista' } = req.body;
    if (!clienteId || !body) {
      return res.status(400).json({ success: false, message: "Campos obrigatórios: clienteId e body." });
    }

    const versionResult = await db.query(
      "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM prompt_templates WHERE cliente_id = $1",
      [clienteId]
    );
    const nextVersion = versionResult.rows[0].next_version;
    const autoLabel = label || `v${nextVersion} - Customizado`;

    const result = await db.query(
      `INSERT INTO prompt_templates (cliente_id, version, label, body, is_active, agent_id)
       VALUES ($1, $2, $3, $4, false, $5)
       RETURNING *`,
      [clienteId, nextVersion, autoLabel, body, agentId]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("❌ Erro ao criar prompt template:", error);
    return res.status(500).json({ success: false, message: "Erro ao criar prompt template.", error: error.message });
  }
});

// POST /api/prompt-templates/predefined — Criar e ativar imediatamente uma versão predefinida (Agentes)
router.post("/prompt-templates/predefined", async (req: Request, res: Response) => {
  const client = await db.connect();
  try {
    const { clienteId, body, label, agentId = 'estrategista' } = req.body;
    if (!clienteId || !body || !label) {
      client.release();
      return res.status(400).json({ success: false, message: "Campos obrigatórios: clienteId, label e body." });
    }

    await client.query("BEGIN");

    // 1. Desativar templates antigas deste agente neste cliente
    await client.query(
      "UPDATE prompt_templates SET is_active = false WHERE cliente_id = $1 AND agent_id = $2",
      [clienteId, agentId]
    );

    // 2. Determinar a próxima versão
    const versionResult = await client.query(
      "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM prompt_templates WHERE cliente_id = $1",
      [clienteId]
    );
    const nextVersion = versionResult.rows[0].next_version;

    // 3. Inserir já como ativo
    const result = await client.query(
      `INSERT INTO prompt_templates (cliente_id, version, label, body, is_active, agent_id)
       VALUES ($1, $2, $3, $4, true, $5)
       RETURNING *`,
      [clienteId, nextVersion, label, body, agentId]
    );

    await client.query("COMMIT");
    client.release();
    return res.status(201).json({ success: true, data: result.rows[0], message: "Agente ativado com sucesso!" });
  } catch (error: any) {
    try { await client.query("ROLLBACK"); } catch (_) { }
    client.release();
    console.error("❌ Erro ao ativar agente predefinido:", error);
    return res.status(500).json({ success: false, message: "Erro ao ativar agente predefinido.", error: error.message });
  }
});

// POST /api/prompt-templates/:id/activate — Ativa versão com guardrails + transação atômica
router.post("/prompt-templates/:id/activate", async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // SELECT FOR UPDATE: bloqueia a linha até o fim da transação,
    // evitando race condition com ativação concorrente do mesmo template.
    const templateResult = await client.query(
      "SELECT * FROM prompt_templates WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (templateResult.rows.length === 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(404).json({ success: false, message: "Template não encontrado." });
    }

    const template = templateResult.rows[0];
    const templateAgentId = template.agent_id || 'estrategista';

    // ── Guardrails canônicos de ativação ───────────────────────────────
    const validationErrors = validateTemplateBody(template.body);
    if (validationErrors.length > 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(400).json({
        success: false,
        message: "Template não pode ser ativado: falhou nas validações.",
        errors: validationErrors,
      });
    }
    // ───────────────────────────────────────────────────────────────────

    // Desativa TODOS do mesmo escopo (cliente ou global) E MESMO AGENTE
    if (template.cliente_id) {
      await client.query(
        "UPDATE prompt_templates SET is_active = false, updated_at = NOW() WHERE cliente_id = $1 AND agent_id = $2 AND id <> $3",
        [template.cliente_id, templateAgentId, id]
      );
    } else {
      await client.query(
        "UPDATE prompt_templates SET is_active = false, updated_at = NOW() WHERE cliente_id IS NULL AND agent_id = $1 AND id <> $2",
        [templateAgentId, id]
      );
    }

    // Ativa o template alvo
    await client.query(
      "UPDATE prompt_templates SET is_active = true, updated_at = NOW() WHERE id = $1",
      [id]
    );

    await client.query("COMMIT");
    client.release();

    const updated = await db.query("SELECT * FROM prompt_templates WHERE id = $1", [id]);
    return res.json({ success: true, data: updated.rows[0] });
  } catch (error: any) {
    try { await client.query("ROLLBACK"); } catch (_) { }
    client.release();
    console.error("❌ Erro ao ativar prompt template:", error);
    return res.status(500).json({ success: false, message: "Erro ao ativar prompt template.", error: error.message });
  }
});

// DELETE /api/prompt-templates/:id — Deleta (recusa se ativo ou global)
router.delete("/prompt-templates/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const templateResult = await db.query("SELECT * FROM prompt_templates WHERE id = $1", [id]);
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Template não encontrado." });
    }
    const template = templateResult.rows[0];
    if (template.is_active) {
      return res.status(400).json({ success: false, message: "Não é possível deletar o template ativo. Ative outro primeiro." });
    }
    if (!template.cliente_id) {
      return res.status(400).json({ success: false, message: "O template global padrão não pode ser deletado." });
    }
    await db.query("DELETE FROM prompt_templates WHERE id = $1", [id]);
    return res.json({ success: true, message: "Template removido com sucesso." });
  } catch (error: any) {
    console.error("❌ Erro ao deletar prompt template:", error);
    return res.status(500).json({ success: false, message: "Erro ao deletar prompt template.", error: error.message });
  }
});

// POST /api/prompt-templates/preview — Renderiza o prompt SEM chamar a IA
//
// Body: { clientId: string, bodyOverride?: string, mes?: string, mode?: "mock" | "real" }
// - Renderiza e informa missing/unknown variables.
//
router.post("/prompt-templates/preview", async (req: Request, res: Response) => {
  try {
    const { clientId, bodyOverride, mes, mode = "mock" } = req.body as {
      clientId?: string;
      bodyOverride?: string;
      mes?: string;
      mode?: "mock" | "real";
    };

    if (!clientId) {
      return res.status(400).json({ success: false, message: "clientId é obrigatório." });
    }

    // 1. Resolver qual body usar
    let templateBody = bodyOverride ?? "";
    let usedTemplate: { id: string | null; version: number | null; clienteId: string | null; source: string } = {
      id: null,
      version: null,
      clienteId: null,
      source: "override"
    };

    if (bodyOverride === undefined || bodyOverride === null) {
      const tplResult = await db.query(
        `SELECT id, version, body, cliente_id
         FROM prompt_templates
         WHERE (cliente_id = $1 OR cliente_id IS NULL) AND is_active = true
         ORDER BY (cliente_id IS NOT NULL) DESC
         LIMIT 1`,
        [clientId]
      );
      if (tplResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Nenhum template ativo encontrado para este cliente." });
      }
      const row = tplResult.rows[0];
      templateBody = row.body;
      usedTemplate = {
        id: row.id,
        version: row.version,
        clienteId: row.cliente_id,
        source: row.cliente_id ? "client" : "global"
      };
    } else {
      usedTemplate = { id: null, version: null, clienteId: clientId, source: "override" };
    }

    // 2. Guardrails (warnings de ativação globais)
    const guardrailErrors = validateTemplateBody(templateBody);

    // 3. Extrair variáveis mapeadas / desconhecidas / usadas
    const usedPlaceholders = extractPlaceholders(templateBody);
    const unknownVariables = usedPlaceholders.filter(p => !SUPPORTED_VARIABLES.some(v => v.key === p));
    const knownPlaceholders = usedPlaceholders.filter(p => SUPPORTED_VARIABLES.some(v => v.key === p));

    // 4. Renderizar (Mock vs Real)
    const contextVars = await buildPreviewContext(clientId, mes, mode);
    let { rendered, missing } = renderTemplate(templateBody, contextVars);

    // Limitamos output se for modo real para não sobrecarregar
    if (mode === 'real' && rendered.length > 50000) {
      rendered = rendered.substring(0, 50000) + "\n\n...[TRUNCADO: Prévia longa demais para visualização].";
    }

    return res.json({
      success: true,
      renderedPrompt: rendered,
      missingVariables: missing,
      unknownVariables,
      variablesUsed: knownPlaceholders,
      guardrailErrors,
      usedTemplate,
      tokenEstimate: Math.ceil(rendered.length / 4), // estimativa grosseira
    });
  } catch (error: any) {
    console.error("❌ Erro ao gerar preview:", error);
    return res.status(500).json({ success: false, message: "Erro ao gerar preview.", error: error.message });
  }
});

// GET /api/prompt-templates-catalog/variables
router.get("/prompt-templates-catalog/variables", (_req: Request, res: Response) => {
  return res.json({ success: true, data: SUPPORTED_VARIABLES });
});

export default router;
