// STORY-010 — Tipos e estado compartilhado do wizard de onboarding de cliente.

export interface WizardBasicData {
  nome: string;
  segmento: string; // categoria/nicho principal
  website: string;
  cidade: string;
  descricao: string;
}

export interface WizardDnaAnswers {
  tom_de_voz: string;
  publico_alvo: string;
  posicionamento: string;
  valores: string;
  objetivos_conteudo: string;
}

// Estrutura do DNA alinhada à tabela `branding` (visual_style / tone_of_voice /
// audience / keywords / archetype / usp / anti_keywords / niche).
export interface WizardDnaFields {
  visual_style: { colors: string[]; fonts: string[]; archeType: string };
  tone_of_voice: { description: string; keywords: string[] };
  audience: { persona: string; demographics: string };
  keywords: string[];
  archetype: string;
  usp: string;
  anti_keywords: string[];
  niche: string;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface WizardState {
  step: WizardStep;
  clientId: string | null;
  basicData: WizardBasicData;
  dnaAnswers: WizardDnaAnswers;
  uploadedFiles: string[]; // nomes/URLs de arquivos aceitos
  dnaFields: WizardDnaFields;
}

export const SEGMENT_OPTIONS = [
  'E-commerce',
  'Serviços',
  'Saúde',
  'Educação',
  'Varejo',
  'Gastronomia',
  'Moda',
  'Tecnologia',
  'Beleza e Estética',
  'Imobiliário',
  'Outro',
] as const;

export const TONE_OPTIONS = [
  'Profissional',
  'Descontraído',
  'Inspiracional',
  'Técnico',
  'Próximo e acolhedor',
  'Motivacional',
] as const;

export function createEmptyDnaFields(): WizardDnaFields {
  return {
    visual_style: { colors: [], fonts: [], archeType: '' },
    tone_of_voice: { description: '', keywords: [] },
    audience: { persona: '', demographics: '' },
    keywords: [],
    archetype: '',
    usp: '',
    anti_keywords: [],
    niche: '',
  };
}

export function createInitialWizardState(): WizardState {
  return {
    step: 1,
    clientId: null,
    basicData: { nome: '', segmento: '', website: '', cidade: '', descricao: '' },
    dnaAnswers: { tom_de_voz: '', publico_alvo: '', posicionamento: '', valores: '', objetivos_conteudo: '' },
    uploadedFiles: [],
    dnaFields: createEmptyDnaFields(),
  };
}

// AC6 — completude calculada em tempo real no frontend a partir dos 5 campos
// obrigatórios. Espelha a lógica do backend (clients.ts computeDnaCompleteness).
export function computeWizardCompleteness(state: WizardState): {
  percentual: number;
  campos_faltando: string[];
} {
  const has = (v: string | undefined | null) => !!v && v.trim().length > 0;
  const hasArr = (v: unknown[] | undefined) => Array.isArray(v) && v.length > 0;

  const checks: Record<string, boolean> = {
    nome: has(state.basicData.nome),
    segmento: has(state.basicData.segmento) || has(state.dnaFields.niche),
    tom_de_voz:
      has(state.dnaFields.tone_of_voice.description) ||
      hasArr(state.dnaFields.tone_of_voice.keywords) ||
      has(state.dnaAnswers.tom_de_voz),
    audiencia:
      has(state.dnaFields.audience.persona) ||
      has(state.dnaFields.audience.demographics) ||
      has(state.dnaAnswers.publico_alvo),
    posicionamento: has(state.dnaFields.usp) || has(state.dnaAnswers.posicionamento),
  };

  const keys = Object.keys(checks);
  const campos_faltando = keys.filter((k) => !checks[k]);
  const filled = keys.length - campos_faltando.length;
  const percentual = Math.round((filled / keys.length) * 100);
  return { percentual, campos_faltando };
}
