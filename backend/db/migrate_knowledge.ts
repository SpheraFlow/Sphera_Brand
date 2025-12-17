import db from "../src/config/database";

const migrateKnowledge = async () => {
  try {
    console.log("🔄 Iniciando migração: Gestão de Conhecimento...");

    // 1. Atualizar tabela clientes
    console.log("📝 Atualizando tabela clientes...");
    await db.query(`
      ALTER TABLE clientes 
      ADD COLUMN IF NOT EXISTS persona_atualizada TEXT;
    `);

    // 2. Criar tabela brand_docs
    console.log("📝 Criando tabela brand_docs...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS brand_docs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        cliente_id UUID NOT NULL,
        tipo TEXT NOT NULL,
        conteudo_texto TEXT,
        criado_em TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_cliente_docs FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
      );
    `);

    // 3. Criar tabela brand_rules
    console.log("📝 Criando tabela brand_rules...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS brand_rules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        cliente_id UUID NOT NULL,
        regra TEXT NOT NULL,
        categoria TEXT,
        ativa BOOLEAN DEFAULT TRUE,
        origem TEXT DEFAULT 'manual',
        criado_em TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_cliente_rules FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
      );
    `);

    // 4. Criar tabela client_prompts
    console.log("📝 Criando tabela client_prompts...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS client_prompts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        cliente_id UUID NOT NULL,
        titulo TEXT NOT NULL,
        conteudo_prompt TEXT NOT NULL,
        categoria TEXT,
        uso_frequente BOOLEAN DEFAULT FALSE,
        criado_em TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_cliente_prompts FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
      );
    `);

    // 5. Criar tabela generated_ideas
    console.log("📝 Criando tabela generated_ideas...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS generated_ideas (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        cliente_id UUID NOT NULL,
        tipo TEXT NOT NULL,
        input_original TEXT,
        output_ia JSONB,
        criado_em TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_cliente_ideas FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
      );
    `);

    // 6. Criar índices
    console.log("📝 Criando índices...");
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_brand_docs_cliente_id ON brand_docs(cliente_id);
      CREATE INDEX IF NOT EXISTS idx_brand_rules_cliente_id ON brand_rules(cliente_id);
      CREATE INDEX IF NOT EXISTS idx_client_prompts_cliente_id ON client_prompts(cliente_id);
      CREATE INDEX IF NOT EXISTS idx_generated_ideas_cliente_id ON generated_ideas(cliente_id);
    `);

    console.log("✅ Migração Knowledge concluída com sucesso!");
    
    await db.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao executar migração Knowledge:", error);
    process.exit(1);
  }
};

migrateKnowledge();
