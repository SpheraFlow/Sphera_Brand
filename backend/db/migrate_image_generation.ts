/**
 * STORY-008 — Geração de Imagem AI Inline no Calendário
 *
 * Cria a tabela `image_generation_jobs` (barramento de estado do worker de imagem):
 *   - id (UUID PK)
 *   - calendar_item_id (UUID FK -> calendar_items.id ON DELETE CASCADE)
 *   - cliente_id (UUID NOT NULL)
 *   - status (pending | processing | completed | failed)
 *   - prompt_used, image_url, image_path
 *   - provider (default 'vertex-imagen')
 *   - cost_cents (INT) — custo fixo por imagem Imagen 3
 *   - attempt_count, last_error, last_error_at (STORY-012 retry tracking)
 *   - aspect_ratio — formato solicitado (1:1 | 9:16 | 4:5)
 *   - created_at, started_at, finished_at
 *
 * Adiciona à tabela `calendar_items`:
 *   - image_url (TEXT)
 *   - image_status (TEXT DEFAULT 'none') — none | pending | generated | failed
 *
 * Idempotente — usa IF NOT EXISTS em todos os ALTERs/CREATEs.
 */
import db from "../src/config/database";

const migrateImageGeneration = async () => {
    const client = await db.connect();

    try {
        console.log("🔄 STORY-008 → migrando: image_generation_jobs + calendar_items.image_*...");
        await client.query("BEGIN");

        // 1. Tabela image_generation_jobs
        await client.query(`
            CREATE TABLE IF NOT EXISTS image_generation_jobs (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                calendar_item_id UUID NOT NULL REFERENCES calendar_items(id) ON DELETE CASCADE,
                cliente_id       UUID NOT NULL,
                status           TEXT NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','processing','completed','failed')),
                aspect_ratio     TEXT NOT NULL DEFAULT '1:1',
                prompt_used      TEXT,
                image_url        TEXT,
                image_path       TEXT,
                provider         TEXT DEFAULT 'vertex-imagen',
                cost_cents       INTEGER NOT NULL DEFAULT 0,
                attempt_count    INTEGER NOT NULL DEFAULT 0,
                last_error       TEXT,
                last_error_at    TIMESTAMPTZ,
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                started_at       TIMESTAMPTZ,
                finished_at      TIMESTAMPTZ
            );
        `);
        console.log("  ✅ Tabela image_generation_jobs criada (ou já existia).");

        // 2. Índices — lookup por item e claim eficiente de jobs pendentes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_calendar_item
                ON image_generation_jobs (calendar_item_id);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_status
                ON image_generation_jobs (status) WHERE status = 'pending';
        `);
        console.log("  ✅ Índices criados.");

        // 3. Colunas em calendar_items
        await client.query(`
            ALTER TABLE calendar_items
                ADD COLUMN IF NOT EXISTS image_url    TEXT,
                ADD COLUMN IF NOT EXISTS image_status TEXT NOT NULL DEFAULT 'none';
        `);
        console.log("  ✅ Colunas image_url / image_status adicionadas a calendar_items.");

        // 4. CHECK constraint para image_status (drop + recreate para idempotência)
        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'calendar_items_image_status_check'
                ) THEN
                    ALTER TABLE calendar_items
                        DROP CONSTRAINT calendar_items_image_status_check;
                END IF;
                ALTER TABLE calendar_items
                    ADD CONSTRAINT calendar_items_image_status_check
                    CHECK (image_status IN ('none','pending','generated','failed'));
            END $$;
        `);
        console.log("  ✅ CHECK constraint image_status criada.");

        await client.query("COMMIT");
        console.log("✅ STORY-008 migration concluída.");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ STORY-008 migration falhou:", error);
        process.exitCode = 1;
    } finally {
        client.release();
        await db.end();
    }
};

migrateImageGeneration();
