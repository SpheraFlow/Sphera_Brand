
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    Calendar,
    Clock,
    Eye,
    BarChart2,
    Layers
} from 'lucide-react';
import { calendarService } from '../services/api';

interface CalendarSummary {
    id: string;
    mes: string;
    periodo: number;
    status: 'draft' | 'published';
    postsCount: number;
    criadoEm: string;
    updatedAt: string;
    jobId: string | null;
    jobStatus: string | null;
    jobStep: string | null;
}

export default function CampaignsList() {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (clientId) {
            loadCalendars();
        }
    }, [clientId]);

    const loadCalendars = async () => {
        try {
            setLoading(true);
            const data = await calendarService.listCalendars(clientId!, true);
            setCalendars(data);
        } catch (error) {
            console.error('Erro ao carregar calendários:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredCalendars = calendars.filter(c =>
        c.mes.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (cal: CalendarSummary) => {
        if (cal.status === 'draft') {
            return (
                <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-yellow-900/40 text-yellow-400 border border-yellow-700/50">
                    Rascunho
                </span>
            );
        }
        return (
            <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-green-900/40 text-green-400 border border-green-700/50">
                Publicado
            </span>
        );
    };

    const getPeriodLabel = (periodo: number) => {
        if (periodo === 15) return 'Quinzenal';
        if (periodo === 30) return 'Mensal';
        if (periodo === 90) return 'Trimestral';
        return `${periodo} dias`;
    };

    // Navegar para CalendarPage no mês correto
    const viewCalendar = (cal: CalendarSummary) => {
        navigate(`/client/${clientId}/calendar?month=${encodeURIComponent(cal.mes)}`);
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto text-white space-y-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Calendários Gerados</h1>
                    <p className="text-gray-400">Histórico de calendários editoriais criados pela IA</p>
                </div>
                <button
                    onClick={() => navigate(`/client/${clientId}/campaigns/new`)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
                >
                    <Plus className="w-4 h-4" />
                    Nova Campanha
                </button>
            </div>

            {/* Search */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center gap-3">
                <Search className="w-4 h-4 text-gray-500 shrink-0" />
                <input
                    type="text"
                    placeholder="Buscar por mês... (ex: Março 2026)"
                    className="bg-transparent border-none focus:ring-0 text-sm text-white placeholder-gray-500 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* List */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse" />)}
                </div>
            ) : filteredCalendars.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {filteredCalendars.map((cal) => (
                        <div
                            key={cal.id}
                            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl p-5 transition-all group relative overflow-hidden cursor-pointer"
                            onClick={() => viewCalendar(cal)}
                        >
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">

                                {/* Info Principal */}
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className="w-12 h-12 bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-400 shrink-0">
                                        <Calendar className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                                            {cal.mes}
                                        </h3>
                                        <div className="flex items-center gap-3 text-sm text-gray-400 mt-1 flex-wrap">
                                            <span className="flex items-center gap-1">
                                                <Layers className="w-3 h-3" />
                                                {cal.postsCount} posts
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <BarChart2 className="w-3 h-3" />
                                                {getPeriodLabel(cal.periodo)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(cal.criadoEm).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status & Actions */}
                                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                    {getStatusBadge(cal)}
                                    <button
                                        className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                                        title="Ver Calendário"
                                        onClick={(e) => { e.stopPropagation(); viewCalendar(cal); }}
                                    >
                                        <Eye className="w-5 h-5" />
                                    </button>
                                </div>

                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-gray-800 rounded-xl border border-gray-700/50 p-12 text-center">
                    <div className="bg-gray-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Calendar className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Nenhum calendário gerado ainda</h3>
                    <p className="text-gray-400 max-w-sm mx-auto mb-8">
                        Crie sua primeira campanha editorial com IA e os calendários aparecerão aqui.
                    </p>
                    <button
                        onClick={() => navigate(`/client/${clientId}/campaigns/new`)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/20"
                    >
                        Criar Campanha Inteligente
                    </button>
                </div>
            )}

        </div>
    );
}
