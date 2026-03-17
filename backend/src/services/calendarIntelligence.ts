import { GoogleGenerativeAI } from "@google/generative-ai";
import { updateTokenUsage } from "../utils/tokenTracker";
import { getGeminiModelCandidates } from "../utils/googleModels";
import { groundedSuggestDatas } from "./groundedSearchService";

export interface CalendarSlotBlueprint {
  slot_index: number;
  suggested_day: number;
  formato: "Reels" | "Arte" | "Carrossel" | "Story" | "Foto";
}

export interface CalendarSlotPlan extends CalendarSlotBlueprint {
  pilar: string;
  angle: string;
  objective: string;
  funnel_stage: string;
  product_focus: string;
  reason_why_now: string;
  cta_direction: string;
  proof_asset: string;
  hook: string;
}

export interface MonthlyStrategicPlan {
  monthly_thesis: string;
  hero_campaign: string;
  audience_tension: string;
  priority_pillars: string[];
  diversity_guardrails: string[];
  anti_genericity_rules: string[];
  must_reference_dates: Array<{
    day: number;
    title: string;
    why_it_matters: string;
  }>;
  slot_plan: CalendarSlotPlan[];
}

interface CallJsonArgs {
  clienteId: string;
  featureName: string;
  prompt: string;
  apiKey: string;
  tier?: "fast" | "quality";
  temperature?: number;
  maxOutputTokens?: number;
}

const cleanAndParseJSON = <T>(text: string): T => {
  const cleaned = String(text || "")
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  const candidates: string[] = [];
  const firstArray = cleaned.indexOf("[");
  const lastArray = cleaned.lastIndexOf("]");
  if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
    candidates.push(cleaned.slice(firstArray, lastArray + 1));
  }

  const firstObject = cleaned.indexOf("{");
  const lastObject = cleaned.lastIndexOf("}");
  if (firstObject !== -1 && lastObject !== -1 && lastObject > firstObject) {
    candidates.push(cleaned.slice(firstObject, lastObject + 1));
  }

  candidates.push(cleaned);

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw new Error(`Falha ao interpretar JSON estruturado: ${lastError?.message || "sem detalhes"}`);
};

const callGeminiJson = async <T>({
  clienteId,
  featureName,
  prompt,
  apiKey,
  tier = "fast",
  temperature = 0.4,
  maxOutputTokens = 4096,
}: CallJsonArgs): Promise<{ data: T; model: string }> => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelsToTry = getGeminiModelCandidates(tier);
  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature,
          maxOutputTokens,
        },
      });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const usageMetadata = result.response.usageMetadata;
      if (usageMetadata) {
        await updateTokenUsage(clienteId, usageMetadata, featureName, modelName);
      }

      return {
        data: cleanAndParseJSON<T>(responseText),
        model: modelName,
      };
    } catch (error) {
      lastError = error as Error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  throw new Error(`Nenhum modelo Gemini respondeu para ${featureName}: ${lastError?.message || "sem resposta"}`);
};

const FORMAT_ORDER: Array<CalendarSlotBlueprint["formato"]> = ["Reels", "Arte", "Carrossel", "Story", "Foto"];

export function buildSlotBlueprintFromMix(mix: Record<string, number>): CalendarSlotBlueprint[] {
  const remaining: Record<CalendarSlotBlueprint["formato"], number> = {
    Reels: Math.max(0, Number(mix.reels || 0)),
    Arte: Math.max(0, Number(mix.static || 0)),
    Carrossel: Math.max(0, Number(mix.carousel || 0)),
    Story: Math.max(0, Number(mix.stories || 0)),
    Foto: Math.max(0, Number(mix.photos || 0)),
  };

  const formats: CalendarSlotBlueprint["formato"][] = [];
  let keepLooping = true;
  while (keepLooping) {
    keepLooping = false;
    for (const formato of FORMAT_ORDER) {
      if (remaining[formato] > 0) {
        formats.push(formato);
        remaining[formato] -= 1;
        keepLooping = true;
      }
    }
  }

  const total = formats.length;
  return formats.map((formato, index) => {
    const day = Math.max(1, Math.min(31, Math.round(((index + 1) * 29) / (total + 1))));
    return {
      slot_index: index + 1,
      suggested_day: day,
      formato,
    };
  });
}

const buildHistoryContext = async (_clienteId: string): Promise<string> =>
  "Historico editorial desabilitado nesta fase. Decida por contexto de marca, briefing, datas e produtos.";

const parseMesLabel = (mesLabel: string): { mes: number; ano: number } | null => {
  const parts = String(mesLabel || "").trim().split(" ");
  if (parts.length < 2) return null;

  const ano = Number(parts[parts.length - 1]);
  if (!Number.isFinite(ano)) return null;

  const mesNome = parts.slice(0, -1).join(" ").toLowerCase();
  const mapaMeses: Record<string, number> = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    "mar�o": 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };

  const mes = mapaMeses[mesNome];
  if (!mes) return null;
  return { mes, ano };
};

