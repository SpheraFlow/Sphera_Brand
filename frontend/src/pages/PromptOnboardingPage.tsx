import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { promptTemplateService } from '../services/api';

// â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

// â”€â”€ Componente Principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function PromptOnboardingPage() {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();

    const [clientName, setClientName] = useState('Cliente');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 1. Carregar nome do cliente e iniciar conversa
    useEffect(() => {
        async function init() {
            if (!clientId) return;
            try {
                const res = await api.get(`/clients/${clientId}`);
                setClientName(res.data.cliente?.nome || 'Cliente');
                await startConversation();
            } catch (err: any) {
                setError('Erro ao carregar cliente.');
                setIsInitializing(false);
            }
        }
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId]);

    // Rola para a Ãºltima mensagem
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Auto-resize do textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [inputMessage]);

    // â”€â”€ LÃ³gica de Chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const startConversation = async () => {
        setIsInitializing(true);
        setError(null);
        try {
            const res = await promptTemplateService.chatOnboarding(clientId!, []);

            setMessages([{ role: 'model', content: res.reply }]);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao iniciar conversa.');
        } finally {
            setIsInitializing(false);
        }
    };

    const sendMessage = async () => {
        const text = inputMessage.trim();
        if (!text || !clientId || isLoading) return;

        setInputMessage('');
        setError(null);

        const updatedMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
        setMessages(updatedMessages);
        setIsLoading(true);

        try {
            const res = await promptTemplateService.chatOnboarding(clientId, updatedMessages, text);

            const novaMsg: ChatMessage = { role: 'model', content: res.reply };
            setMessages((prev) => [...prev, novaMsg]);

            // Se a IA concluiu a extraÃ§Ã£o (enviou [PROMPT_TEMPLATE_EXTRACTED] + JSON)
            if (res.isComplete && res.extractedData?.body) {
                await savePromptTemplate(res.extractedData.body, res.extractedData.label);
            }
        } catch (err: any) {
            console.error(err);
            setError('Erro ao enviar mensagem. Tente novamente.');
            // Remove a Ãºltima msg do user para ele tentar de novo
            setMessages((prev) => prev.slice(0, -1));
            setInputMessage(text);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const savePromptTemplate = async (body: string, label?: string) => {
        try {
            // Cria a nova versÃ£o
            const created = await promptTemplateService.createVersion(clientId!, body, label || 'Gerado via Onboarding (IA)');
            // Tenta ativar automaticamente
            try {
                await promptTemplateService.activate(created.id);
            } catch {
                // Se a ativaÃ§Ã£o falhar (guardrails), o usuÃ¡rio verÃ¡ o template na pÃ¡gina e pode ativar manualmente
            }
            navigate(`/client/${clientId}/prompt-template`);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao salvar o prompt final.');
        }
    };

    // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-[#06080e] flex items-center justify-center">
                <div className="flex items-center gap-3 text-slate-500">
                    <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-mono tracking-wide">Iniciando conexao com Especialista Editorial...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#06080e] flex flex-col font-sans">
            {/* Header */}
            <header className="border-b border-slate-800/60 bg-[#07090f] px-8 py-5 flex items-center justify-between z-10 sticky top-0">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className="w-1.5 h-5 rounded-full bg-indigo-500 block shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        <h1 className="text-base font-semibold tracking-tight text-white">Criador de Calendario</h1>
                        <span className="text-slate-600 text-base">/</span>
                        <span className="text-sm text-slate-400 font-mono tracking-wide">{clientName}</span>
                    </div>
                    <p className="text-xs text-slate-500 pl-4 max-w-2xl mt-1 leading-relaxed">
                        Responda as perguntas da <strong>ARIA</strong> (nossa Especialista Editorial) para que ela crie o
                        Prompt perfeito para geracao de calendarios automaticos desta marca.
                    </p>
                </div>
                <button
                    onClick={() => navigate(`/client/${clientId}/prompt-template`)}
                    className="text-xs font-mono text-slate-400 hover:text-white transition-colors flex items-center gap-2 border border-slate-700/50 hover:border-slate-500 bg-slate-800/20 px-4 py-2 rounded-lg"
                >
                    Cancelar Onboarding
                </button>
            </header>

            {error && (
                <div className="mx-8 mt-4 bg-red-950/30 border border-red-800/40 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-3">
                    <span className="text-lg">Aviso</span> {error}
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar relative">
                <div className="max-w-3xl mx-auto space-y-6">

                    {messages.map((msg, idx) => {
                        const isModel = msg.role === 'model';
                        return (
                            <div key={idx} className={`flex ${isModel ? 'justify-start' : 'justify-end'}`}>
                                {isModel && (
                                    <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mr-3 flex-shrink-0 mt-1 shadow-sm">
                                        <span className="text-indigo-400 text-xs font-bold font-mono">AR</span>
                                    </div>
                                )}

                                <div
                                    className={`relative max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${isModel
                                        ? 'bg-[#101423] text-slate-200 border border-indigo-900/40 rounded-tl-sm shadow-md'
                                        : 'bg-indigo-600 text-white rounded-tr-sm shadow-lg'
                                        }`}
                                >
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        );
                    })}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mr-3 flex-shrink-0 mt-1 shadow-sm">
                                <span className="text-indigo-400 text-xs font-bold font-mono">AR</span>
                            </div>
                            <div className="bg-[#101423] border border-indigo-900/40 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2 shadow-md">
                                <span className="w-2 h-2 rounded-full bg-indigo-400/50 animate-bounce" />
                                <span className="w-2 h-2 rounded-full bg-indigo-400/50 animate-bounce" style={{ animationDelay: '0.2s' }} />
                                <span className="w-2 h-2 rounded-full bg-indigo-400/50 animate-bounce" style={{ animationDelay: '0.4s' }} />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-800/60 bg-[#07090f] p-4">
                <div className="max-w-3xl mx-auto relative group">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Digite sua resposta... (Shift+Enter para quebrar linha)"
                        className="w-full bg-[#0d101a] border border-slate-700/60 rounded-xl pl-5 pr-14 py-3.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 resize-none transition-all custom-scrollbar shadow-inner"
                        disabled={isLoading}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!inputMessage.trim() || isLoading}
                        className="absolute right-2 bottom-2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white rounded-lg transition-colors shadow-md"
                        title="Enviar mensagem"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-4 h-4"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                    </button>
                </div>
                <p className="text-center mt-3 text-[10px] text-slate-600 font-mono tracking-wide">
                    A IA pode cometer erros. Revise o Prompt gerado antes de ativa-lo como oficial.
                </p>
            </div>

        </div>
    );
}

