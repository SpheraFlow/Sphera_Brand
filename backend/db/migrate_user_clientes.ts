import db from "../src/config/database";

const migrate = async () => {
    try {
        console.log("🔄 Criando tabela user_clientes...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_clientes (
                user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, cliente_id)
            )
        `);
        console.log("✅ Tabela user_clientes criada/verificada com sucesso!");
        await db.end();
        process.exit(0);
    } catch (e) {
        console.error("❌ Erro:", e);
        process.exit(1);
    }
};

migrate();
