/**
 * STORY-016 — Publishing Worker (fila de publicacao direta no Instagram).
 *
 * Espelha o padrao de claim transacional de `embeddingWorker.ts`:
 *   - Polling a cada POLLING_INTERVAL_MS (1 min).
 *   - Claim com FOR UPDATE SKIP LOCKED (ate MAX_CONCURRENT publicacoes/ciclo),
 *     marcando os registros como 'publishing' dentro da MESMA transacao do
 *     claim (evita processamento duplo entre instancias).
 *   - Cada publicacao roda isolada (Promise.allSettled): o polling de Reels de
 *     um registro nunca bloqueia os demais.
 *
 * Fluxo de status por registro (AC2/AC3):
 *   approved (scheduled_at <= NOW) -> publishing -> published
 *                                              \-> approved (retry, backoff)
 *                                              \-> failed (attempts >= 3)
 *
 * Retry (AC3): em qualquer erro da Meta, attempts++ e last_error sao
 *   persistidos. Se attempts < 3, volta para 'approved' com
 *   scheduled_at = NOW() + backoff (1, 4, 16 min — exponencial base 4 sobre
 *   o numero de tentativas ja realizadas). Se attempts >= 3 -> 'failed'.
 *
 * Audit (AC3e): publication_logs e APPEND-ONLY. Eventos: published,
 *   publish_failed_attempt, publish_failed_final. Nenhuma linha e alterada.
 *
 * Seguranca: o token e decriptado em memoria e NUNCA logado.
 */
import db from "../config/database";
import logger from "../utils/logger";
import { decrypt } from "../services/socialTokenService";
import {
    publishImage,
    publishReels,
    appendPublicationLog,
    PublicationPayload,
} from "../services/publicationService";

const workerLog = logger.child({ component: "publishingWorker" });

/** Intervalo de polling da fila (1 min — alinhado a janela de cancelamento). */
const POLLING_INTERVAL_MS = 60 * 1000;
/** Maximo de publicacoes reivindicadas por ciclo (processadas em paralelo). */
const MAX_CONCURRENT = 5;
/** AC3: maximo de tentativas antes de marcar como 'failed'. */
const MAX_PUBLISH_ATTEMPTS = 3;

interface ClaimedSchedule {
    id: string;
    calendar_item_id: string;
    social_account_id: string;
    platform: string;
    attempts: number;
    payload: PublicationPayload;
    access_token_encrypted: string;
    platform_account_id: string;
}

export const startPublishingWorker = (): void => {
    workerLog.info({ event: "worker_starting" }, "Iniciando Publishing Worker (cron 1 min)");

    const loop = async () => {
        try {
            await processBatch();
        } catch (e: any) {
            workerLog.error(
                { event: "worker_loop_error", error_message: e?.message, error_code: e?.code },
                "Erro no loop de publicacao"
            );
        } finally {
            setTimeout(loop, POLLING_INTERVAL_MS);
        }
    };

    // Cleanup de registros orfaos: se o servidor reiniciou no meio de uma
    // publicacao ('publishing' parado), reagenda como 'approved' para reprocessar.
    const cleanupOrphans = async () => {
        try {
            const result = await db.query(`
                UPDATE publication_schedules
                SET status = 'approved', updated_at = NOW()
                WHERE status = 'publishing'
                  AND updated_at < NOW() - INTERVAL '15 minutes'
            `);
            const count = result.rowCount ?? 0;
            if (count > 0) {
                workerLog.warn(
                    { event: "orphan_publications_reset", count },
                    "Publicacoes orfas reagendadas"
                );
            }
        } catch (err: any) {
            workerLog.error(
                { event: "orphan_cleanup_error", error_message: err?.message },
                "Erro ao limpar publicacoes orfas"
            );
        }
    };

    cleanupOrphans().then(() => loop());
};

/**
 * Reivindica ate MAX_CONCURRENT registros prontos para publicar numa unica
 * transacao com FOR UPDATE SKIP LOCKED, marcando-os 'publishing'. Faz o JOIN
 * com social_accounts para trazer o token (decriptado depois) e o ig user id.
 * So reivindica contas com status 'active' (conta revogada/expirada e ignorada).
 */
const processBatch = async () => {
    const client = await db.connect();
    let claimed: ClaimedSchedule[] = [];

    try {
        await client.query("BEGIN");

        const claimResult = await client.query<ClaimedSchedule>(`
            SELECT ps.id,
                   ps.calendar_item_id,
                   ps.social_account_id,
                   ps.platform,
                   ps.attempts,
                   ps.payload,
                   sa.access_token_encrypted,
                   sa.platform_account_id
            FROM publication_schedules ps
            JOIN social_accounts sa ON sa.id = ps.social_account_id
            WHERE ps.status = 'approved'
              AND ps.scheduled_at <= NOW()
              AND sa.status = 'active'
            ORDER BY ps.scheduled_at ASC
            LIMIT ${MAX_CONCURRENT}
            FOR UPDATE OF ps SKIP LOCKED
        `);

        claimed = claimResult.rows;

        if (claimed.length === 0) {
            await client.query("COMMIT");
            return;
        }

        const ids = claimed.map((s) => s.id);
        await client.query(
            `UPDATE publication_schedules
             SET status = 'publishing', updated_at = NOW()
             WHERE id = ANY($1::uuid[])`,
            [ids]
        );

        await client.query("COMMIT");
    } catch (err: any) {
        await client.query("ROLLBACK").catch(() => undefined);
        workerLog.error(
            { event: "claim_batch_error", error_message: err?.message, error_code: err?.code },
            "Erro na transacao de claim de publicacoes"
        );
        throw err;
    } finally {
        client.release();
    }

    await Promise.allSettled(claimed.map((s) => publishOne(s)));
};

