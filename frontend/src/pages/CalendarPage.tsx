import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import ContentMixSelector from '../components/ContentMixSelector';
import PhotoIdeasModal from '../components/PhotoIdeasModal';
 
import api from '../services/api';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  addMonths,
  subMonths,
  getDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Post {
  data: string;
  tema: string;
  formato: string;
  ideia_visual: string;
  copy_sugestao: string;
  objetivo: string;
  image_generation_prompt?: string;
  referencias?: string; // links, fotos, notas de referência
  status?: 'sugerido' | 'aprovado' | 'publicado';
}

interface ContentMix {
  reels: number;
  static: number;
  carousel: number;
  stories: number;
  photos: number;
}

interface FormatInstructions {
  reels: string;
  static: string;
  carousel: string;
  stories: string;
  photos: string;
}

interface Calendar {
  id: string;
  clienteId: string;
  mes: string;
  posts: Post[];
  periodo: number;
  criadoEm: string;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function CalendarPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [clientName, setClientName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<{ post: Post; index: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [periodoDias, setPeriodoDias] = useState<number>(30);
  const [specificMonths, setSpecificMonths] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [isRegeneratingPost, setIsRegeneratingPost] = useState(false);
  const [showPhotoIdeasModal, setShowPhotoIdeasModal] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMonthsSelected, setExportMonthsSelected] = useState<number[]>([]);

  // Estados para geração
  const [briefing, setBriefing] = useState('');
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [selectedChainId, setSelectedChainId] = useState<string>('');
  const [promptChains, setPromptChains] = useState<any[]>([]);
  const [mix, setMix] = useState<ContentMix>({
    reels: 0,
    static: 0,
    carousel: 0,
    stories: 0,
    photos: 0
  });

  // Estados para edição do post
  const [editTema, setEditTema] = useState('');
  const [editCopy, setEditCopy] = useState('');
  const [editData, setEditData] = useState('');
  const [editFormato, setEditFormato] = useState('');
  const [editIdeiaVisual, setEditIdeiaVisual] = useState('');
  const [editImagePrompt, setEditImagePrompt] = useState('');
  const [editObjetivo, setEditObjetivo] = useState('');
  const [editReferencias, setEditReferencias] = useState('');
  const [editStatus, setEditStatus] = useState<'sugerido' | 'aprovado' | 'publicado'>('sugerido');
  const [regenPostPrompt, setRegenPostPrompt] = useState('');

  // Instruções por formato e referências do mês
  const [formatInstructions, setFormatInstructions] = useState<FormatInstructions>({
    reels: '',
    static: '',
    carousel: '',
    stories: '',
    photos: '',
  });
  const [monthReferences, setMonthReferences] = useState('');
  const [monthImages, setMonthImages] = useState<string[]>([]); // URLs das imagens
  const [showMonthReferencesModal, setShowMonthReferencesModal] = useState(false);
  
  useEffect(() => {
    if (clientId) {
      loadCalendar();
      loadPromptChains();
      loadClientName();
    }
  }, [clientId, currentMonth]); // Recarregar quando o mês mudar

  const loadClientName = async () => {
    if (!clientId) return;
    try {
      const response = await api.get(`/clients/${clientId}`);
      const name = response.data?.cliente?.nome;
      if (name) {
        setClientName(name);
      }
    } catch (e) {
      // manter vazio; backend também resolve o nome
    }
  };

  const loadPromptChains = async () => {
    try {
      const response = await api.get(`/prompt-chains/${clientId}`);
      setPromptChains(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar prompt chains:', error);
    }
  };

  const loadCalendar = async () => {
    try {
      setLoading(true);

      // Resetar estados ao trocar de mês
      setMonthReferences('');
      setMonthImages([]);

      // Buscar calendário do mês atual
      const monthStr = format(currentMonth, 'MMMM yyyy', { locale: ptBR });
      console.log(`📅 Carregando calendário do mês: ${monthStr}`);

      // Resetar estados específicos do mês
      setMonthReferences('');

      const response = await api.get(`/calendars/${clientId}?month=${encodeURIComponent(monthStr)}`);

      const calendarData = response.data.calendar;
      
      // Carregar referências do mês se existirem no metadata
      if (calendarData.metadata?.month_references) {
        setMonthReferences(calendarData.metadata.month_references);
      }
      if (calendarData.metadata?.month_images) {
        setMonthImages(calendarData.metadata.month_images);
      }
      
      calendarData.posts = calendarData.posts.map((post: any) => {
        const normalizeText = (value: any): string => {
          if (value === null || value === undefined) return '';
          if (typeof value === 'string') return value;
          // Se vier objeto/array do Gemini, transforma em string legível
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        };

        const normalized: Post = {
          data: normalizeText(post.data),
          tema: normalizeText(post.tema),
          formato: normalizeText(post.formato),
          ideia_visual: normalizeText(post.ideia_visual),
          copy_sugestao: normalizeText(post.copy_sugestao),
          objetivo: normalizeText(post.objetivo),
          image_generation_prompt: normalizeText(post.image_generation_prompt),
          referencias: normalizeText(post.referencias),
          status: (post.status as Post['status']) || 'sugerido',
        };

        return normalized;
      });

      setCalendar(calendarData);

    } catch (error: any) {
      console.error('Erro ao carregar calendário:', error);
      if (error.response?.status === 404) {
        // Não há calendário para este mês, mostrar estado vazio
        setCalendar(null);
      } else {
        // Outro erro, mostrar mensagem
        alert('Erro ao carregar calendário: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!calendar) {
      alert('Nenhum calendário carregado.');
      return;
    }

    try {
      setIsGenerating(true);

      const downloadClientName = clientName || 'Cliente';
      const suffix = getExcelFilenameSuffix(exportMonthsSelected);
      const safeMonth = String(suffix || String(calendar.mes || 'mes')).replace(/\s+/g, '_');

      const response = await api.post(
        '/calendars/export-excel',
        {
          calendarId: calendar.id,
          clientName: downloadClientName,
          monthsSelected: exportMonthsSelected
        },
        {
          responseType: 'blob'
        }
      );

      // Download do arquivo Excel
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${downloadClientName}_${safeMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      alert('✅ Calendário Excel gerado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao gerar Excel:', err);
      alert('Erro ao gerar Excel: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsGenerating(false);
      setShowExportModal(false);
    }
  };

  const detectMonthsFromCalendar = (cal: Calendar): number[] => {
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

  const getMonthName = (monthNum: number): string => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return monthNames[monthNum - 1] || `Mês ${monthNum}`;
  };

  const getExcelFilenameSuffix = (monthsSelected: number[]) => {
    const normalized = (Array.isArray(monthsSelected) ? monthsSelected : [])
      .map((m) => parseInt(String(m), 10))
      .filter((m) => !isNaN(m) && m >= 1 && m <= 12)
      .sort((a, b) => a - b);

    const yearMatch = String(calendar?.mes || '').match(/(\d{4})/);
    const yearStr = yearMatch?.[1] || '';

    if (normalized.length >= 2) {
      const start = getMonthName(normalized[0]);
      const end = getMonthName(normalized[normalized.length - 1]);
      return `${start}-${end}${yearStr ? `_${yearStr}` : ''}`;
    }

    if (normalized.length === 1) {
      return `${getMonthName(normalized[0])}${yearStr ? `_${yearStr}` : ''}`;
    }

    const safeMonth = String(calendar?.mes || 'mes').replace(/\s+/g, '_');
    return safeMonth;
  };

  const parseMonthLabelToNumber = (label: string): number | null => {
    const s = String(label || '').trim().toLowerCase();
    if (!s) return null;
    const token = s.split(/\s+/)[0] || '';
    const map: Record<string, number> = {
      janeiro: 1,
      fevereiro: 2,
      'março': 3,
      marco: 3,
      abril: 4,
      maio: 5,
      junho: 6,
      julho: 7,
      agosto: 8,
      setembro: 9,
      outubro: 10,
      novembro: 11,
      dezembro: 12,
    };
    return map[token] ?? null;
  };

  const openExportModal = () => {
    if (!calendar) {
      alert('Nenhum calendário carregado.');
      return;
    }

    const baseMonth = parseMonthLabelToNumber(calendar.mes) || (currentMonth.getMonth() + 1);
    const defaultSelection = [
      baseMonth,
      baseMonth === 12 ? 1 : baseMonth + 1,
      baseMonth >= 11 ? ((baseMonth + 2) % 12 || 12) : baseMonth + 2,
    ];

    const monthsOptions = getExportMonthOptions(calendar);
    setExportMonthsSelected(defaultSelection.filter((m) => monthsOptions.includes(m)));
    setShowExportModal(true);
  };

  const getExportMonthOptions = (cal: Calendar): number[] => {
    const baseMonth = parseMonthLabelToNumber(cal.mes) || (currentMonth.getMonth() + 1);
    const triMonths = [
      baseMonth,
      baseMonth === 12 ? 1 : baseMonth + 1,
      baseMonth >= 11 ? ((baseMonth + 2) % 12 || 12) : baseMonth + 2,
    ];

    const detected = detectMonthsFromCalendar(cal);
    return Array.from(new Set([...triMonths, ...detected])).sort((a, b) => a - b);
  };

  const openGenerateModal = () => {
    // Define um mix padrão leve para evitar modal vazio
    setMix({ reels: 2, static: 4, carousel: 4, stories: 2, photos: 0 });
    setBriefing('');
    setGenerationPrompt('');
    setPeriodoDias(30);
    setSpecificMonths([format(currentMonth, 'MMMM yyyy', { locale: ptBR })]);
    setShowGenerateModal(true);
  };

  const regeneratePostWithAI = async () => {
    if (!calendar || !selectedPost) return;

    try {
      setIsRegeneratingPost(true);

      const response = await api.post('/calendars/regenerate-post', {
        calendarId: calendar.id,
        postIndex: selectedPost.index,
        newFormato: editFormato,
        customPrompt: regenPostPrompt,
      });

      const newPost: Post = response.data.post;

      const updatedPosts = [...calendar.posts];
      updatedPosts[selectedPost.index] = newPost;

      setCalendar({ ...calendar, posts: updatedPosts });

      // Atualizar campos do modal com a resposta da IA
      setEditTema(newPost.tema || '');
      setEditCopy(newPost.copy_sugestao || '');
      setEditData(newPost.data || '');
      setEditFormato(newPost.formato || '');
      setEditIdeiaVisual(newPost.ideia_visual || '');
      setEditObjetivo(newPost.objetivo || '');
      setEditImagePrompt(newPost.image_generation_prompt || '');

      alert('✅ Post regenerado com IA com sucesso!');
    } catch (error: any) {
      console.error('❌ Erro ao regenerar post com IA:', error);
      alert('Erro ao regenerar post com IA: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsRegeneratingPost(false);
    }
  };

  const deleteCalendar = async () => {
    if (!calendar) return;

    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir o calendário completo de ${calendar.mes}?\n\nTodos os ${calendar.posts.length} posts serão removidos permanentemente.`
    );

    if (!confirmDelete) return;

    try {
      setIsDeleting(true);

      const monthStr = format(currentMonth, 'MMMM yyyy', { locale: ptBR });
      await api.delete(`/calendars/${clientId}/${monthStr}`);

      alert('✅ Calendário excluído com sucesso!');
      loadCalendar(); // Recarregar (vai mostrar estado vazio)

    } catch (error: any) {
      console.error('Erro ao excluir calendário:', error);
      alert('Erro ao excluir calendário: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsDeleting(false);
    }
  };

  const generateCalendar = async () => {
    if (!clientId) return;

    // Validar se pelo menos um tipo de conteúdo foi selecionado
    const totalPosts = Object.values(mix).reduce((sum, count) => sum + count, 0);
    if (totalPosts === 0) {
      alert('Selecione pelo menos 1 tipo de conteúdo para gerar o calendário.');
      return;
    }

    if (!specificMonths || specificMonths.length === 0) {
      alert('Selecione pelo menos 1 mês para gerar.');
      return;
    }

    try {
      setIsGenerating(true);
      const response = await api.post('/generate-calendar', {
        clienteId: clientId,
        periodo: periodoDias,
        briefing,
        mes: format(currentMonth, 'MMMM yyyy', { locale: ptBR }),
        monthsCount: specificMonths.length,
        specificMonths,
        mix,
        generationPrompt,
        formatInstructions,
        monthReferences,
        chainId: selectedChainId || undefined,
      });

      console.log('✅ Calendário gerado:', response.data);
      
      const calendarsGenerated = response.data?.calendars?.length || 1;
      const successMessage = calendarsGenerated > 1 
        ? `✅ ${calendarsGenerated} calendários gerados com sucesso!`
        : '✅ Calendário gerado com sucesso!';
      
      alert(successMessage);
      setShowGenerateModal(false);
      setBriefing('');
      setGenerationPrompt('');
      setSpecificMonths([]);
      setMix({
        reels: 0,
        static: 0,
        carousel: 0,
        stories: 0,
        photos: 0
      });

      // Recarregar o calendário do mês atual após geração
      loadCalendar();
    } catch (error: any) {
      console.error('❌ Erro ao gerar calendário:', error);
      
      // Tratamento específico para 504 (Gateway Timeout) - geralmente proxy (Nginx/Cloudflare)
      if (error.response?.status === 504) {
        alert(
          '⏳ A geração demorou mais que o limite do servidor (erro 504).\n\n' +
          'Isso é comum quando você gera muitos posts ou múltiplos meses.\n\n' +
          '✅ O processamento pode ainda estar ocorrendo no backend.\n' +
          'Aguarde alguns minutos e recarregue a página para verificar se os calendários apareceram.'
        );
      }

      // Tratamento específico para timeout
      else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        alert(
          '⏳ A geração está demorando mais que o esperado.\n\n' +
          'Isso é normal para calendários com muitos posts ou múltiplos meses.\n\n' +
          '✅ A IA continua processando em segundo plano.\n' +
          'Aguarde 1-2 minutos e recarregue a página para verificar se o calendário foi gerado.'
        );
      } else {
        alert('Erro ao gerar calendário: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const saveCalendar = async (updatedPosts: Post[]) => {
    if (!calendar) return;

    try {
      setIsSaving(true);
      await api.put(`/calendars/${calendar.id}`, {
        posts: updatedPosts
      });
      console.log('✅ Calendário salvo');
    } catch (error: any) {
      console.error('❌ Erro ao salvar calendário:', error);
      alert('Erro ao salvar: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSaving(false);
    }
  };

  // Drag & Drop Handler
  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !calendar) return;

    const sourceDay = result.source.droppableId;
    const destDay = result.destination.droppableId;

    if (sourceDay === destDay) return;

    // Encontrar o post que foi arrastado
    const postIndex = parseInt(result.draggableId.split('-')[1]);
    const updatedPosts = [...calendar.posts];
    
    // Atualizar a data do post
    updatedPosts[postIndex] = {
      ...updatedPosts[postIndex],
      data: destDay
    };

    // Atualizar estado local
    setCalendar({ ...calendar, posts: updatedPosts });

    // Salvar no backend
    saveCalendar(updatedPosts);
  };

  const openEditModal = (post: Post, index: number) => {
    console.log('🖱️ Abrindo modal para post:', post);
    console.log('📊 Index:', index);
    setSelectedPost({ post, index });
    setEditTema(post.tema || '');
    setEditCopy(post.copy_sugestao || '');
    setEditData(post.data || '');
    setEditFormato(post.formato || '');
    setEditIdeiaVisual(post.ideia_visual || '');
    setEditObjetivo(post.objetivo || '');
    setEditImagePrompt(post.image_generation_prompt || '');
    setEditReferencias(post.referencias || '');
    setEditStatus(post.status || 'sugerido');
    setRegenPostPrompt(
      'Adapte este conteúdo para o novo formato mantendo a mesma estratégia, mas otimizando copy, ideia visual e objetivo para melhor desempenho.'
    );
  };

  const closeEditModal = () => {
    setSelectedPost(null);
  };

  const savePost = async () => {
    if (!selectedPost || !calendar) return;

    const updatedPosts = [...calendar.posts];
    updatedPosts[selectedPost.index] = {
      data: editData,
      tema: editTema,
      formato: editFormato,
      ideia_visual: editIdeiaVisual,
      copy_sugestao: editCopy,
      objetivo: editObjetivo,
      image_generation_prompt: editImagePrompt,
      referencias: editReferencias,
      status: editStatus
    };

    setCalendar({ ...calendar, posts: updatedPosts });
    await saveCalendar(updatedPosts);
    
    alert('✅ Post atualizado com sucesso!');
    closeEditModal();
  };

  const deletePost = async () => {
    if (!calendar || !selectedPost) return;

    const confirmDelete = window.confirm(
      'Tem certeza que deseja excluir este post? Essa ação não pode ser desfeita.'
    );

    if (!confirmDelete) return;

    try {
      setIsDeletingPost(true);

      await api.delete(`/calendars/post/${calendar.id}/${selectedPost.index}`);

      const updatedPosts = calendar.posts.filter((_, i) => i !== selectedPost.index);
      setCalendar({ ...calendar, posts: updatedPosts });

      alert('✅ Post excluído com sucesso!');
      setSelectedPost(null);
    } catch (error: any) {
      console.error('❌ Erro ao excluir post:', error);
      alert('Erro ao excluir post: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsDeletingPost(false);
    }
  };

  // Funções auxiliares
  const getFormatIcon = (formato: string) => {
    const lower = formato?.toLowerCase() || '';
    if (lower.includes('reel')) return '🎬';
    if (lower.includes('carrossel')) return '📸';
    if (lower.includes('static')) return '🖼️';
    if (lower.includes('stories')) return '📱';
    return '📄';
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'aprovado':
        return 'border-l-green-500 bg-green-500/10';
      case 'publicado':
        return 'border-l-blue-500 bg-blue-500/10';
      default:
        return 'border-l-yellow-500 bg-yellow-500/10';
    }
  };

  const getPostsForDay = (dayStr: string): { post: Post; index: number }[] => {
    if (!calendar) return [];
    
    return calendar.posts
      .map((post, index) => ({ post, index }))
      .filter(({ post }) => {
        // Tentar fazer match com diferentes formatos de data
        const postDate = post.data;
        return postDate === dayStr || 
               postDate === dayStr.replace(/^0/, '') || // Remove zero à esquerda
               postDate.includes(dayStr);
      });
  };

  // Gerar dias do mês
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Adicionar dias vazios no início para alinhar com o dia da semana
  const startDayOfWeek = getDay(monthStart);
  const emptyDays = Array(startDayOfWeek).fill(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando calendário...</div>
      </div>
    );
  }

  // Estado: Nenhum calendário para este mês
  if (!calendar) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header com navegação */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-1">📅 Calendário Editorial</h1>
              <p className="text-gray-400 text-lg">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </p>
            </div>

            {/* Navegação de mês */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-3 hover:bg-gray-800 rounded-lg transition-colors"
                title="Mês anterior"
              >
                ← Anterior
              </button>

              <div className="text-center min-w-[200px]">
                <div className="text-xl font-semibold">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </div>
              </div>

              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-3 hover:bg-gray-800 rounded-lg transition-colors"
                title="Próximo mês"
              >
                Próximo →
              </button>
            </div>
          </div>

          {/* Página de criação */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-12 text-center">
            <div className="text-6xl mb-6">📭</div>
            <h2 className="text-3xl font-bold mb-4">Nenhum Calendário para este Mês</h2>
            <p className="text-gray-400 mb-8 text-lg max-w-2xl mx-auto">
              Crie um calendário editorial personalizado para {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              com posts otimizados para suas redes sociais.
            </p>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <div className="text-2xl mb-2">🎬</div>
                  <div className="font-semibold">Reels & Vídeos</div>
                  <div className="text-sm text-gray-400">Conteúdo dinâmico e envolvente</div>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <div className="text-2xl mb-2">📸</div>
                  <div className="font-semibold">Posts Estáticos</div>
                  <div className="text-sm text-gray-400">Imagens impactantes</div>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <div className="text-2xl mb-2">📱</div>
                  <div className="font-semibold">Stories & Carrosséis</div>
                  <div className="text-sm text-gray-400">Conteúdo sequencial</div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={openGenerateModal}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-12 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105"
                >
                  ✨ Criar Calendário para este Mês
                </button>
                <button
                  onClick={() => setShowPhotoIdeasModal(true)}
                  className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105"
                >
                  📸 Ideias de Fotos
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de Geração */}
        {showGenerateModal && (
          <GenerateModal
            mix={mix}
            setMix={setMix}
            briefing={briefing}
            setBriefing={setBriefing}
            generationPrompt={generationPrompt}
            setGenerationPrompt={setGenerationPrompt}
            periodoDias={periodoDias}
            setPeriodoDias={setPeriodoDias}
            baseMonthDate={currentMonth}
            specificMonths={specificMonths}
            setSpecificMonths={setSpecificMonths}
            formatInstructions={formatInstructions}
            setFormatInstructions={setFormatInstructions}
            promptChains={promptChains}
            selectedChainId={selectedChainId}
            setSelectedChainId={setSelectedChainId}
            isGenerating={isGenerating}
            onGenerate={generateCalendar}
            onClose={() => setShowGenerateModal(false)}
          />
        )}

        {/* Modal de Ideias de Fotos */}
        <PhotoIdeasModal
          isOpen={showPhotoIdeasModal}
          onClose={() => setShowPhotoIdeasModal(false)}
          clienteId={clientId || ''}
          mes={format(currentMonth, 'MMMM', { locale: ptBR })}
          briefing={briefing}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">📅 Calendário Editorial</h1>
            <p className="text-gray-400 text-sm md:text-base">
              {calendar.posts.length} posts planejados • Arraste para reorganizar
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {isSaving && (
              <span className="text-yellow-400 text-sm animate-pulse">💾 Salvando...</span>
            )}
            {isDeleting && (
              <span className="text-red-400 text-sm animate-pulse">🗑️ Excluindo...</span>
            )}
            <button
              onClick={openExportModal}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
            >
              📊 Exportar Excel
            </button>
            <button
              onClick={deleteCalendar}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 px-4 py-2 rounded-lg font-semibold transition-colors text-sm disabled:opacity-50"
              title="Excluir calendário completo"
            >
              🗑️ Excluir
            </button>
            <button
              onClick={openGenerateModal}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
            >
              + Gerar Novo
            </button>
          </div>
        </div>

        {/* Navegação do Mês */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4 no-print">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              ← Anterior
            </button>
            
            <h2 className="text-xl font-bold capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Próximo →
            </button>
          </div>
        </div>

        {/* Card de Referências do Mês */}
        {(monthReferences || monthImages.length > 0) ? (
          <div className="mb-6 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-4 no-print">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">📎</span>
                <h3 className="text-sm font-semibold text-purple-300">Referências do Mês</h3>
              </div>
              <button
                onClick={() => setShowMonthReferencesModal(true)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                ✏️ Editar
              </button>
            </div>
            
            {/* Texto */}
            {monthReferences && (
              <div className="text-xs text-gray-300 whitespace-pre-wrap mb-3">
                {monthReferences}
              </div>
            )}

            {/* Carrossel de Imagens */}
            {monthImages.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {monthImages.map((url, i) => (
                  <div key={i} className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-gray-700 bg-gray-900 cursor-pointer hover:border-purple-500 transition-colors">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Ref ${i}`} className="w-full h-full object-cover" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 no-print">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-500">
                <span className="text-xl">📎</span>
                <span className="text-sm">Nenhuma referência para este mês</span>
              </div>
              <button
                onClick={() => setShowMonthReferencesModal(true)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Adicionar Referências
              </button>
            </div>
          </div>
        )}

        {/* Legenda */}
        <div className="mb-4 flex flex-wrap gap-4 text-xs md:text-sm no-print">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-400">Sugerido</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-400">Aprovado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-400">Publicado</span>
          </div>
        </div>

        {/* Grid do Calendário */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="print-calendar">
            <div className="bg-gray-800/30 rounded-xl overflow-hidden border border-gray-700">
              {/* Header dos dias da semana */}
              <div className="grid grid-cols-7 bg-gray-800">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="p-2 md:p-3 text-center text-xs md:text-sm font-semibold text-gray-400 border-b border-gray-700"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Grid dos dias */}
            <div className="grid grid-cols-7">
              {/* Dias vazios no início */}
              {emptyDays.map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="min-h-[100px] md:min-h-[140px] bg-gray-900/50 border-b border-r border-gray-700/50"
                />
              ))}

              {/* Dias do mês */}
              {daysInMonth.map((day) => {
                const dayStr = format(day, 'dd/MM');
                const dayPosts = getPostsForDay(dayStr);
                const isCurrentDay = isToday(day);

                return (
                  <Droppable droppableId={dayStr} key={dayStr}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[100px] md:min-h-[140px] p-1 md:p-2 border-b border-r border-gray-700/50 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-blue-500/20' : ''
                        } ${isCurrentDay ? 'bg-blue-900/20' : ''}`}
                      >
                        {/* Número do dia */}
                        <div className={`text-xs md:text-sm font-semibold mb-1 ${
                          isCurrentDay ? 'text-blue-400' : 'text-gray-400'
                        }`}>
                          {format(day, 'd')}
                        </div>

                        {/* Posts do dia */}
                        <div className="space-y-1">
                          {dayPosts.map(({ post, index }, i) => (
                            <Draggable
                              key={`post-${index}`}
                              draggableId={`post-${index}`}
                              index={i}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => openEditModal(post, index)}
                                  className={`p-1.5 md:p-2 rounded-md border-l-4 cursor-pointer transition-all text-xs ${
                                    getStatusColor(post.status)
                                  } ${
                                    snapshot.isDragging ? 'shadow-lg scale-105 opacity-90' : 'hover:scale-[1.02]'
                                  }`}
                                >
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <span className="text-sm">{getFormatIcon(post.formato)}</span>
                                    <span className="font-medium truncate text-[10px] md:text-xs">
                                      {post.formato}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="text-[10px] md:text-xs text-gray-300 truncate flex-1">
                                      {post.tema}
                                    </div>
                                    {post.referencias && (
                                      <span className="text-xs" title="Tem referências">📎</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                        </div>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                );
              })}
              </div>
            </div>
          </div>
        </DragDropContext>

        {showExportModal && calendar && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">📊 Exportar Excel</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Selecione os meses que deseja incluir na exportação
                  </p>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Fechar"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 mb-5">
                {getExportMonthOptions(calendar).length === 0 ? (
                  <div className="text-sm text-gray-300 bg-gray-900/50 border border-gray-700 rounded-lg p-4 text-center">
                    ⚠️ Nenhum mês detectado (posts sem data em formato reconhecível).
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          const allMonths = getExportMonthOptions(calendar);
                          setExportMonthsSelected(allMonths);
                        }}
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

                    {(() => {
                      const isTri = Number(calendar.periodo) >= 90 || Number(calendar.periodo) === 3;
                      if (!isTri) return null;

                      const baseMonth = parseMonthLabelToNumber(calendar.mes) || (currentMonth.getMonth() + 1);
                      const m1 = baseMonth;
                      const m2 = baseMonth === 12 ? 1 : baseMonth + 1;
                      const m3 = baseMonth >= 11 ? ((baseMonth + 2) % 12 || 12) : baseMonth + 2;
                      const triMonths = [m1, m2, m3].sort((a, b) => a - b);
                      const isTriSelected = triMonths.every((m) => exportMonthsSelected.includes(m)) && exportMonthsSelected.length === 3;

                      return (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              const options = getExportMonthOptions(calendar);
                              const filtered = triMonths.filter((m) => options.includes(m));
                              setExportMonthsSelected(filtered);
                            }}
                            className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                              isTriSelected
                                ? 'bg-blue-600 text-white border-blue-400'
                                : 'bg-gray-900/50 text-gray-300 border-gray-700 hover:border-blue-500/50 hover:bg-gray-900'
                            }`}
                            title="Selecionar o trimestre do calendário"
                          >
                            Selecionar Trimestre
                          </button>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-3 gap-3">
                      {getExportMonthOptions(calendar).map((m) => {
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
                            className={`
                              relative px-4 py-3 rounded-lg font-medium transition-all text-sm
                              ${
                                checked
                                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400'
                                  : 'bg-gray-900/50 text-gray-300 border-2 border-gray-700 hover:border-blue-500/50 hover:bg-gray-900'
                              }
                            `}
                          >
                            {checked && (
                              <span className="absolute top-1 right-1 text-xs">✓</span>
                            )}
                            <div className="text-center">
                              {getMonthName(m)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-xs text-gray-400 text-center">
                      {exportMonthsSelected.length === 0 ? (
                        'Nenhum mês selecionado'
                      ) : exportMonthsSelected.length === 1 ? (
                        `1 mês selecionado: ${getMonthName(exportMonthsSelected[0])}`
                      ) : (
                        `${exportMonthsSelected.length} meses selecionados: ${exportMonthsSelected.map(m => getMonthName(m)).join(', ')}`
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  disabled={isGenerating}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={isGenerating || exportMonthsSelected.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 px-5 py-2 rounded-lg font-semibold transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Gerando...
                    </>
                  ) : (
                    <>
                      📊 Exportar Excel
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edição */}
        {selectedPost && (
          <EditModal
            editTema={editTema}
            setEditTema={setEditTema}
            editCopy={editCopy}
            setEditCopy={setEditCopy}
            editData={editData}
            setEditData={setEditData}
            editFormato={editFormato}
            setEditFormato={setEditFormato}
            editIdeiaVisual={editIdeiaVisual}
            setEditIdeiaVisual={setEditIdeiaVisual}
            editObjetivo={editObjetivo}
            setEditObjetivo={setEditObjetivo}
            editImagePrompt={editImagePrompt}
            setEditImagePrompt={setEditImagePrompt}
            editReferencias={editReferencias}
            setEditReferencias={setEditReferencias}
            editStatus={editStatus}
            setEditStatus={setEditStatus}
            regenPostPrompt={regenPostPrompt}
            setRegenPostPrompt={setRegenPostPrompt}
            isRegeneratingPost={isRegeneratingPost}
            onRegeneratePost={regeneratePostWithAI}
            isDeletingPost={isDeletingPost}
            onDeletePost={deletePost}
            onSave={savePost}
            onClose={closeEditModal}
          />
        )}

        {/* Modal de Geração */}
        {showGenerateModal && (
          <GenerateModal
            mix={mix}
            setMix={setMix}
            briefing={briefing}
            setBriefing={setBriefing}
            generationPrompt={generationPrompt}
            setGenerationPrompt={setGenerationPrompt}
            periodoDias={periodoDias}
            setPeriodoDias={setPeriodoDias}
            baseMonthDate={currentMonth}
            specificMonths={specificMonths}
            setSpecificMonths={setSpecificMonths}
            formatInstructions={formatInstructions}
            setFormatInstructions={setFormatInstructions}
            promptChains={promptChains}
            selectedChainId={selectedChainId}
            setSelectedChainId={setSelectedChainId}
            isGenerating={isGenerating}
            onGenerate={generateCalendar}
            onClose={() => setShowGenerateModal(false)}
          />
        )}

        {/* Modal de Edição de Referências do Mês */}
        {showMonthReferencesModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                📎 Referências do Mês
              </h3>
              
              <div className="space-y-6">
                {/* Texto */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Anotações e Links</label>
                  <textarea
                    value={monthReferences}
                    onChange={(e) => setMonthReferences(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 min-h-[150px] text-sm text-gray-200"
                    placeholder="Ex:
- Campanha de Dia das Mães: foco em presentes emocionais
- Usar paleta de cores da coleção Outono
- Link da pasta de fotos novas: drive.google.com/..."
                  />
                </div>

                {/* Imagens (Carrossel/Grid) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs text-gray-400">Galeria Visual (Moodboard)</label>
                    <label className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer flex items-center gap-1">
                      + Adicionar Fotos
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0) return;

                          try {
                            // Upload de cada arquivo
                            const newImages = [...monthImages];
                            for (let i = 0; i < files.length; i++) {
                              const formData = new FormData();
                              formData.append('file', files[i]);
                              const res = await api.post('/knowledge/assets', formData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                              });
                              newImages.push(res.data.url);
                            }
                            setMonthImages(newImages);
                          } catch (err) {
                            console.error('Erro no upload:', err);
                            alert('Erro ao fazer upload de imagens');
                          }
                        }}
                      />
                    </label>
                  </div>
                  
                  {monthImages.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {monthImages.map((imgUrl, idx) => (
                        <div key={idx} className="relative group aspect-square bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                          <img 
                            src={imgUrl} 
                            alt={`Ref ${idx}`} 
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => {
                              const newImages = monthImages.filter((_, i) => i !== idx);
                              setMonthImages(newImages);
                            }}
                            className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remover"
                          >
                            <span className="sr-only">Remover</span>
                            ❌
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center text-gray-500 text-xs">
                      Nenhuma imagem adicionada.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowMonthReferencesModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    try {
                      await api.put(`/calendars/${calendar.id}/metadata`, {
                        month_references: monthReferences,
                        month_images: monthImages
                      });
                      setShowMonthReferencesModal(false);
                      alert('✅ Referências salvas com sucesso!');
                    } catch (error) {
                      console.error('Erro ao salvar referências:', error);
                      alert('❌ Erro ao salvar referências');
                    }
                  }}
                  className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-medium transition-colors text-white"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente Modal de Edição
interface EditModalProps {
  editTema: string;
  setEditTema: (v: string) => void;
  editCopy: string;
  setEditCopy: (v: string) => void;
  editData: string;
  setEditData: (v: string) => void;
  editFormato: string;
  setEditFormato: (v: string) => void;
  editIdeiaVisual: string;
  setEditIdeiaVisual: (v: string) => void;
  editObjetivo: string;
  setEditObjetivo: (v: string) => void;
  editImagePrompt: string;
  setEditImagePrompt: (v: string) => void;
   editReferencias: string;
   setEditReferencias: (v: string) => void;
  editStatus: 'sugerido' | 'aprovado' | 'publicado';
  setEditStatus: (v: 'sugerido' | 'aprovado' | 'publicado') => void;
  regenPostPrompt: string;
  setRegenPostPrompt: (v: string) => void;
  isRegeneratingPost: boolean;
  onRegeneratePost: () => void;
  isDeletingPost: boolean;
  onDeletePost: () => void;
  onSave: () => void;
  onClose: () => void;
}

function EditModal({
  editTema, setEditTema,
  editCopy, setEditCopy,
  editData, setEditData,
  editFormato, setEditFormato,
  editIdeiaVisual, setEditIdeiaVisual,
  editObjetivo, setEditObjetivo,
  editImagePrompt, setEditImagePrompt,
  editReferencias, setEditReferencias,
  editStatus, setEditStatus,
  regenPostPrompt, setRegenPostPrompt,
  isRegeneratingPost,
  onRegeneratePost,
  isDeletingPost,
  onDeletePost,
  onSave,
  onClose
}: EditModalProps) {
  const [showAdvancedIA, setShowAdvancedIA] = useState(false);
  console.log('🎨 EditModal renderizado com dados:', {
    editTema, editData, editFormato, editImagePrompt: editImagePrompt?.substring(0, 50) + '...'
  });
  try {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-3xl border border-gray-700 mt-8 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">✏️ Editar Post</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
          </div>

        <div className="space-y-4 mb-6">
          {/* Card 1 - Informações do Post */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">📌 Informações do Post</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Data (DD/MM)</label>
                <input
                  type="text"
                  value={editData}
                  onChange={(e) => setEditData(e.target.value)}
                  placeholder="Ex: 15/01"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Formato</label>
                <select
                  value={editFormato}
                  onChange={(e) => setEditFormato(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="Reels">🎬 Reels</option>
                  <option value="Carrossel">📸 Carrossel</option>
                  <option value="Static">🖼️ Static</option>
                  <option value="Stories">📱 Stories</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tema</label>
                <input
                  type="text"
                  value={editTema}
                  onChange={(e) => setEditTema(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="sugerido">⏳ Sugerido</option>
                  <option value="aprovado">✅ Aprovado</option>
                  <option value="publicado">🚀 Publicado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2 - Conteúdo do Post */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">✍️ Conteúdo</h3>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Legenda</label>
              <textarea
                value={editCopy}
                onChange={(e) => setEditCopy(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 min-h-[110px]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Objetivo</label>
              <input
                type="text"
                value={editObjetivo}
                onChange={(e) => setEditObjetivo(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ideia visual</label>
              <textarea
                value={editIdeiaVisual}
                onChange={(e) => setEditIdeiaVisual(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 min-h-[80px]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Referências (links, fotos, notas)</label>
              <textarea
                value={editReferencias}
                onChange={(e) => setEditReferencias(e.target.value)}
                placeholder="Cole aqui links de posts, referências visuais ou anotações para este conteúdo."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 min-h-[80px]"
              />
            </div>
          </div>

          {/* Card 3 - Criativo & IA (avançado) */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvancedIA(!showAdvancedIA)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                🎨 Criativo & IA
                <span className="text-[11px] text-gray-500 font-normal">(opcional)</span>
              </span>
              <span className="text-xs text-gray-400">
                {showAdvancedIA ? 'Esconder' : 'Mostrar'}
              </span>
            </button>

            {showAdvancedIA && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs text-gray-400">Prompt de imagem (IA)</label>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(editImagePrompt);
                        alert('Prompt copiado para a área de transferência!');
                      }}
                      className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                      title="Copiar prompt"
                    >
                      📋 Copiar
                    </button>
                  </div>
                  <textarea
                    value={editImagePrompt}
                    onChange={(e) => setEditImagePrompt(e.target.value)}
                    placeholder="Prompt técnico para Midjourney, DALL-E, etc."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 min-h-[90px] font-mono"
                  />
                  <p className="text-[11px] text-gray-500">
                    Ajuste este prompt antes de usar em ferramentas de IA generativa.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs text-gray-400">Prompt para regenerar este post com IA</label>
                  <textarea
                    value={regenPostPrompt}
                    onChange={(e) => setRegenPostPrompt(e.target.value)}
                    placeholder="Explique como a IA deve adaptar este post ao novo formato (foco, tom, tipo de conteúdo, etc.)."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 min-h-[90px]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={onRegeneratePost}
              disabled={isRegeneratingPost}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-60 py-3 rounded-lg font-medium transition-colors"
            >
              {isRegeneratingPost ? '🔁 Regenerando com IA...' : '🔁 Regenerar Post com IA'}
            </button>
            <button
              onClick={onSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-medium transition-colors"
            >
              💾 Salvar Alterações
            </button>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onDeletePost}
              disabled={isDeletingPost}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-60 py-3 rounded-lg font-medium transition-colors"
            >
              {isDeletingPost ? '🗑️ Excluindo Post...' : '🗑️ Excluir Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  } catch (error) {
    console.error('❌ Erro no EditModal:', error);
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-red-800 rounded-xl p-6 border border-red-700">
          <h2 className="text-xl font-bold text-white mb-4">❌ Erro no Modal</h2>
          <p className="text-red-200 mb-4">Ocorreu um erro ao abrir o modal de edição.</p>
          <button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }
}

// Componente Modal de Geração
interface GenerateModalProps {
  mix: ContentMix;
  setMix: (v: ContentMix) => void;
  briefing: string;
  setBriefing: (v: string) => void;
  periodoDias: number;
  setPeriodoDias: (v: number) => void;
  baseMonthDate: Date;
  specificMonths: string[];
  setSpecificMonths: (v: string[]) => void;
  generationPrompt: string;
  setGenerationPrompt: (v: string) => void;
  formatInstructions: FormatInstructions;
  setFormatInstructions: (v: FormatInstructions) => void;
  promptChains: any[];
  selectedChainId: string;
  setSelectedChainId: (v: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onClose: () => void;
}

function GenerateModal({
  mix, setMix,
  briefing, setBriefing,
  periodoDias, setPeriodoDias,
  baseMonthDate,
  specificMonths, setSpecificMonths,
  generationPrompt, setGenerationPrompt,
  formatInstructions, setFormatInstructions,
  promptChains,
  selectedChainId,
  setSelectedChainId,
  isGenerating,
  onGenerate, onClose
}: GenerateModalProps) {
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);
  const [showFormatInstructions, setShowFormatInstructions] = useState(false);

  const monthsOptions = Array.from({ length: 12 }).map((_, i) => {
    const date = addMonths(baseMonthDate, i);
    return {
      date,
      monthLabel: format(date, 'MMMM yyyy', { locale: ptBR }),
      monthName: format(date, 'MMMM', { locale: ptBR }),
      year: format(date, 'yyyy', { locale: ptBR })
    };
  });

  const selectedCount = specificMonths.length;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-3xl border border-gray-700 mt-8 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">🚀 Gerar Calendário Editorial</h2>

        <div className="space-y-6 mb-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Período</label>
            <select
              value={String(periodoDias)}
              onChange={(e) => setPeriodoDias(parseInt(e.target.value, 10))}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
            >
              <option value="30">Mensal (30 dias)</option>
              <option value="90">Trimestral (90 dias)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Selecione os Meses para Gerar</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {monthsOptions.map(({ monthLabel, monthName, year }) => {
                const isSelected = specificMonths.includes(monthLabel);

                return (
                  <button
                    key={monthLabel}
                    onClick={() => {
                      if (isSelected) {
                        setSpecificMonths(specificMonths.filter((m: string) => m !== monthLabel));
                      } else {
                        const next = [...specificMonths, monthLabel];
                        const ordered = monthsOptions
                          .map((o) => o.monthLabel)
                          .filter((label) => next.includes(label));
                        setSpecificMonths(ordered);
                      }
                    }}
                    className={`p-3 rounded-lg border text-left transition-all flex flex-col ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-blue-100'
                        : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500 hover:bg-gray-700'
                    }`}
                  >
                    <span className="capitalize font-bold text-sm">{monthName}</span>
                    <span className="text-xs opacity-70">{year}</span>
                    {isSelected && <span className="text-[10px] mt-1 text-blue-400">Selected ✅</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Selecione um ou mais meses. O sistema gerará um calendário individual para cada mês selecionado, mantendo o contexto.
            </p>
            <div className="mt-2 text-xs text-gray-400">
              Selecionados: <span className="text-gray-200 font-semibold">{selectedCount || 0}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Mix de Conteúdo (por mês)</label>
            <p className="text-xs text-gray-500 mb-4">
              Defina quantos posts de cada tipo você deseja gerar <strong>para cada mês selecionado</strong>.
            </p>
            <ContentMixSelector mix={mix} onMixChange={setMix} />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Briefing</label>
            <textarea
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              placeholder="Descreva o objetivo, temas principais, campanhas, promoções..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 min-h-[120px]"
            />
          </div>

          {/* Instruções por formato */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowFormatInstructions(!showFormatInstructions)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                🎯 Personalizar cada formato
                <span className="text-[11px] text-gray-500 font-normal">(opcional)</span>
              </span>
              <span className="text-xs text-gray-400">
                {showFormatInstructions ? 'Esconder' : 'Mostrar'}
              </span>
            </button>

            {showFormatInstructions && (
              <>
                <p className="text-[11px] text-gray-500 pt-1">
                  Use estes campos para dar instruções específicas para cada tipo de conteúdo. Elas serão
                  combinadas ao DNA da marca e ao briefing.
                </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px] text-gray-400">Reels</label>
                <textarea
                  value={formatInstructions.reels}
                  onChange={(e) => setFormatInstructions({ ...formatInstructions, reels: e.target.value })}
                  placeholder="Ex.: Reels mais dinâmicos, com cortes rápidos e CTA forte nos 3s finais."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 min-h-[70px]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-gray-400">Posts estáticos</label>
                <textarea
                  value={formatInstructions.static}
                  onChange={(e) => setFormatInstructions({ ...formatInstructions, static: e.target.value })}
                  placeholder="Ex.: Layout minimalista, foco em tipografia e uma ideia central por peça."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 min-h-[70px]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-gray-400">Carrosséis</label>
                <textarea
                  value={formatInstructions.carousel}
                  onChange={(e) => setFormatInstructions({ ...formatInstructions, carousel: e.target.value })}
                  placeholder="Ex.: Conteúdos educativos em 5-7 cards, com passo-a-passo e CTA no final."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 min-h-[70px]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-gray-400">Stories</label>
                <textarea
                  value={formatInstructions.stories}
                  onChange={(e) => setFormatInstructions({ ...formatInstructions, stories: e.target.value })}
                  placeholder="Ex.: Sequências curtas, bastidores e enquetes para engajamento diário."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 min-h-[70px]"
                />
              </div>
            </div>
              </>
            )}
          </div>

          <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvancedPrompt(!showAdvancedPrompt)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                🧠 Inteligência & Prompts
                <span className="text-[11px] text-gray-500 font-normal">(opcional)</span>
              </span>
              <span className="text-xs text-gray-400">
                {showAdvancedPrompt ? 'Esconder' : 'Mostrar'}
              </span>
            </button>

            {showAdvancedPrompt && (
              <div className="pt-1 space-y-4">
                {/* Seletor de Prompt Chain dentro de Inteligência & Prompts */}
                {promptChains.length > 0 && (
                  <div className="space-y-2 pb-4 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-gray-300">⛓️ Prompt Chain</label>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          alert('💡 Dica: Prompt Chains executam múltiplos passos de raciocínio antes de gerar o calendário.\n\nUse quando:\n✅ Quer análise estratégica profunda\n✅ Nicho específico (nutrição, advocacia, etc.)\n✅ Lançamentos ou campanhas complexas\n\nNão use quando:\n❌ Precisa de velocidade\n❌ Briefing já é muito detalhado');
                        }}
                        className="text-[10px] text-blue-400 hover:text-blue-300"
                      >
                        ℹ️ Quando usar?
                      </a>
                    </div>
                    
                    {/* Cards de Chains */}
                    <div className="space-y-2">
                      <div
                        onClick={() => setSelectedChainId('')}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                          selectedChainId === ''
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            selectedChainId === '' ? 'border-blue-500' : 'border-gray-500'
                          }`}>
                            {selectedChainId === '' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-white">Geração Padrão</div>
                            <div className="text-[10px] text-gray-400">Rápido e direto (Briefing + DNA)</div>
                          </div>
                        </div>
                      </div>

                      {promptChains.map((chain) => (
                        <div
                          key={chain.id}
                          onClick={() => setSelectedChainId(chain.id)}
                          className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                            selectedChainId === chain.id
                              ? 'border-purple-500 bg-purple-500/10'
                              : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center mt-0.5 flex-shrink-0 ${
                              selectedChainId === chain.id ? 'border-purple-500' : 'border-gray-500'
                            }`}>
                              {selectedChainId === chain.id && <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-white flex items-center gap-2">
                                {chain.nome}
                                <span className="text-[9px] px-1.5 py-px bg-purple-500/20 text-purple-300 rounded-full">
                                  {chain.steps?.length || 0} steps
                                </span>
                              </div>
                              {chain.descricao && (
                                <div className="text-[10px] text-gray-400 mt-0.5 truncate">{chain.descricao}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs text-gray-400 mb-1">Prompt avançado para IA</label>
                  <p className="text-[11px] text-gray-500">
                    Este texto será combinado automaticamente com o DNA da marca salvo no sistema
                    (branding, regras, documentos e personas) e com o briefing acima. Use este campo
                    para dar instruções extras específicas desta geração (foco, campanhas, temas a
                    priorizar ou evitar, tom mais detalhado, etc.).
                  </p>
                  <textarea
                    value={generationPrompt}
                    onChange={(e) => setGenerationPrompt(e.target.value)}
                    placeholder="Ex.: Priorizar conteúdos de autoridade para lançamento do novo produto, evitar assuntos sensíveis X e Y, reforçar provas sociais em pelo menos 30% dos posts, etc."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 min-h-[110px] text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex-1 bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <div className="flex flex-col items-center gap-1">
                <span className="text-base">⏳ Gerando {selectedCount > 1 ? `${selectedCount} meses` : 'calendário'}...</span>
                <span className="text-xs text-blue-200 opacity-80">
                  {selectedCount > 1 
                    ? `Isso pode levar ${Math.ceil(selectedCount * 1.5)}-${Math.ceil(selectedCount * 3)} minutos`
                    : 'Aguarde alguns instantes'}
                </span>
              </div>
            ) : '🚀 Gerar Calendário'}
          </button>
        </div>
      </div>
    </div>
  );
}
