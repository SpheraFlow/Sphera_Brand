/**
 * STORY-013 — Rotas do Cerebro RAG por Cliente.
 *
 * POST /api/rag/:clienteId/reindex
 *   Reindexa todo o conhecimento do cliente (brand_docs, brand_rules ativas e
 *   posts aprovados): apaga os chunks atuais e re-ingere a partir das fontes
 *   canonicas. Operacao sincrona — adequada ao volume esperado (poucos milhares
 *   de chunks/cliente). Requer JWT e acesso ao cliente.
 */
import { Router, Response } from "express";
import db from "../config/database";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth";
import logger from "../utils/logger";
import { ragService } from "../services/ragService";

const router = Router();
router.use(requireAuth);

const ragLog = logger.child({ component: "ragRoute" });

/** Verifica se o usuario autenticado tem acesso ao cliente (mesma regra de calendarItems). */
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

// POST /api/rag/:clienteId/reindex
router.post("/:clienteId/reindex", async (req: AuthRequest, res: Response) => {
    const { clienteId } = req.params;

    try {
        if (!clienteId) {
            return res.status(400).json({ success: false, error: "clienteId obrigatorio." });
        }

        // Confirma existencia do cliente antes de processar.
        const clientExists = await db.query("SELECT 1 FROM clientes WHERE id = $1", [clienteId]);
        if (clientExists.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Cliente nao encontrado." });
        }

        if (!(await hasClientAccess(req, clienteId))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        const result = await ragService.reindexCliente(clienteId);

        ragLog.info(
            {
                event: "rag_reindex_request_completed",
                cliente_id: clienteId,
                indexed: result.indexed,
                skipped: result.skipped,
                duration_ms: result.durationMs,
                user_id: req.user?.id ?? null,
            },
            "Reindex RAG concluido via endpoint"
        );

        return res.json({
            success: true,
            reindexed: true,
            chunks_created: result.indexed,
            skipped: result.skipped,
            duration_ms: result.durationMs,
            clienteId,
        });
    } catch (error: any) {
        ragLog.error(
            { event: "rag_reindex_request_failed", cliente_id: clienteId, err: error?.message },
            "POST /api/rag/:clienteId/reindex failed"
        );
        return res.status(500).json({ success: false, error: error?.message });
    }
});

export default router;
