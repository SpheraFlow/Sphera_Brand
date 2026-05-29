/**
 * STORY-016 — Agendamento de publicação direta no Instagram.
 *
 * Renderizado no PostDetailPanel apenas quando o post está aprovado
 * (approval_status === 'approved'). Permite:
 *   - Agendar a publicação (datepicker) → POST /api/publications/schedule
 *   - Aprovar um agendamento pendente   → PATCH /api/publications/:id/approve
 *   - Cancelar (dentro da janela de 5 min, senão o backend retorna 409)
 *   - Listar os agendamentos existentes deste post com seus status
 *
 * Pré-requisito: a conta Instagram do cliente precisa estar conectada
 * (STORY-015). Sem conta conectada, exibe um aviso e desabilita o agendamento.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
    socialService,
    publicationService,
    type PublicationSchedule,
    type PublicationStatus,
} from '../../services/api';

interface PublicationSchedulerProps {
    calendarItemId: string;
    clienteId: string;
    /** image_url do item — se vazio, não há mídia publicável. */
    imageUrl?: string | null;
}

const STATUS_LABEL: Record<PublicationStatus, string> = {
    pending_approval: 'Aguardando aprovação',
    approved: 'Aprovado (na fila)',
    queued: 'Na fila',
    publishing: 'Publicando...',
    published: 'Publicado',
    failed: 'Falhou',
    canceled: 'Cancelado',
};

const STATUS_BADGE: Record<PublicationStatus, string> = {
    pending_approval: 'bg-yellow-600/30 text-yellow-300 border border-yellow-600/50',
    approved: 'bg-cyan-600/30 text-cyan-300 border border-cyan-600/50',
    queued: 'bg-cyan-600/30 text-cyan-300 border border-cyan-600/50',
    publishing: 'bg-purple-600/30 text-purple-300 border border-purple-600/50',
    published: 'bg-blue-600/30 text-blue-300 border border-blue-600/50',
    failed: 'bg-red-600/30 text-red-300 border border-red-600/50',
    canceled: 'bg-gray-700 text-gray-300 border border-gray-600',
};

function formatDateTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

