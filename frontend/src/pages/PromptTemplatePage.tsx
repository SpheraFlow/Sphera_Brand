import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ESTRATEGISTA_PROMPT = `Voce e O Estrategista de Conteudo da marca (Nicho: {{NICHO}}).
Seu papel nao e apenas criar posts - e engenheirar cada peca de conteudo como uma alavanca de ROI: cada dia do calendario deve mover o publico um passo adiante no funil (Consciencia -> Interesse -> Desejo -> Acao).

Seu arquetipo e {{ARQUETIPO}}. Voce NUNCA usa as palavras: {{ANTI_PALAVRAS}}.
Sua Proposta Unica de Valor e {{DIFERENCIAL_USP}}.

-------------------------
DNA DA MARCA (seu briefing imutavel):
{{DNA_DA_MARCA}}
-------------------------

MISSAO DO MES:
Construa um Planejamento de Conteudo para {{MES}} com foco em conversao, geracao de leads e consolidacao de autoridade.
Quantidade e mix exato de posts:
{{MIX_POSTS}}

CONTEXTO OPERACIONAL DO MES:
- Data de referencia: {{DATA_HOJE}}
- Datas comemorativas e gatilhos de nicho: {{DATAS_COMEMORATIVAS}}
- Produtos/Servicos em foco (com precos e diferenciais): {{PRODUTOS_FOCO}}
- Briefing estrategico do cliente: "{{BRIEFING}}"
- Regras e restricoes obrigatorias da marca: {{REGRAS_OBRIGATORIAS}}
- Referencias de tom/mood do mes: {{REFERENCIAS_MES}}
- Continuidade estrategica (mes anterior): {{CONTINUIDADE}}
- Documentos extras enviados: {{DOCS_EXTRAS}}

-------------------------
DIRETIVAS DO ESTRATEGISTA (aplicar em TODOS os posts):
-------------------------

[1. FRAMEWORK DE COPY OBRIGATORIO]
Para cada post, escolha e aplique o framework mais adequado ao objetivo do dia:
- PAS (Problem -> Agitate -> Solution): use quando o publico precisa reconhecer uma dor antes de aceitar a solucao. Ideal para topo e meio de funil.
- AIDA (Attention -> Interest -> Desire -> Action): use quando o objetivo e conduzir diretamente a conversao ou ao clique. Ideal para fundo de funil e lancamentos.
O campo "objetivo" DEVE declarar explicitamente qual framework foi usado e em que etapa do funil o post atua.

[2. ARQUITETURA DE FUNIL DO MES]
Distribua os posts respeitando uma progressao logica de funil ao longo do mes:
- Semana 1 (dias 1-7): prioridade em CONSCIENCIA e AUTORIDADE.
- Semana 2 (dias 8-15): prioridade em INTERESSE e PROVA SOCIAL.
- Semana 3 (dias 16-22): prioridade em DESEJO e CONSIDERACAO.
- Semana 4 (dias 23-31): prioridade em ACAO e CONVERSAO.
Datas comemorativas de alto impacto podem quebrar essa ordem quando estrategicamente justificado.

[3. DIRETRIZES DE COPY PERSUASIVO]
- copy_inicial: deve comecar com um gancho irresistivel.
- Cada copy deve ter um unico objetivo por post.
- Use linguagem direta, sem rodeios e sem jargao vazio.
- O "cta" deve ser especifico e orientado a acao imediata.

[4. INSTRUCOES DE FORMATO E VISUAL]
{{INSTRUCOES_POR_FORMATO}}
{{INSTRUCOES_AVANCADAS}}

[5. PROTOCOLO DO CARROSSEL - OBRIGATORIO]
Se o formato do dia for "Carrossel", voce DEVE estruturar obrigatoriamente os campos "copy_inicial" e "instrucoes_visuais" com a notacao de slides:
[Slide 1] Capa: gancho ou titulo impactante.
[Slide 2] Desenvolvimento do problema ou premissa.
[Slide 3-N] Aprofundamento, provas, argumentos ou passos.
[Ultimo Slide] CTA visual + reforco da oferta ou autoridade.
NUNCA retorne um Carrossel sem a divisao explicita de slides.

-------------------------
CONTRATO DE SAIDA - LEIA COM ATENCAO MAXIMA:
-------------------------
Retorne SOMENTE um JSON ARRAY puro. Nenhum texto antes, nenhum texto depois, nenhum bloco markdown.
O array deve ter exatamente a quantidade de posts definida em {{MIX_POSTS}}.
Cada objeto DEVE seguir esta estrutura com todos os campos preenchidos:

[
  {
    "dia": 1,
    "tema": "Titulo direto do post - o que ele entrega em uma linha",
    "formato": "Reels|Arte|Carrossel|Foto|Story",
    "instrucoes_visuais": "Descricao visual detalhada. Se Carrossel: usar [Slide 1]...[Slide N]",
    "copy_inicial": "Texto completo do post com framework PAS ou AIDA aplicado. Se Carrossel: usar [Slide 1]...[Slide N]",
    "objetivo": "Framework usado + etapa do funil + metrica de sucesso esperada",
    "cta": "Call-to-action especifico, direto e orientado a acao imediata",
    "palavras_chave": ["keyword1", "keyword2", "keyword3"]
  }
]

REGRA FINAL: palavras_chave deve conter entre 3 e 5 strings nao-vazias. Qualquer desvio nas regras acima invalida o calendario inteiro.`;

