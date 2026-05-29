/**
 * STORY-013 — Embedding Worker (fila assincrona de ingestao RAG)
 *
 * Replica o padrao de `calendarGenerationWorker.ts`:
 *   - Polling a cada POLLING_INTERVAL_MS.
 *   - Claim transacional com FOR UPDATE SKIP LOCKED (processa ate
 *     MAX_CONCURRENT_JOBS em paralelo).
 *   - Ciclo de status: pending -> processing -> completed | failed.
 *   - Retry com backoff via errorClassifier (transientes), persistindo
 *     attempt_count + last_error.
 *   - Cleanup de jobs orfaos ('processing' parados) no boot.
 *
 * Para cada job, resolve o texto-fonte com base em `source_type`:
 *   - 'past_post_approved' -> calendar_items (tema + copy via calendario_json)
 *   - 'brand_doc'          -> brand_docs.conteudo_texto
 *   - 'brand_rule'         -> brand_rules ativas do cliente
 *   - 'manual' / outros    -> knowledge_chunks.content (re-embedding)
 * e chama ragService.ingest(clienteId, sourceType, sourceId, [texto]).
 */
import db from "../config/database";
import logger from "../utils/logger";
import { isTransientError, getBackoffMs, MAX_JOB_ATTEMPTS, sleep } from "../utils/errorClassifier";
import { ragService } from "../services/ragService";
import type { KnowledgeSourceType } from "../types/rag";

const workerLog = logger.child({ component: "embeddingWorker" });

/** Intervalo de polling da fila de embedding_jobs (10s). */
const POLLING_INTERVAL_MS = 10000;
/** Maximo de jobs reivindicados por ciclo (processados em paralelo). */
const MAX_CONCURRENT_JOBS = 3;

export const startEmbeddingWorker = (): void => {
    workerLog.info({ event: "worker_starting" }, "Iniciando Embedding Worker");

    const loop = async () => {
        try {
            await processBatch();
        } catch (e: any) {
            workerLog.error(
                { event: "worker_loop_error", error_message: e?.message, error_code: e?.code },
                "Erro no loop de processamento de embeddings"
            );
        } finally {
            setTimeout(loop, POLLING_INTERVAL_MS);
        }
    };

    // Cleanup de jobs orfaos: se o servidor reiniciou no meio de um job 'processing',
    // ele nunca voltaria a 'pending'. Reagendamos como 'pending' para reprocessar.
    const cleanupOrphanJobs = async () => {
        try {
            const result = await db.query(`
                UPDATE embedding_jobs
                SET status = 'pending',
                    started_at = NULL
                WHERE status = 'processing'
                  AND started_at < NOW() - INTERVAL '30 minutes'
            `);
            const count = result.rowCount ?? 0;
            if (count > 0) {
                workerLog.warn({ event: "orphan_jobs_reset", count }, "Jobs de embedding orfaos reagendados");
            }
        } catch (err: any) {
            workerLog.error(
                { event: "orphan_cleanup_error", error_message: err?.message },
                "Erro ao limpar jobs de embedding orfaos"
            );
        }
    };

    cleanupOrphanJobs().then(() => loop());
};

interface ClaimedJob {
    id: string;
    cliente_id: string;
    source_type: string;
    source_id: string | null;
    attempt_count: number;
}

/**
 * Reivindica ate MAX_CONCURRENT_JOBS jobs pendentes numa unica transacao com
 * FOR UPDATE SKIP LOCKED, marcando-os como 'processing'. Processa-os em paralelo.
 */
