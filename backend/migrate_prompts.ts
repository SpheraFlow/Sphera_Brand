import db from "./src/config/database";

async function run() {
    console.log("Iniciando migration de templates...");
    const client = await db.connect();
    try {
        const templates = await client.query("SELECT id, body FROM prompt_templates");
        console.log(`Encontrados ${templates.rowCount} templates.`);

        let updatedCount = 0;
        for (const row of templates.rows) {
            let newBody = row.body;

            // Atualizar a linha de formato rígido
            if (newBody.includes('EXATAMENTE um de: Reels, Static, Carousel, Stories.')) {
                newBody = newBody.replace(
                    'EXATAMENTE um de: Reels, Static, Carousel, Stories.',
                    'EXATAMENTE um de: Reels, Arte, Carrossel, Foto ou Story.'
                );
            }

            if (newBody !== row.body) {
                await client.query("UPDATE prompt_templates SET body = $1 WHERE id = $2", [newBody, row.id]);
                updatedCount++;
            }
        }

        console.log(`✅ Sucesso! ${updatedCount} templates foram atualizados.`);
    } catch (err) {
        console.error("Erro na migration:", err);
    } finally {
        client.release();
        process.exit(0);
    }
}

run();
