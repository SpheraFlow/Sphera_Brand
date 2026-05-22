// STORY-010 Step 4 — IA pré-preenche o DNA.
// Reutiliza o agente ARIA (POST /api/onboarding/chat/:clientId), que retorna um
// DNA estruturado a partir das respostas. Timeout de 30s com fallback para as
// respostas brutas da Step 2 (AC5).
import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import { onboardingAriaService, type OnboardingExtractedBranding } from '../../services/api';
import { createEmptyDnaFields, type WizardState, type WizardDnaFields } from './wizardTypes';

interface Props {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  onNext: () => void;
  // DNA já extraído na Step 3 (upload), se houver.
  preExtracted: OnboardingExtractedBranding | null;
}

const AI_TIMEOUT_MS = 30_000;

// Mapeia o DNA retornado pela IA (formato ARIA/upload) para os campos do wizard.
function mapExtractedToFields(data: OnboardingExtractedBranding, state: WizardState): WizardDnaFields {
  const base = createEmptyDnaFields();
  return {
    visual_style: {
      colors: data.visual_style?.colors ?? base.visual_style.colors,
      fonts: data.visual_style?.fonts ?? base.visual_style.fonts,
      archeType: data.visual_style?.archeType ?? base.visual_style.archeType,
    },
    tone_of_voice: {
      description: data.tone_of_voice?.description || state.dnaAnswers.tom_de_voz || '',
      keywords: data.tone_of_voice?.keywords ?? base.tone_of_voice.keywords,
    },
    audience: {
      persona: data.audience?.persona || state.dnaAnswers.publico_alvo || '',
      demographics: data.audience?.demographics ?? '',
    },
    keywords: data.keywords ?? base.keywords,
    archetype: data.archetype ?? '',
    usp: data.usp || state.dnaAnswers.posicionamento || '',
    anti_keywords: data.anti_keywords ?? base.anti_keywords,
    niche: data.niche || state.basicData.segmento || '',
  };
}

// Fallback: usa as respostas cruas da Step 2 como DNA inicial.
function fallbackFields(state: WizardState): WizardDnaFields {
  const fields = createEmptyDnaFields();
  fields.tone_of_voice.description = state.dnaAnswers.tom_de_voz;
  fields.audience.persona = state.dnaAnswers.publico_alvo;
  fields.usp = state.dnaAnswers.posicionamento;
  fields.niche = state.basicData.segmento;
  if (state.dnaAnswers.valores) {
    fields.keywords = state.dnaAnswers.valores.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return fields;
}

// Resume as respostas da Step 2 numa mensagem única para a IA estruturar.
function buildUserMessage(state: WizardState): string {
  const a = state.dnaAnswers;
  return [
    `Marca: ${state.basicData.nome}`,
    state.basicData.segmento && `Segmento: ${state.basicData.segmento}`,
    state.basicData.descricao && `Descrição: ${state.basicData.descricao}`,
    a.tom_de_voz && `Tom de voz: ${a.tom_de_voz}`,
    a.publico_alvo && `Público-alvo: ${a.publico_alvo}`,
    a.posicionamento && `Posicionamento/diferencial: ${a.posicionamento}`,
    a.valores && `Valores: ${a.valores}`,
    a.objetivos_conteudo && `Objetivos de conteúdo: ${a.objetivos_conteudo}`,
    '\nCom base nessas informações, extraia agora o DNA completo da marca no formato estruturado.',
  ]
    .filter(Boolean)
    .join('\n');
}

type Phase = 'running' | 'fallback' | 'done';

export default function Step4AIFill({ state, patch, onNext, preExtracted }: Props) {
  const [phase, setPhase] = useState<Phase>('running');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Se a Step 3 já extraiu o DNA via upload, reusa direto (sem nova chamada).
    if (preExtracted) {
      patch({ dnaFields: mapExtractedToFields(preExtracted, state) });
      setPhase('done');
      setTimeout(onNext, 600);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    (async () => {
      try {
        const res = await onboardingAriaService.chat(
          state.clientId as string,
          [],
          buildUserMessage(state),
          controller.signal,
        );
        clearTimeout(timer);
        if (res.isComplete && res.extractedData) {
          patch({ dnaFields: mapExtractedToFields(res.extractedData, state) });
        } else {
          // A IA respondeu mas não estruturou — usa fallback com as respostas.
          patch({ dnaFields: fallbackFields(state) });
        }
        setPhase('done');
        setTimeout(onNext, 600);
      } catch {
        // Timeout (abort) ou erro: fallback com respostas brutas (AC5).
        clearTimeout(timer);
        patch({ dnaFields: fallbackFields(state) });
        setPhase('fallback');
      }
    })();

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'fallback') {
    return (
      <div className="space-y-6 text-center py-8">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto" />
        <div>
          <h2 className="text-xl font-bold text-white">Não foi possível pré-preencher automaticamente</h2>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
            Preencha manualmente os campos do DNA na próxima etapa — já adiantamos com as suas respostas.
          </p>
        </div>
        <button
          onClick={onNext}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-colors inline-flex items-center gap-2"
        >
          Continuar para revisão <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center py-12">
      <div className="relative inline-flex">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
          <Sparkles className="w-9 h-9 text-white" />
        </div>
        <Loader2 className="w-20 h-20 text-blue-400/40 animate-spin absolute inset-0" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">A IA está montando o DNA da marca...</h2>
        <p className="text-sm text-gray-400 mt-2">
          Estruturando tom de voz, audiência, posicionamento e palavras-chave. Isso leva alguns segundos.
        </p>
      </div>
    </div>
  );
}
