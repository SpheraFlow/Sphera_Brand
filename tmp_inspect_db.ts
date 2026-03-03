
import db from '../backend/src/config/database';

async function inspect() {
    try {
        console.log("--- CALENDAR GENERATION JOBS ---");
        const jobs = await db.query("SELECT id, status, progress, error, created_at FROM calendar_generation_jobs ORDER BY created_at DESC LIMIT 5");
        console.table(jobs.rows);

        console.log("\n--- CALENDARIOS ---");
        const cals = await db.query("SELECT id, cliente_id, mes, status, generation_job_id, criado_em FROM calendarios ORDER BY criado_em DESC LIMIT 5");
        console.table(cals.rows);

        console.log("\n--- PRESENTATIONS ---");
        const presentations = await db.query("SELECT id, cliente_id, titulo, criado_em FROM presentations ORDER BY criado_em DESC LIMIT 5");
        console.table(presentations.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

inspect();
