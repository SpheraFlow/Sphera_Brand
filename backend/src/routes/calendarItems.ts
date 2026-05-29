import { Router, Response } from "express";
import db from "../config/database";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth";
import logger from "../utils/logger";

const router = Router();
router.use(requireAuth);

// =====================================================================
// STORY-009 — Workflow de Aprovação (Kanban)
// approval_status segue um fluxo direcional:
//   draft -> in_review -> approved -> published
// Permite "retornar" para qualquer estado anterior (ex: approved -> in_review),
// MAS bloqueia o salto direto para 'published' sem ter passado por 'approved'.
// =====================================================================
type ApprovalStatus = "draft" | "in_review" | "approved" | "published";
const APPROVAL_STATUSES: readonly ApprovalStatus[] = [
    "draft",
    "in_review",
    "approved",
    "published",
] as const;

const isApprovalStatus = (v: unknown): v is ApprovalStatus =>
    typeof v === "string" && (APPROVAL_STATUSES as readonly string[]).includes(v);

/**
 * Valida transição de approval_status.
 * Regra de negócio (AC3): só pode entrar em 'published' se já passou por 'approved'.
 * Implementação: o item DEVE estar em 'approved' no momento da transição para 'published'.
 * Transições para qualquer outro estado são livres (suporta voltar para revisão).
 */
function validateApprovalTransition(
    from: ApprovalStatus,
    to: ApprovalStatus
): { ok: true } | { ok: false; reason: string } {
    if (from === to) return { ok: true };
    if (to === "published" && from !== "approved") {
        return {
            ok: false,
            reason: "Transição inválida: post precisa estar em 'approved' antes de ser 'published'.",
        };
    }
    return { ok: true };
}

// Verifica se o usuário autenticado tem acesso ao cliente
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

// Colunas comuns retornadas em todas as queries de leitura de calendar_items.
// Centralizar evita drift entre endpoints.
const CALENDAR_ITEM_COLUMNS = `
    id, calendario_id, cliente_id, dia, tema, formato,
    status, revisions_count,
    first_generated_at, approved_at, published_at, last_updated_at, notes,
    creative_status, selected_creative_asset_id, latest_creative_job_id,
    approval_status, reviewer_notes
`;

