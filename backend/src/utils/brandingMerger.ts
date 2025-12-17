/**
 * Helper para combinar insights de branding
 * Faz merge inteligente entre dados existentes e novos insights do Gemini
 */

interface BrandingData {
  visual_style?: any;
  tone_of_voice?: any;
  audience?: any;
  keywords?: string[];
}

interface GeminiAnalysis {
  visual_style?: any;
  tone_of_voice?: any;
  audience?: any;
  keywords?: string[];
  [key: string]: any;
}

/**
 * Combina arrays de keywords, removendo duplicatas
 */
function mergeKeywords(existing: string[] = [], newKeywords: string[] = []): string[] {
  const combined = [...existing, ...newKeywords];
  return Array.from(new Set(combined.map(k => k.toLowerCase())));
}

/**
 * Merge profundo de objetos JSONB, priorizando novos insights
 * mas mantendo dados históricos relevantes
 */
function deepMerge(existing: any, newData: any): any {
  if (!existing) return newData;
  if (!newData) return existing;

  if (typeof existing !== 'object' || typeof newData !== 'object') {
    return newData;
  }

  const merged = { ...existing };

  for (const key in newData) {
    if (newData[key] === null || newData[key] === undefined) {
      continue;
    }

    if (Array.isArray(newData[key])) {
      // Arrays: combinar e remover duplicatas
      merged[key] = Array.from(new Set([
        ...(existing[key] || []),
        ...newData[key]
      ]));
    } else if (typeof newData[key] === 'object') {
      // Objetos: merge recursivo
      merged[key] = deepMerge(existing[key], newData[key]);
    } else {
      // Valores primitivos: usar o novo
      merged[key] = newData[key];
    }
  }

  return merged;
}

/**
 * Processa a resposta do Gemini e extrai campos estruturados
 */
export function parseGeminiResponse(geminiText: string): GeminiAnalysis {
  try {
    // Tentar extrair informações estruturadas da resposta
    const analysis: GeminiAnalysis = {};

    // Extrair estilo visual
    const visualMatch = geminiText.match(/(?:estilo visual|visual style)[:\s]+(.*?)(?=\n\n|tom de voz|tone|público|palavras-chave|$)/is);
    if (visualMatch && visualMatch[1]) {
      analysis.visual_style = {
        description: visualMatch[1].trim(),
        extracted_at: new Date().toISOString()
      };
    }

    // Extrair tom de voz
    const toneMatch = geminiText.match(/(?:tom de voz|tone of voice|tom)[:\s]+(.*?)(?=\n\n|público|audience|palavras-chave|$)/is);
    if (toneMatch && toneMatch[1]) {
      analysis.tone_of_voice = {
        description: toneMatch[1].trim(),
        extracted_at: new Date().toISOString()
      };
    }

    // Extrair público-alvo
    const audienceMatch = geminiText.match(/(?:público-alvo|público alvo|audience|target audience)[:\s]+(.*?)(?=\n\n|palavras-chave|keywords|$)/is);
    if (audienceMatch && audienceMatch[1]) {
      analysis.audience = {
        description: audienceMatch[1].trim(),
        extracted_at: new Date().toISOString()
      };
    }

    // Extrair keywords
    const keywordsMatch = geminiText.match(/(?:palavras-chave|keywords)[:\s]+(.*?)$/is);
    if (keywordsMatch && keywordsMatch[1]) {
      const keywordsText = keywordsMatch[1].trim();
      analysis.keywords = keywordsText
        .split(/[,;\n]/)
        .map(k => k.trim())
        .filter(k => k.length > 0);
    }

    // Se não conseguiu extrair estruturado, salvar tudo como texto
    if (!analysis.visual_style && !analysis.tone_of_voice) {
      analysis.visual_style = {
        raw_analysis: geminiText,
        extracted_at: new Date().toISOString()
      };
    }

    return analysis;
  } catch (error) {
    console.error("Erro ao processar resposta do Gemini:", error);
    return {
      visual_style: {
        raw_analysis: geminiText,
        extracted_at: new Date().toISOString()
      }
    };
  }
}

/**
 * Combina dados de branding existentes com novos insights
 */
export function mergeBrandingData(
  existing: BrandingData | null,
  newInsights: GeminiAnalysis
): BrandingData {
  if (!existing) {
    return {
      visual_style: newInsights.visual_style || {},
      tone_of_voice: newInsights.tone_of_voice || {},
      audience: newInsights.audience || {},
      keywords: newInsights.keywords || []
    };
  }

  return {
    visual_style: deepMerge(existing.visual_style, newInsights.visual_style),
    tone_of_voice: deepMerge(existing.tone_of_voice, newInsights.tone_of_voice),
    audience: deepMerge(existing.audience, newInsights.audience),
    keywords: mergeKeywords(existing.keywords, newInsights.keywords)
  };
}

