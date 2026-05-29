import { geminiClient } from "./geminiClient";
import { ragService } from "../services/ragService";
import db from "../config/database";
import logger from "./logger";

/**
 * STORY-015 (AC5) — Constroi hints de performance a partir das metricas reais
 * coletadas do Instagram (ultimos 60 dias), agrupadas por formato Sphera
 * (Reels=VIDEO, Carrossel=CAROUSEL_ALBUM, Arte/Foto=IMAGE e demais).
 *
 * Um hint e gerado para cada formato cujo engagement_rate medio seja pelo menos
 * 50% maior que a media geral. Retorna [] quando nao ha dados suficientes —
 * graceful degradation (sem erro, sem fallback artificial).
 */
async function buildPerformanceHints(clienteId: string): Promise<string[]> {
  const { rows: metrics } = await db.query<{
    formato: string;
    avg_engagement: number;
    post_count: number;
  }>(
    `
      SELECT
        CASE
          WHEN m.metadata->>'media_type' = 'VIDEO' THEN 'Reels'
          WHEN m.metadata->>'media_type' = 'CAROUSEL_ALBUM' THEN 'Carrossel'
          ELSE 'Arte/Foto'
        END AS formato,
        AVG(m.engagement_rate) AS avg_engagement,
        COUNT(*) AS post_count
      FROM social_metrics m
      JOIN social_accounts sa ON sa.id = m.social_account_id
      WHERE sa.cliente_id = $1
        AND m.metric_date >= NOW() - INTERVAL '60 days'
      GROUP BY formato
      HAVING COUNT(*) >= 3
    `,
    [clienteId]
  );

  if (metrics.length === 0) return [];

  const avgGeral =
    metrics.reduce((s, r) => s + (Number(r.avg_engagement) || 0), 0) / metrics.length;
  if (avgGeral <= 0) return [];

  return metrics
    .filter((r) => (Number(r.avg_engagement) || 0) > avgGeral * 1.5)
    .map(
      (r) =>
        `[DADOS REAIS] ${r.formato} performam ${((Number(r.avg_engagement) || 0) / avgGeral).toFixed(
          1
        )}x melhor em engajamento nos ultimos 60 dias para este cliente`
    );
}

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
  archetype?: string;
  usp?: string;
  anti_keywords?: string;
  nicho?: string;
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
    archetype: branding?.archetype || "",
    usp: branding?.usp || "",
    anti_keywords: branding?.anti_keywords || "",
    nicho: branding?.nicho || "",
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
Você é o Estrategista Principal e Guardião Verbal da marca.
${brandingData.nicho ? `**Nicho de Atuação:** ${brandingData.nicho}` : ''}
${brandingData.archetype ? `**Seu arquétipo é:** ${brandingData.archetype}` : ''}
${brandingData.usp ? `**Sua Proposta Única de Valor é:** ${brandingData.usp}` : ''}
${brandingData.anti_keywords ? `**Você NUNCA usa as palavras:** ${brandingData.anti_keywords}` : ''}

Com base nos dados abaixo, crie um calendário editorial estratégico de ${periodo} dias.

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
  brandRules: string[] = [],
  clienteId?: string
): Promise<CalendarDay[]> {
  try {
    // Construir prompt
    const prompt = buildCalendarPrompt(brandingData, postsHistory, periodo, briefing, brandRules);

    // STORY-013 — Injecao de contexto RAG (cerebro por cliente). So executa quando
    // clienteId e informado. Graceful degradation: falha ou ausencia de chunks nao
    // interrompe a geracao — o calendario e gerado sem o bloco de contexto.
    let finalPrompt = prompt;

    // STORY-015 (AC5) — Injecao de performance hints (dados reais do Instagram).
    // Executa ANTES do bloco RAG, no mesmo padrao de graceful degradation:
    // falha ou ausencia de metricas nao interrompe a geracao.
    if (clienteId) {
      try {
        const hints = await buildPerformanceHints(clienteId);
        if (hints.length > 0) {
          finalPrompt =
            `### Performance real da conta (Instagram):\n${hints.join("\n")}\n\n` + finalPrompt;
          logger.info(
            { event: "performance_hints_injected", cliente_id: clienteId, hints_count: hints.length },
            "Performance hints injetados no prompt (geminiCalendar)"
          );
        }
      } catch (err: any) {
        logger.warn(
          { event: "performance_hints_failed", cliente_id: clienteId, err: err?.message },
          "Falha ao buscar hints de performance — gerando calendario sem hints"
        );
      }
    }

    if (clienteId) {
      try {
        const ragQuery = [briefing, brandingData.nicho, brandingData.archetype]
          .map((s: any) => String(s || "").trim())
          .filter(Boolean)
          .join(" ") || "calendario editorial conteudo estrategia marca";

        const ragChunks = await ragService.retrieve(clienteId, ragQuery, {
          k: 8,
          sourceTypes: ["brand_doc", "brand_rule", "past_post_approved"],
        });

        if (ragChunks.length > 0) {
          const similarityAvg =
            ragChunks.reduce((sum, c) => sum + (Number(c.similarity) || 0), 0) / ragChunks.length;
          finalPrompt =
            `${finalPrompt}\n\n### Contexto da marca (baseado em historico aprovado e regras):\n` +
            ragChunks.map((c) => c.content).join("\n\n");
          logger.info(
            {
              event: "rag_context_injected",
              cliente_id: clienteId,
              chunks_count: ragChunks.length,
              similarity_avg: Number(similarityAvg.toFixed(4)),
            },
            "Contexto RAG injetado no prompt (geminiCalendar)"
          );
        }
      } catch (ragErr: any) {
        logger.warn(
          { event: "rag_context_unavailable", cliente_id: clienteId, err: ragErr?.message },
          "RAG indisponivel — gerando calendario sem contexto historico"
        );
      }
    }

    // Chamar Gemini (usando modo texto, sem imagem)
    const text = await geminiClient.generateTextContent(finalPrompt);

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
