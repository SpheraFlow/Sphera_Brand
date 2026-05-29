/**
 * STORY-016 — Rotas de publicacao direta (Instagram).
 *
 * Endpoints (todos sob /api, protegidos por requireAuth):
 *   POST   /api/publications/schedule       — agenda um post aprovado (AC1)
 *   PATCH  /api/publications/:id/approve     — aprova a publicacao (AC2a)
 *   DELETE /api/publications/:id/cancel       — cancela (janela 5 min) (AC4)
 *   GET    /api/publications?clienteId=&status= — lista agendamentos
 *
 * Janela de cancelamento (AC4): so e possivel cancelar enquanto
 * scheduled_at > NOW() + 5 min e o status nao for terminal/em processamento.
 *
 * Audit (publication_logs): cada operacao registra um evento append-only.
 * O agendamento usa scheduled_at >= NOW() + 5 min para SEMPRE garantir a
 * janela de cancelamento, mesmo que o usuario peca um horario imediato.
 */
import { Router, Response } from "express";
import db from "../config/database";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth";
import logger from "../utils/logger";
import {
    buildPayloadFromCalendarItem,
    appendPublicationLog,
} from "../services/publicationService";

const router = Router();
router.use(requireAuth);

const pubLog = logger.child({ component: "publicationsRoute" });

/** Janela minima entre agendamento e publicacao (tambem janela de cancelamento). */
const CANCEL_WINDOW_MS = 5 * 60 * 1000;

/** Verifica se o usuario autenticado tem acesso ao cliente. */
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

const PUBLICATION_COLUMNS = `
    id, calendar_item_id, social_account_id, platform, scheduled_at, status,
    platform_post_id, payload, attempts, last_error, approved_by_user_id,
    approved_at, created_at, updated_at
`;

