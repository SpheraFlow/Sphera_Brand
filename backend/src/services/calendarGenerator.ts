import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../config/database";
import { updateTokenUsage } from "../utils/tokenTracker";
import { validateCalendarSchema, InvalidCalendarOutputError } from "../utils/calendarValidator";
import { buildSlotBlueprintFromMix, critiqueCalendarDraft, planMonthlyCalendar } from "./calendarIntelligence";
import { getGeminiModelCandidates } from "../utils/googleModels";

const isCarouselFormato = (formato: any): boolean => {
    return String(formato || "").toLowerCase().includes("carrossel") || String(formato || "").toLowerCase().includes("carousel");
};

const compactText = (value: any): string => {
    return String(value || "")
        .replace(/\[slide\s*\d+\]\s*/gi, "")
        .replace(/\s+/g, " ")
        .trim();
};

const buildFallbackLegenda = (post: any): string => {
    const explicitCaption = [post?.legenda, post?.copy_sugestao]
        .map((value) => String(value || "").trim())
        .find((value) => value && !/\[slide\s*\d+\]/i.test(value));
    if (explicitCaption) return explicitCaption;

    const slideSections = String(post?.copy_inicial || "")
        .split(/\[slide\s*\d+\]/gi)
        .map((part) => part.trim())
        .filter(Boolean);

    const captionCore = compactText(slideSections.slice(0, 2).join(" ") || post?.copy_inicial || "");
    const parts = [String(post?.tema || "").trim(), captionCore].filter(Boolean);
    let legenda = parts.join(". ").trim();

    const cta = String(post?.cta || "").trim();
    if (cta && !legenda.toLowerCase().includes(cta.toLowerCase())) {
        legenda = legenda ? `${legenda}\n\n${cta}` : cta;
    }

    if (!legenda) {
        legenda = String(post?.tema || cta || "Carrossel sem legenda gerada").trim();
    }

    if (legenda.length > 420) {
        legenda = `${legenda.slice(0, 417).trimEnd()}...`;
    }

    return legenda;
};

const ensureCarouselLegendas = (calendarData: any): any => {
    if (!Array.isArray(calendarData)) return calendarData;

    for (const post of calendarData) {
        if (!post || typeof post !== "object") continue;
        if (!isCarouselFormato(post.formato)) continue;
        if (typeof post.legenda === "string" && post.legenda.trim()) continue;

        post.legenda = buildFallbackLegenda(post);
    }

    return calendarData;
};
const HARDCODED_TEMPLATE_FALLBACK = `Atue como o Estrategista Principal e Guardião Verbal da marca (Nicho: {{NICHO}}).
Seu arquétipo é {{ARQUETIPO}}.
Você NUNCA usa as palavras: {{ANTI_PALAVRAS}}.
Sua Proposta Única de Valor é: {{DIFERENCIAL_USP}}.
Seu Tom de Voz: {{TOM_DE_VOZ}}

Crie um Planejamento de Conteúdo contendo EXATAMENTE esta quantidade de posts:
{{MIX_POSTS}}

Mês: {{MES}}. Data Ref: {{DATA_HOJE}}.

DNA COMPLETO DA MARCA (Para consulta visual e de público):
{{DNA_DA_MARCA}}

DATAS COMEMORATIVAS:
{{DATAS_COMEMORATIVAS}}

DATOS COMPLEMENTARES:
{{PRODUTOS_FOCO}}

REGRAS OBRIGATÓRIAS:
{{REGRAS_OBRIGATORIAS}}

BRIEFING: "{{BRIEFING}}"

REFERÊNCIAS DO MÊS: {{REFERENCIAS_MES}}
CONTINUIDADE: {{CONTINUIDADE}}
DOCS EXTRAS: {{DOCS_EXTRAS}}

INSTRUÇÕES AVANÇADAS:
{{INSTRUCOES_AVANCADAS}}

INSTRUÇÕES POR FORMATO:
{{INSTRUCOES_POR_FORMATO}}

MUITO IMPORTANTE SOBRE CARROSSÉIS:
Se o formato escolhido para o dia FOR "Carrossel", voce DEVE, obrigatoriamente, descrever o "copy_inicial" e "instrucoes_visuais" divididos por slides (ex: [Slide 1] Titulo..., [Slide 2] Conteudo...). Alem disso, voce DEVE retornar o campo "legenda" com a legenda final do carrossel. A "legenda" nao pode vir dividida por slides. Nunca retorne um carrossel sem a divisao explicita de slides e sem a legenda final do post.

Retorne APENAS um JSON ARRAY PURO (sem markdown, sem texto extra antes ou depois):
[
  {
    "dia": 1,
    "tema": "...",
    "formato": "Reels",
    "instrucoes_visuais": "...",
    "copy_inicial": "...",
    "legenda": "...",
    "objetivo": "...",
    "cta": "...",
    "palavras_chave": ["...", "..."]
  }
]

REGRAS DO JSON:
- "dia" deve ser um número inteiro (1 a 31), representando o dia sugerido do mês.
- "formato" deve ser EXATAMENTE um de: Reels, Arte, Carrossel, Foto ou Story.
- Se o formato for "Carrossel", voce DEVE dividir "instrucoes_visuais" e "copy_inicial" em slides estruturados, usando EXATAMENTE a notacao [Slide 1] ..., [Slide 2] ...
- Se o formato for "Carrossel", voce DEVE retornar tambem o campo "legenda" com a legenda final do post, sem notacao de slides.
- "palavras_chave" deve ser um array com 3 a 5 strings não vazias.
- Todos os outros campos são strings obrigatórias e não podem ser vazias.
- Não repita o mesmo número de "dia" em dois posts diferentes.`;




