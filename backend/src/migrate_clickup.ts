import db from "./config/database";

async function runMigration() {
    console.log("🔄 Iniciando migração: Adicionando clickup_list_id à clientes...");

    try {
        // Adiciona coluna clickup_list_id à clientes
        await db.query(`
      ALTER TABLE clientes
      ADD COLUMN IF NOT EXISTS clickup_list_id TEXT;
    `);

        console.log("📝 Coluna clickup_list_id adicionada com sucesso.");

    } catch (error) {
        console.error("❌ Erro durante migração:", error);
    } finally {
        process.exit(0);
    }
}

runMigration();
