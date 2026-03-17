import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { briefingAgentService, BriefingChatMessage } from '../services/api';

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
}

function renderMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>');
}

export default function BriefingAgentChat({ clientId, campaignContext, onBriefingReady }: Props) {
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
