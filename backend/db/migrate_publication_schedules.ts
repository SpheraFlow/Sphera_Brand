/**
 * STORY-016 — Publicacao Direta IG + Facebook (Scheduling com Aprovacao Humana)
 *
 * Cria a infraestrutura de agendamento e auditoria de publicacoes diretas:
 *   1. Tabela `publication_schedules` — uma linha por post agendado para uma
 *      conta social. Ciclo de vida do status:
 *        pending_approval -> approved -> queued -> publishing -> published
 *                                                            \-> failed
 *        (qualquer estado nao-terminal) -> canceled
 *   2. Tabela `publication_logs` — audit log APPEND-ONLY. Cada evento do ciclo
 *      de vida (scheduled, approved, published, publish_failed_attempt,
 *      publish_failed_final, canceled, canceled_account_disconnected) gera uma
 *      linha. NUNCA sofre UPDATE ou DELETE.
 *
 * Unicidade ativa:
 *   - Um mesmo (calendar_item_id, platform) nao pode ter dois agendamentos
 *     ativos simultaneos. Implementado preferencialmente com EXCLUDE USING gist
 *     (requer extensao btree_gist); se indisponivel, cai para um UNIQUE INDEX
 *     parcial equivalente. Em ambos os casos, status terminais
 *     ('failed','canceled') sao ignorados, permitindo reagendar apos falha.
 *
 * Idempotente — usa IF NOT EXISTS em tabelas/indices e checa existencia de
 *   constraints/indices antes de cria-los.
 * Transacional — BEGIN/COMMIT com ROLLBACK em falha.
 *
 * Requer `pgcrypto` (gen_random_uuid) — habilitado em STORY-013.
 */
import db from "../src/config/database";
import logger from "../src/utils/logger";

const migratePublicationSchedules = async () => {
    const client = await db.connect();

    try {
        console.log("STORY-016 -> migrando: publication_schedules + publication_logs...");
        logger.info(
            { event: "migration_started", migration: "publication_schedules" },
            "Iniciando migracao de publicacao direta (Instagram Graph API)"
        );

        await client.query("BEGIN");

        // Garante gen_random_uuid() disponivel (no-op se ja habilitada em STORY-013).
        await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

        // btree_gist habilita EXCLUDE USING gist com operador de igualdade em
        // colunas escalares (UUID/TEXT). Pode falhar em ambientes sem permissao
        // de superusuario; tratamos esse caso com fallback abaixo.
        let btreeGistAvailable = false;
        try {
            await client.query(`CREATE EXTENSION IF NOT EXISTS btree_gist;`);
            btreeGistAvailable = true;
            console.log("  OK Extensao btree_gist disponivel.");
        } catch (extErr: any) {
            console.log(
                `  AVISO btree_gist indisponivel (${extErr?.message}); usando UNIQUE parcial como fallback.`
            );
            logger.warn(
                { event: "btree_gist_unavailable", err: extErr?.message },
                "btree_gist indisponivel — usando UNIQUE index parcial"
            );
        }

        // ──────────────────────────────────────────────────────────────────
        // 1. Agendamentos de publicacao
        // ──────────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS publication_schedules (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                calendar_item_id    UUID NOT NULL REFERENCES calendar_items(id) ON DELETE RESTRICT,
                social_account_id   UUID NOT NULL REFERENCES social_accounts(id) ON DELETE RESTRICT,
                platform            TEXT NOT NULL DEFAULT 'instagram',
                scheduled_at        TIMESTAMPTZ NOT NULL,
                status              TEXT NOT NULL DEFAULT 'pending_approval' CHECK (
                    status IN ('pending_approval','approved','queued','publishing','published','failed','canceled')
                ),
                platform_post_id    TEXT,
                payload             JSONB NOT NULL DEFAULT '{}',
                attempts            INT NOT NULL DEFAULT 0,
                last_error          TEXT,
                approved_by_user_id UUID,
                approved_at         TIMESTAMPTZ,
                created_at          TIMESTAMPTZ DEFAULT NOW(),
                updated_at          TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log("  OK Tabela publication_schedules criada (ou ja existia).");

        // Unicidade do agendamento ativo por (calendar_item_id, platform).
        if (btreeGistAvailable) {
            // EXCLUDE USING gist — so adiciona se ainda nao existir (idempotente).
            await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'uq_calendar_platform_active'
                    ) THEN
                        ALTER TABLE publication_schedules
                            ADD CONSTRAINT uq_calendar_platform_active
                            EXCLUDE USING gist (calendar_item_id WITH =, platform WITH =)
                            WHERE (status NOT IN ('failed', 'canceled'));
                    END IF;
                END
                $$;
            `);
            console.log("  OK Constraint EXCLUDE uq_calendar_platform_active criada (btree_gist).");
        } else {
            // Fallback equivalente: UNIQUE INDEX parcial.
            await client.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_platform_active
                    ON publication_schedules (calendar_item_id, platform)
                    WHERE status NOT IN ('failed', 'canceled');
            `);
            console.log("  OK UNIQUE index parcial uq_calendar_platform_active criado (fallback).");
        }

        // Indice usado pelo publishingWorker para varrer registros prontos.
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_pub_schedules_status_scheduled
                ON publication_schedules (status, scheduled_at ASC)
                WHERE status IN ('approved', 'queued');
        `);
        // Indice para cancelamento em cascata por conta (disconnect AC5).
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_pub_schedules_account_status
                ON publication_schedules (social_account_id, status);
        `);
        console.log("  OK Indices de publication_schedules criados.");

        // ──────────────────────────────────────────────────────────────────
        // 2. Audit log — APPEND-ONLY (apenas INSERT; nunca UPDATE/DELETE)
        // ──────────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS publication_logs (
                id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                publication_schedule_id UUID NOT NULL REFERENCES publication_schedules(id),
                event                   TEXT NOT NULL,
                payload                 JSONB DEFAULT '{}',
                created_at              TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log("  OK Tabela publication_logs criada (ou ja existia).");

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_pub_logs_schedule
                ON publication_logs (publication_schedule_id, created_at DESC);
        `);
        console.log("  OK Indices de publication_logs criados.");

        await client.query("COMMIT");
        console.log("STORY-016 migration concluida com sucesso!");
        logger.info(
            { event: "migration_completed", migration: "publication_schedules" },
            "Migracao de publicacao direta concluida"
        );
    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("STORY-016 migration falhou:", error);
        logger.error(
            { event: "migration_failed", migration: "publication_schedules", err: error?.message },
            "Falha na migracao de publicacao direta"
        );
        process.exitCode = 1;
    } finally {
        client.release();
        await db.end();
    }
};

migratePublicationSchedules();
