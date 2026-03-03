import db from "../src/config/database";

const diagnose = async () => {
    console.log("=== DIAGNÓSTICO DE MÉTRICAS ===\n");

    // 1. Verifica se a tabela calendar_items existe
    try {
        const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'calendar_items'
      ) as exists
    `);
        console.log("1. Tabela calendar_items existe?", tableCheck.rows[0].exists);
    } catch (e: any) {
        console.error("1. ERRO ao verificar tabela:", e.message);
    }

    // 2. Conta calendários
    try {
        const cals = await db.query(`SELECT COUNT(*) as total, status FROM calendarios GROUP BY status`);
        console.log("\n2. Calendários por status:");
        cals.rows.forEach((r: any) => console.log(`   - ${r.status}: ${r.total}`));

        // Últimos 3 calendários
        const recent = await db.query(`SELECT id, cliente_id, mes, status, criado_em FROM calendarios ORDER BY criado_em DESC LIMIT 3`);
        console.log("\n   Últimos 3 calendários:");
        recent.rows.forEach((r: any) => console.log(`   - ${r.id} | cliente=${r.cliente_id} | mes=${r.mes} | status=${r.status} | criado=${r.criado_em}`));
    } catch (e: any) {
        console.error("2. ERRO:", e.message);
    }

    // 3. Conta calendar_items
    try {
        const items = await db.query(`SELECT COUNT(*) as total FROM calendar_items`);
        console.log(`\n3. Total calendar_items: ${items.rows[0].total}`);

        const byStatus = await db.query(`SELECT status, COUNT(*) as total FROM calendar_items GROUP BY status`);
        console.log("   Por status:");
        byStatus.rows.forEach((r: any) => console.log(`   - ${r.status}: ${r.total}`));

        const byCliente = await db.query(`SELECT cliente_id, COUNT(*) as total FROM calendar_items GROUP BY cliente_id`);
        console.log("   Por cliente:");
        byCliente.rows.forEach((r: any) => console.log(`   - ${r.cliente_id}: ${r.total} items`));

        // Verificar first_generated_at
        const fga = await db.query(`SELECT MIN(first_generated_at) as min_date, MAX(first_generated_at) as max_date FROM calendar_items`);
        console.log(`   first_generated_at range: ${fga.rows[0].min_date} → ${fga.rows[0].max_date}`);

    } catch (e: any) {
        console.error(`3. ERRO ao consultar calendar_items: ${e.message}`);
        if (e.message.includes('does not exist') || e.message.includes('relation')) {
            console.error("\n   ⚠️ TABELA calendar_items NÃO EXISTE! Precisa rodar a migração.");
        }
    }

    // 4. Simula a query de métricas (mesma da rota dashboard-metrics)
    try {
        const clientes = await db.query(`SELECT id, nome FROM clientes LIMIT 3`);
        console.log("\n4. Clientes encontrados:");
        for (const c of clientes.rows) {
            console.log(`\n   Cliente: ${c.nome} (${c.id})`);

            const rangeStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            try {
                const itemsResult = await db.query(
                    `SELECT
             COUNT(*)                                                           AS total,
             COUNT(*) FILTER (WHERE status = 'approved')                       AS approved,
             COUNT(*) FILTER (WHERE status = 'published')                      AS published,
             COALESCE(AVG(revisions_count), 0)                                 AS avg_revisions,
             COALESCE(
               AVG(EXTRACT(EPOCH FROM (approved_at - first_generated_at)) / 60)
               FILTER (WHERE approved_at IS NOT NULL),
               0
             )                                                                  AS avg_time_to_approval_min
           FROM calendar_items
           WHERE cliente_id=$1 AND first_generated_at >= $2`,
                    [c.id, rangeStart]
                );
                const stats = itemsResult.rows[0];
                console.log(`   Métricas (últimos 30d): total=${stats.total} approved=${stats.approved} published=${stats.published} avg_revisions=${stats.avg_revisions}`);
            } catch (e: any) {
                console.log(`   ERRO nas métricas: ${e.message}`);
            }
        }
    } catch (e: any) {
        console.error("4. ERRO:", e.message);
    }

    await db.end();
    console.log("\n=== FIM DO DIAGNÓSTICO ===");
};

diagnose().catch(console.error);
