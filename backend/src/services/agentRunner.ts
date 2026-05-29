/**
 * STORY-014 — agentRunner
 *
 * Orquestra uma mensagem de chat numa sessão de agente persistente:
 *
 *   1. Persiste a mensagem do usuário (agent_messages, role='user').
 *   2. Rolling summary: se a contagem de mensagens atingir um múltiplo de 20,
 *      resume as últimas 20 (+ summary anterior) e atualiza agent_sessions.
 *   3. Monta o system prompt em 3 camadas via systemPromptBuilder.
 *   4. Carrega as últimas 10 mensagens como histórico de conversa.
 *   5. Chama o Gemini (multi-turn) via geminiClient.generateChatContent().
 *   6. Persiste a resposta (agent_messages, role='assistant') com tokens.
 *   7. Atualiza last_message_at da sessão.
 *   8. Registra uso de tokens via updateTokenUsage.
 *
 * Isolamento por cliente: o clienteId é passado explicitamente e usado em todas
 * as operações de contexto (system prompt, RAG, token tracking).
 */
import db from "../config/database";
import logger from "../utils/logger";
import { geminiClient } from "../utils/geminiClient";
import { getPrimaryGeminiModel } from "../utils/googleModels";
import { updateTokenUsage } from "../utils/tokenTracker";
import { systemPromptBuilder, AgentType } from "./systemPromptBuilder";

const runnerLog = logger.child({ component: "agentRunner" });

/** A cada N mensagens, dispara a sumarização (rolling summary). */
const SUMMARY_EVERY = 20;
/** Quantas mensagens recentes enviar como histórico multi-turn ao Gemini. */
const HISTORY_WINDOW = 10;

export interface AgentMessageRow {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens_in: number;
  tokens_out: number;
  retrieved_chunk_ids: string[];
  created_at: string;
}

export interface RunMessageResult {
  userMessage: AgentMessageRow;
  assistantMessage: AgentMessageRow;
  summaryUpdated: boolean;
}

/** Conta o total de mensagens de uma sessão. */
async function countMessagesInSession(sessionId: string): Promise<number> {
  const r = await db.query(
    "SELECT COUNT(*)::int AS count FROM agent_messages WHERE session_id = $1",
    [sessionId]
  );
  return r.rows[0]?.count ?? 0;
}

/** Carrega as últimas `limit` mensagens em ordem cronológica ASC (para histórico). */
async function getRecentMessages(sessionId: string, limit: number): Promise<AgentMessageRow[]> {
  const r = await db.query(
    `SELECT * FROM (
        SELECT id, session_id, role, content, tokens_in, tokens_out,
               retrieved_chunk_ids, created_at
          FROM agent_messages
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT $2
     ) recent
     ORDER BY created_at ASC`,
    [sessionId, limit]
  );
  return r.rows as AgentMessageRow[];
}

/**
 * Gera/atualiza o rolling_summary da sessão. Sumarização é prompt único (sem
 * histórico multi-turn) → usa generateTextContent.
 */
async function maybeUpdateRollingSummary(sessionId: string, messageCount: number): Promise<boolean> {
  if (messageCount <= 0 || messageCount % SUMMARY_EVERY !== 0) return false;

  try {
    const last20 = await getRecentMessages(sessionId, SUMMARY_EVERY);

    const prevResult = await db.query(
      "SELECT rolling_summary FROM agent_sessions WHERE id = $1",
      [sessionId]
    );
    const prevSummary: string | null = prevResult.rows[0]?.rolling_summary ?? null;

    const transcript = last20.map((m) => `${m.role}: ${m.content}`).join("\n");
    const summaryInput =
      (prevSummary ? `Resumo anterior:\n${prevSummary}\n\n` : "") +
      `Mensagens recentes:\n${transcript}`;

    const summary = await geminiClient.generateTextContent(
      `Resuma os pontos-chave desta conversa em até 200 palavras, focando em decisões de marca e insights aprovados:\n\n${summaryInput}`
    );

    await db.query("UPDATE agent_sessions SET rolling_summary = $1 WHERE id = $2", [
      summary,
      sessionId,
    ]);

    runnerLog.info(
      { event: "agent_rolling_summary_updated", session_id: sessionId, message_count: messageCount },
      "Rolling summary atualizado"
    );
    return true;
  } catch (err: any) {
    // Falha na sumarização não deve derrubar a resposta do agente.
    runnerLog.warn(
      { event: "agent_rolling_summary_failed", session_id: sessionId, err: err?.message },
      "Falha ao gerar rolling summary; seguindo sem atualizar a memória"
    );
    return false;
  }
}

