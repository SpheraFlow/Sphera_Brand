import db from '../config/database';

async function checkTables() {
  try {
    const res = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tabelas existentes:", res.rows.map(r => r.table_name));
    process.exit(0);
  } catch (err) {
    console.error("Erro ao verificar tabelas:", err);
    process.exit(1);
  }
}

checkTables();
