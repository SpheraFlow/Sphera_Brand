// STORY-010 — Orquestrador do wizard de onboarding de novo cliente.
// Rota: /clients/new (estado em memória; recarregar volta ao início).
// Suporta deep-link ?clientId=...&step=N (ex: "Completar DNA" vindo do ClientHub).
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import StepIndicator from '../components/Onboarding/StepIndicator';
import Step1BasicData from '../components/Onboarding/Step1BasicData';
import Step2BrandDNA from '../components/Onboarding/Step2BrandDNA';
import Step3Upload from '../components/Onboarding/Step3Upload';
import Step4AIFill from '../components/Onboarding/Step4AIFill';
import Step5Preview from '../components/Onboarding/Step5Preview';
import Step6GenerateCalendar from '../components/Onboarding/Step6GenerateCalendar';
import {
  createInitialWizardState,
  type WizardState,
  type WizardStep,
} from '../components/Onboarding/wizardTypes';
import type { OnboardingExtractedBranding } from '../services/api';

export default function ClientOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Deep-link: se vier clientId/step na URL, inicia o wizard nesse ponto.
  const initial = useMemo(() => {
    const base = createInitialWizardState();
    const qpClientId = searchParams.get('clientId');
    const qpStep = parseInt(searchParams.get('step') || '', 10);
    if (qpClientId) base.clientId = qpClientId;
    if (!isNaN(qpStep) && qpStep >= 1 && qpStep <= 6) base.step = qpStep as WizardStep;
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = useState<WizardState>(initial);
  const [preExtracted, setPreExtracted] = useState<OnboardingExtractedBranding | null>(null);

  const patch = (p: Partial<WizardState>) => setState((prev) => ({ ...prev, ...p }));
  const next = () => setState((prev) => ({ ...prev, step: Math.min(6, prev.step + 1) as WizardStep }));
  const back = () => setState((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) as WizardStep }));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800/60 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Onboarding de Novo Cliente</h1>
            <p className="text-xs text-gray-400">Do cadastro ao primeiro calendário em poucos minutos.</p>
          </div>
          <button
            onClick={() => navigate('/clients')}
            className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors"
            title="Sair do onboarding"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <StepIndicator current={state.step} />

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 md:p-8">
          {state.step === 1 && <Step1BasicData state={state} patch={patch} onNext={next} />}
          {state.step === 2 && <Step2BrandDNA state={state} patch={patch} onNext={next} onBack={back} />}
          {state.step === 3 && (
            <Step3Upload
              state={state}
              patch={patch}
              onNext={next}
              onBack={back}
              onExtracted={(data) => setPreExtracted(data)}
            />
          )}
          {state.step === 4 && (
            <Step4AIFill state={state} patch={patch} onNext={next} preExtracted={preExtracted} />
          )}
          {state.step === 5 && <Step5Preview state={state} patch={patch} onNext={next} onBack={back} />}
          {state.step === 6 && <Step6GenerateCalendar state={state} onBack={back} />}
        </div>
      </div>
    </div>
  );
}
