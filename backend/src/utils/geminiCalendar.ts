import { geminiClient } from "./geminiClient";

/**
 * Tipos para o calendário editorial
 */
export interface CalendarDay {
  dia: number;
  tema: string;
  formato: string;
  instrucoes_visuais: string;
  copy_inicial: string;
  objetivo: string;
  cta: string;
  palavras_chave: string[];
}

export interface BrandingDataset {
  tom_de_voz?: any;
  estilo_visual?: any;
  audience?: any;
  keywords?: string[];
}

export interface PostsHistory {
  temas_recorrentes: string[];
  categorias: string[];
  forca_marca: string;
}

/**
 * Cria um dataset resumido do branding e histórico
 */
export function createBrandingDataset(
  branding: any,
  postsProcessados: any[]
): { brandingData: BrandingDataset; postsHistory: PostsHistory } {
  // Extrair dados de branding
  const brandingData: BrandingDataset = {
    tom_de_voz: branding?.tone_of_voice || {},
    estilo_visual: branding?.visual_style || {},
    audience: branding?.audience || {},
    keywords: branding?.keywords || [],
  };

  // Analisar histórico de posts
  const temas: string[] = [];
  const categorias: string[] = [];

  postsProcessados.forEach((post) => {
    if (post.metadata) {
      const metadata = typeof post.metadata === 'string' 
        ? JSON.parse(post.metadata) 
        : post.metadata;
      
      // Extrair temas da análise
      if (metadata.analysis) {
        // Tentar identificar temas e categorias na análise
        const analysis = metadata.analysis.toLowerCase();
        
        if (analysis.includes("educacional") || analysis.includes("educativo")) {
          categorias.push("Educacional");
        }
        if (analysis.includes("promocional") || analysis.includes("venda")) {
          categorias.push("Promocional");
        }
        if (analysis.includes("inspiracional") || analysis.includes("motivacional")) {
          categorias.push("Inspiracional");
        }
        if (analysis.includes("produto") || analysis.includes("serviço")) {
          categorias.push("Produto/Serviço");
        }
      }
    }
  });

  const postsHistory: PostsHistory = {
    temas_recorrentes: Array.from(new Set(temas)),
    categorias: Array.from(new Set(categorias)),
    forca_marca: postsProcessados.length > 5 
      ? "Forte" 
      : postsProcessados.length > 2 
      ? "Moderada" 
      : "Inicial",
  };

  return { brandingData, postsHistory };
}

/**
 * Gera o prompt para criação do calendário editorial
 */
export function buildCalendarPrompt(
  brandingData: BrandingDataset,
  postsHistory: PostsHistory,
  periodo: number,
  briefing?: string,
  brandRules: string[] = []
): string {
  const prompt = `
Você é um estrategista de social media expert. Com base nos dados abaixo, crie um calendário editorial estratégico de ${periodo} dias.

## BRANDING DA MARCA

**Tom de Voz:**
${JSON.stringify(brandingData.tom_de_voz, null, 2)}

**Estilo Visual:**
${JSON.stringify(brandingData.estilo_visual, null, 2)}

**Público-Alvo:**
${JSON.stringify(brandingData.audience, null, 2)}

**Palavras-chave da Marca:**
${brandingData.keywords?.join(", ") || "Não especificadas"}

## HISTÓRICO DE CONTEÚDO

**Temas Recorrentes:** ${postsHistory.temas_recorrentes.join(", ") || "Primeira análise"}
**Categorias Utilizadas:** ${postsHistory.categorias.join(", ") || "Primeira análise"}
**Força da Marca:** ${postsHistory.forca_marca}

${brandRules.length > 0 ? `
### REGRAS OBRIGATÓRIAS DA MARCA (Siga estritamente):
${brandRules.map(rule => `- ${rule}`).join('\n')}
` : ''}

${briefing ? `## BRIEFING DO CLIENTE\n${briefing}\n` : ""}

## TAREFA

Gere um calendário editorial de ${periodo} dias. Para cada dia, forneça:

1. **dia** (número do dia, 1 a ${periodo})
2. **tema** (tema específico do post)
3. **formato** (ex: Carrossel, Reels, Imagem estática, Stories, etc.)
4. **instrucoes_visuais** (cores, elementos, mood, referências)
5. **copy_inicial** (texto sugerido para o post, incluindo emojis e hashtags)
6. **objetivo** (objetivo estratégico da publicação)
7. **cta** (call-to-action sugerido)
8. **palavras_chave** (array de 3-5 palavras-chave relevantes)

**IMPORTANTE:**
- Mantenha CONSISTÊNCIA com o tom de voz e estilo visual da marca
- Varie os formatos e temas para manter engajamento
- Inclua mix de conteúdo: educacional, promocional, inspiracional
${brandRules.length > 0 ? '- RESPEITE TODAS AS REGRAS OBRIGATÓRIAS LISTADAS ACIMA' : ''}
- Retorne APENAS um JSON válido no formato abaixo (sem texto extra):

{
  "calendario": [
    {
      "dia": 1,
      "tema": "...",
      "formato": "...",
      "instrucoes_visuais": "...",
      "copy_inicial": "...",
      "objetivo": "...",
      "cta": "...",
      "palavras_chave": ["...", "...", "..."]
    }
  ]
}
`;

  return prompt;
}

/**
 * Gera calendário editorial usando Google Gemini
 */
export async function generateCalendarWithGemini(
  brandingData: BrandingDataset,
  postsHistory: PostsHistory,
  periodo: number,
  briefing?: string,
  brandRules: string[] = []
): Promise<CalendarDay[]> {
  try {
    // Construir prompt
    const prompt = buildCalendarPrompt(brandingData, postsHistory, periodo, briefing, brandRules);

    // Chamar Gemini (usando modo texto, sem imagem)
    const text = await geminiClient.generateTextContent(prompt);

    // Tentar extrair JSON da resposta
    let calendarData;
    try {
      // Remover possíveis markdown code blocks
      const cleanedText = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      
      calendarData = JSON.parse(cleanedText);
    } catch (parseError) {
      // Se falhar, tentar encontrar JSON no texto
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        calendarData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Não foi possível extrair JSON válido da resposta");
      }
    }

    // Validar estrutura
    if (!calendarData.calendario || !Array.isArray(calendarData.calendario)) {
      throw new Error("Formato de calendário inválido");
    }

    return calendarData.calendario as CalendarDay[];
  } catch (error) {
    console.error("Erro ao gerar calendário com Gemini:", error);
    throw new Error("Falha ao gerar calendário editorial. Tente novamente.");
  }
}
