import db from '../config/database';

async function checkColumns() {
  try {
    const tables = ['calendarios', 'branding', 'brand_rules', 'brand_docs', 'prompt_chains'];
    
    for (const table of tables) {
      console.log(`\n--- Estrutura da tabela: ${table} ---`);
      try {
        const res = await db.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [table]);
        
        if (res.rows.length === 0) {
            console.log(`Tabela '${table}' NÃO ENCONTRADA.`);
        } else {
            res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
        }
      } catch (e: any) {
         console.log(`Erro ao ler tabela ${table}:`, e.message);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error("Erro geral:", err);
    process.exit(1);
  }
}

checkColumns();