const processBatch = async () => {
    const client = await db.connect();
    let claimed: ClaimedJob[] = [];

    try {
        await client.query("BEGIN");

        const claimResult = await client.query<ClaimedJob>(`
            SELECT id, cliente_id, source_type, source_id, COALESCE(attempt_count, 0) AS attempt_count
            FROM embedding_jobs
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT ${MAX_CONCURRENT_JOBS}
            FOR UPDATE SKIP LOCKED
        `);

        claimed = claimResult.rows;

        if (claimed.length === 0) {
            await client.query("COMMIT");
            return;
        }

        const ids = claimed.map((j) => j.id);
        await client.query(
            `UPDATE embedding_jobs
             SET status = 'processing', started_at = NOW()
             WHERE id = ANY($1::uuid[])`,
            [ids]
        );

        await client.query("COMMIT");
    } catch (err: any) {
        await client.query("ROLLBACK").catch(() => undefined);
        workerLog.error(
            { event: "claim_batch_error", error_message: err?.message, error_code: err?.code },
            "Erro na transacao de claim dos jobs de embedding"
        );
        throw err;
    } finally {
        client.release();
    }

    // Processa cada job reivindicado de forma isolada (uma falha nao derruba as outras).
    await Promise.allSettled(claimed.map((job) => processJob(job)));
};

const processJob = async (job: ClaimedJob) => {
    const currentAttempt = (Number(job.attempt_count) || 0) + 1;
    const jobLog = workerLog.child({
        job_id: job.id,
        source_type: job.source_type,
        client_id: job.cliente_id,
        attempt: currentAttempt,
    });
    const startedAt = Date.now();
    jobLog.info({ event: "job_started" }, "Processando job de embedding");

    try {
        const texts = await resolveSourceTexts(job);

        if (texts.length === 0) {
            // Nada a ingerir (fonte vazia ou removida): conclui sem erro para nao retentar em loop.
            await db.query(
                `UPDATE embedding_jobs
                 SET status = 'completed', finished_at = NOW(), attempt_count = $2
                 WHERE id = $1`,
                [job.id, currentAttempt]
            );
            jobLog.warn(
                { event: "job_completed", duration_ms: Date.now() - startedAt, reason: "no_source_content" },
                "Job concluido sem conteudo de origem"
            );
            return;
        }

        const result = await ragService.ingest(
            job.cliente_id,
            job.source_type as KnowledgeSourceType,
            job.source_id,
            texts
        );

        await db.query(
            `UPDATE embedding_jobs
             SET status = 'completed', finished_at = NOW(), attempt_count = $2
             WHERE id = $1`,
            [job.id, currentAttempt]
        );

        jobLog.info(
            {
                event: "job_completed",
                duration_ms: Date.now() - startedAt,
                inserted: result.inserted,
                skipped: result.skipped,
            },
            "Job de embedding concluido com sucesso"
        );
    } catch (jobError: any) {
        const errorMessage = String(jobError?.message || "Unknown error");
        const errorCode = jobError?.code || jobError?.status || jobError?.response?.status || null;
        const transient = isTransientError(jobError);
        const canRetry = transient && currentAttempt < MAX_JOB_ATTEMPTS;

        jobLog.error(
            {
                event: "job_failed",
                error_message: errorMessage,
                error_code: errorCode,
                transient,
                will_retry: canRetry,
            },
            "Falha no job de embedding"
        );

        // Persiste tentativa + ultimo erro independente da decisao de retry.
        await db.query(
            `UPDATE embedding_jobs
             SET attempt_count = $2, last_error = $3
             WHERE id = $1`,
            [job.id, currentAttempt, errorMessage]
        );

        if (canRetry) {
            const backoffMs = getBackoffMs(currentAttempt);
            jobLog.info(
                { event: "job_retry_scheduled", attempt: currentAttempt, backoff_ms: backoffMs },
                "Reagendando job de embedding apos erro transitorio"
            );
            await sleep(backoffMs);
            // Reenfileira como 'pending' para o proximo ciclo do worker.
            await db.query(
                `UPDATE embedding_jobs
                 SET status = 'pending', started_at = NULL
                 WHERE id = $1`,
                [job.id]
            );
            return;
        }

        await db.query(
            `UPDATE embedding_jobs
             SET status = 'failed', finished_at = NOW()
             WHERE id = $1`,
            [job.id]
        );
    }
};

/**
 * Resolve o(s) texto(s) de origem de um job conforme `source_type`.
 * Retorna array vazio quando a fonte nao existe ou esta vazia.
 */