const tryParseJsonCandidates = (text: string) => {
    const sanitize = (rawText: string) => {
        const withoutFences = String(rawText || "")
            .replace(/```json\s*/gi, "")
            .replace(/```/g, "")
            .trim();
        return withoutFences.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    };

    const cleanedText = sanitize(text);
    const candidates: string[] = [];

    const firstArray = cleanedText.indexOf("[");
    const lastArray = cleanedText.lastIndexOf("]");
    if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
        candidates.push(cleanedText.substring(firstArray, lastArray + 1));
    }

    const firstObj = cleanedText.indexOf("{");
    const lastObj = cleanedText.lastIndexOf("}");
    if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
        candidates.push(cleanedText.substring(firstObj, lastObj + 1));
    }

    candidates.push(cleanedText);

    let lastParseError: any = null;
    const failedCandidates: string[] = [];

    for (const cand of candidates) {
        try {
            return { parsed: JSON.parse(cand), failedCandidates };
        } catch (e: any) {
            lastParseError = e;
            failedCandidates.push(cand);
        }
    }

    const error = new Error(`N?o foi poss?vel interpretar JSON retornado pela IA. Erro final: ${lastParseError?.message}`) as Error & { failedCandidates?: string[]; parseMessage?: string };
    error.failedCandidates = failedCandidates;
    error.parseMessage = lastParseError?.message || "Erro desconhecido de parse";
    throw error;
};

const attemptJsonRepair = async (rawText: string, apiKey: string, clienteId: string) => {
    const modelsToTry = getGeminiModelCandidates("fast");
    const genAI = new GoogleGenerativeAI(apiKey);

    const repairPrompt = [
        "Voc? ? um reparador de JSON estrito.",
        "Corrija o JSON abaixo para que ele fique sintaticamente v?lido.",
        "Preserve a estrutura, o idioma, a quantidade de itens e o conte?do sem?ntico.",
        "N?o adicione coment?rios, markdown ou texto extra.",
        "Retorne APENAS JSON v?lido.",
        "",
        "JSON com erro:",
        rawText,
    ].join("\n");

    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: "application/json" }
            });

            const result = await Promise.race([
                model.generateContent(repairPrompt),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout no reparo JSON")), 25000))
            ]);

            const usageMetadata = result.response.usageMetadata;
            if (usageMetadata) {
                await updateTokenUsage(clienteId, usageMetadata, "calendar_json_repair", modelName);
            }

            const repaired = result.response.text();
            if (repaired && repaired.trim()) {
                return repaired;
            }
        } catch (_repairErr) {
            // tenta o pr?ximo modelo
        }
    }

    return null;
};

