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
  console.log("🚀 Iniciando migração de métricas do Instagram...\n");

  try {
    // 1. Adicionar colunas de métricas na tabela posts_originais
    console.log("📊 Adicionando colunas de métricas em 'posts_originais'...");

    await db.query(`
      ALTER TABLE posts_originais 
      ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
    `);
    console.log("  ✅ likes_count");

    await db.query(`
      ALTER TABLE posts_originais 
      ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;
    `);
    console.log("  ✅ comments_count");

    await db.query(`
      ALTER TABLE posts_originais 
      ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;
    `);
    console.log("  ✅ shares_count");

    await db.query(`
      ALTER TABLE posts_originais 
      ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0;
    `);
    console.log("  ✅ reach");

    await db.query(`
      ALTER TABLE posts_originais 
      ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;
    `);
    console.log("  ✅ impressions");

    await db.query(`
      ALTER TABLE posts_originais 
      ADD COLUMN IF NOT EXISTS saves_count INTEGER DEFAULT 0;
    `);
    console.log("  ✅ saves_count");

    await db.query(`
      ALTER TABLE posts_originais 
      ADD COLUMN IF NOT EXISTS media_id_instagram TEXT;
    `);
    console.log("  ✅ media_id_instagram");

    await db.query(`
      ALTER TABLE posts_originais 
      ADD COLUMN IF NOT EXISTS media_type TEXT;
    `);
    console.log("  ✅ media_type (IMAGE, VIDEO, CAROUSEL_ALBUM)");

    await db.query(`
      ALTER TABLE posts_originais 
      ADD COLUMN IF NOT EXISTS permalink TEXT;
    `);
    console.log("  ✅ permalink");

    await db.query(`
      ALTER TABLE posts_originais 
      ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMP;
    `);
    console.log("  ✅ metrics_updated_at");

    // 2. Criar índice único para media_id_instagram (evitar duplicatas)
    console.log("\n🔑 Criando índice único para media_id_instagram...");
    
    // Primeiro, verificar se já existe
    const indexExists = await db.query(`
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_posts_originais_media_id_instagram_unique'
    `);

    if (indexExists.rows.length === 0) {
      await db.query(`
        CREATE UNIQUE INDEX idx_posts_originais_media_id_instagram_unique 
        ON posts_originais(media_id_instagram) 
        WHERE media_id_instagram IS NOT NULL;
      `);
      console.log("  ✅ Índice único criado");
    } else {
      console.log("  ⏭️ Índice já existe, pulando...");
    }

    // 3. Criar tabela separada para histórico de métricas (opcional, para tracking ao longo do tempo)
    console.log("\n📈 Criando tabela 'posts_metrics_history' para histórico...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS posts_metrics_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        post_original_id UUID NOT NULL,
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        shares_count INTEGER DEFAULT 0,
        reach INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        saves_count INTEGER DEFAULT 0,
        engagement_rate DECIMAL(5,2),
        recorded_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_post_metrics FOREIGN KEY (post_original_id) 
          REFERENCES posts_originais(id) ON DELETE CASCADE
      );
    `);
    console.log("  ✅ Tabela posts_metrics_history criada");

    // Índice para busca rápida por post
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_metrics_history_post_id 
      ON posts_metrics_history(post_original_id);
    `);
    console.log("  ✅ Índice de post_id criado");

    // Índice para busca por data
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_metrics_history_recorded_at 
      ON posts_metrics_history(recorded_at DESC);
    `);
    console.log("  ✅ Índice de recorded_at criado");

    // 4. Verificar estrutura final
    console.log("\n📋 Verificando estrutura final da tabela 'posts_originais'...");
    
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'posts_originais'
      ORDER BY ordinal_position;
    `);

    console.log("\n  Colunas atuais:");
    columns.rows.forEach((col: any) => {
      console.log(`    - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    console.log("\n✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!");
    console.log("\n📊 Novas colunas disponíveis:");
    console.log("   - likes_count: Quantidade de curtidas");
    console.log("   - comments_count: Quantidade de comentários");
    console.log("   - shares_count: Quantidade de compartilhamentos");
    console.log("   - reach: Alcance do post");
    console.log("   - impressions: Impressões do post");
    console.log("   - saves_count: Quantidade de salvamentos");
    console.log("   - media_id_instagram: ID único do Instagram (evita duplicatas)");
    console.log("   - media_type: Tipo de mídia (IMAGE, VIDEO, CAROUSEL_ALBUM)");
    console.log("   - permalink: Link permanente do post");
    console.log("   - metrics_updated_at: Última atualização das métricas");

  } catch (error) {
    console.error("❌ ERRO NA MIGRAÇÃO:", error);
    throw error;
  } finally {
    await db.end();
  }
}

migrate();

