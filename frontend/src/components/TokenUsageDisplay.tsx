import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';

// ─── Gemini Model Catalog (March 2025) ─────────────────────────────────────
// Source: https://ai.google.dev/pricing  (Pay-as-you-go, text/image/video tokens)
// Audio tokens are billed differently; this table covers text/image/video.
export interface ModelConfig {
  id: string;
  label: string;
  input: number;   // USD per 1M input (prompt) tokens
  output: number;  // USD per 1M output (completion) tokens
  notes?: string;
}

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    input: 0.15,
    output: 1.25,
    notes: 'Modelo atual do projeto',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    input: 1.25,
    output: 10.00,
    notes: 'Estimativa — preço oficial pendente',
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    input: 0.075,
    output: 0.30,
  },
  {
    id: 'gemini-2.0-flash-lite',
    label: 'Gemini 2.0 Flash-Lite',
    input: 0.075,
    output: 0.30,
  },
  {
    id: 'gemini-2.0-flash-thinking',
    label: 'Gemini 2.0 Flash Thinking',
    input: 0.075,
    output: 0.30,
    notes: 'Raciocínio experimental',
  },
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    input: 0.075,
    output: 0.30,
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    input: 1.25,
    output: 5.00,
  },
  {
    id: 'gemini-1.0-pro',
    label: 'Gemini 1.0 Pro',
    input: 0.50,
    output: 1.50,
  },
];

const LS_PRICING_KEY = 'sphera_model_pricing_v2';
const LS_EXCHANGE_KEY = 'sphera_usd_brl';
const DEFAULT_USD_BRL = 5.80;

