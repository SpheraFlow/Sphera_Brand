import db from "../src/config/database";

const migrateBrandingFix = async () => {
  try {
    console.log("🔄 Iniciando migração: Tabela Branding...");

    // 1. Criar tabela branding
    console.log("📝 Criando tabela branding...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS branding (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cliente_id UUID NOT NULL,
        visual_style JSONB,
        tone_of_voice JSONB,
        audience JSONB,
        keywords TEXT[],
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_cliente_branding FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
      );
    `);

    // 2. Criar índice para melhorar performance
    console.log("📝 Criando índice...");
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_branding_cliente_id ON branding(cliente_id);
    `);

    // 3. Adicionar comentário na tabela
    await db.query(`
      COMMENT ON TABLE branding IS 'Armazena o DNA de branding consolidado de cada cliente';
    `);

    console.log("✅ Migração Branding concluída com sucesso!");
    
    // Verificar se a tabela foi criada
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'branding'
    `);
    
    if (result.rows.length > 0) {
      console.log("✅ Tabela 'branding' confirmada no banco de dados.");
    } else {
      console.error("❌ Tabela 'branding' não foi criada!");
    }

    await db.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao executar migração Branding:", error);
    process.exit(1);
  }
};

migrateBrandingFix();