export const agentRunner = {
  /**
   * Processa uma mensagem do usuário numa sessão e devolve a resposta do agente.
   *
   * @param sessionId   Sessão (já validada pelo route quanto a existência/acesso)
   * @param userMessage Texto não vazio do usuário
   * @param clienteId   Cliente dono da sessão (isolamento)
   * @param agentType   Tipo de agente da sessão
   */
  async runMessage(
    sessionId: string,
    userMessage: string,
    clienteId: string,
    agentType: AgentType
  ): Promise<RunMessageResult> {
    const trimmed = String(userMessage || "").trim();
    if (!trimmed) {
      throw new Error("agentRunner.runMessage: content vazio.");
    }

    // 1) Persiste a mensagem do usuário.
    const userInsert = await db.query(
      `INSERT INTO agent_messages (session_id, role, content, tokens_in, tokens_out)
       VALUES ($1, 'user', $2, 0, 0)
       RETURNING id, session_id, role, content, tokens_in, tokens_out, retrieved_chunk_ids, created_at`,
      [sessionId, trimmed]
    );
    const userMessageRow = userInsert.rows[0] as AgentMessageRow;

    // 2) Rolling summary (antes de responder), se atingiu múltiplo de 20.
    const messageCount = await countMessagesInSession(sessionId);
    const summaryUpdated = await maybeUpdateRollingSummary(sessionId, messageCount);

    // 3) Monta o system prompt em 3 camadas (com contexto atualizado).
    const { systemInstruction, retrievedChunkIds } = await systemPromptBuilder.build(
      clienteId,
      agentType,
      sessionId,
      trimmed
    );

    // 4) Histórico de conversa: últimas HISTORY_WINDOW mensagens.
    //    A última delas é a própria mensagem do usuário recém-inserida — removemos
    //    do histórico pois ela é enviada separadamente como userMessage ao Gemini.
    const recent = await getRecentMessages(sessionId, HISTORY_WINDOW);
    const history = recent
      .filter((m) => m.id !== userMessageRow.id && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({
        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
        content: m.content,
      }));

    // 5) Chama o Gemini (multi-turn).
    const model = getPrimaryGeminiModel("quality");
    const result = await geminiClient.generateChatContent({
      systemInstruction,
      history,
      userMessage: trimmed,
    });

    const tokensIn = result.usageMetadata.promptTokenCount;
    const tokensOut = result.usageMetadata.candidatesTokenCount;

    // 6) Persiste a resposta do assistente.
    const assistantInsert = await db.query(
      `INSERT INTO agent_messages (session_id, role, content, tokens_in, tokens_out, retrieved_chunk_ids)
       VALUES ($1, 'assistant', $2, $3, $4, $5::uuid[])
       RETURNING id, session_id, role, content, tokens_in, tokens_out, retrieved_chunk_ids, created_at`,
      [sessionId, result.text, tokensIn, tokensOut, retrievedChunkIds]
    );
    const assistantMessageRow = assistantInsert.rows[0] as AgentMessageRow;

    // 7) Atualiza last_message_at da sessão.
    await db.query("UPDATE agent_sessions SET last_message_at = NOW() WHERE id = $1", [sessionId]);

    // 8) Registra uso de tokens do cliente.
    await updateTokenUsage(
      clienteId,
      {
        promptTokenCount: result.usageMetadata.promptTokenCount,
        candidatesTokenCount: result.usageMetadata.candidatesTokenCount,
        totalTokenCount: result.usageMetadata.totalTokenCount,
      },
      `agent_${agentType}`,
      model,
      systemInstruction
    );

    runnerLog.info(
      {
        event: "agent_message_processed",
        session_id: sessionId,
        cliente_id: clienteId,
        agent_type: agentType,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        retrieved_chunks: retrievedChunkIds.length,
        summary_updated: summaryUpdated,
      },
      "Mensagem de agente processada"
    );

    return {
      userMessage: userMessageRow,
      assistantMessage: assistantMessageRow,
      summaryUpdated,
    };
  },
};
