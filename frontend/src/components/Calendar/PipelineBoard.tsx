/**
 * STORY-009 — Pipeline (Kanban) board para aprovação de posts.
 *
 * Renderiza 4 colunas (Rascunho, Em Revisão, Aprovado, Publicado) com cards
 * arrastáveis usando @hello-pangea/dnd (já usado no resto do projeto).
 *
 * Comportamentos chave:
 *  - Atualização otimista no drop + rollback em caso de erro do PATCH.
 *  - Guardrail local + backend: não permite cair direto em 'published' sem
 *    estar em 'approved' (toast de erro).
 *  - Click no card abre o PostDetailPanel (controlado pelo pai).
 */
import { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import {
    calendarItemsService,
    type ApprovalStatus,
    type CalendarItem,
} from '../../services/api';

interface PipelinePost {
    item: CalendarItem;
    // Dados denormalizados úteis para o card vindos do JSON do calendário,
    // já que a tabela de items só guarda dia/tema/formato.
    copy_inicial?: string;
    instrucoes_visuais?: string;
    image_status?: 'pending' | 'generating' | 'generated' | 'failed';
}

interface ColumnDef {
    id: ApprovalStatus;
    title: string;
    icon: string;
    accent: string; // tailwind text color for column header
}

const COLUMNS: ColumnDef[] = [
    { id: 'draft', title: 'Rascunho', icon: '📝', accent: 'text-gray-300' },
    { id: 'in_review', title: 'Em Revisão', icon: '👀', accent: 'text-yellow-300' },
    { id: 'approved', title: 'Aprovado', icon: '✅', accent: 'text-green-300' },
    { id: 'published', title: 'Publicado', icon: '📤', accent: 'text-blue-300' },
];

interface PipelineBoardProps {
    posts: PipelinePost[];
    onItemUpdated: (updated: CalendarItem) => void;
    onCardClick: (post: PipelinePost) => void;
    clientFilterOptions?: Array<{ id: string; nome: string }>;
    selectedClientId?: string | null;
    onClientFilterChange?: (clientId: string | null) => void;
}

export default function PipelineBoard({
    posts,
    onItemUpdated,
    onCardClick,
    clientFilterOptions,
    selectedClientId,
    onClientFilterChange,
}: PipelineBoardProps) {
    // Estado local para atualização otimista (cópia em memória dos items).
    // Sincroniza com props quando o pai recarrega.
    const [optimisticItems, setOptimisticItems] = useState<Record<string, ApprovalStatus>>({});

    // Resolve approval_status efetivo (otimista > prop).
    const resolveStatus = (p: PipelinePost): ApprovalStatus => {
        const optimistic = optimisticItems[p.item.id];
        if (optimistic) return optimistic;
        return (p.item.approval_status ?? 'draft') as ApprovalStatus;
    };

    // Filtro por cliente (na própria board — não persiste em URL).
    const filteredPosts = useMemo(() => {
        if (!selectedClientId) return posts;
        return posts.filter((p) => p.item.cliente_id === selectedClientId);
    }, [posts, selectedClientId]);

    const grouped = useMemo(() => {
        const map: Record<ApprovalStatus, PipelinePost[]> = {
            draft: [],
            in_review: [],
            approved: [],
            published: [],
        };
        for (const p of filteredPosts) {
            const st = resolveStatus(p);
            map[st].push(p);
        }
        // Ordena por dia ASC dentro de cada coluna (AC2)
        for (const k of Object.keys(map) as ApprovalStatus[]) {
            map[k].sort((a, b) => (a.item.dia ?? 0) - (b.item.dia ?? 0));
        }
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredPosts, optimisticItems]);

    const handleDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId) return;

        const from = source.droppableId as ApprovalStatus;
        const to = destination.droppableId as ApprovalStatus;
        const itemId = draggableId;

        // Guardrail local (AC3): só pode entrar em 'published' vindo de 'approved'.
        if (to === 'published' && from !== 'approved') {
            toast.error(
                'Este post precisa ser Aprovado antes de ser marcado como Publicado.',
                { duration: 4000 }
            );
            return;
        }

        // Atualização otimista
        setOptimisticItems((prev) => ({ ...prev, [itemId]: to }));

        try {
            const updated = await calendarItemsService.patchApprovalStatus(itemId, {
                approval_status: to,
            });
            // Confirma com o pai (que pode reposicionar/reload outros estados)
            onItemUpdated(updated);
        } catch (err: any) {
            // Rollback otimista
            setOptimisticItems((prev) => {
                const next = { ...prev };
                delete next[itemId];
                return next;
            });
            const msg =
                err?.response?.data?.error ||
                err?.message ||
                'Erro ao atualizar status do post.';
            toast.error(msg);
        }
    };

    return (
        <div className="w-full">
            {/* Header filtros */}
            {(clientFilterOptions && clientFilterOptions.length > 0) && (
                <div className="mb-4 flex items-center gap-2 flex-wrap">
                    <label className="text-sm text-gray-400">Filtrar por cliente:</label>
                    <select
                        value={selectedClientId ?? ''}
                        onChange={(e) =>
                            onClientFilterChange?.(e.target.value || null)
                        }
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
                    >
                        <option value="">Todos os clientes</option>
                        {clientFilterOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.nome}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {COLUMNS.map((col) => {
                        const cards = grouped[col.id] || [];
                        const isLocked = col.id === 'published';
                        return (
                            <Droppable droppableId={col.id} key={col.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`rounded-xl bg-gray-800/50 border ${
                                            snapshot.isDraggingOver
                                                ? 'border-blue-500/70 bg-gray-800/80'
                                                : 'border-gray-700'
                                        } p-3 flex flex-col min-h-[400px]`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <h3
                                                className={`text-sm font-semibold uppercase tracking-wide ${col.accent}`}
                                            >
                                                <span className="mr-1.5">{col.icon}</span>
                                                {col.title}
                                            </h3>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-gray-400 bg-gray-700/70 rounded-full px-2 py-0.5">
                                                    {cards.length}
                                                </span>
                                                {isLocked && (
                                                    <span
                                                        title="Só aceita posts vindos de 'Aprovado'"
                                                        className="text-xs text-gray-500"
                                                    >
                                                        🔒
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-1">
                                            {cards.length === 0 && (
                                                <div className="text-xs text-gray-500 italic text-center py-6">
                                                    Vazio
                                                </div>
                                            )}
                                            {cards.map((p, idx) => (
                                                <Draggable
                                                    key={p.item.id}
                                                    draggableId={p.item.id}
                                                    index={idx}
                                                >
                                                    {(dragProvided, dragSnap) => (
                                                        <div
                                                            ref={dragProvided.innerRef}
                                                            {...dragProvided.draggableProps}
                                                            {...dragProvided.dragHandleProps}
                                                            onClick={() => onCardClick(p)}
                                                            className={`rounded-lg p-3 cursor-pointer transition-all
                                                                bg-gray-900/80 border ${
                                                                    dragSnap.isDragging
                                                                        ? 'border-blue-500 shadow-xl shadow-blue-500/30'
                                                                        : 'border-gray-700 hover:border-gray-500'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-xs font-semibold text-blue-300">
                                                                    Dia {p.item.dia}
                                                                </span>
                                                                <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-800 rounded px-1.5 py-0.5">
                                                                    {p.item.formato}
                                                                </span>
                                                            </div>
                                                            <h4 className="text-sm font-semibold text-white line-clamp-2 mb-1">
                                                                {p.item.tema || '(sem tema)'}
                                                            </h4>
                                                            {p.copy_inicial && (
                                                                <p className="text-xs text-gray-400 line-clamp-3">
                                                                    {p.copy_inicial}
                                                                </p>
                                                            )}
                                                            <div className="flex items-center justify-between mt-2">
                                                                <div className="flex items-center gap-1">
                                                                    {p.image_status === 'generated' && (
                                                                        <span
                                                                            title="Imagem pronta"
                                                                            className="text-xs"
                                                                        >
                                                                            🖼️
                                                                        </span>
                                                                    )}
                                                                    {p.item.reviewer_notes && (
                                                                        <span
                                                                            title="Tem nota do revisor"
                                                                            className="text-xs"
                                                                        >
                                                                            🗒️
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-gray-500">
                                                                    rev {p.item.revisions_count ?? 0}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    </div>
                                )}
                            </Droppable>
                        );
                    })}
                </div>
            </DragDropContext>
        </div>
    );
}

export type { PipelinePost };
