/**
 * STORY-015 — Instagram Graph API (social_accounts + social_metrics)
 *
 * Cria a infraestrutura para o loop DNA→Geração→Performance:
 *   1. Tabela `social_accounts` — contas sociais conectadas via OAuth, com
 *      tokens de acesso criptografados (AES-256-GCM) e ciclo de vida do
 *      status (active | expired | revoked).
 *   2. Tabela `social_metrics` — métricas por post coletadas da Graph API.
 *      O campo `metadata JSONB` guarda `media_type` (VIDEO | IMAGE |
 *      CAROUSEL_ALBUM) usado pela query de performance hints (AC5).
 *
 * Segurança:
 *   - `access_token_encrypted` / `refresh_token_encrypted` NUNCA armazenam
 *     tokens em plaintext. A criptografia/decriptografia é responsabilidade
 *     do `socialTokenService.ts` (AES-256-GCM com IV único por operação).
 *
 * LGPD:
 *   - `social_metrics` referencia `social_accounts` com ON DELETE CASCADE,
 *     mas o disconnect (AC6) faz hard DELETE explícito das métricas.
 *
 * Idempotente — usa IF NOT EXISTS em tabelas e índices.
 * Transacional — BEGIN/COMMIT com ROLLBACK em falha.
 *
 * Requer `pgcrypto` (gen_random_uuid) — habilitado em STORY-013.
 */
import db from "../src/config/database";
import logger from "../src/utils/logger";

const migrateSocialAccountsMetrics = async () => {
    const client = await db.connect();

    try {
        console.log("STORY-015 -> migrando: social_accounts + social_metrics...");
        logger.info(
            { event: "migration_started", migration: "social_accounts_metrics" },
            "Iniciando migracao social (Instagram Graph API)"
        );

        await client.query("BEGIN");

        // Garante gen_random_uuid() disponivel (no-op se ja habilitada em STORY-013).
        await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

        // ──────────────────────────────────────────────────────────────────
        // 1. Contas sociais conectadas (uma linha por conta IG por cliente)
        // ──────────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS social_accounts (
                id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                cliente_id              UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                platform                TEXT NOT NULL DEFAULT 'instagram',
                platform_account_id     TEXT NOT NULL,
                platform_account_name   TEXT,
                access_token_encrypted  TEXT NOT NULL,
                refresh_token_encrypted TEXT,
                expires_at              TIMESTAMPTZ,
                scopes                  TEXT[] DEFAULT '{}',
                status                  TEXT NOT NULL DEFAULT 'active'
                                        CHECK (status IN ('active', 'expired', 'revoked')),
                last_sync_at            TIMESTAMPTZ,
                metadata                JSONB DEFAULT '{}',
                created_at              TIMESTAMPTZ DEFAULT NOW(),
                updated_at              TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (cliente_id, platform, platform_account_id)
            );
        `);
        console.log("  OK Tabela social_accounts criada (ou ja existia).");

        // Indice para o worker buscar rapidamente contas ativas por plataforma.
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_social_accounts_platform_status
                ON social_accounts (platform, status);
        `);
        // Indice para refresh de tokens (AC4): contas proximas de expirar.
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_social_accounts_expires_at
                ON social_accounts (expires_at)
                WHERE status = 'active';
        `);
        console.log("  OK Indices de social_accounts criados.");

        // ──────────────────────────────────────────────────────────────────
        // 2. Metricas por post (UPSERT diario pelo instagramInsightsWorker)
        // ──────────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS social_metrics (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
                platform_post_id  TEXT NOT NULL,
                calendar_item_id  UUID REFERENCES calendar_items(id) ON DELETE SET NULL,
                metric_date       DATE NOT NULL,
                reach             INT DEFAULT 0,
                impressions       INT DEFAULT 0,
                likes             INT DEFAULT 0,
                comments          INT DEFAULT 0,
                saves             INT DEFAULT 0,
                shares            INT DEFAULT 0,
                engagement_rate   NUMERIC(5,4) DEFAULT 0,
                metadata          JSONB NOT NULL DEFAULT '{}',
                collected_at      TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (social_account_id, platform_post_id)
            );
        `);
        console.log("  OK Tabela social_metrics criada (ou ja existia).");

        // Indice para a query de performance hints (AC5) — por conta + data.
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_social_metrics_account_date
                ON social_metrics (social_account_id, metric_date DESC);
        `);
        console.log("  OK Indices de social_metrics criados.");

        await client.query("COMMIT");
        console.log("STORY-015 migration concluida com sucesso!");
        logger.info(
            { event: "migration_completed", migration: "social_accounts_metrics" },
            "Migracao social concluida"
        );
    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("STORY-015 migration falhou:", error);
        logger.error(
            { event: "migration_failed", migration: "social_accounts_metrics", err: error?.message },
            "Falha na migracao social"
        );
        process.exitCode = 1;
    } finally {
        client.release();
        await db.end();
    }
};

migrateSocialAccountsMetrics();
