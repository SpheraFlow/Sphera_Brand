import db from "../src/config/database";

const migrate = async () => {
    const client = await db.connect();
    try {
        console.log("🔄 Adicionando DEFAULT gen_random_uuid() à coluna id de calendar_generation_jobs...");
        await client.query('BEGIN');

        // Garante que a extensão pgcrypto está disponível (necessária em PG < 13)
        await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

        // Adiciona DEFAULT na coluna id (idempotente: não falha se já existir)
        await client.query(`
            ALTER TABLE calendar_generation_jobs
            ALTER COLUMN id SET DEFAULT gen_random_uuid()
        `);

        await client.query('COMMIT');
        console.log("✅ Migração concluída com sucesso.");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Erro na migração:", err);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
};

migrate();
