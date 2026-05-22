// STORY-010 Step 1 — Dados básicos. Cria o cliente no banco via POST /api/clients.
import { useState } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { clientService } from '../../services/api';
import { SEGMENT_OPTIONS, type WizardState } from './wizardTypes';

interface Props {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  onNext: () => void;
}

export default function Step1BasicData({ state, patch, onNext }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { basicData } = state;

  const setBasic = (k: keyof WizardState['basicData'], v: string) =>
    patch({ basicData: { ...basicData, [k]: v } });

  const canSubmit = basicData.nome.trim().length > 0 && basicData.segmento.trim().length > 0;

  const handleNext = async () => {
    if (!canSubmit || saving) return;
    setError(null);
    setSaving(true);
    try {
      // O segmento é persistido como a primeira categoria de nicho do cliente.
      const categorias = basicData.segmento ? [basicData.segmento] : [];
      const cliente = await clientService.createClientFull({
        nome: basicData.nome.trim(),
        categorias_nicho: categorias,
      });
      if (!cliente?.id) throw new Error('Resposta inválida ao criar cliente.');
      patch({ clientId: cliente.id });
      onNext();
    } catch (e: any) {
      // AC2 — em caso de falha, exibe erro e permanece na Step 1 sem perder dados.
      setError(e?.response?.data?.error || e?.message || 'Não foi possível criar o cliente. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Dados Básicos</h2>
        <p className="text-sm text-gray-400 mt-1">Vamos começar com as informações essenciais do cliente.</p>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Nome do Cliente <span className="text-red-400">*</span>
          </label>
          <input
            value={basicData.nome}
            onChange={(e) => setBasic('nome', e.target.value)}
            placeholder="Ex: Sphera Flow"
            autoFocus
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Segmento / Nicho <span className="text-red-400">*</span>
          </label>
          <select
            value={basicData.segmento}
            onChange={(e) => setBasic('segmento', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Selecione...</option>
            {SEGMENT_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Website</label>
          <input
            value={basicData.website}
            onChange={(e) => setBasic('website', e.target.value)}
            placeholder="https://..."
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Cidade</label>
          <input
            value={basicData.cidade}
            onChange={(e) => setBasic('cidade', e.target.value)}
            placeholder="Ex: São Paulo"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Descrição Curta</label>
          <textarea
            value={basicData.descricao}
            onChange={(e) => setBasic('descricao', e.target.value)}
            rows={2}
            placeholder="O que esta marca faz em uma ou duas frases."
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleNext}
          disabled={!canSubmit || saving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          {saving ? 'Criando cliente...' : 'Próximo'}
        </button>
      </div>
    </div>
  );
}
