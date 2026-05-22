/**
 * STORY-009 — Workflow de Aprovação Kanban de Posts
 *
 * Adiciona à tabela `calendar_items`:
 *   - approval_status (TEXT NOT NULL DEFAULT 'draft')
 *       CHECK in ('draft', 'in_review', 'approved', 'published')
 *   - reviewer_notes (TEXT)
 *
 * Cria a tabela `post_comments`:
 *   - id (UUID PK)
 *   - calendar_item_id (UUID FK -> calendar_items.id ON DELETE CASCADE)
 *   - user_id (UUID FK -> users.id, mantido NOT NULL — vem do JWT)
 *   - content (TEXT NOT NULL)
 *   - created_at (TIMESTAMPTZ DEFAULT NOW())
 *
 * Idempotente — usa IF NOT EXISTS em todos os ALTERs/CREATEs.
 */
import db from "../src/config/database";

const migratePostApproval = async () => {
    const client = await db.connect();

    try {
        console.log("🔄 STORY-009 → migrando: approval_status + post_comments...");
        await client.query("BEGIN");

        // 1. Adicionar colunas em calendar_items
        await client.query(`
            ALTER TABLE calendar_items
                ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'draft',
                ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;
        `);
        console.log("  ✅ Colunas approval_status / reviewer_notes adicionadas.");

        // 2. CHECK constraint para approval_status (nome explícito para idempotência)
        //    Drop + recreate garante consistência se valores forem expandidos no futuro.
        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'calendar_items_approval_status_check'
                ) THEN
                    ALTER TABLE calendar_items
                        DROP CONSTRAINT calendar_items_approval_status_check;
                END IF;
                ALTER TABLE calendar_items
                    ADD CONSTRAINT calendar_items_approval_status_check
                    CHECK (approval_status IN ('draft','in_review','approved','published'));
            END $$;
        `);
        console.log("  ✅ CHECK constraint approval_status criada.");

        // 3. Índice para queries de Kanban (filtrar por cliente + status)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_calendar_items_cliente_approval
                ON calendar_items (cliente_id, approval_status);
        `);

        // 4. Tabela post_comments
        await client.query(`
            CREATE TABLE IF NOT EXISTS post_comments (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                calendar_item_id UUID NOT NULL REFERENCES calendar_items(id) ON DELETE CASCADE,
                user_id          UUID NOT NULL,
                content          TEXT NOT NULL,
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        console.log("  ✅ Tabela post_comments criada (ou já existia).");

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_post_comments_item
                ON post_comments (calendar_item_id, created_at ASC);
        `);

        await client.query("COMMIT");
        console.log("✅ STORY-009 migration concluída.");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ STORY-009 migration falhou:", error);
        process.exitCode = 1;
    } finally {
        client.release();
        await db.end();
    }
};

migratePostApproval();