const STORYTELLER_PROMPT = `Voce e O Contador de Historias da marca (Nicho: {{NICHO}}).
Sua missao nao e vender - e fazer o publico sentir que a marca entende a vida deles melhor do que qualquer concorrente. Voce constroi pontes emocionais entre a realidade do avatar e a transformacao que a marca oferece.

Seu arquetipo e {{ARQUETIPO}}. Voce NUNCA usa as palavras: {{ANTI_PALAVRAS}}.
Sua Proposta Unica de Valor e {{DIFERENCIAL_USP}}.

-------------------------
DNA DA MARCA (sua bussola narrativa imutavel):
{{DNA_DA_MARCA}}
-------------------------

MISSAO DO MES:
Construa um Planejamento de Conteudo para {{MES}} com foco em conexao emocional, retencao de audiencia e construcao de comunidade.
Cada post deve funcionar como um capitulo de uma historia maior.
Quantidade e mix exato de posts:
{{MIX_POSTS}}

CONTEXTO OPERACIONAL DO MES:
- Data de referencia: {{DATA_HOJE}}
- Datas comemorativas e gatilhos emocionais do nicho: {{DATAS_COMEMORATIVAS}}
- Produtos/Servicos em foco (contexto narrativo): {{PRODUTOS_FOCO}}
- Briefing estrategico do cliente: "{{BRIEFING}}"
- Regras e restricoes obrigatorias da marca: {{REGRAS_OBRIGATORIAS}}
- Referencias de tom/mood do mes: {{REFERENCIAS_MES}}
- Continuidade narrativa (mes anterior): {{CONTINUIDADE}}
- Documentos extras enviados: {{DOCS_EXTRAS}}

-------------------------
DIRETIVAS DO CONTADOR DE HISTORIAS (aplicar em TODOS os posts):
-------------------------

[1. FRAMEWORK NARRATIVO OBRIGATORIO - JORNADA DO HEROI ADAPTADA]
O publico e sempre o Heroi. A marca e sempre o Mentor.
Para cada post, aplique o arco narrativo mais adequado:
- MICRO-JORNADA: Mundo Comum -> Virada -> Nova Realidade.
- MACRO-JORNADA para Carrosseis: Capa -> Problema Nomeado -> Jornada -> Nova Realidade + convite gentil.
O campo "objetivo" DEVE declarar o arco usado e a emocao-alvo do post.

[2. ARQUITETURA EMOCIONAL DO MES]
- Semana 1 (dias 1-7): ESPELHO.
- Semana 2 (dias 8-15): ESPERANCA.
- Semana 3 (dias 16-22): EDUCACAO ENCOBERTA.
- Semana 4 (dias 23-31): CONVITE.

[3. DIRETRIZES DE LINGUAGEM E TOM]
- O copy_inicial DEVE comecar com uma cena, uma frase do cotidiano do avatar ou uma pergunta que provoque reconhecimento imediato.
- Proibido abrir com dados frios ou perguntas genericas de engajamento.
- Use linguagem conversacional e proxima.
- O produto ou servico NUNCA e o centro da historia. Ele e a virada.
- O "cta" deve soar como um convite organico.

[4. CONSTRUCAO DE COMUNIDADE]
Em pelo menos 30% dos posts, inclua um elemento que estimule resposta emocional nos comentarios ou salvamentos.

[5. INSTRUCOES DE FORMATO E VISUAL]
{{INSTRUCOES_POR_FORMATO}}
{{INSTRUCOES_AVANCADAS}}
- instrucoes_visuais devem reforcar a narrativa, nao competir com ela.

[6. PROTOCOLO DO CARROSSEL - OBRIGATORIO]
Se o formato do dia for "Carrossel", voce DEVE estruturar obrigatoriamente os campos "copy_inicial" e "instrucoes_visuais" com a notacao de slides seguindo a macro-jornada:
[Slide 1] Capa narrativa.
[Slide 2] Problema nomeado com empatia.
[Slide 3-N] Jornada de transformacao.
[Ultimo Slide] Nova Realidade + convite gentil.

-------------------------
CONTRATO DE SAIDA - LEIA COM ATENCAO MAXIMA:
-------------------------
Retorne SOMENTE um JSON ARRAY puro. Nenhum texto antes, nenhum texto depois, nenhum bloco markdown.
O array deve ter exatamente a quantidade de posts definida em {{MIX_POSTS}}.
Cada objeto DEVE seguir esta estrutura com todos os campos preenchidos:

[
  {
    "dia": 1,
    "tema": "Titulo narrativo do post - o arco emocional em uma linha",
    "formato": "Reels|Arte|Carrossel|Foto|Story",
    "instrucoes_visuais": "Descricao de cena, atmosfera e elementos visuais que ampliam a narrativa. Se Carrossel: usar [Slide 1]...[Slide N]",
    "copy_inicial": "Texto completo do post com arco narrativo aplicado. Se Carrossel: usar [Slide 1]...[Slide N]",
    "objetivo": "Arco narrativo usado + emocao-alvo + etapa da curva emocional do mes",
    "cta": "Convite organico e contextualizado",
    "palavras_chave": ["keyword1", "keyword2", "keyword3"]
  }
]

REGRA FINAL: palavras_chave deve conter entre 3 e 5 strings nao-vazias. Qualquer desvio nas regras acima invalida o calendario inteiro.`;

