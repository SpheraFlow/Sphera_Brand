import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../config/database";
import { updateTokenUsage } from "../utils/tokenTracker";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const router = Router();

// Utilitário simples de substituição de variáveis em templates de prompt
const applyTemplate = (template: string, vars: Record<string, any>): string => {
  return template.replace(/{{\s*([a-zA-Z0-9_\.]+)\s*}}/g, (_match, key) => {
    const value = vars[key];
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  });
};

async function syncFeriadosBrasilApi(anoNum: number): Promise<void> {
  // Fonte: BrasilAPI (sem chave): https://brasilapi.com.br/api/feriados/v1/{ano}
  // Armazena no banco para evitar depender de rede em todas as gerações.
  try {
    const url = `https://brasilapi.com.br/api/feriados/v1/${anoNum}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return;
    }
    const data = (await resp.json()) as Array<{ date: string; name: string; type?: string }>; // date: YYYY-MM-DD

    if (!Array.isArray(data) || data.length === 0) return;

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
    // Se falhar, seguimos com fallback local
  }
}

// POST /api/datas-comemorativas/sync?ano=2026
// Sincroniza feriados nacionais via internet (BrasilAPI) para o banco.
router.post("/datas-comemorativas/sync", async (req: Request, res: Response) => {
  try {
    const ano = parseInt(String(req.query.ano || ""), 10);
    if (!ano || Number.isNaN(ano)) {
      return res.status(400).json({ success: false, error: "Informe o parâmetro ?ano=YYYY" });
    }

    await syncFeriadosBrasilApi(ano);
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || "Erro ao sincronizar" });
  }
});

const buildFallbackDatasResumoTexto = (mesNum: number, anoNum: number, nicheText: string) => {
  const niche = (nicheText || "").toLowerCase();

  const baseByMonth: Record<number, { day: number; title: string }[]> = {
    1: [
      { day: 1, title: "Confraternização Universal" },
      { day: 30, title: "Dia da Saudade" },
    ],
    2: [
      { day: 4, title: "Dia Mundial do Câncer" },
    ],
    3: [
      { day: 8, title: "Dia Internacional da Mulher" },
      { day: 20, title: "Início do Outono" },
    ],
    4: [
      { day: 7, title: "Dia Mundial da Saúde" },
      { day: 22, title: "Dia da Terra" },
    ],
    5: [
      { day: 1, title: "Dia do Trabalho" },
    ],
    6: [
      { day: 12, title: "Dia dos Namorados" },
      { day: 21, title: "Início do Inverno" },
    ],
    7: [
      { day: 20, title: "Dia do Amigo" },
      { day: 26, title: "Dia dos Avós" },
    ],
    8: [
      { day: 11, title: "Dia dos Pais" },
      { day: 27, title: "Dia do Psicólogo" },
    ],
    9: [
      { day: 7, title: "Independência do Brasil" },
      { day: 23, title: "Início da Primavera" },
    ],
    10: [
      { day: 12, title: "Dia das Crianças" },
      { day: 31, title: "Halloween" },
    ],
    11: [
      { day: 2, title: "Finados" },
      { day: 15, title: "Proclamação da República" },
    ],
    12: [
      { day: 24, title: "Véspera de Natal" },
      { day: 25, title: "Natal" },
      { day: 31, title: "Réveillon" },
    ],
  };

  const nicheExtra: { day: number; title: string }[] = [];
  if (niche.includes("treino") || niche.includes("academ") || niche.includes("fitness") || niche.includes("corrida") || niche.includes("esporte")) {
    nicheExtra.push({ day: 6, title: "Dia Nacional do Esporte" });
    nicheExtra.push({ day: 7, title: "Dia Mundial da Saúde" });
  }
  if (niche.includes("saúde") || niche.includes("saude") || niche.includes("clínica") || niche.includes("clinica") || niche.includes("terapia") || niche.includes("psico")) {
    nicheExtra.push({ day: 10, title: "Dia Mundial da Saúde Mental" });
    nicheExtra.push({ day: 27, title: "Dia Nacional de Combate ao Câncer" });
  }

  const list = [...(baseByMonth[mesNum] || []), ...nicheExtra];
  if (list.length === 0) return "";

  const monthStr = String(mesNum).padStart(2, "0");
  return list
    .map((d) => `- ${String(d.day).padStart(2, "0")}/${monthStr}/${anoNum}: ${d.title}`)
    .join("\n");
};

router.post("/generate-calendar", async (req: Request, res: Response) => {
  console.log("\n🛑 [DEBUG] ROTA /generate-calendar ACIONADA");
  console.log(`📦 [DEBUG] Payload completo:`, JSON.stringify(req.body, null, 2));

  try {
    const { clienteId, briefing, mes, periodo, mix, generationPrompt, chainId, formatInstructions, monthReferences } = req.body;

    console.log(`➡️ [DEBUG] Cliente ID: ${clienteId}`);
    console.log(`➡️ [DEBUG] Briefing: ${briefing}`);
    if (generationPrompt) {
      console.log(`➡️ [DEBUG] Prompt avançado do usuário: ${generationPrompt}`);
    }

    // Buscar Branding
    console.log("🔍 [DEBUG] Buscando branding...");
    const brandingResult = await db.query("SELECT * FROM branding WHERE cliente_id = $1", [clienteId]);
    let branding = brandingResult.rows[0];

    // Buscar categorias/nicho do cliente (se houver)
    let categoriasNicho: string[] = [];
    try {
      const clientRes = await db.query(
        "SELECT categorias_nicho FROM clientes WHERE id = $1",
        [clienteId]
      );
      const raw = clientRes.rows?.[0]?.categorias_nicho;
      if (Array.isArray(raw)) {
        categoriasNicho = raw.map((c: any) => String(c).trim()).filter(Boolean);
      }
    } catch (_e) {
      categoriasNicho = [];
    }

    if (!branding) {
      console.log("⚠️ [DEBUG] Branding não encontrado. Usando Fallback.");
      branding = {
        visual_style: "Padrão",
        tone_of_voice: "Neutro",
        audience: "Geral"
      };
      
      // Se não tiver branding e nem briefing, aborta
      if (!briefing) {
        console.error("❌ [ERRO] Sem branding e sem briefing.");
        return res.status(400).json({ error: "É necessário fornecer um briefing ou ter branding analisado." });
      }
    }

    // variável para armazenar o contexto final vindo da Prompt Chain (se houver)
    let chainOutputFinal: string | null = null;

    // 2.1 Se chainId foi fornecido, executar a Prompt Chain antes de montar o prompt principal
    if (chainId) {
      console.log("🤖 [DEBUG] Executando Prompt Chain antes da geração do calendário...");
      try {
        const chainResult = await db.query(
          "SELECT * FROM prompt_chains WHERE id = $1",
          [chainId]
        );

        if (chainResult.rows.length === 0) {
          console.warn("⚠️ [DEBUG] Prompt Chain não encontrada para id:", chainId);
        } else {
          const chain = chainResult.rows[0];
          const steps: any[] = (chain.steps || []).sort(
            (a: any, b: any) => (a.order || 0) - (b.order || 0)
          );

          const genAIForChain = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
          const stepOutputs: string[] = [];

          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const tmpl: string = step.prompt_template || "";
            const filledPrompt = applyTemplate(tmpl, {
              branding,
              briefing: briefing || "",
              mes: mes || "",
              mix,
              step_1_output: stepOutputs[0],
              step_2_output: stepOutputs[1],
              step_3_output: stepOutputs[2],
              previous_output: stepOutputs[stepOutputs.length - 1],
            });

            console.log(`🤖 [DEBUG] Executando step ${i + 1} da chain...`);
            const model = genAIForChain.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(filledPrompt);
            const text = result.response.text();
            console.log(
              `✅ [DEBUG] Step ${i + 1} concluído. Tamanho do output:`,
              text.length
            );
            stepOutputs.push(text);
          }

          if (stepOutputs.length > 0) {
            const lastOutput = stepOutputs[stepOutputs.length - 1] ?? "";
            chainOutputFinal = lastOutput;
          }
        }
      } catch (chainError) {
        console.error("❌ [ERRO] Falha ao executar Prompt Chain:", chainError);
      }
    }

    console.log(`➡️ [DEBUG] Mês: "${mes}"`);
    console.log(`➡️ [DEBUG] Mix de Conteúdo:`, mix);
    console.log(`➡️ [DEBUG] Instruções por formato:`, formatInstructions);
    console.log(`➡️ [DEBUG] Referências do mês:`, monthReferences);
    if (chainId) {
      console.log(`➡️ [DEBUG] Prompt Chain selecionada: ${chainId}`);
    }

    // Validar se o mix foi fornecido e tem conteúdo válido
    if (!mix || typeof mix !== 'object') {
      console.error("❌ [ERRO] Mix de conteúdo não fornecido ou inválido:", mix);
      return res.status(400).json({ error: "Mix de conteúdo é obrigatório." });
    }

    // Calcular total de posts e validar
    const totalPosts = (mix.reels || 0) + (mix.static || 0) + (mix.carousel || 0) + (mix.stories || 0) + (mix.photos || 0);

    console.log(`📊 [DEBUG] Cálculo: reels=${mix.reels}, static=${mix.static}, carousel=${mix.carousel}, stories=${mix.stories}, photos=${mix.photos}, total=${totalPosts}`);

    if (totalPosts === 0) {
      console.error("❌ [ERRO] Total de posts deve ser maior que 0");
      return res.status(400).json({ error: "Selecione pelo menos 1 tipo de conteúdo." });
    }

    console.log(`✅ [DEBUG] Total de posts a gerar: ${totalPosts}`);

    const periodoFinal = typeof periodo === 'number' ? periodo : 30;

    // 1.1 Buscar datas comemorativas do mês (se mês for fornecido em formato 'MMMM yyyy')
    let datasResumoTexto = "";
    if (mes && typeof mes === "string") {
      try {
        // Extrair mês numérico e ano a partir de 'MMMM yyyy'
        const parts = mes.trim().split(" ");

        // Garantir que temos pelo menos duas partes (nome do mês + ano)
        if (parts.length < 2) {
          console.warn("⚠️ [DEBUG] Formato de 'mes' inesperado para datas comemorativas:", mes);
          throw new Error("Formato de mês inválido para extração de ano.");
        }

        const possibleYear = parts[parts.length - 1] ?? "";
        const anoNum = parseInt(possibleYear, 10);

        if (isNaN(anoNum)) {
          console.warn("⚠️ [DEBUG] Ano inválido em 'mes' ao buscar datas comemorativas:", possibleYear);
          throw new Error("Ano inválido em 'mes'.");
        }

        const mesNome = parts.slice(0, -1).join(" ").toLowerCase();

        const mapaMeses: Record<string, number> = {
          janeiro: 1,
          fevereiro: 2,
          marco: 3,
          março: 3,
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

        const mesNum = mapaMeses[mesNome];

        const keywordsTextForNiche = Array.isArray(branding?.keywords)
          ? branding.keywords.join(", ")
          : branding?.keywords || "";
        const nicheText = `${briefing || ""} ${branding.tone_of_voice || ""} ${branding.audience || ""} ${keywordsTextForNiche}`;

        // Fallback: se o cliente não tiver nicho definido, inferir algumas categorias simples pelas keywords/briefing
        const categoriasInferidas: string[] = [];
        const nicheLower = nicheText.toLowerCase();
        if (nicheLower.includes("saude") || nicheLower.includes("saúde") || nicheLower.includes("clinica") || nicheLower.includes("clínica") || nicheLower.includes("medic") || nicheLower.includes("nutri")) {
          categoriasInferidas.push("saude");
        }
        if (nicheLower.includes("fitness") || nicheLower.includes("academ") || nicheLower.includes("treino") || nicheLower.includes("corrida") || nicheLower.includes("cross") || nicheLower.includes("pilates")) {
          categoriasInferidas.push("fitness");
        }
        if (nicheLower.includes("kids") || nicheLower.includes("crian") || nicheLower.includes("pediatr") || nicheLower.includes("escola") || nicheLower.includes("infantil")) {
          categoriasInferidas.push("kids");
        }
        if (nicheLower.includes("psico") || nicheLower.includes("terapia") || nicheLower.includes("saude mental") || nicheLower.includes("saúde mental")) {
          categoriasInferidas.push("psicologia");
        }

        const categoriasParaBusca = Array.from(
          new Set([
            ...(categoriasNicho || []),
            ...(categoriasInferidas || []),
            "geral",
            "feriado",
          ])
        ).filter(Boolean);

        if (mesNum && anoNum) {
          // 0) Melhor esforço: busca na internet (cache no banco)
          await syncFeriadosBrasilApi(anoNum);

          console.log(`📅 [DEBUG] Buscando datas comemorativas para ${mesNum}/${anoNum}...`);
          try {
            const whereCategorias = categoriasParaBusca.length > 0 ? "AND categorias ?| $3" : "";
            const params: any[] = [mesNum, anoNum];
            if (categoriasParaBusca.length > 0) params.push(categoriasParaBusca);

            const datasResult = await db.query(
              `SELECT data, titulo, categorias, relevancia FROM datas_comemorativas
               WHERE EXTRACT(MONTH FROM data) = $1 AND EXTRACT(YEAR FROM data) = $2
               ${whereCategorias}
               ORDER BY data ASC, relevancia DESC`,
              params
            );

            if (datasResult.rows.length > 0) {
              datasResumoTexto = datasResult.rows
                .map((d: any) => {
                  const dt = new Date(d.data);
                  const dia = dt.getDate().toString().padStart(2, "0");
                  const mesNumStr = (dt.getMonth() + 1).toString().padStart(2, "0");
                  const cats = Array.isArray(d.categorias) ? d.categorias.join(", ") : "";
                  return `- ${dia}/${mesNumStr}/${anoNum}: ${d.titulo}${cats ? ` (categorias: ${cats})` : ""}`;
                })
                .join("\n");
              console.log(`✅ [DEBUG] ${datasResult.rows.length} datas comemorativas encontradas para o mês.`);
            }
          } catch (dbDatasError: any) {
            datasResumoTexto = "";
          }

          if (!datasResumoTexto) {
            datasResumoTexto = buildFallbackDatasResumoTexto(mesNum, anoNum, nicheText);
          }
        }
      } catch (e) {
        console.warn("⚠️ [DEBUG] Falha ao buscar datas comemorativas:", e);
      }
    }

    // 1. Validar API Key
    if (!process.env.GOOGLE_API_KEY) {
      console.error("❌ [ERRO] API Key do Google não encontrada no .env");
      return res.status(500).json({ error: "Configuração de IA ausente." });
    }
    console.log("✅ [DEBUG] API Key detectada.");

    // 3. Buscar Regras (Knowledge)
    console.log("🔍 [DEBUG] Buscando regras da marca...");
    const rulesResult = await db.query("SELECT regra FROM brand_rules WHERE cliente_id = $1 AND ativa = true", [clienteId]);
    const rules = rulesResult.rows.map((r: any) => `- ${r.regra}`).join("\n");
    console.log(`✅ [DEBUG] ${rulesResult.rows.length} regras encontradas.`);

    // 4. Buscar documentos de DNA da marca (brand_docs)
    console.log("🔍 [DEBUG] Buscando documentos de DNA da marca...");
    const docsResult = await db.query(
      "SELECT tipo, conteudo_texto FROM brand_docs WHERE cliente_id = $1",
      [clienteId]
    );
    const docsResumo = docsResult.rows
      .map((d: any) => `- (${d.tipo}) ${d.conteudo_texto}`)
      .join("\n");
    console.log(`✅ [DEBUG] ${docsResult.rows.length} documentos de DNA encontrados.`);

    // 5. Normalizar campos de branding (JSONB) para texto legível
    const toneText =
      typeof branding.tone_of_voice === "string"
        ? branding.tone_of_voice
        : JSON.stringify(branding.tone_of_voice);
    const visualText =
      typeof branding.visual_style === "string"
        ? branding.visual_style
        : JSON.stringify(branding.visual_style);
    const audienceText =
      typeof branding.audience === "string"
        ? branding.audience
        : JSON.stringify(branding.audience);
    const keywordsText = Array.isArray(branding.keywords)
      ? branding.keywords.join(", ")
      : branding.keywords || "";

    // 5.1 Construir generationPrompt efetivo combinando Prompt Chain (se houver)
    let effectiveGenerationPrompt = generationPrompt || "";
    if (chainOutputFinal) {
      effectiveGenerationPrompt = `${effectiveGenerationPrompt}\n\n# Contexto gerado pela Prompt Chain:\n${chainOutputFinal}`;
    }

    // 6. Montar Prompt
    console.log("🤖 [DEBUG] Montando prompt determinístico para o Gemini com DNA de marca enriquecido...");
    const hojeISO = new Date().toISOString().slice(0, 10);
    const prompt = `
      Atue como Strategist Planner.

      Crie um Planejamento de Conteúdo contendo EXATAMENTE esta quantidade de posts (nem mais, nem menos):

      - ${mix.reels || 0} roteiros de REELS (Vídeo vertical, dinâmico).
      - ${mix.static || 0} posts ESTÁTICOS (Imagem única).
      - ${mix.carousel || 0} CARROSSÉIS (Conteúdo denso/lista).
      - ${mix.stories || 0} sequências de STORIES.
      - ${mix.photos || 0} IDEIAS DE FOTOS (Conceitos visuais para sessões fotográficas).

      Total de itens: ${totalPosts}.

      INSTRUÇÃO DE DISTRIBUIÇÃO:
      Distribua esses ${totalPosts} posts ao longo do mês de ${mes || "Próximo Mês"} de forma lógica e espaçada (ex: terças e quintas, ou a cada 2 dias). Não agrupe tudo no dia 1.

      DNA DA MARCA (use isso como referência principal, acima de qualquer suposição genérica):
      - Tom de Voz (detalhado): ${toneText}
      - Estilo Visual (diretrizes): ${visualText}
      - Público-Alvo (personas, dores, desejos): ${audienceText}
      - Palavras-chave estratégicas: ${keywordsText}

      INSTRUÇÕES ESPECÍFICAS POR FORMATO (quando fornecidas):
      - Reels: ${formatInstructions?.reels || 'Sem instruções adicionais para Reels.'}
      - Posts estáticos: ${formatInstructions?.static || 'Sem instruções adicionais para posts estáticos.'}
      - Carrosséis: ${formatInstructions?.carousel || 'Sem instruções adicionais para carrosséis.'}
      - Stories: ${formatInstructions?.stories || 'Sem instruções adicionais para Stories.'}
      - Ideias de Fotos: ${formatInstructions?.photos || 'Para ideias de fotos, foque em conceitos visuais criativos, locações, ângulos, iluminação e mood. Seja específico e técnico para orientar fotógrafos.'}

      DATAS COMEMORATIVAS/RELEVANTES DO MÊS (use como base obrigatória):
      ${datasResumoTexto || 'Sem lista prévia. Você DEVE levantar datas relevantes reais do mês e usá-las no planejamento.'}

      DATA ATUAL (referência): ${hojeISO}

      REGRA DE PRIORIZAÇÃO (muito importante):
      - Priorize datas relevantes que ocorram nas próximas 2-3 semanas a partir da DATA ATUAL, quando isso fizer sentido para o mês alvo.
      - Se o mês alvo não for o mês atual, priorize as datas relevantes dentro do mês alvo e distribua os posts de forma equilibrada.

      REGRA OBRIGATÓRIA SOBRE DATAS:
      - Inclua no mínimo 4 posts ancorados em datas comemorativas/relevantes reais do mês e coerentes com o nicho do cliente.
      - O campo "tema" deve mencionar a data/evento (ex: "Janeiro Branco: ..." / "Dia Mundial da Saúde: ...").

      DOCUMENTOS DA MARCA (resumo de guias, posicionamento, manifesto, etc):
      ${docsResumo || 'Nenhum documento adicional cadastrado. Use apenas o DNA e o briefing acima.'}

      REGRAS OBRIGATÓRIAS (Não viole em hipótese alguma):
      ${rules}

      BRIEFING DO CLIENTE (contexto tático desta leva de conteúdos):
      "${briefing || 'Foco em engajamento e autoridade.'}"

      REFERÊNCIAS GERAIS PARA ESTE MÊS (links, campanhas anteriores, benchmarks, etc.):
      ${monthReferences || 'Nenhuma referência específica fornecida para este mês.'}

      INSTRUÇÕES AVANÇADAS DO ESTRATEGISTA (se fornecidas pelo usuário ou pela Prompt Chain):
      ${effectiveGenerationPrompt || 'Use seu melhor julgamento estratégico mantendo consistência com o DNA de marca e as regras acima.'}

      INSTRUÇÃO ESPECIAL PARA PROMPTS DE ARTE:
      Para cada post, gere também um campo 'image_generation_prompt' técnico para ferramentas de IA generativa (Midjourney, DALL-E, etc.).

      Este prompt deve seguir esta estrutura específica:
      '[Descrição detalhada da cena/conteúdo] + [Estilo visual da marca (use as diretrizes acima)] + [Paleta de cores predominante alinhada ao branding] + [Iluminação e mood adequados ao tema] + [Composição e ângulo apropriados]'.

      Seja específico, técnico e pronto para uso direto. Escreva em inglês para compatibilidade com ferramentas de IA.

      Retorne APENAS um JSON puro (sem markdown) com este formato array:
      [
        {
          "data": "DD/MM",
          "tema": "...",
          "formato": "Reels/Carrossel/Static/Stories/Photos",
          "ideia_visual": "...",
          "copy_sugestao": "...",
          "objetivo": "...",
          "image_generation_prompt": "..."
        }
      ]

      IMPORTANTE: Para formato 'Photos', seja ainda mais detalhado no campo 'ideia_visual' incluindo: locação, ângulo, iluminação, composição, props, vestuário e mood desejado.
    `;

    // 5. Chamar Gemini (com fallback robusto)
    console.log("🚀 [DEBUG] Enviando para Gemini...");
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    
    let result;
    let responseText = ""; // Inicializado para evitar erro de TS

    // Lista de modelos para tentar em ordem
    const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    
    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 [DEBUG] Tentando modelo: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(prompt);
        responseText = result.response.text();
        
        // Log de uso de tokens
        const usageMetadata = result.response.usageMetadata;
        if (usageMetadata) {
          console.log(`📊 [TOKENS] Modelo: ${modelName}`);
          console.log(`📊 [TOKENS] Prompt Tokens: ${usageMetadata.promptTokenCount || 0}`);
          console.log(`📊 [TOKENS] Completion Tokens: ${usageMetadata.candidatesTokenCount || 0}`);
          console.log(`📊 [TOKENS] Total Tokens: ${usageMetadata.totalTokenCount || 0}`);
          
          // Atualizar contador de tokens do cliente
          await updateTokenUsage(clienteId, usageMetadata, "calendar_generation", modelName);
        }
        
        console.log(`✅ [DEBUG] Resposta recebida do ${modelName} (tamanho: ${responseText.length})`);
        break; // Sucesso, sair do loop
      } catch (modelError: any) {
        console.warn(`⚠️ [DEBUG] ${modelName} falhou:`, modelError.message);
        
        // Se for o último modelo, lançar o erro
        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          throw new Error(`Todos os modelos falharam. Erro final: ${modelError.message}`);
        }
        
        console.log("⏳ [DEBUG] Aguardando 2s antes do próximo modelo...");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 6. Limpar e fazer parse do JSON (função robusta)
    const cleanAndParseJSON = (text: string) => {
      // 1. Tenta encontrar o primeiro '[' e o último ']'
      const firstBracket = text.indexOf('[');
      const lastBracket = text.lastIndexOf(']');
      
      if (firstBracket !== -1 && lastBracket !== -1) {
        const jsonCandidate = text.substring(firstBracket, lastBracket + 1);
        try {
          return JSON.parse(jsonCandidate);
        } catch (e) {
          console.error("⚠️ [DEBUG] Erro ao fazer parse do trecho extraído:", e);
        }
      }
      
      // 2. Fallback: Tenta limpar markdown comum
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    };

    console.log("🧹 [DEBUG] Limpando resposta do Gemini...");
    const rawCalendarData = cleanAndParseJSON(responseText);
    
    // Remover duplicatas e limitar ao total de posts
    let calendarData = rawCalendarData;
    if (Array.isArray(rawCalendarData)) {
      // Remover posts duplicados (mesma data + tema + formato)
      const seen = new Set();
      const uniquePosts = rawCalendarData.filter((post: any) => {
        const key = `${post.data}|${post.tema}|${post.formato}`;
        if (seen.has(key)) {
          console.log(`⚠️ [DEBUG] Post duplicado removido: ${post.data} - ${post.tema}`);
          return false;
        }
        seen.add(key);
        return true;
      });
      
      // Limitar ao total de posts solicitado
      calendarData = uniquePosts.slice(0, totalPosts);
      
      console.log(`✅ [DEBUG] Posts após remoção de duplicatas: ${uniquePosts.length}`);
      console.log(`✅ [DEBUG] Posts após limite (${totalPosts}): ${calendarData.length}`);
    } else {
      console.log("✅ [DEBUG] JSON parseado (não é array)");
    }

    // 7. Salvar no Banco
    console.log("💾 [DEBUG] Salvando no banco...");
    const mesFinal = mes || "Geral";
    console.log(`💾 [DEBUG] Mês que será salvo: "${mesFinal}"`);
    const metadata = {
      month_references: monthReferences || null,
      format_instructions: formatInstructions || null,
    };

    const saved = await db.query(
      "INSERT INTO calendarios (cliente_id, mes, calendario_json, periodo, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [clienteId, mesFinal, JSON.stringify(calendarData), periodoFinal, metadata]
    );

    console.log("🎉 [SUCESSO] Calendário gerado! ID: " + saved.rows[0].id);
    return res.json({ success: true, calendarId: saved.rows[0].id, data: calendarData });

  } catch (error: any) {
    console.error("❌ [ERRO FATAL DETALHADO]:", error);
    // Se for erro do Google, mostra detalhes
    if (error.response) console.error("Google Error Details:", error.response);
    
    return res.status(500).json({ 
      error: "Falha interna ao gerar calendário.", 
      details: error.message 
    });
  }
});

