import { useState, useEffect } from 'react';
import api from '../services/api';

interface TokenUsageProps {
  clienteId: string;
}

interface TokenUsageData {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  last_updated: string | null;
  history: Array<{
    timestamp: string;
    action: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }>;
}

export default function TokenUsageDisplay({ clienteId }: TokenUsageProps) {
  const [usage, setUsage] = useState<TokenUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadTokenUsage();
  }, [clienteId]);

  const loadTokenUsage = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/token-usage/${clienteId}`);
      if (response.data.success) {
        setUsage(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar uso de tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('pt-BR');
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'calendar_generation': 'Geração de Calendário',
      'post_regeneration': 'Regeneração de Post',
      'photo_ideas_generation': 'Ideias de Fotos'
    };
    return labels[action] || action;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-600 rounded"></div>
          <div className="h-4 bg-gray-600 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (!usage) {
    return null;
  }

  const lastAction = usage.history && usage.history.length > 0 
    ? usage.history[usage.history.length - 1] 
    : null;

  return (
    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-xl p-4 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <h3 className="text-lg font-semibold text-white">Uso de Tokens (métrica)</h3>
        </div>
        {usage.history && usage.history.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showHistory ? '▼ Ocultar' : '▶ Ver Histórico'}
          </button>
        )}
      </div>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Total</div>
          <div className="text-xl font-bold text-white">{formatNumber(usage.total_tokens)}</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Prompt</div>
          <div className="text-lg font-semibold text-blue-400">{formatNumber(usage.prompt_tokens)}</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Resposta</div>
          <div className="text-lg font-semibold text-green-400">{formatNumber(usage.completion_tokens)}</div>
        </div>
      </div>

      {/* Última Ação */}
      {lastAction && (
        <div className="bg-gray-900/30 rounded-lg p-3 border border-gray-700/50 mb-3">
          <div className="text-xs text-gray-400 mb-1">Última Ação</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">{getActionLabel(lastAction.action)}</div>
              <div className="text-xs text-gray-500">{lastAction.model}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-yellow-400">+{formatNumber(lastAction.total_tokens)}</div>
              <div className="text-xs text-gray-500">{formatDate(lastAction.timestamp)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Histórico */}
      {showHistory && usage.history && usage.history.length > 0 && (
        <div className="border-t border-gray-700 pt-3 mt-3">
          <div className="text-xs font-semibold text-gray-400 mb-2">Histórico Recente</div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {usage.history.slice().reverse().map((entry, index) => (
              <div
                key={index}
                className="bg-gray-900/30 rounded p-2 text-xs border border-gray-700/30"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-300 font-medium">{getActionLabel(entry.action)}</span>
                  <span className="text-yellow-400 font-bold">+{formatNumber(entry.total_tokens)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>{entry.model}</span>
                  <span>{formatDate(entry.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-3 pt-3 border-t border-gray-700/50">
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <span>💡</span>
          <span>Indicador informativo de consumo em funcionalidades com IA</span>
        </div>
      </div>
    </div>
  );
}
