
import db from '../src/config/database';

async function checkSchema() {
    try {
        const res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'calendar_generation_jobs' AND column_name = 'error'");
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkSchema();
