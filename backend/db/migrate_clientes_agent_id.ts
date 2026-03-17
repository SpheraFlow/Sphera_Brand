import pool from '../src/config/database';

async function migrate() {
    console.log('🔄 Iniciando migração: Adicionando coluna prompt_template_agent_id na tabela clientes');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`
            ALTER TABLE clientes
            ADD COLUMN IF NOT EXISTS prompt_template_agent_id TEXT;
        `);
        console.log('✅ Coluna prompt_template_agent_id adicionada à tabela clientes.');

        // Popula a partir do template ativo de cada cliente (se agent_id já existir)
        await client.query(`
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'prompt_templates' AND column_name = 'agent_id'
              ) THEN
                UPDATE clientes c
                SET prompt_template_agent_id = pt.agent_id
                FROM prompt_templates pt
                WHERE pt.cliente_id = c.id
                  AND pt.is_active = true
                  AND pt.agent_id IS NOT NULL
                  AND c.prompt_template_agent_id IS NULL;
              END IF;
            END $$;
        `);
        console.log('✅ Clientes com template ativo atualizados com agent_id correspondente.');

        await client.query('COMMIT');
        console.log('✅ Migração concluída com sucesso!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Erro na migração:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
