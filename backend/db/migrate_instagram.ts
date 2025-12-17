import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const db = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || "spheraflow",
  password: process.env.POSTGRES_PASSWORD || "@Trafego123",
  database: process.env.POSTGRES_DB || "app_db",
});

async function migrate() {
  console.log("🚀 Migração Instagram - Iniciando...\n");

  try {
    // 1. Adicionar coluna ig_media_id (ID único do Instagram)
    console.log("📊 Adicionando coluna ig_media_id...");
    await db.query(`
      ALTER TABLE posts_originais 
      ADD COLUMN IF NOT EXISTS ig_media_id TEXT;
    `);
    console.log("  ✅ ig_media_id OK");

    // 2. Adicionar coluna tipo_origem
    console.log("📊 Adicionando coluna tipo_origem...");
    await db.query(`
      ALTER TABLE posts_originais 
      ADD COLUMN IF NOT EXISTS tipo_origem TEXT DEFAULT 'proprio';
    `);
    console.log("  ✅ tipo_origem OK (proprio/referencia)");

    // 3. Criar índice único para ig_media_id
    console.log("🔑 Criando índice único para ig_media_id...");
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ig_media_id_unique 
      ON posts_originais(ig_media_id) 
      WHERE ig_media_id IS NOT NULL;
    `);
    console.log("  ✅ Índice único criado");

    // 4. Verificar estrutura
    console.log("\n📋 Verificando estrutura final...");
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'posts_originais'
      ORDER BY ordinal_position;
    `);

    console.log("\nColunas da tabela posts_originais:");
    result.rows.forEach((col: any) => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log("\n✅ MIGRAÇÃO INSTAGRAM CONCLUÍDA!");

  } catch (error) {
    console.error("❌ ERRO:", error);
  } finally {
    await db.end();
  }
}

migrate();