const resolveSourceTexts = async (job: ClaimedJob): Promise<string[]> => {
    const { cliente_id: clienteId, source_type: sourceType, source_id: sourceId } = job;

    switch (sourceType) {
        case "past_post_approved": {
            if (!sourceId) return [];
            const result = await db.query(
                `SELECT ci.dia, ci.tema, ci.formato, c.calendario_json
                   FROM calendar_items ci
                   LEFT JOIN calendarios c ON c.id = ci.calendario_id
                  WHERE ci.id = $1 AND ci.cliente_id = $2`,
                [sourceId, clienteId]
            );
            if (result.rows.length === 0) return [];
            const text = buildApprovedPostText(result.rows[0]);
            return text ? [text] : [];
        }

        case "brand_doc": {
            if (!sourceId) {
                // Sem source_id: ingere todos os docs do cliente.
                const allDocs = await db.query(
                    `SELECT conteudo_texto FROM brand_docs
                      WHERE cliente_id = $1 AND conteudo_texto IS NOT NULL AND length(conteudo_texto) > 0`,
                    [clienteId]
                );
                return allDocs.rows.map((r: any) => String(r.conteudo_texto || "").trim()).filter(Boolean);
            }
            const result = await db.query(
                `SELECT conteudo_texto FROM brand_docs WHERE id = $1 AND cliente_id = $2`,
                [sourceId, clienteId]
            );
            const content = String(result.rows[0]?.conteudo_texto || "").trim();
            return content ? [content] : [];
        }

        case "brand_rule": {
            if (sourceId) {
                const result = await db.query(
                    `SELECT regra FROM brand_rules WHERE id = $1 AND cliente_id = $2 AND ativa = true`,
                    [sourceId, clienteId]
                );
                const content = String(result.rows[0]?.regra || "").trim();
                return content ? [content] : [];
            }
            // Sem source_id: ingere todas as regras ativas do cliente.
            const allRules = await db.query(
                `SELECT regra FROM brand_rules
                  WHERE cliente_id = $1 AND ativa = true AND regra IS NOT NULL AND length(regra) > 0`,
                [clienteId]
            );
            return allRules.rows.map((r: any) => String(r.regra || "").trim()).filter(Boolean);
        }

        case "manual":
        default: {
            // Re-embedding de um chunk existente: source_id aponta para knowledge_chunks.id.
            if (!sourceId) return [];
            const result = await db.query(
                `SELECT content FROM knowledge_chunks WHERE id = $1 AND cliente_id = $2`,
                [sourceId, clienteId]
            );
            const content = String(result.rows[0]?.content || "").trim();
            return content ? [content] : [];
        }
    }
};

/**
 * Monta o texto canonico de um post aprovado: tema + copy_inicial (+ legenda)
 * casando o calendar_item com a entrada correspondente no calendario_json.
 */
const buildApprovedPostText = (row: any): string => {
    const tema = String(row?.tema || "").trim();
    const formato = String(row?.formato || "").trim();
    const dia = row?.dia;
    const calendarioJson = row?.calendario_json;

    const posts: any[] = Array.isArray(calendarioJson)
        ? calendarioJson
        : typeof calendarioJson === "string"
            ? safeJsonArray(calendarioJson)
            : [];

    const match = posts.find((p) => {
        if (!p || typeof p !== "object") return false;
        const pDia = typeof p.dia === "number" ? p.dia : parseInt(String(p.dia || ""), 10);
        return (
            pDia === Number(dia) &&
            String(p.tema || "").trim() === tema &&
            String(p.formato || "").trim() === formato
        );
    });

    const copy = match ? String(match.copy_inicial || "").trim() : "";
    const legenda = match ? String(match.legenda || "").trim() : "";

    const parts = [
        tema ? `Tema: ${tema}` : "",
        formato ? `Formato: ${formato}` : "",
        copy ? `Copy: ${copy}` : "",
        legenda ? `Legenda: ${legenda}` : "",
    ].filter(Boolean);

    return parts.join("\n");
};

const safeJsonArray = (raw: string): any[] => {
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};