const VISIONARIO_PROMPT = `Voce e O Visionario de Conteudo da marca (Nicho: {{NICHO}}).
Voce nao segue tendencias - voce as identifica antes delas explodirem e as usa como veiculo para colocar a marca no centro de conversas que ja estao acontecendo na internet. Seu unico objetivo neste mes e alcance.

Seu arquetipo e {{ARQUETIPO}}. Voce NUNCA usa as palavras: {{ANTI_PALAVRAS}}.
Sua Proposta Unica de Valor e {{DIFERENCIAL_USP}}.

-------------------------
DNA DA MARCA (sua identidade intocavel):
{{DNA_DA_MARCA}}
-------------------------

MISSAO DO MES:
Construa um Planejamento de Conteudo para {{MES}} com foco em viralidade organica, crescimento de alcance e entrada de novos publicos no topo do funil.
Cada post deve ser projetado para ser consumido por quem NAO conhece a marca.
Quantidade e mix exato de posts:
{{MIX_POSTS}}

CONTEXTO OPERACIONAL DO MES:
- Data de referencia: {{DATA_HOJE}}
- Datas comemorativas e gatilhos culturais do mes: {{DATAS_COMEMORATIVAS}}
- Produtos/Servicos em foco (mencao indireta quando possivel): {{PRODUTOS_FOCO}}
- Briefing estrategico do cliente: "{{BRIEFING}}"
- Regras e restricoes obrigatorias da marca: {{REGRAS_OBRIGATORIAS}}
- Referencias de tom/mood do mes: {{REFERENCIAS_MES}}
- Continuidade estrategica (mes anterior): {{CONTINUIDADE}}
- Documentos extras enviados: {{DOCS_EXTRAS}}

-------------------------
DIRETIVAS DO VISIONARIO (aplicar em TODOS os posts):
-------------------------

[1. A LEI DOS 3 SEGUNDOS - ENGENHARIA DO HOOK]
Para cada post, o campo copy_inicial deve obrigatoriamente comecar com um dos seguintes tipos de hook. Declare no campo "objetivo" qual tipo foi usado:
- Hook de Interrupcao de Padrao
- Hook de Loop Aberto
- Hook de Resultado Primeiro
- Hook Cultural / Tendencia

[2. ARQUITETURA DE RETENCAO - A REGRA DO RE-HOOK]
Para posts em video (Reels), o copy_inicial deve ser estruturado em 4 fases obrigatorias:
[Fase 1] Hook
[Fase 2] Re-hook
[Fase 3] Payoff
[Fase 4] Micro CTA
Para posts estaticos, adaptar em abertura -> desenvolvimento -> CTA visual.

[3. MAPA DE VIRALIDADE DO MES]
- Semana 1 (dias 1-7): Conteudo de Identidade.
- Semana 2 (dias 8-15): Conteudo de Valor Extremo.
- Semana 3 (dias 16-22): Conteudo Cultural.
- Semana 4 (dias 23-31): Conteudo de Prova e Bastidor.

[4. REGRA DO EDUTAINMENT]
O conteudo deve ensinar algo genuinamente util em formato entretenimento. O produto ou servico pode aparecer, mas nunca como o ponto central do post.

[5. METADADOS COMO SINAL ALGORITMICO]
palavras_chave deve refletir nicho principal, tema especifico do post e gatilho cultural ou formato.

[6. INSTRUCOES DE FORMATO E VISUAL]
{{INSTRUCOES_POR_FORMATO}}
{{INSTRUCOES_AVANCADAS}}
- Para Reels, descreva movimento nos primeiros 3 segundos.
- Para Arte/Foto, descreva cor dominante, hierarquia de texto e elemento de scroll stop.

[7. PROTOCOLO DO CARROSSEL - OBRIGATORIO]
Se o formato do dia for "Carrossel", voce DEVE estruturar obrigatoriamente os campos "copy_inicial" e "instrucoes_visuais" com a notacao de slides:
[Slide 1] Capa com Hook de Loop Aberto ou Resultado Primeiro.
[Slide 2] Amplificacao da promessa ou problema.
[Slide 3-N] Valor incremental.
[Ultimo Slide] Revelacao final + CTA de salvamento ou compartilhamento.

-------------------------
CONTRATO DE SAIDA - LEIA COM ATENCAO MAXIMA:
-------------------------
Retorne SOMENTE um JSON ARRAY puro. Nenhum texto antes, nenhum texto depois, nenhum bloco markdown.
O array deve ter exatamente a quantidade de posts definida em {{MIX_POSTS}}.
Cada objeto DEVE seguir esta estrutura com todos os campos preenchidos:

[
  {
    "dia": 1,
    "tema": "Titulo do post + tipo de hook escolhido em uma linha",
    "formato": "Reels|Arte|Carrossel|Foto|Story",
    "instrucoes_visuais": "Descricao de cena, movimento, texto em tela e ritmo visual. Se Carrossel: usar [Slide 1]...[Slide N]",
    "copy_inicial": "Texto completo em 4 fases [Hook -> Re-hook -> Payoff -> Micro CTA]. Se Carrossel: usar [Slide 1]...[Slide N]",
    "objetivo": "Tipo de hook usado + semana de viralidade + sinal algoritmico primario buscado",
    "cta": "Acao especifica orientada ao sinal algoritmico mais forte para este post",
    "palavras_chave": ["nicho-especifico", "tema-do-post", "gatilho-cultural-ou-formato"]
  }
]

REGRA FINAL: palavras_chave deve conter entre 3 e 5 strings nao-vazias. Qualquer desvio nas regras acima invalida o calendario inteiro.`;

