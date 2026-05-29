/**
 * STORY-015 — Rotas de integracao social (Instagram Graph API).
 *
 * Fluxo OAuth Meta (AC2):
 *   GET  /api/social/instagram/connect?clienteId=&token=
 *        -> valida o JWT (via query, pois e navegacao direta sem header),
 *           confere acesso ao cliente, assina um `state` curto (10min) e
 *           redireciona para o dialogo OAuth da Meta.
 *   GET  /api/social/instagram/callback?code=&state=
 *        -> troca code por token curto, depois por token de longa duracao,
 *           descobre o instagram_business_account, criptografa o token e
 *           persiste em `social_accounts`. Redireciona ao frontend.
 *
 * Status (frontend):
 *   GET  /api/social/instagram/status?clienteId=   (requireAuth)
 *
 * Desconexao / LGPD (AC6):
 *   DELETE /api/social/instagram/:id/disconnect    (requireAuth)
 *        -> revoga na Meta, marca status='revoked' e faz HARD DELETE das
 *           metricas relacionadas. Retorna { disconnected, metrics_deleted }.
 *
 * Seguranca: tokens NUNCA sao logados (plaintext ou ciphertext). Apenas
 * metadados nao-sensiveis (ids de conta, contagens) entram nos logs.
 */
import { Router, Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import db from "../config/database";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth";
import { verifyToken } from "../utils/jwt";
import { encrypt, decrypt } from "../services/socialTokenService";
import logger from "../utils/logger";

const router = Router();
const socialLog = logger.child({ component: "socialRoute" });

// Mesmo fallback do utils/jwt.ts para que `state` seja assinado/verificado
// com a mesma chave usada para os JWTs de sessao.
const JWT_SECRET = process.env.JWT_SECRET || "sphera_brand_dev_secret_key_123";
const META_GRAPH_VERSION = "v19.0";
const META_DIALOG_BASE = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const META_SCOPES = "instagram_basic,instagram_manage_insights,pages_read_engagement";
/** Token de longa duracao da Meta dura ~60 dias. */
const LONG_LIVED_TTL_MS = 60 * 24 * 60 * 60 * 1000;

const APP_ID = process.env.META_APP_ID || "";
const APP_SECRET = process.env.META_APP_SECRET || "";
const API_PUBLIC_URL = (process.env.API_PUBLIC_URL || "http://localhost:3001/api").replace(/\/$/, "");
const FRONTEND_URL = (
    (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:3006")
        .split(",")[0] ?? "http://localhost:3006"
).trim().replace(/\/$/, "");
const CALLBACK_URL = `${API_PUBLIC_URL}/social/instagram/callback`;

interface OAuthState {
    clienteId: string;
    userId: string;
}

/** Verifica se o usuario autenticado tem acesso ao cliente (mesma regra de rag/calendarItems). */
async function hasClientAccess(
    user: { id?: string; role?: string; permissions?: Record<string, boolean> } | undefined,
    clienteId: string
): Promise<boolean> {
    if (!user) return false;
    if (user.role === "admin" || user.permissions?.clients_manage) return true;
    const r = await db.query(
        "SELECT 1 FROM user_clientes WHERE user_id=$1 AND cliente_id=$2",
        [user.id, clienteId]
    );
    return r.rows.length > 0;
}

/** Redireciona ao frontend sinalizando sucesso/erro da conexao IG. */
function redirectToFrontend(res: Response, params: Record<string, string>): void {
    const qs = new URLSearchParams(params).toString();
    res.redirect(`${FRONTEND_URL}/?${qs}`);
}

// ───────────────────────────────────────────────────────────────────────────
// GET /instagram/connect — inicia o fluxo OAuth (navegacao direta do browser).
// Autentica via `token` na query (sem header em navegacao) e assina `state`.
// ───────────────────────────────────────────────────────────────────────────
router.get("/instagram/connect", async (req: Request, res: Response) => {
    const clienteId = String(req.query.clienteId || "");
    const token = String(req.query.token || "");

    if (!clienteId) {
        return res.status(400).json({ success: false, error: "clienteId obrigatorio." });
    }
    if (!APP_ID) {
        socialLog.error({ event: "oauth_connect_misconfigured" }, "META_APP_ID ausente no ambiente");
        return res.status(500).json({ success: false, error: "Integracao Instagram nao configurada." });
    }

    let user;
    try {
        user = verifyToken(token);
    } catch {
        return res.status(401).json({ success: false, error: "Token invalido ou ausente." });
    }

    try {
        const clientExists = await db.query("SELECT 1 FROM clientes WHERE id = $1", [clienteId]);
        if (clientExists.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Cliente nao encontrado." });
        }
        if (!(await hasClientAccess(user, clienteId))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        // `state` assinado e curto: recupera clienteId/userId no callback sem cookie/sessao
        // e protege contra CSRF (a Meta devolve o mesmo state).
        const state = jwt.sign({ clienteId, userId: user.id } as OAuthState, JWT_SECRET, {
            expiresIn: "10m",
        });

        const dialogUrl =
            `${META_DIALOG_BASE}?client_id=${encodeURIComponent(APP_ID)}` +
            `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}` +
            `&scope=${encodeURIComponent(META_SCOPES)}` +
            `&response_type=code` +
            `&state=${encodeURIComponent(state)}`;

        socialLog.info(
            { event: "oauth_connect_redirect", cliente_id: clienteId, user_id: user.id },
            "Redirecionando para dialogo OAuth da Meta"
        );
        return res.redirect(dialogUrl);
    } catch (error: any) {
        socialLog.error(
            { event: "oauth_connect_failed", cliente_id: clienteId, err: error?.message },
            "Falha ao iniciar OAuth Instagram"
        );
        return res.status(500).json({ success: false, error: "Falha ao iniciar conexao." });
    }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /instagram/callback — troca code por token longo e persiste a conta.
// ───────────────────────────────────────────────────────────────────────────
router.get("/instagram/callback", async (req: Request, res: Response) => {
    const code = String(req.query.code || "");
    const stateRaw = String(req.query.state || "");

    if (!code || !stateRaw) {
        return redirectToFrontend(res, { ig_status: "error", reason: "missing_code" });
    }

    let state: OAuthState;
    try {
        state = jwt.verify(stateRaw, JWT_SECRET) as OAuthState;
    } catch {
        return redirectToFrontend(res, { ig_status: "error", reason: "invalid_state" });
    }

    if (!APP_ID || !APP_SECRET) {
        socialLog.error({ event: "oauth_callback_misconfigured" }, "META_APP_ID/SECRET ausente");
        return redirectToFrontend(res, { ig_status: "error", reason: "not_configured" });
    }

    try {
        // 1. code -> token de curta duracao
        const shortRes = await axios.get(`${META_GRAPH_BASE}/oauth/access_token`, {
            params: {
                client_id: APP_ID,
                client_secret: APP_SECRET,
                redirect_uri: CALLBACK_URL,
                code,
            },
        });
        const shortToken: string = shortRes.data?.access_token;
        if (!shortToken) throw new Error("Token de curta duracao nao retornado pela Meta.");

        // 2. token curto -> token de longa duracao (~60 dias)
        const longRes = await axios.get(`${META_GRAPH_BASE}/oauth/access_token`, {
            params: {
                grant_type: "fb_exchange_token",
                client_id: APP_ID,
                client_secret: APP_SECRET,
                fb_exchange_token: shortToken,
            },
        });
        const longToken: string = longRes.data?.access_token;
        if (!longToken) throw new Error("Token de longa duracao nao retornado pela Meta.");
        const expiresInSec: number = Number(longRes.data?.expires_in) || 0;
        const expiresAt = new Date(
            Date.now() + (expiresInSec > 0 ? expiresInSec * 1000 : LONG_LIVED_TTL_MS)
        );

        // 3. descobre o instagram_business_account vinculado as paginas
        const accountsRes = await axios.get(`${META_GRAPH_BASE}/me/accounts`, {
            params: {
                fields: "instagram_business_account{id,username,name}",
                access_token: longToken,
            },
        });
        const pages: any[] = accountsRes.data?.data || [];
        const igAccount = pages
            .map((p) => p?.instagram_business_account)
            .find((ig) => ig && ig.id);

        if (!igAccount?.id) {
            socialLog.warn(
                { event: "oauth_no_ig_account", cliente_id: state.clienteId },
                "Nenhuma conta Instagram Business vinculada a conta Meta"
            );
            return redirectToFrontend(res, { ig_status: "error", reason: "no_ig_account" });
        }

        const platformAccountId = String(igAccount.id);
        const platformAccountName = String(igAccount.username || igAccount.name || "");
        const accessTokenEncrypted = encrypt(longToken);

        // 4. UPSERT da conta — reconectar atualiza o token e reativa o status.
        await db.query(
            `INSERT INTO social_accounts
                (cliente_id, platform, platform_account_id, platform_account_name,
                 access_token_encrypted, expires_at, scopes, status, updated_at)
             VALUES ($1, 'instagram', $2, $3, $4, $5, $6, 'active', NOW())
             ON CONFLICT (cliente_id, platform, platform_account_id)
             DO UPDATE SET
                platform_account_name = EXCLUDED.platform_account_name,
                access_token_encrypted = EXCLUDED.access_token_encrypted,
                expires_at = EXCLUDED.expires_at,
                scopes = EXCLUDED.scopes,
                status = 'active',
                updated_at = NOW()`,
            [
                state.clienteId,
                platformAccountId,
                platformAccountName,
                accessTokenEncrypted,
                expiresAt.toISOString(),
                META_SCOPES.split(","),
            ]
        );

        socialLog.info(
            {
                event: "oauth_account_connected",
                cliente_id: state.clienteId,
                platform_account_id: platformAccountId,
            },
            "Conta Instagram conectada com sucesso"
        );

        return redirectToFrontend(res, { ig_status: "connected", clienteId: state.clienteId });
    } catch (error: any) {
        // Nao logar resposta crua da Meta (pode conter token). Apenas mensagem + status.
        socialLog.error(
            {
                event: "oauth_callback_failed",
                cliente_id: state.clienteId,
                err: error?.message,
                http_status: error?.response?.status ?? null,
            },
            "Falha no callback OAuth Instagram"
        );
        return redirectToFrontend(res, { ig_status: "error", reason: "exchange_failed" });
    }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /instagram/status — status da conexao + resumo de metricas (frontend).
// ───────────────────────────────────────────────────────────────────────────
router.get("/instagram/status", requireAuth, async (req: AuthRequest, res: Response) => {
    const clienteId = String(req.query.clienteId || "");
    if (!clienteId) {
        return res.status(400).json({ success: false, error: "clienteId obrigatorio." });
    }
    if (!(await hasClientAccess(req.user, clienteId))) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }

    try {
        const acc = await db.query(
            `SELECT id, platform_account_id, platform_account_name, status,
                    expires_at, last_sync_at
               FROM social_accounts
              WHERE cliente_id = $1 AND platform = 'instagram'
              ORDER BY updated_at DESC
              LIMIT 1`,
            [clienteId]
        );

        if (acc.rows.length === 0) {
            return res.json({ success: true, connected: false, account: null, metrics_count: 0 });
        }

        const account = acc.rows[0];
        const metricsCount = await db.query(
            `SELECT COUNT(*)::int AS total FROM social_metrics WHERE social_account_id = $1`,
            [account.id]
        );

        return res.json({
            success: true,
            connected: account.status === "active",
            account: {
                id: account.id,
                username: account.platform_account_name,
                status: account.status,
                expires_at: account.expires_at,
                last_sync_at: account.last_sync_at,
            },
            metrics_count: metricsCount.rows[0]?.total ?? 0,
        });
    } catch (error: any) {
        socialLog.error(
            { event: "ig_status_failed", cliente_id: clienteId, err: error?.message },
            "Falha ao consultar status Instagram"
        );
        return res.status(500).json({ success: false, error: "Falha ao consultar status." });
    }
});

// ───────────────────────────────────────────────────────────────────────────
// DELETE /instagram/:id/disconnect — revoga + hard delete de metricas (LGPD/AC6).
// ───────────────────────────────────────────────────────────────────────────
router.delete("/instagram/:id/disconnect", requireAuth, async (req: AuthRequest, res: Response) => {
    const accountId = String(req.params.id || "");
    if (!accountId) {
        return res.status(400).json({ success: false, error: "id da conta obrigatorio." });
    }

    try {
        const acc = await db.query(
            `SELECT id, cliente_id, platform_account_id, access_token_encrypted, status
               FROM social_accounts
              WHERE id = $1 AND platform = 'instagram'`,
            [accountId]
        );
        if (acc.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Conta nao encontrada." });
        }
        const account = acc.rows[0];

        if (!(await hasClientAccess(req.user, account.cliente_id))) {
            return res.status(403).json({ success: false, error: "Acesso negado." });
        }

        // 1. Tentativa de revogacao na Meta (best-effort; nao bloqueia o delete local).
        try {
            const token = decrypt(account.access_token_encrypted);
            await axios.delete(`${META_GRAPH_BASE}/${account.platform_account_id}/permissions`, {
                params: { access_token: token },
            });
        } catch (revokeErr: any) {
            socialLog.warn(
                {
                    event: "ig_revoke_failed",
                    account_id: accountId,
                    err: revokeErr?.message,
                    http_status: revokeErr?.response?.status ?? null,
                },
                "Revogacao na Meta falhou — prosseguindo com exclusao local (LGPD)"
            );
        }

        // 2-4. Mutacoes locais numa unica transacao (tudo ou nada) — STORY-016 AC5
        // garante que o cancelamento em cascata de publicacoes pendentes seja
        // atomico com o hard delete das metricas e a marcacao da conta.
        const txClient = await db.connect();
        let metricsDeleted = 0;
        let publicationsCanceled = 0;
        try {
            await txClient.query("BEGIN");

            // 2. Hard delete das metricas (LGPD: irreversivel) ANTES de marcar a conta.
            const del = await txClient.query(
                `DELETE FROM social_metrics WHERE social_account_id = $1`,
                [accountId]
            );
            metricsDeleted = del.rowCount ?? 0;

            // 3. STORY-016 AC5 — cancela publicacoes pendentes desta conta em cascata.
            const canceled = await txClient.query(
                `UPDATE publication_schedules
                    SET status = 'canceled', updated_at = NOW()
                  WHERE social_account_id = $1
                    AND status IN ('pending_approval','approved','queued')
                RETURNING id`,
                [accountId]
            );
            publicationsCanceled = canceled.rowCount ?? 0;

            // Audit log append-only para cada cancelamento (mesma transacao).
            for (const row of canceled.rows) {
                await txClient.query(
                    `INSERT INTO publication_logs (publication_schedule_id, event, payload)
                     VALUES ($1, 'canceled_account_disconnected', $2)`,
                    [row.id, JSON.stringify({ social_account_id: accountId })]
                );
            }

            // 4. Marca a conta como revogada (mantem linha para auditoria).
            await txClient.query(
                `UPDATE social_accounts SET status = 'revoked', updated_at = NOW() WHERE id = $1`,
                [accountId]
            );

            await txClient.query("COMMIT");
        } catch (txErr: any) {
            await txClient.query("ROLLBACK").catch(() => undefined);
            throw txErr;
        } finally {
            txClient.release();
        }

        socialLog.info(
            {
                event: "ig_disconnected",
                account_id: accountId,
                cliente_id: account.cliente_id,
                metrics_deleted: metricsDeleted,
                publications_canceled: publicationsCanceled,
            },
            "Conta Instagram desconectada, metricas excluidas (LGPD) e publicacoes pendentes canceladas"
        );

        return res.json({
            disconnected: true,
            metrics_deleted: metricsDeleted,
            publications_canceled: publicationsCanceled,
        });
    } catch (error: any) {
        socialLog.error(
            { event: "ig_disconnect_failed", account_id: accountId, err: error?.message },
            "Falha ao desconectar conta Instagram"
        );
        return res.status(500).json({ success: false, error: "Falha ao desconectar." });
    }
});

export default router;