// POST /api/calendars/regenerate-post - Regenera um único post com IA
router.post("/calendars/regenerate-post", async (req: Request, res: Response) => {
  console.log("\n🤖 [DEBUG] ROTA /calendars/regenerate-post ACIONADA");
  console.log("📦 [DEBUG] Payload:", JSON.stringify(req.body, null, 2));

  try {
    const { calendarId, postIndex, newFormato, customPrompt } = req.body as {
      calendarId: string;
      postIndex: number;
      newFormato?: string;
      customPrompt?: string;
    };

    if (!calendarId || typeof postIndex !== "number") {
      return res.status(400).json({
        success: false,
        error: "calendarId e postIndex são obrigatórios.",
      });
    }

    if (!process.env.GOOGLE_API_KEY) {
      console.error("❌ [ERRO] API Key do Google não encontrada no .env");
      return res.status(500).json({ error: "Configuração de IA ausente." });
    }

    // Buscar calendário e cliente associado
    const calendarResult = await db.query(
      "SELECT id, cliente_id, mes, calendario_json FROM calendarios WHERE id = $1",
      [calendarId]
    );

    if (calendarResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Calendário não encontrado.",
      });
    }

    const calendar = calendarResult.rows[0];
    const posts = calendar.calendario_json;
    const index = postIndex;

    if (!Array.isArray(posts) || index < 0 || index >= posts.length) {
      return res.status(400).json({
        success: false,
        error: "Índice de post inválido.",
      });
    }

    const originalPost = posts[index];

    // Buscar branding
    const brandingResult = await db.query(
      "SELECT * FROM branding WHERE cliente_id = $1",
      [calendar.cliente_id]
    );
    let branding = brandingResult.rows[0];

    if (!branding) {
      branding = {
        visual_style: "Padrão",
        tone_of_voice: "Neutro",
        audience: "Geral",
      };
    }

    // Buscar regras
    const rulesResult = await db.query(
      "SELECT regra FROM brand_rules WHERE cliente_id = $1 AND ativa = true",
      [calendar.cliente_id]
    );
    const rules = rulesResult.rows.map((r: any) => `- ${r.regra}`).join("\n");

    const targetFormato = newFormato || originalPost.formato;

    // Montar prompt para regenerar um único post
    const regenPrompt = `
      Você é um estrategista de social media especialista em adaptação de conteúdo.

      Regere UM ÚNICO post para um calendário editorial, adaptando o conteúdo abaixo para o FORMATO: "${targetFormato}".

      CONTEXTO DA MARCA:
      - Tom de Voz: ${branding.tone_of_voice}
      - Estilo Visual: ${branding.visual_style}
      - Público: ${branding.audience}

      REGRAS OBRIGATÓRIAS (Não viole):
      ${rules}

      POST ATUAL (referência):
      {
        "data": "${originalPost.data}",
        "tema": "${originalPost.tema}",
        "formato": "${originalPost.formato}",
        "ideia_visual": "${originalPost.ideia_visual}",
        "copy_sugestao": "${originalPost.copy_sugestao}",
        "objetivo": "${originalPost.objetivo}",
        "image_generation_prompt": "${originalPost.image_generation_prompt || ""}"
      }

      INSTRUÇÕES DO ESTRATEGISTA (opcional):
      ${customPrompt || "Adapte o conteúdo para o novo formato mantendo a essência estratégica, mas otimizando copy, ideia visual e objetivo para aumentar desempenho."}

      SAÍDA ESPERADA:
      - Crie UMA ÚNICA SUGESTÃO DE POST no formato JSON, sem markdown, com exatamente estes campos:
      {
        "data": "DD/MM", // mantenha a mesma data do post original
        "tema": "...",
        "formato": "${targetFormato}",
        "ideia_visual": "...",
        "copy_sugestao": "...",
        "objetivo": "...",
        "image_generation_prompt": "..." // prompt técnico para IA de imagem
      }

      Não inclua explicações adicionais, apenas o JSON puro do objeto.
    `;

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

    let result;
    let responseText = "";

    // Lista de modelos para tentar em ordem (Fallback Robusto)
    const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    
    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 [DEBUG] Tentando modelo (regen): ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(regenPrompt);
        responseText = result.response.text();
        
        // Log de uso de tokens
        const usageMetadata = result.response.usageMetadata;
        if (usageMetadata) {
          console.log(`📊 [TOKENS REGEN] Modelo: ${modelName}`);
          console.log(`📊 [TOKENS REGEN] Prompt Tokens: ${usageMetadata.promptTokenCount || 0}`);
          console.log(`📊 [TOKENS REGEN] Completion Tokens: ${usageMetadata.candidatesTokenCount || 0}`);
          console.log(`📊 [TOKENS REGEN] Total Tokens: ${usageMetadata.totalTokenCount || 0}`);
          
          // Atualizar contador de tokens do cliente
          await updateTokenUsage(calendar.cliente_id, usageMetadata, "post_regeneration", modelName);
        }
        
        console.log(`✅ [DEBUG] Resposta recebida do ${modelName} (tamanho: ${responseText.length})`);
        break; // Sucesso
      } catch (modelError: any) {
        console.warn(`⚠️ [DEBUG] ${modelName} falhou em regen:`, modelError.message);
        
        if (modelName === modelsToTry[modelsToTry.length - 1]) {
           // Se foi o último, não tem mais o que fazer
           throw new Error(`Todos os modelos falharam em regen. Erro final: ${modelError.message}`);
        }
        
        console.log("⏳ [DEBUG] Aguardando 2s antes do próximo modelo...");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Tentar limpar e fazer parse do JSON de um único objeto
    const cleanJson = (text: string) => {
      const trimmed = text.trim();
      // Remover possíveis blocos de código markdown
      const cleaned = trimmed
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      // Tentar encontrar primeiro '{' e último '}'
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first !== -1 && last !== -1) {
        const candidate = cleaned.substring(first, last + 1);
        return JSON.parse(candidate);
      }

      return JSON.parse(cleaned);
    };

    const regeneratedPost = cleanJson(responseText);

    // Garantir que a data seja preservada se não vier
    if (!regeneratedPost.data) {
      regeneratedPost.data = originalPost.data;
    }

    // Atualizar o post no array local
    posts[index] = {
      ...originalPost,
      ...regeneratedPost,
    };

    // Persistir no banco
    await db.query(
      `UPDATE calendarios 
       SET calendario_json = $1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [JSON.stringify(posts), calendarId]
    );

    return res.json({
      success: true,
      post: posts[index],
    });
  } catch (error: any) {
    console.error("❌ Erro ao regenerar post com IA:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao regenerar post com IA.",
      details: error.message,
    });
  }
});


// GET /api/calendars/:clientId - Retorna calendário do mês atual ou o último
router.get("/calendars/:clientId", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { month } = req.query;

    console.log(`🔍 [DEBUG] Buscando calendário para cliente: ${clientId}, mês: ${month || 'último'}`);
    console.log(`🔍 [DEBUG] Tipo do month: ${typeof month}, valor: "${month}"`);

    let query;
    let params;

    if (month && typeof month === 'string') {
      // Buscar calendário específico do mês
      console.log(`🔍 [DEBUG] Buscando calendário específico do mês: "${month}"`);
      query = `
        SELECT id, cliente_id, mes, calendario_json, periodo, criado_em, updated_at, metadata
        FROM calendarios
        WHERE cliente_id = $1 AND mes = $2
        ORDER BY criado_em DESC
        LIMIT 1
      `;
      params = [clientId, month];
    } else {
      // Buscar último calendário
      query = `
        SELECT id, cliente_id, mes, calendario_json, periodo, criado_em, updated_at, metadata
        FROM calendarios
        WHERE cliente_id = $1
        ORDER BY criado_em DESC
        LIMIT 1
      `;
      params = [clientId];
    }

    console.log(`🔍 [DEBUG] Executando query: ${query}`);
    console.log(`🔍 [DEBUG] Parâmetros:`, params);

    const result = await db.query(query, params);

    console.log(`🔍 [DEBUG] Resultados encontrados: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log(`🔍 [DEBUG] Mês encontrado no banco: "${result.rows[0].mes}"`);
    }

    if (result.rows.length === 0) {
      console.log(`🔍 [DEBUG] Nenhum calendário encontrado`);
      return res.status(404).json({
        success: false,
        error: month ? `Nenhum calendário encontrado para ${month}.` : "Nenhum calendário encontrado para este cliente."
      });
    }

    const calendar = result.rows[0];

    return res.json({
      success: true,
      calendar: {
        id: calendar.id,
        clienteId: calendar.cliente_id,
        mes: calendar.mes,
        posts: calendar.calendario_json,
        periodo: calendar.periodo,
        metadata: calendar.metadata || {},
        createdAt: calendar.criado_em,
        updatedAt: calendar.updated_at
      }
    });
  } catch (error: any) {
    console.error("❌ Erro ao buscar calendário:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao buscar calendário.",
      ...(process.env.NODE_ENV !== "production" && error?.message
        ? { details: error.message }
        : {})
    });
  }
});

