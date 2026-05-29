/**
 * STORY-015 — Token Refresh Worker (AC4).
 *
 * Cron diario: encontra `social_accounts` ativas cujo token expira em menos de
 * 7 dias e renova o token de longa duracao via Graph API
 * (`grant_type=ig_exchange_token`). O novo token e criptografado e salvo junto
 * do novo `expires_at`.
 *
 * Resiliencia:
 *   - Cada conta e processada isoladamente (Promise.allSettled).
 *   - Se o refresh falhar (token definitivamente expirado/revogado), a conta e
 *     marcada como status='expired' e um aviso e emitido — sem derrubar o cron.
 *
 * Agendamento: setTimeout ate a proxima 05:00 + setInterval de 24h (roda antes
 * do insights worker das 06:00, garantindo tokens validos na coleta).
 *
 * Seguranca: tokens (atual ou renovado) nunca sao logados.
 */
import db from "../config/database";
import axios from "axios";
import logger from "../utils/logger";
import { encrypt, decrypt } from "../services/socialTokenService";

const workerLog = logger.child({ component: "tokenRefreshWorker" });

const META_GRAPH_VERSION = "v19.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
/** Roda as 05:00, antes do insights worker (06:00). */
const RUN_HOUR = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const LONG_LIVED_TTL_MS = 60 * ONE_DAY_MS;

interface ExpiringAccount {
    id: string;
    cliente_id: string;
    access_token_encrypted: string;
}

/** Milissegundos ate a proxima ocorrencia de `hour` (hoje ou amanha). */
function msUntilHour(hour: number): number {
    const now = new Date();
    const target = new Date(now);
    target.setHours(hour, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target.getTime() - now.getTime();
}

export const startTokenRefreshWorker = (): void => {
    workerLog.info({ event: "worker_starting" }, "Iniciando Token Refresh Worker (cron 05:00)");

    const run = async () => {
        try {
            await refreshExpiringTokens();
        } catch (e: any) {
            workerLog.error(
                { event: "worker_run_error", error_message: e?.message },
                "Erro no ciclo de refresh de tokens"
            );
        }
    };

    const delay = msUntilHour(RUN_HOUR);
    workerLog.info(
        { event: "worker_scheduled", next_run_in_ms: delay },
        "Proximo refresh de tokens agendado"
    );
    setTimeout(() => {
        run();
        setInterval(run, ONE_DAY_MS);
    }, delay);
};

const refreshExpiringTokens = async () => {
    const startedAt = Date.now();
    const result = await db.query<ExpiringAccount>(
        `SELECT id, cliente_id, access_token_encrypted
           FROM social_accounts
          WHERE platform = 'instagram'
            AND status = 'active'
            AND expires_at IS NOT NULL
            AND expires_at < NOW() + INTERVAL '7 days'`
    );
    const accounts = result.rows;

    workerLog.info(
        { event: "refresh_started", accounts_count: accounts.length },
        "Iniciando refresh de tokens proximos da expiracao"
    );

    await Promise.allSettled(accounts.map((acc) => refreshAccount(acc)));

    workerLog.info(
        { event: "refresh_completed", accounts_count: accounts.length, duration_ms: Date.now() - startedAt },
        "Refresh de tokens concluido"
    );
};

const refreshAccount = async (account: ExpiringAccount) => {
    const accLog = workerLog.child({ account_id: account.id, cliente_id: account.cliente_id });

    let currentToken: string;
    try {
        currentToken = decrypt(account.access_token_encrypted);
    } catch (decErr: any) {
        accLog.warn(
            { event: "token_decrypt_failed", err: decErr?.message },
            "Falha ao decriptar token — marcando conta como expired"
        );
        await markExpired(account.id);
        return;
    }

    try {
        const refreshRes = await axios.get(`${META_GRAPH_BASE}/oauth/access_token`, {
            params: {
                grant_type: "ig_exchange_token",
                access_token: currentToken,
            },
        });

        const newToken: string = refreshRes.data?.access_token;
        if (!newToken) throw new Error("Token renovado nao retornado pela Meta.");

        const expiresInSec: number = Number(refreshRes.data?.expires_in) || 0;
        const expiresAt = new Date(
            Date.now() + (expiresInSec > 0 ? expiresInSec * 1000 : LONG_LIVED_TTL_MS)
        );

        await db.query(
            `UPDATE social_accounts
                SET access_token_encrypted = $2, expires_at = $3, updated_at = NOW()
              WHERE id = $1`,
            [account.id, encrypt(newToken), expiresAt.toISOString()]
        );

        accLog.info(
            { event: "token_refreshed", expires_at: expiresAt.toISOString() },
            "Token de longa duracao renovado"
        );
    } catch (err: any) {
        accLog.warn(
            { event: "token_refresh_failed", err: err?.message, http_status: err?.response?.status ?? null },
            "Falha ao renovar token — conta marcada como expired"
        );
        await markExpired(account.id);
    }
};

const markExpired = async (accountId: string) => {
    await db
        .query(`UPDATE social_accounts SET status = 'expired', updated_at = NOW() WHERE id = $1`, [
            accountId,
        ])
        .catch(() => undefined);
};
