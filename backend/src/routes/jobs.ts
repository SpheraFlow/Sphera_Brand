import { Router, Request, Response } from "express";
import db from "../config/database";

const router = Router();

// GET /api/jobs/:clientId/:jobId
router.get("/:clientId/:jobId", async (req: Request, res: Response) => {
    try {
        const { clientId, jobId } = req.params;
        const { includePayload } = req.query;

        if (!clientId || !jobId) {
            return res.status(400).json({ success: false, error: "clientId e jobId são obrigatórios" });
        }

        // Query básica
        let selectFields = `
      id, cliente_id, status, progress, current_step, 
      result_calendar_ids, error, created_at, started_at, finished_at, updated_at
    `;

        // Incluir payload se solicitado
        if (includePayload === "true") {
            selectFields += ", payload";
        }

        const result = await db.query(
            `SELECT ${selectFields} FROM calendar_generation_jobs WHERE id = $1 AND cliente_id = $2`,
            [jobId, clientId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Job não encontrado" });
        }

        const job = result.rows[0];
        const serverTime = new Date();
        // Fallback para created_at ou agora se não existir
        const updatedAtDate = job.updated_at || job.created_at || serverTime;
        const updatedAt = new Date(updatedAtDate);
        const ageSeconds = Math.max(0, Math.floor((serverTime.getTime() - updatedAt.getTime()) / 1000));

        // Se estiver "agarrado" há mais de 45s sem mudar updated_at, consideramos stale
        const isStale = ageSeconds > 45 && ['pending', 'running'].includes(job.status);

        // Log de debug apenas se ativado
        if (process.env.DEBUG_JOBS === 'true') {
            const ageStr = isStale ? `${ageSeconds}s (STALE)` : `${ageSeconds}s`;
            console.log(`[DEBUG_JOBS] Poll ${jobId.substring(0, 8)} | Status: ${job.status?.padEnd(10)} | Prog: ${String(job.progress).padStart(3)}% | Step: "${job.current_step}" | Idleness: ${ageStr}`);
        }

        return res.json({
            success: true,
            job,
            server_time: serverTime.toISOString(),
            age_seconds: ageSeconds,
            is_stale: isStale,
            hint: isStale ? `Job sem atualização há ${ageSeconds}s. Worker pode estar travado ou offline.` : undefined
        });
    } catch (error: any) {
        console.error("❌ Erro ao buscar job:", error);
        return res.status(500).json({ success: false, error: "Erro interno ao buscar job" });
    }
});

// POST /api/jobs/:clientId/:jobId/cancel
router.post("/:clientId/:jobId/cancel", async (req: Request, res: Response) => {
    try {
        const { clientId, jobId } = req.params;

        if (!clientId || !jobId) {
            return res.status(400).json({ success: false, error: "clientId e jobId são obrigatórios" });
        }

        // Verifica status atual
        const currentCheck = await db.query(
            "SELECT status FROM calendar_generation_jobs WHERE id = $1 AND cliente_id = $2",
            [jobId, clientId]
        );

        if (currentCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Job não encontrado" });
        }

        const currentStatus = currentCheck.rows[0].status;

        // Idempotência: se o job já está num estado terminal, retornar 200 com o status atual.
        // Isso evita que o front quebre quando o job termina no exato momento do clique de cancelar.
        if (currentStatus === 'succeeded' || currentStatus === 'completed' ||
            currentStatus === 'failed' || currentStatus === 'canceled') {
            return res.json({
                success: true,
                message: `Job já estava em estado terminal: ${currentStatus}`,
                status: currentStatus,
                alreadyTerminal: true
            });
        }

        // Atualiza para canceled
        await db.query(
            "UPDATE calendar_generation_jobs SET status = 'canceled', updated_at = NOW(), error = $2 WHERE id = $1",
            [jobId, JSON.stringify({ message: 'Cancelado pelo usuário' })]
        );

        console.log(`🛑 Job ${jobId} cancelado pelo usuário.`);

        return res.json({ success: true, message: "Solicitação de cancelamento enviada" });
    } catch (error: any) {
        console.error("❌ Erro ao cancelar job:", error);
        return res.status(500).json({ success: false, error: "Erro interno ao cancelar job" });
    }
});

// GET /api/jobs/:clientId
router.get("/:clientId", async (req: Request, res: Response) => {
    try {
        const { clientId } = req.params;

        if (!clientId) {
            return res.status(400).json({ success: false, error: "clientId é obrigatório" });
        }

        const result = await db.query(
            `SELECT 
        id, status, progress, current_step, error, created_at, finished_at 
        FROM calendar_generation_jobs 
        WHERE cliente_id = $1 
        ORDER BY created_at DESC 
        LIMIT 20`,
            [clientId]
        );

        return res.json({ success: true, jobs: result.rows });
    } catch (error: any) {
        console.error("❌ Erro ao listar jobs:", error);
        return res.status(500).json({ success: false, error: "Erro interno ao listar jobs" });
    }
});

export default router;
