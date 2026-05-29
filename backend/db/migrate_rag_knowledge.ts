/**
 * STORY-013 — Cérebro RAG por Cliente (pgvector)
 *
 * Cria a infraestrutura de Retrieval-Augmented Generation isolada por cliente:
 *   1. Extensão `vector` (pgvector) + `pgcrypto` (gen_random_uuid)
 *   2. Tabela `knowledge_chunks` — chunks vetorizados com embedding VECTOR(768)
 *      (text-embedding-004 do Vertex AI gera 768 dimensões)
 *   3. Tabela `embedding_jobs` — fila para processamento assíncrono de embeddings
 *
 * Decisão de índice: HNSW (não IVFFlat).
 *   - HNSW oferece melhor recall/latência para datasets de até ~1M vetores por
 *     cliente, que é a escala esperada aqui (poucos milhares de chunks/cliente).
 *   - IVFFlat exige `lists` calibrado ao volume e re-treino do índice conforme
 *     os dados crescem; HNSW é estável sem re-treino e não precisa de ANALYZE
 *     prévio para ter boa qualidade de busca.
 *   - Parâmetros: m=16 (conexões por nó) e ef_construction=64 (qualidade de
 *     construção) — defaults equilibrados recomendados pelo pgvector.
 *
 * Isolamento por cliente: TODAS as queries de retrieval filtram por
 * `cliente_id` ANTES da busca vetorial. O índice composto
 * (cliente_id, source_type) acelera esses filtros.
 *
 * Idempotente — usa IF NOT EXISTS em extensões, tabelas e índices.
 * Transacional — BEGIN/COMMIT com ROLLBACK em falha.
 */
import db from "../src/config/database";
import logger from "../src/utils/logger";

const migrateRagKnowledge = async () => {
    const client = await db.connect();

    try {
        console.log("🔄 STORY-013 → migrando: pgvector + knowledge_chunks + embedding_jobs...");
        logger.info({ event: "migration_started", migration: "rag_knowledge" }, "Iniciando migração RAG");

        await client.query("BEGIN");

        // ──────────────────────────────────────────────────────────────────
        // 1. Extensões necessárias
        //    - vector: tipos e operadores de embeddings (pgvector)
        //    - pgcrypto: gen_random_uuid() (PG 13+ já traz, mas garantimos)
        //    Requer privilégio para CREATE EXTENSION (superuser ou role com
        //    CREATE em pg_catalog). Em produção gerenciada, pode ser necessário
        //    pré-habilitar a extensão fora desta migration.
        // ──────────────────────────────────────────────────────────────────
        await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
        await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
        console.log("  ✅ Extensões vector + pgcrypto habilitadas.");

        // ──────────────────────────────────────────────────────────────────
        // 2. Tabela principal de chunks vetorizados
        // ──────────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS knowledge_chunks (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                cliente_id   UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                source_type  TEXT NOT NULL CHECK (source_type IN (
                                 'brand_doc',
                                 'brand_rule',
                                 'past_post_approved',
                                 'briefing_session',
                                 'presentation',
                                 'manual'
                             )),
                source_id    UUID,
                content      TEXT NOT NULL,
                content_hash TEXT NOT NULL,          -- SHA-256 do content para dedup
                embedding    VECTOR(768),            -- text-embedding-004 → 768 dims
                metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_knowledge_chunks_cliente_hash
                    UNIQUE (cliente_id, content_hash)  -- evita duplicatas por cliente
            );
        `);
        console.log("  ✅ Tabela knowledge_chunks criada (ou já existia).");

        // ──────────────────────────────────────────────────────────────────
        // 3. Índices de knowledge_chunks
        // ──────────────────────────────────────────────────────────────────

        // 3a. HNSW para busca por similaridade de cosseno.
        //     vector_cosine_ops casa com o operador <=> usado no retrieval.
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
                ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64);
        `);

        // 3b. Índice composto para os filtros de isolamento (cliente + tipo).
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_cliente_type
                ON knowledge_chunks (cliente_id, source_type);
        `);

        // 3c. Índice de hash para dedup rápido por cliente.
        //     (A UNIQUE constraint já cria um índice equivalente, mas mantemos
        //     explícito conforme spec da STORY-013 — IF NOT EXISTS o torna no-op
        //     caso o índice da constraint cubra o mesmo predicado.)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_content_hash
                ON knowledge_chunks (cliente_id, content_hash);
        `);
        console.log("  ✅ Índices de knowledge_chunks criados (HNSW + composto + hash).");

        // ──────────────────────────────────────────────────────────────────
        // 4. Fila de jobs de embedding (processamento assíncrono)
        // ──────────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS embedding_jobs (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                cliente_id    UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                source_type   TEXT NOT NULL,
                source_id     UUID,
                status        TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
                attempt_count INTEGER NOT NULL DEFAULT 0,
                last_error    TEXT,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                started_at    TIMESTAMPTZ,
                finished_at   TIMESTAMPTZ
            );
        `);
        console.log("  ✅ Tabela embedding_jobs criada (ou já existia).");

        // 4a. Índice parcial para o worker buscar rapidamente jobs pendentes.
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status
                ON embedding_jobs (status) WHERE status = 'pending';
        `);

        // 4b. Índice composto para inspeção por cliente + status.
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_embedding_jobs_cliente
                ON embedding_jobs (cliente_id, status);
        `);
        console.log("  ✅ Índices de embedding_jobs criados.");

        await client.query("COMMIT");
        console.log("✅ STORY-013 migration concluída com sucesso!");
        logger.info({ event: "migration_completed", migration: "rag_knowledge" }, "Migração RAG concluída");
    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("❌ STORY-013 migration falhou:", error);
        logger.error(
            { event: "migration_failed", migration: "rag_knowledge", err: error?.message },
            "Falha na migração RAG"
        );
        process.exitCode = 1;
    } finally {
        client.release();
        await db.end();
    }
};

migrateRagKnowledge();
