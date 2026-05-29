import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import {
    briefingAgentService,
    BriefingChatMessage,
    agentService,
    AgentSession,
    AgentMessage,
    AgentType,
} from '../services/api';

interface Props {
    clientId: string;
    campaignContext: {
        goal: string;
        selectedMonths: string[];
        contentMix?: string;
        commemorativeDates?: string;
        restrictions?: string;
    };
    onBriefingReady: (briefing: string) => void;
    /**
     * STORY-014 — quando true, o componente opera no modo de sessões persistentes
     * (sidebar de sessões + memória por cliente). Quando ausente/false, mantém o
     * fluxo legado de briefing usado pelo CampaignWizard (sem quebra de contrato).
     */
    persistentMode?: boolean;
}

function renderMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>');
}

const AGENT_TYPE_LABELS: Record<AgentType, string> = {
    briefing: 'Briefing',
    creative: 'Criativo',
    strategy: 'Estratégia',
};

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

// ────────────────────────────────────────────────────────────────────────
// Modo persistente (STORY-014): sidebar de sessões + chat por cliente
// ────────────────────────────────────────────────────────────────────────
function PersistentAgentChat({ clientId }: { clientId: string }) {
    const [sessions, setSessions] = useState<AgentSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showNewModal, setShowNewModal] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Carrega sessões quando o cliente muda.
    useEffect(() => {
        if (!clientId) return;
        loadSessions();
        setActiveSessionId(null);
        setMessages([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId]);

    const loadSessions = async () => {
        setIsLoadingSessions(true);
        setError(null);
        try {
            const list = await agentService.listSessions(clientId);
            setSessions(list);
        } catch {
            setError('Não foi possível carregar as sessões deste cliente.');
        } finally {
            setIsLoadingSessions(false);
        }
    };

    const openSession = async (sessionId: string) => {
        setActiveSessionId(sessionId);
        setMessages([]);
        setError(null);
        setIsLoading(true);
        try {
            const history = await agentService.getMessages(sessionId);
            setMessages(history);
        } catch {
            setError('Não foi possível carregar o histórico desta sessão.');
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const createSession = async (agentType: AgentType) => {
        setShowNewModal(false);
        setError(null);
        setIsLoadingSessions(true);
        try {
            const session = await agentService.createSession(clientId, agentType);
            setSessions((prev) => [session, ...prev]);
            setActiveSessionId(session.id);
            setMessages([]);
        } catch {
            setError('Não foi possível criar a sessão.');
        } finally {
            setIsLoadingSessions(false);
            inputRef.current?.focus();
        }
    };

    const archiveSession = async (sessionId: string) => {
        try {
            await agentService.archiveSession(sessionId);
            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
            if (activeSessionId === sessionId) {
                setActiveSessionId(null);
                setMessages([]);
            }
        } catch {
            setError('Não foi possível arquivar a sessão.');
        }
    };

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading || !activeSessionId) return;

        // Otimista: exibe a mensagem do usuário imediatamente.
        const optimistic: AgentMessage = {
            id: `tmp-${Date.now()}`,
            session_id: activeSessionId,
            role: 'user',
            content: trimmed,
            tokens_in: 0,
            tokens_out: 0,
            retrieved_chunk_ids: [],
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const result = await agentService.sendMessage(activeSessionId, trimmed);
            // Substitui a otimista pelas mensagens persistidas reais.
            setMessages((prev) => [
                ...prev.filter((m) => m.id !== optimistic.id),
                result.userMessage,
                result.assistantMessage,
            ]);
            // Atualiza indicador de memória/ordem na sidebar.
            await loadSessions();
            setActiveSessionId(activeSessionId);
        } catch {
            setError('Erro ao se comunicar com o agente. Tente novamente.');
            setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
            setInput(trimmed);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex bg-gray-900 border border-gray-700 rounded-xl overflow-hidden h-[28rem]">
            {/* Sidebar de sessões */}
            <aside className="w-56 shrink-0 border-r border-gray-700 bg-gray-800/40 flex flex-col">
                <div className="px-3 py-2.5 border-b border-gray-700 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-300">Sessões</span>
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors"
                        title="Nova sessão"
                    >
                        + Nova
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {isLoadingSessions && (
                        <div className="text-center text-[11px] text-gray-600 py-4">Carregando...</div>
                    )}
                    {!isLoadingSessions && sessions.length === 0 && (
                        <div className="text-center text-[11px] text-gray-600 py-4 px-2">
                            Nenhuma sessão ainda. Crie uma para começar.
                        </div>
                    )}
                    {sessions.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => openSession(s.id)}
                            className={`w-full text-left px-3 py-2 border-b border-gray-800/60 transition-colors group ${
                                s.id === activeSessionId ? 'bg-blue-900/30' : 'hover:bg-gray-800/60'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] font-medium text-gray-200 truncate">
                                    {AGENT_TYPE_LABELS[s.agent_type]}
                                </span>
                                {s.has_memory && (
                                    <span
                                        className="text-[10px] text-purple-300 bg-purple-900/40 px-1.5 py-0.5 rounded"
                                        title="Memória ativa"
                                    >
                                        🧠 memória
                                    </span>
                                )}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate">
                                {s.title || 'Sem título'}
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[10px] text-gray-600">{formatDate(s.last_message_at)}</span>
                                <span
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        archiveSession(s.id);
                                    }}
                                    className="text-[10px] text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    title="Arquivar sessão"
                                >
                                    arquivar
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* Chat principal */}
            <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/60">
                    <div className="flex items-center gap-2">
                        <span className="text-base">🤖</span>
                        <div>
                            <div className="text-sm font-semibold text-gray-100">
                                {activeSession
                                    ? `Agente ${AGENT_TYPE_LABELS[activeSession.agent_type]}`
                                    : 'Agente do Cliente'}
                            </div>
                            <div className="text-[11px] text-gray-500">
                                {activeSession?.has_memory
                                    ? 'Memória ativa — conhece o histórico desta marca'
                                    : 'Especializado e persistente por cliente'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
                    {!activeSessionId && !isLoading && (
                        <div className="text-center text-xs text-gray-600 py-8">
                            Selecione uma sessão ou crie uma nova para conversar.
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                                    msg.role === 'assistant'
                                        ? 'bg-blue-900/30 border border-blue-800/40 text-gray-200'
                                        : 'bg-gray-700 text-white'
                                }`}
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                            />
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl px-4 py-3 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-gray-700 p-3 flex gap-2 items-end bg-gray-800/30">
                    <textarea
                        ref={inputRef}
                        rows={2}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading || !activeSessionId}
                        placeholder={
                            activeSessionId
                                ? 'Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)'
                                : 'Selecione uma sessão para começar'
                        }
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:opacity-50"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading || !activeSessionId}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors self-stretch flex items-center"
                    >
                        Enviar →
                    </button>
                </div>
            </div>

            {/* Modal de nova sessão */}
            {showNewModal && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 w-80">
                        <h4 className="text-sm font-semibold text-gray-100 mb-3">Nova sessão de agente</h4>
                        <p className="text-xs text-gray-500 mb-4">Escolha o tipo de especialista:</p>
                        <div className="flex flex-col gap-2">
                            {(Object.keys(AGENT_TYPE_LABELS) as AgentType[]).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => createSession(t)}
                                    className="w-full text-left bg-gray-900 hover:bg-blue-900/40 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 transition-colors"
                                >
                                    {AGENT_TYPE_LABELS[t]}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowNewModal(false)}
                            className="w-full mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function BriefingAgentChat({ clientId, campaignContext, onBriefingReady, persistentMode }: Props) {
    // STORY-014 — modo de sessões persistentes por cliente.
    if (persistentMode) {
        return (
            <div className="relative">
                <PersistentAgentChat clientId={clientId} />
            </div>
        );
    }

    // ── Fluxo legado de briefing (CampaignWizard) — preservado integralmente ──
    const [messages, setMessages] = useState<BriefingChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [finalBriefing, setFinalBriefing] = useState('');
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Fetch first question on mount
    useEffect(() => {
        initChat();
    }, []);

    const initChat = async () => {
        setMessages([]);
        setInput('');
        setDone(false);
        setFinalBriefing('');
        setError(null);
        setIsLoading(true);
        try {
            const result = await briefingAgentService.chat(clientId, [], campaignContext);
            setMessages([{ role: 'model', content: result.reply }]);
            if (result.done && result.briefing) {
                setFinalBriefing(result.briefing);
                setDone(true);
            }
        } catch {
            setError('Não foi possível iniciar o agente. Verifique sua conexão e tente novamente.');
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        const userMessage: BriefingChatMessage = { role: 'user', content: trimmed };
        const updatedMessages = [...messages, userMessage];

        setMessages(updatedMessages);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const result = await briefingAgentService.chat(clientId, updatedMessages, campaignContext);
            const withReply = [...updatedMessages, { role: 'model' as const, content: result.reply }];
            setMessages(withReply);
            if (result.done && result.briefing) {
                setFinalBriefing(result.briefing);
                setDone(true);
            }
        } catch {
            setError('Erro ao se comunicar com o agente. Tente novamente.');
            setMessages(updatedMessages); // keep user message visible
        } finally {
            setIsLoading(false);
            if (!done) inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (done) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                            Briefing Gerado pela IA
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Revise e edite antes de aplicar</p>
                    </div>
                    <button
                        onClick={initChat}
                        className="text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
                    >
                        🔄 Refazer
                    </button>
                </div>

                <textarea
                    value={finalBriefing}
                    onChange={(e) => setFinalBriefing(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-sm text-gray-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-64 resize-y"
                />

                <button
                    onClick={() => onBriefingReady(finalBriefing)}
                    disabled={!finalBriefing.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-sm"
                >
                    ✅ Usar este Briefing
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/60">
                <div className="flex items-center gap-2">
                    <span className="text-base">🤖</span>
                    <div>
                        <div className="text-sm font-semibold text-gray-100">Agente de Briefing</div>
                        <div className="text-[11px] text-gray-500">Respondendo perguntas para criar seu briefing</div>
                    </div>
                </div>
                <button
                    onClick={initChat}
                    disabled={isLoading}
                    className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
                    title="Reiniciar conversa"
                >
                    🔄 Recomeçar
                </button>
            </div>

            {/* Messages */}
            <div className="flex flex-col gap-3 p-4 max-h-80 overflow-y-auto">
                {messages.length === 0 && !isLoading && (
                    <div className="text-center text-xs text-gray-600 py-4">Iniciando conversa...</div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                                msg.role === 'model'
                                    ? 'bg-blue-900/30 border border-blue-800/40 text-gray-200'
                                    : 'bg-gray-700 text-white'
                            }`}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                        />
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl px-4 py-3 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-700 p-3 flex gap-2 items-end bg-gray-800/30">
                <textarea
                    ref={inputRef}
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    placeholder="Digite sua resposta... (Enter para enviar, Shift+Enter para nova linha)"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:opacity-50"
                />
                <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors self-stretch flex items-center"
                >
                    Enviar →
                </button>
            </div>
        </div>
    );
}