const cleanAndParseJSON = async (text: string, apiKey?: string, clienteId?: string) => {
    try {
        return tryParseJsonCandidates(text).parsed;
    } catch (parseError: any) {
        console.error("? [LLM JSON PARSE ERROR] Detalhes do erro de parsing:");
        console.error("- ?ltimo erro de parse:", parseError?.parseMessage || parseError?.message);

        const failedCandidates = Array.isArray(parseError?.failedCandidates) ? parseError.failedCandidates : [];
        const longest = failedCandidates.length > 0
            ? failedCandidates.reduce((a: string, b: string) => a.length > b.length ? a : b)
            : String(text || "");

        if (longest) {
            console.error(`- Tamanho da string: ${longest.length} chars`);
            console.error(`- Snippet (in?cio): ${longest.substring(0, 300)}`);
            console.error(`- Snippet (fim): ...${longest.substring(Math.max(0, longest.length - 300))}`);
        }

        if (apiKey && clienteId && longest) {
            console.warn("?? [LLM JSON PARSE ERROR] Tentando reparo autom?tico do JSON...");
            const repaired = await attemptJsonRepair(longest, apiKey, clienteId);
            if (repaired) {
                try {
                    return tryParseJsonCandidates(repaired).parsed;
                } catch (repairParseError: any) {
                    console.error("? [LLM JSON REPAIR ERROR] O reparo retornou JSON ainda inv?lido:", repairParseError?.parseMessage || repairParseError?.message);
                }
            }
        }

        throw parseError;
    }
};

const distributeMixAcrossMonths = (baseMix: any, monthsCountToDistribute: number): any[] => {
    const safeMonths = Math.max(1, monthsCountToDistribute || 1);
    const keys = ["reels", "static", "carousel", "stories", "photos"] as const;

    const result: any[] = Array.from({ length: safeMonths }, () => ({
        reels: 0,
        static: 0,
        carousel: 0,
        stories: 0,
        photos: 0,
    }));

    for (const k of keys) {
        const total = Math.max(0, parseInt(String(baseMix?.[k] ?? 0), 10) || 0);
        const base = Math.floor(total / safeMonths);
        let remainder = total % safeMonths;
        for (let i = 0; i < safeMonths; i++) {
            result[i][k] = base + (remainder > 0 ? 1 : 0);
            if (remainder > 0) remainder--;
        }
    }

    return result;
};

// --- Funções Auxiliares de Datas Comemorativas (Copiadas/Adaptadas do Controller) ---

async function syncFeriadosBrasilApi(anoNum: number): Promise<void> {
    try {
        const url = `https://brasilapi.com.br/api/feriados/v1/${anoNum}`;
        const resp = await fetch(url);
        if (!resp.ok) return;
        const data = (await resp.json()) as Array<{ date: string; name: string }>;

        if (!Array.isArray(data)) return;

        for (const f of data) {
            if (!f?.date || !f?.name) continue;
            await db.query(
                `INSERT INTO datas_comemorativas (data, titulo, categorias, relevancia)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (data, titulo) DO NOTHING`,
                [f.date, f.name, JSON.stringify(["geral", "feriado"]), 10]
            );
        }
    } catch (_e) {
        // fallback silencioso
    }
}

const buildFallbackDatasResumoTexto = (mesNum: number, anoNum: number) => {
    // const niche = (nicheText || "").toLowerCase();
    const baseByMonth: Record<number, { day: number; title: string }[]> = {
        1: [{ day: 1, title: "Confraternização Universal" }],
        2: [],
        3: [{ day: 8, title: "Dia Internacional da Mulher" }],
        4: [{ day: 21, title: "Tiradentes" }],
        5: [{ day: 1, title: "Dia do Trabalho" }],
        6: [{ day: 12, title: "Dia dos Namorados" }],
        7: [],
        8: [{ day: 11, title: "Dia dos Pais (estimado)" }],
        9: [{ day: 7, title: "Independência do Brasil" }],
        10: [{ day: 12, title: "Dia das Crianças" }],
        11: [{ day: 2, title: "Finados" }, { day: 15, title: "Proclamação da República" }],
        12: [{ day: 25, title: "Natal" }, { day: 31, title: "Réveillon" }],
    };

    const list = baseByMonth[mesNum] || [];
    if (list.length === 0) return "";

    const monthStr = String(mesNum).padStart(2, "0");
    return list
        .map((d) => `- ${String(d.day).padStart(2, "0")}/${monthStr}/${anoNum}: ${d.title}`)
        .join("\n");
};