const buildGroundedContext = async (mesLabel: string, categoriasNicho: string[], briefing: string): Promise<string> => {
  const parsed = parseMesLabel(mesLabel);
  if (!parsed) return "";

  try {
    const grounded = await groundedSuggestDatas({
      mes: parsed.mes,
      ano: parsed.ano,
      categorias: categoriasNicho,
      queryExtra: briefing,
      maxResults: 5,
    });

    if (grounded.suggestions.length === 0) return "";

    return grounded.suggestions
      .map((item) => `${item.data}: ${item.titulo}${item.descricao ? ` | ${item.descricao}` : ""}`)
      .join("\n");
  } catch {
    return "";
  }
};

interface PlanMonthlyCalendarArgs {
  clienteId: string;
  apiKey: string;
  mes: string;
  mix: Record<string, number>;
  brandingSummary: string;
  briefing: string;
  rules: string;
  docsResumo: string;
  datasResumoTexto: string;
  produtosFocoTexto: string;
  monthReferences: string;
  continuityContext: string;
  effectiveGenerationPrompt: string;
  categoriasNicho: string[];
}

export const planMonthlyCalendar = async ({
  clienteId,
  apiKey,
  mes,
  mix,
  brandingSummary,
  briefing,
  rules,
  docsResumo,
  datasResumoTexto,
  produtosFocoTexto,
  monthReferences,
  continuityContext,
  effectiveGenerationPrompt,
  categoriasNicho,
}: PlanMonthlyCalendarArgs): Promise<{ plan: MonthlyStrategicPlan; model: string; historyContext: string; groundedContext: string }> => {
  const slotBlueprint = buildSlotBlueprintFromMix(mix);
  const historyContext = await buildHistoryContext(clienteId);
  const groundedContext = await buildGroundedContext(mes, categoriasNicho, briefing);

  const plannerPrompt = `
Voce e um estrategista senior de conteudo para redes sociais.

Seu trabalho NAO e escrever o post final ainda. Primeiro voce monta o plano mensal estruturado que vai guiar a composicao final.

MES: ${mes}
BRIEFING: ${briefing || "Sem briefing adicional."}
BRANDING:
${brandingSummary}

REGRAS OBRIGATORIAS:
${rules || "Nenhuma regra adicional."}

PRODUTOS FOCO:
${produtosFocoTexto || "Sem produto foco explicitado."}

DATAS E GANCHOS INTERNOS:
${datasResumoTexto || "Sem datas internas relevantes."}

DATAS E GANCHOS COM GROUNDING GOOGLE:
${groundedContext || "Sem ganchos externos confirmados."}

REFERENCIAS DO MES:
${monthReferences || "Nenhuma referencia enviada."}

CONTINUIDADE ENTRE MESES:
${continuityContext || "Primeiro mes."}

DOCS EXTRAS DA MARCA:
${docsResumo || "Nenhum doc extra."}

HISTORICO DE PERFORMANCE:
${historyContext}

DIRETRIZ AVANCADA:
${effectiveGenerationPrompt || "Use discernimento estrategico forte."}

SLOTS FIXOS QUE DEVEM SER PREENCHIDOS:
${JSON.stringify(slotBlueprint, null, 2)}

Retorne APENAS JSON com esta estrutura:
{
  "monthly_thesis": "...",
  "hero_campaign": "...",
  "audience_tension": "...",
  "priority_pillars": ["..."],
  "diversity_guardrails": ["..."],
  "anti_genericity_rules": ["..."],
  "must_reference_dates": [
    { "day": 8, "title": "...", "why_it_matters": "..." }
  ],
  "slot_plan": [
    {
      "slot_index": 1,
      "suggested_day": 3,
      "formato": "Reels",
      "pilar": "...",
      "angle": "...",
      "objective": "...",
      "funnel_stage": "...",
      "product_focus": "...",
      "reason_why_now": "...",
      "cta_direction": "...",
      "proof_asset": "...",
      "hook": "..."
    }
  ]
}

Regras do plano:
- Preencha TODOS os slots recebidos, sem criar nem remover slots.
- Mantenha exatamente slot_index, suggested_day e formato de cada slot.
- Evite pilares e CTAs repetitivos.
- Todo slot precisa ter um motivo claro de existir agora, nao apenas um tema bonito.
- Use datas comemorativas e ganchos externos apenas quando houver aderencia real com a marca.
- Prefira angulos especificos e proprietarios da marca em vez de conselhos genericos de internet.
`;

  const { data, model } = await callGeminiJson<MonthlyStrategicPlan>({
    clienteId,
    featureName: "calendar_month_planner",
    prompt: plannerPrompt,
    apiKey,
    tier: "fast",
    temperature: 0.5,
    maxOutputTokens: 4096,
  });

  const normalizedPlan: MonthlyStrategicPlan = {
    monthly_thesis: String(data?.monthly_thesis || "").trim(),
    hero_campaign: String(data?.hero_campaign || "").trim(),
    audience_tension: String(data?.audience_tension || "").trim(),
    priority_pillars: Array.isArray(data?.priority_pillars) ? data.priority_pillars.map((item) => String(item).trim()).filter(Boolean) : [],
    diversity_guardrails: Array.isArray(data?.diversity_guardrails) ? data.diversity_guardrails.map((item) => String(item).trim()).filter(Boolean) : [],
    anti_genericity_rules: Array.isArray(data?.anti_genericity_rules) ? data.anti_genericity_rules.map((item) => String(item).trim()).filter(Boolean) : [],
    must_reference_dates: Array.isArray(data?.must_reference_dates)
      ? data.must_reference_dates.map((item) => ({
          day: Math.max(1, Math.min(31, Number(item?.day || 1))),
          title: String(item?.title || "").trim(),
          why_it_matters: String(item?.why_it_matters || "").trim(),
        })).filter((item) => item.title)
      : [],
    slot_plan: Array.isArray(data?.slot_plan)
      ? data.slot_plan.map((slot, index) => ({
          slot_index: Number(slot?.slot_index || slotBlueprint[index]?.slot_index || index + 1),
          suggested_day: Math.max(1, Math.min(31, Number(slot?.suggested_day || slotBlueprint[index]?.suggested_day || index + 1))),
          formato: (slot?.formato || slotBlueprint[index]?.formato || "Arte") as CalendarSlotPlan["formato"],
          pilar: String(slot?.pilar || "").trim(),
          angle: String(slot?.angle || "").trim(),
          objective: String(slot?.objective || "").trim(),
          funnel_stage: String(slot?.funnel_stage || "").trim(),
          product_focus: String(slot?.product_focus || "").trim(),
          reason_why_now: String(slot?.reason_why_now || "").trim(),
          cta_direction: String(slot?.cta_direction || "").trim(),
          proof_asset: String(slot?.proof_asset || "").trim(),
          hook: String(slot?.hook || "").trim(),
        }))
      : [],
  };

  if (normalizedPlan.slot_plan.length !== slotBlueprint.length) {
    normalizedPlan.slot_plan = slotBlueprint.map((slot, index) => ({
      slot_index: slot.slot_index,
      suggested_day: slot.suggested_day,
      formato: slot.formato,
      pilar: normalizedPlan.priority_pillars[index % Math.max(1, normalizedPlan.priority_pillars.length)] || "Conteudo de valor",
      angle: "Abordagem especifica ancorada no contexto da marca",
      objective: "Gerar interesse qualificado",
      funnel_stage: "consideracao",
      product_focus: "",
      reason_why_now: "Conecta o momento do mes com uma dor real do publico",
      cta_direction: "Estimular conversa qualificada",
      proof_asset: "Use prova concreta da marca",
      hook: "Abertura especifica e nao generica",
    }));
  }

  return { plan: normalizedPlan, model, historyContext, groundedContext };
};

