import pool from '../src/config/database';

async function migrate() {
    console.log('🔄 Iniciando migração de índices para suportar múltiplos agentes ativos...');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Remover índices antigos que impediam múltiplos agentes ativos por cliente
        console.log('🔧 Removendo índices restritivos antigos...');
        await client.query('DROP INDEX IF EXISTS idx_pt_one_active_per_client;');
        await client.query('DROP INDEX IF EXISTS idx_pt_one_active_global;');

        // 2. Criar novo índice de unicidade por CLIENTE + AGENTE
        // Isso permite que cada cliente tenha 1 'estrategista' ativo, 1 'storyteller' ativo, etc.
        console.log('📌 Criando novo índice: [cliente_id, agent_id] para templates ativos...');
        await client.query(`
            CREATE UNIQUE INDEX idx_pt_one_active_per_client_agent
            ON prompt_templates (cliente_id, agent_id)
            WHERE cliente_id IS NOT NULL AND is_active = true;
        `);

        // 3. Criar novo índice de unicidade para templates GLOBAIS por AGENTE
        // Isso permite 1 'estrategista' global ativo, 1 'storyteller' global ativo, etc.
        console.log('📌 Criando novo índice: [agent_id] para templates globais ativos...');
        await client.query(`
            CREATE UNIQUE INDEX idx_pt_one_active_global_agent
            ON prompt_templates (agent_id)
            WHERE cliente_id IS NULL AND is_active = true;
        `);

        await client.query('COMMIT');
        console.log('✅ Migração de índices concluída com sucesso!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Erro na migração de índices:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
