import db from "../src/config/database";

const migrate = async () => {
    try {
        await db.query(`
            ALTER TABLE clientes 
            ADD COLUMN IF NOT EXISTS categorias_nicho JSONB DEFAULT '[]'::jsonb
        `);
        console.log("✅ Coluna categorias_nicho adicionada à tabela clientes!");

        // Verificar also other missing columns
        await db.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS logo_url TEXT`);
        console.log("✅ Coluna logo_url adicionada!");

        await db.end();
        process.exit(0);
    } catch (e: any) {
        console.error("❌ Erro:", e.message);
        process.exit(1);
    }
};

migrate();