interface CritiqueCalendarDraftArgs {
  clienteId: string;
  apiKey: string;
  mes: string;
  historyContext: string;
  monthlyPlan: MonthlyStrategicPlan;
  calendarData: unknown[];
}

export const critiqueCalendarDraft = async ({
  clienteId,
  apiKey,
  mes,
  historyContext,
  monthlyPlan,
  calendarData,
}: CritiqueCalendarDraftArgs): Promise<{ calendar: unknown[]; model: string }> => {
  const criticPrompt = `
Voce e um revisor estrategico anti-genericidade.

MES: ${mes}

PLANO MENSAL APROVADO:
${JSON.stringify(monthlyPlan, null, 2)}

RASCUNHO DO CALENDARIO:
${JSON.stringify(calendarData, null, 2)}

HISTORICO DE PERFORMANCE:
${historyContext}

Retorne APENAS um JSON ARRAY com o calendario final revisado.

REGRA ABSOLUTA DE ESTRUTURA (nao negocie):
- Cada post deve conter TODOS os seguintes campos: dia, tema, formato, instrucoes_visuais, copy_inicial, objetivo, cta, palavras_chave.
- O campo "formato" e OBRIGATORIO e deve ser exatamente um de: "Reels", "Arte", "Carrossel", "Foto", "Story".
- NUNCA remova ou omita o campo "formato". Se nao souber qual formato usar, mantenha o do rascunho original.
- Mantenha o mesmo "dia" e "formato" de cada post — altere apenas o conteudo dos campos de texto.

O que revisar:
- Elimine temas vagos, repetitivos ou que poderiam servir para qualquer marca.
- Se houver CTA muito repetido, varie.
- Reforce o vinculo de cada post com um pilar, angulo e razao do momento.
- Nao invente promessas ou dados factuais sem base.
- Garanta que carrosseis continuem estruturados por slides.
`;

  const { data, model } = await callGeminiJson<unknown[]>({
    clienteId,
    featureName: "calendar_month_critic",
    prompt: criticPrompt,
    apiKey,
    tier: "fast",
    temperature: 0.2,
    maxOutputTokens: 6144,
  });

  return {
    calendar: Array.isArray(data) ? data : calendarData,
    model,
  };
};
