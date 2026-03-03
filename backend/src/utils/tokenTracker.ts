import db from "../config/database";

interface TokenUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface TokenHistoryEntry {
  timestamp: string;
  action: string;
  model: string;
  /** Tokens do system prompt (estimado via contagem de chars ÷ 4; 0 quando não há system instruction) */
  system_tokens: number;
  /** Tokens da mensagem do usuário = promptTokenCount - system_tokens */
  input_tokens: number;
  /** Tokens gerados pelo modelo */
  output_tokens: number;
  // Campos legados mantidos para compatibilidade com dados históricos antigos
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Estimativa rápida de tokens a partir de texto (heurística: 4 chars ≈ 1 token para PT/EN misto)
 */
function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Atualiza o contador de tokens para um cliente específico.
 * @param clienteId - ID do cliente
 * @param usageMetadata - Metadados de uso retornados pela API do Gemini
 * @param action - Descrição da ação (ex: "calendar_generation", "post_regeneration")
 * @param model - Nome do modelo usado
 * @param systemInstruction - Texto do system instruction usado (opcional, para estimar system_tokens)
 */
export async function updateTokenUsage(
  clienteId: string,
  usageMetadata: TokenUsage,
  action: string,
  model: string,
  systemInstruction?: string
): Promise<void> {
  try {
    const promptTokens     = usageMetadata.promptTokenCount    || 0;
    const completionTokens = usageMetadata.candidatesTokenCount || 0;
    const totalTokens      = usageMetadata.totalTokenCount      || 0;

    // Estimar tokens de system prompt (Gemini inclui no promptTokenCount sem separar)
    const systemTokens  = systemInstruction ? estimateTokensFromText(systemInstruction) : 0;
    const inputTokens   = Math.max(0, promptTokens - systemTokens);
    const outputTokens  = completionTokens;

    // Buscar uso atual
    const result = await db.query(
      "SELECT token_usage FROM clientes WHERE id = $1",
      [clienteId]
    );

    if (result.rows.length === 0) {
      console.warn(`⚠️ [TOKEN TRACKER] Cliente ${clienteId} não encontrado`);
      return;
    }

    const currentUsage = result.rows[0].token_usage || {
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      system_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      last_updated: null,
      history: []
    };

    // Criar entrada de histórico
    const historyEntry: TokenHistoryEntry = {
      timestamp:         new Date().toISOString(),
      action,
      model,
      system_tokens:     systemTokens,
      input_tokens:      inputTokens,
      output_tokens:     outputTokens,
      // legados (= valores Gemini brutos, para exibição de custo)
      prompt_tokens:     promptTokens,
      completion_tokens: completionTokens,
      total_tokens:      totalTokens,
    };

    // Manter apenas os últimos 100 registros de histórico
    const history = currentUsage.history || [];
    history.push(historyEntry);
    if (history.length > 100) {
      history.shift();
    }

    // Atualizar totais
    const updatedUsage = {
      total_tokens:      (currentUsage.total_tokens      || 0) + totalTokens,
      prompt_tokens:     (currentUsage.prompt_tokens     || 0) + promptTokens,
      completion_tokens: (currentUsage.completion_tokens || 0) + completionTokens,
      system_tokens:     (currentUsage.system_tokens     || 0) + systemTokens,
      input_tokens:      (currentUsage.input_tokens      || 0) + inputTokens,
      output_tokens:     (currentUsage.output_tokens     || 0) + outputTokens,
      last_updated:      new Date().toISOString(),
      history
    };

    // Salvar no banco
    await db.query(
      "UPDATE clientes SET token_usage = $1 WHERE id = $2",
      [JSON.stringify(updatedUsage), clienteId]
    );

    console.log(`✅ [TOKEN TRACKER] Cliente ${clienteId}: +${totalTokens} tokens (sys:${systemTokens} input:${inputTokens} out:${outputTokens}) Total: ${updatedUsage.total_tokens}`);
  } catch (error) {
    console.error("❌ [TOKEN TRACKER] Erro ao atualizar tokens:", error);
  }
}

/**
 * Obtém o uso de tokens de um cliente
 * @param clienteId - ID do cliente
 * @returns Objeto com informações de uso de tokens
 */
export async function getTokenUsage(clienteId: string): Promise<any> {
  try {
    const result = await db.query(
      "SELECT token_usage FROM clientes WHERE id = $1",
      [clienteId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].token_usage || {
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      last_updated: null,
      history: []
    };
  } catch (error) {
    console.error("❌ [TOKEN TRACKER] Erro ao buscar tokens:", error);
    return null;
  }
}

/**
 * Reseta o contador de tokens de um cliente (útil para início de novo período/mês)
 * @param clienteId - ID do cliente
 */
export async function resetTokenUsage(clienteId: string): Promise<void> {
  try {
    const resetUsage = {
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      system_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      last_updated: new Date().toISOString(),
      history: []
    };

    await db.query(
      "UPDATE clientes SET token_usage = $1 WHERE id = $2",
      [JSON.stringify(resetUsage), clienteId]
    );

    console.log(`🔄 [TOKEN TRACKER] Contador resetado para cliente ${clienteId}`);
  } catch (error) {
    console.error("❌ [TOKEN TRACKER] Erro ao resetar tokens:", error);
  }
}
