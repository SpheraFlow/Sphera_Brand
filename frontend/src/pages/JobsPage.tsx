
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    Clock,
    CheckCircle,
    XCircle,
    AlertOctagon,
    Loader2,
    RefreshCw,
    Search,
    RotateCcw,
    Trash2
} from 'lucide-react';
import { useJobsList } from '../hooks/useJobsList';
import JobProgressModal from '../components/Jobs/JobProgressModal';
import { jobsService, apiOrigin } from '../services/api';

interface Job {
    id: string;
    status: 'pending' | 'running' | 'processing' | 'succeeded' | 'completed' | 'failed' | 'canceled';
    progress: number;
    created_at: string;
    payload?: any;
}

export default function JobsPage() {
    const { clientId } = useParams<{ clientId: string }>();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionLoading, setActionLoading] = useState<Record<string, string>>({});

    const handleRetry = async (jobId: string) => {
        setActionLoading(prev => ({ ...prev, [jobId]: 'retry' }));
        try {
            await jobsService.retryJob(clientId!, jobId);
            refresh();
        } catch (e) {
            console.error('Erro ao fazer retry:', e);
        } finally {
            setActionLoading(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        }
    };

    const handleDelete = async (jobId: string) => {
        if (!confirm('Excluir este job permanentemente?')) return;
        setActionLoading(prev => ({ ...prev, [jobId]: 'delete' }));
        try {
            await jobsService.deleteJob(clientId!, jobId);
            refresh();
        } catch (e) {
            console.error('Erro ao excluir job:', e);
        } finally {
            setActionLoading(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        }
    };

    // Usando o hook robusto para evitar loops e garantir refresh
    const { jobs: rawJobs, loading, refresh } = useJobsList({
        clientId,
        refreshIntervalMs: 10000, // Refresh a cada 10s (opcional)
        enabled: !!clientId
    });

    const jobs = (rawJobs as Job[]) || [];

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'succeeded': return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'failed': return <XCircle className="w-5 h-5 text-red-400" />;
            case 'canceled': return <AlertOctagon className="w-5 h-5 text-gray-400" />;
            case 'processing': return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
            default: return <Clock className="w-5 h-5 text-gray-500" />;
        }
    };

    const getJobTypeLabel = (job: Job) => {
        const type = job.payload?.jobType || 'calendar';
        const map: Record<string, string> = {
            calendar: '📅 Calendário',
            presentation: '🎞️ Lâminas',
            excel: '📊 Excel',
        };
        return map[type] || '⚙️ Tarefa';
    };

    const getStatusLabel = (status: string) => {
        const map: Record<string, string> = {
            completed: 'Concluído',
            succeeded: 'Concluído',
            failed: 'Falhou',
            canceled: 'Cancelado',
            processing: 'Em Andamento',
            pending: 'Na Fila'
        };
        return map[status] || status;
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto text-white space-y-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Central de Jobs</h1>
                    <p className="text-gray-400">Acompanhe o processamento de tarefas em segundo plano</p>
                </div>
                <button
                    onClick={() => refresh()}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 border border-gray-700"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            {/* Tabela de Jobs */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar jobs..."
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {loading && jobs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Carregando jobs...</div>
                ) : jobs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Nenhum job encontrado.</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs text-gray-500 border-b border-gray-700 bg-gray-800/80">
                                <th className="p-4 font-medium">ID / Tipo</th>
                                <th className="p-4 font-medium">Data</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium">Progresso</th>
                                <th className="p-4 font-medium text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-700">
                            {jobs.map((job) => (
                                <tr key={job.id} className="hover:bg-gray-700/30 transition-colors">
                                    <td className="p-4">
                                        <div className="font-mono text-xs text-gray-400 mb-1">{job.id.substring(0, 8)}...</div>
                                        <div className="font-medium text-white">{getJobTypeLabel(job)}</div>
                                    </td>
                                    <td className="p-4 text-gray-300">
                                        {new Date(job.created_at).toLocaleString()}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(job.status)}
                                            <span className={`text-xs font-semibold ${job.status === 'completed' ? 'text-green-400' :
                                                job.status === 'failed' ? 'text-red-400' :
                                                    job.status === 'processing' ? 'text-blue-400' :
                                                        'text-gray-400'
                                                }`}>
                                                {getStatusLabel(job.status)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="w-32 bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                                                    }`}
                                                style={{ width: `${job.progress}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs text-gray-500 mt-1 block">{job.progress}%</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {(job.status === 'succeeded' || job.status === 'completed') &&
                                              job.payload?.jobType === 'excel' &&
                                              job.payload?.result?.downloadUrl && (
                                                <a
                                                    href={`${apiOrigin}${job.payload.result.downloadUrl}`}
                                                    download={job.payload?.result?.fileName || 'calendario.xlsx'}
                                                    className="p-1.5 rounded bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 transition-colors text-xs font-medium"
                                                    title="Baixar Excel"
                                                >
                                                    📥
                                                </a>
                                            )}
                                            <button
                                                className="text-blue-400 hover:text-blue-300 font-medium text-xs hover:underline"
                                                onClick={() => setSelectedJobId(job.id)}
                                            >
                                                Ver Detalhes
                                            </button>
                                            {(job.status === 'failed' || job.status === 'canceled') && (
                                                <button
                                                    title="Tentar novamente"
                                                    disabled={!!actionLoading[job.id]}
                                                    onClick={() => handleRetry(job.id)}
                                                    className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                                                >
                                                    {actionLoading[job.id] === 'retry'
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <RotateCcw className="w-3.5 h-3.5" />}
                                                </button>
                                            )}
                                            {(job.status === 'failed' || job.status === 'canceled' || job.status === 'succeeded' || job.status === 'completed') && (
                                                <button
                                                    title="Excluir job"
                                                    disabled={!!actionLoading[job.id]}
                                                    onClick={() => handleDelete(job.id)}
                                                    className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                                                >
                                                    {actionLoading[job.id] === 'delete'
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <Trash2 className="w-3.5 h-3.5" />}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal Reutilizável */}
            {selectedJobId && (
                <JobProgressModal
                    clientId={clientId!}
                    jobId={selectedJobId}
                    isOpen={!!selectedJobId}
                    onClose={() => {
                        setSelectedJobId(null);
                        refresh(); // Recarrega lista ao fechar
                    }}
                />
            )}

        </div>
    );
}
