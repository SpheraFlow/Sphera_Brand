
import { useState, useEffect } from 'react';
import { jobsService } from '../services/api';
import { JobStatusResponse } from '../services/api';

interface CalendarGenerationProgressModalProps {
    jobId: string;
    clientId: string;
    // Polling props (recebidos do CalendarPage — hook elevado)
    status: JobStatusResponse['status'] | null;
    progress: number;
    stepDescription: string;
    pollingError: string | null;
    isPolling: boolean;
    onClose: () => void;
    // onSuccess é tratado pelo CalendarPage via handleJobSuccessCallback
}

export default function CalendarGenerationProgressModal({
    jobId,
    clientId,
    status,
    progress,
    stepDescription,
    pollingError,
    isPolling,
    onClose,
}: CalendarGenerationProgressModalProps) {
    const [isSlow, setIsSlow] = useState(false);

    useEffect(() => {
        const slowTimerId = setTimeout(() => {
            if (isPolling) setIsSlow(true);
        }, 15000);
        return () => clearTimeout(slowTimerId);
    }, [isPolling]);

    const handleCancel = async () => {
        if (!window.confirm('Tem certeza que deseja cancelar a geração? O progresso atual será perdido.')) return;
        try {
            await jobsService.cancelJob(clientId, jobId);
            // localStorage é limpo pelo onCancel do hook no CalendarPage
            onClose();
        } catch (err) {
            console.error('Erro ao cancelar job:', err);
            alert('Erro ao cancelar job. Tente novamente.');
        }
    };

    // Sucesso: job concluído
    if (status === 'succeeded' || status === 'completed') {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
                <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-green-500/50 shadow-2xl">
                    <div className="text-center">
                        <div className="text-4xl mb-4">✅</div>
                        <h3 className="text-xl font-bold text-white mb-2">Calendário Gerado!</h3>
                        <p className="text-gray-300 mb-6 text-sm">O calendário foi gerado com sucesso e está disponível para visualização.</p>
                        <button
                            onClick={onClose}
                            className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-lg font-medium transition-colors text-white"
                        >
                            Ver Calendário
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Erro ou cancelamento
    if (status === 'failed' || status === 'canceled' || pollingError) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
                <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-red-500/50 shadow-2xl">
                    <div className="text-center">
                        <div className="text-4xl mb-4">{status === 'canceled' ? '🛑' : '❌'}</div>
                        <h3 className="text-xl font-bold text-white mb-2">
                            {status === 'canceled' ? 'Geração Cancelada' : 'Falha na Geração'}
                        </h3>
                        <p className="text-gray-300 mb-6 text-sm">
                            {pollingError || (status === 'canceled' ? 'Cancelado pelo usuário.' : 'Erro desconhecido.')}
                        </p>
                        <div className="bg-gray-900/50 p-3 rounded-lg mb-6 text-left">
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Job ID para suporte:</p>
                            <code className="text-xs text-blue-400 break-all select-all font-mono">{jobId}</code>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-medium transition-colors text-white"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Progresso / spinner
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-xl p-8 w-full max-w-lg border border-gray-700 shadow-2xl relative overflow-hidden">
                {/* Barra de progresso */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gray-700">
                    <div
                        className="h-full bg-blue-500 transition-all duration-500 ease-out"
                        style={{ width: `${Math.max(5, progress)}%` }}
                    />
                </div>

                <div className="text-center relative z-10">
                    <div className="mb-6 relative inline-block">
                        <div className="w-20 h-20 rounded-full border-4 border-gray-700 border-t-blue-500 animate-spin mx-auto" />
                        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-blue-400">
                            {progress}%
                        </div>
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2">
                        {isSlow ? 'A IA está pensando...' : 'Gerando Calendário'}
                    </h3>

                    <p className="text-blue-300 text-sm font-medium mb-1 animate-pulse">
                        {stepDescription}
                    </p>

                    {isSlow && (
                        <p className="text-gray-500 text-xs mt-4 max-w-xs mx-auto">
                            Gerações complexas podem levar alguns minutos. Você pode fechar esta janela e o processo continuará em segundo plano.
                        </p>
                    )}

                    <div className="mt-8">
                        {/* "Fechar" fecha só o UI — polling continua no CalendarPage */}
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-white text-sm transition-colors px-4 py-2 rounded hover:bg-gray-700/50"
                        >
                            Fechar e aguardar em segundo plano
                        </button>
                    </div>

                    <div className="mt-4 border-t border-gray-700 pt-4">
                        <button
                            onClick={handleCancel}
                            className="text-red-400 hover:text-red-300 text-xs transition-colors px-3 py-1.5 rounded hover:bg-red-900/20 flex items-center gap-1 mx-auto"
                        >
                            🛑 Cancelar Geração
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
