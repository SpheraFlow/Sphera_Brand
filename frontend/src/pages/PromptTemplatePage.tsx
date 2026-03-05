import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TemplateVersion {
  id: string;
  cliente_id: string | null;
  version: number;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  body?: string;
  agent_id?: string;
}

const PREDEFINED_AGENTS = [
  {
    id: 'estrategista',
    title: 'O Estrategista',
    icon: '🎯',
    focus: 'Conversão, Leads e Autoridade',
    color: 'from-blue-500 to-indigo-600',
    description: 'Focado em ROI, aplica frameworks de Copywriting persuasivos (PAS/AIDA). Seu tom é direto e focado em avançar o público no funil de vendas.',
    promptBody: `Atue como um Sênior Growth Hacker e Social Media Strategist. Sua meta é ROI e Conversão. Aplique frameworks de Copywriting agressivos como PAS (Problem-Agitate-Solve) e AIDA. Seu foco é educar para vender.

DNA da Marca: {{DNA_DA_MARCA}}
Nicho: {{NICHO}} | Arquétipo: {{ARQUETIPO}} | USP: {{DIFERENCIAL_USP}}

Regras Ocultas: Em cada post, obrigatoriamente trace como ele avança o lead no funil de vendas. Crie CTAs fortíssimos.

Mês de Referência: {{MES}}. Data Ref: {{DATA_HOJE}}.
Datas Comemorativas do Mês: {{DATAS_COMEMORATIVAS}}
Regras Base: {{REGRAS_OBRIGATORIAS}}

Crie EXATAMENTE o seguinte mix de posts:
{{MIX_POSTS}}

Retorne APENAS um JSON ARRAY PURO (sem markdown). Cada item com: "dia" (num), "tema", "formato" (Reels, Static, Carousel ou Stories), "instrucoes_visuais", "copy_inicial", "objetivo", "cta", "palavras_chave" (array). Não repita dias.`
  },
  {
    id: 'storyteller',
    title: 'O Contador de Histórias',
    icon: '📖',
    focus: 'Comunidade, Empatia e Retenção',
    color: 'from-emerald-500 to-teal-600',
    description: 'Mestre em Jornada do Herói. Cria postagens que conectam emocionalmente e educam sem parecer que estão vendendo.',
    promptBody: `Atue como um Community Manager de elite e Mestre em Storytelling. Seu único objetivo é criar conexão emocional autêntica e reter a comunidade.

DNA da Marca: {{DNA_DA_MARCA}}
Nicho: {{NICHO}} | Arquétipo: {{ARQUETIPO}} | USP: {{DIFERENCIAL_USP}}

Regras Ocultas: Priorize formatos educacionais e histórias de clientes/bastidores. Jamais seja puramente comercial. Faça o público se sentir pertencente.

Mês de Referência: {{MES}}. Data Ref: {{DATA_HOJE}}.
Datas Comemorativas do Mês: {{DATAS_COMEMORATIVAS}}
Regras Base: {{REGRAS_OBRIGATORIAS}}

Crie EXATAMENTE o seguinte mix de posts:
{{MIX_POSTS}}

Retorne APENAS um JSON ARRAY PURO (sem markdown). Cada item com: "dia" (num), "tema", "formato" (Reels, Static, Carousel ou Stories), "instrucoes_visuais", "copy_inicial", "objetivo", "cta", "palavras_chave" (array). Não repita dias.`
  },
  {
    id: 'visionario',
    title: 'O Visionário',
    icon: '🚀',
    focus: 'Viralidade, Tendências e Crescimento',
    color: 'from-amber-500 to-orange-600',
    description: 'Especialista em Cultura Pop e TikTok. Ideal para o topo de funil, visando alcance máximo com hooks dinâmicos.',
    promptBody: `Atue como um Especialista em Cultura Pop e Algoritmos de Vídeos Curtos (TikTok/Reels). Seu objetivo é o alcance máximo absoluto e viralidade de topo de funil.

DNA da Marca: {{DNA_DA_MARCA}}
Nicho: {{NICHO}} | Arquétipo: {{ARQUETIPO}} | USP: {{DIFERENCIAL_USP}}

Regras Ocultas: Para cada post gerado, pense no 'Hook' (gancho dos primeiros 3 segundos). Traga propostas de vídeos dinâmicos, memes adaptados ao nicho e formatos interativos de altíssima retenção visual.

Mês de Referência: {{MES}}. Data Ref: {{DATA_HOJE}}.
Datas Comemorativas do Mês: {{DATAS_COMEMORATIVAS}}
Regras Base: {{REGRAS_OBRIGATORIAS}}

Crie EXATAMENTE o seguinte mix de posts:
{{MIX_POSTS}}

Retorne APENAS um JSON ARRAY PURO (sem markdown). Cada item com: "dia" (num), "tema", "formato" (Reels, Static, Carousel ou Stories), "instrucoes_visuais", "copy_inicial", "objetivo", "cta", "palavras_chave" (array). Não repita dias.`
  }
];

