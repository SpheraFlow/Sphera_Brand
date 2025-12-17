import db from "../src/config/database";

const migratePromptChains = async () => {
  try {
    console.log("🔄 Iniciando migração: Tabela prompt_chains...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS prompt_chains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        client_id UUID,
        is_global BOOLEAN DEFAULT false,
        steps JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by TEXT,
        CONSTRAINT fk_prompt_chains_client FOREIGN KEY (client_id)
          REFERENCES clientes(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_prompt_chains_client_id
      ON prompt_chains(client_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_prompt_chains_is_global
      ON prompt_chains(is_global);
    `);

    console.log("✅ Migração prompt_chains concluída com sucesso!");

    await db.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao executar migração prompt_chains:", error);
    process.exit(1);
  }
};

migratePromptChains();
