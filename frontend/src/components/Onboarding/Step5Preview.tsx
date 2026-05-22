// STORY-010 Step 5 — Preview e ajustes do DNA.
// Campos editáveis inline + indicador de completude em tempo real (AC6).
// Salva via PUT /api/branding/:clienteId.
import { useState } from 'react';
import { ArrowRight, ArrowLeft, Loader2, Save, CheckCircle } from 'lucide-react';
import { brandingService } from '../../services/api';
import { computeWizardCompleteness, type WizardState, type WizardDnaFields } from './wizardTypes';
import DnaCompletenessBar from './DnaCompletenessBar';

interface Props {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step5Preview({ state, patch, onNext, onBack }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dnaFields } = state;

  const setField = (p: Partial<WizardDnaFields>) => patch({ dnaFields: { ...dnaFields, ...p } });
  const { percentual, campos_faltando } = computeWizardCompleteness(state);

  const handleSave = async () => {
    if (!state.clientId || saving) return;
    setError(null);
    setSaving(true);
    try {
      await brandingService.saveBranding(state.clientId, {
        visual_style: dnaFields.visual_style,
        tone_of_voice: dnaFields.tone_of_voice,
        audience: dnaFields.audience,
        keywords: dnaFields.keywords,
        archetype: dnaFields.archetype || undefined,
        usp: dnaFields.usp || undefined,
        anti_keywords: dnaFields.anti_keywords,
        niche: dnaFields.niche || undefined,
      });
      setSaved(true);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Erro ao salvar o DNA. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const parseList = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Preview e Ajustes do DNA</h2>
        <p className="text-sm text-gray-400 mt-1">Revise e edite os campos antes de salvar. A completude atualiza em tempo real.</p>
      </div>

      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4">
        <DnaCompletenessBar percentual={percentual} />
        {campos_faltando.length > 0 && (
          <p className="text-xs text-gray-500 mt-2">Faltando: {campos_faltando.join(', ')}</p>
        )}
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="space-y-5">
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Nicho / Segmento</label>
          <input
            value={dnaFields.niche}
            onChange={(e) => setField({ niche: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Tom de Voz</label>
          <textarea
            value={dnaFields.tone_of_voice.description}
            onChange={(e) => setField({ tone_of_voice: { ...dnaFields.tone_of_voice, description: e.target.value } })}
            rows={2}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Público-Alvo (Persona)</label>
          <textarea
            value={dnaFields.audience.persona}
            onChange={(e) => setField({ audience: { ...dnaFields.audience, persona: e.target.value } })}
            rows={2}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Dados Demográficos</label>
          <input
            value={dnaFields.audience.demographics}
            onChange={(e) => setField({ audience: { ...dnaFields.audience, demographics: e.target.value } })}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Posicionamento / USP</label>
          <textarea
            value={dnaFields.usp}
            onChange={(e) => setField({ usp: e.target.value })}
            rows={2}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Palavras-chave (separadas por vírgula)
          </label>
          <input
            value={dnaFields.keywords.join(', ')}
            onChange={(e) => setField({ keywords: parseList(e.target.value) })}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-between items-center pt-2">
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-sm rounded-xl transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="flex gap-3 items-center">
          {saved && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> DNA salvo
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar DNA'}
          </button>
          <button
            onClick={onNext}
            disabled={!saved}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
          >
            Próximo <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
