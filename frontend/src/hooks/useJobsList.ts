import { useState, useEffect, useCallback, useRef } from 'react';
import { jobsService } from '../services/api';

interface UseJobsListOptions {
    clientId: string | undefined;
    refreshIntervalMs?: number; // Se 0 ou undefined, não faz polling automático
    enabled?: boolean;
}

export function useJobsList({
    clientId,
    refreshIntervalMs = 0,
    enabled = true
}: UseJobsListOptions) {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const fetchJobs = useCallback(async (isAutoRefresh = false) => {
        const LOGS_ENABLED = false;
        if (!clientId || !enabled) return;

        if (!isAutoRefresh) setLoading(true);
        if (isAutoRefresh && LOGS_ENABLED) console.log('🔄 [useJobsList] Auto-refreshing jobs list...');

        try {
            const list = await jobsService.getJobs(clientId);
            if (isMounted.current) {
                setJobs(list);
                setError(null);
                if (isAutoRefresh && LOGS_ENABLED) console.log(`✅ [useJobsList] Refreshed. Found ${list.length} jobs.`);
            }
        } catch (err: any) {
            console.error('Erro ao buscar jobs:', err);
            if (isMounted.current) {
                setError(err.message || 'Erro ao carregar jobs');
            }
        } finally {
            if (isMounted.current && !isAutoRefresh) {
                setLoading(false);
            }
        }
    }, [clientId, enabled]);

    useEffect(() => {
        if (clientId && enabled) {
            fetchJobs();
        }
    }, [fetchJobs]);

    useEffect(() => {
        if (!refreshIntervalMs || refreshIntervalMs <= 0 || !enabled) return;

        const intervalId = setInterval(() => {
            fetchJobs(true);
        }, refreshIntervalMs);

        return () => clearInterval(intervalId);
    }, [refreshIntervalMs, enabled, fetchJobs]);

    return {
        jobs,
        loading,
        error,
        refresh: () => fetchJobs(false)
    };
}
