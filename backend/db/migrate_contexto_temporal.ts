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
  console.log("🚀 Iniciando migração de contexto temporal (datas_comemorativas, trends_cache, keywords_monitorar)...\n");

  try {
    // 1) Adicionar coluna keywords_monitorar em clientes
    console.log("🧩 Adicionando coluna 'keywords_monitorar' em 'clientes' (JSONB opcional)...");
    await db.query(`
      ALTER TABLE clientes
      ADD COLUMN IF NOT EXISTS keywords_monitorar JSONB;
    `);
    console.log("  ✅ keywords_monitorar adicionada (ou já existente)");

    // 2) Criar tabela datas_comemorativas
    console.log("📅 Criando tabela 'datas_comemorativas'...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS datas_comemorativas (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        data DATE NOT NULL,
        titulo TEXT NOT NULL,
        categorias JSONB DEFAULT '[]'::jsonb,
        descricao TEXT,
        relevancia INTEGER DEFAULT 3,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("  ✅ Tabela datas_comemorativas criada/garantida");

    // Índices em data e categorias
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_datas_comemorativas_data
      ON datas_comemorativas(data);
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_datas_comemorativas_categorias
      ON datas_comemorativas USING GIN (categorias);
    `);
    console.log("  ✅ Índices em data e categorias criados/garantidos");

    // 3) Criar tabela trends_cache
    console.log("📈 Criando tabela 'trends_cache'...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS trends_cache (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        cliente_id UUID NOT NULL,
        keywords JSONB NOT NULL,
        resultados JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_trends_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
      );
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_trends_cache_cliente_created
      ON trends_cache(cliente_id, created_at DESC);
    `);
    console.log("  ✅ Tabela trends_cache criada/garantida\n");

    console.log("✅ Migração de contexto temporal concluída com sucesso!");
  } catch (error) {
    console.error("❌ ERRO NA MIGRAÇÃO DE CONTEXTO TEMPORAL:", error);
    throw error;
  } finally {
    await db.end();
  }
}

migrate();