// GET /api/calendarios/:calendarioId/items
// Lista os calendar_items de um calendário específico
router.get("/calendarios/:calendarioId/items", async (req: AuthRequest, res: Response) => {
    try {
        const { calendarioId } = req.params;

        const calResult = await db.query(
            "SELECT cliente_id FROM calendarios WHERE id=$1",
            [calendarioId]
        );
        if (calResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Calendário não encontrado." });
        }

        const clienteId: string = calResult.rows[0].cliente_id;
        if (!(await hasClientAccess(req, clienteId))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        const items = await db.query(
            `SELECT ${CALENDAR_ITEM_COLUMNS}
             FROM calendar_items
             WHERE calendario_id = $1
             ORDER BY dia ASC`,
            [calendarioId]
        );

        return res.json({ success: true, items: items.rows });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// PATCH /api/calendar-items/:id
// Atualiza status (e notas) de um item — incrementa revisions_count quando status muda
router.patch("/calendar-items/:id", async (req: AuthRequest, res: Response) => {
    const VALID_STATUSES = ["draft", "approved", "needs_edit", "redo", "published"] as const;
    type ItemStatus = (typeof VALID_STATUSES)[number];

    try {
        const { id } = req.params;
        const { status, notes } = req.body as { status?: string; notes?: string };

        if (!status || !VALID_STATUSES.includes(status as ItemStatus)) {
            return res.status(400).json({
                success: false,
                error: `Status inválido. Valores aceitos: ${VALID_STATUSES.join(", ")}.`,
            });
        }

        // Busca item e verifica posse
        const existing = await db.query(
            "SELECT id, cliente_id, status, revisions_count FROM calendar_items WHERE id=$1",
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Item não encontrado." });
        }

        const item = existing.rows[0];
        if (!(await hasClientAccess(req, item.cliente_id))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        const statusChanged = item.status !== status;
        const newRevisions: number = statusChanged ? item.revisions_count + 1 : item.revisions_count;

        // approved_at: seta somente na primeira vez que entra em 'approved'
        // published_at: seta somente na primeira vez que entra em 'published'
        const result = await db.query(
            `UPDATE calendar_items
             SET status          = $1,
                 notes           = COALESCE($2, notes),
                 revisions_count = $3,
                 last_updated_at = NOW(),
                 updated_by      = $4,
                 approved_at     = CASE WHEN $5 THEN NOW() ELSE approved_at END,
                 published_at    = CASE WHEN $6 THEN NOW() ELSE published_at END
             WHERE id = $7
             RETURNING *`,
            [
                status,
                notes ?? null,
                newRevisions,
                req.user?.id ?? null,
                status === "approved" && item.status !== "approved",
                status === "published" && item.status !== "published",
                id,
            ]
        );

        return res.json({ success: true, item: result.rows[0] });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================================
// STORY-009 — PATCH /api/calendar-items/:id/status
// Atualiza approval_status (Kanban) e opcionalmente reviewer_notes.
// Distinto do PATCH /api/calendar-items/:id (que mexe em `status` legado).
// =====================================================================
router.patch("/calendar-items/:id/status", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const body = req.body as { approval_status?: unknown; reviewer_notes?: unknown };

        const nextStatus = body.approval_status;
        const reviewerNotes = body.reviewer_notes;

        if (nextStatus !== undefined && !isApprovalStatus(nextStatus)) {
            return res.status(400).json({
                success: false,
                error: `approval_status inválido. Valores aceitos: ${APPROVAL_STATUSES.join(", ")}.`,
            });
        }

        if (reviewerNotes !== undefined && reviewerNotes !== null && typeof reviewerNotes !== "string") {
            return res.status(400).json({
                success: false,
                error: "reviewer_notes deve ser string ou null.",
            });
        }

        // Carrega item + valida posse
        const existing = await db.query(
            "SELECT id, cliente_id, approval_status FROM calendar_items WHERE id=$1",
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Item não encontrado." });
        }

        const item = existing.rows[0];
        if (!(await hasClientAccess(req, item.cliente_id))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        const fromStatus: ApprovalStatus =
            (item.approval_status as ApprovalStatus) ?? "draft";

        // Se aplicou approval_status, valida a transição.
        if (nextStatus !== undefined) {
            const check = validateApprovalTransition(fromStatus, nextStatus);
            if (!check.ok) {
                logger.warn(
                    {
                        event: "approval_transition_rejected",
                        item_id: id,
                        from: fromStatus,
                        to: nextStatus,
                        user_id: req.user?.id ?? null,
                    },
                    check.reason
                );
                return res.status(400).json({ success: false, error: check.reason });
            }
        }

        // Constrói UPDATE dinamicamente — só toca nas colunas enviadas.
        const sets: string[] = ["last_updated_at = NOW()", "updated_by = $1"];
        const params: any[] = [req.user?.id ?? null];

        if (nextStatus !== undefined) {
            params.push(nextStatus);
            sets.push(`approval_status = $${params.length}`);
        }
        if (reviewerNotes !== undefined) {
            params.push(reviewerNotes ?? null);
            sets.push(`reviewer_notes = $${params.length}`);
        }

        params.push(id);
        const idIndex = params.length;

        const result = await db.query(
            `UPDATE calendar_items
             SET ${sets.join(", ")}
             WHERE id = $${idIndex}
             RETURNING ${CALENDAR_ITEM_COLUMNS}`,
            params
        );

        logger.info(
            {
                event: "approval_status_updated",
                item_id: id,
                from: fromStatus,
                to: nextStatus ?? fromStatus,
                user_id: req.user?.id ?? null,
            },
            "approval_status updated"
        );

        // STORY-013 — Trigger RAG: ao APROVAR um post, enfileira um job de embedding
        // (fila embedding_jobs, processada pelo embeddingWorker). Assincrono e
        // resiliente — nunca bloqueia nem falha a resposta de aprovacao.
        if (nextStatus === "approved" && fromStatus !== "approved") {
            try {
                await db.query(
                    `INSERT INTO embedding_jobs (cliente_id, source_type, source_id, status)
                     SELECT ci.cliente_id, 'past_post_approved', ci.id, 'pending'
                     FROM calendar_items ci WHERE ci.id = $1`,
                    [id]
                );
                logger.info(
                    {
                        event: "rag_ingest_triggered",
                        source_type: "past_post_approved",
                        calendar_item_id: id,
                    },
                    "Embedding job enfileirado para post aprovado"
                );
            } catch (err: any) {
                logger.warn(
                    { event: "rag_ingest_enqueue_failed", calendar_item_id: id, err: err?.message },
                    "Falha ao enfileirar embedding — nao bloqueia aprovacao"
                );
            }
        }

        return res.json({ success: true, item: result.rows[0] });
    } catch (error: any) {
        logger.error(
            { event: "approval_status_update_failed", err: error?.message },
            "PATCH /calendar-items/:id/status failed"
        );
        return res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================================
// STORY-009 — POST /api/calendar-items/:id/comment
// Insere um comentário associado ao calendar_item. user_id vem do JWT.
// =====================================================================
router.post("/calendar-items/:id/comment", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { content } = req.body as { content?: unknown };

        if (typeof content !== "string" || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: "content é obrigatório (string não vazia).",
            });
        }
        if (content.length > 5000) {
            return res.status(400).json({
                success: false,
                error: "content excede o limite de 5000 caracteres.",
            });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: "Usuário não autenticado." });
        }

        const existing = await db.query(
            "SELECT id, cliente_id FROM calendar_items WHERE id=$1",
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Item não encontrado." });
        }

        const item = existing.rows[0];
        if (!(await hasClientAccess(req, item.cliente_id))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        const result = await db.query(
            `INSERT INTO post_comments (calendar_item_id, user_id, content)
             VALUES ($1, $2, $3)
             RETURNING id, calendar_item_id, user_id, content, created_at`,
            [id, userId, content.trim()]
        );

        // Devolve já hidratado com nome do usuário (para o painel exibir sem refetch)
        const userInfo = await db.query(
            "SELECT id, nome, email FROM users WHERE id=$1",
            [userId]
        );

        const comment = {
            ...result.rows[0],
            user_name: userInfo.rows[0]?.nome ?? null,
            user_email: userInfo.rows[0]?.email ?? null,
        };

        logger.info(
            {
                event: "post_comment_created",
                item_id: id,
                comment_id: comment.id,
                user_id: userId,
            },
            "post_comment created"
        );

        return res.status(201).json({ success: true, comment });
    } catch (error: any) {
        logger.error(
            { event: "post_comment_create_failed", err: error?.message },
            "POST /calendar-items/:id/comment failed"
        );
        return res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================================
// STORY-009 — GET /api/calendar-items/:id/comments
// Lista comentários do item, ordenados do mais antigo ao mais recente,
// com JOIN em users para devolver nome/email.
// =====================================================================
router.get("/calendar-items/:id/comments", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const existing = await db.query(
            "SELECT id, cliente_id FROM calendar_items WHERE id=$1",
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Item não encontrado." });
        }

        const item = existing.rows[0];
        if (!(await hasClientAccess(req, item.cliente_id))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        const result = await db.query(
            `SELECT pc.id,
                    pc.calendar_item_id,
                    pc.user_id,
                    pc.content,
                    pc.created_at,
                    u.nome  AS user_name,
                    u.email AS user_email
             FROM post_comments pc
             LEFT JOIN users u ON u.id = pc.user_id
             WHERE pc.calendar_item_id = $1
             ORDER BY pc.created_at ASC`,
            [id]
        );

        return res.json({ success: true, comments: result.rows });
    } catch (error: any) {
        logger.error(
            { event: "post_comments_list_failed", err: error?.message },
            "GET /calendar-items/:id/comments failed"
        );
        return res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/calendarios/:calendarioId/items/status
// Cria ou atualiza um calendar_item pela chave composta (calendarioId, dia, tema, formato).
// Usado quando o item ainda não existe no DB (calendário sem items gerados).
router.post("/calendarios/:calendarioId/items/status", async (req: AuthRequest, res: Response) => {
    const VALID_STATUSES = ["draft", "approved", "needs_edit", "redo", "published"] as const;
    type ItemStatus = (typeof VALID_STATUSES)[number];

    try {
        const { calendarioId } = req.params;
        const { dia, tema, formato, status } = req.body as {
            dia?: number; tema?: string; formato?: string; status?: string;
        };

        if (!status || !VALID_STATUSES.includes(status as ItemStatus)) {
            return res.status(400).json({
                success: false,
                error: `Status inválido. Valores aceitos: ${VALID_STATUSES.join(", ")}.`,
            });
        }
        if (!dia || !tema || !formato) {
            return res.status(400).json({ success: false, error: "dia, tema e formato são obrigatórios." });
        }

        const calResult = await db.query(
            "SELECT id, cliente_id FROM calendarios WHERE id=$1",
            [calendarioId]
        );
        if (calResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Calendário não encontrado." });
        }

        const clienteId: string = calResult.rows[0].cliente_id;
        if (!(await hasClientAccess(req, clienteId))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        // Busca item existente pela chave composta
        const existing = await db.query(
            `SELECT id, status, revisions_count FROM calendar_items
             WHERE calendario_id=$1 AND dia=$2 AND tema=$3 AND formato=$4`,
            [calendarioId, dia, tema, formato]
        );

        let result;
        if (existing.rows.length > 0) {
            // Atualiza item existente
            const item = existing.rows[0];
            const statusChanged = item.status !== status;
            const newRevisions: number = statusChanged ? item.revisions_count + 1 : item.revisions_count;
            result = await db.query(
                `UPDATE calendar_items
                 SET status          = $1,
                     revisions_count = $2,
                     last_updated_at = NOW(),
                     updated_by      = $3,
                     approved_at     = CASE WHEN $4 THEN NOW() ELSE approved_at END,
                     published_at    = CASE WHEN $5 THEN NOW() ELSE published_at END
                 WHERE id = $6
                 RETURNING *`,
                [
                    status,
                    newRevisions,
                    req.user?.id ?? null,
                    status === "approved" && item.status !== "approved",
                    status === "published" && item.status !== "published",
                    item.id,
                ]
            );
        } else {
            // Cria novo item
            result = await db.query(
                `INSERT INTO calendar_items
                     (cliente_id, calendario_id, dia, tema, formato, status, approved_at, published_at)
                 VALUES ($1, $2, $3, $4, $5, $6,
                     CASE WHEN $6 = 'approved'  THEN NOW() ELSE NULL END,
                     CASE WHEN $6 = 'published' THEN NOW() ELSE NULL END)
                 RETURNING *`,
                [clienteId, calendarioId, dia, tema, formato, status]
            );
        }

        return res.json({ success: true, item: result.rows[0] });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/calendarios/:calendarioId/items/seed
// Lê os posts do JSON do calendário e cria calendar_items com status='draft' para qualquer
// post que ainda não tenha registro. Idempotente — não duplica registros existentes.
router.post("/calendarios/:calendarioId/items/seed", async (req: AuthRequest, res: Response) => {
    try {
        const { calendarioId } = req.params;

        const calResult = await db.query(
            "SELECT id, cliente_id, calendario_json AS posts FROM calendarios WHERE id=$1",
            [calendarioId]
        );
        if (calResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Calendário não encontrado." });
        }

        const { cliente_id: clienteId, posts: postsRaw } = calResult.rows[0];
        if (!(await hasClientAccess(req, clienteId))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        let posts: any[] = [];
        try {
            posts = typeof postsRaw === "string" ? JSON.parse(postsRaw) : (postsRaw ?? []);
        } catch {
            return res.status(400).json({ success: false, error: "JSON de posts inválido no calendário." });
        }

        let created = 0;
        for (const post of posts) {
            // Suporta schema canônico (dia:number) e legado (data:"DD/MM")
            let dia: number = 0;
            if (typeof post.dia === "number" && post.dia >= 1 && post.dia <= 31) {
                dia = post.dia;
            } else if (typeof post.data === "string") {
                dia = parseInt(post.data.split("/")[0] ?? "0", 10);
            }
            const tema = (post.tema ?? "").trim();
            const formato = (post.formato ?? "").trim();
            if (!dia || !tema || !formato) continue;

            // INSERT somente se não existe — idempotente
            const r = await db.query(
                `INSERT INTO calendar_items (cliente_id, calendario_id, dia, tema, formato)
                 SELECT $1, $2, $3, $4, $5
                 WHERE NOT EXISTS (
                     SELECT 1 FROM calendar_items
                     WHERE calendario_id=$2 AND dia=$3 AND tema=$4 AND formato=$5
                 )`,
                [clienteId, calendarioId, dia, tema, formato]
            );
            if ((r.rowCount ?? 0) > 0) created++;
        }

        // Retornar todos os itens do calendário para atualizar o mapa no frontend
        const items = await db.query(
            `SELECT ${CALENDAR_ITEM_COLUMNS}
             FROM calendar_items WHERE calendario_id=$1 ORDER BY dia ASC`,
            [calendarioId]
        );

        return res.json({ success: true, created, items: items.rows });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================================
// STORY-008 — Geração de Imagem AI Inline
// POST /api/calendar-items/:id/generate-image  → cria um job de geração
// GET  /api/calendar-items/:id/image-job        → status do job mais recente
// =====================================================================
const VALID_ASPECT_RATIOS = ["1:1", "9:16", "4:5"] as const;
type AspectRatio = (typeof VALID_ASPECT_RATIOS)[number];
const isAspectRatio = (v: unknown): v is AspectRatio =>
    typeof v === "string" && (VALID_ASPECT_RATIOS as readonly string[]).includes(v);

// POST /api/calendar-items/:id/generate-image
// Cria um job de geração de imagem (status='pending') para o item.
// Se já houver job 'pending' ou 'processing' para o item, retorna 409 (evita duplicar custo).
router.post("/calendar-items/:id/generate-image", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { aspectRatio } = req.body as { aspectRatio?: unknown };

        if (aspectRatio !== undefined && !isAspectRatio(aspectRatio)) {
            return res.status(400).json({
                success: false,
                error: `aspectRatio inválido. Valores aceitos: ${VALID_ASPECT_RATIOS.join(", ")}.`,
            });
        }
        const resolvedAspectRatio: AspectRatio = isAspectRatio(aspectRatio) ? aspectRatio : "1:1";

        // Carrega item + valida posse
        const existing = await db.query(
            "SELECT id, cliente_id FROM calendar_items WHERE id=$1",
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Item não encontrado." });
        }

        const item = existing.rows[0];
        if (!(await hasClientAccess(req, item.cliente_id))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        // Já existe job em andamento? Evita geração duplicada / custo desnecessário.
        const inFlight = await db.query(
            `SELECT id, status FROM image_generation_jobs
             WHERE calendar_item_id = $1 AND status IN ('pending','processing')
             LIMIT 1`,
            [id]
        );
        if (inFlight.rows.length > 0) {
            logger.warn(
                {
                    event: "image_job_already_in_flight",
                    item_id: id,
                    existing_job_id: inFlight.rows[0].id,
                    existing_status: inFlight.rows[0].status,
                },
                "Tentativa de criar job de imagem com job já em andamento"
            );
            return res.status(409).json({
                success: false,
                error: "Já existe uma geração de imagem em andamento para este post.",
                jobId: inFlight.rows[0].id,
                status: inFlight.rows[0].status,
            });
        }

        // Cria o job e marca o item como 'pending' (para a UI refletir imediatamente).
        const inserted = await db.query(
            `INSERT INTO image_generation_jobs (calendar_item_id, cliente_id, status, aspect_ratio)
             VALUES ($1, $2, 'pending', $3)
             RETURNING id, status`,
            [id, item.cliente_id, resolvedAspectRatio]
        );
        const job = inserted.rows[0];

        await db.query(
            `UPDATE calendar_items SET image_status = 'pending', last_updated_at = NOW() WHERE id = $1`,
            [id]
        );

        logger.info(
            {
                event: "image_job_created",
                item_id: id,
                job_id: job.id,
                aspect_ratio: resolvedAspectRatio,
                user_id: req.user?.id ?? null,
            },
            "image_generation_job created"
        );

        return res.status(201).json({ success: true, jobId: job.id, status: job.status });
    } catch (error: any) {
        logger.error(
            { event: "image_job_create_failed", err: error?.message },
            "POST /calendar-items/:id/generate-image failed"
        );
        return res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/calendar-items/:id/image-job
// Retorna o job de geração de imagem mais recente para o item (para polling no frontend).
router.get("/calendar-items/:id/image-job", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const existing = await db.query(
            "SELECT id, cliente_id FROM calendar_items WHERE id=$1",
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Item não encontrado." });
        }

        const item = existing.rows[0];
        if (!(await hasClientAccess(req, item.cliente_id))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        const result = await db.query(
            `SELECT id, status, image_url, last_error, attempt_count
             FROM image_generation_jobs
             WHERE calendar_item_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Nenhum job de imagem para este item." });
        }

        const job = result.rows[0];
        return res.json({
            success: true,
            jobId: job.id,
            status: job.status,
            imageUrl: job.image_url ?? null,
            error: job.last_error ?? null,
            attemptCount: job.attempt_count ?? 0,
        });
    } catch (error: any) {
        logger.error(
            { event: "image_job_fetch_failed", err: error?.message },
            "GET /calendar-items/:id/image-job failed"
        );
        return res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
