import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { presentationChatAgentService, PresentationChatMessage } from '../services/api';

interface Props {
    clientId: string;
    months: string[];
    onContentReady: (content: any) => void;
    onClose: () => void;
}

function renderMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>');
}

function ContentPreview({ content }: { content: any }) {
    const diagnostico = String(content?.diagnostico?.texto_longo || '');
    const desafios: string[] = Array.isArray(content?.desafios?.itens)
        ? content.desafios.itens.filter(Boolean).slice(0, 3)
        : [];
    const slogan = String(content?.slogan?.frase || '');
    const defesa = String(content?.defesa?.texto_longo || '');
    const cards: any[] = Array.isArray(content?.roadmap?.cards) ? content.roadmap.cards : [];

    return (
        <div className="space-y-3 text-sm">
            {diagnostico && (
                <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Diagnóstico</span>
                    <p className="text-gray-300 mt-0.5 line-clamp-2">{diagnostico.slice(0, 120)}…</p>
                </div>
            )}
            {desafios.length > 0 && (
                <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Desafios</span>
                    <p className="text-gray-300 mt-0.5">{desafios.join(' · ')}</p>
                </div>
            )}
            {slogan && (
                <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Slogan</span>
                    <p className="text-purple-300 font-semibold mt-0.5">"{slogan}"</p>
                </div>
            )}
            {defesa && (
                <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Defesa</span>
                    <p className="text-gray-300 mt-0.5 line-clamp-2">{defesa.slice(0, 120)}…</p>
                </div>
            )}
            {cards.length > 0 && (
                <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Roadmap</span>
                    <p className="text-gray-300 mt-0.5">{cards.map((c: any) => c.titulo || c.mes).filter(Boolean).join(' · ')}</p>
                </div>
            )}
        </div>
    );
}

export default function PresentationChatAgent({ clientId, months, onContentReady, onClose }: Props) {
    const [messages, setMessages] = useState<PresentationChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [finalContent, setFinalContent] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

    useEffect(() => { initChat(); }, []);

    const initChat = async () => {
        setMessages([]);
        setInput('');
        setDone(false);
        setFinalContent(null);
        setError(null);
        setIsLoading(true);
        try {
            const result = await presentationChatAgentService.chat(clientId, [], months);
            setMessages([{ role: 'model', content: result.reply }]);
            if (result.done && result.content) {
                setFinalContent(result.content);
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

        const userMsg: PresentationChatMessage = { role: 'user', content: trimmed };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const result = await presentationChatAgentService.chat(clientId, updatedMessages, months);
            const withReply = [...updatedMessages, { role: 'model' as const, content: result.reply }];
            setMessages(withReply);
            if (result.done && result.content) {
                setFinalContent(result.content);
                setDone(true);
            }
        } catch {
            setError('Erro ao se comunicar com o agente. Tente novamente.');
            setMessages(updatedMessages);
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

    return (
        <div className="flex flex-col h-full max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 bg-gray-800/60 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-xl">💬</span>
                    <div>
                        <div className="text-sm font-bold text-gray-100">Guiar Lâminas com Chat</div>
                        <div className="text-[11px] text-gray-500">
                            {done ? 'Conteúdo gerado — revise antes de aplicar' : 'Responda as perguntas para personalizar a apresentação'}
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-300 transition-colors p-1"
                    title="Fechar"
                >
                    ✕
                </button>
            </div>

            {done && finalContent ? (
                /* Tela de resultado */
                <div className="flex flex-col gap-5 p-5 overflow-y-auto flex-1">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                        <span className="text-sm font-semibold text-green-400">Conteúdo das Lâminas Pronto</span>
                    </div>

                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                        <ContentPreview content={finalContent} />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => onContentReady(finalContent)}
                            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                        >
                            ✅ Aplicar às Lâminas
                        </button>
                        <button
                            onClick={initChat}
                            className="px-5 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 rounded-xl transition-colors text-sm"
                        >
                            🔄 Refazer
                        </button>
                    </div>
                </div>
            ) : (
                /* Tela de chat */
                <>
                    <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1">
                        {messages.length === 0 && !isLoading && (
                            <div className="text-center text-xs text-gray-600 py-6">Iniciando conversa…</div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                                        msg.role === 'model'
                                            ? 'bg-indigo-900/30 border border-indigo-800/40 text-gray-200'
                                            : 'bg-gray-700 text-white'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                />
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-xl px-4 py-3 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
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

                    <div className="border-t border-gray-700 p-3 flex gap-2 items-end bg-gray-800/30 shrink-0">
                        <textarea
                            ref={inputRef}
                            rows={2}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            placeholder="Digite sua resposta… (Enter para enviar, Shift+Enter para nova linha)"
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-50"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors self-stretch flex items-center"
                        >
                            Enviar →
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