// ───────────────────────────────────────────────────────────────────────────
// POST /api/publications/schedule — cria um agendamento (AC1).
// ───────────────────────────────────────────────────────────────────────────
router.post("/publications/schedule", async (req: AuthRequest, res: Response) => {
    try {
        const body = req.body as {
            calendarItemId?: unknown;
            socialAccountId?: unknown;
            scheduledAt?: unknown;
            platform?: unknown;
        };

        const calendarItemId = typeof body.calendarItemId === "string" ? body.calendarItemId : "";
        const socialAccountId = typeof body.socialAccountId === "string" ? body.socialAccountId : "";
        const scheduledAtRaw = typeof body.scheduledAt === "string" ? body.scheduledAt : "";
        const platform = typeof body.platform === "string" && body.platform ? body.platform : "instagram";

        if (!calendarItemId || !socialAccountId || !scheduledAtRaw) {
            return res.status(400).json({
                success: false,
                error: "calendarItemId, socialAccountId e scheduledAt sao obrigatorios.",
            });
        }

        const scheduledAt = new Date(scheduledAtRaw);
        if (Number.isNaN(scheduledAt.getTime())) {
            return res.status(400).json({ success: false, error: "scheduledAt invalido (use ISO 8601)." });
        }

        // Garante a janela de cancelamento de 5 min: nunca agenda para antes disso.
        const minScheduledAt = new Date(Date.now() + CANCEL_WINDOW_MS);
        const effectiveScheduledAt = scheduledAt < minScheduledAt ? minScheduledAt : scheduledAt;

        // Carrega calendar_item + valida posse e aprovacao (AC1: precisa estar 'approved').
        const ci = await db.query(
            "SELECT id, cliente_id, approval_status FROM calendar_items WHERE id=$1",
            [calendarItemId]
        );
        if (ci.rows.length === 0) {
            return res.status(404).json({ success: false, error: "calendar_item nao encontrado." });
        }
        const item = ci.rows[0];
        if (!(await hasClientAccess(req, item.cliente_id))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }
        if (item.approval_status !== "approved") {
            return res.status(409).json({
                success: false,
                error: "O post precisa estar aprovado (approval_status='approved') antes de agendar.",
            });
        }

        // Valida a conta social: deve existir, ser do mesmo cliente e estar ativa.
        const sa = await db.query(
            "SELECT id, cliente_id, status FROM social_accounts WHERE id=$1",
            [socialAccountId]
        );
        if (sa.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Conta social nao encontrada." });
        }
        const account = sa.rows[0];
        if (account.cliente_id !== item.cliente_id) {
            return res.status(400).json({
                success: false,
                error: "A conta social nao pertence ao mesmo cliente do post.",
            });
        }
        if (account.status !== "active") {
            return res.status(409).json({
                success: false,
                error: `Conta social indisponivel (status=${account.status}). Reconecte antes de agendar.`,
            });
        }

        // Monta o payload de publicacao (caption + media_url) a partir do item.
        let payload;
        try {
            payload = await buildPayloadFromCalendarItem(calendarItemId);
        } catch (payloadErr: any) {
            return res.status(422).json({
                success: false,
                error: payloadErr?.message || "Nao foi possivel montar o payload de publicacao.",
            });
        }

        // Cria o agendamento (status inicial: pending_approval).
        let inserted;
        try {
            inserted = await db.query(
                `INSERT INTO publication_schedules
                     (calendar_item_id, social_account_id, platform, scheduled_at, status, payload)
                 VALUES ($1, $2, $3, $4, 'pending_approval', $5)
                 RETURNING ${PUBLICATION_COLUMNS}`,
                [calendarItemId, socialAccountId, platform, effectiveScheduledAt.toISOString(), JSON.stringify(payload)]
            );
        } catch (insErr: any) {
            // Violacao da unicidade ativa (mesmo item/plataforma ja agendado).
            if (insErr?.code === "23505" || insErr?.code === "23P01") {
                return res.status(409).json({
                    success: false,
                    error: "Ja existe um agendamento ativo para este post nesta plataforma.",
                });
            }
            throw insErr;
        }

        const schedule = inserted.rows[0];
        await appendPublicationLog(schedule.id, "scheduled", {
            calendar_item_id: calendarItemId,
            social_account_id: socialAccountId,
            platform,
            scheduled_at: schedule.scheduled_at,
        });

        pubLog.info(
            {
                event: "publication_scheduled",
                schedule_id: schedule.id,
                calendar_item_id: calendarItemId,
                user_id: req.user?.id ?? null,
            },
            "Publicacao agendada"
        );

        return res.status(201).json({ success: true, schedule });
    } catch (error: any) {
        pubLog.error(
            { event: "publication_schedule_failed", err: error?.message },
            "POST /publications/schedule failed"
        );
        return res.status(500).json({ success: false, error: "Falha ao agendar publicacao." });
    }
});

