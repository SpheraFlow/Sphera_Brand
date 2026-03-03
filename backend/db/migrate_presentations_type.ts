import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const db = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "spheraflow",
    password: process.env.DB_PASSWORD || "@Trafego123",
    database: process.env.DB_NAME || "app_db",
});

async function migrate() {
    console.log("🚀 Iniciando migração da tabela presentations...\n");

    try {
        console.log("🧩 Adicionando colunas 'tipo' e 'metadata'...");
        await db.query(`
            ALTER TABLE presentations
            ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'laminas',
            ADD COLUMN IF NOT EXISTS metadata JSONB;
        `);
        console.log("  ✅ Colunas adicionadas: tipo, metadata");

        console.log("\n✅ Migração concluída com sucesso!");
    } catch (error) {
        console.error("❌ ERRO NA MIGRAÇÃO:", error);
        process.exit(1);
    } finally {
        await db.end();
    }
}

migrate();
