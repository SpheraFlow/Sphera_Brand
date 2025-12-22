import { VertexAI } from "@google-cloud/vertexai";

export type GroundedSource = {
  title?: string;
  uri?: string;
};

export type GroundedSuggestion = {
  data: string; // YYYY-MM-DD
  titulo: string;
  descricao?: string | null;
  categorias: string[];
  relevancia?: number;
  fontes: GroundedSource[];
};

const getVertexConfig = () => {
  const project =
    process.env.VERTEX_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT;

  const location = process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

  if (!project) {
    throw new Error(
      "VERTEX_PROJECT_ID (ou GOOGLE_CLOUD_PROJECT) não configurado. Necessário para usar Google Search Grounding via Vertex AI."
    );
  }

  return { project, location };
};

const normalizeCategorias = (input: unknown): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((c) => String(c).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
  }
  return [];
};

const safeJsonArrayParse = (text: string): any[] => {
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const candidate = text.slice(firstBracket, lastBracket + 1);
    return JSON.parse(candidate);
  }
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
};

export async function groundedSuggestDatas(params: {
  mes: number;
  ano: number;
  categorias?: unknown;
  queryExtra?: string;
  maxResults?: number;
}): Promise<{ suggestions: GroundedSuggestion[]; rawText: string; sources: GroundedSource[] }> {
  const { project, location } = getVertexConfig();

  const categoriasArr = normalizeCategorias(params.categorias);
  const maxResults = Math.max(1, Math.min(20, params.maxResults || 10));

  const vertexAI = new VertexAI({ project, location });
  const model = vertexAI.preview.getGenerativeModel({
    // Nomes de modelo no Vertex diferem do SDK "@google/generative-ai".
    // Este é amplamente disponível e rápido.
    model: process.env.VERTEX_GEMINI_MODEL || "gemini-1.5-flash-002",
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.4,
      topP: 0.95,
    },
  });

  const googleSearchRetrievalTool = {
    googleSearchRetrieval: {
      disableAttribution: false,
    },
  };

  const monthStr = String(params.mes).padStart(2, "0");
  const categoriasText = categoriasArr.length > 0 ? categoriasArr.join(", ") : "geral";

  const prompt = `
Você é um pesquisador e planner de marketing. Use Google Search (grounding) para encontrar datas relevantes, campanhas e acontecimentos recorrentes que possam virar ganchos de conteúdo.

Regras:
- O mês-alvo é ${monthStr}/${params.ano}. Retorne SOMENTE itens dentro desse mês.
- Cada item DEVE ter uma data válida no formato ISO YYYY-MM-DD.
- Foque em Brasil quando fizer sentido.
- Categorize com as categorias fornecidas (ou 'geral' se não houver). Categorias alvo: ${categoriasText}.
- Não invente datas: se não tiver data confiável, não inclua.
- Retorne APENAS um JSON (sem markdown) como array com no máximo ${maxResults} itens.

Campos por item:
- data (YYYY-MM-DD)
- titulo (curto)
- descricao (1-2 frases)
- categorias (array de strings)
- relevancia (0-10)

Consulta extra do usuário (se houver): ${params.queryExtra || "(nenhuma)"}
`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [googleSearchRetrievalTool],
  });

  const response: any = result.response;
  const text: string =
    (typeof response.text === "function" ? response.text() : undefined) ||
    response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n") ||
    "";

  const groundingMetadata = response?.candidates?.[0]?.groundingMetadata;
  const chunks: any[] = groundingMetadata?.groundingChunks || [];

  const sources: GroundedSource[] = Array.from(
    new Map(
      chunks
        .map((c: any) => ({
          title: c?.web?.title,
          uri: c?.web?.uri,
        }))
        .filter((s: any) => s?.uri)
        .map((s: any) => [s.uri, s])
    ).values()
  );

  const parsed = safeJsonArrayParse(text);
  const suggestions: GroundedSuggestion[] = (Array.isArray(parsed) ? parsed : [])
    .slice(0, maxResults)
    .map((item: any) => {
      const categorias = Array.isArray(item?.categorias)
        ? item.categorias.map((c: any) => String(c).trim()).filter(Boolean)
        : categoriasArr.length > 0
          ? categoriasArr
          : ["geral"];

      return {
        data: String(item?.data || "").slice(0, 10),
        titulo: String(item?.titulo || "").trim(),
        descricao: item?.descricao ? String(item.descricao) : null,
        categorias,
        relevancia: Number.isFinite(Number(item?.relevancia)) ? Number(item.relevancia) : 5,
        fontes: sources,
      };
    })
    .filter((s) => s.data && /^\d{4}-\d{2}-\d{2}$/.test(s.data) && s.titulo);

  return { suggestions, rawText: text, sources };
}
