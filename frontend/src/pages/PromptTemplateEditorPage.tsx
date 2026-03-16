import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Variables that can be used in templates — shown as reference chips
const KNOWN_VARIABLES = [
    { key: 'MES', desc: 'Mês de referência', required: true },
    { key: 'MIX_POSTS', desc: 'Количество постов', required: true },
    { key: 'DNA_DA_MARCA', desc: 'DNA completo da marca', required: true },
    { key: 'DATAS_COMEMORATIVAS', desc: 'Datas do mês', required: true },
    { key: 'REGRAS_OBRIGATORIAS', desc: 'Regras do cliente', required: true },
    { key: 'BRIEFING', desc: 'Briefing da campanha', required: false },
    { key: 'NICHO', desc: 'Nicho do cliente', required: false },
    { key: 'ARQUETIPO', desc: 'Arquétipo da marca', required: false },
    { key: 'DIFERENCIAL_USP', desc: 'USP / diferencial', required: false },
    { key: 'TOM_DE_VOZ', desc: 'Tom de voz', required: false },
    { key: 'ANTI_PALAVRAS', desc: 'Palavras proibidas', required: false },
    { key: 'DATA_HOJE', desc: 'Data atual', required: false },
    { key: 'PRODUTOS_FOCO', desc: 'Produtos em foco', required: false },
    { key: 'INSTRUCOES_POR_FORMATO', desc: 'Instruções por formato', required: false },
];