// ─── localStorage helpers ───────────────────────────────────────────────────
function loadCustomPricing(): Record<string, { input: number; output: number }> {
  try {
    const raw = localStorage.getItem(LS_PRICING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCustomPricing(m: Record<string, { input: number; output: number }>) {
  localStorage.setItem(LS_PRICING_KEY, JSON.stringify(m));
}

function loadExchangeRate(): number {
  try {
    const raw = localStorage.getItem(LS_EXCHANGE_KEY);
    const v = raw ? parseFloat(raw) : NaN;
    return isNaN(v) ? DEFAULT_USD_BRL : v;
  } catch { return DEFAULT_USD_BRL; }
}

// ─── Pricing helpers ────────────────────────────────────────────────────────
function buildEffectivePricing(
  custom: Record<string, { input: number; output: number }>
): Record<string, { input: number; output: number }> {
  const base: Record<string, { input: number; output: number }> = {};
  for (const m of DEFAULT_MODELS) base[m.id] = { input: m.input, output: m.output };
  return { ...base, ...custom };
}

function getPricing(
  modelName: string,
  pricing: Record<string, { input: number; output: number }>
): { input: number; output: number } {
  const key = Object.keys(pricing).find(k => (modelName || '').startsWith(k));
  return key ? pricing[key] : pricing['gemini-2.5-flash'] ?? { input: 0.15, output: 1.25 };
}

function calcCostUSD(
  entry: { prompt_tokens: number; completion_tokens: number; model: string },
  pricing: Record<string, { input: number; output: number }>
): number {
  const p = getPricing(entry.model, pricing);
  return (entry.prompt_tokens / 1_000_000) * p.input +
    (entry.completion_tokens / 1_000_000) * p.output;
}

function fmtBRL(value: number, digits = 4): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
}

function fmtUSD(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 5, maximumFractionDigits: 5,
  });
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface TokenUsageProps { clienteId: string; }

interface HistoryEntry {
  timestamp: string;
  action: string;
  model: string;
  system_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface TokenUsageData {
  total_tokens: number;
  prompt_tokens: number;      // sys + user
  completion_tokens: number;  // output
  system_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  last_updated: string | null;
  history: HistoryEntry[];
}

const ACTION_LABELS: Record<string, string> = {
  calendar_generation: 'Geração de Calendário',
  calendar_generation_worker: 'Geração de Calendário',
  post_regeneration: 'Regeneração de Post',
  photo_ideas_generation: 'Ideias de Fotos',
  laminas_generation: 'Geração de Lâminas',
  onboarding_chat: 'Onboarding ARIA',
  prompt_chain_step: 'Prompt Chain',
};

// ─── Sub-components ──────────────────────────────────────────────────────────
function TokenBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={`inline-flex flex-col items-center px-2 py-1 rounded text-[10px] font-mono ${color}`}>
      <span className="font-bold">{value.toLocaleString('pt-BR')}</span>
      <span className="opacity-70">{label}</span>
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function TokenUsageDisplay({ clienteId }: TokenUsageProps) {
  const [usage, setUsage] = useState<TokenUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showPricingEditor, setShowPricingEditor] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Editable state
  const [customPricing, setCustomPricing] = useState<Record<string, { input: number; output: number }>>({});
  const [usdBrl, setUsdBrl] = useState(DEFAULT_USD_BRL);
  // Draft values for the editor (string so we can type decimals freely)
  const [draftPricing, setDraftPricing] = useState<Record<string, { input: string; output: string }>>({});
  const [draftUsdBrl, setDraftUsdBrl] = useState(String(DEFAULT_USD_BRL));

  // Load persisted pricing on mount
  useEffect(() => {
    const stored = loadCustomPricing();
    setCustomPricing(stored);
    const rate = loadExchangeRate();
    setUsdBrl(rate);
    setDraftUsdBrl(String(rate));
  }, []);

  // Build effective pricing (defaults + overrides)
  const effectivePricing = useMemo(
    () => buildEffectivePricing(customPricing),
    [customPricing]
  );

  useEffect(() => { loadTokenUsage(); }, [clienteId]);

  const loadTokenUsage = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/token-usage/${clienteId}`);
      if (response.data.success) setUsage(response.data.data);
    } catch (err) {
      console.error('Erro ao carregar uso de tokens:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ── Pricing editor handlers ─────────────────────────────────────────────
  const openEditor = () => {
    const drafts: Record<string, { input: string; output: string }> = {};
    for (const m of DEFAULT_MODELS) {
      const eff = effectivePricing[m.id] ?? { input: m.input, output: m.output };
      drafts[m.id] = { input: String(eff.input), output: String(eff.output) };
    }
    setDraftPricing(drafts);
    setDraftUsdBrl(String(usdBrl));
    setShowPricingEditor(true);
  };

  const applyEditor = () => {
    const newCustom: Record<string, { input: number; output: number }> = {};
    for (const m of DEFAULT_MODELS) {
      const draft = draftPricing[m.id];
      if (!draft) continue;
      const inp = parseFloat(draft.input);
      const out = parseFloat(draft.output);
      if (!isNaN(inp) && !isNaN(out)) newCustom[m.id] = { input: inp, output: out };
    }
    const rate = parseFloat(draftUsdBrl);
    const newRate = isNaN(rate) ? DEFAULT_USD_BRL : rate;
    setCustomPricing(newCustom);
    setUsdBrl(newRate);
    saveCustomPricing(newCustom);
    localStorage.setItem(LS_EXCHANGE_KEY, String(newRate));
    setShowPricingEditor(false);
  };

  const resetDefaults = () => {
    setCustomPricing({});
    setUsdBrl(DEFAULT_USD_BRL);
    saveCustomPricing({});
    localStorage.setItem(LS_EXCHANGE_KEY, String(DEFAULT_USD_BRL));
    setShowPricingEditor(false);
  };

  // ── Derived totals ──────────────────────────────────────────────────────
  const history = usage?.history ?? [];
  const totalCostUSD = history.reduce((s, e) => s + calcCostUSD(e, effectivePricing), 0);
  const totalCostBRL = totalCostUSD * usdBrl;
  const lastAction = history.length > 0 ? history[history.length - 1] : null;

  // Aggregate prompt + completion tokens for comparison grid
  const aggTokens = useMemo(() => {
    let prompt = 0, completion = 0;
    for (const e of history) { prompt += e.prompt_tokens; completion += e.completion_tokens; }
    return { prompt, completion };
  }, [history]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-600 rounded" />
          <div className="h-4 bg-gray-600 rounded w-32" />
        </div>
      </div>
    );
  }

  if (!usage) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-xl p-4 backdrop-blur-sm space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💰</span>
          <h3 className="text-lg font-semibold text-white">Custo de IA</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openEditor}
            title="Editar preços dos modelos"
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 border border-amber-700/40 hover:border-amber-500 rounded-lg px-2 py-1 transition-colors"
          >
            ⚙️ Preços
          </button>
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 border border-violet-700/40 hover:border-violet-500 rounded-lg px-2 py-1 transition-colors"
          >
            🔬 Comparar
          </button>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showHistory ? '▼ Ocultar' : '▶ Histórico'}
            </button>
          )}
        </div>
      </div>

      {/* ── Custo total em destaque ─────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-900/40 to-green-900/30 border border-emerald-700/50 rounded-xl p-4 text-center">
        <div className="text-xs text-emerald-400 mb-1 uppercase tracking-wide font-medium">
          Custo Total Acumulado (histórico completo)
        </div>
        <div className="text-3xl font-bold text-emerald-300">{fmtBRL(totalCostBRL)}</div>
        <div className="text-xs text-gray-400 mt-1">{fmtUSD(totalCostUSD)}</div>
        <div className="text-xs text-gray-500 mt-1">
          {(usage.total_tokens ?? 0).toLocaleString('pt-BR')} tokens totais · câmbio 1 USD = R$ {usdBrl.toFixed(2)}
        </div>

        {/* Token breakdown formula */}
        <div className="mt-3 flex items-center justify-center gap-1 flex-wrap text-[11px]">
          <span className="bg-purple-900/40 text-purple-300 rounded px-2 py-0.5">
            sys {(usage.system_tokens ?? 0).toLocaleString('pt-BR')}
          </span>
          <span className="text-gray-500">+</span>
          <span className="bg-blue-900/40 text-blue-300 rounded px-2 py-0.5">
            in {(usage.input_tokens ?? usage.prompt_tokens - (usage.system_tokens ?? 0)).toLocaleString('pt-BR')}
          </span>
          <span className="text-gray-500">=</span>
          <span className="text-gray-400 font-semibold">prompt_tokens cobrados como input</span>
          <span className="text-gray-600 mx-2">·</span>
          <span className="bg-emerald-900/40 text-emerald-300 rounded px-2 py-0.5">
            out {(usage.output_tokens ?? usage.completion_tokens).toLocaleString('pt-BR')}
          </span>
          <span className="text-gray-500">=</span>
          <span className="text-gray-400 font-semibold">completion_tokens cobrados como output</span>
        </div>
      </div>

      {/* ── Última Ação ─────────────────────────────────────────────────── */}
      {lastAction && (
        <div className="bg-gray-900/30 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-400 mb-1">Última Ação</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">
                {ACTION_LABELS[lastAction.action] ?? lastAction.action}
              </div>
              <div className="text-xs text-gray-500">{lastAction.model}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-yellow-300">
                +{fmtBRL(calcCostUSD(lastAction, effectivePricing) * usdBrl)}
              </div>
              <div className="text-xs text-gray-500">
                {lastAction.total_tokens.toLocaleString('pt-BR')} tokens · {formatDate(lastAction.timestamp)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pricing Editor ──────────────────────────────────────────────── */}
      {showPricingEditor && (
        <div className="border border-amber-700/40 bg-amber-950/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-amber-300">⚙️ Editar Preços (USD por 1M tokens)</h4>
            <button
              onClick={() => setShowPricingEditor(false)}
              className="text-gray-500 hover:text-gray-300 text-xs"
            >✕ Fechar</button>
          </div>

          {/* Exchange rate */}
          <div className="flex items-center gap-2 mb-4 bg-gray-900/40 rounded-lg p-2">
            <span className="text-xs text-gray-400 shrink-0">Câmbio USD → BRL</span>
            <span className="text-xs text-gray-500">1 USD =</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={draftUsdBrl}
              onChange={e => setDraftUsdBrl(e.target.value)}
              className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white text-right focus:border-amber-500 outline-none"
            />
            <span className="text-xs text-gray-400">BRL</span>
          </div>

          {/* Model pricing table */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            <div className="grid grid-cols-3 text-[10px] text-gray-500 uppercase tracking-wide px-1 mb-1">
              <span>Modelo</span>
              <span className="text-center">Input $/1M</span>
              <span className="text-center">Output $/1M</span>
            </div>
            {DEFAULT_MODELS.map(m => (
              <div key={m.id} className="grid grid-cols-3 items-center gap-2 bg-gray-900/40 rounded-lg p-2">
                <div>
                  <div className="text-xs text-white font-medium">{m.label}</div>
                  {m.notes && <div className="text-[10px] text-gray-500">{m.notes}</div>}
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={draftPricing[m.id]?.input ?? String(m.input)}
                  onChange={e => setDraftPricing(prev => ({
                    ...prev, [m.id]: { ...prev[m.id], input: e.target.value }
                  }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white text-right focus:border-amber-500 outline-none"
                />
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={draftPricing[m.id]?.output ?? String(m.output)}
                  onChange={e => setDraftPricing(prev => ({
                    ...prev, [m.id]: { ...prev[m.id], output: e.target.value }
                  }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white text-right focus:border-amber-500 outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={applyEditor}
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg py-2 transition-colors"
            >
              ✔ Aplicar
            </button>
            <button
              onClick={resetDefaults}
              className="px-4 text-xs text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-500/50 rounded-lg py-2 transition-colors"
            >
              🔄 Restaurar padrões
            </button>
          </div>
        </div>
      )}

      {/* ── Model Comparison Grid ───────────────────────────────────────── */}
      {showComparison && (
        <div className="border border-violet-700/40 bg-violet-950/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-violet-300">🔬 Comparador de Modelos</h4>
            <span className="text-[10px] text-gray-500">
              Mesmo volume: {aggTokens.prompt.toLocaleString('pt-BR')} in + {aggTokens.completion.toLocaleString('pt-BR')} out tokens
            </span>
          </div>

          {aggTokens.prompt + aggTokens.completion === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">Nenhum token registrado ainda para comparar.</p>
          ) : (() => {
            const rows = DEFAULT_MODELS.map(m => {
              const p = effectivePricing[m.id] ?? { input: m.input, output: m.output };
              const usd = (aggTokens.prompt / 1_000_000) * p.input + (aggTokens.completion / 1_000_000) * p.output;
              const brl = usd * usdBrl;
              return { m, usd, brl };
            }).sort((a, b) => a.usd - b.usd);

            const maxUsd = rows[rows.length - 1].usd;

            return (
              <div className="space-y-1.5">
                {rows.map(({ m, usd, brl }, idx) => {
                  const isCheapest = idx === 0;
                  const isMostExpensive = usd === maxUsd && rows.length > 1;
                  const pct = maxUsd > 0 ? (usd / maxUsd) * 100 : 0;
                  return (
                    <div key={m.id} className="relative">
                      {/* Progress bar background */}
                      <div
                        className={`absolute inset-0 rounded-lg opacity-20 ${isCheapest ? 'bg-green-500' : isMostExpensive ? 'bg-red-500' : 'bg-violet-500'
                          }`}
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                      <div className="relative flex items-center justify-between rounded-lg border border-gray-700/30 px-3 py-2 bg-gray-900/20">
                        <div className="flex items-center gap-2">
                          {isCheapest && <span title="Mais barato">🟢</span>}
                          {isMostExpensive && <span title="Mais caro">🔴</span>}
                          {!isCheapest && !isMostExpensive && <span className="w-4" />}
                          <div>
                            <div className="text-xs text-white font-medium">{m.label}</div>
                            <div className="text-[10px] text-gray-500">
                              ${effectivePricing[m.id]?.input ?? m.input}/M in · ${effectivePricing[m.id]?.output ?? m.output}/M out
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${isCheapest ? 'text-green-400' : isMostExpensive ? 'text-red-400' : 'text-violet-300'}`}>
                            {fmtBRL(brl, 4)}
                          </div>
                          <div className="text-[10px] text-gray-500">{fmtUSD(usd)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="text-[10px] text-gray-600 text-center mt-2">
                  * Calculado com câmbio atual (1 USD = R$ {usdBrl.toFixed(2)}) e preços editáveis acima
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Histórico ──────────────────────────────────────────────────── */}
      {showHistory && history.length > 0 && (
        <div className="border-t border-gray-700 pt-3">
          <div className="text-xs font-semibold text-gray-400 mb-2">Histórico Recente</div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {history.slice().reverse().map((entry, idx) => {
              const sysT = entry.system_tokens ?? 0;
              const inT = entry.input_tokens ?? Math.max(0, entry.prompt_tokens - sysT);
              const outT = entry.output_tokens ?? entry.completion_tokens;
              const hasBreakdown = sysT > 0 || entry.input_tokens !== undefined;
              const entryCostBRL = calcCostUSD(entry, effectivePricing) * usdBrl;
              return (
                <div key={idx} className="bg-gray-900/30 rounded-lg p-2.5 text-xs border border-gray-700/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-gray-300 font-medium">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                    <span className="text-yellow-300 font-bold">+{fmtBRL(entryCostBRL)}</span>
                  </div>
                  {hasBreakdown ? (
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      {sysT > 0 && (
                        <TokenBadge label="sys" value={sysT} color="bg-purple-900/40 text-purple-300" />
                      )}
                      <TokenBadge label="input" value={inT} color="bg-blue-900/40 text-blue-300" />
                      <span className="text-gray-600 self-center">→ prompt cobrado como input</span>
                      <span className="text-gray-600 self-center mx-1">·</span>
                      <TokenBadge label="output" value={outT} color="bg-emerald-900/40 text-emerald-300" />
                      <span className="text-gray-600 self-center">→ completion cobrado como output</span>
                    </div>
                  ) : (
                    <div className="text-gray-500 mb-1.5">{entry.total_tokens.toLocaleString('pt-BR')} tokens (total)</div>
                  )}
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="text-gray-500">{entry.model}</span>
                    <span>{formatDate(entry.timestamp)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Info footer ─────────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-gray-700/50">
        <div className="text-[10px] text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>💡 Preços: Gemini 2.5 Flash $0,15 in / $1,25 out por 1M tokens</span>
          <span>·</span>
          <span>
            prompt_tokens = sys + user input (cobrado como input)
          </span>
          <span>·</span>
          <span>completion_tokens = output</span>
          <span>·</span>
          <span>Câmbio: 1 USD = R$ {usdBrl.toFixed(2)} (editável acima)</span>
        </div>
      </div>
    </div>
  );
}
