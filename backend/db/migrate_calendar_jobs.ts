import db from "../src/config/database";

const migrateCalendarJobs = async () => {
    const client = await db.connect();

    try {
        console.log("🔄 Iniciando migração: Calendar Generation Jobs...");

        await client.query('BEGIN');

        // 1. Criar tabela calendar_generation_jobs
        console.log("📝 Criando tabela calendar_generation_jobs...");
        await client.query(`
      CREATE TABLE IF NOT EXISTS calendar_generation_jobs (
        id UUID PRIMARY KEY,
        cliente_id UUID NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'canceled')),
        progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
        current_step TEXT,
        payload JSONB NOT NULL,
        result_calendar_ids UUID[],
        error JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_cliente_job FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
      );
    `);

        // 2. Alterar tabela calendarios
        console.log("📝 Alterando tabela calendarios...");

        // Adicionar status se não existir
        await client.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendarios' AND column_name='status') THEN
              ALTER TABLE calendarios ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
          END IF;
      END
      $$;
    `);

        // Adicionar generation_job_id se não existir
        await client.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendarios' AND column_name='generation_job_id') THEN
              ALTER TABLE calendarios ADD COLUMN generation_job_id UUID REFERENCES calendar_generation_jobs(id) ON DELETE SET NULL;
          END IF;
      END
      $$;
    `);

        // 3. Criar índices
        console.log("📝 Criando índices...");

        // Índice composto funcional para busca case-insensitive por mês
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_calendarios_cliente_mes_lower 
      ON calendarios (cliente_id, LOWER(mes));
    `);

        // Índice para jobs
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_cliente_status_created 
      ON calendar_generation_jobs (cliente_id, status, created_at DESC);
    `);

        // Índice de performance para listagem de calendários (criado_em DESC) - reforço
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_calendarios_cliente_criado_em 
      ON calendarios (cliente_id, criado_em DESC);
    `);

        // 4. Trigger para updated_at em jobs (opcional, mas boa prática)
        // Vamos garantir que a função trigger existe
        await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

        // Aplicar trigger na tabela jobs se não existir
        const triggerCheck = await client.query(`
      SELECT 1 FROM pg_trigger WHERE tgname = 'update_jobs_updated_at'
    `);

        if (triggerCheck.rowCount === 0) {
            await client.query(`
          CREATE TRIGGER update_jobs_updated_at
          BEFORE UPDATE ON calendar_generation_jobs
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        `);
        }

        await client.query('COMMIT');
        console.log("✅ Migração Calendar Generation Jobs concluída com sucesso!");

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Erro ao executar migração Calendar Jobs:", error);
        process.exit(1);
    } finally {
        client.release();
        // Encerra processo explicitamente pois o pool pode manter conexão aberta
        // Mas em scripts de migração ts-node, db.end() é melhor se for o pool global,
        // aqui usamos client do pool, então liberamos e encerramos o pool.
        await db.end();
    }
};

migrateCalendarJobs();