// PUT /api/calendars/:calendarId - Atualiza o calendário inteiro
router.put("/calendars/:calendarId", async (req: Request, res: Response) => {
  try {
    const { calendarId } = req.params;
    const { posts } = req.body;

    console.log(`💾 Atualizando calendário: ${calendarId}`);
    console.log(`📊 Total de posts recebidos: ${posts?.length || 0}`);

    if (!posts || !Array.isArray(posts)) {
      return res.status(400).json({
        success: false,
        error: "Campo 'posts' é obrigatório e deve ser um array."
      });
    }

    // Atualiza o JSON inteiro
    await db.query(
      `UPDATE calendarios 
       SET calendario_json = $1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [JSON.stringify(posts), calendarId]
    );

    console.log("✅ Calendário atualizado com sucesso");

    return res.json({
      success: true,
      message: "Calendário atualizado com sucesso."
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar calendário:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao atualizar calendário."
    });
  }
});

// PUT /api/calendars/post/:calendarId/:postIndex - Atualiza um post específico
router.put("/calendars/post/:calendarId/:postIndex", async (req: Request, res: Response) => {
  try {
    const { calendarId, postIndex } = req.params;
    const updatedPost = req.body;

    console.log(`✏️ Atualizando post ${postIndex} do calendário ${calendarId}`);

    if (!calendarId || !postIndex) {
      return res.status(400).json({
        success: false,
        error: "calendarId e postIndex são obrigatórios."
      });
    }

    // Buscar calendário atual
    const result = await db.query(
      "SELECT calendario_json FROM calendarios WHERE id = $1",
      [calendarId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Calendário não encontrado."
      });
    }

    const posts = result.rows[0].calendario_json;
    const index = parseInt(postIndex as string, 10);

    if (index < 0 || index >= posts.length) {
      return res.status(400).json({
        success: false,
        error: "Índice de post inválido."
      });
    }

    // Atualizar o post específico
    posts[index] = { ...posts[index], ...updatedPost };

    // Salvar de volta
    await db.query(
      `UPDATE calendarios 
       SET calendario_json = $1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [JSON.stringify(posts), calendarId]
    );

    console.log("✅ Post atualizado com sucesso");

    return res.json({
      success: true,
      message: "Post atualizado com sucesso.",
      post: posts[index]
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar post:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao atualizar post."
    });
  }
});

