import { Router, Response } from "express";
import db from "../config/database";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth";

const router = Router();
router.use(requireAuth);

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
            `SELECT id, calendario_id, cliente_id, dia, tema, formato,
                    status, revisions_count,
                    first_generated_at, approved_at, published_at, last_updated_at, notes
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
            `SELECT id, calendario_id, cliente_id, dia, tema, formato,
                    status, revisions_count,
                    first_generated_at, approved_at, published_at, last_updated_at, notes
             FROM calendar_items WHERE calendario_id=$1 ORDER BY dia ASC`,
            [calendarioId]
        );

        return res.json({ success: true, created, items: items.rows });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
