import db from "../config/database";
import fs from "fs";
import path from "path";

async function runTokenMigration() {
  try {
    console.log("🔄 Iniciando migração de token_usage...");

    const migrationPath = path.resolve(__dirname, "./migrations/add_token_usage_to_clients.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");

    await db.query(sql);

    console.log("✅ Migração concluída com sucesso!");
    console.log("📊 Coluna token_usage adicionada à tabela clientes");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao executar migração:", error);
    process.exit(1);
  }
}

runTokenMigration();
