import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import TokenUsageDisplay from '../components/TokenUsageDisplay';

interface ClientInfo {
  id: string;
  nome: string;
  criado_em: string;
}

interface CalendarPost {
  data: string;
  tema: string;
  formato: string;
  ideia_visual?: string;
  copy_sugestao?: string;
  objetivo?: string;
}

interface CalendarOverview {
  hasCalendar: boolean;
  mesLabel: string;
  totalPosts: number;
  statusLabel: string;
  statusIcon: string;
  statusColorClass: string;
  nextDeadlineLabel: string;
  nextPosts: CalendarPost[];
}

interface KnowledgeOverview {
  promptsCount: number;
  rulesCount: number;
  docsCount: number;
  chainsCount: number;
}

export default function Dashboard() {
  const { clientId } = useParams<{ clientId: string }>();

  // Upload manual
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);

  // Mensagens
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  // Overview
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [calendarOverview, setCalendarOverview] = useState<CalendarOverview | null>(null);
  const [knowledgeOverview, setKnowledgeOverview] = useState<KnowledgeOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  useEffect(() => {
    if (clientId) {
      loadOverview(clientId);
    }
  }, [clientId]);

  const loadOverview = async (id: string) => {
    try {
      setLoadingOverview(true);

      // 1) Dados do cliente
      const clientRes = await api.get(`/clients/${id}`);
      const c = clientRes.data.cliente as ClientInfo;
      setClientInfo(c);

      // 2) Calendário mais recente
      try {
        const calRes = await api.get(`/calendars/${id}`);
        const calendar = calRes.data.calendar;
        const posts: CalendarPost[] = calendar?.posts || [];

        const today = new Date();
        const parseDate = (dataStr: string): Date | null => {
          if (!dataStr) return null;
          const [dStr, mStr] = dataStr.split('/');
          const d = parseInt(dStr, 10);
          const m = parseInt(mStr, 10);
          if (isNaN(d) || isNaN(m)) return null;
          return new Date(today.getFullYear(), m - 1, d);
        };

        const postsComData = posts
          .map((p) => ({ ...p, _date: parseDate(p.data) }))
          .filter((p: any) => p._date instanceof Date && !isNaN(p._date.getTime()));

        const futuros = postsComData
          .filter((p: any) => p._date >= today)
          .sort((a: any, b: any) => a._date.getTime() - b._date.getTime());

        let statusLabel = '⏳ Em andamento';
        let statusIcon = '⏳';
        let statusColorClass = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';

        if (!posts || posts.length === 0) {
          statusLabel = '❌ Não gerado';
          statusIcon = '❌';
          statusColorClass = 'bg-red-500/20 text-red-300 border-red-500/50';
        } else if (futuros.length === 0) {
          statusLabel = '✅ Concluído';
          statusIcon = '✅';
          statusColorClass = 'bg-green-500/20 text-green-300 border-green-500/50';
        }

        let nextDeadlineLabel = 'Sem deadlines futuros';
        let nextPosts: CalendarPost[] = [];

        if (futuros.length > 0) {
          const next = futuros[0]._date as Date;
          const diffMs = next.getTime() - today.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays <= 0) {
            nextDeadlineLabel = 'Próximo post hoje';
          } else if (diffDays === 1) {
            nextDeadlineLabel = 'Próximo post em 1 dia';
          } else {
            nextDeadlineLabel = `Próximo post em ${diffDays} dias`;
          }

          nextPosts = futuros.slice(0, 3).map((p: any) => ({
            data: p.data,
            tema: p.tema,
            formato: p.formato,
            ideia_visual: p.ideia_visual,
            copy_sugestao: p.copy_sugestao,
            objetivo: p.objetivo,
          }));
        }

        setCalendarOverview({
          hasCalendar: !!calendar,
          mesLabel: calendar?.mes || 'Sem mês definido',
          totalPosts: posts.length || 0,
          statusLabel,
          statusIcon,
          statusColorClass,
          nextDeadlineLabel,
          nextPosts,
        });
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setCalendarOverview({
            hasCalendar: false,
            mesLabel: 'Nenhum calendário gerado',
            totalPosts: 0,
            statusLabel: '❌ Não gerado',
            statusIcon: '❌',
            statusColorClass: 'bg-red-500/20 text-red-300 border-red-500/50',
            nextDeadlineLabel: 'Nenhum calendário gerado ainda',
            nextPosts: [],
          });
        } else {
          console.error('Erro ao carregar calendário do cliente:', err);
        }
      }

      // 3) Overview de conhecimento (prompts, regras, docs, chains)
      try {
        const [promptsRes, rulesRes] = await Promise.all([
          api.get(`/knowledge/prompts/${id}`),
          api.get(`/knowledge/rules/${id}`),
        ]);

        // brand_docs não tem GET dedicado; usamos o endpoint de debug como aproximação leve
        let docsCount = 0;
        try {
          const debugRes = await api.get('/knowledge/debug');
          docsCount = debugRes.data?.branding_count ?? 0;
        } catch {
          docsCount = 0;
        }

        // Chains para este cliente
        let chainsCount = 0;
        try {
          const chainsRes = await api.get(`/prompt-chains/${id}`);
          chainsCount = chainsRes.data?.data?.length ?? 0;
        } catch {
          chainsCount = 0;
        }

        setKnowledgeOverview({
          promptsCount: promptsRes.data?.prompts?.length ?? 0,
          rulesCount: rulesRes.data?.rules?.length ?? 0,
          docsCount,
          chainsCount,
        });
      } catch (err) {
        console.error('Erro ao carregar overview de conhecimento:', err);
      }
    } finally {
      setLoadingOverview(false);
    }
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadAndProcess = async () => {
    if (!file) {
      showMessage('Por favor, selecione uma imagem', 'error');
      return;
    }

    if (!titulo.trim()) {
      showMessage('Por favor, preencha o título', 'error');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clienteId', clientId || '');
      formData.append('titulo', titulo);
      formData.append('descricao', descricao);

      console.log('Enviando post para processamento...');
      // Usando a rota correta baseada na funcionalidade
      const response = await api.post('/process-post', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Post processado:', response.data);
      showMessage('Post processado com sucesso!', 'success');

      // Limpar formulário
      setFile(null);
      setTitulo('');
      setDescricao('');
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      console.error('Erro ao processar post:', err);
      showMessage(err.response?.data?.error || 'Erro ao processar post', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };


  const clientName = clientInfo?.nome || 'Cliente';

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header do Cliente */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-lg font-semibold">
                {clientName
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
              <span>{clientName}</span>
            </h1>
            <p className="text-gray-400 text-sm">
              Visão geral estratégica do cliente
            </p>
            {clientInfo && (
              <p className="text-xs text-gray-500 mt-1">
                Cliente desde {new Date(clientInfo.criado_em).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>

          {/* Ações principais */}
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/client/${clientId}/calendar`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-blue-500 hover:bg-gray-750 transition-colors text-sm"
            >
              <span>📅</span>
              <span>Ver Calendário</span>
            </Link>
            <Link
              to={`/client/${clientId}/branding`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-blue-500 hover:bg-gray-750 transition-colors text-sm"
            >
              <span>🎨</span>
              <span>DNA da Marca</span>
            </Link>
            <Link
              to={`/client/${clientId}/knowledge`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-blue-500 hover:bg-gray-750 transition-colors text-sm"
            >
              <span>📚</span>
              <span>Base de Conhecimento</span>
            </Link>
          </div>
        </div>

        {/* Mensagem de Feedback */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              messageType === 'success'
                ? 'bg-green-500/20 border-green-500 text-green-400'
                : 'bg-red-500/20 border-red-500 text-red-400'
            }`}
          >
            {message}
          </div>
        )}

        {/* Linha de KPIs / Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Card Calendário */}
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                  <span>📅</span>
                  <span>Calendário Atual</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {calendarOverview?.mesLabel || 'Carregando...'}
                </p>
              </div>
              {calendarOverview && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] ${calendarOverview.statusColorClass}`}
                >
                  <span>{calendarOverview.statusIcon}</span>
                  <span>{calendarOverview.statusLabel}</span>
                </span>
              )}
            </div>
            <div className="text-xs text-gray-300 flex items-center justify-between">
              <span>
                Total de posts:{' '}
                <span className="text-gray-100 font-medium">
                  {calendarOverview?.totalPosts ?? '-'}
                </span>
              </span>
              <span className="text-right">
                {calendarOverview?.nextDeadlineLabel || ''}
              </span>
            </div>
          </div>

          <TokenUsageDisplay clienteId={clientId || ''} />

          {/* Card Próximos Posts */}
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-2">
              <span>🗓️</span>
              <span>Próximos Posts</span>
            </h2>
            {loadingOverview ? (
              <p className="text-xs text-gray-400">Carregando...</p>
            ) : calendarOverview && calendarOverview.nextPosts.length > 0 ? (
              <ul className="space-y-2 text-xs text-gray-300">
                {calendarOverview.nextPosts.map((post, idx) => (
                  <li
                    key={idx}
                    className="flex items-start justify-between gap-2 border-b border-gray-700/60 pb-1 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="font-semibold text-gray-100">
                        {post.data} · {post.formato}
                      </div>
                      <div className="text-[11px] text-gray-400 line-clamp-2">
                        {post.tema}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">
                Nenhum post futuro encontrado no calendário atual.
              </p>
            )}
          </div>

          {/* Card Saúde da Base de Conhecimento */}
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-3">
              <span>🧠</span>
              <span>Saúde da IA & Conhecimento</span>
            </h2>
            {loadingOverview || !knowledgeOverview ? (
              <p className="text-xs text-gray-400">Carregando...</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-900/60 rounded-lg p-2 border border-gray-700/60">
                  <div className="text-[11px] text-gray-400">Prompts</div>
                  <div className="text-sm font-semibold text-gray-100">
                    {knowledgeOverview.promptsCount}
                  </div>
                </div>
                <div className="bg-gray-900/60 rounded-lg p-2 border border-gray-700/60">
                  <div className="text-[11px] text-gray-400">Regras</div>
                  <div className="text-sm font-semibold text-gray-100">
                    {knowledgeOverview.rulesCount}
                  </div>
                </div>
                <div className="bg-gray-900/60 rounded-lg p-2 border border-gray-700/60">
                  <div className="text-[11px] text-gray-400">Docs DNA</div>
                  <div className="text-sm font-semibold text-gray-100">
                    {knowledgeOverview.docsCount}
                  </div>
                </div>
                <div className="bg-gray-900/60 rounded-lg p-2 border border-gray-700/60">
                  <div className="text-[11px] text-gray-400">Prompt Chains</div>
                  <div className="text-sm font-semibold text-gray-100">
                    {knowledgeOverview.chainsCount}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Seções detalhadas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Timeline de Conteúdo (2/3) */}
          <div className="lg:col-span-2 bg-gray-800/80 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span>📆</span>
                <span>Timeline de Conteúdo</span>
              </h2>
              <Link
                to={`/client/${clientId}/calendar`}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Abrir calendário completo →
              </Link>
            </div>

            {loadingOverview ? (
              <p className="text-sm text-gray-400">Carregando timeline...</p>
            ) : calendarOverview && calendarOverview.nextPosts.length > 0 ? (
              <ul className="space-y-3 text-sm text-gray-200">
                {calendarOverview.nextPosts.map((post, idx) => (
                  <li
                    key={idx}
                    className="flex items-start justify-between gap-4 border-b border-gray-700/60 pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="text-xs text-gray-400 mb-1">
                        {post.data} · {post.formato}
                      </div>
                      <div className="font-medium mb-1">{post.tema}</div>
                      {post.objetivo && (
                        <div className="text-xs text-gray-400 line-clamp-1">
                          Objetivo: {post.objetivo}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 text-xs">
                      <Link
                        to={`/client/${clientId}/calendar`}
                        className="px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-100"
                      >
                        Ver no calendário
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">
                Ainda não há posts futuros configurados. Gere um calendário para este cliente.
              </p>
            )}
          </div>

          {/* Upload Manual (1/3) */}
          <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-xl">📤</span>
              </div>
              <div>
                <h2 className="font-bold text-white text-sm">Upload Manual de Post</h2>
                <p className="text-xs text-gray-400">
                  Envie uma imagem para análise e sugestão com IA
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Imagem do Post *
                </label>
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
                {file && (
                  <p className="mt-2 text-xs text-gray-400">
                    ✓ {file.name}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Ex: Post sobre lançamento"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Descrição (opcional)
                  </label>
                  <input
                    type="text"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Detalhes adicionais..."
                  />
                </div>
              </div>

              <button
                onClick={handleUploadAndProcess}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Processando...
                  </>
                ) : (
                  <>
                    <span>🤖</span>
                    Enviar e Processar com IA
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
