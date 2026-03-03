import { useState, useEffect, useRef, useCallback } from 'react';
import { jobsService, JobStatusResponse } from '../services/api';

interface UseJobPollingOptions {
    clientId: string;
    jobId: string | null;
    enabled?: boolean;
    intervalMs?: number;
    onSuccess?: (result: any) => void;
    onError?: (error: string) => void;
    onCancel?: () => void;
}

interface UseJobPollingResult {
    status: JobStatusResponse['status'] | null;
    progress: number;
    stepDescription: string;
    error: string | null;
    result: any | null;
    isPolling: boolean;
    job: JobStatusResponse | null;
}

export function useJobPolling({
    clientId,
    jobId,
    enabled = true,
    intervalMs = 2000,
    onSuccess,
    onError,
    onCancel
}: UseJobPollingOptions): UseJobPollingResult {
    const [status, setStatus] = useState<JobStatusResponse['status'] | null>(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [stepDescription, setStepDescription] = useState('Iniciando...');
    const [job, setJob] = useState<JobStatusResponse | null>(null);

    // Feature flags
    const LOGS_ENABLED = false; // Set to true for debugging
    const MAX_ATTEMPTS = 120; // 120 * 2s = ~4 minutos máximo de polling

    // Ref para evitar atualizações de estado após unmount
    const isMounted = useRef(true);
    const attempts = useRef(0);
    const backoffMs = useRef(intervalMs);
    const pollingInProgress = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const handleTerminalState = useCallback((job: JobStatusResponse) => {
        if (job.status === 'completed' || job.status === 'succeeded') {
            if (onSuccess) onSuccess(job.result);
        } else if (job.status === 'failed') {
            const errorMsg = job.error || 'Erro desconhecido na geração.';
            setError(errorMsg);
            if (onError) onError(errorMsg);
        } else if (job.status === 'canceled') {
            setError('Cancelado pelo usuário.');
            if (onCancel) onCancel();
        }
    }, [onSuccess, onError, onCancel]);

    useEffect(() => {
        // Reset states when jobId changes
        if (!clientId || !jobId) {
            setStatus(null);
            setProgress(0);
            setError(null);
            setResult(null);
            setStepDescription('Iniciando...');
            setJob(null);
            return;
        }

        if (!enabled) {
            if (LOGS_ENABLED) console.log('🛑 [useJobPolling] Disabled');
            return;
        }

        if (LOGS_ENABLED) console.log(`🚀 [useJobPolling] START polling for Job ${jobId}`);
        attempts.current = 0;
        backoffMs.current = intervalMs;
        pollingInProgress.current = false;

        let timeoutId: NodeJS.Timeout;

        const poll = async () => {
            if (!jobId || !clientId || !isMounted.current) return;

            // Evitar sobreposição de polls
            if (pollingInProgress.current) return;
            pollingInProgress.current = true;

            // 1. Visibility Check
            if (document.hidden) {
                if (LOGS_ENABLED) console.log('😴 [useJobPolling] Tab hidden, skipping poll...');
                pollingInProgress.current = false; // Release lock
                timeoutId = setTimeout(poll, 3000); // Check again in 3s
                return;
            }

            try {
                attempts.current++;
                if (LOGS_ENABLED) console.log(`🔄 [useJobPolling] Polling attempt #${attempts.current} for ${jobId}`);

                // Limite de tentativas: ~4 minutos (120 x 2s)
                if (attempts.current > MAX_ATTEMPTS) {
                    console.warn(`⏱️ [useJobPolling] MAX_ATTEMPTS atingido para ${jobId}. Parando polling.`);
                    setError('Tempo de espera esgotado. Verifique a aba Jobs para o status da geração.');
                    setStatus('failed' as any);
                    setStepDescription('Tempo excedido');
                    pollingInProgress.current = false;
                    return; // Para o polling definitivamente
                }

                const job = await jobsService.getJobStatus(clientId, jobId);

                if (!isMounted.current) {
                    pollingInProgress.current = false; // Release lock if unmounted during await
                    return; // Cleanup happened during the await
                }

                // Reset backoff on success
                backoffMs.current = intervalMs;

                setStatus(job.status);
                setProgress(job.progress);
                setResult(job.result);
                setJob(job);

                if (LOGS_ENABLED) console.log(`📊 [useJobPolling] Status: ${job.status}, Progress: ${job.progress}%`);

                // Atualizar descrição
                if (job.status === 'pending') setStepDescription('Aguardando início...');
                else if (job.status === 'running' && job.progress === 0) setStepDescription('Iniciando geração...');
                else if (job.progress < 20) setStepDescription('Analisando briefing e DNA da marca...');
                else if (job.progress < 50) setStepDescription('Gerando ideias de conteúdo com IA...');
                else if (job.progress < 80) setStepDescription('Criando posts e legendas...');
                else if (job.progress < 100) setStepDescription('Finalizando formatação...');

                // Checar estados terminais
                if (['completed', 'succeeded', 'failed', 'canceled'].includes(job.status)) {
                    if (LOGS_ENABLED) console.log(`✅ [useJobPolling] Job reached terminal state: ${job.status}`);
                    handleTerminalState(job);
                    pollingInProgress.current = false; // Release lock
                    return; // Stop polling
                }

                pollingInProgress.current = false; // Release lock
                // Agendar próximo poll
                timeoutId = setTimeout(poll, Math.max(1500, intervalMs));

            } catch (err: any) {
                if (LOGS_ENABLED) console.error('❌ [useJobPolling] Error polling:', err);

                // Exponential Backoff (max 10s)
                backoffMs.current = Math.min(backoffMs.current * 1.5, 10000);
                pollingInProgress.current = false; // Release lock

                if (isMounted.current) {
                    timeoutId = setTimeout(poll, backoffMs.current);
                }
            }
        };

        // Iniciar
        poll();

        return () => {
            if (LOGS_ENABLED) console.log(`🛑 [useJobPolling] STOP/CLEANUP for Job ${jobId}`);
            clearTimeout(timeoutId);
            pollingInProgress.current = false; // Ensure lock is released on cleanup
        };
    }, [clientId, jobId, enabled, intervalMs, handleTerminalState]);

    return {
        status,
        progress,
        stepDescription,
        error,
        result,
        isPolling: !!jobId && enabled && !['completed', 'succeeded', 'failed', 'canceled'].includes(status || ''),
        job
    };
}
