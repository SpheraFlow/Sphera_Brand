import { Router, Response } from "express";
import db from "../config/database";
import { AuthRequest } from "../middlewares/requireAuth";
import logger from "../utils/logger";

const router = Router();

// ─── Token cost pricing (mesma lógica de clients.ts dashboard-metrics) ───────
const USD_TO_BRL = 5.8;
type ModelPricing = { input: number; output: number };
const MODEL_PRICING: Record<string, ModelPricing> = {
  "gemini-3-flash-preview": { input: 0.5, output: 3.0 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "gemini-2.0-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
};
const DEFAULT_PRICING: ModelPricing = { input: 0.3, output: 2.5 };

function getPricing(model: string): ModelPricing {
  const key = Object.keys(MODEL_PRICING).find((k) => (model || "").startsWith(k));
  return (key && MODEL_PRICING[key]) || DEFAULT_PRICING;
}

interface TokenHistoryEntry {
  timestamp?: string;
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface TokenUsageJson {
  history?: TokenHistoryEntry[];
}

/**
 * Soma tokens e custo (em centavos de BRL) a partir do histórico de um cliente,
 * filtrando apenas entradas do mês corrente.
 */
function summarizeMonthlyTokens(
  tokenUsage: TokenUsageJson | null,
  monthStart: Date
): { tokens_used_month: number; cost_cents_month: number } {
  const history: TokenHistoryEntry[] = Array.isArray(tokenUsage?.history)
    ? tokenUsage!.history!
    : [];

  let tokens = 0;
  let costBrl = 0;

  for (const h of history) {
    if (!h.timestamp) continue;
    if (new Date(h.timestamp) < monthStart) continue;

    const prompt = h.prompt_tokens ?? 0;
    const completion = h.completion_tokens ?? 0;
    tokens += h.total_tokens ?? prompt + completion;

    const p = getPricing(h.model || "");
    costBrl +=
      (prompt / 1_000_000) * p.input * USD_TO_BRL +
      (completion / 1_000_000) * p.output * USD_TO_BRL;
  }

  return {
    tokens_used_month: tokens,
    cost_cents_month: Math.round(costBrl * 100),
  };
}

interface ClientRow {
  id: string;
  nome: string;
  token_usage: TokenUsageJson | null;
  posts_approved_month: string | number;
  posts_published_month: string | number;
  last_approved_at: string | null;
}

interface ClientSummary {
  client_id: string;
  client_name: string;
  posts_approved_month: number;
  posts_published_month: number;
}

interface ClientAtRisk {
  client_id: string;
  client_name: string;
  days_since_last_approved: number | null;
}

interface TokenUsageSummary {
  client_id: string;
  client_name: string;
  tokens_used_month: number;
  cost_cents_month: number;
}

// ─── GET /api/agency/dashboard ────────────────────────────────────────────────
// Métricas operacionais agregadas de todos os clientes acessíveis pelo usuário.
// Determinístico (somente SQL + agregação JSONB), sem chamadas a LLM. SLA < 2s.
router.get("/dashboard", async (req: AuthRequest, res: Response) => {
  const start = Date.now();
  try {
    const userRole = req.user?.role;
    const canManageClients = req.user?.permissions?.clients_manage;
    const userId = req.user?.id;

    // Single-agency model: admins / clients_manage veem todos; demais veem vinculados.
    // (mesma regra de visibilidade de GET /api/clients)
    const seesAllClients = userRole === "admin" || canManageClients;

    // Posts agregados por cliente no mês corrente (CTE) + dados do cliente.
    // calendar_items.status é o campo de aprovação real do schema (não approval_status).
    // first_generated_at delimita o mês para os contadores de posts.
    const baseQuery = `
      WITH monthly_posts AS (
        SELECT
          ci.cliente_id,
          COUNT(*) FILTER (WHERE ci.status IN ('approved', 'published')) AS posts_approved_month,
          COUNT(*) FILTER (WHERE ci.status = 'published')                AS posts_published_month
        FROM calendar_items ci
        WHERE ci.first_generated_at >= date_trunc('month', NOW())
          AND ci.first_generated_at <  date_trunc('month', NOW()) + INTERVAL '1 month'
        GROUP BY ci.cliente_id
      ),
      last_approved AS (
        SELECT
          ci.cliente_id,
          MAX(ci.last_updated_at) AS last_approved_at
        FROM calendar_items ci
        WHERE ci.status IN ('approved', 'published')
        GROUP BY ci.cliente_id
      )
      SELECT
        c.id,
        c.nome,
        c.token_usage,
        COALESCE(mp.posts_approved_month, 0)  AS posts_approved_month,
        COALESCE(mp.posts_published_month, 0) AS posts_published_month,
        la.last_approved_at
      FROM clientes c
      LEFT JOIN monthly_posts mp ON mp.cliente_id = c.id
      LEFT JOIN last_approved la ON la.cliente_id = c.id
      ${seesAllClients ? "" : "JOIN user_clientes uc ON uc.cliente_id = c.id AND uc.user_id = $1"}
      ORDER BY c.nome
    `;

    const params = seesAllClients ? [] : [userId];
    const result = await db.query(baseQuery, params);
    const rows = result.rows as ClientRow[];

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const now = Date.now();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    const clients_summary: ClientSummary[] = [];
    const clients_at_risk: ClientAtRisk[] = [];
    const token_usage_summary: TokenUsageSummary[] = [];

    let totalPublishedThisMonth = 0;
    let activeClients = 0; // clientes com pelo menos 1 post no mês corrente

    for (const row of rows) {
      const approved = Number(row.posts_approved_month) || 0;
      const published = Number(row.posts_published_month) || 0;

      clients_summary.push({
        client_id: row.id,
        client_name: row.nome,
        posts_approved_month: approved,
        posts_published_month: published,
      });

      totalPublishedThisMonth += published;
      if (published > 0) activeClients += 1;

      // Cliente em risco: nenhum post approved/published nos últimos 14 dias.
      const lastApproved = row.last_approved_at ? new Date(row.last_approved_at) : null;
      const daysSince =
        lastApproved !== null
          ? Math.floor((now - lastApproved.getTime()) / MS_PER_DAY)
          : null;

      if (daysSince === null || daysSince > 14) {
        clients_at_risk.push({
          client_id: row.id,
          client_name: row.nome,
          days_since_last_approved: daysSince,
        });
      }

      const tokenSummary = summarizeMonthlyTokens(row.token_usage, monthStart);
      token_usage_summary.push({
        client_id: row.id,
        client_name: row.nome,
        ...tokenSummary,
      });
    }

    // APP/CAM = posts publicados no mês / clientes ativos (com >0 publicados) no mês.
    const app_cam_current =
      activeClients > 0
        ? Math.round((totalPublishedThisMonth / activeClients) * 10) / 10
        : 0;

    const elapsed = Date.now() - start;
    logger.info(
      {
        event: "agency_dashboard",
        user_id: userId,
        clients: rows.length,
        elapsed_ms: elapsed,
      },
      "Agency dashboard computed"
    );

    return res.json({
      success: true,
      app_cam_current,
      clients_summary,
      clients_at_risk,
      token_usage_summary,
    });
  } catch (error: any) {
    logger.error(
      { event: "agency_dashboard_error", error_message: error?.message },
      "Falha ao computar dashboard da agência"
    );
    return res
      .status(500)
      .json({ success: false, error: "Erro ao carregar dashboard da agência." });
  }
});

export default router;
