
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Zap,
    Rocket,
    Calendar,
    Clock,
    Package,
    AlertTriangle,
    CheckCircle,
    XCircle,
    FileText,
    TrendingUp,
    Activity,
    DollarSign,
    ThumbsUp
} from 'lucide-react';
import api, { brandingService, jobsService, presentationService, dashboardMetricsService, calendarItemsService, DashboardMetrics } from '../services/api';

interface CalendarPost {
    data: string;
    tema: string;
    formato: string;
    objetivo?: string;
}

interface CalendarOverview {
    hasCalendar: boolean;
    mesLabel: string;
    totalPosts: number;
    statusLabel: string;
    statusColorClass: string;
    nextPosts: CalendarPost[];
    nextDeadlineLabel: string;
}

export default function ClientHub() {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Data States
    const [readiness, setReadiness] = useState<any>(null);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [months, setMonths] = useState<string[]>([]);
    const [jobs, setJobs] = useState<any[]>([]);
    const [clientName, setClientName] = useState('');
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [metricsError, setMetricsError] = useState<string | null>(null);
    const [calendarOverview, setCalendarOverview] = useState<CalendarOverview | null>(null);

    useEffect(() => {
        if (clientId) {
            loadDashboard();
        }
    }, [clientId]);

    const loadDashboard = async () => {
        if (!clientId) return;

        setLoading(true);
        try {
            // 1. Client Info (Name)
            try {
                const clientRes = await api.get(`/clients/${clientId}`);
                setClientName(clientRes.data.cliente?.nome || 'Cliente');
            } catch (e) {
                console.error('Erro ao carregar cliente', e);
            }

            // 2. Readiness (Calculado via Branding)
            try {
                const branding = await brandingService.getBranding(clientId);
                calculateReadiness(branding);
            } catch (e: any) {
                // Se 404, score é 0
                calculateReadiness(null);
            }

            // 3. Campanhas (Presentation History)
            try {
                const history = await presentationService.getHistory(clientId);
                setCampaigns(history.slice(0, 5)); // Top 5
            } catch (e) {
                console.error('Erro ao carregar campanhas', e);
            }

            // 4. Calendários Disponíveis
            try {
                const m = await presentationService.getAvailableMonths(clientId);
                setMonths(m);
            } catch (e) {
                console.error('Erro ao carregar meses', e);
            }

            // 5. Jobs Recentes
            try {
                const j = await jobsService.getJobs(clientId);
                setJobs(j.slice(0, 3)); // Top 3
            } catch (e) {
                console.error('Erro ao carregar jobs', e);
            }

            // 7. Calendário atual (visão geral) — carregado antes das métricas para semear os calendar_items
            // includeDrafts=true garante que calendários em rascunho também sejam semeados
            let calendarIdForSeed: string | null = null;
            try {
                const calRes = await api.get(`/calendars/${clientId}?includeDrafts=true`);
                const calendar = calRes.data.calendar;
                calendarIdForSeed = calendar?.id || null;
                const posts: CalendarPost[] = (calendar?.posts || []).map((p: any) => ({
                    data: p.data || '',
                    tema: p.tema || '',
                    formato: p.formato || '',
                    objetivo: p.objetivo,
                }));

                const today = new Date();
                const parseDate = (dataStr: string): Date | null => {
                    if (!dataStr) return null;
                    const [dStr, mStr] = dataStr.split('/');
                    const d = parseInt(dStr, 10);
                    const m = parseInt(mStr, 10);
                    if (isNaN(d) || isNaN(m)) return null;
                    return new Date(today.getFullYear(), m - 1, d);
                };

                const futuros = posts
                    .map((p) => ({ ...p, _date: parseDate(p.data) }))
                    .filter((p): p is typeof p & { _date: Date } => p._date instanceof Date && !isNaN(p._date.getTime()) && p._date >= today)
                    .sort((a, b) => a._date.getTime() - b._date.getTime());

                let statusLabel = '⏳ Em andamento';
                let statusColorClass = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
                if (!posts.length) {
                    statusLabel = '❌ Não gerado';
                    statusColorClass = 'bg-red-500/20 text-red-300 border-red-500/50';
                } else if (futuros.length === 0) {
                    statusLabel = '✅ Concluído';
                    statusColorClass = 'bg-green-500/20 text-green-300 border-green-500/50';
                }

                let nextDeadlineLabel = 'Sem posts futuros';
                if (futuros.length > 0) {
                    const diffDays = Math.ceil((futuros[0]._date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    nextDeadlineLabel = diffDays <= 0 ? 'Próximo post hoje' : `Próximo post em ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
                }

                setCalendarOverview({
                    hasCalendar: !!calendar,
                    mesLabel: calendar?.mes || 'Sem mês definido',
                    totalPosts: posts.length,
                    statusLabel,
                    statusColorClass,
                    nextPosts: futuros.slice(0, 4).map(({ _date: _, ...p }) => p),
                    nextDeadlineLabel,
                });
            } catch (e: any) {
                if (e?.response?.status === 404) {
                    setCalendarOverview({
                        hasCalendar: false,
                        mesLabel: 'Nenhum calendário gerado',
                        totalPosts: 0,
                        statusLabel: '❌ Não gerado',
                        statusColorClass: 'bg-red-500/20 text-red-300 border-red-500/50',
                        nextPosts: [],
                        nextDeadlineLabel: '',
                    });
                }
            }

            // 6. Seed calendar_items (idempotente) para que as métricas reflitam a realidade
            if (calendarIdForSeed) {
                try {
                    await calendarItemsService.seedItems(calendarIdForSeed);
                } catch {
                    // não-crítico: a tabela pode não existir até a migração rodar
                }
            }

            // Métricas do Dashboard — carregadas após o seed para refletir os itens reais
            try {
                const m = await dashboardMetricsService.getMetrics(clientId, '30d');
                setMetrics(m);
                setMetricsError(null);
            } catch (e) {
                console.error('Erro ao carregar métricas', e);
                setMetricsError('Não foi possível carregar as métricas.');
            }

        } catch (error) {
            console.error('Erro geral no dashboard', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateReadiness = (branding: any) => {
        let score = 0;
        const warnings: string[] = [];

        if (!branding) {
            setReadiness({ score: 0, warnings: ['DNA da marca não configurado'] });
            return;
        }

        // Critérios simples para MVP
        if (branding.visual_style?.colors?.length > 0) score += 20;
        else warnings.push('Paleta de cores ausente');

        if (branding.tone_of_voice?.description) score += 20;
        else warnings.push('Tom de voz não definido');

        if (branding.audience?.persona) score += 20;
        else warnings.push('Persona não definida');

        if (branding.archetype) score += 20;
        else warnings.push('Arquétipo não identificado');

        if (branding.keywords?.length > 0) score += 20;
        else warnings.push('Palavras-chave ausentes');

        setReadiness({ score, warnings: warnings.slice(0, 3) }); // Top 3 warnings
    };

    const getJobStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
            case 'succeeded': return <CheckCircle className="w-4 h-4 text-green-400" />;
            case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
            case 'canceled': return <XCircle className="w-4 h-4 text-gray-400" />;
            default: return <Clock className="w-4 h-4 text-blue-400 animate-pulse" />; // pending/running
        }
    };

    const statusMap: Record<string, string> = {
        'completed': 'Concluído',
        'succeeded': 'Concluído',
        'failed': 'Falhou',
        'canceled': 'Cancelado',
        'pending': 'Pendente',
        'running': 'Em Andamento',
        'processing': 'Processando'
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-400">Carregando dashboard...</div>;
    }

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto text-white space-y-8">

            {/* Banner de Onboarding — aparece somente quando não há DNA */}
            {readiness?.score === 0 && (
                <div className="bg-gradient-to-r from-violet-900/60 to-blue-900/60 border border-violet-600/50 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-5">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-2xl font-bold flex-shrink-0 shadow-lg">
                        A
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-white">DNA da Marca não configurado</h2>
                        <p className="text-sm text-gray-300 mt-1">
                            Converse com a <strong>ARIA</strong>, nossa IA especialista em branding, e ela vai extrair o DNA completo desta marca em minutos — sem formulários longos.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(`/client/${clientId}/onboarding`)}
                        className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm rounded-xl transition-colors whitespace-nowrap flex-shrink-0"
                    >
                        ✨ Iniciar Onboarding com ARIA
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Visão Geral</h1>
                    <p className="text-gray-400">Hub central de {clientName}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate(`/client/${clientId}/campaigns/new`)}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                    >
                        <Rocket className="w-4 h-4" /> Nova Campanha
                    </button>
                </div>
            </div>

            {/* Grid Principal */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* 1. Readiness Score */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Zap className="w-5 h-5 text-yellow-400" /> Brand Readiness
                            </h3>
                            <span className={`text-2xl font-bold ${(readiness?.score || 0) >= 80 ? 'text-green-400' :
                                (readiness?.score || 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                {readiness?.score || 0}%
                            </span>
                        </div>

                        {readiness?.warnings?.length > 0 ? (
                            <ul className="space-y-2 mb-4">
                                {readiness.warnings.map((w: string, i: number) => (
                                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                                        {w}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-400 mb-4">Sua marca está bem definida!</p>
                        )}
                    </div>

                    {readiness?.score === 0 ? (
                        <button
                            onClick={() => navigate(`/client/${clientId}/onboarding`)}
                            className="w-full py-2 bg-violet-700 hover:bg-violet-600 rounded-lg text-sm font-bold transition-colors"
                        >
                            ✨ Configurar com ARIA
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate(`/client/${clientId}/branding`)}
                            className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                        >
                            Revisar Branding
                        </button>
                    )}
                </div>

                {/* 2. Jobs Recentes */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5 text-blue-400" /> Jobs Recentes
                        </h3>

                        {jobs.length > 0 ? (
                            <div className="space-y-3 mb-4">
                                {jobs.map(job => (
                                    <div key={job.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded-lg">
                                        <div>
                                            <div className="text-xs text-gray-400">
                                                {new Date(job.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="text-sm font-medium">
                                                Geração de Calendário
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold">
                                                {statusMap[job.status] || job.status}
                                            </span>
                                            {getJobStatusIcon(job.status)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 mb-4">Nenhum job recente.</p>
                        )}
                    </div>

                    <button
                        onClick={() => navigate(`/client/${clientId}/jobs`)}
                        className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                    >
                        Ver Todos os Jobs
                    </button>
                </div>

                {/* 3. Calendários Publicados */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                            <Calendar className="w-5 h-5 text-green-400" /> Calendários
                        </h3>

                        {months.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {months.slice(0, 6).map(m => (
                                    <span key={m} className="px-3 py-1 bg-green-900/30 text-green-300 border border-green-500/30 rounded-full text-xs font-medium">
                                        {m}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 mb-4">Nenhum calendário publicado.</p>
                        )}
                    </div>

                    <button
                        onClick={() => navigate(`/client/${clientId}/calendar`)}
                        className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                    >
                        Abrir Calendário
                    </button>
                </div>

                {/* 4. Campanhas (Lâminas) */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 lg:col-span-2 flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-purple-400" /> Campanhas e Apresentações
                        </h3>

                        {campaigns.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-xs text-gray-500 border-b border-gray-700">
                                            <th className="pb-2">Título</th>
                                            <th className="pb-2">Data</th>
                                            <th className="pb-2">Arquivos</th>
                                            <th className="pb-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {campaigns.map((c: any) => (
                                            <tr key={c.id} className="border-b border-gray-700 last:border-0 hover:bg-gray-700/30 transition-colors">
                                                <td className="py-3 font-medium">{c.titulo || 'Sem título'}</td>
                                                <td className="py-3 text-gray-400">
                                                    {new Date(c.criado_em).toLocaleDateString()}
                                                </td>
                                                <td className="py-3">
                                                    <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                                                        {Array.isArray(c.arquivos) ? c.arquivos.length : 0} lâminas
                                                    </span>
                                                </td>
                                                <td className="py-3 text-right">
                                                    <button className="text-blue-400 hover:text-blue-300 text-xs font-bold">
                                                        Ver Detalhes
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-gray-500">
                                Nenhuma campanha gerada ainda.
                            </div>
                        )}
                    </div>
                </div>

                {/* 4b. Qualidade (approval + revisões + tempo) */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex flex-col gap-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <ThumbsUp className="w-5 h-5 text-green-400" /> Qualidade (últimos 30d)
                    </h3>

                    {metricsError && !metrics ? (
                        <p className="text-sm text-gray-500">{metricsError}</p>
                    ) : !metrics ? (
                        <p className="text-sm text-gray-500">Carregando métricas...</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-700/40 rounded-lg p-3 text-center">
                                    <div className={`text-2xl font-bold ${metrics.approval_rate === null ? 'text-gray-500' :
                                        (metrics.approval_rate >= 0.7 ? 'text-green-400' :
                                            metrics.approval_rate >= 0.4 ? 'text-yellow-400' : 'text-red-400')}`}>
                                        {metrics.approval_rate !== null ? `${Math.round(metrics.approval_rate * 100)}%` : '—'}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">Aprovação</div>
                                </div>
                                <div className="bg-gray-700/40 rounded-lg p-3 text-center">
                                    <div className={`text-2xl font-bold ${metrics.avg_revisions_per_item <= 1 ? 'text-green-400' :
                                        metrics.avg_revisions_per_item <= 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {metrics.avg_revisions_per_item.toFixed(1)}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">Revisões/item</div>
                                </div>
                                <div className="bg-gray-700/40 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-blue-400">
                                        {metrics.avg_time_to_approval_minutes > 0
                                            ? `${Math.round(metrics.avg_time_to_approval_minutes)}m`
                                            : '—'}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">Tempo aprovação</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-700/40 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Activity className="w-4 h-4 text-purple-400" />
                                        <span className="text-xs text-gray-400">Planejado vs Publicado</span>
                                    </div>
                                    <div className="text-sm font-bold">
                                        {metrics.planned_vs_published.published}
                                        <span className="text-gray-500 font-normal"> / {metrics.planned_vs_published.planned}</span>
                                    </div>
                                    {metrics.planned_vs_published.published_rate !== null && (
                                        <div className="text-xs text-gray-400">
                                            {Math.round(metrics.planned_vs_published.published_rate * 100)}% publicados
                                        </div>
                                    )}
                                </div>
                                <div className="bg-gray-700/40 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <DollarSign className="w-4 h-4 text-yellow-400" />
                                        <span className="text-xs text-gray-400">Custo IA</span>
                                    </div>
                                    <div className="text-sm font-bold">
                                        R$ {metrics.llm_cost_brl_total.toFixed(2)}
                                    </div>
                                    {metrics.cost_per_approved_post_brl > 0 && (
                                        <div className="text-xs text-gray-400">
                                            R$ {metrics.cost_per_approved_post_brl.toFixed(2)}/post aprovado
                                        </div>
                                    )}
                                </div>
                            </div>

                            {metrics.failures.total > 0 && (
                                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                                    <div className="text-xs text-red-400 font-semibold mb-1">
                                        ⚠️ {metrics.failures.total} falha(s) de geração
                                    </div>
                                    {metrics.failures.invalid_output_count > 0 && (
                                        <div className="text-xs text-gray-400">
                                            {metrics.failures.invalid_output_count}× INVALID_CALENDAR_OUTPUT
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 4c. Saúde do Cliente (Churn Risk) */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex flex-col gap-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-orange-400" /> Saúde do Cliente
                    </h3>

                    {metricsError && !metrics ? (
                        <p className="text-sm text-gray-500">{metricsError}</p>
                    ) : !metrics ? (
                        <p className="text-sm text-gray-500">Carregando métricas...</p>
                    ) : (
                        <>
                            <div className="flex items-center gap-4">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black border-4 flex-shrink-0 ${metrics.churn_risk.label === 'Baixo' ? 'border-green-500 text-green-400 bg-green-900/20' :
                                    metrics.churn_risk.label === 'Médio' ? 'border-yellow-500 text-yellow-400 bg-yellow-900/20' :
                                        'border-red-500 text-red-400 bg-red-900/20'}`}>
                                    {metrics.churn_risk.score}
                                </div>
                                <div>
                                    <div className={`text-lg font-bold ${metrics.churn_risk.label === 'Baixo' ? 'text-green-400' :
                                        metrics.churn_risk.label === 'Médio' ? 'text-yellow-400' : 'text-red-400'}`}>
                                        Risco {metrics.churn_risk.label}
                                    </div>
                                    <div className="text-xs text-gray-400">de churn (0–4)</div>
                                </div>
                            </div>

                            {metrics.churn_risk.reasons.length > 0 ? (
                                <ul className="space-y-1">
                                    {metrics.churn_risk.reasons.map((r, i) => (
                                        <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                                            <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
                                            {r}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-gray-500">Nenhum fator de risco detectado.</p>
                            )}

                            <div className="text-xs text-gray-500 border-t border-gray-700 pt-2">
                                {metrics.usage.last_activity_at
                                    ? `Última atividade: ${new Date(metrics.usage.last_activity_at).toLocaleDateString('pt-BR')}`
                                    : 'Sem atividade registrada'}
                            </div>
                        </>
                    )}
                </div>

                {/* 5. Entregas (Placeholder) */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Package className="w-24 h-24" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                            <Package className="w-5 h-5 text-orange-400" /> Entregas
                        </h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Acompanhe o status das entregas de materiais finais para o cliente.
                        </p>

                        <div className="bg-gray-700/30 rounded-lg p-3 text-center border border-dashed border-gray-600">
                            <span className="text-xs text-gray-500">Nenhuma entrega pendente</span>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate(`/client/${clientId}/deliveries`)}
                        className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors mt-4"
                    >
                        Gerenciar Entregas
                    </button>
                </div>

            </div>

            {/* ── Calendário em Andamento ─────────────────────────────────── */}
            {calendarOverview && (
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-blue-400" />
                            <div>
                                <h3 className="text-base font-bold">Calendário em Andamento</h3>
                                <p className="text-xs text-gray-400">
                                    {calendarOverview.mesLabel} · {calendarOverview.totalPosts} posts
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border ${calendarOverview.statusColorClass}`}>
                                {calendarOverview.statusLabel}
                            </span>
                            <button
                                onClick={() => navigate(`/client/${clientId}/calendar`)}
                                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                            >
                                Ver completo →
                            </button>
                        </div>
                    </div>

                    {/* Corpo */}
                    {calendarOverview.nextPosts.length > 0 ? (
                        <div className="p-6">
                            {calendarOverview.nextDeadlineLabel && (
                                <p className="text-xs text-blue-300 font-medium mb-3">
                                    📌 {calendarOverview.nextDeadlineLabel}
                                </p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {calendarOverview.nextPosts.map((post, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-gray-700/40 rounded-lg p-3 border border-gray-600/50 hover:border-blue-500/40 transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-blue-300">{post.data}</span>
                                            <span className="text-[10px] px-2 py-0.5 bg-gray-600 rounded-full text-gray-300">
                                                {post.formato}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-100 line-clamp-2 leading-snug">
                                            {post.tema}
                                        </p>
                                        {post.objetivo && (
                                            <p className="text-[10px] text-gray-400 mt-1.5 line-clamp-1">
                                                {post.objetivo}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : calendarOverview.hasCalendar ? (
                        <div className="px-6 py-8 text-center text-sm text-gray-500">
                            ✅ Todos os posts do calendário atual já passaram. Hora de gerar o próximo!
                        </div>
                    ) : (
                        <div className="px-6 py-8 text-center">
                            <p className="text-sm text-gray-500 mb-4">Nenhum calendário gerado ainda para este cliente.</p>
                            <button
                                onClick={() => navigate(`/client/${clientId}/calendar`)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors"
                            >
                                📅 Gerar Calendário
                            </button>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
