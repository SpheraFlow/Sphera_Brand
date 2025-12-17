import db from "../src/config/database";

const migrateCalendariosFix = async () => {
  try {
    console.log("🔄 Iniciando migração: Tabela Calendarios...");

    // 1. Criar tabela calendarios
    console.log("📝 Criando tabela calendarios...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS calendarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cliente_id UUID NOT NULL,
        periodo INTEGER NOT NULL,
        briefing TEXT,
        dias JSONB NOT NULL,
        metadata JSONB,
        criado_em TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_cliente_calendario FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
      );
    `);

    // 2. Criar índices para melhorar performance
    console.log("📝 Criando índices...");
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_calendarios_cliente_id ON calendarios(cliente_id);
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_calendarios_criado_em ON calendarios(criado_em DESC);
    `);

    // 3. Adicionar comentário na tabela
    await db.query(`
      COMMENT ON TABLE calendarios IS 'Tabela de calendários editoriais gerados';
    `);

    console.log("✅ Migração Calendarios concluída com sucesso!");
    
    // Verificar se a tabela foi criada
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'calendarios'
    `);
    
    if (result.rows.length > 0) {
      console.log("✅ Tabela 'calendarios' confirmada no banco de dados.");
    } else {
      console.error("❌ Tabela 'calendarios' não foi criada!");
    }

    await db.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao executar migração Calendarios:", error);
    process.exit(1);
  }
};

migrateCalendariosFix();


