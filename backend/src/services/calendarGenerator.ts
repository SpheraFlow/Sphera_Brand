import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../config/database";
import { updateTokenUsage } from "../utils/tokenTracker";
import { validateCalendarSchema, InvalidCalendarOutputError } from "../utils/calendarValidator";

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
Se o formato escolhido para o dia FOR "Carrossel", você DEVE, obrigatoriamente, descrever o "copy_inicial" e "instrucoes_visuais" divididos por slides (ex: [Slide 1] Título..., [Slide 2] Conteúdo...). Nunca retorne um carrossel sem a divisão explícita de slides.

Retorne APENAS um JSON ARRAY PURO (sem markdown, sem texto extra antes ou depois):
[
  {
    "dia": 1,
    "tema": "...",
    "formato": "Reels",
    "instrucoes_visuais": "...",
    "copy_inicial": "...",
    "objetivo": "...",
    "cta": "...",
    "palavras_chave": ["...", "..."]
  }
]

REGRAS DO JSON:
- "dia" deve ser um número inteiro (1 a 31), representando o dia sugerido do mês.
- "formato" deve ser EXATAMENTE um de: Reels, Arte, Carrossel, Foto ou Story.
- Se o formato for "Carrossel", você DEVE dividir "instrucoes_visuais" e "copy_inicial" em slides estruturados, usando EXATAMENTE a notação [Slide 1] ..., [Slide 2] ...
- "palavras_chave" deve ser um array com 3 a 5 strings não vazias.
- Todos os outros campos são strings obrigatórias e não podem ser vazias.
- Não repita o mesmo número de "dia" em dois posts diferentes.`;




const cleanAndParseJSON = (text: string) => {
    const sanitize = (rawText: string) => {
        const withoutFences = String(rawText || "")
            .replace(/```json\s */gi, "")
            .replace(/```/g, "")
            .trim();
        // Remove caracteres de controle que quebram JSON
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
    let failedCandidates: string[] = [];

    for (const cand of candidates) {
        try {
            return JSON.parse(cand);
        } catch (e: any) {
            lastParseError = e;
            failedCandidates.push(cand);
        }
    }

    console.error("❌ [LLM JSON PARSE ERROR] Detalhes do erro de parsing:");
    console.error("- Último erro de parse:", lastParseError?.message);
    if (failedCandidates.length > 0) {
        const longest = failedCandidates.reduce((a, b) => a.length > b.length ? a : b);
        console.error(`- Tamanho da string: ${longest.length} chars`);
        console.error(`- Snippet (início): ${longest.substring(0, 300)}`);
        console.error(`- Snippet (fim): ...${longest.substring(longest.length - 300)}`);
        // Opcional: imprimir a string toda se for pequeno o bastante
        // console.error(`- String completa:`, longest);
    }

    throw new Error(`Não foi possível interpretar JSON retornado pela IA. Erro final: ${lastParseError?.message}`);
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

            const mesNome = parts.slice(0, -1).join(" ").toLowerCase();
            const mapaMeses: Record<string, number> = {
                janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
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
                            return `- ${dia}/${String(mesNum).padStart(2, "0")}/${anoNum}: ${d.titulo}`;
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

    if (onProgress) await onProgress(30, "Montando engenharia do prompt...");

    // Buscar template ativo do banco (com fallback seguro)
    let promptBody: string;
    let templateSource = "hardcoded_fallback";
    let promptTemplateId: string | null = null;
    let promptTemplateVersion: number | null = null;
    try {
        const templateResult = await db.query(
            `SELECT id, version, body, cliente_id FROM prompt_templates
             WHERE (cliente_id = $1 OR cliente_id IS NULL) AND is_active = true
             ORDER BY (cliente_id IS NOT NULL) DESC
             LIMIT 1`,
            [clienteId]
        );
        if (templateResult.rows.length > 0) {
            const row = templateResult.rows[0];
            promptBody = row.body;
            promptTemplateId = row.id;
            promptTemplateVersion = row.version;
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

    const prompt = promptBody.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => tokenMap[k] ?? `{{${k}}}`);

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];

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

    let calendarData = cleanAndParseJSON(responseText);

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
        // Auditoria de valicação do schema (PR5)
        output_schema_version: "v1_canonic",
        output_validation: { ok: true }
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
        model: usedModelName,
        postsCount: Array.isArray(calendarData) ? calendarData.length : 0,
        calendarData // return data to help context usage for next month
    };
};

export { distributeMixAcrossMonths };
