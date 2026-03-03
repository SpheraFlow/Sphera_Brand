
import { useState, useEffect, useRef } from 'react';
import {
    X,
    Loader2,
    CheckCircle,
    AlertTriangle,
    Clock,
    ArrowRight,
    Minimize2
} from 'lucide-react';
import { jobsService } from '../../services/api';
import { useNavigate } from 'react-router-dom';

interface JobProgressModalProps {
    clientId: string;
    jobId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (result: any) => void;
}

export default function JobProgressModal({
    clientId,
    jobId,
    isOpen,
    onClose,
    onSuccess
}: JobProgressModalProps) {
    const navigate = useNavigate();
    const [status, setStatus] = useState<any>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isOpen && jobId) {
            startPolling();
        } else {
            stopPolling();
        }
        return () => stopPolling();
    }, [isOpen, jobId]);

    const startPolling = () => {
        stopPolling();
        fetchStatus();
        pollingRef.current = setInterval(fetchStatus, 2000); // 2s polling
    };

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    const fetchStatus = async () => {
        try {
            const info = await jobsService.getJobStatus(clientId, jobId);
            setStatus(info);

            if (info.status === 'completed' || info.status === 'succeeded') {
                stopPolling();
                if (onSuccess) onSuccess(info);
            } else if (info.status === 'failed' || info.status === 'canceled') {
                stopPolling();
            }

        } catch (error) {
            console.error('Erro ao buscar status do job:', error);
        }
    };

    const handleCancel = async () => {
        if (!confirm('Tem certeza que deseja cancelar este processo?')) return;
        try {
            await jobsService.cancelJob(clientId, jobId);
            fetchStatus();
        } catch (error) {
            console.error('Erro ao cancelar:', error);
        }
    };

    if (!isOpen) return null;

    // Mini-player mode (quando minimizado)
    if (isMinimized) {
        return (
            <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4">
                <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 flex items-center gap-4 w-80">
                    <div className="relative">
                        {status?.status === 'running' || status?.status === 'pending' ? (
                            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                        ) : status?.status === 'completed' || status?.status === 'succeeded' ? (
                            <CheckCircle className="w-6 h-6 text-green-400" />
                        ) : (
                            <AlertTriangle className="w-6 h-6 text-red-400" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">Geração de Calendário</h4>
                        <div className="w-full bg-gray-700 h-1.5 rounded-full mt-2">
                            <div
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${status?.progress || 0}%` }}
                            ></div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsMinimized(false)}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400"
                    >
                        <ArrowRight className="w-4 h-4 -rotate-45" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">

                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        {(status?.status === 'processing' || status?.status === 'running') ? (
                            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                        ) : (status?.status === 'completed' || status?.status === 'succeeded') ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                            <Clock className="w-5 h-5 text-gray-400" />
                        )}
                        Status do Processo
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                        >
                            <Minimize2 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 text-center">

                    {/* Status Icon Large */}
                    <div className="mb-6 flex justify-center">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${(status?.status === 'completed' || status?.status === 'succeeded') ? 'border-green-500/20 bg-green-500/10 text-green-400' :
                            status?.status === 'failed' ? 'border-red-500/20 bg-red-500/10 text-red-400' :
                                'border-blue-500/20 bg-blue-500/10 text-blue-400'
                            }`}>
                            {(status?.status === 'completed' || status?.status === 'succeeded') ? (
                                <CheckCircle className="w-10 h-10" />
                            ) : status?.status === 'failed' ? (
                                <AlertTriangle className="w-10 h-10" />
                            ) : (
                                <span className="text-xl font-bold">{status?.progress || 0}%</span>
                            )}
                        </div>
                    </div>

                    {/* Labels */}
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {(status?.status === 'completed' || status?.status === 'succeeded') ? 'Processo Concluído!' :
                            status?.status === 'failed' ? 'Algo deu errado' :
                                status?.status === 'canceled' ? 'Processo Cancelado' :
                                    'Gerando Conteúdo...'}
                    </h2>

                    <p className="text-gray-400 mb-8">
                        {status?.result?.message || status?.current_step || 'Aguardando atualizações da IA...'}
                    </p>

                    {/* Progress Bar */}
                    {status?.status !== 'completed' && status?.status !== 'succeeded' && status?.status !== 'failed' && (
                        <div className="w-full bg-gray-800 h-2 rounded-full mb-2 overflow-hidden">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-500 relative"
                                style={{ width: `${status?.progress || 0}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 justify-center mt-6">
                        {(status?.status === 'completed' || status?.status === 'succeeded') ? (
                            <button
                                onClick={() => {
                                    onClose();
                                    navigate(`/client/${clientId}/calendar`);
                                }}
                                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2"
                            >
                                Ver Resultado <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (status?.status === 'pending' || status?.status === 'processing' || status?.status === 'running') ? (
                            <button
                                onClick={handleCancel}
                                className="text-red-400 hover:text-red-300 px-6 py-2.5 rounded-xl font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                        ) : (
                            <button
                                onClick={onClose}
                                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2.5 rounded-xl font-medium transition-all"
                            >
                                Fechar
                            </button>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
