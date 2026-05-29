/**
 * STORY-014 — Agente por Cliente (IA Especializada e Persistente)
 *
 * Cria a infraestrutura de sessões persistentes de agente por cliente:
 *   1. Tabela `agent_sessions` — uma conversa entre um usuário e um agente
 *      (briefing | creative | strategy), isolada por `cliente_id`. Mantém o
 *      `rolling_summary` que comprime sessões longas sem estourar o contexto do LLM.
 *   2. Tabela `agent_messages` — histórico completo de mensagens (user | assistant
 *      | system), com tokens_in/tokens_out e os chunks RAG recuperados por mensagem.
 *
 * Isolamento por cliente: agent_sessions referencia clientes(id) com ON DELETE
 * CASCADE e o índice composto (cliente_id, status, last_message_at DESC) acelera
 * a listagem padrão (sessões ativas de um cliente, mais recentes primeiro).
 *
 * Soft delete: arquivar uma sessão muda apenas `status` para 'archived' — as
 * mensagens são preservadas via FK ON DELETE CASCADE somente quando a sessão é
 * fisicamente removida (o que esta story nunca faz).
 *
 * Idempotente — usa IF NOT EXISTS em tabelas e índices.
 * Transacional — BEGIN/COMMIT com ROLLBACK em falha.
 */
import db from "../src/config/database";
import logger from "../src/utils/logger";

const migrateAgentSessions = async () => {
    const client = await db.connect();

    try {
        console.log("🔄 STORY-014 → migrando: agent_sessions + agent_messages...");
        logger.info({ event: "migration_started", migration: "agent_sessions" }, "Iniciando migração de agentes por cliente");

        await client.query("BEGIN");

        // gen_random_uuid() já habilitado por migrate_rag_knowledge (pgcrypto).
        // Garantimos novamente — idempotente — para tornar esta migration autônoma.
        await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

        // ──────────────────────────────────────────────────────────────────
        // 1. Sessões de agente — uma conversa por (cliente, usuário, tipo)
        // ──────────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS agent_sessions (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                user_id         UUID NOT NULL,
                agent_type      TEXT NOT NULL CHECK (agent_type IN ('briefing', 'creative', 'strategy')),
                title           TEXT,
                rolling_summary TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
            );
        `);
        console.log("  ✅ Tabela agent_sessions criada (ou já existia).");

        // Índice composto para a listagem padrão (cliente + status, mais recentes primeiro).
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_agent_sessions_cliente_status
                ON agent_sessions (cliente_id, status, last_message_at DESC);
        `);
        console.log("  ✅ Índice idx_agent_sessions_cliente_status criado.");

        // ──────────────────────────────────────────────────────────────────
        // 2. Mensagens das sessões — histórico completo (append-only)
        // ──────────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS agent_messages (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id          UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
                role                TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                content             TEXT NOT NULL,
                tokens_in           INT NOT NULL DEFAULT 0,
                tokens_out          INT NOT NULL DEFAULT 0,
                retrieved_chunk_ids UUID[] NOT NULL DEFAULT '{}',
                created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        console.log("  ✅ Tabela agent_messages criada (ou já existia).");

        // Índice para carregar o histórico de uma sessão em ordem cronológica.
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_agent_messages_session_created
                ON agent_messages (session_id, created_at ASC);
        `);
        console.log("  ✅ Índice idx_agent_messages_session_created criado.");

        await client.query("COMMIT");
        console.log("✅ STORY-014 migration concluída com sucesso!");
        logger.info({ event: "migration_completed", migration: "agent_sessions" }, "Migração de agentes concluída");
    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("❌ STORY-014 migration falhou:", error);
        logger.error(
            { event: "migration_failed", migration: "agent_sessions", err: error?.message },
            "Falha na migração de agentes"
        );
        process.exitCode = 1;
    } finally {
        client.release();
        await db.end();
    }
};

migrateAgentSessions();
