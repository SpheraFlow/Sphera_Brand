/**
 * STORY-009 — Painel lateral (drawer) de detalhes de um post no Pipeline.
 *
 * Mostra:
 *  - Campos completos do post (copy_inicial, instruções visuais — quando disponíveis)
 *  - reviewer_notes editável com "Salvar Nota" (PATCH /status com reviewer_notes)
 *  - Histórico de comentários (GET /comments) + input para novo comentário (POST /comment)
 *  - Botões de transição de status (Em Revisão / Aprovar / Marcar Publicado)
 *    com guardrail: "Marcar Publicado" desabilitado se approval_status !== 'approved'.
 *
 * É controlado pelo pai (CalendarPage) via prop `post`. Quando `post` é null, fecha.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
    calendarItemsService,
    type ApprovalStatus,
    type CalendarItem,
    type PostComment,
} from '../../services/api';
import type { PipelinePost } from './PipelineBoard';
import PublicationScheduler from './PublicationScheduler';

interface PostDetailPanelProps {
    post: PipelinePost | null;
    onClose: () => void;
    onItemUpdated: (updated: CalendarItem) => void;
}

const STATUS_LABEL: Record<ApprovalStatus, string> = {
    draft: 'Rascunho',
    in_review: 'Em Revisão',
    approved: 'Aprovado',
    published: 'Publicado',
};

const STATUS_BADGE: Record<ApprovalStatus, string> = {
    draft: 'bg-gray-700 text-gray-200',
    in_review: 'bg-yellow-600/30 text-yellow-300 border border-yellow-600/50',
    approved: 'bg-green-600/30 text-green-300 border border-green-600/50',
    published: 'bg-blue-600/30 text-blue-300 border border-blue-600/50',
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

export default function PostDetailPanel({
    post,
    onClose,
    onItemUpdated,
}: PostDetailPanelProps) {
    const item = post?.item ?? null;
    const itemId = item?.id ?? null;

    const currentStatus: ApprovalStatus =
        (item?.approval_status ?? 'draft') as ApprovalStatus;

    const [notesDraft, setNotesDraft] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);

    const [comments, setComments] = useState<PostComment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [postingComment, setPostingComment] = useState(false);

    const [updatingStatus, setUpdatingStatus] = useState<ApprovalStatus | null>(null);

    // Sincroniza a nota editável com o item selecionado
    useEffect(() => {
        setNotesDraft(item?.reviewer_notes ?? '');
    }, [itemId, item?.reviewer_notes]);

    // Carrega comentários sempre que o item muda
    const loadComments = useCallback(async (id: string) => {
        setLoadingComments(true);
        try {
            const list = await calendarItemsService.getComments(id);
            setComments(list);
        } catch (err: any) {
            toast.error(
                err?.response?.data?.error || 'Erro ao carregar comentários.'
            );
        } finally {
            setLoadingComments(false);
        }
    }, []);

    useEffect(() => {
        if (itemId) {
            void loadComments(itemId);
        } else {
            setComments([]);
        }
    }, [itemId, loadComments]);

    const handleSaveNotes = async () => {
        if (!itemId) return;
        setSavingNotes(true);
        try {
            const updated = await calendarItemsService.patchApprovalStatus(itemId, {
                reviewer_notes: notesDraft.trim() ? notesDraft.trim() : null,
            });
            onItemUpdated(updated);
            toast.success('Nota salva.');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Erro ao salvar nota.');
        } finally {
            setSavingNotes(false);
        }
    };

    const handleAddComment = async () => {
        if (!itemId) return;
        const content = newComment.trim();
        if (!content) return;
        setPostingComment(true);
        try {
            const created = await calendarItemsService.addComment(itemId, content);
            setComments((prev) => [...prev, created]);
            setNewComment('');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Erro ao adicionar comentário.');
        } finally {
            setPostingComment(false);
        }
    };

    const handleTransition = async (to: ApprovalStatus) => {
        if (!itemId) return;
        // Guardrail local (AC3): só publica vindo de 'approved'.
        if (to === 'published' && currentStatus !== 'approved') {
            toast.error(
                'Este post precisa ser Aprovado antes de ser marcado como Publicado.'
            );
            return;
        }
        setUpdatingStatus(to);
        try {
            const updated = await calendarItemsService.patchApprovalStatus(itemId, {
                approval_status: to,
            });
            onItemUpdated(updated);
            toast.success(`Movido para "${STATUS_LABEL[to]}".`);
        } catch (err: any) {
            toast.error(
                err?.response?.data?.error || 'Erro ao atualizar status do post.'
            );
        } finally {
            setUpdatingStatus(null);
        }
    };

    if (!post || !item) return null;

    const publishDisabled = currentStatus !== 'approved';

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer lateral */}
            <div
                role="dialog"
                aria-modal="true"
                className="fixed top-0 right-0 h-full w-full max-w-md bg-gray-900 border-l border-gray-700 z-50 shadow-2xl flex flex-col"
            >
                {/* Header */}
                <div className="flex items-start justify-between p-4 border-b border-gray-700">
                    <div className="pr-3">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-blue-300">
                                Dia {item.dia}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-800 rounded px-1.5 py-0.5">
                                {item.formato}
                            </span>
                            <span
                                className={`text-[10px] rounded-full px-2 py-0.5 ${STATUS_BADGE[currentStatus]}`}
                            >
                                {STATUS_LABEL[currentStatus]}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-white">
                            {item.tema || '(sem tema)'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xl leading-none"
                        title="Fechar"
                    >
                        ✕
                    </button>
                </div>

                {/* Corpo scrollável */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
                    {/* Copy completo */}
                    {post.copy_inicial && (
                        <section>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                                Copy
                            </h4>
                            <p className="text-sm text-gray-200 whitespace-pre-wrap">
                                {post.copy_inicial}
                            </p>
                        </section>
                    )}

                    {/* Instruções visuais */}
                    {post.instrucoes_visuais && (
                        <section>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                                Instruções Visuais
                            </h4>
                            <p className="text-sm text-gray-200 whitespace-pre-wrap">
                                {post.instrucoes_visuais}
                            </p>
                        </section>
                    )}

                    {/* Transições de status */}
                    <section>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                            Mover para
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => handleTransition('in_review')}
                                disabled={updatingStatus !== null}
                                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-yellow-600/20 text-yellow-300 border border-yellow-600/40 hover:bg-yellow-600/30 disabled:opacity-50 transition-colors"
                            >
                                👀 Em Revisão
                            </button>
                            <button
                                onClick={() => handleTransition('approved')}
                                disabled={updatingStatus !== null}
                                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-600/20 text-green-300 border border-green-600/40 hover:bg-green-600/30 disabled:opacity-50 transition-colors"
                            >
                                ✅ Aprovar
                            </button>
                            <button
                                onClick={() => handleTransition('published')}
                                disabled={updatingStatus !== null || publishDisabled}
                                title={
                                    publishDisabled
                                        ? 'O post precisa estar Aprovado antes de ser Publicado.'
                                        : undefined
                                }
                                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600/20 text-blue-300 border border-blue-600/40 hover:bg-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                📤 Marcar Publicado
                            </button>
                        </div>
                    </section>

                    {/* STORY-016 — Publicação direta (somente para posts aprovados) */}
                    {currentStatus === 'approved' && item.cliente_id && (
                        <PublicationScheduler
                            calendarItemId={item.id}
                            clienteId={item.cliente_id}
                            imageUrl={item.image_url}
                        />
                    )}

                    {/* Reviewer notes */}
                    <section>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                            Nota do Revisor
                        </h4>
                        <textarea
                            value={notesDraft}
                            onChange={(e) => setNotesDraft(e.target.value)}
                            rows={3}
                            placeholder="Adicione uma nota interna sobre este post..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-y focus:outline-none focus:border-blue-500"
                        />
                        <button
                            onClick={handleSaveNotes}
                            disabled={savingNotes}
                            className="mt-2 px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition-colors"
                        >
                            {savingNotes ? 'Salvando...' : 'Salvar Nota'}
                        </button>
                    </section>

                    {/* Comentários */}
                    <section>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                            Comentários
                        </h4>

                        {loadingComments && (
                            <p className="text-xs text-gray-500 italic">Carregando...</p>
                        )}

                        {!loadingComments && comments.length === 0 && (
                            <p className="text-xs text-gray-500 italic">
                                Nenhum comentário ainda.
                            </p>
                        )}

                        <div className="space-y-3 mb-3">
                            {comments.map((c) => (
                                <div
                                    key={c.id}
                                    className="bg-gray-800/60 border border-gray-700 rounded-lg p-2.5"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-blue-300">
                                            {c.user_name || c.user_email || 'Usuário'}
                                        </span>
                                        <span className="text-[10px] text-gray-500">
                                            {formatDateTime(c.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-200 whitespace-pre-wrap">
                                        {c.content}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                rows={2}
                                placeholder="Escreva um comentário..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-y focus:outline-none focus:border-blue-500"
                            />
                            <button
                                onClick={handleAddComment}
                                disabled={postingComment || !newComment.trim()}
                                className="self-end px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {postingComment ? 'Enviando...' : 'Comentar'}
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}
