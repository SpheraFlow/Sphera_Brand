import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const db = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function migrate() {
    console.log("🚀 Adicionando constraint UNIQUE em datas_comemorativas (data, titulo)...");

    try {
        await db.query(`
      ALTER TABLE datas_comemorativas 
      ADD CONSTRAINT uq_data_titulo UNIQUE (data, titulo);
    `);
        console.log("  ✅ Constraint uq_data_titulo adicionada com sucesso!");
    } catch (error: any) {
        if (error.code === '42710') {
            console.log("  ℹ️ Constraint uq_data_titulo já existe.");
        } else {
            console.error("❌ ERRO AO ADICIONAR CONSTRAINT:", error);
            throw error;
        }
    } finally {
        await db.end();
    }
}

migrate();
