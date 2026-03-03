require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');
const db = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: String(process.env.DB_PASSWORD),
    port: parseInt(process.env.DB_PORT || '5432')
});

async function main() {
    try {
        // Testar a nova query normalizada (REGEXP_REPLACE)
        const queryMonth = 'agosto 2026'; // o que date-fns gera
        const r = await db.query(`
      SELECT mes, status, jsonb_array_length(calendario_json::jsonb) as posts
      FROM calendarios
      WHERE LOWER(REGEXP_REPLACE(mes, '\\s+(de|do|da)\\s+', ' ', 'gi')) =
            LOWER(REGEXP_REPLACE($1, '\\s+(de|do|da)\\s+', ' ', 'gi'))
      ORDER BY criado_em DESC LIMIT 5
    `, [queryMonth]);

        console.log(`\nBusca por "${queryMonth}" com REGEXP_REPLACE:`);
        if (r.rows.length === 0) {
            console.log('  NENHUM RESULTADO');
        } else {
            r.rows.forEach(row => console.log(`  ✅ mes="${row.mes}" | status=${row.status} | posts=${row.posts}`));
        }

        // Testar julho também
        const queryJulho = 'julho 2026';
        const r2 = await db.query(`
      SELECT mes, status, jsonb_array_length(calendario_json::jsonb) as posts
      FROM calendarios
      WHERE LOWER(REGEXP_REPLACE(mes, '\\s+(de|do|da)\\s+', ' ', 'gi')) =
            LOWER(REGEXP_REPLACE($1, '\\s+(de|do|da)\\s+', ' ', 'gi'))
      ORDER BY criado_em DESC LIMIT 5
    `, [queryJulho]);

        console.log(`\nBusca por "${queryJulho}" com REGEXP_REPLACE:`);
        if (r2.rows.length === 0) {
            console.log('  NENHUM RESULTADO');
        } else {
            r2.rows.forEach(row => console.log(`  ✅ mes="${row.mes}" | status=${row.status} | posts=${row.posts}`));
        }

    } catch (e) { console.error('ERRO:', e.message); }
    finally { await db.end(); }
}
main();