// DELETE /api/calendars/:clientId/:month - Exclui calendário completo do mês
router.delete("/calendars/:clientId/:month", async (req: Request, res: Response) => {
  try {
    const { clientId, month } = req.params;

    console.log(`🗑️ Excluindo calendário do mês ${month} para cliente: ${clientId}`);

    // Primeiro, buscar o calendário para confirmar que existe
    const result = await db.query(
      "SELECT id FROM calendarios WHERE cliente_id = $1 AND mes = $2",
      [clientId, month]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Calendário não encontrado para este mês."
      });
    }

    const calendarId = result.rows[0].id;

    // Excluir o calendário
    await db.query(
      "DELETE FROM calendarios WHERE id = $1",
      [calendarId]
    );

    console.log(`✅ Calendário ${calendarId} excluído com sucesso`);

    return res.json({
      success: true,
      message: "Calendário excluído com sucesso."
    });

  } catch (error) {
    console.error("❌ Erro ao excluir calendário:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao excluir calendário."
    });
  }
});

// PUT /api/calendars/:calendarId/metadata - Atualiza apenas o metadata do calendário
router.put("/calendars/:calendarId/metadata", async (req: Request, res: Response) => {
  try {
    const { calendarId } = req.params;
    const { month_references, format_instructions } = req.body;

    console.log(`📝 Atualizando metadata do calendário: ${calendarId}`);

    // Buscar metadata atual
    const result = await db.query(
      "SELECT metadata FROM calendarios WHERE id = $1",
      [calendarId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Calendário não encontrado."
      });
    }

    const currentMetadata = result.rows[0].metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      ...(month_references !== undefined && { month_references }),
      ...(format_instructions !== undefined && { format_instructions })
    };

    // Atualizar metadata
    await db.query(
      `UPDATE calendarios 
       SET metadata = $1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [JSON.stringify(updatedMetadata), calendarId]
    );

    console.log("✅ Metadata atualizado com sucesso");

    return res.json({
      success: true,
      message: "Metadata atualizado com sucesso.",
      metadata: updatedMetadata
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar metadata:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao atualizar metadata."
    });
  }
});

router.post("/calendars/export-excel", async (req: Request, res: Response): Promise<void> => {
  console.log("\n📊 [DEBUG] ROTA /export-excel ACIONADA");
  console.log("📦 [DEBUG] Payload:", JSON.stringify(req.body, null, 2));

  try {
    if (!req.is("application/json") || !req.body) {
      res.status(400).json({
        error: "Body JSON é obrigatório.",
        details: "Envie Content-Type: application/json e um JSON com { calendarId }"
      });
      return;
    }

    const { calendarId, clientName, monthsSelected } = (req.body ?? {}) as {
      calendarId?: string;
      clientName?: string;
      monthsSelected?: number[];
    };

    if (!calendarId) {
      res.status(400).json({ error: "calendarId é obrigatório." });
      return;
    }

    console.log(`🔍 [DEBUG] Buscando calendário ID: ${calendarId}`);
    const result = await db.query(
      "SELECT calendario_json, mes, cliente_id, periodo FROM calendarios WHERE id = $1",
      [calendarId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Calendário não encontrado" });
      return;
    }

    const calendar = result.rows[0];
    const posts = calendar.calendario_json;
    const monthLabel = calendar.mes || "Janeiro";
    const periodo = calendar.periodo;

    let resolvedClientName = (clientName as string) || "Cliente";
    try {
      if (calendar.cliente_id) {
        const clientResult = await db.query(
          "SELECT nome FROM clientes WHERE id = $1",
          [calendar.cliente_id]
        );
        const dbName = clientResult.rows?.[0]?.nome;
        if (dbName) {
          resolvedClientName = dbName;
        }
      }
    } catch (e) {
      // fallback
    }

    const yearMatch = String(monthLabel).match(/(\d{4})/);
    const year = yearMatch?.[1] || String(new Date().getFullYear());

    const sanitizeFilePart = (value: string): string => {
      return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "")
        .trim();
    };

    const backendDir = process.cwd();
    const projectDir = path.resolve(backendDir, "..");

    const pythonScript = path.resolve(backendDir, "python_gen", "calendar_to_excel.py");
    const templatePath = path.resolve(projectDir, "calendario", "CoreSport_Tri_2026.xlsx");
    const outputDir = path.resolve(projectDir, "calendario", "output");
    const safeClient = sanitizeFilePart(resolvedClientName || "Cliente") || "Cliente";
    const safeMonth = sanitizeFilePart(String(monthLabel).replace(/\s+/g, "_")) || "Mes";
    const outputFileName = `${safeClient}_${safeMonth}.xlsx`;
    const outputPath = path.join(outputDir, outputFileName);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 [DEBUG] Diretório criado: ${outputDir}`);
    }

    console.log(`🐍 [DEBUG] Executando Python script...`);
    console.log(`  Script: ${pythonScript}`);
    console.log(`  Template: ${templatePath}`);
    console.log(`  Output: ${outputPath}`);

    const detectMonths = (calendarPosts: any[]): number[] => {
      const months = new Set<number>();
      for (const p of calendarPosts || []) {
        const dateStr = String((p as any)?.data || "");
        const m = dateStr.match(/\b(\d{1,2})\/(\d{1,2})\b/);
        if (!m) continue;
        const monthStr = m?.[2];
        if (!monthStr) continue;
        const monthNum = parseInt(monthStr, 10);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          months.add(monthNum);
        }
      }
      return Array.from(months).sort((a, b) => a - b);
    };

    const monthsDetected = detectMonths(posts);
    const monthsToExport = Array.isArray(monthsSelected) && monthsSelected.length > 0
      ? monthsSelected
      : monthsDetected;

    const pythonProcess = spawn("python3", [
      pythonScript,
      JSON.stringify(posts),
      templatePath,
      outputPath,
      resolvedClientName,
      String(monthLabel),
      year,
      String(periodo || ""),
      JSON.stringify(monthsToExport)
    ]);

    let pythonOutput = "";
    let pythonError = "";

    pythonProcess.stdout.on("data", (data: any) => {
      const output = data.toString();
      pythonOutput += output;
      console.log(`[PYTHON] ${output.trim()}`);
    });

    pythonProcess.stderr.on("data", (data: any) => {
      const error = data.toString();
      pythonError += error;
      console.error(`[PYTHON ERROR] ${error.trim()}`);
    });

    pythonProcess.on("close", (code: any) => {
      if (code === 0) {
        console.log(`✅ [SUCCESS] Python script executado com sucesso`);

        if (fs.existsSync(outputPath)) {
          console.log(`📄 [DEBUG] Arquivo Excel criado: ${outputPath}`);

          res.download(outputPath, outputFileName, (err: any) => {
            if (err) {
              console.error(`❌ [ERROR] Erro ao enviar arquivo: ${err}`);
              if (!res.headersSent) {
                res.status(500).json({ error: "Erro ao enviar arquivo" });
              }
            } else {
              console.log(`✅ [SUCCESS] Arquivo enviado para download`);
            }
          });
        } else {
          console.error(`❌ [ERROR] Arquivo não foi criado: ${outputPath}`);
          res.status(500).json({
            error: "Arquivo Excel não foi gerado",
            details: pythonOutput
          });
        }
      } else {
        console.error(`❌ [ERROR] Python script falhou com código: ${code}`);
        res.status(500).json({
          error: "Erro ao gerar Excel",
          details: pythonError || pythonOutput
        });
      }
    });

    return;
  } catch (error: any) {
    console.error("❌ [ERRO FATAL] Erro ao exportar Excel:", error);
    res.status(500).json({
      error: "Falha interna ao exportar Excel.",
      details: error.message
    });
    return;
  }
});

export default router;