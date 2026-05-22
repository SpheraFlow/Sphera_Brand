// STORY-010 Step 6 — Gerar o primeiro calendário.
// Usa o fluxo existente (POST /api/generate-calendar → job) + JobProgressModal,
// e redireciona para o calendário do cliente ao concluir (AC7).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CalendarPlus } from 'lucide-react';
import { calendarService } from '../../services/api';
import JobProgressModal from '../Jobs/JobProgressModal';
import type { WizardState } from './wizardTypes';

interface Props {
  state: WizardState;
  onBack: () => void;
}

// Mix padrão do primeiro calendário (mensal, mix moderado dentro do limite de 25/mês).
const DEFAULT_MIX = { reels: 4, static: 8, carousel: 4, stories: 4, photos: 0 };

export default function Step6GenerateCalendar({ state, onBack }: Props) {
  const navigate = useNavigate();
  const [jobId, setJobId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!state.clientId || starting) return;
    setError(null);
    setStarting(true);
    try {
      const briefing = [
        state.dnaAnswers.objetivos_conteudo && `Objetivo: ${state.dnaAnswers.objetivos_conteudo}`,
        state.dnaFields.usp && `Posicionamento: ${state.dnaFields.usp}`,
        state.dnaFields.audience.persona && `Público: ${state.dnaFields.audience.persona}`,
      ]
        .filter(Boolean)
        .join('. ');

      const res = await calendarService.generateCalendar(
        state.clientId,
        30, // mensal
        briefing || 'Primeiro calendário editorial alinhado ao DNA da marca.',
        undefined, // mês: undefined → o backend usa o próximo mês por padrão
        DEFAULT_MIX,
      );
      if (!res?.jobId) throw new Error('Não foi possível iniciar a geração.');
      setJobId(res.jobId);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Erro ao iniciar a geração do calendário.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Gerar Primeiro Calendário</h2>
        <p className="text-sm text-gray-400 mt-1">
          Tudo pronto! Vamos gerar o calendário editorial do próximo mês com base no DNA da marca.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-6 text-center space-y-3">
        <CalendarPlus className="w-12 h-12 text-blue-400 mx-auto" />
        <p className="text-sm text-gray-300">
          Mix padrão: {DEFAULT_MIX.reels} Reels · {DEFAULT_MIX.static} Artes · {DEFAULT_MIX.carousel} Carrosséis ·{' '}
          {DEFAULT_MIX.stories} Stories
        </p>
        <button
          onClick={handleGenerate}
          disabled={starting}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold rounded-xl transition-colors inline-flex items-center gap-2"
        >
          {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarPlus className="w-5 h-5" />}
          {starting ? 'Iniciando...' : 'Gerar Calendário Agora'}
        </button>
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-sm rounded-xl transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button
          onClick={() => navigate(`/client/${state.clientId}`)}
          className="px-5 py-2.5 text-gray-400 hover:text-gray-200 text-sm rounded-xl transition-colors"
        >
          Fazer isso depois
        </button>
      </div>

      {jobId && state.clientId && (
        <JobProgressModal
          clientId={state.clientId}
          jobId={jobId}
          isOpen={!!jobId}
          onClose={() => navigate(`/client/${state.clientId}/calendar`)}
          onSuccess={() => navigate(`/client/${state.clientId}/calendar`)}
        />
      )}
    </div>
  );
}
