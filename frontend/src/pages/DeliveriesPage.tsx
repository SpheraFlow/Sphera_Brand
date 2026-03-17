
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    Package,
    Download,
    FileSpreadsheet,
    Image as ImageIcon,
    Clock,
    Plus,
    Loader2
} from 'lucide-react';
import api, { presentationService, calendarService } from '../services/api';
import PresentationGenerator from '../components/PresentationGenerator';
import toast from 'react-hot-toast';

export default function DeliveriesPage() {
    const { clientId } = useParams<{ clientId: string }>();
    const [deliveries, setDeliveries] = useState<any[]>([]); // Mock por enquanto ou History da presentation
    const [loading, setLoading] = useState(true);
    const [generatingExcel, setGeneratingExcel] = useState(false);
    const [showPresentationEditor, setShowPresentationEditor] = useState(false);

    // Novas states de Exportação de Excel (múltiplos meses)
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportMonthsSelected, setExportMonthsSelected] = useState<number[]>([]);

    const [clientName, setClientName] = useState('Cliente');
    const [latestCalendarId, setLatestCalendarId] = useState<string | null>(null);
    const [latestCalendarObj, setLatestCalendarObj] = useState<any>(null);


    // Helpers para Exportação
    const getMonthName = (monthNum: number): string => {
        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return monthNames[monthNum - 1] || `Mês ${monthNum}`;
    };

    const detectMonthsFromCalendar = (cal: any): number[] => {
        const extractMonthNumFromDateStr = (value: string): number | null => {
            const s = String(value || '').trim();
            if (!s) return null;

            let m = s.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
            if (m?.[2]) {
                const monthNum = parseInt(m[2], 10);
                return !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null;
            }

            m = s.match(/(\d{1,2})\-(\d{1,2})(?:\-(\d{2,4}))?/);
            if (m?.[2]) {
                const monthNum = parseInt(m[2], 10);
                return !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null;
            }

            m = s.match(/(\d{4})\-(\d{1,2})\-(\d{1,2})/);
            if (m?.[2]) {
                const monthNum = parseInt(m[2], 10);
                return !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null;
            }

            m = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
            if (m?.[2]) {
                const monthNum = parseInt(m[2], 10);
                return !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null;
            }

            return null;
        };

        const months = new Set<number>();
        for (const p of cal.posts || []) {
            const dateStr = String((p as any)?.data || '');
            const monthNum = extractMonthNumFromDateStr(dateStr);
            if (monthNum) months.add(monthNum);
        }
        return Array.from(months).sort((a, b) => a - b);
    };



    const openExportModal = () => {
        if (!latestCalendarId || !latestCalendarObj) {
            alert('É necessário ter ao menos um calendário criado para gerar o Excel.');
            return;
        }

        // Let's assume the base month is the first item or current month
        let baseMonth = new Date().getMonth() + 1;
        if (latestCalendarObj.mes) {
            const mName = latestCalendarObj.mes.split(' ')[0].toLowerCase();
            const map: Record<string, number> = {
                janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4,
                maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9,
                outubro: 10, novembro: 11, dezembro: 12,
            };
            if (map[mName]) baseMonth = map[mName];
        }

        const defaultSelection = [
            baseMonth,
            baseMonth === 12 ? 1 : baseMonth + 1,
            baseMonth >= 11 ? ((baseMonth + 2) % 12 || 12) : baseMonth + 2,
        ];

        const detected = detectMonthsFromCalendar(latestCalendarObj);

        // Se houver meses detectados, use apenas eles para evitar trimestre vazio.
        // Se não houver nenhum, use o defaultSelection do trimestre completo de fallback.
        const selectionToUse = detected.length > 0
            ? Array.from(new Set([baseMonth, ...detected])).sort((a, b) => a - b)
            : defaultSelection;

        setExportMonthsSelected(selectionToUse);
        setShowExportModal(true);
    };

    const handleExportExcel = async () => {
        if (!latestCalendarId) return;
        try {
            setGeneratingExcel(true);
            const response = await api.post('/calendars/export-excel', {
                calendarId: latestCalendarId,
                clientName: clientName || 'Cliente',
                monthsSelected: exportMonthsSelected,
            }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const disposition = response.headers['content-disposition'] || '';
            const match = disposition.match(/filename="?([^"]+)"?/);
            const fileName = match?.[1] || 'calendario.xlsx';
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Excel baixado com sucesso!');
            setShowExportModal(false);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao gerar Excel. Tente novamente.');
        } finally {
            setGeneratingExcel(false);
        }
    };

    useEffect(() => {
        if (clientId) {
            loadDeliveries();
            loadClientName();
        }
    }, [clientId]);

    const loadClientName = async () => {
        if (!clientId) return;
        try {
            const response = await api.get(`/clients/${clientId}`);
            const name = response.data?.cliente?.nome;
            if (name) {
                setClientName(name);
            }
        } catch (e) {
            console.error('Erro ao carregar nome do cliente:', e);
        }
    };

    const loadDeliveries = async () => {
        try {
            setLoading(true);
            // Backend não tem ainda tabela 'deliveries', mas tem 'presentations' (history)
            // Vou usar History como proxy de entregas já geradas
            try {
                const history = await presentationService.getHistory(clientId!);
                setDeliveries(history);
            } catch (errHist) {
                console.error("Warning: Falha ao carregar historico de apresentacoes", errHist);
                setDeliveries([]);
            }

            // Pegar ID do último calendário para habilitar os botões de Excel e Defesa
            try {
                // Usar endpoint /list que retorna todos os calendários incluindo rascunhos
                const calendars = await calendarService.listCalendars(clientId!, true);
                if (calendars.length > 0) {
                    // Priorizar calendários publicados com posts reais (evitar drafts vazios/falhos)
                    const published = calendars.filter((c: any) => c.status === 'published');
                    const withPosts = published.filter((c: any) => (c.postsCount || 0) > 0);
                    const latest = withPosts[0] || published[0] || calendars[0];
                    setLatestCalendarId(latest.id);

                    // Buscar o array de posts completo desse calendário específico passando o mês
                    try {
                        const calDetailResp = await api.get(`/calendars/${clientId}?month=${encodeURIComponent(latest.mes)}&includeDrafts=true`);
                        if (calDetailResp.data?.calendar) {
                            setLatestCalendarObj(calDetailResp.data.calendar);
                        } else {
                            // Fallback manual 
                            setLatestCalendarObj({ id: latest.id, mes: latest.mes, posts: [] });
                        }
                    } catch (errDetail) {
                        setLatestCalendarObj({ id: latest.id, mes: latest.mes, posts: [] });
                    }
                }
            } catch (_calErr) {
                // Nenhum calendário — latestCalendarId permanece null
            }

            // TODO: Pegar nome do cliente em api.getClients() ou similar, 
            // mas vou deixar genérico ou passar se já tiver no context

        } catch (error) {
            console.error('Erro ao carregar entregas', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto text-white space-y-8">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Central de Entregas</h1>
                    <p className="text-gray-400">Gere planilhas automatizadas ou crie defesas de marca editáveis.</p>
                </div>
            </div>

            {/* Ações de Geração */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Card 1: Excel */}
                <div className="bg-gray-800 border-2 border-green-500/20 rounded-2xl p-6 hover:border-green-500/50 transition-colors flex flex-col justify-between">
                    <div>
                        <div className="bg-green-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-green-400 mb-4">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Planilha de Conteúdo</h3>
                        <p className="text-sm text-gray-400 mb-6">Geração automática do arquivo Excel (.xlsx) contendo todos os posts e datas do último calendário aprovado.</p>
                    </div>
                    <button
                        onClick={openExportModal}
                        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                    >
                        <Download className="w-5 h-5" />
                        Selecionar Meses e Baixar
                    </button>
                </div>

                {/* Card 2: Apresentação */}
                <div className="bg-gray-800 border-2 border-purple-500/20 rounded-2xl p-6 hover:border-purple-500/50 transition-colors flex flex-col justify-between">
                    <div>
                        <div className="bg-purple-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-purple-400 mb-4">
                            <ImageIcon className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Defesa de Estratégia</h3>
                        <p className="text-sm text-gray-400 mb-6">A IA prepara os textos (subtítulo, metas, desafios) e você pode editá-los e revisá-los livremente antes de gerar os slides visuais.</p>
                    </div>
                    <button
                        onClick={() => {
                            if (!latestCalendarId) {
                                alert('É necessário ter ao menos um calendário criado para gerar a Defesa.');
                                return;
                            }
                            setShowPresentationEditor(true);
                        }}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                    >
                        <Plus className="w-5 h-5" />
                        Criar e Editar Lâminas
                    </button>
                </div>
            </div>

            <div className="pt-8 border-t border-gray-800">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-400" />
                    Histórico de Entregas
                </h2>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2].map(i => <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse"></div>)}
                    </div>
                ) : deliveries.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {deliveries.map((delivery) => {
                            const isExcel = delivery.tipo === 'excel';
                            const isSlides = delivery.tipo === 'laminas';

                            return (
                                <div key={delivery.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center ${isExcel ? 'text-green-400' : 'text-purple-400'}`}>
                                            {isExcel ? <FileSpreadsheet className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-white">{delivery.titulo || 'Entrega sem Título'}</h3>
                                                {isExcel && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 uppercase font-bold">
                                                        Excel
                                                    </span>
                                                )}
                                                {isSlides && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase font-bold">
                                                        Lâminas
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(delivery.criado_em).toLocaleDateString()}
                                                </span>
                                                <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                                <span>
                                                    {isExcel ? 'Planilha' : `${Array.isArray(delivery.arquivos) ? delivery.arquivos.length : 0} lâminas`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        {Array.isArray(delivery.arquivos) && delivery.arquivos.length > 0 && (
                                            <button
                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors font-medium ${isExcel
                                                    ? 'bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30'
                                                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                                                    }`}
                                                onClick={() => {
                                                    const url = delivery.arquivos[0].startsWith('http')
                                                        ? delivery.arquivos[0]
                                                        : `${api.defaults.baseURL?.replace('/api', '')}${delivery.arquivos[0]}`;
                                                    window.open(url, '_blank');
                                                }}
                                            >
                                                {isExcel ? (
                                                    <><Download className="w-4 h-4" /> Baixar Planilha</>
                                                ) : (
                                                    <><ImageIcon className="w-4 h-4 text-purple-400" /> Visualizar Lâminas</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-gray-800/30 rounded-2xl border-2 border-dashed border-gray-700">
                        <div className="bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Package className="w-8 h-8 text-gray-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Nenhuma entrega registrada</h3>
                        <p className="text-gray-400 mb-6 max-w-md mx-auto">
                            Gere pacotes de entrega (Excel + Apresentação) a partir dos seus calendários aprovados.
                        </p>
                    </div>
                )}
            </div>

            {/* Modal de Edição de Apresentação */}
            {showPresentationEditor && latestCalendarId && (
                <div className="fixed inset-0 bg-black/95 flex items-start justify-center z-50 p-4 md:p-8 overflow-y-auto">
                    <div className="w-full max-w-7xl mt-4 relative">
                        <button
                            onClick={() => {
                                setShowPresentationEditor(false);
                                loadDeliveries(); // Recarregar lista ao fechar
                            }}
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

            {/* Modal de Exportação Excel */}
            {showExportModal && latestCalendarObj && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-white">📊 Exportar Excel</h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Selecione os meses que deseja incluir na planilha
                                </p>
                            </div>
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4 mb-5">
                            <>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <button
                                        onClick={() => setExportMonthsSelected([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
                                        className="text-xs px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors"
                                    >
                                        ✓ Selecionar Todos
                                    </button>
                                    <button
                                        onClick={() => setExportMonthsSelected([])}
                                        className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                                    >
                                        ✕ Limpar Seleção
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                                        const checked = exportMonthsSelected.includes(m);
                                        return (
                                            <button
                                                key={m}
                                                onClick={() => {
                                                    if (checked) {
                                                        setExportMonthsSelected((prev) => prev.filter((x) => x !== m));
                                                    } else {
                                                        setExportMonthsSelected((prev) => Array.from(new Set([...prev, m])).sort((a, b) => a - b));
                                                    }
                                                }}
                                                className={`relative px-4 py-3 rounded-lg font-medium transition-all text-sm
                                                        ${checked
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400'
                                                        : 'bg-gray-900/50 text-gray-300 border-2 border-gray-700 hover:border-blue-500/50 hover:bg-gray-900'
                                                    }`}
                                            >
                                                {checked && <span className="absolute top-1 right-1 text-xs">✓</span>}
                                                <div className="text-center">{getMonthName(m)}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                disabled={generatingExcel}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExportExcel}
                                disabled={generatingExcel || exportMonthsSelected.length === 0}
                                className="bg-green-600 hover:bg-green-700 disabled:bg-green-900 px-5 py-2 rounded-lg font-semibold transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
                            >
                                {generatingExcel ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                                ) : (
                                    <><Download className="w-4 h-4" /> Baixar Excel</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