export default function PromptTemplateEditorPage() {
    const { clientId, agentId } = useParams<{ clientId: string; agentId: string }>();
    const navigate = useNavigate();
    const { isAdmin } = useAuth();

    const [body, setBody] = useState('');
    const [label, setLabel] = useState('');
    const [originalBody, setOriginalBody] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activating, setActivating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Load active template for this agent type
    const load = useCallback(async () => {
        if (!clientId || !agentId) return;
        setLoading(true);
        setError(null);
        try {
            // Try to load client's active template for this specific agent first
            const active = await api.get(`/prompt-templates/${clientId}/active/${agentId}`).then(res => res.data.data).catch(() => null);
            if (active && active.body) {
                setBody(active.body);
                setOriginalBody(active.body);
                setLabel(active.label || '');
            } else {
                // Se não há ativo customizado para esse agent, fallback para o base daquele agente.
                // Na nossa estrutura, o base tem clienteId NULL mas agent_id setado.
                const base = await api.get(`/prompt-templates/base/${agentId}`).then(res => res.data.data).catch(() => null);
                const b = base?.body || '';
                setBody(b);
                setOriginalBody(b);
                setLabel(base?.label || `Template Global - Agente`);
            }
        } catch (e: any) {
            setError('Erro ao carregar o template deste Agente.');
        } finally {
            setLoading(false);
        }
    }, [clientId, agentId]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!isAdmin()) {
            navigate(`/client/${clientId}`);
        }
    }, [isAdmin, navigate, clientId]);

    const isDirty = body !== originalBody;
    const isCustomAgent = agentId === 'custom';

    // Highlight {{VARIABLE}} occurrences in the textarea by counting them
    const usedVars = KNOWN_VARIABLES.filter(v => body.includes(`{{${v.key}}}`));
    const missingRequired = KNOWN_VARIABLES.filter(v => v.required && !body.includes(`{{${v.key}}}`));

    const handleSaveAndActivate = async () => {
        if (!clientId || !body.trim() || !agentId) return;
        setSaving(true);
        setError(null);
        setSuccessMsg(null);
        try {
            // Create a new version passing agent_id via API
            const created = await api.post('/prompt-templates', {
                clienteId: isCustomAgent ? clientId : null,
                body: body,
                label: label || undefined,
                agentId: agentId
            }).then(res => res.data.data);

            // Activate it isolated on its agent_id
            setActivating(true);
            await api.post(`/prompt-templates/${created.id}/activate`);
            setOriginalBody(body);
            const scopeLabel = isCustomAgent ? 'no cliente' : 'globalmente';
            setSuccessMsg(`Template salvo e ativado ${scopeLabel} com sucesso!`);
            setTimeout(() => setSuccessMsg(null), 4000);
        } catch (e: any) {
            const msg = e.response?.data?.errors?.join('\n') || e.response?.data?.message || 'Erro ao salvar.';
            setError(msg);
        } finally {
            setSaving(false);
            setActivating(false);
        }
    };

    const insertVariable = (key: string) => {
        const tag = `{{${key}}}`;
        const el = document.getElementById('prompt-editor') as HTMLTextAreaElement | null;
        if (el) {
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const newBody = body.slice(0, start) + tag + body.slice(end);
            setBody(newBody);
            // Restore cursor after insertion
            setTimeout(() => {
                el.focus();
                el.setSelectionRange(start + tag.length, start + tag.length);
            }, 10);
        } else {
            setBody(b => b + tag);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="flex items-center gap-3 text-gray-400">
                    <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Carregando prompt...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col">

            {/* Header */}
            <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4 bg-gray-900">
                <button
                    onClick={() => navigate(-1)}
                    className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
                >
                    ← Voltar
                </button>
                <div className="flex-1">
                    <h1 className="text-base font-semibold text-white">✏️ Editor de Prompt</h1>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
                <div className="flex items-center gap-3">
                    {isDirty && (
                        <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2.5 py-1 rounded-full border border-yellow-400/20">
                            Não salvo
                        </span>
                    )}
                    <span className="text-xs text-gray-500 border border-gray-700/60 px-2.5 py-1 rounded-full">
                        {isCustomAgent ? 'Escopo: Cliente' : 'Escopo: Global'}
                    </span>
                    <button
                        onClick={handleSaveAndActivate}
                        disabled={saving || activating || !isDirty || missingRequired.length > 0}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                        {saving || activating ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            '💾 Salvar e Ativar'
                        )}
                    </button>
                </div>
            </header>

            {/* Feedback banners */}
            {error && (
                <div className="mx-6 mt-4 bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-3 whitespace-pre-wrap">
                    ⚠️ {error}
                </div>
            )}
            {successMsg && (
                <div className="mx-6 mt-4 bg-green-900/30 border border-green-700/50 text-green-300 text-sm rounded-lg px-4 py-3">
                    {successMsg}
                </div>
            )}

            {/* Main layout: editor + sidebar */}
            <div className="flex flex-1 overflow-hidden">

                {/* Editor area */}
                <div className="flex-1 flex flex-col p-6 overflow-auto">

                    {/* Missing required vars warning */}
                    {missingRequired.length > 0 && (
                        <div className="mb-4 bg-orange-900/20 border border-orange-600/30 rounded-lg px-4 py-2.5">
                            <p className="text-orange-400 text-xs font-medium mb-1">⚠️ Variáveis obrigatórias ausentes:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {missingRequired.map(v => (
                                    <code key={v.key} className="text-orange-300 bg-orange-900/30 text-[11px] px-1.5 py-0.5 rounded font-mono">{`{{${v.key}}}`}</code>
                                ))}
                            </div>
                        </div>
                    )}

                    <textarea
                        id="prompt-editor"
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        className="flex-1 w-full h-full min-h-[60vh] bg-gray-900 border border-gray-700 rounded-xl p-5 text-sm text-gray-100 font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-none"
                        placeholder="Escreva aqui seu prompt. Use {{VARIAVEL}} para inserir dados dinâmicos."
                        spellCheck={false}
                    />

                    <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-gray-600">{body.length} caracteres · ~{Math.ceil(body.length / 4)} tokens estimados</p>
                        <p className="text-xs text-gray-600">
                            {usedVars.length} variáveis em uso
                        </p>
                    </div>
                </div>

                {/* Sidebar: variable reference */}
                <aside className="w-72 border-l border-gray-800 bg-gray-900 p-5 overflow-y-auto flex-shrink-0">
                    <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-4">Variáveis disponíveis</h2>
                    <p className="text-[11px] text-gray-600 mb-4">Clique em uma variável para inserir no cursor.</p>
                    <div className="space-y-1.5">
                        {KNOWN_VARIABLES.map(v => {
                            const inUse = body.includes(`{{${v.key}}}`);
                            return (
                                <button
                                    key={v.key}
                                    onClick={() => insertVariable(v.key)}
                                    title={v.desc}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors group ${inUse
                                        ? 'border-blue-600/40 bg-blue-900/20 text-blue-300'
                                        : 'border-gray-700/50 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <code className="text-[11px] font-mono">{`{{${v.key}}}`}</code>
                                        <div className="flex items-center gap-1">
                                            {v.required && (
                                                <span className="text-[9px] text-red-400 font-semibold uppercase">REQ</span>
                                            )}
                                            {inUse && (
                                                <span className="text-[9px] text-blue-400">✓</span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-0.5 truncate group-hover:text-gray-400">{v.desc}</p>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-6 pt-5 border-t border-gray-800">
                        <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Contrato de saída</h3>
                        <p className="text-[10px] text-gray-600 mb-2">O prompt deve mencionar estes campos no JSON:</p>
                        <div className="flex flex-wrap gap-1">
                            {['"dia"', '"tema"', '"formato"', '"instrucoes_visuais"', '"copy_inicial"', '"objetivo"', '"cta"', '"palavras_chave"'].map(f => (
                                <code key={f} className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono border border-gray-700">{f}</code>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
