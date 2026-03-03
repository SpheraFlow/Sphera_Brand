import db from '../src/config/database';

async function main() {
    const r = await db.query(
        `SELECT COUNT(*) as total, MIN(data::text) as primeira, MAX(data::text) as ultima FROM datas_comemorativas`
    );
    console.log('Total:', JSON.stringify(r.rows[0]));
    const r2 = await db.query(
        `SELECT data, titulo FROM datas_comemorativas WHERE EXTRACT(MONTH FROM data) = 3 AND EXTRACT(YEAR FROM data) = 2026 ORDER BY data LIMIT 10`
    );
    console.log('Março 2026:', JSON.stringify(r2.rows));
    process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
