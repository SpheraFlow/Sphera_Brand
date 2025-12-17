import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Fallbacks seguros: alinham com o container informado pelo usuário
const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 5432;
const DEFAULT_USER = "spheraflow";
const DEFAULT_PASSWORD = "@Trafego123";
const DEFAULT_DB = "app_db";

export const db = new Pool({
  host:
    process.env.DB_HOST ||
    process.env.POSTGRES_HOST ||
    DEFAULT_HOST,
  port: Number(
    process.env.DB_PORT ||
    process.env.POSTGRES_PORT ||
    DEFAULT_PORT
  ),
  user:
    process.env.DB_USER ||
    process.env.POSTGRES_USER ||
    DEFAULT_USER,
  password:
    process.env.DB_PASSWORD ||
    process.env.POSTGRES_PASSWORD ||
    DEFAULT_PASSWORD,
  database:
    process.env.DB_NAME ||
    process.env.POSTGRES_DB ||
    DEFAULT_DB,
});

// Teste de conexão
db.on("connect", () => {
  console.log("✅ Conectado ao banco de dados PostgreSQL");
});

db.on("error", (err) => {
  console.error("❌ Erro na conexão com o banco de dados:", err);
});

export default db;

