/**
 * STORY-015 — Instagram Insights Worker (AC3).
 *
 * Cron diario as 06:00: para cada `social_accounts` com platform='instagram'
 * e status='active', decripta o token e coleta os ultimos 50 posts do feed via
 * Graph API, fazendo UPSERT em `social_metrics` (incluindo `media_type` em
 * `metadata` JSONB, necessario para os performance hints da AC5).
 *
 * Resiliencia:
 *   - Cada conta e processada de forma isolada (Promise.allSettled): a falha de
 *     uma conta nao bloqueia as demais nem derruba o cron.
 *   - Token expirado da Meta (HTTP 190 / OAuthException) marca a conta como
 *     status='expired' e NAO propaga excecao.
 *
 * Agendamento: como `node-cron` nao e dependencia do backend, usamos
 * setTimeout ate a proxima 06:00 + setInterval de 24h.
 *
 * Seguranca: o token decriptado nunca e logado.
 */
import db from "../config/database";
import axios from "axios";
import logger from "../utils/logger";
import { decrypt } from "../services/socialTokenService";

const workerLog = logger.child({ component: "instagramInsightsWorker" });

const META_GRAPH_VERSION = "v19.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
/** Hora local do disparo diario (AC3: 06:00). */
const RUN_HOUR = 6;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MEDIA_LIMIT = 50;

interface ActiveAccount {
    id: string;
    cliente_id: string;
    platform_account_id: string;
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

/** Detecta erro de token expirado/revogado da Meta (OAuthException code 190). */
function isMetaTokenError(err: any): boolean {
    const code = err?.response?.data?.error?.code;
    const httpStatus = err?.response?.status;
    return code === 190 || httpStatus === 401;
}

export const startInstagramInsightsWorker = (): void => {
    workerLog.info({ event: "worker_starting" }, "Iniciando Instagram Insights Worker (cron 06:00)");

    const run = async () => {
        try {
            await collectAllAccounts();
        } catch (e: any) {
            workerLog.error(
                { event: "worker_run_error", error_message: e?.message },
                "Erro no ciclo de coleta de insights do Instagram"
            );
        }
    };

    const delay = msUntilHour(RUN_HOUR);
    workerLog.info(
        { event: "worker_scheduled", next_run_in_ms: delay },
        "Proxima coleta de insights agendada"
    );
    setTimeout(() => {
        run();
        setInterval(run, ONE_DAY_MS);
    }, delay);
};

const collectAllAccounts = async () => {
    const startedAt = Date.now();
    const result = await db.query<ActiveAccount>(
        `SELECT id, cliente_id, platform_account_id, access_token_encrypted
           FROM social_accounts
          WHERE platform = 'instagram' AND status = 'active'`
    );
    const accounts = result.rows;

    workerLog.info(
        { event: "collection_started", accounts_count: accounts.length },
        "Iniciando coleta de insights para contas ativas"
    );

    await Promise.allSettled(accounts.map((acc) => collectAccount(acc)));

    workerLog.info(
        { event: "collection_completed", accounts_count: accounts.length, duration_ms: Date.now() - startedAt },
        "Coleta de insights concluida"
    );
};

const collectAccount = async (account: ActiveAccount) => {
    const accLog = workerLog.child({ account_id: account.id, cliente_id: account.cliente_id });

    let token: string;
    try {
        token = decrypt(account.access_token_encrypted);
    } catch (decErr: any) {
        accLog.error(
            { event: "token_decrypt_failed", err: decErr?.message },
            "Falha ao decriptar token — pulando conta"
        );
        return;
    }

    try {
        const mediaRes = await axios.get(`${META_GRAPH_BASE}/${account.platform_account_id}/media`, {
            params: {
                fields: "id,timestamp,media_type,like_count,comments_count,reach,impressions,saved",
                limit: MEDIA_LIMIT,
                access_token: token,
            },
        });

        const posts: any[] = mediaRes.data?.data || [];
        let upserted = 0;

        for (const post of posts) {
            const reach = Number(post.reach) || 0;
            const likes = Number(post.like_count) || 0;
            const comments = Number(post.comments_count) || 0;
            const saves = Number(post.saved) || 0;
            const impressions = Number(post.impressions) || 0;
            // engagement_rate = (likes + comments + saves) / reach — evita divisao por zero.
            const engagementRate = reach > 0 ? (likes + comments + saves) / reach : 0;
            const metricDate = post.timestamp ? new Date(post.timestamp) : new Date();
            const metadata = JSON.stringify({ media_type: post.media_type ?? null });

            await db.query(
                `INSERT INTO social_metrics
                    (social_account_id, platform_post_id, metric_date, reach, impressions,
                     likes, comments, saves, engagement_rate, metadata, collected_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
                 ON CONFLICT (social_account_id, platform_post_id)
                 DO UPDATE SET
                    metric_date = EXCLUDED.metric_date,
                    reach = EXCLUDED.reach,
                    impressions = EXCLUDED.impressions,
                    likes = EXCLUDED.likes,
                    comments = EXCLUDED.comments,
                    saves = EXCLUDED.saves,
                    engagement_rate = EXCLUDED.engagement_rate,
                    metadata = EXCLUDED.metadata,
                    collected_at = NOW()`,
                [
                    account.id,
                    String(post.id),
                    metricDate.toISOString().slice(0, 10),
                    reach,
                    impressions,
                    likes,
                    comments,
                    saves,
                    Number(engagementRate.toFixed(4)),
                    metadata,
                ]
            );
            upserted++;
        }

        await db.query(`UPDATE social_accounts SET last_sync_at = NOW() WHERE id = $1`, [account.id]);

        accLog.info(
            { event: "account_synced", posts_upserted: upserted },
            "Metricas do Instagram sincronizadas"
        );
    } catch (err: any) {
        if (isMetaTokenError(err)) {
            // Token expirado/revogado: marca a conta e NAO propaga excecao (AC3e).
            await db
                .query(`UPDATE social_accounts SET status = 'expired', updated_at = NOW() WHERE id = $1`, [
                    account.id,
                ])
                .catch(() => undefined);
            accLog.warn(
                { event: "account_token_expired", http_status: err?.response?.status ?? null },
                "Token Instagram expirado (HTTP 190) — conta marcada como expired"
            );
            return;
        }

        // Erro nao relacionado a token: loga e segue (isolado por conta).
        accLog.error(
            { event: "account_sync_failed", err: err?.message, http_status: err?.response?.status ?? null },
            "Falha ao coletar insights da conta — demais contas nao sao afetadas"
        );
    }
};
