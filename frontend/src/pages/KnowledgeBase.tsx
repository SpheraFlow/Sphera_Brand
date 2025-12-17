import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

interface Prompt {
  id: string;
  titulo: string;
  conteudo_prompt: string;
  categoria: string;
  criado_em: string;
}

interface BrandRule {
  id: string;
  regra: string;
  categoria: string;
  origem: string;
  ativa: boolean;
  criado_em: string;
}

interface PromptChainStep {
  order: number;
  name: string;
  prompt_template: string;
  expected_output?: string;
}

interface PromptChain {
  id: string;
  name: string;
  description?: string;
  client_id?: string | null;
  is_global: boolean;
  steps: PromptChainStep[];
  created_at: string;
}

export default function KnowledgeBase() {
  const { clientId } = useParams<{ clientId: string }>();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [rules, setRules] = useState<BrandRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [chains, setChains] = useState<PromptChain[]>([]);

  // Estados para novos prompts
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [newPromptTitulo, setNewPromptTitulo] = useState('');
  const [newPromptConteudo, setNewPromptConteudo] = useState('');
  const [newPromptCategoria, setNewPromptCategoria] = useState('Geral');

  // Estados para novas regras
  const [newRule, setNewRule] = useState('');
  const [newRuleCategoria, setNewRuleCategoria] = useState('Geral');

  // Estados para Prompt Chains
  const [showChainForm, setShowChainForm] = useState(false);
  const [newChainName, setNewChainName] = useState('');
  const [newChainDescription, setNewChainDescription] = useState('');
  const [newChainIsGlobal, setNewChainIsGlobal] = useState(false);
  const [newChainClientId, setNewChainClientId] = useState<string | null>(clientId || null);
  const [newChainSteps, setNewChainSteps] = useState<PromptChainStep[]>([]);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadPrompts(), loadRules(), loadChains()]);
    } finally {
      setLoading(false);
    }
  };

  const loadChains = async () => {
    if (!clientId) return;
    try {
      const response = await axios.get(`http://localhost:3001/api/prompt-chains/${clientId}`);
      setChains(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar prompt chains:', error);
    }
  };

  const loadPrompts = async () => {
    try {
      const response = await axios.get(`http://localhost:3001/api/knowledge/prompts/${clientId}`);
      setPrompts(response.data.prompts || []);
    } catch (error) {
      console.error('Erro ao carregar prompts:', error);
    }
  };

  const loadRules = async () => {
    try {
      const response = await axios.get(`http://localhost:3001/api/knowledge/rules/${clientId}`);
      setRules(response.data.rules || []);
    } catch (error) {
      console.error('Erro ao carregar regras:', error);
    }
  };

  const handleCreatePrompt = async () => {
    if (!newPromptTitulo.trim() || !newPromptConteudo.trim()) {
      showMessage('Preencha título e conteúdo do prompt', 'error');
      return;
    }

    try {
      await axios.post('http://localhost:3001/api/knowledge/prompts', {
        clienteId: clientId,
        titulo: newPromptTitulo,
        conteudo: newPromptConteudo,
        categoria: newPromptCategoria,
      });

      showMessage('Prompt criado com sucesso!', 'success');
      setNewPromptTitulo('');
      setNewPromptConteudo('');
      setNewPromptCategoria('Geral');
      setShowPromptForm(false);
      loadPrompts();
    } catch (error) {
      console.error('Erro ao criar prompt:', error);
      showMessage('Erro ao criar prompt', 'error');
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!confirm('Deseja realmente excluir este prompt?')) return;

    try {
      await axios.delete(`http://localhost:3001/api/knowledge/prompts/${promptId}`);
      showMessage('Prompt excluído com sucesso!', 'success');
      loadPrompts();
    } catch (error) {
      console.error('Erro ao excluir prompt:', error);
      showMessage('Erro ao excluir prompt', 'error');
    }
  };

  const handleAddRule = async () => {
    if (!newRule.trim()) {
      showMessage('Digite uma regra', 'error');
      return;
    }

    try {
      console.log('Adicionando regra:', { clientId, regra: newRule, categoria: newRuleCategoria });
      await axios.post('http://localhost:3001/api/knowledge/rules', {
        clienteId: clientId,
        regra: newRule,
        categoria: newRuleCategoria,
        origem: 'manual',
      });

      showMessage('Regra adicionada com sucesso!', 'success');
      setNewRule('');
      setNewRuleCategoria('Geral');
      loadRules();
    } catch (error) {
      console.error('Erro ao adicionar regra:', error);
      showMessage('Erro ao adicionar regra', 'error');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Deseja realmente excluir esta regra?')) return;

    try {
      await axios.delete(`http://localhost:3001/api/knowledge/rules/${ruleId}`);
      showMessage('Regra excluída com sucesso!', 'success');
      loadRules();
    } catch (error) {
      console.error('Erro ao excluir regra:', error);
      showMessage('Erro ao excluir regra', 'error');
    }
  };

  const addStep = () => {
    setNewChainSteps((prev) => {
      const nextOrder = prev.length + 1;
      return [
        ...prev,
        {
          order: nextOrder,
          name: `Step ${nextOrder}`,
          prompt_template: '',
          expected_output: '',
        },
      ];
    });
  };

  const removeStep = (index: number) => {
    setNewChainSteps((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const moveStepUp = (index: number) => {
    if (index === 0) return;
    setNewChainSteps((prev) => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const moveStepDown = (index: number) => {
    setNewChainSteps((prev) => {
      if (index === prev.length - 1) return prev;
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const updateStep = (
    index: number,
    field: 'name' | 'prompt_template' | 'expected_output',
    value: string
  ) => {
    setNewChainSteps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCreateChain = async () => {
    if (newChainName.trim().length < 3) {
      showMessage('Nome da Prompt Chain deve ter pelo menos 3 caracteres', 'error');
      return;
    }

    if (newChainSteps.length === 0) {
      showMessage('Defina pelo menos 1 step na Prompt Chain', 'error');
      return;
    }

    const hasInvalidStep = newChainSteps.some(
      (s) => !s.name.trim() || !s.prompt_template.trim()
    );
    if (hasInvalidStep) {
      showMessage('Cada step precisa ter Nome e Template do Prompt preenchidos', 'error');
      return;
    }

    if (!newChainIsGlobal && !newChainClientId) {
      showMessage('Selecione um cliente para a Prompt Chain (ou marque como Global)', 'error');
      return;
    }

    const payloadSteps = newChainSteps.map((s, index) => ({
      order: index + 1,
      name: s.name.trim(),
      prompt_template: s.prompt_template.trim(),
      expected_output: s.expected_output?.trim() || '',
    }));

    try {
      await axios.post('http://localhost:3001/api/prompt-chains', {
        name: newChainName.trim(),
        description: newChainDescription.trim() || null,
        client_id: newChainIsGlobal ? null : newChainClientId,
        is_global: newChainIsGlobal,
        steps: payloadSteps,
      });

      showMessage('Prompt Chain criada com sucesso!', 'success');
      setNewChainName('');
      setNewChainDescription('');
      setNewChainIsGlobal(false);
      setNewChainClientId(clientId || null);
      setNewChainSteps([]);
      setShowChainForm(false);
      loadChains();
    } catch (error) {
      console.error('Erro ao criar Prompt Chain:', error);
      showMessage('Erro ao criar Prompt Chain', 'error');
    }
  };

  const handleDeleteChain = async (chainId: string) => {
    if (!confirm('Deseja realmente excluir esta Prompt Chain?')) return;

    try {
      await axios.delete(`http://localhost:3001/api/prompt-chains/${chainId}`);
      showMessage('Prompt Chain excluída com sucesso!', 'success');
      loadChains();
    } catch (error) {
      console.error('Erro ao excluir Prompt Chain:', error);
      showMessage('Erro ao excluir Prompt Chain', 'error');
    }
  };

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🧠 Inteligência & Prompts</h1>
          <p className="text-gray-400">
            Gerencie prompts e regras da marca para personalizar a IA
          </p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna A: Biblioteca de Prompts */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">📚 Biblioteca de Prompts</h2>
              <button
                onClick={() => setShowPromptForm(!showPromptForm)}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {showPromptForm ? 'Cancelar' : '+ Novo Prompt'}
              </button>
            </div>

            {/* Formulário de Novo Prompt */}
            {showPromptForm && (
              <div className="mb-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
                <input
                  type="text"
                  placeholder="Título do prompt"
                  value={newPromptTitulo}
                  onChange={(e) => setNewPromptTitulo(e.target.value)}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Categoria"
                  value={newPromptCategoria}
                  onChange={(e) => setNewPromptCategoria(e.target.value)}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-blue-500"
                />
                <textarea
                  placeholder="Conteúdo do prompt"
                  value={newPromptConteudo}
                  onChange={(e) => setNewPromptConteudo(e.target.value)}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 mb-3 h-24 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleCreatePrompt}
                  className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-lg font-medium transition-colors"
                >
                  Salvar Prompt
                </button>
              </div>
            )}

            {/* Lista de Prompts */}
            <div className="space-y-3">
              {prompts.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Nenhum prompt cadastrado ainda
                </div>
              ) : (
                prompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="bg-gray-700 border border-gray-600 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold">{prompt.titulo}</h3>
                        <span className="inline-block mt-1 px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                          {prompt.categoria}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeletePrompt(prompt.id)}
                        className="text-red-400 hover:text-red-300 ml-2"
                      >
                        🗑️
                      </button>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      {prompt.conteudo_prompt}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Coluna B: Regras da Marca */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">⚡ Regras da Marca</h2>

            {/* Formulário Rápido para Nova Regra */}
            <div className="mb-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
              <input
                type="text"
                placeholder="Categoria"
                value={newRuleCategoria}
                onChange={(e) => setNewRuleCategoria(e.target.value)}
                className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-blue-500"
              />
              <textarea
                placeholder="Digite a regra da marca..."
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 mb-3 h-20 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddRule}
                className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-lg font-medium transition-colors"
              >
                + Adicionar Regra
              </button>
            </div>

            {/* Lista de Regras */}
            <div className="space-y-3">
              {rules.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Nenhuma regra cadastrada ainda
                </div>
              ) : (
                rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="bg-gray-700 border border-gray-600 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm">{rule.regra}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                            {rule.categoria}
                          </span>
                          <span className="px-2 py-1 bg-gray-600 text-gray-400 text-xs rounded-full">
                            {rule.origem}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-red-400 hover:text-red-300 ml-2"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Coluna C: Chains de Prompts */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">⛓️ Chains de Prompts</h2>
              <button
                onClick={() => setShowChainForm(!showChainForm)}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {showChainForm ? 'Cancelar' : '+ Nova Chain'}
              </button>
            </div>

            {showChainForm && (
              <div className="mb-6 p-4 bg-gray-700 rounded-lg border border-gray-600 space-y-4 text-sm">
                <input
                  type="text"
                  placeholder="Nome da Chain"
                  value={newChainName}
                  onChange={(e) => setNewChainName(e.target.value)}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
                <textarea
                  placeholder="Descrição (opcional)"
                  value={newChainDescription}
                  onChange={(e) => setNewChainDescription(e.target.value)}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 h-16 focus:outline-none focus:border-blue-500"
                />

                <div className="flex items-center justify-between gap-4 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newChainIsGlobal}
                      onChange={(e) => setNewChainIsGlobal(e.target.checked)}
                    />
                    <span>Chain Global (todos clientes)</span>
                  </label>

                  {!newChainIsGlobal && (
                    <div className="flex-1 text-right">
                      <label className="block mb-1">Cliente</label>
                      <input
                        type="text"
                        value={newChainClientId || ''}
                        onChange={(e) => setNewChainClientId(e.target.value || null)}
                        className="w-full bg-gray-600 border border-gray-500 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                        placeholder="ID do cliente"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Steps da Chain</h3>
                    <button
                      type="button"
                      onClick={addStep}
                      className="text-xs bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded-md font-medium"
                    >
                      + Adicionar Step
                    </button>
                  </div>

                  {newChainSteps.length === 0 && (
                    <div className="text-xs text-gray-300 bg-gray-800/60 border border-dashed border-gray-600 rounded-lg p-3">
                      Nenhum step adicionado ainda. Clique em "Adicionar Step" para começar.
                    </div>
                  )}

                  {newChainSteps.map((step, index) => (
                    <div
                      key={index}
                      className="bg-gray-800 border border-gray-600 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-200">
                          Step {index + 1}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => moveStepUp(index)}
                            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
                          >
                            ⬆️
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStepDown(index)}
                            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
                          >
                            ⬇️
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="px-2 py-1 rounded bg-red-600 hover:bg-red-500"
                          >
                            Remover
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Nome do Step"
                        value={step.name}
                        onChange={(e) => updateStep(index, 'name', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
                      />

                      <div>
                        <label className="block text-[11px] text-gray-300 mb-1">
                          Template do Prompt
                        </label>
                        <p className="text-[10px] text-gray-400 mb-1">
                          Variáveis disponíveis: <code>{'{{branding}}'}</code>{' '}
                          <code>{'{{briefing}}'}</code>{' '}
                          <code>{'{{step_1_output}}'}</code>{' '}
                          <code>{'{{step_2_output}}'}</code> ...
                        </p>
                        <textarea
                          placeholder="Escreva aqui o template do prompt para este step"
                          value={step.prompt_template}
                          onChange={(e) => updateStep(index, 'prompt_template', e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-xs h-24 font-mono focus:outline-none focus:border-blue-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-300 mb-1">
                          Output Esperado (opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex.: Lista de conceitos principais para o calendário..."
                          value={step.expected_output || ''}
                          onChange={(e) => updateStep(index, 'expected_output', e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleCreateChain}
                  className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-lg font-medium transition-colors mt-2"
                >
                  Salvar Chain
                </button>
              </div>
            )}

            <div className="space-y-3">
              {chains.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Nenhuma Prompt Chain cadastrada ainda
                </div>
              ) : (
                chains.map((chain) => (
                  <div
                    key={chain.id}
                    className="bg-gray-700 border border-gray-600 rounded-lg p-4 text-sm"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <h3 className="font-semibold flex items-center gap-2">
                          {chain.name}
                          <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-500/20 text-purple-300">
                            {chain.is_global ? 'Global' : 'Cliente'}
                          </span>
                        </h3>
                        {chain.description && (
                          <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                            {chain.description}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-500 mt-1">
                          {chain.steps?.length || 0} steps configurados
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteChain(chain.id)}
                        className="text-red-400 hover:text-red-300 ml-2"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