const buildDatasResumoTextoForMes = async (mesLabel: string, briefing: string, branding: any, categoriasNicho: string[]): Promise<string> => {
    let datasResumoTexto = "";
    if (mesLabel && typeof mesLabel === "string") {
        try {
            const parts = mesLabel.trim().split(" ");
            if (parts.length < 2) return ""; // impossível extrair ano

            const possibleYear = parts[parts.length - 1] ?? "";
            const anoNum = parseInt(possibleYear, 10);
            if (isNaN(anoNum)) return "";

            const mesNome = parts.slice(0, -1).join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const mapaMeses: Record<string, number> = {
                janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
                julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
            };
            const mesNum = mapaMeses[mesNome];

            const keywordsText = Array.isArray(branding?.keywords) ? branding.keywords.join(", ") : "";
            const nicheText = `${briefing || ""} ${branding.tone_of_voice || ""} ${branding.audience || ""} ${keywordsText}`;

            // Inferência simples
            const categoriasInferidas: string[] = [];
            const nicheLower = nicheText.toLowerCase();
            if (nicheLower.includes("saude") || nicheLower.includes("clinica")) categoriasInferidas.push("saude");
            if (nicheLower.includes("fitness") || nicheLower.includes("treino")) categoriasInferidas.push("fitness");

            const categoriasParaBusca = Array.from(new Set([...(categoriasNicho || []), ...categoriasInferidas, "geral", "feriado"])).filter(Boolean);

            if (mesNum && anoNum) {
                await syncFeriadosBrasilApi(anoNum);

                try {
                    const whereCategorias = categoriasParaBusca.length > 0 ? "AND categorias ?| $3" : "";
                    const params: any[] = [mesNum, anoNum];
                    if (categoriasParaBusca.length > 0) params.push(categoriasParaBusca);

                    const datasResult = await db.query(
                        `SELECT data::text as data, titulo, categorias, relevancia, descricao
             FROM datas_comemorativas
             WHERE EXTRACT(MONTH FROM data) = $1 AND EXTRACT(YEAR FROM data) = $2
             ${whereCategorias}
             ORDER BY data ASC, relevancia DESC`,
                        params
                    );

                    if (datasResult.rows.length > 0) {
                        datasResumoTexto = datasResult.rows.map((d: any) => {
                            const raw = String(d.data || "").slice(0, 10);
                            const partsDate = raw.split("-");
                            const dia = (partsDate[2] || "").padStart(2, "0");
                            const descricao = d.descricao ? ` | contexto: ${String(d.descricao).trim()}` : "";
                            return `- ${dia}/${String(mesNum).padStart(2, "0")}/${anoNum}: ${d.titulo}${descricao}`;
                        }).join("\n");
                    }
                } catch (_dbErr) {
                    // ignore
                }

                if (!datasResumoTexto) {
                    datasResumoTexto = buildFallbackDatasResumoTexto(mesNum, anoNum);
                }
            }
        } catch (_e) {
            // ignore
        }
    }
    return datasResumoTexto;
};

// --- Função Principal do Service ---

interface GenerateMonthOptions {
    jobId: string;
    clienteId: string;
    mesToGenerate: string;
    mixForThisMonth: any;
    branding: any;
    briefing: string;
    rules: string;
    docsResumo: string;
    formatInstructions: any;
    monthReferences: string;
    continuityContext: string;
    periodoFinal: number;
    effectiveGenerationPrompt: string;
    categoriasNicho: string[];
    produtosFocoIds?: string[];
    checkCancellation?: () => Promise<void>;
    onProgress?: (pct: number, step: string) => Promise<void>;
}

