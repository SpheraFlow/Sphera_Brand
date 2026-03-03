import db from "./src/config/database";
import { randomUUID } from "crypto";

async function run() {
    const client = await db.connect();
    const testId = randomUUID();
    try {
        const res = await client.query("SELECT * FROM branding LIMIT 1");
        if (res.rows.length === 0) {
            console.log("No branding found.");
            return;
        }
        const row = res.rows[0];

        // Tentativa manual de inserir snapshot
        console.log("Tentando inserir snapshot...");
        await client.query(
            `INSERT INTO branding_versions (id, cliente_id, branding_id, snapshot, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
            [
                testId,
                row.cliente_id,
                row.id,
                JSON.stringify(row),
                "test"
            ]
        );
        console.log("Sucesso!");
    } catch (err) {
        console.error("Erro real:", err);
    } finally {
        client.query(`DELETE FROM branding_versions WHERE id = '${testId}'`);
        client.release();
        process.exit(0);
    }
}
run();
