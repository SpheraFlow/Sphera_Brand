import { readFileSync } from "fs";
import { join } from "path";
import db from "../src/config/database";

const migrate = async () => {
    try {
        console.log("🔄 Iniciando migração de usuários (auth)...");
        const sqlPath = join(__dirname, "../src/database/migrations/create_users_table.sql");
        const sql = readFileSync(sqlPath, "utf-8");
        await db.query(sql);
        console.log("✅ Migração de usuários concluída com sucesso!");
        await db.end();
        process.exit(0);
    } catch (error) {
        console.error("❌ Erro ao executar migração:", error);
        process.exit(1);
    }
};

migrate();
