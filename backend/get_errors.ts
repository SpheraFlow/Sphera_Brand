import db from "./src/config/database";

async function run() {
    try {
        const res = await db.query("SELECT error, created_at FROM calendar_generation_jobs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 3");
        console.dir(res.rows, { depth: null });
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
