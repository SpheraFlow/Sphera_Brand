import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const db = new Pool({
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || "localhost",
    port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT) || 5432,
    user: process.env.DB_USER || process.env.POSTGRES_USER || "spheraflow",
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || "@Trafego123",
    database: process.env.DB_NAME || process.env.POSTGRES_DB || "app_db",
});

async function migrate() {
    console.log("🚀 Iniciando migração de colunas faltantes...\n");

    try {
        // 1. Atualizar tabela Clientes
        console.log("🧩 Atualizando tabela 'clientes'...");

        await db.query(`
      ALTER TABLE clientes
      ADD COLUMN IF NOT EXISTS persona_atualizada TEXT,
      ADD COLUMN IF NOT EXISTS logo_url TEXT,
      ADD COLUMN IF NOT EXISTS token_usage JSONB DEFAULT '{"total_tokens": 0}'::jsonb,
      ADD COLUMN IF NOT EXISTS categorias_nicho JSONB DEFAULT '[]'::jsonb;
    `);
        console.log("  ✅ Colunas adicionadas em 'clientes': persona_atualizada, logo_url, token_usage, categorias_nicho");

        // 2. Atualizar tabela Posts (se necessário, baseado em database.sql vs PROJECT_CONTEXT)
        console.log("🧩 Atualizando tabela 'posts'...");
        await db.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pendente',
      ADD COLUMN IF NOT EXISTS metadata JSONB;
    `);
        console.log("  ✅ Colunas adicionadas em 'posts': status, metadata");

        // 3. Atualizar tabela Branding (archetype, ups, etc)
        console.log("🧩 Atualizando tabela 'branding'...");
        await db.query(`
      ALTER TABLE branding
      ADD COLUMN IF NOT EXISTS archetype TEXT,
      ADD COLUMN IF NOT EXISTS usp TEXT,
      ADD COLUMN IF NOT EXISTS anti_keywords TEXT[],
      ADD COLUMN IF NOT EXISTS niche TEXT;
    `);
        console.log("  ✅ Colunas adicionadas em 'branding': archetype, usp, anti_keywords, niche");

        // 4. Criar tabela Prompt Chains
        console.log("🧩 Criando tabela 'prompt_chains'...");
        await db.query(`
      CREATE TABLE IF NOT EXISTS prompt_chains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        client_id UUID,
        is_global BOOLEAN DEFAULT false,
        steps JSONB NOT NULL,
        created_by UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
        console.log("  ✅ Tabela 'prompt_chains' criada/garantida");

        // 5. Criar tabela Branding Versions
        console.log("🧩 Criando tabela 'branding_versions'...");
        await db.query(`
      CREATE TABLE IF NOT EXISTS branding_versions (
        id UUID PRIMARY KEY,
        cliente_id UUID NOT NULL,
        branding_id UUID NOT NULL,
        snapshot JSONB NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
        console.log("  ✅ Tabela 'branding_versions' criada/garantida");

        console.log("\n✅ Migração de colunas faltantes concluída com sucesso!");
    } catch (error) {
        console.error("❌ ERRO NA MIGRAÇÃO DE COLUNAS:", error);
        process.exit(1);
    } finally {
        await db.end();
    }
}

migrate();
