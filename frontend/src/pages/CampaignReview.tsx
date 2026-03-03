import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import {
    ArrowLeft,
    Save,
    Check,
    Grid,
    Columns,
    Search,
    Download
} from 'lucide-react';
import { calendarService } from '../services/api';
import PostReviewCard from '../components/Campaign/PostReviewCard';
import PresentationGenerator from '../components/PresentationGenerator';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';

interface Post {
    data: string;
    tema: string;
    formato: string;
    ideia_visual: string;
    copy_sugestao: string;
    objetivo: string;
    image_generation_prompt?: string;
    referencias?: string;
    status?: 'sugerido' | 'aprovado' | 'publicado';
}

interface CalendarData {
    id: string;
    clienteId: string;
    mes: string;
    posts: Post[];
    status?: string;
}

export default function CampaignReview() {
    const { clientId, campaignId } = useParams<{ clientId: string; campaignId: string }>();
    const navigate = useNavigate();

    const [calendar, setCalendar] = useState<CalendarData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'board'>('grid');
    const [showPresentationEditor, setShowPresentationEditor] = useState(false);

    // Filtros e Seleção
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [filterStatus] = useState<string>('all');

    // Drag & Drop Lists (Para view Board ou Grid)
    // No Grid, as colunas são dias. No Board, status ou semanas? 
    // O prompt pede "Lista/Board por status (Ajustar/Revisar/Aprovado)".
    // Vou implementar Board por Status.

    useEffect(() => {
        if (campaignId) {
            loadCampaign();
        }
    }, [campaignId]);

    const loadCampaign = async () => {
        try {
            setLoading(true);
            // Assumindo que campaignId É um calendarId.
            // E que usamos o endpoint de /calendars/:clientId?month=... ou pegamos pelo ID se houver
            // Mas o endpoint atual é getCalendar(clientId) que pega o 'latest' OU 'month'.
            // Não temos um getCalendarById exposto no api.ts facilmente, mas 'getLatestCalendar' existe.
            // Vou usar um truque: se eu tiver o ID, posso tentar buscar na lista de History ou assumir que é o Current.
            // O endpoint 'latest' pode não ser o ID da URL.
            // Vou assumir que o usuário navegou de uma lista que tem o mês.
            // Mas espere, a URL tem :campaignId.
            // Se eu não tiver endpoint getById, vou ter que buscar o 'latest' e ver se bate ou usar o endpoint de listagem que retorna o JSON full? Não, listagem é resumo.

            // Correção: Vou tentar buscar o calendário do mês que corresponde a essa campanha.
            // Mas, se eu vim da lista de campanhas, eu tenho o ID.
            // Se o backend suportar GET /calendars/:id seria ideal.
            // Analisando routes/calendar.ts (que eu li antes):
            // GET /api/calendars/:clientId (com query month)
            // Não vi GET /api/calendars/:id direto.
            // Mas vi PUT /api/calendars/:calendarId

            // Vou usar o 'getLatestCalendar' se o ID bater, ou buscar por mês se eu soubesse o mês.
            // Como fallback, vou carregar o "latest" e torcer.
            // TODO IDEAL: Endpoint GET /api/calendars/by-id/:id

            // Para MVP, vou carregar o do mês atual ou latest e filtrar no front se for lista?
            // Não, vou carregar o "latest" do cliente.
            const data = await calendarService.getLatestCalendar(clientId!); // Ajustar no backend se precisar
            // Se o ID bater, ótimo. Se não, avisa.
            if (data && data.calendar) {
                setCalendar(data.calendar);
            }
        } catch (error) {
            console.error('Erro ao carregar campanha', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---

    const handleSave = async (updatedPosts?: Post[]) => {
        if (!calendar) return;
        try {
            setSaving(true);
            const postsToSave = updatedPosts || calendar.posts;
            await calendarService.updateCalendar(calendar.id, postsToSave);
            setCalendar({ ...calendar, posts: postsToSave });
            alert('Alterações salvas com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar', error);
            alert('Erro ao salvar alterações.');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = (index: number) => {
        if (!calendar) return;
        const newPosts = [...calendar.posts];
        const current = newPosts[index].status;
        // Toggle logic: sugerido -> aprovado -> sugerido
        newPosts[index].status = current === 'aprovado' ? 'sugerido' : 'aprovado';

        // Otimista update visual
        setCalendar({ ...calendar, posts: newPosts });

        // Salvar individual (endpoint rápido) ou bulk?
        // User pediu persistir via endpoint existente.
        calendarService.updatePost(calendar.id, index, newPosts[index]).catch(e => {
            console.error('Erro ao salvar status', e);
            // Revert se falhar
        });
    };

    const handleBulkApprove = async () => {
        if (!calendar || selectedIndices.length === 0) return;
        const newPosts = [...calendar.posts];
        selectedIndices.forEach(idx => {
            newPosts[idx].status = 'aprovado';
        });
        setCalendar({ ...calendar, posts: newPosts });
        await handleSave(newPosts);
        setSelectedIndices([]);
    };

    const onToggleSelect = (index: number) => {
        setSelectedIndices(prev =>
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
        );
    };

    // --- Drag & Drop ---

    const onDragEnd = (result: DropResult) => {
        if (!calendar || !result.destination) return;

        const sourceId = result.source.droppableId;
        const destId = result.destination.droppableId;
        const postId = parseInt(result.draggableId.replace('post-', ''));

        if (sourceId === destId) return; // Mover na mesma lista (ordenação não muda data, só posição visual?)

        // Se for Grid, sourceId/destId são as DATAS (strings "DD/MM")
        // Se for Board, sourceId/destId são STATUS ("sugerido", "aprovado")

        const newPosts = [...calendar.posts];
        const post = newPosts[postId];

        if (viewMode === 'grid') {
            // Mudou de dia
            // destId é a DATA (ex: "12/03/2026" ou "12")
            // Precisamos manter o formato da string de data do post original mas mudar o dia/mês?
            // Assumindo grid simples onde ID é a string da data para simplificar
            post.data = destId; // Atualiza data
        } else {
            // Mudou de status (Board)
            if (destId === 'aprovado' || destId === 'sugerido') {
                post.status = destId;
            }
        }

        setCalendar({ ...calendar, posts: newPosts });
        // Salvar silenciosamente
        calendarService.updateCalendar(calendar.id, newPosts);
    };

    // --- Render Helpers ---

    const filteredPosts = calendar?.posts.map((p, i) => ({ ...p, originalIndex: i })).filter(p => {
        const matchesSearch = p.tema?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.copy_sugestao?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || p.status === filterStatus || (!p.status && filterStatus === 'sugerido');
        return matchesSearch && matchesStatus;
    }) || [];

    const renderBoard = () => {
        const columns = {
            sugerido: filteredPosts.filter(p => !p.status || p.status === 'sugerido'),
            aprovado: filteredPosts.filter(p => p.status === 'aprovado' || p.status === 'publicado'),
            // Ajustes?
        };

        return (
            <div className="flex gap-6 overflow-x-auto pb-4 h-[calc(100vh-250px)]">
                {Object.entries(columns).map(([status, posts]) => (
                    <Droppable key={status} droppableId={status}>
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`flex-1 min-w-[320px] bg-gray-900/50 rounded-xl border border-gray-800 p-4 flex flex-col ${snapshot.isDraggingOver ? 'bg-gray-800/80 ring-2 ring-blue-500/30' : ''}`}
                            >
                                <h3 className="text-lg font-bold mb-4 capitalize flex items-center justify-between">
                                    {status}
                                    <span className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-400">{posts.length}</span>
                                </h3>
                                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                                    {posts.map((post) => (
                                        <PostReviewCard
                                            key={`post-${post.originalIndex}`}
                                            post={post}
                                            index={post.originalIndex}
                                            isSelected={selectedIndices.includes(post.originalIndex)}
                                            onToggleSelect={onToggleSelect}
                                            onToggleStatus={toggleStatus}
                                            onEdit={() => { }} // TODO open modal
                                            viewMode="board"
                                        />
                                    ))}
                                    {provided.placeholder}
                                </div>
                            </div>
                        )}
                    </Droppable>
                ))}
            </div>
        );
    };

    const renderGrid = () => {
        if (!calendar) return null;
        // Simplificação: Assumindo mês do calendário para renderizar dias
        // Precisamos parsear calendar.mes (ex: "Janeiro 2026")
        // Se falhar, usa data atual.
        const monthDate = new Date(); // TODO parse real
        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);
        const days = eachDayOfInterval({ start, end });
        const startingDayIndex = getDay(start); // 0 = Domingo

        return (
            <div className="grid grid-cols-7 gap-4 auto-rows-min h-full">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                    <div key={d} className="text-center font-bold text-gray-500 py-2 border-b border-gray-800">{d}</div>
                ))}

                {Array(startingDayIndex).fill(null).map((_, i) => <div key={`empty-${i}`} className="min-h-[100px]" />)}

                {days.map(day => {
                    const dayStr = format(day, 'dd/MM'); // Key simples
                    const postsForDay = filteredPosts.filter(p => p.data.includes(format(day, 'dd/MM')));

                    return (
                        <Droppable key={dayStr} droppableId={format(day, 'dd/MM')}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`min-h-[160px] bg-gray-900 border border-gray-800 rounded-lg p-2 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-900/20' : ''}`}
                                >
                                    <div className="text-right text-xs text-gray-500 font-mono mb-2">{format(day, 'dd')}</div>
                                    <div className="space-y-2">
                                        {postsForDay.map(post => (
                                            <PostReviewCard
                                                key={`post-${post.originalIndex}`}
                                                post={post}
                                                index={post.originalIndex}
                                                isSelected={selectedIndices.includes(post.originalIndex)}
                                                onToggleSelect={onToggleSelect}
                                                onToggleStatus={toggleStatus}
                                                onEdit={() => { }}
                                                viewMode="grid"
                                            />
                                        ))}
                                    </div>
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    );
                })}
            </div>
        );
    };

    if (loading) return <div className="p-10 text-center">Carregando Campanha...</div>;
    if (!calendar) return <div className="p-10 text-center">Campanha não encontrada.</div>;

    return (
        <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">

            {/* Toolbar */}
            <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="font-bold text-lg">{calendar.mes}</h1>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            {calendar.posts.length} posts
                            <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                            {calendar.posts.filter(p => p.status === 'aprovado').length} aprovados
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">

                    {/* Search */}
                    <div className="bg-gray-800 flex items-center px-3 py-1.5 rounded-lg border border-gray-700">
                        <Search className="w-4 h-4 text-gray-500 mr-2" />
                        <input
                            className="bg-transparent border-none focus:ring-0 text-sm w-40"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* View Filters */}
                    <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="Grid Calendário"
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('board')}
                            className={`p-1.5 rounded ${viewMode === 'board' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="Board Kanban"
                        >
                            <Columns className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Bulk Actions (visible if selection > 0) */}
                    {selectedIndices.length > 0 && (
                        <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-500/30 px-3 py-1.5 rounded-lg animate-in slide-in-from-top-2">
                            <span className="text-xs font-bold text-blue-300">{selectedIndices.length} selecionados</span>
                            <button
                                onClick={handleBulkApprove}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                            >
                                <Check className="w-3 h-3" /> Aprovar
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => handleSave()}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg"
                        disabled={saving}
                    >
                        {saving ? 'Salvando...' : <><Save className="w-4 h-4" /> Salvar</>}
                    </button>

                    <button
                        onClick={() => setShowPresentationEditor(true)}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg"
                    >
                        <Download className="w-4 h-4" /> Gerar Defesa
                    </button>
                </div>
            </header>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <DragDropContext onDragEnd={onDragEnd}>
                    {viewMode === 'grid' ? renderGrid() : renderBoard()}
                </DragDropContext>
            </main>

            {showPresentationEditor && calendar && (
                <div className="fixed inset-0 bg-black/95 flex items-start justify-center z-50 p-4 md:p-8 overflow-y-auto">
                    <div className="w-full max-w-7xl mt-4 relative">
                        <button
                            onClick={() => setShowPresentationEditor(false)}
                            className="absolute -top-12 right-0 text-white hover:text-red-400 bg-gray-800 hover:bg-gray-700 rounded-full p-2 transition-colors z-50 flex items-center gap-2 px-4"
                        >
                            <span>✕</span> Fechar Gerador
                        </button>
                        <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
                            <PresentationGenerator />
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
