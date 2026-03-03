import db from "./src/config/database";

async function run() {
    const client = await db.connect();
    try {
        const res = await client.query("SELECT id, mes, status, cliente_id FROM calendarios LIMIT 10");
        console.log("Cals:", res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        process.exit(0);
    }
}
run();