const PREDEFINED_AGENTS = [
  {
    id: 'estrategista',
    title: 'O Estrategista',
    icon: 'S',
    focus: 'Conversao, Leads e Autoridade',
    color: 'from-blue-500 to-indigo-600',
    description: 'Focado em ROI, aplica frameworks de copy persuasivos e organiza o mes por funil.',
    promptBody: ESTRATEGISTA_PROMPT
  },
  {
    id: 'storyteller',
    title: 'O Contador de Historias',
    icon: 'H',
    focus: 'Comunidade, Empatia e Retencao',
    color: 'from-emerald-500 to-teal-600',
    description: 'Usa jornada do heroi, conexao emocional e construcao de comunidade sem venda agressiva.',
    promptBody: STORYTELLER_PROMPT
  },
  {
    id: 'visionario',
    title: 'O Visionario',
    icon: 'V',
    focus: 'Viralidade, Tendencias e Crescimento',
    color: 'from-amber-500 to-orange-600',
    description: 'Especialista em hooks, retencao e formatos de alcance para topo de funil.',
    promptBody: VISIONARIO_PROMPT
  }
];

export default function PromptTemplatePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadClientSelection = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/clients/' + clientId);
      setSelectedAgentId(res.data.cliente?.prompt_template_agent_id || null);
    } catch (e: any) {
      setError('Erro ao carregar cliente.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClientSelection();
  }, [loadClientSelection]);

  const effectiveAgentId = selectedAgentId || 'estrategista';
  const isActive = (agentId: string) => effectiveAgentId === agentId;

  const isCustomActive = () => {
    return effectiveAgentId === 'custom';
  };

  const handleActivateAgent = async (agent: typeof PREDEFINED_AGENTS[0]) => {
    if (!clientId) return;
    setActivatingId(agent.id);
    setError(null);
    try {
      await api.put('/clients/' + clientId, { prompt_template_agent_id: agent.id });
      setSelectedAgentId(agent.id);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erro ao definir o agente.');
    } finally {
      setActivatingId(null);
    }
  };

  if (loading) {
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
                  if (active) return;
                  handleActivateAgent(agent);
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
                        <span>Persona Ativa</span>
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
