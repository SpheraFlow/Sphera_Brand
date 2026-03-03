import db from "../src/config/database";

const diagnose = async () => {
    try {
        // Verificar conexão e banco atual
        const dbInfo = await db.query(`SELECT current_database(), current_user, inet_server_addr(), inet_server_port()`);
        console.log("🔌 Conexão ativa:", dbInfo.rows[0]);

        // Listar TODAS as tabelas no schema public
        const tables = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
        console.log("📋 Tabelas existentes:", tables.rows.map((r: any) => r.tablename));

        // Contar clientes
        try {
            const cnt = await db.query(`SELECT count(*) as total FROM clientes`);
            console.log("🔍 Total de clientes:", cnt.rows[0].total);
        } catch (e: any) {
            console.log("❌ Tabela clientes não existe:", e.message);
        }

        // Contar users
        try {
            const ucnt = await db.query(`SELECT count(*) as total FROM users`);
            console.log("🔍 Total de users:", ucnt.rows[0].total);
        } catch (e: any) {
            console.log("❌ Tabela users não existe:", e.message);
        }

        await db.end();
        process.exit(0);
    } catch (e) {
        console.error("Erro:", e);
        process.exit(1);
    }
};

diagnose();
