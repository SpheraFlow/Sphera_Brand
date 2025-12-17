import { readFileSync } from "fs";
import { join } from "path";
import db from "../src/config/database";

const migrate = async () => {
  try {
    console.log("🔄 Iniciando migração do banco de dados...");

    // Ler o arquivo schema.sql
    const schemaPath = join(__dirname, "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    console.log("📄 Schema lido com sucesso");

    // Executar o schema no banco de dados
    await db.query(schema);

    console.log("✅ Migração concluída com sucesso!");
    console.log("📊 Tabelas criadas:");
    console.log("   - clientes");
    console.log("   - posts");
    console.log("   - posts_processados");

    // Fechar a conexão
    await db.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao executar migração:", error);
    process.exit(1);
  }
};

migrate();

