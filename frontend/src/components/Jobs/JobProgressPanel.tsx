import { useState } from 'react';
import { JobStatusResponse } from '../../services/api';

interface JobProgressPanelProps {
    job: JobStatusResponse | null;
    onCancel: () => void;
    onDismissPanel?: () => void;
    onRetry?: () => void;
}

export default function JobProgressPanel({ job, onCancel, onDismissPanel, onRetry }: JobProgressPanelProps) {
    const [showJson, setShowJson] = useState(false);

    if (!job) return null;

    const isActive = job.status === 'pending' || job.status === 'running';
    const isStale = job.is_stale;
    const isFailed = job.status === 'failed' || job.status === 'canceled';
    const isSuccess = job.status === 'succeeded' || job.status === 'completed';

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 text-white text-sm font-sans shadow-lg relative">
            {/* Botão de Fechar se estiver concluído ou falhado */}
            {(isSuccess || isFailed) && onDismissPanel && (
                <button
                    onClick={onDismissPanel}
                    className="absolute top-4 right-4 text-white/50 hover:text-white"
                >
                    ✕
                </button>
            )}

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        Progresso do Calendário
                        {isActive && <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </span>}
                        {isStale && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wider animate-pulse">Travado</span>}
                        {isSuccess && <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wider">Concluído</span>}
                    </h3>
                    <p className="text-white/60 text-xs mt-1">
                        Status: <strong className="uppercase">{job.status}</strong>
                        {job.age_seconds !== undefined && (
                            <span className="ml-2">| Última atualização há {job.age_seconds}s</span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowJson(!showJson)}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded text-xs transition-colors"
                    >
                        {showJson ? 'Esconder JSON' : '{ } Ver JSON'}
                    </button>

                    {isActive && (
                        <button
                            onClick={onCancel}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded text-xs transition-colors"
                        >
                            Cancelar Geração
                        </button>
                    )}
                    {isFailed && onRetry && (
                        <button
                            onClick={onRetry}
                            className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 rounded text-xs transition-colors"
                        >
                            Tentar Novamente
                        </button>
                    )}
                </div>
            </div>

            <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/80">{job.current_step || 'Processando...'}</span>
                    <span className="font-mono">{job.progress}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${isFailed ? 'bg-red-500' : isSuccess ? 'bg-green-500' : isStale ? 'bg-orange-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.max(0, Math.min(100, job.progress || 0))}%` }}
                    ></div>
                </div>
            </div>

            {isStale && job.hint && (
                <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded text-orange-200 text-xs">
                    ⚠️ <strong>Alerta:</strong> {job.hint}
                </div>
            )}

            {isFailed && job.error && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-200 text-xs font-mono whitespace-pre-wrap">
                    {job.error}
                </div>
            )}

            {showJson && (
                <div className="mt-4 p-4 bg-black/40 border border-white/5 rounded overflow-x-auto">
                    <pre className="text-[10px] sm:text-xs text-white/70 font-mono">
                        {JSON.stringify(job, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
