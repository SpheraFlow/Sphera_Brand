import pool from './db';

async function migrate() {
    console.log('Iniciando migração: Adicionando coluna agent_id na tabela prompt_templates');

    try {
        await pool.query('BEGIN');

        // 1. Adicionar coluna (aceita null para mantermos a compatibilidade onde existia)
        await pool.query(`
            ALTER TABLE prompt_templates 
            ADD COLUMN IF NOT EXISTS agent_id VARCHAR(50);
        `);

        console.log('✅ Coluna agent_id criada com sucesso.');

        // 2. Definir 'estrategista' para os registros que já existem sem agent_id definido (como fallback padrão)
        const updateResult = await pool.query(`
            UPDATE prompt_templates 
            SET agent_id = 'estrategista' 
            WHERE agent_id IS NULL;
        `);

        console.log(`✅ ${updateResult.rowCount} templates atualizados para o agente "estrategista".`);

        await pool.query('COMMIT');
        console.log('Migração concluída com sucesso!');
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('❌ Erro na migração:', e);
    } finally {
        pool.end();
    }
}

migrate();
