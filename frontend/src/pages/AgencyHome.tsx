
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
import api from '../services/api';
import ImagePreview from '../components/ImagePreview';
import { resolveAssetUrl, withCacheBust } from '../utils/assetHelpers';
import { useAuth } from '../contexts/AuthContext';
import ClientAccessModal from '../components/ClientAccessModal';

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
    const { hasPermission } = useAuth();
    const [accessModal, setAccessModal] = useState({ isOpen: false, clientId: '', clientName: '' });

    useEffect(() => {
        loadData();
    }, []);

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
