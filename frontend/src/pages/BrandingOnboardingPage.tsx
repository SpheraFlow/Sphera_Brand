import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { JUNG_ARCHETYPES } from '../utils/jungArchetypes';

//  Tipos 

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface ExtractedBranding {
  visual_style: { colors: string[]; fonts: string[]; archeType: string };
  tone_of_voice: { description: string; keywords: string[] };
  audience: { persona: string; demographics: string };
  keywords: string[];
  archetype: string;
  usp: string;
  anti_keywords: string[];
  niche: string;
  logo_url?: string;
}

type Phase = 'chat' | 'review' | 'saving' | 'done';

//  Helper: chip editavel 

function TagInput({
  label,
  tags,
  onChange,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput('');
  };

  return (
    <div>
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 bg-gray-700 text-gray-200 text-sm px-3 py-1 rounded-full"
          >
            {t}
            <button
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="text-gray-400 hover:text-red-400 ml-1 leading-none"
            >
              
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder || 'Digite e pressione Enter'}
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={add}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

//  Componente Principal 

export default function BrandingOnboardingPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Estado da review
  const [dna, setDna] = useState<ExtractedBranding>({
    visual_style: { colors: [], fonts: [], archeType: '' },
    tone_of_voice: { description: '', keywords: [] },
    audience: { persona: '', demographics: '' },
    keywords: [],
    archetype: '',
    usp: '',
    anti_keywords: [],
    niche: '',
    logo_url: '',
  });

  // Iniciar conversa automaticamente
  useEffect(() => {
    startConversation();
  }, []);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const startConversation = async () => {
    setIsTyping(true);
    setError(null);
    try {
      const res = await api.post(`/onboarding/chat/${clientId}`, {
        messages: [],
        userMessage: '',
      });
      const reply: string = res.data.reply;
      setMessages([{ role: 'model', content: reply }]);
    } catch {
      setError('Nao foi possivel iniciar o onboarding. Verifique sua conexao.');
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);
    setError(null);

    try {
      const res = await api.post(`/onboarding/chat/${clientId}`, {
        messages: newMessages.slice(0, -1), // historico sem a ultima mensagem (ja esta no userMessage)
        userMessage: text,
      });

      const reply: string = res.data.reply;
      const isComplete: boolean = res.data.isComplete;
      const extractedData: ExtractedBranding | null = res.data.extractedData ?? null;

      setMessages([...newMessages, { role: 'model', content: reply }]);

      if (isComplete && extractedData) {
        // Preencher o estado de review com os dados extraidos
        setDna({
          visual_style: {
            colors: extractedData.visual_style?.colors ?? [],
            fonts: extractedData.visual_style?.fonts ?? [],
            archeType: extractedData.visual_style?.archeType ?? '',
          },
          tone_of_voice: {
            description: extractedData.tone_of_voice?.description ?? '',
            keywords: extractedData.tone_of_voice?.keywords ?? [],
          },
          audience: {
            persona: extractedData.audience?.persona ?? '',
            demographics: extractedData.audience?.demographics ?? '',
          },
          keywords: extractedData.keywords ?? [],
          archetype: extractedData.archetype ?? '',
          usp: extractedData.usp ?? '',
          anti_keywords: extractedData.anti_keywords ?? [],
          niche: extractedData.niche ?? '',
          logo_url: '',
        });

        // Pequena pausa para o usuario ler a mensagem final antes de transitar
        setTimeout(() => setPhase('review'), 1800);
      }
    } catch {
      setError('Erro ao enviar mensagem. Tente novamente.');
      setMessages(newMessages); // Manter apenas ate a msg do user
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };


  const saveDna = async () => {
    setPhase('saving');
    setError(null);
    try {
      await api.put('/branding/' + clientId, dna);
      await api.put('/clients/' + clientId, { logo_url: dna.logo_url || null });
      setPhase('done');
    } catch {
      setError('Erro ao salvar DNA. Tente novamente.');
      setPhase('review');
    }
  };

  //  FASE: CHAT 
  if (phase === 'chat') {
    return (
      <div className="h-screen flex flex-col bg-gray-900 text-white">
        {/* Header */}
        <div className="border-b border-gray-700 px-6 py-4 flex items-center gap-4 bg-gray-800/60">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-lg font-bold shadow-lg">
            A
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">ARIA</h1>
            <p className="text-xs text-gray-400">Especialista em DNA de Marca  Sphera Brand</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-400">Online</span>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0 mt-1">
                  A
                </div>
              )}
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">
                A
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center">
              <span className="text-sm text-red-400 bg-red-900/30 border border-red-700 px-4 py-2 rounded-lg inline-block">
                {error}
              </span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-700 p-4 bg-gray-800/60">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Responda aqui... (Enter para enviar, Shift+Enter para nova linha)"
              rows={2}
              disabled={isTyping}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isTyping}
              className="w-11 h-11 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-center text-xs text-gray-600 mt-2">
            A ARIA ira extrair automaticamente o DNA da marca ao final da conversa
          </p>
        </div>
      </div>
    );
  }

  //  FASE: REVIEW 
  if (phase === 'review') {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <div className="border-b border-gray-700 px-6 py-4 bg-gray-800/60 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="font-bold text-lg text-white flex items-center gap-2">
              S& DNA Extraido  Revise e Edite
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Confirme as informacoes antes de salvar. Voce pode editar qualquer campo.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('chat')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-sm rounded-lg transition-colors"
            >
                Voltar ao Chat
            </button>
            <button
              onClick={saveDna}
              className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg transition-colors"
            >
              S Confirmar e Salvar DNA
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="max-w-5xl mx-auto p-6 space-y-8">

          {/* 1. Estrategia */}
          <section className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-700 pb-3">
              Estrategia & Identidade
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                  Nicho de Mercado
                </label>
                <input
                  value={dna.niche}
                  onChange={(e) => setDna({ ...dna, niche: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ex: Estetica feminina premium, B2B SaaS..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                  Arquetipo da Marca
                </label>
                <select
                  value={dna.archetype}
                  onChange={(e) => setDna({ ...dna, archetype: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Selecione um arquetipo...</option>
                  {JUNG_ARCHETYPES.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.emoji} {a.label}  {a.tone_hint}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Proposta Unica de Valor (USP)
              </label>
              <textarea
                value={dna.usp}
                onChange={(e) => setDna({ ...dna, usp: e.target.value })}
                rows={2}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                placeholder="O que torna esta marca unica e por que o cliente deveria escolhe-la?"
              />
            </div>

            <TagInput
              label="Palavras-chave Estrategicas"
              tags={dna.keywords}
              onChange={(v) => setDna({ ...dna, keywords: v })}
              placeholder="Ex: inovacao, resultados, saude..."
            />

            <TagInput
              label="Palavras / Temas a Evitar (Anti-keywords)"
              tags={dna.anti_keywords}
              onChange={(v) => setDna({ ...dna, anti_keywords: v })}
              placeholder="Ex: barato, mediocridade, generico..."
            />
          </section>

          {/* 2. Tom de Voz */}
          <section className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-700 pb-3">
               Tom de Voz
            </h2>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Descricao do Tom
              </label>
              <textarea
                value={dna.tone_of_voice.description}
                onChange={(e) =>
                  setDna({ ...dna, tone_of_voice: { ...dna.tone_of_voice, description: e.target.value } })
                }
                rows={3}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Como a marca se comunica? Formal ou informal? Seria ou descontraida?"
              />
            </div>

            <TagInput
              label="Palavras que Definem a Voz"
              tags={dna.tone_of_voice.keywords ?? []}
              onChange={(v) =>
                setDna({ ...dna, tone_of_voice: { ...dna.tone_of_voice, keywords: v } })
              }
              placeholder="Ex: empoderador, direto, acolhedor..."
            />
          </section>

          {/* 3. Publico-alvo */}
          <section className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-700 pb-3">
               Publico-Alvo
            </h2>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Persona Detalhada
              </label>
              <textarea
                value={dna.audience.persona}
                onChange={(e) =>
                  setDna({ ...dna, audience: { ...dna.audience, persona: e.target.value } })
                }
                rows={3}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Descreva quem e o cliente ideal: nome, profissao, dores, desejos, habitos..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Dados Demograficos
              </label>
              <input
                value={dna.audience.demographics}
                onChange={(e) =>
                  setDna({ ...dna, audience: { ...dna.audience, demographics: e.target.value } })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Ex: Mulheres, 25-40 anos, classe B, Sao Paulo..."
              />
            </div>
          </section>

          {/* 4. Identidade Visual */}
          <section className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-700 pb-3">
              Identidade Visual
            </h2>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Estilo Visual
              </label>
              <input
                value={dna.visual_style.archeType}
                onChange={(e) =>
                  setDna({ ...dna, visual_style: { ...dna.visual_style, archeType: e.target.value } })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Ex: Minimalista premium, Vibrante e jovem, Sobrio corporativo..."
              />
            </div>

            {/* Cores */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                Cores Principais
              </label>
              <div className="flex flex-wrap gap-3 mb-3">
                {(dna.visual_style.colors ?? []).map((color, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-1.5">
                    <div
                      className="w-5 h-5 rounded-full border border-gray-500 flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-mono text-gray-200">{color}</span>
                    <button
                      onClick={() =>
                        setDna({
                          ...dna,
                          visual_style: {
                            ...dna.visual_style,
                            colors: dna.visual_style.colors.filter((_, idx) => idx !== i),
                          },
                        })
                      }
                      className="text-gray-500 hover:text-red-400 ml-1"
                    >
                      
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="color"
                  onChange={(e) => {
                    const hex = e.target.value;
                    if (!dna.visual_style.colors.includes(hex)) {
                      setDna({
                        ...dna,
                        visual_style: {
                          ...dna.visual_style,
                          colors: [...dna.visual_style.colors, hex],
                        },
                      });
                    }
                  }}
                  className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                  title="Escolher cor"
                />
                <ColorHexInput
                  onAdd={(hex) => {
                    if (!dna.visual_style.colors.includes(hex)) {
                      setDna({
                        ...dna,
                        visual_style: {
                          ...dna.visual_style,
                          colors: [...dna.visual_style.colors, hex],
                        },
                      });
                    }
                  }}
                />
              </div>
            </div>

            <TagInput
              label="Fontes"
              tags={dna.visual_style.fonts ?? []}
              onChange={(v) =>
                setDna({ ...dna, visual_style: { ...dna.visual_style, fonts: v } })
              }
              placeholder="Ex: Montserrat, Playfair Display..."
            />
          </section>

          {/* Botoes finais */}
          <div className="flex justify-between pb-8">
            <button
              onClick={() => setPhase('chat')}
              className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-sm rounded-lg transition-colors"
            >
                Voltar ao Chat
            </button>
            <button
              onClick={saveDna}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg transition-colors"
            >
              S Confirmar e Salvar DNA
            </button>
          </div>
        </div>
      </div>
    );
  }

  //  FASE: SAVING 
  if (phase === 'saving') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-2xl font-bold mx-auto animate-pulse">
            A
          </div>
          <p className="text-lg font-semibold">Salvando DNA da Marca...</p>
          <p className="text-sm text-gray-400">Um momento.</p>
        </div>
      </div>
    );
  }

  //  FASE: DONE 
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
      <div className="text-center space-y-5 max-w-md px-6">
        <div className="w-20 h-20 rounded-full bg-green-900/50 border-2 border-green-500 flex items-center justify-center text-4xl mx-auto">
          S&
        </div>
        <h1 className="text-2xl font-bold">DNA da Marca Salvo!</h1>
        <p className="text-gray-400">
          O DNA foi configurado com sucesso. Agora voce pode gerar calendarios editoriais
          alinhados a identidade desta marca.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate(`/client/${clientId}/branding`)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors"
          >
            Ver DNA da Marca
          </button>
          <button
            onClick={() => navigate(`/client/${clientId}`)}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors"
          >
            Voltar para Visao Geral
          </button>
        </div>
      </div>
    </div>
  );
}

//  Helper: Input de cor hex 

function ColorHexInput({ onAdd }: { onAdd: (hex: string) => void }) {
  const [val, setVal] = useState('');

  const handleAdd = () => {
    const hex = val.trim();
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
      onAdd(hex);
      setVal('');
    }
  };

  return (
    <div className="flex gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
        placeholder="#RRGGBB"
        className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-32"
      />
      <button
        onClick={handleAdd}
        className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
      >
        +
      </button>
    </div>
  );
}