const publishOne = async (schedule: ClaimedSchedule) => {
    const scheduleLog = workerLog.child({
        schedule_id: schedule.id,
        calendar_item_id: schedule.calendar_item_id,
        platform: schedule.platform,
    });
    const startedAt = Date.now();

    // Decripta o token em memoria (nunca logado).
    let token: string;
    try {
        token = decrypt(schedule.access_token_encrypted);
    } catch (decErr: any) {
        // Token corrompido/chave invalida: trata como tentativa falha.
        scheduleLog.error(
            { event: "token_decrypt_failed", err: decErr?.message },
            "Falha ao decriptar token de publicacao"
        );
        await handleFailure(schedule, "Falha ao decriptar token da conta social.", scheduleLog);
        return;
    }

    try {
        const payload = normalizePayload(schedule.payload);

        let platformPostId: string;
        if (payload.media_type === "REELS") {
            platformPostId = await publishReels(schedule.platform_account_id, token, payload);
        } else {
            platformPostId = await publishImage(schedule.platform_account_id, token, payload);
        }

        await db.query(
            `UPDATE publication_schedules
             SET status = 'published', platform_post_id = $2, updated_at = NOW()
             WHERE id = $1`,
            [schedule.id, platformPostId]
        );
        await appendPublicationLog(schedule.id, "published", { platform_post_id: platformPostId });

        // AC: ao publicar com sucesso, marca o calendar_item como 'published'
        // (approval_status STORY-009). Best-effort — nao reverte a publicacao.
        try {
            await db.query(
                `UPDATE calendar_items
                 SET approval_status = 'published',
                     published_at = COALESCE(published_at, NOW()),
                     last_updated_at = NOW()
                 WHERE id = $1`,
                [schedule.calendar_item_id]
            );
        } catch (ciErr: any) {
            scheduleLog.warn(
                { event: "calendar_item_publish_flag_failed", err: ciErr?.message },
                "Falha ao marcar calendar_item como published (publicacao ja ocorreu)"
            );
        }

        scheduleLog.info(
            { event: "publication_published", duration_ms: Date.now() - startedAt, platform_post_id: platformPostId },
            "Publicacao concluida com sucesso"
        );
    } catch (error: any) {
        const message = String(error?.message || "Erro desconhecido na publicacao");
        await handleFailure(schedule, message, scheduleLog);
    }
};

/**
 * Trata falha de publicacao (AC3): incrementa attempts, registra
 * publish_failed_attempt, e decide entre retry (backoff) ou failed final.
 */
const handleFailure = async (
    schedule: ClaimedSchedule,
    errorMessage: string,
    scheduleLog: ReturnType<typeof workerLog.child>
) => {
    const newAttempts = Number(schedule.attempts || 0) + 1;

    await appendPublicationLog(schedule.id, "publish_failed_attempt", {
        error: errorMessage,
        attempt: newAttempts,
    });

    if (newAttempts >= MAX_PUBLISH_ATTEMPTS) {
        await db.query(
            `UPDATE publication_schedules
             SET status = 'failed', attempts = $2, last_error = $3, updated_at = NOW()
             WHERE id = $1`,
            [schedule.id, newAttempts, errorMessage]
        );
        await appendPublicationLog(schedule.id, "publish_failed_final", { error: errorMessage });
        scheduleLog.error(
            { event: "publication_failed_final", attempts: newAttempts, error_message: errorMessage },
            "Publicacao falhou definitivamente apos esgotar tentativas"
        );
        return;
    }

    // Backoff exponencial base 4 (em minutos) sobre as tentativas ja realizadas:
    // attempt 1 -> 1 min, attempt 2 -> 4 min, attempt 3 -> 16 min.
    const backoffMinutes = Math.pow(4, newAttempts - 1);
    const nextAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

    await db.query(
        `UPDATE publication_schedules
         SET status = 'approved', attempts = $2, last_error = $3, scheduled_at = $4, updated_at = NOW()
         WHERE id = $1`,
        [schedule.id, newAttempts, errorMessage, nextAt.toISOString()]
    );

    scheduleLog.warn(
        {
            event: "publication_retry_scheduled",
            attempt: newAttempts,
            backoff_minutes: backoffMinutes,
            next_at: nextAt.toISOString(),
            error_message: errorMessage,
        },
        "Publicacao reagendada apos falha (backoff)"
    );
};

/** Garante o shape minimo do payload persistido (defensivo). */
const normalizePayload = (raw: any): PublicationPayload => {
    const payload = (raw && typeof raw === "object" ? raw : {}) as Partial<PublicationPayload>;
    const mediaType = payload.media_type === "REELS" ? "REELS" : "IMAGE";
    const mediaUrl = String(payload.media_url || "").trim();
    if (!mediaUrl) {
        throw new Error("Payload de publicacao sem media_url.");
    }
    return {
        media_type: mediaType,
        media_url: mediaUrl,
        caption: String(payload.caption || ""),
    };
};
