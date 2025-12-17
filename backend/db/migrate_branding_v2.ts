import { Client } from 'pg';

// Migration: Brand DNA 2.0 - Adicionar colunas ricas à tabela branding
// Adiciona: archetype, usp, anti_keywords, niche

async function migrateBrandingV2() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'mvp_system',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('🔄 [MIGRATION] Iniciando migração Brand DNA 2.0...');

    // Verificar se as colunas já existem
    const checkColumnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'branding'
      AND column_name IN ('archetype', 'usp', 'anti_keywords', 'niche');
    `;

    const existingColumns = await client.query(checkColumnsQuery);
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);

    console.log('📊 [MIGRATION] Colunas existentes:', existingColumnNames);

    // Adicionar coluna archetype se não existir
    if (!existingColumnNames.includes('archetype')) {
      console.log('➕ [MIGRATION] Adicionando coluna archetype...');
      await client.query(`
        ALTER TABLE branding
        ADD COLUMN archetype TEXT;
      `);
    }

    // Adicionar coluna usp se não existir
    if (!existingColumnNames.includes('usp')) {
      console.log('➕ [MIGRATION] Adicionando coluna usp...');
      await client.query(`
        ALTER TABLE branding
        ADD COLUMN usp TEXT;
      `);
    }

    // Adicionar coluna anti_keywords se não existir
    if (!existingColumnNames.includes('anti_keywords')) {
      console.log('➕ [MIGRATION] Adicionando coluna anti_keywords...');
      await client.query(`
        ALTER TABLE branding
        ADD COLUMN anti_keywords TEXT[];
      `);
    }

    // Adicionar coluna niche se não existir
    if (!existingColumnNames.includes('niche')) {
      console.log('➕ [MIGRATION] Adicionando coluna niche...');
      await client.query(`
        ALTER TABLE branding
        ADD COLUMN niche TEXT;
      `);
    }

    // Verificar estrutura final da tabela
    const finalCheckQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'branding'
      ORDER BY ordinal_position;
    `;

    const finalResult = await client.query(finalCheckQuery);
    console.log('✅ [MIGRATION] Estrutura final da tabela branding:');
    finalResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable})`);
    });

    console.log('🎉 [MIGRATION] Migração Brand DNA 2.0 concluída com sucesso!');

  } catch (error) {
    console.error('❌ [MIGRATION] Erro na migração:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Executar migração automaticamente
console.log('🚀 Iniciando migração Brand DNA 2.0...');
migrateBrandingV2()
  .then(() => {
    console.log('✅ Migração executada com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Falha na migração:', error);
    process.exit(1);
  });

export default migrateBrandingV2;
