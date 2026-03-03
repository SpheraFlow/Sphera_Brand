import db from "./src/config/database";
import fs from "fs";

async function run() {
    try {
        const res = await db.query("SELECT * FROM prompt_templates WHERE is_active = true");
        fs.writeFileSync("template.json", JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
