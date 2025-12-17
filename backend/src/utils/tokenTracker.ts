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
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Atualiza o contador de tokens para um cliente específico
 * @param clienteId - ID do cliente
 * @param usageMetadata - Metadados de uso retornados pela API do Gemini
 * @param action - Descrição da ação (ex: "calendar_generation", "post_regeneration")
 * @param model - Nome do modelo usado
 */
export async function updateTokenUsage(
  clienteId: string,
  usageMetadata: TokenUsage,
  action: string,
  model: string
): Promise<void> {
  try {
    const promptTokens = usageMetadata.promptTokenCount || 0;
    const completionTokens = usageMetadata.candidatesTokenCount || 0;
    const totalTokens = usageMetadata.totalTokenCount || 0;

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
      last_updated: null,
      history: []
    };

    // Criar entrada de histórico
    const historyEntry: TokenHistoryEntry = {
      timestamp: new Date().toISOString(),
      action,
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens
    };

    // Manter apenas os últimos 100 registros de histórico
    const history = currentUsage.history || [];
    history.push(historyEntry);
    if (history.length > 100) {
      history.shift();
    }

    // Atualizar totais
    const updatedUsage = {
      total_tokens: (currentUsage.total_tokens || 0) + totalTokens,
      prompt_tokens: (currentUsage.prompt_tokens || 0) + promptTokens,
      completion_tokens: (currentUsage.completion_tokens || 0) + completionTokens,
      last_updated: new Date().toISOString(),
      history
    };

    // Salvar no banco
    await db.query(
      "UPDATE clientes SET token_usage = $1 WHERE id = $2",
      [JSON.stringify(updatedUsage), clienteId]
    );

    console.log(`✅ [TOKEN TRACKER] Cliente ${clienteId}: +${totalTokens} tokens (Total: ${updatedUsage.total_tokens})`);
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
