import { Router, Response } from "express";
import db from "../config/database";
import { requireAuth, requirePermission, AuthRequest } from "../middlewares/requireAuth";

const router = Router();

function normalizeCategoriasNicho(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((c) => String(c).trim()).filter((c) => c.length > 0);
  if (typeof input === "string") return input.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
  return [];
}

// Requer autenticaÃ§Ã£o para todas as rotas neste router
router.use(requireAuth);

// POST /api/clients - Criar novo cliente (PermissÃ£o: clients_manage)
router.post("/", requirePermission("clients_manage"), async (req: AuthRequest, res: Response) => {
  try {
    const { nome, persona_atualizada, categorias_nicho, clickup_list_id } = req.body;
    const logoUrl = req.file ? `/uploads/logos/${req.file.filename}` : null;
    if (!nome) return res.status(400).json({ success: false, error: "Campo 'nome' Ã© obrigatÃ³rio." });

    const result = await db.query(
      `INSERT INTO clientes (nome, persona_atualizada, categorias_nicho, logo_url, clickup_list_id) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nome, persona_atualizada, JSON.stringify(categorias_nicho || []), logoUrl, clickup_list_id || null]
    );
    return res.status(201).json({ success: true, cliente: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Erro ao criar cliente: " + error.message });
  }
});

// DELETE /api/clients/:id - Excluir cliente (PermissÃ£o: clients_manage)
router.delete("/:id", requirePermission("clients_manage"), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query("DELETE FROM clientes WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Cliente nÃ£o encontrado." });
    return res.json({ success: true, message: "Cliente excluÃ­do com sucesso." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Erro ao excluir cliente." });
  }
});

// GET /api/clients - Listar clientes (Admin/Quem tem 'clients_manage' vÃª todos, outros veem vinculados)
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const canManageClients = req.user?.permissions?.clients_manage;
    const userId = req.user?.id;
    let result;

    if (userRole === 'admin' || canManageClients) {
      result = await db.query("SELECT id, nome, persona_atualizada, categorias_nicho, logo_url, clickup_list_id, criado_em FROM clientes ORDER BY criado_em DESC");
    } else {
      result = await db.query(`
        SELECT c.id, c.nome, c.persona_atualizada, c.categorias_nicho, c.logo_url, c.clickup_list_id, c.criado_em 
        FROM clientes c
        JOIN user_clientes uc ON c.id = uc.cliente_id
        WHERE uc.user_id = $1
        ORDER BY c.criado_em DESC
      `, [userId]);
    }

    const clientesComExtras = result.rows.map((c: any) => ({ ...c, status: "Ativo", avatarUrl: null }));
    return res.json({ success: true, clientes: clientesComExtras });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Erro ao listar clientes." });
  }
});

// GET /api/clients/:id - Buscar cliente (Se nÃ£o tem permissÃ£o de gerir, verificar vÃ­nculo)
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const canManageClients = req.user?.permissions?.clients_manage;
    const userId = req.user?.id;

    if (userRole !== 'admin' && !canManageClients) {
      const vinculo = await db.query("SELECT 1 FROM user_clientes WHERE user_id = $1 AND cliente_id = $2", [userId, id]);
      if (vinculo.rows.length === 0) return res.status(403).json({ success: false, error: "Acesso negado a este cliente." });
    }

    const result = await db.query("SELECT id, nome, persona_atualizada, categorias_nicho, logo_url, clickup_list_id, criado_em FROM clientes WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Cliente nÃ£o encontrado." });

    return res.json({ success: true, cliente: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Erro ao buscar cliente." });
  }
});

// PUT /api/clients/:id - Atualizar dados
// Quem tem 'clients_manage' pode tudo. Outros apenas se tiverem vÃ­nculo (e geralmente o frontend limitarÃ¡ a ediÃ§Ã£o de nicho)
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const canManageClients = req.user?.permissions?.clients_manage;
    const userId = req.user?.id;

    if (userRole !== 'admin' && !canManageClients) {
      const vinculo = await db.query("SELECT 1 FROM user_clientes WHERE user_id = $1 AND cliente_id = $2", [userId, id]);
      if (vinculo.rows.length === 0) return res.status(403).json({ success: false, error: "Acesso negado." });
    }

    const { nome, categorias_nicho, clickup_list_id, logo_url } = req.body || {};
    const categoriasArray = normalizeCategoriasNicho(categorias_nicho);
    const hasNome = typeof nome === "string" && nome.trim().length > 0;
    const hasCategorias = categorias_nicho !== undefined;
    const hasClickupListId = clickup_list_id !== undefined;
    const hasLogoUrl = logo_url !== undefined;

    if (!hasNome && !hasCategorias && !hasClickupListId && !hasLogoUrl) return res.status(400).json({ success: false, error: "Envie nome ou categorias ou clickup_list_id ou logo_url" });

    const sets: string[] = [];
    const params: any[] = [id];
    let i = 2;
    if (hasNome) { sets.push(`nome = $${i++}`); params.push(String(nome).trim()); }
    if (hasCategorias) { sets.push(`categorias_nicho = $${i++}::jsonb`); params.push(JSON.stringify(categoriasArray)); }
    if (hasClickupListId) { sets.push(`clickup_list_id = $${i++}`); params.push(clickup_list_id ? String(clickup_list_id).trim() : null); }
    if (hasLogoUrl) { sets.push(`logo_url = $${i++}`); params.push(logo_url ? String(logo_url).trim() : null); }

    const result = await db.query(
      `UPDATE clientes SET ${sets.join(", ")} WHERE id = $1 RETURNING id, nome, persona_atualizada, categorias_nicho, logo_url, clickup_list_id, criado_em`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Cliente nÃ£o encontrado." });
    return res.json({ success: true, cliente: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Erro ao atualizar cliente." });
  }
});

// PUT /api/clients/:id/assign - Atribuir cliente a usuÃ¡rio (PermissÃ£o: clients_manage)
router.put("/:id/assign", requirePermission('clients_manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id, action } = req.body; // action: 'add' ou 'remove'

    if (!user_id || !['add', 'remove'].includes(action)) {
      return res.status(400).json({ success: false, error: "ForneÃ§a user_id e action ('add' ou 'remove')." });
    }

    if (action === 'add') {
      await db.query(
        "INSERT INTO user_clientes (user_id, cliente_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [user_id, id]
      );
    } else {
      await db.query(
        "DELETE FROM user_clientes WHERE user_id = $1 AND cliente_id = $2",
        [user_id, id]
      );
    }

    return res.json({ success: true, message: `VÃ­nculo ${action === 'add' ? 'adicionado' : 'removido'} com sucesso.` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Erro ao atualizar vÃ­nculos do cliente." });
  }
});

// GET /api/clients/:id/users - Listar usuÃ¡rios vinculados a um cliente (PermissÃ£o: clients_manage)
router.get("/:id/users", requirePermission('clients_manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT u.id, u.nome, u.email, u.role
      FROM users u
      JOIN user_clientes uc ON u.id = uc.user_id
      WHERE uc.cliente_id = $1
    `, [id]);

    return res.json({ success: true, users: result.rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Erro ao buscar usuÃ¡rios do cliente." });
  }
});

// â”€â”€â”€ Dashboard Metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ChurnInput {
  lastGeneratedAt: Date | string | null;
  approvalRate: number | null;
  publishedRate: number | null;
  avgRevisions: number;
}

function computeChurnRisk(input: ChurnInput): { score: number; label: "Baixo" | "Médio" | "Alto"; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (!input.lastGeneratedAt) {
    score++;
    reasons.push("Nenhum calendário gerado ainda");
  } else {
    const daysSince = (Date.now() - new Date(input.lastGeneratedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 30) {
      score++;
      reasons.push(`Sem geração há ${Math.floor(daysSince)} dias`);
    }
  }

  if (input.approvalRate !== null && input.approvalRate < 0.5) {
    score++;
    reasons.push(`Taxa de aprovação baixa (${Math.round(input.approvalRate * 100)}%)`);
  }

  if (input.publishedRate !== null && input.publishedRate < 0.3) {
    score++;
    reasons.push(`Taxa de publicação baixa (${Math.round(input.publishedRate * 100)}%)`);
  }

  if (input.avgRevisions > 2) {
    score++;
    reasons.push(`Alta média de revisões (${input.avgRevisions.toFixed(1)})`);
  }

  const label: "Baixo" | "Médio" | "Alto" = score <= 1 ? "Baixo" : score <= 2 ? "Médio" : "Alto";
  return { score, label, reasons };
}

// GET /api/clients/:clientId/dashboard-metrics?range=30d|90d|mtd
// Deve vir ANTES de /:id/assign e /:id/users para nÃ£o ser capturado por /:id
router.get("/:clientId/dashboard-metrics", async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const range = String(req.query.range || "30d");

    // Verificar acesso ao cliente
    const userRole = req.user?.role;
    const canManage = req.user?.permissions?.clients_manage;
    const userId = req.user?.id;
    if (userRole !== "admin" && !canManage) {
      const link = await db.query(
        "SELECT 1 FROM user_clientes WHERE user_id=$1 AND cliente_id=$2",
        [userId, clientId]
      );
      if (link.rows.length === 0) return res.status(403).json({ success: false, error: "Acesso negado." });
    }

    // Intervalo de datas
    const now = new Date();
    let rangeStart: Date;
    if (range === "mtd") {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === "90d") {
      rangeStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else {
      rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // 1. Contagem de calendÃ¡rios no perÃ­odo
    const calsResult = await db.query(
      "SELECT id, calendario_json, criado_em FROM calendarios WHERE cliente_id=$1 AND criado_em >= $2",
      [clientId, rangeStart]
    );
    const calendarsCount = calsResult.rows.length;

    // 1.5. AUTO-SEED HISTÃ“RICO: Garantir que calendÃ¡rios antigos tenham seus calendar_items populados
    // Isso resolve a perda do histÃ³rico: calendÃ¡rios antes da migration ou que nÃ£o passaram pelo ClientHub
    try {
      const calsToCheck = calsResult.rows;
      for (const cal of calsToCheck) {
        // Verifica se este calendÃ¡rio jÃ¡ tem itens em calendar_items
        const checkItems = await db.query("SELECT 1 FROM calendar_items WHERE calendario_id=$1 LIMIT 1", [cal.id]);
        if (checkItems.rows.length === 0) {
          // CalendÃ¡rio nÃ£o semeado ainda! Vamos semear com o status histÃ³rico correto.
          let posts: any[] = [];
          try {
            posts = typeof cal.calendario_json === "string" ? JSON.parse(cal.calendario_json) : (cal.calendario_json ?? []);
          } catch { continue; }

          for (const post of posts) {
            let dia: number = 0;
            if (typeof post.dia === "number" && post.dia >= 1 && post.dia <= 31) dia = post.dia;
            else if (typeof post.data === "string") dia = parseInt(post.data.split("/")[0] ?? "0", 10);

            const tema = (post.tema ?? "").trim();
            const formato = (post.formato ?? "").trim();
            if (!dia || !tema || !formato) continue;

            // Mapeia status legado (sugerido, aprovado, publicado) para o novo enum
            // Se post.status nÃ£o existir, o default Ã© 'draft'
            let status = 'draft';
            const legacyStatus = (post.status ?? '').toLowerCase();
            if (legacyStatus === 'aprovado' || legacyStatus === 'approved') status = 'approved';
            else if (legacyStatus === 'needs_edit') status = 'needs_edit';
            else if (legacyStatus === 'redo') status = 'redo';
            else if (legacyStatus === 'publicado' || legacyStatus === 'published') status = 'published';

            // Se for aprovado ou publicado, assumimos a data de criaÃ§Ã£o do calendÃ¡rio para o first_generated_at,
            // e a mesma data para o approved_at / published_at (para nÃ£o perder a contabilizaÃ§Ã£o de funil)
            const calDate = cal.criado_em;

            await db.query(
              `INSERT INTO calendar_items 
                 (cliente_id, calendario_id, dia, tema, formato, status, revisions_count, first_generated_at, approved_at, published_at, last_updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 
                 CASE WHEN $6 = 'approved' THEN $8 ELSE NULL END,
                 CASE WHEN $6 = 'published' THEN $8 ELSE NULL END,
                 $8)
               ON CONFLICT DO NOTHING`,
              [
                clientId,
                cal.id,
                dia,
                tema,
                formato,
                status,
                (status === 'published' || status === 'approved') ? 1 : 0, // Assume 1 rev. se history
                calDate
              ]
            );
          }
          console.log(`[dashboard-metrics] Semeado histÃ³rico para calendÃ¡rio ${cal.id} (${posts.length} posts).`);
        }
      }
    } catch (e: any) {
      console.warn("[dashboard-metrics] Erro no auto-seed histÃ³rico:", e?.message);
    }

    // 2. EstatÃ­sticas dos calendar_items no perÃ­odo (resiliente: tabela pode nÃ£o existir ainda)
    let total = 0, approved = 0, published = 0, avgRevisions = 0, avgTimeMin = 0;
    try {
      const itemsResult = await db.query(
        `SELECT
           COUNT(*)                                                           AS total,
           COUNT(*) FILTER (WHERE status = 'approved')                       AS approved,
           COUNT(*) FILTER (WHERE status = 'published')                      AS published,
           COALESCE(AVG(revisions_count), 0)                                 AS avg_revisions,
           COALESCE(
             AVG(EXTRACT(EPOCH FROM (approved_at - first_generated_at)) / 60)
             FILTER (WHERE approved_at IS NOT NULL),
             0
           )                                                                  AS avg_time_to_approval_min
         FROM calendar_items
         WHERE cliente_id=$1 AND first_generated_at >= $2`,
        [clientId, rangeStart]
      );
      const stats = itemsResult.rows[0] ?? {};
      total = parseInt(stats.total ?? "0", 10);
      approved = parseInt(stats.approved ?? "0", 10);
      published = parseInt(stats.published ?? "0", 10);
      avgRevisions = parseFloat(stats.avg_revisions ?? "0");
      avgTimeMin = parseFloat(stats.avg_time_to_approval_min ?? "0");
    } catch (e: any) {
      // Tabela calendar_items pode nÃ£o existir em instÃ¢ncias sem migraÃ§Ã£o
      console.warn("[dashboard-metrics] calendar_items indisponÃ­vel:", e?.message);
    }

    // 3. Falhas de jobs no perÃ­odo (resiliente)
    const failuresByType: Record<string, number> = {};
    let invalidOutputCount = 0;
    let failedJobsCount = 0;
    try {
      const failedJobsResult = await db.query(
        "SELECT error FROM calendar_generation_jobs WHERE cliente_id=$1 AND status='failed' AND created_at >= $2",
        [clientId, rangeStart]
      );
      failedJobsCount = failedJobsResult.rows.length;
      for (const row of failedJobsResult.rows) {
        const errType: string = row.error?.type ?? row.error?.code ?? "unknown";
        failuresByType[errType] = (failuresByType[errType] ?? 0) + 1;
        if (errType === "INVALID_CALENDAR_OUTPUT") invalidOutputCount++;
      }
    } catch (e: any) {
      console.warn("[dashboard-metrics] calendar_generation_jobs indisponÃ­vel:", e?.message);
    }

    // 4. Custo LLM estimado em BRL via histÃ³rico de tokens
    const clientData = await db.query("SELECT token_usage FROM clientes WHERE id=$1", [clientId]);
    const tokenUsage: any = clientData.rows[0]?.token_usage ?? {};
    const history: any[] = Array.isArray(tokenUsage.history) ? tokenUsage.history : [];

    // PreÃ§os por modelo (USD por 1M tokens) â€” mesma lÃ³gica do frontend TokenUsageDisplay
    const USD_TO_BRL = 5.80;
    type ModelPricing = { input: number; output: number };
    const MODEL_PRICING: Record<string, ModelPricing> = {
      'gemini-3-flash-preview': { input: 0.5, output: 3.0 },
      'gemini-2.5-flash': { input: 0.30, output: 2.50 },
      'gemini-2.5-pro': { input: 1.25, output: 10.00 },
      'gemini-2.0-flash': { input: 0.075, output: 0.30 },
      'gemini-1.5-flash': { input: 0.075, output: 0.30 },
      'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    };
    const DEFAULT_PRICING: ModelPricing = { input: 0.30, output: 2.50 };
    const getPricing = (model: string): ModelPricing => {
      const key = Object.keys(MODEL_PRICING).find(k => (model || '').startsWith(k));
      return key ? (MODEL_PRICING as any)[key] as ModelPricing : DEFAULT_PRICING;
    };

    let llmCostBrl = 0;
    for (const h of history) {
      if (!h.timestamp) continue;
      if (new Date(h.timestamp) < rangeStart) continue;
      const p = getPricing(h.model || '');
      // prompt_tokens = input total (sys + user); completion_tokens = output
      llmCostBrl +=
        ((h.prompt_tokens ?? 0) / 1_000_000) * p.input * USD_TO_BRL +
        ((h.completion_tokens ?? 0) / 1_000_000) * p.output * USD_TO_BRL;
    }
    const llmCostAvgPerCalendar = calendarsCount > 0 ? llmCostBrl / calendarsCount : 0;
    const costPerApprovedPost = approved > 0 ? llmCostBrl / approved : 0;

    // 5. Ãšltima atividade
    const lastCalResult = await db.query(
      "SELECT criado_em FROM calendarios WHERE cliente_id=$1 ORDER BY criado_em DESC LIMIT 1",
      [clientId]
    );
    const lastActivityAt: Date | null = lastCalResult.rows[0]?.criado_em ?? null;

    // 6. Churn risk
    const churnRisk = computeChurnRisk({
      lastGeneratedAt: lastActivityAt,
      approvalRate: total > 0 ? approved / total : null,
      publishedRate: total > 0 ? published / total : null,
      avgRevisions,
    });

    // 7. Tempo ganho com IA
    // Benchmark: SM manager gasta ~5 min/post com apoio de IA (prompt, revisÃ£o, ajuste)
    // Custo/hora baseado em salÃ¡rio CLT: R$2.750 avg (entre R$2.500â€“R$3.000)
    // Dias Ãºteis: mÃ©dia 21,5/mÃªs (entre 21 e 22) Ã— 8h/dia = 172 h/mÃªs
    const MIN_PER_POST_BENCHMARK = 5; // minutos por post (com IA jÃ¡ no fluxo)
    const AVG_SALARY_BRL = 2750;
    const WORK_HOURS_MONTH = 21.5 * 8; // 172 horas
    const BRL_PER_HOUR_SM = AVG_SALARY_BRL / WORK_HOURS_MONTH; // â‰ˆ R$15,99/h
    const timeSavedHours = Math.round((total * MIN_PER_POST_BENCHMARK / 60) * 10) / 10;
    const timeSavedBrl = Math.round(timeSavedHours * BRL_PER_HOUR_SM * 100) / 100;
    const roiRatio = llmCostBrl > 0 ? Math.round((timeSavedBrl / llmCostBrl) * 10) / 10 : 0;

    return res.json({
      success: true,
      range,
      range_start: rangeStart.toISOString(),
      calendars_count: calendarsCount,
      posts_count: total,
      approval_rate: total > 0 ? Math.round((approved / total) * 100) / 100 : null,
      avg_revisions_per_item: Math.round(avgRevisions * 100) / 100,
      avg_time_to_approval_minutes: Math.round(avgTimeMin * 10) / 10,
      planned_vs_published: {
        planned: total,
        published,
        published_rate: total > 0 ? Math.round((published / total) * 100) / 100 : null,
      },
      failures: {
        total: failedJobsCount,
        invalid_output_count: invalidOutputCount,
        by_type: failuresByType,
      },
      llm_cost_brl_total: Math.round(llmCostBrl * 100) / 100,
      llm_cost_brl_avg_per_calendar: Math.round(llmCostAvgPerCalendar * 100) / 100,
      cost_per_approved_post_brl: Math.round(costPerApprovedPost * 100) / 100,
      time_saved_hours: timeSavedHours,
      time_saved_brl_estimate: timeSavedBrl,
      roi_ratio: roiRatio,
      usage: {
        generations: calendarsCount,
        approvals: approved,
        last_activity_at: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
      },
      churn_risk: churnRisk,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