// ───────────────────────────────────────────────────────────────────────────
// PATCH /api/publications/:id/approve — aprova a publicacao (AC2a).
// ───────────────────────────────────────────────────────────────────────────
router.patch("/publications/:id/approve", async (req: AuthRequest, res: Response) => {
    try {
        const id = String(req.params.id || "");
        if (!id) {
            return res.status(400).json({ success: false, error: "id obrigatorio." });
        }

        const existing = await db.query(
            `SELECT ps.id, ps.status, ci.cliente_id
               FROM publication_schedules ps
               JOIN calendar_items ci ON ci.id = ps.calendar_item_id
              WHERE ps.id = $1`,
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Agendamento nao encontrado." });
        }
        const schedule = existing.rows[0];
        if (!(await hasClientAccess(req, schedule.cliente_id))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        if (schedule.status !== "pending_approval") {
            return res.status(409).json({
                success: false,
                error: `Nao e possivel aprovar um agendamento com status: ${schedule.status}.`,
            });
        }

        const result = await db.query(
            `UPDATE publication_schedules
             SET status = 'approved', approved_by_user_id = $2, approved_at = NOW(), updated_at = NOW()
             WHERE id = $1
             RETURNING ${PUBLICATION_COLUMNS}`,
            [id, req.user?.id ?? null]
        );

        await appendPublicationLog(id, "approved", { approved_by_user_id: req.user?.id ?? null });

        pubLog.info(
            { event: "publication_approved", schedule_id: id, user_id: req.user?.id ?? null },
            "Publicacao aprovada"
        );

        return res.json({ success: true, schedule: result.rows[0] });
    } catch (error: any) {
        pubLog.error(
            { event: "publication_approve_failed", err: error?.message },
            "PATCH /publications/:id/approve failed"
        );
        return res.status(500).json({ success: false, error: "Falha ao aprovar publicacao." });
    }
});

// ───────────────────────────────────────────────────────────────────────────
// DELETE /api/publications/:id/cancel — cancela respeitando a janela de 5 min (AC4).
// ───────────────────────────────────────────────────────────────────────────
router.delete("/publications/:id/cancel", async (req: AuthRequest, res: Response) => {
    try {
        const id = String(req.params.id || "");
        if (!id) {
            return res.status(400).json({ success: false, error: "id obrigatorio." });
        }

        const existing = await db.query(
            `SELECT ps.id, ps.status, ps.scheduled_at, ci.cliente_id
               FROM publication_schedules ps
               JOIN calendar_items ci ON ci.id = ps.calendar_item_id
              WHERE ps.id = $1`,
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Agendamento nao encontrado." });
        }
        const schedule = existing.rows[0];
        if (!(await hasClientAccess(req, schedule.cliente_id))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        // Estados terminais / em processamento nao podem ser cancelados.
        if (["published", "publishing", "failed", "canceled"].includes(schedule.status)) {
            return res.status(409).json({
                success: false,
                error: `Nao e possivel cancelar uma publicacao com status: ${schedule.status}.`,
            });
        }

        // Janela de 5 min: se a publicacao esta dentro (ou alem) do limite, bloqueia.
        const scheduledAt = new Date(schedule.scheduled_at).getTime();
        const fiveMinFromNow = Date.now() + CANCEL_WINDOW_MS;
        if (scheduledAt <= fiveMinFromNow) {
            return res.status(409).json({
                success: false,
                error: "Cancelamento nao permitido: publicacao dentro da janela de 5 minutos ou ja em processamento.",
            });
        }

        const result = await db.query(
            `UPDATE publication_schedules
             SET status = 'canceled', updated_at = NOW()
             WHERE id = $1
             RETURNING ${PUBLICATION_COLUMNS}`,
            [id]
        );

        await appendPublicationLog(id, "canceled", { canceled_by_user_id: req.user?.id ?? null });

        pubLog.info(
            { event: "publication_canceled", schedule_id: id, user_id: req.user?.id ?? null },
            "Publicacao cancelada"
        );

        return res.json({ success: true, schedule: result.rows[0] });
    } catch (error: any) {
        pubLog.error(
            { event: "publication_cancel_failed", err: error?.message },
            "DELETE /publications/:id/cancel failed"
        );
        return res.status(500).json({ success: false, error: "Falha ao cancelar publicacao." });
    }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /api/publications?clienteId=&status= — lista agendamentos de um cliente.
// ───────────────────────────────────────────────────────────────────────────
router.get("/publications", async (req: AuthRequest, res: Response) => {
    try {
        const clienteId = String(req.query.clienteId || "");
        const status = req.query.status ? String(req.query.status) : "";

        if (!clienteId) {
            return res.status(400).json({ success: false, error: "clienteId obrigatorio." });
        }
        if (!(await hasClientAccess(req, clienteId))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        const params: any[] = [clienteId];
        let statusFilter = "";
        if (status) {
            params.push(status);
            statusFilter = `AND ps.status = $${params.length}`;
        }

        const result = await db.query(
            `SELECT ${PUBLICATION_COLUMNS.split(",").map((c) => `ps.${c.trim()}`).join(", ")},
                    ci.dia, ci.tema, ci.formato
               FROM publication_schedules ps
               JOIN calendar_items ci ON ci.id = ps.calendar_item_id
              WHERE ci.cliente_id = $1 ${statusFilter}
              ORDER BY ps.scheduled_at DESC`,
            params
        );

        return res.json({ success: true, schedules: result.rows });
    } catch (error: any) {
        pubLog.error(
            { event: "publications_list_failed", err: error?.message },
            "GET /publications failed"
        );
        return res.status(500).json({ success: false, error: "Falha ao listar publicacoes." });
    }
});

export default router;
