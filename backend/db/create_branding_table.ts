import db from "../src/config/database";

const up = async () => {
  try {
    console.log("🔨 Criando tabela 'branding'...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS branding (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cliente_id UUID REFERENCES clientes(id),
        visual_style JSONB,
        tone_of_voice JSONB,
        audience JSONB,
        keywords TEXT[],
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("✅ Tabela 'branding' criada com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao criar tabela:", error);
    process.exit(1);
  }
};

up();