export default function PromptTemplatePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [allTemplates, setAllTemplates] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/prompt-templates/' + clientId);
      setAllTemplates(res.data.data);
    } catch (e: any) {
      if (e.response?.status !== 404) {
        setError('Erro ao carregar templates.');
      } else {
        setAllTemplates([]);
      }
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Retorna o template global (cliente_id = null) para um agentId
  const getGlobalTemplate = (agentId: string) =>
    allTemplates.find(t => t.agent_id === agentId && t.cliente_id === null) ?? null;

  // Um agente está ativo quando seu template GLOBAL está ativo
  const isActive = (agentId: string) => {
    const tpl = getGlobalTemplate(agentId);
    return tpl?.is_active === true;
  };

  const isCustomActive = () => {
    return allTemplates.some(t => t.agent_id === 'custom' && t.cliente_id === null && t.is_active);
  };

  const handleActivateAgent = async (agent: typeof PREDEFINED_AGENTS[0]) => {
    setActivatingId(agent.id);
    setError(null);
    try {
      let tpl = getGlobalTemplate(agent.id);

      // Se não existe template global para este agente, criar agora
      if (!tpl) {
        await api.post('/prompt-templates/predefined', {
          clienteId: null,
          label: 'Global: ' + agent.title,
          body: agent.promptBody,
          agentId: agent.id,
        }).then(r => r.data.data);
        // predefined já cria como ativo, só recarregar
        await loadTemplates();
        // Se chegou aqui já está ativo, sair
        setActivatingId(null);
        return;
      }

      await api.post(`/prompt-templates/${tpl.id}/activate`);
      await loadTemplates();
    } catch (e: any) {
      const errs = e.response?.data?.errors?.join('\n');
      setError(errs ?? e.response?.data?.message ?? 'Erro ao ativar o agente.');
    } finally {
      setActivatingId(null);
    }
  };

  const handleDeactivateAgent = async (agent: typeof PREDEFINED_AGENTS[0]) => {
    const tpl = getGlobalTemplate(agent.id);
    if (!tpl) return;
    setActivatingId(agent.id);
    setError(null);
    try {
      await api.post(`/prompt-templates/${tpl.id}/deactivate`);
      await loadTemplates();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erro ao desativar o agente.');
    } finally {
      setActivatingId(null);
    }
  };

  if (loading && allTemplates.length === 0) {
    return (
      <div className="min-h-screen bg-[#06080e] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-mono">Carregando cérebro da IA...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Header ── */}
      <header className="border-b border-slate-800/60 px-8 py-8 bg-[#07090f] text-center">
        <span className="w-10 h-1 rounded-full bg-cyan-500 block mx-auto mb-4" />
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Cérebro da IA (Persona)</h1>
        <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Escolha como deseja que a IA se comporte ao planejar o conteúdo deste cliente.
          Selecionar um modelo altera imediatamente todas as próximas gerações.
        </p>
      </header>

      {/* ── Banners de erro ── */}
      {error && (
        <div className="max-w-5xl mx-auto w-full mt-6 px-4">
          <div className="flex items-start gap-2 bg-red-950/30 border border-red-800/40 text-red-400 px-4 py-3 rounded-lg text-sm font-mono">
            <span>⚠</span> {error}
          </div>
        </div>
      )}

      {/* ── Grid de Cards ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {PREDEFINED_AGENTS.map((agent) => {
            const active = isActive(agent.id);
            const activating = activatingId === agent.id;

            return (
              <div
                key={agent.id}
                onClick={() => {
                  if (activating) return;
                  if (active) handleDeactivateAgent(agent);
                  else handleActivateAgent(agent);
                }}
                className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 flex flex-col h-full cursor-pointer ${active ? 'border-indigo-500 bg-indigo-950/20 shadow-[0_0_30px_rgba(99,102,241,0.15)] transform scale-[1.02]' : 'border-slate-800/60 bg-[#0b0e17] hover:border-slate-600 hover:bg-[#0d111c]'} ${activating ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {active && (
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
                )}

                <div className="p-6 flex-1 flex flex-col">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 bg-gradient-to-br ${agent.color} shadow-lg shadow-black/50`}>
                    {agent.icon}
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{agent.title}</h3>
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">{agent.focus}</p>

                  <p className="text-sm text-slate-400 leading-relaxed flex-1">
                    {agent.description}
                  </p>

                  <div className="pt-6 mt-auto space-y-2">
                    {active ? (
                      <div className="flex items-center justify-center gap-2 bg-indigo-900/30 border border-indigo-700/50 text-indigo-300 py-2.5 rounded-lg text-sm font-semibold w-full group-hover:bg-red-900/20 group-hover:border-red-700/40 group-hover:text-red-300 transition-colors">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                        </span>
                        <span className="group-hover:hidden">Persona Ativa</span>
                        <span className="hidden group-hover:inline">Clique para desativar</span>
                      </div>
                    ) : (
                      <button
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                        disabled={activating}
                      >
                        {activating ? 'Ativando...' : 'Selecionar'}
                      </button>
                    )}
                    {isAdmin() && (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/client/${clientId}/prompt-template/editor/${agent.id}`); }}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/50 py-2 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Editar Prompt
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Card do Custom Agent (ARIA) */}
          <div
            onClick={() => navigate('/client/' + clientId + '/prompt-onboarding')}
            className={`relative overflow-hidden rounded-2xl border transition-all duration-300 flex flex-col h-full cursor-pointer ${isCustomActive() ? 'border-fuchsia-500 bg-fuchsia-950/20 shadow-[0_0_30px_rgba(217,70,239,0.15)] transform scale-[1.02]' : 'border-slate-800/60 bg-[#0b0e17] hover:border-slate-600 hover:bg-[#0d111c]'}`}
          >
            {isCustomActive() && (
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-fuchsia-500 to-pink-500" />
            )}

            <div className="p-6 flex-1 flex flex-col">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 bg-gradient-to-br from-fuchsia-600 to-pink-600 shadow-lg shadow-black/50">
                ✨
              </div>

              <h3 className="text-lg font-bold text-white mb-1">O Especialista Sob Medida</h3>
              <p className="text-xs font-semibold text-fuchsia-400 uppercase tracking-wider mb-4">Chatbot da Plataforma</p>

              <p className="text-sm text-slate-400 leading-relaxed flex-1">
                Converse com a nossa Assistente de Planejamento (ARIA) para desenhar uma persona de estratégia totalmente customizada do zero para a sua necessidade atual.
              </p>

              <div className="pt-6 mt-auto space-y-2">
                {isCustomActive() ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-center gap-2 bg-fuchsia-900/30 border border-fuchsia-700/50 text-fuchsia-300 py-2.5 rounded-lg text-sm font-semibold w-full">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-fuchsia-500"></span>
                      </span>
                      Persona Ativa (Custom)
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); navigate('/client/' + clientId + '/prompt-onboarding'); }} className="text-xs text-center text-slate-400 hover:text-white underline decoration-slate-600 underline-offset-2 mt-2">
                      Refazer setup
                    </button>
                  </div>
                ) : (
                  <button className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-fuchsia-500/20">
                    Criar com ARIA
                  </button>
                )}
                {isAdmin() && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/client/${clientId}/prompt-template/editor/custom`); }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/50 py-2 rounded-lg transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Editar Prompt
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