/** datetime-local default: agora + 10 min (acima da janela de 5 min). */
function defaultScheduledAt(): string {
    const d = new Date(Date.now() + 10 * 60 * 1000);
    // Ajusta para o fuso local no formato YYYY-MM-DDTHH:mm exigido pelo input.
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export default function PublicationScheduler({
    calendarItemId,
    clienteId,
    imageUrl,
}: PublicationSchedulerProps) {
    const [socialAccountId, setSocialAccountId] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState(true);

    const [schedules, setSchedules] = useState<PublicationSchedule[]>([]);
    const [scheduledAt, setScheduledAt] = useState<string>(defaultScheduledAt());
    const [scheduling, setScheduling] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const hasMedia = Boolean((imageUrl ?? '').trim());

    // Carrega status da conta IG (para obter o social_account_id).
    useEffect(() => {
        let active = true;
        setLoadingStatus(true);
        socialService
            .getStatus(clienteId)
            .then((status) => {
                if (!active) return;
                setConnected(Boolean(status.connected));
                setSocialAccountId(status.account_id ?? null);
            })
            .catch(() => {
                if (!active) return;
                setConnected(false);
                setSocialAccountId(null);
            })
            .finally(() => {
                if (active) setLoadingStatus(false);
            });
        return () => {
            active = false;
        };
    }, [clienteId]);

    // Carrega os agendamentos deste post (filtra a lista do cliente pelo item).
    const loadSchedules = useCallback(async () => {
        try {
            const list = await publicationService.list(clienteId);
            setSchedules(list.filter((s) => s.calendar_item_id === calendarItemId));
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Erro ao carregar agendamentos.');
        }
    }, [clienteId, calendarItemId]);

    useEffect(() => {
        void loadSchedules();
    }, [loadSchedules]);

    const handleSchedule = async () => {
        if (!socialAccountId) {
            toast.error('Conecte a conta Instagram do cliente antes de agendar.');
            return;
        }
        if (!scheduledAt) {
            toast.error('Defina a data e hora da publicação.');
            return;
        }
        setScheduling(true);
        try {
            const isoUtc = new Date(scheduledAt).toISOString();
            await publicationService.schedule({
                calendarItemId,
                socialAccountId,
                scheduledAt: isoUtc,
            });
            toast.success('Publicação agendada. Aprove para liberar o envio.');
            await loadSchedules();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Erro ao agendar publicação.');
        } finally {
            setScheduling(false);
        }
    };

    const handleApprove = async (id: string) => {
        setBusyId(id);
        try {
            await publicationService.approve(id);
            toast.success('Publicação aprovada. Será enviada no horário agendado.');
            await loadSchedules();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Erro ao aprovar publicação.');
        } finally {
            setBusyId(null);
        }
    };

    const handleCancel = async (id: string) => {
        setBusyId(id);
        try {
            await publicationService.cancel(id);
            toast.success('Publicação cancelada.');
            await loadSchedules();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Não foi possível cancelar.');
        } finally {
            setBusyId(null);
        }
    };

    const canCancel = (s: PublicationSchedule): boolean =>
        s.status === 'pending_approval' || s.status === 'approved' || s.status === 'queued';

    const activeSchedules = useMemo(
        () => schedules.filter((s) => s.status !== 'canceled' && s.status !== 'failed'),
        [schedules]
    );

    return (
        <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                📷 Publicação direta no Instagram
            </h4>

            {loadingStatus && (
                <p className="text-xs text-gray-500 italic">Verificando conexão...</p>
            )}

            {!loadingStatus && !connected && (
                <p className="text-xs text-yellow-300 bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-2">
                    A conta Instagram deste cliente não está conectada. Conecte-a na área de
                    integrações para habilitar a publicação direta.
                </p>
            )}

            {!loadingStatus && connected && !hasMedia && (
                <p className="text-xs text-yellow-300 bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-2">
                    Gere a arte deste post antes de agendar — a publicação precisa de uma imagem.
                </p>
            )}

            {!loadingStatus && connected && (
                <div className="space-y-3">
                    {/* Formulário de agendamento */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[11px] text-gray-400">Agendar para</label>
                        <div className="flex gap-2">
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                            <button
                                onClick={handleSchedule}
                                disabled={scheduling || !hasMedia || !socialAccountId}
                                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-pink-600/20 text-pink-300 border border-pink-600/40 hover:bg-pink-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            >
                                {scheduling ? 'Agendando...' : '📅 Agendar publicação'}
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-500">
                            Há uma janela de 5 minutos para cancelar após o agendamento. A publicação só
                            é enviada após aprovação explícita.
                        </p>
                    </div>

                    {/* Lista de agendamentos */}
                    {activeSchedules.length === 0 && schedules.length === 0 && (
                        <p className="text-xs text-gray-500 italic">Nenhum agendamento para este post.</p>
                    )}

                    <div className="space-y-2">
                        {schedules.map((s) => (
                            <div
                                key={s.id}
                                className="bg-gray-800/60 border border-gray-700 rounded-lg p-2.5"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span
                                        className={`text-[10px] rounded-full px-2 py-0.5 ${STATUS_BADGE[s.status]}`}
                                    >
                                        {STATUS_LABEL[s.status]}
                                    </span>
                                    <span className="text-[10px] text-gray-500">
                                        {formatDateTime(s.scheduled_at)}
                                    </span>
                                </div>

                                {s.last_error && s.status === 'failed' && (
                                    <p className="text-[10px] text-red-300 mb-1 break-words">
                                        {s.last_error}
                                    </p>
                                )}

                                <div className="flex gap-2 mt-1">
                                    {s.status === 'pending_approval' && (
                                        <button
                                            onClick={() => handleApprove(s.id)}
                                            disabled={busyId === s.id}
                                            className="px-2.5 py-1 rounded text-xs font-semibold bg-green-600/20 text-green-300 border border-green-600/40 hover:bg-green-600/30 disabled:opacity-50 transition-colors"
                                        >
                                            ✅ Aprovar publicação
                                        </button>
                                    )}
                                    {canCancel(s) && (
                                        <button
                                            onClick={() => handleCancel(s.id)}
                                            disabled={busyId === s.id}
                                            className="px-2.5 py-1 rounded text-xs font-semibold bg-red-600/20 text-red-300 border border-red-600/40 hover:bg-red-600/30 disabled:opacity-50 transition-colors"
                                        >
                                            🗑️ Cancelar
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
