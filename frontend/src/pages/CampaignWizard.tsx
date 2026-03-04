import { useState, useEffect } from 'react';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    Calendar,
    Layers,
    FileText,
    CheckCircle,
    Zap,
    Play,
    Minus,
    Plus,
    ChevronDown,
    ChevronUp,
    Camera,
    LayoutGrid,
    BookOpen
} from 'lucide-react';
import { ContentMix, useCampaignWizard } from '../hooks/useCampaignWizard';
import { calendarService, produtosService, Produto, datasComemorvativasService, DataComemorativa, brandingService, BrandingData } from '../services/api';

const STEPS = [
    { id: 1, label: 'Objetivo & Período', icon: Calendar },
    { id: 2, label: 'Mix de Conteúdo', icon: Layers },
    { id: 3, label: 'Briefing', icon: FileText },
    { id: 4, label: 'Revisão', icon: CheckCircle },
];

export default function CampaignWizard() {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const {
        currentStep,
        data,
        updateData,
        updateMix,
        updateMonthMix,
        enableMonthlyMode,
        disableMonthlyMode,
        nextStep,
        prevStep,
        validateStep,
        clearDraft
    } = useCampaignWizard();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [jobStarted, setJobStarted] = useState<{ id: string } | null>(null);
    const [availableProducts, setAvailableProducts] = useState<Produto[]>([]);
    const [commemorativeDates, setCommemorativeDates] = useState<DataComemorativa[]>([]);
    const [clientNiche, setClientNiche] = useState<string | null>(null);
    const [showAllDates, setShowAllDates] = useState(false);

    // Estado para saber se já tentamos carregar o nicho (evita dupla busca de datas)
    const [nicheLoaded, setNicheLoaded] = useState(false);

    useEffect(() => {
        if (clientId) {
            produtosService.getProdutos(clientId, true).then(setAvailableProducts).catch(console.error);
            brandingService.getBranding(clientId)
                .then((b: BrandingData) => {
                    if (b?.niche) {
                        setClientNiche(b.niche);
                    }
                })
                .catch(() => {
                    // Cliente sem branding ou sem nicho — ignorar silenciosamente
                })
                .finally(() => {
                    // Marcar como carregado mesmo se falhou (libera a busca de datas)
                    setNicheLoaded(true);
                });
        }
    }, [clientId]);

    useEffect(() => {
        if (data.selectedMonths.length === 0) {
            setCommemorativeDates([]);
            return;
        }
        // Busca imediatamente quando meses mudam, sem bloquear no nicho.
        // Se nicheLoaded=false, busca sem filtro (mostra tudo ao usuário).
        // Quando o nicho carregar (nicheLoaded=true), re-busca com filtro refinado.
        const nichoParaBusca = (nicheLoaded && !showAllDates && clientNiche) ? clientNiche : undefined;
        datasComemorvativasService.getByMonths(data.selectedMonths, nichoParaBusca)
            .then(setCommemorativeDates)
            .catch(console.error);
    }, [data.selectedMonths, clientNiche, showAllDates, nicheLoaded]);

    const handleFinish = async () => {
        if (!clientId) return;

        try {
            setIsSubmitting(true);

            // Incluir informações das datas selecionadas no briefing
            const selectedDatesInfo = commemorativeDates
                .filter(d => data.selectedDateIds.includes(d.id))
                .map(d => `- ${new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')} | ${d.titulo}: ${d.descricao || ''}`)
                .join('\n');

            // Combinar briefing com restrições
            const fullBriefing = `
OBJECTIVE: ${data.goal}
BRIEFING: ${data.briefing}
RESTRICTIONS: ${data.restrictions}
USER REMINDER DATES: ${data.importantDates}
SELECTED COMMEMORATIVE DATES:
${selectedDatesInfo || 'Nenhuma data específica selecionada.'}
      `.trim();

            const formatInstructions = {
                carousel: data.carouselSlideCount && data.carouselSlideCount !== 'auto'
                    ? `Obrigatório: Divida o carrossel em exatamente ${data.carouselSlideCount} slides estruturados. Descreva cada slide com a notação [Slide 1] ..., [Slide 2] ..., etc.`
                    : `Obrigatório: Divida o carrossel em slides e descreva cada um com a notação [Slide 1] ..., [Slide 2] ..., etc.`
            };

            const response = await calendarService.generateCalendar(
                clientId,
                30,
                fullBriefing,
                '',
                data.mix,
                data.produtosFocoIds,
                data.selectedMonths,
                data.monthlyMix || undefined,  // per-month mix, se ativo
                formatInstructions
            );

            if (response.success && response.jobId) {
                // Salvar no localStorage para que CalendarPage detecte o job ao retornar
                localStorage.setItem('pendingCalendarJob', JSON.stringify({
                    jobId: response.jobId,
                    clientId,
                    firstMonth: data.selectedMonths[0] || null  // mês gerado para navegar corretamente
                }));
                setJobStarted({ id: response.jobId });
                clearDraft();
            } else {
                alert('Erro ao iniciar geração: ' + response.message);
            }

        } catch (error: any) {
            console.error(error);
            alert('Erro ao criar campanha: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsSubmitting(false);
        }
    };



    // --- Sub-components para cada passo --- //

    const Step1 = () => {
        // Include current month + next 11 months (total 12)
        const next12Months = Array.from({ length: 12 }).map((_, i) => {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() + i);
            const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);
            return label.charAt(0).toUpperCase() + label.slice(1);
        });

        const toggleMonth = (month: string) => {
            const current = data.selectedMonths;
            if (current.includes(month)) {
                updateData({ selectedMonths: current.filter(m => m !== month) });
            } else {
                updateData({ selectedMonths: [...current, month] });
            }
        };

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Qual o objetivo principal desta campanha?</label>
                    <input
                        type="text"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: Aumentar vendas de Black Friday, Lançamento de nova coleção..."
                        value={data.goal}
                        onChange={e => updateData({ goal: e.target.value })}
                        autoFocus
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-3">Selecione os meses para a geração</label>
                    <p className="text-xs text-gray-500 mb-4">Você pode selecionar um ou mais meses para gerar o conteúdo planejado.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {next12Months.map(month => {
                            const isSelected = data.selectedMonths.includes(month);
                            return (
                                <button
                                    key={month}
                                    onClick={() => toggleMonth(month)}
                                    className={`p-3 rounded-xl border text-left transition-all relative ${isSelected ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:bg-gray-750'}`}
                                >
                                    <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>{month}</div>
                                    {isSelected && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500"></div>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const CONTENT_TYPES: { key: keyof ContentMix; label: string; icon: React.ElementType; color: string; desc: string }[] = [
        { key: 'reels', label: 'Reels', icon: Play, color: 'text-pink-400', desc: 'Vídeo curto' },
        { key: 'static', label: 'Estático', icon: LayoutGrid, color: 'text-blue-400', desc: 'Post imagem' },
        { key: 'carousel', label: 'Carrossel', icon: Layers, color: 'text-purple-400', desc: 'Educativo' },
        { key: 'stories', label: 'Stories', icon: Zap, color: 'text-yellow-400', desc: 'Sequência' },
        { key: 'photos', label: 'Ideias de Foto', icon: Camera, color: 'text-emerald-400', desc: 'Fotografia' },
    ];

    const MixStepper = ({
        mix, onUpdate, compact = false
    }: { mix: ContentMix; onUpdate: (key: keyof ContentMix, delta: number) => void; compact?: boolean }) => (
        <div className={`grid gap-2 ${compact ? 'grid-cols-5' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'}`}>
            {CONTENT_TYPES.map(({ key, label, icon: Icon, color, desc }) => (
                <div key={key} className={`bg-gray-900 border border-gray-700 rounded-xl p-3 flex flex-col items-center gap-2 hover:border-gray-600 transition-colors ${mix[key] > 0 ? 'border-gray-600 ring-1 ring-gray-600/40' : ''}`}>
                    {!compact && (
                        <div className="text-center">
                            <Icon className={`w-5 h-5 ${color} mx-auto mb-0.5`} />
                            <div className="text-xs font-semibold text-white leading-tight">{label}</div>
                            <div className="text-[10px] text-gray-500">{desc}</div>
                        </div>
                    )}
                    {compact && <div className={`text-[9px] font-bold uppercase ${color} tracking-wide`}>{label.split(' ')[0]}</div>}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => onUpdate(key, -1)}
                            disabled={mix[key] <= 0}
                            className="w-6 h-6 rounded-md bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <Minus className="w-3 h-3" />
                        </button>
                        <input
                            type="number"
                            min="0"
                            value={mix[key]}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val >= 0) {
                                    // Calculate delta to pass to onUpdate
                                    const delta = val - mix[key];
                                    onUpdate(key, delta);
                                } else if (e.target.value === '') {
                                    // Handle empty input temporarily
                                    const delta = 0 - mix[key];
                                    onUpdate(key, delta);
                                }
                            }}
                            className="w-10 text-center font-bold text-sm text-white bg-transparent border-none appearance-none focus:ring-1 focus:ring-blue-500 rounded p-0 m-0 no-spinners"
                            style={{ WebkitAppearance: 'none', margin: 0 }}
                        />
                        <button
                            onClick={() => onUpdate(key, 1)}
                            className="w-6 h-6 rounded-md bg-blue-700 hover:bg-blue-600 flex items-center justify-center text-white transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );

    const mixTotal = (mix: ContentMix) => Object.values(mix).reduce((a, b) => a + b, 0);

    const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
    const isPerMonth = data.monthlyMix !== null;
    const multipleMonths = data.selectedMonths.length > 1;

    const Step2 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-2">
                <h3 className="text-xl font-bold mb-1">Mix de Conteúdo</h3>
                <p className="text-gray-400 text-sm">
                    {multipleMonths
                        ? 'Configure as quantidades de cada formato por mês ou use um mix global.'
                        : 'Defina a quantidade de cada formato para o mês.'}
                </p>
            </div>

            {/* Toggle Global / Por Mês (só aparece com 2+ meses) */}
            {multipleMonths && (
                <div className="flex bg-gray-900 border border-gray-700 rounded-xl p-1 gap-1">
                    <button
                        onClick={() => disableMonthlyMode()}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${!isPerMonth
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        🌐 Mix Global
                    </button>
                    <button
                        onClick={() => enableMonthlyMode()}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${isPerMonth
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        📅 Por Mês
                    </button>
                </div>
            )}

            {/* Modo Global */}
            {!isPerMonth && (
                <div className="space-y-4">
                    <MixStepper
                        mix={data.mix}
                        onUpdate={(key, delta) => updateMix(key, delta)}
                    />
                    {multipleMonths && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2">
                            <BookOpen className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                            <span>O mix será distribuído automaticamente entre os {data.selectedMonths.length} meses selecionados.</span>
                        </div>
                    )}
                </div>
            )}

            {/* Modo Por Mês */}
            {isPerMonth && data.monthlyMix && (
                <div className="space-y-3">
                    {data.selectedMonths.map(month => {
                        const monthMix = data.monthlyMix![month] || data.mix;
                        const total = mixTotal(monthMix);
                        const isOpen = expandedMonth === month;
                        return (
                            <div key={month} className={`border rounded-xl overflow-hidden transition-all ${isOpen ? 'border-purple-500/60 bg-gray-800/80' : 'border-gray-700 bg-gray-800/40'
                                }`}>
                                {/* Header do mês */}
                                <button
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-700/30 transition-colors"
                                    onClick={() => setExpandedMonth(isOpen ? null : month)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full ${total > 0 ? 'bg-purple-400' : 'bg-gray-600'}`} />
                                        <span className="font-semibold text-white text-sm">{month}</span>
                                        {total > 0 && (
                                            <div className="flex gap-1.5 flex-wrap">
                                                {CONTENT_TYPES.filter(t => monthMix[t.key] > 0).map(t => (
                                                    <span key={t.key} className={`text-[10px] font-medium ${t.color} bg-gray-700 px-1.5 py-0.5 rounded`}>
                                                        {monthMix[t.key]} {t.label.split(' ')[0]}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-bold ${total > 0 ? 'text-purple-300' : 'text-gray-500'}`}>
                                            {total > 0 ? `${total} posts` : 'vazio'}
                                        </span>
                                        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                    </div>
                                </button>

                                {/* Steppers expandidos */}
                                {isOpen && (
                                    <div className="px-4 pb-4 border-t border-gray-700/60">
                                        <div className="pt-3">
                                            <MixStepper
                                                mix={monthMix}
                                                onUpdate={(key, delta) => updateMonthMix(month, key, delta)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Sumário total */}
                    <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-gray-400">Total geral</span>
                        <span className="text-lg font-bold text-white">
                            {data.selectedMonths.reduce((sum, m) => sum + mixTotal(data.monthlyMix![m] || data.mix), 0)} posts
                        </span>
                    </div>
                </div>
            )}

            {/* Totalizador modo global */}
            {!isPerMonth && (
                <div className="bg-gradient-to-r from-gray-800 to-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-gray-400">Total
                            {multipleMonths ? ` (${data.selectedMonths.length} meses)` : ''}
                        </span>
                    </div>
                    <span className="text-lg font-bold text-white">
                        {mixTotal(data.mix)}{multipleMonths ? ` posts/mês` : ' posts'}
                    </span>
                </div>
            )}

            {/* Configuração de Tamanho do Carrossel */}
            {((!isPerMonth && data.mix.carousel > 0) || (isPerMonth && data.selectedMonths.some(m => (data.monthlyMix?.[m]?.carousel || 0) > 0))) && (
                <div className="bg-purple-900/10 border border-purple-500/30 rounded-xl p-4 mt-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <label className="block text-sm font-semibold text-purple-300">
                            Tamanho padrão dos Carrosséis
                        </label>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                        Força a IA a gerar textos e ideias visuais separadas exatamente pelo número de slides escolhido.
                    </p>
                    <select
                        value={data.carouselSlideCount || 'auto'}
                        onChange={e => updateData({ carouselSlideCount: e.target.value })}
                        className="w-full bg-gray-900 border border-purple-500/20 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    >
                        <option value="auto">Automático (Recomendado) - A IA decide a quantidade</option>
                        {[3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <option key={num} value={String(num)}>Fixo: exatamente {num} slides estruturados</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );

    const Step3 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Briefing Detalhado</label>
                <textarea
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Descreva o tom, a mensagem chave e o que deve ser evitado..."
                    value={data.briefing}
                    onChange={e => updateData({ briefing: e.target.value })}
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Datas Importantes / Feriados Específicos</label>
                <p className="text-xs text-gray-500 mb-2">Adicione datas extras relevantes para esta campanha.</p>
                <textarea
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white h-20 focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
                    placeholder="Ex: Aniversário da empresa dia 15, promoção especial dia 20..."
                    value={data.importantDates}
                    onChange={e => updateData({ importantDates: e.target.value })}
                />
            </div>

            {commemorativeDates.length > 0 && (() => {
                const getCategoryStyle = (cats: string[]) => {
                    const cat = (cats?.[0] || '').toLowerCase();
                    if (cat.includes('feriado nacional') || cat.includes('feriado')) {
                        return { border: 'border-red-500/40', bg: 'bg-red-900/20', badge: 'bg-red-500/20 text-red-300', dot: 'bg-red-400', dayColor: 'text-red-300', ring: 'ring-red-500' };
                    }
                    if (cat.includes('saúde') || cat.includes('bem-estar')) {
                        return { border: 'border-green-500/40', bg: 'bg-green-900/20', badge: 'bg-green-500/20 text-green-300', dot: 'bg-green-400', dayColor: 'text-green-300', ring: 'ring-green-500' };
                    }
                    if (cat.includes('comércio') || cat.includes('negócio') || cat.includes('consumo')) {
                        return { border: 'border-blue-500/40', bg: 'bg-blue-900/20', badge: 'bg-blue-500/20 text-blue-300', dot: 'bg-blue-400', dayColor: 'text-blue-300', ring: 'ring-blue-500' };
                    }
                    if (cat.includes('cultura') || cat.includes('arte')) {
                        return { border: 'border-purple-500/40', bg: 'bg-purple-900/20', badge: 'bg-purple-500/20 text-purple-300', dot: 'bg-purple-400', dayColor: 'text-purple-300', ring: 'ring-purple-500' };
                    }
                    if (cat.includes('família') || cat.includes('social')) {
                        return { border: 'border-pink-500/40', bg: 'bg-pink-900/20', badge: 'bg-pink-500/20 text-pink-300', dot: 'bg-pink-400', dayColor: 'text-pink-300', ring: 'ring-pink-500' };
                    }
                    return { border: 'border-yellow-500/40', bg: 'bg-yellow-900/20', badge: 'bg-yellow-500/20 text-yellow-300', dot: 'bg-yellow-400', dayColor: 'text-yellow-300', ring: 'ring-yellow-500' };
                };
                return (
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                <span>📅</span>
                                <span>Datas {showAllDates ? 'de todos os nichos' : `da categoria ${clientNiche || 'foco'}`} selecionadas:</span>
                            </p>
                            <button
                                onClick={() => setShowAllDates(!showAllDates)}
                                className={`text-[10px] uppercase font-bold px-2 py-1 rounded transition-all ${showAllDates ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                            >
                                {showAllDates ? 'Ver Sugestões do Nicho' : 'Ver Todas as Datas'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                            {commemorativeDates.map(d => {
                                const style = getCategoryStyle(d.categorias);
                                const dateObj = new Date(d.data + 'T00:00:00');
                                const day = dateObj.toLocaleDateString('pt-BR', { day: '2-digit' });
                                const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                                const isSelected = data.selectedDateIds?.includes(d.id);
                                return (
                                    <button
                                        key={d.id}
                                        onClick={() => {
                                            const current = data.selectedDateIds || [];
                                            if (isSelected) updateData({ selectedDateIds: current.filter(id => id !== d.id) });
                                            else updateData({ selectedDateIds: [...current, d.id] });
                                        }}
                                        className={`rounded-xl border transition-all text-left flex flex-col gap-1.5 relative overflow-hidden ${style.bg} ${isSelected ? `ring-2 ${style.ring} ${style.border}` : `${style.border} opacity-50 grayscale-[0.5] hover:opacity-100 hover:grayscale-0`}`}
                                    >
                                        <div className={`absolute top-0 left-0 w-1 h-full ${style.dot}`} />
                                        <div className={`text-lg font-black leading-none ${style.dayColor} pl-2 pt-3`}>
                                            {day}
                                            <span className="text-xs font-semibold ml-1 opacity-70 uppercase">{monthName}</span>
                                        </div>
                                        <p className="text-white text-xs font-medium leading-snug pl-2 line-clamp-2">{d.titulo}</p>
                                        <div className="flex items-center justify-between pl-2 pr-2 pb-2">
                                            {d.categorias?.length > 0 && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${style.badge}`}>
                                                    {d.categorias[0]}
                                                </span>
                                            )}
                                            {isSelected && <span className="text-white">✓</span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Restrições (O que NÃO fazer)</label>
                <input
                    type="text"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Ex: Não usar cor vermelha, não citar concorrentes..."
                    value={data.restrictions}
                    onChange={e => updateData({ restrictions: e.target.value })}
                />
            </div>

            {availableProducts.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-3">Produtos em Foco (Opcional)</label>
                    <p className="text-xs text-gray-500 mb-3">Selecione os produtos que devem ser o foco principal das vendas nesta campanha.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {availableProducts.map(produto => {
                            const isSelected = data.produtosFocoIds?.includes(produto.id);
                            return (
                                <button
                                    key={produto.id}
                                    onClick={() => {
                                        const current = data.produtosFocoIds || [];
                                        if (isSelected) updateData({ produtosFocoIds: current.filter(id => id !== produto.id) });
                                        else updateData({ produtosFocoIds: [...current, produto.id] });
                                    }}
                                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${isSelected ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:bg-gray-750'}`}
                                >
                                    <div className="font-bold text-sm text-white mb-1 truncate">{produto.nome}</div>
                                    <div className="text-xs text-gray-400 truncate">{produto.categoria || 'Sem categoria'}</div>
                                    {isSelected && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500"></div>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    const Step4 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-gradient-to-br from-green-900/20 to-gray-800 border border-green-500/30 rounded-xl p-6 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-400">
                    <CheckCircle className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Tudo pronto!</h2>
                <p className="text-gray-400 max-w-md mx-auto">
                    Revise as informações abaixo antes de iniciar a geração da campanha com IA.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <span className="block text-gray-500 mb-1">Objetivo</span>
                    <strong className="text-white text-lg block">{data.goal}</strong>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <span className="block text-gray-500 mb-1">Período Selecionado</span>
                    <strong className="text-white text-lg block">
                        {data.selectedMonths.join(', ')}
                    </strong>
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <span className="block text-gray-500 mb-2">Briefing & Contexto</span>
                <p className="text-white text-sm whitespace-pre-wrap mb-4">{data.briefing}</p>

                {data.restrictions && (
                    <div className="mb-4">
                        <span className="block text-gray-500 mb-1">Restrições</span>
                        <p className="text-red-400 text-sm bg-red-900/10 p-2 rounded -ml-2">{data.restrictions}</p>
                    </div>
                )}

                {data.importantDates && (
                    <div className="mb-4">
                        <span className="block text-gray-500 mb-1">Datas Importantes</span>
                        <p className="text-yellow-400 text-sm bg-yellow-900/10 p-2 rounded -ml-2">{data.importantDates}</p>
                    </div>
                )}

                {data.produtosFocoIds && data.produtosFocoIds.length > 0 && (
                    <div>
                        <span className="block text-gray-500 mb-2">Produtos em Foco</span>
                        <div className="flex flex-wrap gap-2">
                            {data.produtosFocoIds.map(id => {
                                const prod = availableProducts.find(p => p.id === id);
                                return prod ? (
                                    <span key={id} className="bg-blue-900/30 text-blue-300 border border-blue-700/50 px-3 py-1 rounded-full text-xs">
                                        {prod.nome}
                                    </span>
                                ) : null;
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    // Modal de Job Iniciado
    if (jobStarted) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Zap className="w-10 h-10 text-blue-400 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Campanha Iniciada!</h2>
                    <p className="text-gray-400 mb-6">
                        A IA começou a gerar o conteúdo baseada no seu briefing. Isso pode levar alguns minutos.
                    </p>

                    <div className="bg-gray-800 rounded-lg p-3 mb-6 font-mono text-xs text-gray-500">
                        ID: {jobStarted.id}
                    </div>

                    <button
                        onClick={() => {
                            // Navegar direto para o CalendarPage para ver o progresso
                            const firstMonth = data.selectedMonths[0];
                            const target = firstMonth
                                ? `/client/${clientId}/calendar?month=${encodeURIComponent(firstMonth)}`
                                : `/client/${clientId}/calendar`;
                            navigate(target);
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all"
                    >
                        Ver Calendário
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col">

            {/* Header Simplificado */}
            <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10 px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Voltar
                    </button>
                    <h1 className="font-bold">Nova Campanha</h1>
                    <div className="w-20"></div> {/* Spacer */}
                </div>
            </header>

            <div className="flex-1 max-w-3xl mx-auto w-full p-6 pb-24">

                {/* Stepper Progress */}
                <div className="flex items-center justify-between mb-8 relative">
                    <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-800 -z-10"></div>
                    {STEPS.map((step) => {
                        const isActive = step.id === currentStep;
                        const isCompleted = step.id < currentStep;
                        return (
                            <div key={step.id} className="flex flex-col items-center gap-2 bg-gray-950 px-2">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-900/50' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
                                    {isCompleted ? <CheckCircle className="w-6 h-6" /> : <step.icon className="w-5 h-5" />}
                                </div>
                                <span className={`text-xs font-medium ${isActive ? 'text-blue-400' : isCompleted ? 'text-green-500' : 'text-gray-600'}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 md:p-8 min-h-[400px]">
                    {currentStep === 1 && Step1()}
                    {currentStep === 2 && Step2()}
                    {currentStep === 3 && Step3()}
                    {currentStep === 4 && Step4()}
                </div>

            </div>

            {/* Footer Navigation */}
            <footer className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 z-10">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <button
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                    >
                        Voltar
                    </button>

                    <div className="flex items-center gap-4">
                        {currentStep < 4 ? (
                            <button
                                onClick={nextStep}
                                disabled={!validateStep(currentStep)}
                                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
                            >
                                Próximo <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleFinish}
                                disabled={isSubmitting}
                                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-green-900/20"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                                        Processando...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4" />
                                        Gerar Campanha
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </footer>

        </div>
    );
}
