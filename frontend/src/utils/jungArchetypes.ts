export type JungArchetypeKey =
  | 'Inocente'
  | 'Orfão'
  | 'Herói'
  | 'Cuidador'
  | 'Explorador'
  | 'Rebelde'
  | 'Amante'
  | 'Criador'
  | 'Bobo'
  | 'Sábio'
  | 'Mago'
  | 'Governante';

export interface JungArchetypeInfo {
  key: JungArchetypeKey;
  label: string;
  emoji: string;
  description: string;
  tone_hint: string;
}

export const JUNG_ARCHETYPES: JungArchetypeInfo[] = [
  {
    key: 'Inocente',
    label: 'Inocente',
    emoji: '🌿',
    description: 'Busca simplicidade, otimismo e confiança. Promete uma vida melhor e mais leve.',
    tone_hint: 'Leve, positivo, acolhedor, transparente.',
  },
  {
    key: 'Orfão',
    label: 'Órfão (Cara Comum)',
    emoji: '🤝',
    description: 'Valoriza pertencimento e realismo. Conecta pela empatia e pelo “somos como você”.',
    tone_hint: 'Humano, próximo, honesto, sem exageros.',
  },
  {
    key: 'Herói',
    label: 'Herói',
    emoji: '🛡️',
    description: 'Superação e coragem. Ajuda o público a vencer desafios e alcançar resultados.',
    tone_hint: 'Motivador, objetivo, confiante, orientado a performance.',
  },
  {
    key: 'Cuidador',
    label: 'Cuidador',
    emoji: '🫶',
    description: 'Protege e cuida. Gera segurança e bem-estar, colocando o outro em primeiro lugar.',
    tone_hint: 'Empático, protetor, gentil, educativo.',
  },
  {
    key: 'Explorador',
    label: 'Explorador',
    emoji: '🧭',
    description: 'Liberdade e descoberta. Incentiva autonomia, novidade e aventura.',
    tone_hint: 'Curioso, inspirador, aberto a novas possibilidades.',
  },
  {
    key: 'Rebelde',
    label: 'Rebelde (Fora-da-lei)',
    emoji: '🔥',
    description: 'Quebra padrões e desafia o status quo. Promove mudança e atitude.',
    tone_hint: 'Direto, ousado, provocativo, com personalidade forte.',
  },
  {
    key: 'Amante',
    label: 'Amante',
    emoji: '💖',
    description: 'Relacionamento, beleza e prazer. Cria conexão emocional e desejo.',
    tone_hint: 'Sensível, caloroso, estético, envolvente.',
  },
  {
    key: 'Criador',
    label: 'Criador',
    emoji: '🎨',
    description: 'Inovação e imaginação. Busca expressar autenticidade e criar algo único.',
    tone_hint: 'Criativo, original, experimental, inspirador.',
  },
  {
    key: 'Bobo',
    label: 'Bobo (Brincalhão)',
    emoji: '🎭',
    description: 'Leveza e humor. Quebra tensões e torna a marca memorável.',
    tone_hint: 'Bem-humorado, simples, irreverente, simpático.',
  },
  {
    key: 'Sábio',
    label: 'Sábio',
    emoji: '📚',
    description: 'Conhecimento e verdade. Ensina e orienta com profundidade e método.',
    tone_hint: 'Didático, analítico, claro, baseado em evidências.',
  },
  {
    key: 'Mago',
    label: 'Mago',
    emoji: '✨',
    description: 'Transformação e visão. Faz o público acreditar em possibilidades e mudança.',
    tone_hint: 'Inspirador, visionário, simbólico, transformador.',
  },
  {
    key: 'Governante',
    label: 'Governante',
    emoji: '👑',
    description: 'Ordem, controle e liderança. Promete excelência e estabilidade.',
    tone_hint: 'Sólido, confiante, premium, com autoridade.',
  },
];

export const getArchetypeInfo = (key?: string | null): JungArchetypeInfo | null => {
  if (!key) return null;
  const found = JUNG_ARCHETYPES.find((a) => a.key === key || a.label === key);
  return found || null;
};
