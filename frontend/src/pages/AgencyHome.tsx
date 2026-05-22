
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Users,
    ArrowRight,
    Plus,
    Zap,
    Clock,
    CheckCircle,
    Calendar,
    Trash2,
    ShieldAlert,
} from 'lucide-react';
import api, {
    jobsService,
    agencyService,
    AgencyDashboardResponse,
    AgencyTokenUsageSummary,
} from '../services/api';
import ImagePreview from '../components/ImagePreview';
import { resolveAssetUrl, withCacheBust } from '../utils/assetHelpers';
import { useAuth } from '../contexts/AuthContext';
import ClientAccessModal from '../components/ClientAccessModal';
import { AlertCircle } from 'lucide-react';

interface Cliente {
    id: string;
    nome: string;
    status: string;
    avatarUrl: string | null;
    criado_em: string;
}

interface LastClientData extends Cliente {
    calendarStatus?: {
        label: string;
        color: string;
        pendingCount: number;
    };
    activeJob?: {
        id: string;
        status: string;
        progress: number;
        step: string;
    };
}

export default function AgencyHome() {
    const navigate = useNavigate();
    const [clients, setClients] = useState<Cliente[]>([]);
    const [lastClient, setLastClient] = useState<LastClientData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { hasPermission, logout } = useAuth();
    const [accessModal, setAccessModal] = useState({ isOpen: false, clientId: '', clientName: '' });
    // STORY-012 AC6 — alerta global de taxa de erro de jobs nas últimas 2h.
    const [errorRate, setErrorRate] = useState<{
        failed: number;
        total: number;
        ratio: number;
        should_alert: boolean;
    } | null>(null);
    const [showFailures, setShowFailures] = useState(false);
    const [recentFailures, setRecentFailures] = useState<any[]>([]);

    // STORY-011 — dashboard operacional da agência (APP/CAM, posts, risco, tokens).
    const [dashboard, setDashboard] = useState<AgencyDashboardResponse | null>(null);
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState(false);
    const [tokenSort, setTokenSort] = useState<{
        field: 'tokens' | 'cost';
        dir: 'asc' | 'desc';
    }>({ field: 'tokens', dir: 'desc' });

    useEffect(() => {
        loadData();
        loadErrorRate();
        loadDashboard();
        // Re-checa taxa de erro a cada 60s para não martelar o backend.
        const id = setInterval(loadErrorRate, 60000);
        return () => clearInterval(id);
    }, []);

    const loadDashboard = async () => {
        setDashboardLoading(true);
        setDashboardError(false);
        try {
            const data = await agencyService.getDashboard();
            setDashboard(data);
        } catch (e) {
            setDashboardError(true);
            setDashboard(null);
        } finally {
            setDashboardLoading(false);
        }
    };

    const loadErrorRate = async () => {
        try {
            const data = await jobsService.getErrorRate(2);
            setErrorRate({
                failed: data.failed,
                total: data.total,
                ratio: data.ratio,
                should_alert: data.should_alert,
            });
            setRecentFailures(data.recent_failures || []);
        } catch (e) {
            // Endpoint pode não estar disponível em ambientes legados — silencioso.
            setErrorRate(null);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);

            // 1. Carregar Clientes
            const resClients = await api.get('/clients');
            const clientsList = resClients.data.clientes || [];
            setClients(clientsList);

            // 2. Tentar recuperar Last Client
            const lastClientId = localStorage.getItem('lastClientId');
            if (lastClientId) {
                const found = clientsList.find((c: Cliente) => c.id === lastClientId);

                if (found) {
                    let calendarInfo = null;
                    let activeJobInfo = null;

                    // Fetch Calendar Info
                    try {
                        const resCal = await api.get(`/calendars/${lastClientId}`);
                        const posts = resCal.data.calendar?.posts || [];
                        const pending = posts.filter((p: any) => p.status !== 'aprovado' && p.status !== 'publicado').length;

                        if (pending > 0) {
                            calendarInfo = {
                                label: `${pending} posts pendentes de aprovação`,
                                color: 'text-yellow-400',
                                pendingCount: pending
                            };
                        } else {
                            calendarInfo = {
                                label: 'Planejamento em dia',
                                color: 'text-green-400',
                                pendingCount: 0
                            };
                        }
                    } catch (e) {
                        // ignore
                    }

                    // Fetch Active Jobs
                    try {
                        const resJobs = await api.get(`/jobs/${lastClientId}`);
                        const jobs = resJobs.data.jobs || [];
                        // Find running job (pending or processing)
                        const running = jobs.find((j: any) => j.status === 'pending' || j.status === 'processing');

                        if (running) {
                            activeJobInfo = {
                                id: running.id,
                                status: running.status,
                                progress: running.progress || 0,
                                step: running.current_step || 'Iniciando...'
                            };
                        }
                    } catch (e) {
                        // ignore
                    }

                    setLastClient({
                        ...found,
                        calendarStatus: calendarInfo || undefined,
                        activeJob: activeJobInfo || undefined
                    });

                } else {
                    // Se não estava na lista (ex: lista paginada ou excluído), tenta fetch individual
                    try {
                        const resSingle = await api.get(`/clients/${lastClientId}`);
                        if (resSingle.data.cliente) {
                            setLastClient(resSingle.data.cliente);
                        }
                    } catch (e) {
                        console.warn('Last client not found or deleted');
                        localStorage.removeItem('lastClientId');
                    }
                }
            }

        } catch (error) {
            console.error('Erro ao carregar dados da Agency Home:', error);
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (nome: string) => {
        return nome
            .split(' ')
            .map((word) => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    const filteredClients = clients.filter(c =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ─── STORY-011 helpers ────────────────────────────────────────────────────
    const APP_CAM_TARGET = 25;

    const formatBrl = (cents: number) =>
        (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Cor do APP/CAM: verde >=25, amarelo 15-24.9, vermelho <15.
    const appCamColor = (value: number) => {
        if (value >= 25) return { bar: 'bg-green-500', text: 'text-green-400' };
        if (value >= 15) return { bar: 'bg-yellow-500', text: 'text-yellow-400' };
        return { bar: 'bg-red-500', text: 'text-red-400' };
    };

    // Maior número de posts publicados (para escala das mini-barras de progresso).
    const maxPublished = Math.max(
        1,
        ...(dashboard?.clients_summary.map((c) => c.posts_published_month) ?? [0])
    );

    // Total de custo de IA no mês (centavos), agregado de todos os clientes.
    const totalCostCents =
        dashboard?.token_usage_summary.reduce((acc, t) => acc + t.cost_cents_month, 0) ?? 0;

    const totalApprovedMonth =
        dashboard?.clients_summary.reduce((acc, c) => acc + c.posts_approved_month, 0) ?? 0;

    const activeClientsCount =
        dashboard?.clients_summary.filter((c) => c.posts_published_month > 0).length ?? 0;

    // Ordenação client-side da tabela de tokens (sem nova chamada à API — AC4).
    const sortedTokenUsage: AgencyTokenUsageSummary[] = [...(dashboard?.token_usage_summary ?? [])].sort(
        (a, b) => {
            const av = tokenSort.field === 'tokens' ? a.tokens_used_month : a.cost_cents_month;
            const bv = tokenSort.field === 'tokens' ? b.tokens_used_month : b.cost_cents_month;
            return tokenSort.dir === 'asc' ? av - bv : bv - av;
        }
    );

    const toggleTokenSort = (field: 'tokens' | 'cost') => {
        setTokenSort((prev) =>
            prev.field === field
                ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { field, dir: 'desc' }
        );
    };

    const appCam = dashboard?.app_cam_current ?? 0;
    const appCamPct = Math.min(100, (appCam / APP_CAM_TARGET) * 100);
    const appCamColors = appCamColor(appCam);

    const handleDeleteClient = async (e: React.MouseEvent, clientId: string, clientName: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(`Excluir "${clientName}"? Isso remove calendários, branding e todos os dados vinculados.`)) return;
        try {
            await api.delete(`/clients/${clientId}`);
            await loadData();
        } catch (error: any) {
            alert('Erro ao excluir: ' + (error.response?.data?.error || error.message));
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 md:p-12 font-sans">
            <div className="max-w-6xl mx-auto space-y-12">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight mb-2">
                            Sphera <span className="text-blue-500">Brand</span>
                        </h1>
                        <p className="text-gray-400">Central de Operações e Estratégia</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={logout}
                            className="bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 border border-gray-700"
                        >
                            🚪 Sair
                        </button>
                        {hasPermission('team_manage') && (
                            <button
                                onClick={() => navigate('/team')}
                                className="bg-purple-900/30 hover:bg-purple-800/40 text-purple-400 px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 border border-purple-500/20"
                            >
                                <ShieldAlert className="w-4 h-4" />
                                Gestão de Equipe
                            </button>
                        )}
                        <button
                            onClick={() => navigate('/clients')}
                            className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 border border-gray-700"
                        >
                            <Users className="w-4 h-4" />
                            Gerenciar Clientes
                        </button>
                    </div>
                </div>

                {/* STORY-012 AC6 — Banner de alerta quando taxa de erro > 5% nas últimas 2h */}
                {errorRate?.should_alert && (
                    <div className="bg-yellow-900/30 border border-yellow-500/40 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm text-yellow-100 font-medium">
                                {errorRate.failed} {errorRate.failed === 1 ? 'job' : 'jobs'} com erro nas últimas 2h
                                <span className="text-yellow-300/70 font-normal ml-2">
                                    (taxa de falha: {(errorRate.ratio * 100).toFixed(1)}%)
                                </span>
                            </p>
                            <button
                                onClick={() => setShowFailures(!showFailures)}
                                className="text-xs text-yellow-300 hover:text-yellow-200 underline mt-1"
                            >
                                {showFailures ? 'Ocultar detalhes' : 'Ver detalhes'}
                            </button>
                            {showFailures && recentFailures.length > 0 && (
                                <div className="mt-3 bg-gray-900/60 rounded-lg p-3 max-h-64 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="text-gray-400">
                                            <tr>
                                                <th className="text-left py-1 pr-2">Cliente</th>
                                                <th className="text-left py-1 pr-2">Tipo</th>
                                                <th className="text-left py-1 pr-2">Erro</th>
                                                <th className="text-left py-1">Quando</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-300">
                                            {recentFailures.map((f) => (
                                                <tr key={f.job_id} className="border-t border-gray-800">
                                                    <td className="py-1 pr-2 truncate max-w-[140px]">{f.client_name || '—'}</td>
                                                    <td className="py-1 pr-2">{f.job_type}</td>
                                                    <td className="py-1 pr-2 truncate max-w-[260px]" title={f.last_error || ''}>
                                                        {f.last_error || 'sem detalhes'}
                                                    </td>
                                                    <td className="py-1 text-gray-500">
                                                        {new Date(f.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* STORY-011 — Dashboard Operacional */}
                <section className="space-y-6">
                    {dashboardError ? (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-8 text-center">
                            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                            <p className="text-gray-200 mb-4">
                                Não foi possível carregar o dashboard. Tente novamente.
                            </p>
                            <button
                                onClick={loadDashboard}
                                className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    ) : dashboardLoading ? (
                        <>
                            {/* Skeleton: card APP/CAM + KPIs + seções */}
                            <div className="animate-pulse bg-gray-800 rounded-2xl h-32 w-full" />
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="animate-pulse bg-gray-800 rounded-xl h-24 w-full" />
                                ))}
                            </div>
                            <div className="animate-pulse bg-gray-800 rounded-2xl h-40 w-full" />
                            <div className="animate-pulse bg-gray-800 rounded-2xl h-48 w-full" />
                        </>
                    ) : dashboard ? (
                        <>
                            {/* AC1 — Card APP/CAM */}
                            <div className="bg-gradient-to-br from-gray-800 to-gray-800/40 rounded-2xl p-6 border border-gray-700">
                                <div className="flex items-baseline justify-between mb-3">
                                    <div>
                                        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                            📊 APP/CAM
                                        </h2>
                                        <p className="text-xs text-gray-500">
                                            Posts aprovados publicados por cliente este mês
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-4xl font-bold ${appCamColors.text}`}>
                                            {appCam.toFixed(1)}
                                        </span>
                                        <span className="text-gray-500 text-lg"> / {APP_CAM_TARGET} APP/CAM</span>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-700 h-3 rounded-full overflow-hidden">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-500 ${appCamColors.bar}`}
                                        style={{ width: `${appCamPct}%` }}
                                    />
                                </div>
                            </div>

                            {/* KPI cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                                    <p className="text-3xl font-bold text-white">{activeClientsCount}</p>
                                    <p className="text-xs text-gray-400 mt-1">Clientes ativos</p>
                                </div>
                                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                                    <p className="text-3xl font-bold text-white">{totalApprovedMonth}</p>
                                    <p className="text-xs text-gray-400 mt-1">Posts aprovados</p>
                                </div>
                                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                                    <p className="text-3xl font-bold text-white">{formatBrl(totalCostCents)}</p>
                                    <p className="text-xs text-gray-400 mt-1">Custo IA</p>
                                </div>
                                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                                    <p className={`text-3xl font-bold ${dashboard.clients_at_risk.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {dashboard.clients_at_risk.length}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">Em risco</p>
                                </div>
                            </div>

                            {/* AC3 — Clientes em risco */}
                            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-400" /> Clientes em Risco
                                    {dashboard.clients_at_risk.length > 0 && (
                                        <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">
                                            {dashboard.clients_at_risk.length}
                                        </span>
                                    )}
                                </h2>
                                {dashboard.clients_at_risk.length === 0 ? (
                                    <p className="text-sm text-green-400 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" /> Todos os clientes estão em dia
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {dashboard.clients_at_risk.map((c) => (
                                            <button
                                                key={c.client_id}
                                                onClick={() => navigate(`/client/${c.client_id}`)}
                                                className="w-full flex items-center justify-between bg-red-900/15 hover:bg-red-900/25 border border-red-500/20 rounded-lg px-4 py-3 transition-colors text-left"
                                            >
                                                <span className="font-medium text-gray-200">{c.client_name}</span>
                                                <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full">
                                                    {c.days_since_last_approved === null
                                                        ? 'nunca teve post aprovado'
                                                        : `há ${c.days_since_last_approved} dias`}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* AC2 — Clientes este mês (lista com mini-barras) */}
                            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">
                                    Clientes Este Mês
                                </h2>
                                {dashboard.clients_summary.length === 0 ? (
                                    <p className="text-sm text-gray-500">Nenhum cliente cadastrado.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {[...dashboard.clients_summary]
                                            .sort((a, b) => b.posts_published_month - a.posts_published_month)
                                            .map((c) => (
                                                <div key={c.client_id} className="flex items-center gap-4">
                                                    <button
                                                        onClick={() => navigate(`/client/${c.client_id}`)}
                                                        className="w-40 text-left text-sm font-medium text-gray-200 hover:text-blue-400 transition-colors truncate"
                                                        title={c.client_name}
                                                    >
                                                        {c.client_name}
                                                    </button>
                                                    <div className="flex-1 bg-gray-700 h-2 rounded-full overflow-hidden">
                                                        <div
                                                            className="bg-blue-500 h-2 rounded-full transition-all"
                                                            style={{
                                                                width: `${(c.posts_published_month / maxPublished) * 100}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-400 w-32 text-right">
                                                        {c.posts_approved_month} aprov · {c.posts_published_month} publ
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* AC4 — Consumo de tokens (tabela ordenável client-side) */}
                            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">
                                    Consumo de Tokens
                                </h2>
                                {sortedTokenUsage.length === 0 ? (
                                    <p className="text-sm text-gray-500">Sem consumo de tokens este mês.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="text-gray-400 border-b border-gray-700">
                                                <tr>
                                                    <th className="text-left py-2 pr-4 font-medium">Cliente</th>
                                                    <th
                                                        className="text-right py-2 px-4 font-medium cursor-pointer select-none hover:text-white"
                                                        onClick={() => toggleTokenSort('tokens')}
                                                    >
                                                        Tokens{' '}
                                                        {tokenSort.field === 'tokens'
                                                            ? tokenSort.dir === 'asc'
                                                                ? '▲'
                                                                : '▼'
                                                            : ''}
                                                    </th>
                                                    <th
                                                        className="text-right py-2 pl-4 font-medium cursor-pointer select-none hover:text-white"
                                                        onClick={() => toggleTokenSort('cost')}
                                                    >
                                                        Custo{' '}
                                                        {tokenSort.field === 'cost'
                                                            ? tokenSort.dir === 'asc'
                                                                ? '▲'
                                                                : '▼'
                                                            : ''}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-gray-200">
                                                {sortedTokenUsage.map((t) => (
                                                    <tr key={t.client_id} className="border-b border-gray-800/60">
                                                        <td className="py-2 pr-4 truncate max-w-[200px]">{t.client_name}</td>
                                                        <td className="py-2 px-4 text-right tabular-nums">
                                                            {t.tokens_used_month.toLocaleString('pt-BR')}
                                                        </td>
                                                        <td className="py-2 pl-4 text-right tabular-nums">
                                                            {formatBrl(t.cost_cents_month)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : null}
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Coluna Principal (Esquerda) */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* 1. Continue de onde parou */}
                        {lastClient && (
                            <section className="bg-gradient-to-br from-blue-900/40 to-gray-800/40 rounded-2xl p-6 border border-blue-500/20 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Zap className="w-32 h-32 text-blue-400" />
                                </div>

                                <div className="relative z-10">
                                    <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Clock className="w-4 h-4" /> Continuar de onde parou
                                    </h2>

                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-900/50">
                                            {lastClient.avatarUrl ? (
                                                <ImagePreview
                                                    src={withCacheBust(resolveAssetUrl(lastClient.avatarUrl))}
                                                    alt={lastClient.nome}
                                                    className="w-full h-full object-cover rounded-xl"
                                                    fallback={<span>{getInitials(lastClient.nome)}</span>}
                                                />
                                            ) : (
                                                <span>{getInitials(lastClient.nome)}</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-2xl font-bold text-white">{lastClient.nome}</h3>

                                            {/* Exibir atividade principal: Job ou Calendario */}
                                            {lastClient.activeJob ? (
                                                <div className="mt-2 text-sm text-blue-300 flex items-center gap-2 animate-pulse">
                                                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                                    Geração em andamento: {lastClient.activeJob.progress}%
                                                </div>
                                            ) : (
                                                lastClient.calendarStatus && (
                                                    <p className={`text-sm mt-1 flex items-center gap-2 ${lastClient.calendarStatus.color}`}>
                                                        <span className="w-2 h-2 rounded-full bg-current"></span>
                                                        {lastClient.calendarStatus.label}
                                                    </p>
                                                )
                                            )}
                                        </div>
                                        <button
                                            onClick={() => navigate(`/client/${lastClient.id}`)}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 group-hover:translate-x-1"
                                        >
                                            Acessar Hub <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* 2. Seleção Rápida de Clientes */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-gray-400" /> Clientes Recentes
                                </h2>
                                <input
                                    type="text"
                                    placeholder="Buscar cliente..."
                                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm w-48 focus:border-blue-500 focus:outline-none transition-colors"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {loading ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse"></div>)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {filteredClients.slice(0, 6).map(client => (
                                        <Link
                                            key={client.id}
                                            to={`/client/${client.id}`}
                                            className="relative bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 p-4 rounded-xl transition-all group flex flex-col gap-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center text-xs font-bold text-gray-300">
                                                    {client.avatarUrl ? (
                                                        <ImagePreview
                                                            src={withCacheBust(resolveAssetUrl(client.avatarUrl))}
                                                            alt={client.nome}
                                                            className="w-full h-full object-cover rounded-lg"
                                                            fallback={<span>{getInitials(client.nome)}</span>}
                                                        />
                                                    ) : (
                                                        <span>{getInitials(client.nome)}</span>
                                                    )}
                                                </div>
                                                <span className="text-gray-500 group-hover:text-blue-400 transition-colors">
                                                    <ArrowRight className="w-4 h-4" />
                                                </span>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-200 truncate">{client.nome}</h4>
                                                <p className="text-xs text-gray-500">Ativo</p>
                                            </div>
                                            {/* Botões Admin/Gerente — aparecem ao hover */}
                                            {hasPermission('clients_manage') && (
                                                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setAccessModal({ isOpen: true, clientId: client.id, clientName: client.nome });
                                                        }}
                                                        className="p-1.5 rounded-md text-gray-500 hover:text-blue-400 hover:bg-blue-500/10"
                                                        title="Gerenciar acessos"
                                                    >
                                                        <ShieldAlert className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteClient(e, client.id, client.nome)}
                                                        className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                                                        title="Excluir cliente"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </Link>
                                    ))}
                                    <button
                                        onClick={() => navigate('/clients')}
                                        className="bg-gray-800/50 hover:bg-gray-800 border-2 border-dashed border-gray-700 hover:border-gray-600 p-4 rounded-xl transition-all flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-300 h-full"
                                    >
                                        <Plus className="w-6 h-6" />
                                        <span className="text-sm font-medium">Ver Todos</span>
                                    </button>
                                </div>
                            )}
                        </section>

                    </div>

                    {/* Coluna Lateral (Direita) */}
                    <div className="space-y-8">

                        {/* 3. Ações Rápidas */}
                        <section className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Ações Rápidas</h2>
                            <div className="space-y-3">
                                {hasPermission('content_generate') && (
                                    <button
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                        onClick={() => navigate('/clients')}
                                    >
                                        <Plus className="w-4 h-4" /> Nova Campanha
                                    </button>
                                )}
                                <button
                                    className="w-full bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                    onClick={() => navigate('/calendar')}
                                >
                                    <Calendar className="w-4 h-4" /> Calendário Geral
                                </button>
                            </div>
                        </section>

                        {/* 4. Jobs / Status */}
                        <section>
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" /> Status Geral
                            </h2>
                            <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700 overflow-hidden">
                                {loading ? (
                                    <div className="p-4 text-center text-gray-500 text-sm">Carregando...</div>
                                ) : (
                                    <>
                                        {lastClient ? (
                                            <div className="p-4 hover:bg-gray-750 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-semibold text-sm">{lastClient.nome}</h4>
                                                    <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">RECENTE</span>
                                                </div>

                                                {/* Status do Job Ativo ou Calendário */}
                                                {lastClient.activeJob ? (
                                                    <div className="mb-1">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-xs text-blue-300 font-bold flex items-center gap-1">
                                                                <Zap className="w-3 h-3" /> JOB EM EXECUÇÃO
                                                            </span>
                                                            <span className="text-xs text-blue-300">{lastClient.activeJob.progress}%</span>
                                                        </div>
                                                        <div className="w-full bg-gray-700 h-1 rounded-full mb-1">
                                                            <div className="bg-blue-500 h-1 rounded-full transition-all duration-500" style={{ width: `${lastClient.activeJob.progress || 5}%` }}></div>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 truncate">{lastClient.activeJob.step || 'Processando...'}</p>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-400 mb-1">
                                                        {lastClient.calendarStatus?.label || 'Sem status recente'}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="p-4 text-center text-gray-500 text-sm">
                                                Nenhuma atividade recente.
                                            </div>
                                        )}
                                        <div className="p-3 bg-gray-800/50 text-center">
                                            <Link to="/clients" className="text-xs text-gray-500 hover:text-white transition-colors">
                                                Ver todos os status
                                            </Link>
                                        </div>
                                    </>
                                )}
                            </div>
                        </section>

                        {/* 5. Dica / Insight */}
                        <div className="bg-gradient-to-br from-purple-900/20 to-gray-800 rounded-xl p-5 border border-purple-500/20">
                            <div className="flex items-start gap-3">
                                <div className="bg-purple-500/20 p-2 rounded-lg text-purple-400">
                                    <Zap className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-purple-200 mb-1">Dica Pro</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Use o <strong>Client Hub</strong> para ter uma visão unificada de todas as campanhas e métricas de um cliente específico.
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
            <ClientAccessModal
                isOpen={accessModal.isOpen}
                clientId={accessModal.clientId}
                clientName={accessModal.clientName}
                onClose={() => setAccessModal({ isOpen: false, clientId: '', clientName: '' })}
            />
        </div>
    );
}
