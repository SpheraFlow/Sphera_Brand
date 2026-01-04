import { readFileSync } from "fs";
import { join } from "path";
import db from "../src/config/database";

const migrate = async () => {
  try {
    console.log("🔄 Iniciando migração de campos do Branding...");

    // Ler o arquivo sql
    const migrationPath = join(__dirname, "../src/database/migrations/add_brand_dna_fields_to_branding.sql");
    const sql = readFileSync(migrationPath, "utf-8");

    console.log("📄 SQL lido com sucesso");

    // Executar o sql no banco de dados
    await db.query(sql);

    console.log("✅ Migração de campos do Branding concluída com sucesso!");

    // Fechar a conexão
    await db.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao executar migração:", error);
    process.exit(1);
  }
};

migrate();
