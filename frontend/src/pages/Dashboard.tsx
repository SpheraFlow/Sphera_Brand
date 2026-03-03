import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { dashboardMetricsService, DashboardMetrics } from '../services/api';
import TokenUsageDisplay from '../components/TokenUsageDisplay';

interface ClientInfo {
  id: string;
  nome: string;
  criado_em: string;
}

const RANGE_LABELS: Record<string, string> = {
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  'mtd': 'Mês atual',
};

export default function Dashboard() {
  const { clientId } = useParams<{ clientId: string }>();

  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'30d' | '90d' | 'mtd'>('30d');

  const load = useCallback(async (id: string, r: '30d' | '90d' | 'mtd') => {
    setLoading(true);
    try {
      const clientRes = await api.get(`/clients/${id}`);
      setClientInfo(clientRes.data.cliente as ClientInfo);
    } catch { /* ignore */ }

    try {
      const m = await dashboardMetricsService.getMetrics(id, r);
      setMetrics(m);
      setMetricsError(null);
    } catch (err) {
      console.warn('Métricas não disponíveis:', err);
      setMetricsError('Não foi possível carregar as métricas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId) load(clientId, range);
  }, [clientId, range, load]);

  // Recarregar ao voltar para esta aba (usuário aprovou posts em outro painel)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && clientId) {
        load(clientId, range);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [clientId, range, load]);

  // Recarregar imediatamente quando CalendarPage sinaliza aprovação/reprovação (cross-tab)
  useEffect(() => {
    if (!clientId) return;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('sphera_metrics');
      bc.onmessage = (e: MessageEvent) => {
        if (e.data?.clientId === clientId) {
          console.log('[Dashboard] refetch por aprovação no CalendarPage — atualizando métricas...');
          load(clientId, range);
        }
      };
    } catch { /* BroadcastChannel não disponível no ambiente */ }
    return () => { bc?.close(); };
  }, [clientId, range, load]);

  const clientName = clientInfo?.nome || 'Cliente';

  // Helpers
  const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

  const approvalColor = (r: number | null) => {
    if (r === null) return 'text-gray-400';
    if (r >= 0.7) return 'text-green-400';
    if (r >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  const revisionColor = (r: number) => {
    if (r <= 1) return 'text-green-400';
    if (r <= 2) return 'text-yellow-400';
    return 'text-red-400';
  };

  const cadenciaLabel = (): { text: string; color: string } => {
    if (!metrics) return { text: '—', color: 'text-gray-400' };
    if (metrics.calendars_count >= 1) return { text: 'Ativa', color: 'text-green-400' };
    const last = metrics.usage.last_activity_at;
    if (!last) return { text: 'Inativa', color: 'text-red-400' };
    const daysAgo = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 30) return { text: 'Irregular', color: 'text-yellow-400' };
    return { text: 'Inativa', color: 'text-red-400' };
  };

  const churnColor = (label: string) => {
    if (label === 'Alto') return 'bg-red-500/20 text-red-300 border-red-500/50';
    if (label === 'Médio') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
    return 'bg-green-500/20 text-green-300 border-green-500/50';
  };

  const churnIcon = (label: string) => {
    if (label === 'Alto') return '🔴';
    if (label === 'Médio') return '🟡';
    return '🟢';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-sm font-semibold">
                {clientName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
              </span>
              Dashboard de Performance
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {clientName} · {RANGE_LABELS[range]}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Range selector */}
            {(['30d', '90d', 'mtd'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${range === r
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                  }`}
              >
                {r === '30d' ? '30 dias' : r === '90d' ? '90 dias' : 'Este mês'}
              </button>
            ))}
            <button
              onClick={() => clientId && load(clientId, range)}
              disabled={loading}
              title="Atualizar métricas"
              className="ml-1 p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-40 transition-colors"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <Link
              to={`/client/${clientId}`}
              className="ml-1 text-xs text-blue-400 hover:text-blue-300"
            >
              ← Visão Geral
            </Link>
          </div>
        </div>

        {/* ── Error banner ────────────────────────────────── */}
        {metricsError && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl px-4 py-3 text-sm text-red-300">
            ⚠️ {metricsError}
          </div>
        )}

        {/* ── ROI Hero Card ───────────────────────────────── */}
        <div className="bg-gradient-to-br from-blue-900/40 via-indigo-900/30 to-violet-900/30 border border-blue-500/30 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Icon + label */}
            <div className="flex items-center gap-3 md:w-48 shrink-0">
              <div className="w-12 h-12 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-2xl">
                🚀
              </div>
              <div>
                <div className="text-xs text-blue-300 uppercase tracking-widest font-semibold">
                  ROI da IA
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                  {RANGE_LABELS[range]}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-black text-white leading-none">
                  {loading ? '—' : `${metrics?.time_saved_hours ?? 0}h`}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">Horas economizadas</div>
                <div className="text-[10px] text-blue-400 mt-0.5">
                  {metrics ? `${metrics.posts_count} posts × 5 min` : ''}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-emerald-300 leading-none">
                  {loading ? '—' : fmtBRL(metrics?.time_saved_brl_estimate ?? 0)}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">Equivalente em R$</div>
                <div className="text-[10px] text-gray-500 mt-0.5">R$2.750/mês ÷ 172h (21,5d × 8h) = R$16/h</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-black leading-none ${(metrics?.roi_ratio ?? 0) >= 5 ? 'text-green-400' : (metrics?.roi_ratio ?? 0) >= 2 ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {loading ? '—' : `${metrics?.roi_ratio ?? 0}×`}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">ROI estimado</div>
                <div className="text-[10px] text-gray-500 mt-0.5">economizado ÷ gasto IA</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-red-300 leading-none">
                  {loading ? '—' : fmtBRL(metrics?.llm_cost_brl_total ?? 0)}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">Custo IA total</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {metrics ? `${metrics.calendars_count} calendário(s)` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI Grid 3 colunas ──────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* 1 — Tokens & Custo IA */}
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-4">
              <span>💰</span> Tokens & Custo IA
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Custo total</span>
                <span className="font-semibold text-gray-100">
                  {loading ? '—' : fmtBRL(metrics?.llm_cost_brl_total ?? 0)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Custo/calendário</span>
                <span className="font-semibold text-gray-100">
                  {loading ? '—' : fmtBRL(metrics?.llm_cost_brl_avg_per_calendar ?? 0)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Custo/post aprovado</span>
                <span className="font-semibold text-gray-100">
                  {loading ? '—' : fmtBRL(metrics?.cost_per_approved_post_brl ?? 0)}
                </span>
              </div>
              <div className="border-t border-gray-700 pt-3 flex justify-between items-center text-sm">
                <span className="text-gray-400">Posts gerados</span>
                <span className="font-semibold text-blue-300">
                  {loading ? '—' : metrics?.posts_count ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Calendários</span>
                <span className="font-semibold text-blue-300">
                  {loading ? '—' : metrics?.calendars_count ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* 2 — Qualidade Editorial */}
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-4">
              <span>📊</span> Qualidade Editorial
            </h2>
            {loading ? (
              <p className="text-sm text-gray-500">Carregando...</p>
            ) : metricsError && !metrics ? (
              <p className="text-sm text-gray-500">{metricsError}</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Taxa de aprovação</span>
                  <span className={`font-bold text-base ${approvalColor(metrics?.approval_rate ?? null)}`}>
                    {metrics?.approval_rate !== null && metrics?.approval_rate !== undefined
                      ? `${Math.round(metrics.approval_rate * 100)}%`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Revisões/post</span>
                  <span className={`font-bold ${revisionColor(metrics?.avg_revisions_per_item ?? 0)}`}>
                    {(metrics?.avg_revisions_per_item ?? 0).toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Tempo médio aprovação</span>
                  <span className="font-semibold text-gray-100">
                    {metrics && metrics.avg_time_to_approval_minutes > 0
                      ? `${Math.round(metrics.avg_time_to_approval_minutes)}m`
                      : '—'}
                  </span>
                </div>
                <div className="border-t border-gray-700 pt-3 flex justify-between items-center text-sm">
                  <span className="text-gray-400">Publicação</span>
                  <span className="font-semibold text-gray-100">
                    {metrics?.planned_vs_published.published_rate !== null &&
                      metrics?.planned_vs_published.published_rate !== undefined
                      ? `${Math.round(metrics.planned_vs_published.published_rate * 100)}% (${metrics.planned_vs_published.published}/${metrics.planned_vs_published.planned})`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Posts aprovados</span>
                  <span className="font-semibold text-green-300">
                    {metrics?.usage.approvals ?? 0}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3 — Cadência de Produção */}
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-4">
              <span>🗓️</span> Cadência de Produção
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Frequência</span>
                {loading ? (
                  <span className="text-gray-400">—</span>
                ) : (
                  <span className={`font-bold ${cadenciaLabel().color}`}>
                    {cadenciaLabel().text}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Gerações</span>
                <span className="font-semibold text-gray-100">
                  {loading ? '—' : metrics?.calendars_count ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Posts planejados</span>
                <span className="font-semibold text-gray-100">
                  {loading ? '—' : metrics?.planned_vs_published.planned ?? 0}
                </span>
              </div>
              <div className="border-t border-gray-700 pt-3 flex justify-between items-center text-sm">
                <span className="text-gray-400">Falhas de geração</span>
                <span className={`font-semibold ${(metrics?.failures.total ?? 0) > 0 ? 'text-red-400' : 'text-gray-100'}`}>
                  {loading ? '—' : metrics?.failures.total ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Última geração</span>
                <span className="font-semibold text-gray-100 text-xs">
                  {loading
                    ? '—'
                    : metrics?.usage.last_activity_at
                      ? new Date(metrics.usage.last_activity_at).toLocaleDateString('pt-BR')
                      : 'Nunca'}
                </span>
              </div>
            </div>

            {/* Falhas detalhadas */}
            {metrics && metrics.failures.total > 0 && (
              <div className="mt-4 bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                <div className="text-xs text-red-400 font-semibold">
                  ⚠️ {metrics.failures.total} falha(s) no período
                </div>
                {metrics.failures.invalid_output_count > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    {metrics.failures.invalid_output_count}× schema inválido (IA)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Saúde do Relacionamento (full width) ─────────────────── */}
        <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-4">
            <span>❤️</span> Saúde do Relacionamento
          </h2>

          {loading ? (
            <div className="text-sm text-gray-500">Carregando...</div>
          ) : metricsError && !metrics ? (
            <div className="text-sm text-gray-500">⚠️ {metricsError}</div>
          ) : metrics ? (
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              {/* Churn badge */}
              <div className="flex items-center gap-4 shrink-0">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black border-4 ${metrics.churn_risk.label === 'Baixo'
                    ? 'border-green-500 text-green-400 bg-green-900/20'
                    : metrics.churn_risk.label === 'Médio'
                      ? 'border-yellow-500 text-yellow-400 bg-yellow-900/20'
                      : 'border-red-500 text-red-400 bg-red-900/20'
                  }`}>
                  {metrics.churn_risk.score}
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${churnColor(metrics.churn_risk.label)}`}>
                    {churnIcon(metrics.churn_risk.label)} Risco {metrics.churn_risk.label}
                  </span>
                  <div className="text-[11px] text-gray-500 mt-1">Score {metrics.churn_risk.score}/4</div>
                </div>
              </div>

              {/* Reasons */}
              <div className="flex-1">
                {metrics.churn_risk.reasons.length > 0 ? (
                  <ul className="space-y-1.5">
                    {metrics.churn_risk.reasons.map((r, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-orange-400 mt-0.5">▸</span> {r}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">Nenhum fator de risco detectado. Cliente saudável! 🎉</p>
                )}
              </div>

              {/* Last activity */}
              <div className="text-right shrink-0">
                <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Última atividade</div>
                <div className="text-sm font-semibold text-gray-300">
                  {metrics.usage.last_activity_at
                    ? new Date(metrics.usage.last_activity_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'Sem registro'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">—</div>
          )}
        </div>

        {/* ── TokenUsageDisplay (histórico detalhado) ───────── */}
        <TokenUsageDisplay clienteId={clientId || ''} />

      </div>
    </div>
  );
}
