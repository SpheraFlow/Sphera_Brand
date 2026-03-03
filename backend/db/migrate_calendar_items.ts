import db from "../src/config/database";

const migrateCalendarItems = async () => {
    const client = await db.connect();

    try {
        console.log("🔄 Iniciando migração: Calendar Items...");
        await client.query("BEGIN");

        // 1. Tabela principal
        await client.query(`
            CREATE TABLE IF NOT EXISTS calendar_items (
                id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                cliente_id         UUID NOT NULL,
                calendario_id      UUID NOT NULL,
                dia                INTEGER NOT NULL,
                tema               TEXT NOT NULL DEFAULT '',
                formato            TEXT NOT NULL DEFAULT '',
                status             TEXT NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft', 'approved', 'needs_edit', 'redo', 'published')),
                revisions_count    INTEGER NOT NULL DEFAULT 0,
                first_generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                approved_at        TIMESTAMPTZ,
                published_at       TIMESTAMPTZ,
                last_updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_by         UUID,
                notes              TEXT,
                CONSTRAINT fk_ci_cliente    FOREIGN KEY (cliente_id)    REFERENCES clientes(id)    ON DELETE CASCADE,
                CONSTRAINT fk_ci_calendario FOREIGN KEY (calendario_id) REFERENCES calendarios(id) ON DELETE CASCADE
            );
        `);
        console.log("  ✅ Tabela calendar_items criada (ou já existia).");

        // 2. Índices
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_calendar_items_calendario
            ON calendar_items (calendario_id);
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_calendar_items_cliente_status
            ON calendar_items (cliente_id, status);
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_calendar_items_cliente_generated
            ON calendar_items (cliente_id, first_generated_at DESC);
        `);
        console.log("  ✅ Índices criados.");

        await client.query("COMMIT");
        console.log("✅ Migração Calendar Items concluída com sucesso!");

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Erro na migração Calendar Items:", error);
        process.exit(1);
    } finally {
        client.release();
        await db.end();
    }
};

migrateCalendarItems();