export const generateCalendarForMonth = async (opts: GenerateMonthOptions) => {
    const {
        jobId, clienteId, mesToGenerate, mixForThisMonth, branding, briefing,
        rules, docsResumo, formatInstructions, monthReferences, continuityContext,
        periodoFinal, effectiveGenerationPrompt, categoriasNicho, produtosFocoIds, checkCancellation, onProgress
    } = opts;

    const totalPostsForThisMonth =
        (mixForThisMonth.reels || 0) +
        (mixForThisMonth.static || 0) +
        (mixForThisMonth.carousel || 0) +
        (mixForThisMonth.stories || 0) +
        (mixForThisMonth.photos || 0);

    // Validar API Key
    if (!process.env.GOOGLE_API_KEY) {
        throw new Error("API Key do Google não encontrada.");
    }

    // Preparar textos de branding
    const toneText = typeof branding.tone_of_voice === "string" ? branding.tone_of_voice : JSON.stringify(branding.tone_of_voice);
    const visualText = typeof branding.visual_style === "string" ? branding.visual_style : JSON.stringify(branding.visual_style);
    const audienceText = typeof branding.audience === "string" ? branding.audience : JSON.stringify(branding.audience);
    const keywordsText = Array.isArray(branding.keywords) ? branding.keywords.join(", ") : branding.keywords || "";
    const arquetipoText = branding.archetype || "Não definido";
    const uspText = branding.usp || "Não definido";
    const antiPalavrasText = branding.anti_keywords || "Não definidas";
    const nichoText = categoriasNicho && categoriasNicho.length > 0 ? categoriasNicho.join(", ") : "Não definido";
    const hojeISO = new Date().toISOString().slice(0, 10);

    if (onProgress) await onProgress(15, "Buscando datas comemorativas e contexto...");

    // Buscar datas comemorativas
    const datasResumoTexto = await buildDatasResumoTextoForMes(mesToGenerate, briefing, branding, categoriasNicho);

    // Buscar Produtos em Foco (se houver IDs selecionados)
    let produtosFocoTexto = "";
    if (produtosFocoIds && produtosFocoIds.length > 0) {
        if (onProgress) await onProgress(20, "Buscando produtos/serviços selecionados...");
        try {
            // Postgres supports `= ANY($1)` para buscar arrays nativamente
            const produtosRes = await db.query(
                `SELECT nome, categoria, preco, descricao FROM produtos WHERE id = ANY($1) AND cliente_id = $2`,
                [produtosFocoIds, clienteId]
            );
            if (produtosRes.rows.length > 0) {
                produtosFocoTexto = "A CAMPANHA / CALENDÁRIO DESTE MÊS DEVE FOCAR NESTES PRODUTOS/SERVIÇOS EM ESPECÍFICO:\n";
                produtosFocoTexto += produtosRes.rows.map(p => {
                    const parts = [`- NOME: ${p.nome}`];
                    if (p.categoria) parts.push(`  CATEGORIA: ${p.categoria}`);
                    if (p.preco) parts.push(`  PREÇO: R$ ${p.preco}`);
                    if (p.descricao) parts.push(`  DETALHES/OFERTA: ${p.descricao}`);
                    return parts.join("\n");
                }).join("\n\n");
            }
        } catch (_err) {
            console.error("Erro ao puxar produtos_foco:", _err);
        }
    }

    const brandingSummary = [
        `- Tom: ${toneText}`,
        `- Visual: ${visualText}`,
        `- Publico: ${audienceText}`,
        `- Keywords: ${keywordsText}`,
        `- Arquetipo: ${arquetipoText}`,
        `- USP: ${uspText}`,
        `- Anti-palavras: ${antiPalavrasText}`,
    ].join("\n");

    let plannerModelName: string | null = null;
    let criticModelName: string | null = null;
    let historyContext = "";
    let groundedContext = "";
    let monthlyPlan: any = null;

    if (onProgress) await onProgress(28, "Planejando a estrategia mensal...");

    try {
        const planning = await planMonthlyCalendar({
            clienteId,
            apiKey: process.env.GOOGLE_API_KEY!,
            mes: mesToGenerate,
            mix: mixForThisMonth,
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
        });

        monthlyPlan = planning.plan;
        plannerModelName = planning.model;
        historyContext = planning.historyContext;
        groundedContext = planning.groundedContext;
    } catch (_planningError) {
        console.warn(`[Worker] Planner mensal falhou para ${mesToGenerate}. Seguindo com fallback estruturado.`);
        const fallbackSlots = buildSlotBlueprintFromMix(mixForThisMonth);
        monthlyPlan = {
            monthly_thesis: briefing || `Plano mensal para ${mesToGenerate}`,
            hero_campaign: produtosFocoTexto ? "Campanha focada em produtos priorizados" : "Campanha editorial com foco em autoridade",
            audience_tension: "Responder a dores e objecoes reais do publico da marca",
            priority_pillars: ["Autoridade", "Prova", "Conversao"],
            diversity_guardrails: ["Alternar formatos e intencoes de conteudo", "Evitar repetir o mesmo CTA em sequencia"],
            anti_genericity_rules: ["Toda ideia precisa de um angulo especifico da marca", "Evitar dicas obvias que servem para qualquer nicho"],
            must_reference_dates: [],
            slot_plan: fallbackSlots.map((slot: any) => ({
                ...slot,
                pilar: "Autoridade",
                angle: "Recorte especifico da marca",
                objective: "Gerar demanda qualificada",
                funnel_stage: "consideracao",
                product_focus: "",
                reason_why_now: "Conecta o timing do mes com uma necessidade real do publico",
                cta_direction: "Abrir conversa qualificada",
                proof_asset: "Usar repertorio, processo ou prova da marca",
                hook: "Abertura especifica e concreta",
            })),
        };
        historyContext = "Planner indisponivel; manter alta especificidade da marca e variedade de angulos.";
    }

    if (onProgress) await onProgress(30, "Montando engenharia do prompt...");

    // Buscar template ativo do banco (com fallback seguro)
    let promptBody: string;
    let templateSource = "hardcoded_fallback";
    let promptTemplateId: string | null = null;
    let promptTemplateVersion: number | null = null;
    let promptTemplateAgentId: string | null = null;
    let selectedAgentId: string | null = null;
    try {
        const agentResult = await db.query(
            "SELECT prompt_template_agent_id FROM clientes WHERE id = $1",
            [clienteId]
        );
        selectedAgentId = agentResult.rows[0]?.prompt_template_agent_id || null;
    } catch (_agentErr) {
        selectedAgentId = null;
    }

    const allowedAgents = new Set(["estrategista", "storyteller", "visionario", "custom"]);
    const agentIdToUse = allowedAgents.has(selectedAgentId || "") ? (selectedAgentId as string) : "estrategista";
    promptTemplateAgentId = agentIdToUse;
    try {
        const templateResult = await db.query(
            agentIdToUse === "custom"
                ? `SELECT id, version, body, cliente_id, agent_id FROM prompt_templates
                   WHERE cliente_id = $1 AND agent_id = 'custom' AND is_active = true
                   ORDER BY updated_at DESC NULLS LAST, created_at DESC
                   LIMIT 1`
                : `SELECT id, version, body, cliente_id, agent_id FROM prompt_templates
                   WHERE cliente_id IS NULL AND agent_id = $1 AND is_active = true
                   ORDER BY updated_at DESC NULLS LAST, created_at DESC
                   LIMIT 1`,
            agentIdToUse === "custom" ? [clienteId] : [agentIdToUse]
        );
        if (templateResult.rows.length > 0) {
            const row = templateResult.rows[0];
            promptBody = row.body;
            promptTemplateId = row.id;
            promptTemplateVersion = row.version;
            promptTemplateAgentId = row.agent_id || agentIdToUse;
            templateSource = row.cliente_id ? "cliente" : "global";
        } else {
            promptBody = HARDCODED_TEMPLATE_FALLBACK;
        }
    } catch (_templateErr) {
        console.warn(`⚠️ [Worker] Falha ao buscar template do banco, usando fallback.`);
        promptBody = HARDCODED_TEMPLATE_FALLBACK;
    }
    const mixPostsText = [
        mixForThisMonth.reels ? `- ${mixForThisMonth.reels} roteiros de REELS.` : null,
        mixForThisMonth.static ? `- ${mixForThisMonth.static} posts no formato ARTE (estático).` : null,
        mixForThisMonth.carousel ? `- ${mixForThisMonth.carousel} posts no formato CARROSSEL.` : null,
        mixForThisMonth.stories ? `- ${mixForThisMonth.stories} sequências de STORY.` : null,
        mixForThisMonth.photos ? `- ${mixForThisMonth.photos} posts no formato FOTO.` : null,
        `Total: ${totalPostsForThisMonth}.`,
    ].filter(Boolean).join("\n");

    const formatInstructionsText = [
        `- Reels: ${formatInstructions?.reels || '-'}`,
        `- Arte: ${formatInstructions?.static || '-'}`,
        `- Carrossel: ${formatInstructions?.carousel || '-'}`,
        `- Story: ${formatInstructions?.stories || '-'}`,
        `- Foto: ${formatInstructions?.photos || '-'}`,
    ].join("\n");

    const tokenMap: Record<string, string> = {
        MIX_POSTS: mixPostsText,
        MES: mesToGenerate,
        DATA_HOJE: hojeISO,
        ARQUETIPO: arquetipoText,
        NICHO: nichoText,
        DIFERENCIAL_USP: uspText,
        ANTI_PALAVRAS: antiPalavrasText,
        TOM_DE_VOZ: toneText,
        DNA_DA_MARCA: `- Tom: ${toneText}\n- Visual: ${visualText}\n- Público: ${audienceText}\n- Keywords: ${keywordsText}\n- Arquétipo: ${arquetipoText}\n- USP: ${uspText}\n- Anti-palavras: ${antiPalavrasText}`,
        DATAS_COMEMORATIVAS: datasResumoTexto || "Sem datas.",
        REGRAS_OBRIGATORIAS: rules || "Nenhuma regra cadastrada.",
        BRIEFING: briefing,
        REFERENCIAS_MES: monthReferences || "Nenhuma",
        CONTINUIDADE: continuityContext || "Primeiro mês.",
        DOCS_EXTRAS: docsResumo || "",
        INSTRUCOES_AVANCADAS: effectiveGenerationPrompt || "Use seu melhor julgamento estratégico.",
        INSTRUCOES_POR_FORMATO: formatInstructionsText,
        PRODUTOS_FOCO: produtosFocoTexto,
    };

    const basePrompt = promptBody.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => tokenMap[k] ?? `{{${k}}}`);
    const prompt = `${basePrompt}

PLANO MENSAL ESTRUTURADO (siga estes slots ao compor os posts finais):
${JSON.stringify(monthlyPlan, null, 2)}

HISTORICO DE PERFORMANCE RELEVANTE:
${historyContext || "Sem historico disponivel."}

GANCHOS CONFIRMADOS VIA GOOGLE SEARCH GROUNDING:
${groundedContext || "Nenhum adicional."}

CONTRATO FINAL DE SAIDA (OBRIGATORIO, MESMO QUE O TEMPLATE ATIVO DIGA OUTRA COISA):
- Cada item do array DEVE conter exatamente estes campos: "dia", "tema", "formato", "instrucoes_visuais", "copy_inicial", "legenda", "objetivo", "cta", "palavras_chave".
- Para Carrossel, "copy_inicial" = texto dos slides, "instrucoes_visuais" = direcao visual por slide e "legenda" = legenda final do post.
- A "legenda" do Carrossel e obrigatoria e nao pode repetir a notacao [Slide X].

REGRAS FINAIS DE EXECUCAO:
- Respeite o slot_plan e o suggested_day como prioridade.
- Cada post precisa refletir um angulo especifico da marca.
- Evite repetir CTA, promessa ou estrutura de abertura.
- Para Carrossel, use "copy_inicial" como texto dos slides, "instrucoes_visuais" como direcao visual dos slides e "legenda" como a legenda final do post.
- Em Carrossel, a "legenda" e obrigatoria e nao pode repetir a notacao [Slide X].`;

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const modelsToTry = getGeminiModelCandidates("fast");

    let responseText = "";
    let usedModelName: string | null = null;
    let lastError: any = null;

    for (const modelName of modelsToTry) {
        try {
            // Check cancellation before request
            if (checkCancellation) await checkCancellation();

            console.log(`🤖 [Worker] Tentando modelo ${modelName} para ${mesToGenerate}...`);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: "application/json" }
            });
            // Timeout de 60s para cada chamada
            const timeoutMs = 60000;
            if (onProgress) await onProgress(45, `Processando no cérebro da IA (${modelName})...`);

            const result = await Promise.race([
                model.generateContent(prompt),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout na geração")), timeoutMs))
            ]);

            if (onProgress) await onProgress(70, "Resposta recebida, interpretando resultados...");
            responseText = result.response.text();
            usedModelName = modelName;

            const usageMetadata = result.response.usageMetadata;
            if (usageMetadata) {
                await updateTokenUsage(clienteId, usageMetadata, "calendar_generation_worker", modelName);
            }
            break;
        } catch (e: any) {
            // Check cancellation also on error/retry
            if (checkCancellation) {
                try { await checkCancellation(); } catch (cancelErr) { throw cancelErr; }
            }

            lastError = e;
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    if (!responseText) {
        throw new Error(`Falha na geração IA: ${lastError?.message || 'Sem resposta'}`);
    }

    let calendarData = await cleanAndParseJSON(responseText, process.env.GOOGLE_API_KEY, clienteId);
    calendarData = ensureCarouselLegendas(calendarData);

    if (Array.isArray(calendarData)) {
        if (onProgress) await onProgress(73, "Refinando o calendario com critica anti-genericidade...");
        try {
            const critique = await critiqueCalendarDraft({
                clienteId,
                apiKey: process.env.GOOGLE_API_KEY!,
                mes: mesToGenerate,
                historyContext,
                monthlyPlan,
                calendarData,
            });
            if (Array.isArray(critique.calendar) && critique.calendar.length > 0) {
                calendarData = ensureCarouselLegendas(critique.calendar);
                criticModelName = critique.model;
            }
        } catch (_criticError) {
            console.warn(`[Worker] Critic mensal falhou para ${mesToGenerate}. Mantendo draft original.`);
        }
    }

    // ── VALIDAÇÃO RUNTIME DO CONTRATO CANÔNICO ───────────────────────────────
    if (onProgress) await onProgress(75, "Validando formato do calendário gerado...");

    // Passa o JSON parseado pelo validador rigoroso
    const validation = validateCalendarSchema(calendarData);
    if (!validation.isValid) {
        // Loga no servidor (stdout) para debug / auditoria
        console.error(`❌ [Worker ERROR] Falha na validação do LLM Output (Correlation ID: ${validation.correlationId})
  Job: ${jobId} | Cliente: ${clienteId} | Template: ${promptTemplateId || 'N/A'} (v${promptTemplateVersion || 'N/A'})
  Detalhes: ${validation.errors.join("; ")}
  Snippet: ${responseText.substring(0, 300).replace(/\n/g, ' ')}...
`);

        // Lança erro customizado estruturado
        throw new InvalidCalendarOutputError(validation.errors, validation.correlationId);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Deduplicação básica (já mantemos do fluxo legado, mas adaptado)
    if (Array.isArray(calendarData)) {
        const seen = new Set<string>();
        calendarData = calendarData.filter((post: any) => {
            const key = `${post.data}|${post.tema}|${post.formato}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, totalPostsForThisMonth);
    }

    // Salvar como DRAFT
    const mesFinal = mesToGenerate || "Geral";
    const metadata = {
        month_references: monthReferences || null,
        format_instructions: formatInstructions || null,
        worker_job_id: jobId,
        // Rastreabilidade do prompt usado
        prompt_template_id: promptTemplateId,
        prompt_template_version: promptTemplateVersion,
        prompt_template_source: templateSource,
        prompt_template_agent_id: promptTemplateAgentId,
        // Auditoria de valicação do schema (PR5)
        output_schema_version: "v1_canonic",
        output_validation: { ok: true },
        planner_model: plannerModelName,
        critic_model: criticModelName,
        strategy_brief: monthlyPlan ? {
            monthly_thesis: monthlyPlan.monthly_thesis || null,
            hero_campaign: monthlyPlan.hero_campaign || null,
            priority_pillars: monthlyPlan.priority_pillars || [],
            diversity_guardrails: monthlyPlan.diversity_guardrails || [],
            anti_genericity_rules: monthlyPlan.anti_genericity_rules || [],
        } : null
    };

    if (onProgress) await onProgress(85, "Salvando calendário e posts no banco de dados...");

    const saved = await db.query(
        `INSERT INTO calendarios
     (cliente_id, mes, calendario_json, periodo, metadata, status, generation_job_id)
     VALUES ($1, $2, $3, $4, $5, 'draft', $6)
     RETURNING id`,
        [clienteId, mesFinal, JSON.stringify(calendarData), periodoFinal, metadata, jobId]
    );

    const calendarId: string = saved.rows[0].id;

    // Populando calendar_items para tracking de aprovação/revisões/publicação
    if (Array.isArray(calendarData) && calendarData.length > 0) {
        try {
            for (const post of calendarData) {
                // Aceita tanto dia:number (schema canônico) quanto data:"DD/MM" (legado)
                let dia: number = 0;
                if (typeof post.dia === 'number' && post.dia >= 1 && post.dia <= 31) {
                    dia = post.dia;
                } else if (typeof post.data === 'string') {
                    dia = parseInt(post.data.split('/')[0] ?? '0', 10);
                }
                if (!dia || dia < 1 || dia > 31) continue;

                await db.query(
                    `INSERT INTO calendar_items (cliente_id, calendario_id, dia, tema, formato)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [clienteId, calendarId, dia, post.tema || '', post.formato || '']
                );
            }
            console.log(`✅ [Worker] ${calendarData.length} calendar_items criados para calendário ${calendarId}`);
        } catch (itemsErr: any) {
            // Não falhar a geração por causa dos items — a funcionalidade principal é o calendário
            console.warn(`⚠️ [Worker] Falha ao criar calendar_items (não-crítico): ${itemsErr.message}`);
        }
    }

    return {
        calendarId,
        mes: mesFinal,
        model: criticModelName || usedModelName || plannerModelName,
        postsCount: Array.isArray(calendarData) ? calendarData.length : 0,
        calendarData // return data to help context usage for next month
    };
};

export { distributeMixAcrossMonths };









