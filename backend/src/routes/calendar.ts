import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import db from "../config/database";
import { updateTokenUsage } from "../utils/tokenTracker";
import { getGeminiModelCandidates } from "../utils/googleModels";

const router = Router();



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

router.post("/generate-calendar", async (req: Request, res: Response) => {
  console.log("\n[DEBUG] ROTA /generate-calendar ACIONADA (Async Job)");

  try {
    const {
      clienteId,
      briefing,
      periodo,
      mix,
      generationPrompt, // Prompt adicional ou custom instructions
      chainId, // Se vier de uma Chain
      formatInstructions, // Instruções específicas por formato
      monthReferences, // Referências para o mês
      chainOutputFinal, // Contexto vindo de uma chain anterior
      mes, // Mês específico opcional (ex: "Janeiro 2024")
      produtosFocoIds // IDs dos produtos escolhidos
    } = req.body;

    // 1. Validar Inputs
    if (!clienteId) {
      return res.status(400).json({ error: "Client ID é obrigatório." });
    }

    // Normalização do Período
    let periodoFinal = 30;
    if (periodo === "quinzenal" || periodo === 15) periodoFinal = 15;
    if (periodo === "mensal" || periodo === 30) periodoFinal = 30;
    if (periodo === "trimestral" || periodo === 90) periodoFinal = 90;

    // Lógica de Meses
    let monthsToGenerate: string[] = [];

    if (req.body.monthsToGenerate && Array.isArray(req.body.monthsToGenerate) && req.body.monthsToGenerate.length > 0) {
      monthsToGenerate = req.body.monthsToGenerate;
      console.log(`�S& [DEBUG] Usando meses diretos do corpo da requisição:`, monthsToGenerate);
    } else {
      const buildMonthLabelList = (startMesLabel: string, count: number) => {
        const labels: string[] = [];
        try {
          const parts = startMesLabel.trim().split(" ");
          if (parts.length < 2) return [startMesLabel];

          const mesNome = (parts[0] || "").toLowerCase();
          const anoStr = parts[parts.length - 1] || "";
          const ano = parseInt(anoStr, 10);

          const map: Record<string, number> = {
            janeiro: 0, fevereiro: 1, marco: 2, "março": 2, abril: 3, maio: 4, junho: 5,
            julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
          };

          let currentMonthIdx = map[mesNome];
          let currentYear = ano;

          if (currentMonthIdx === undefined || isNaN(currentYear)) return [startMesLabel];

          for (let i = 0; i < count; i++) {
            const d = new Date(currentYear, currentMonthIdx + i, 1);
            const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(d);
            const monthNameCap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            const y = d.getFullYear();
            labels.push(`${monthNameCap} ${y}`);
          }
        } catch (_e) {
          labels.push(startMesLabel);
        }
        return labels;
      };

      if (mes && typeof mes === "string") {
        const count = periodoFinal === 90 ? 3 : 1;
        monthsToGenerate = buildMonthLabelList(mes, count);
      } else {
        const count = periodoFinal === 90 ? 3 : 1;
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        const mStr = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(d);
        const mCap = mStr.charAt(0).toUpperCase() + mStr.slice(1);
        const startLabel = `${mCap} ${d.getFullYear()}`;
        monthsToGenerate = buildMonthLabelList(startLabel, count);
      }
    }

    console.log(`�S& [DEBUG] Meses para geração:`, monthsToGenerate);

    // GUARDRAIL: Validar limites de geração massiva
    const MAX_POSTS_PER_MONTH = 25;
    const MAX_MONTHS = 6;
    const mixTotal = mix
      ? (Number(mix.reels) || 0) + (Number(mix.static) || 0) + (Number(mix.carousel) || 0) + (Number(mix.stories) || 0) + (Number(mix.photos) || 0)
      : 35;
    if (mixTotal > MAX_POSTS_PER_MONTH) {
      return res.status(400).json({
        success: false,
        error: `Limite excedido: máximo ${MAX_POSTS_PER_MONTH} posts por mês. Mix solicitado: ${mixTotal} posts. Reduza a quantidade de posts e tente novamente.`,
      });
    }
    if (monthsToGenerate.length > MAX_MONTHS) {
      return res.status(400).json({
        success: false,
        error: `Limite excedido: máximo ${MAX_MONTHS} meses por geração. Solicitado: ${monthsToGenerate.length} meses.`,
      });
    }

    // CRIA�!ÒO DO JOB
    const { randomUUID } = await import('crypto');
    const jobId = randomUUID();

    const jobPayload = {
      clienteId,
      briefing,
      periodo: periodoFinal,
      mix,
      monthlyMix: req.body.monthlyMix || null,
      monthlyBriefings: req.body.monthlyBriefings || null,
      generationPrompt,
      chainId,
      formatInstructions,
      monthReferences,
      monthsToGenerate,
      chainOutputFinal,
      produtosFocoIds
    };

    console.log(`�xa� [JOB] Criando job ${jobId} para cliente ${clienteId}`);

    await db.query(`
      INSERT INTO calendar_generation_jobs (
        id, cliente_id, status, progress, payload, created_at
      ) VALUES ($1, $2, 'pending', 0, $3, NOW())
    `, [jobId, clienteId, JSON.stringify(jobPayload)]);

    return res.status(202).json({
      success: true,
      message: "Geração iniciada em background.",
      jobId,
      monthsToGenerate
    });

  } catch (error: any) {
    console.error("�R Erro ao iniciar job:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao iniciar job.",
      details: error.message,
    });
  }
});

// PUT /api/calendars/regenerate-post - Regenera um post específico do calendário
router.put("/calendars/regenerate-post", async (req: Request, res: Response) => {
  try {
    const { calendarId, postIndex, slideCount, newFormato, customPrompt } = req.body as {
      calendarId: string;
      postIndex: number;
      slideCount?: string;
      newFormato?: string;
      customPrompt?: string;
    };

    if (!calendarId || typeof postIndex !== "number") {
      return res.status(400).json({
        success: false,
        error: "calendarId e postIndex são obrigatórios.",
      });
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
    const targetFormato = newFormato || originalPost.formato;

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

    const carouselRule = targetFormato.toLowerCase() === 'carrossel'
      ? (slideCount && slideCount !== 'auto'
        ? `\n\nObrigatorio para Carrosseis: retorne a legenda final em "copy_sugestao" e divida o campo "texto_slides" em exatamente ${slideCount} slides estruturados do tipo [Slide 1] ..., [Slide 2] ...`
        : `\n\nObrigatorio para Carrosseis: retorne a legenda final em "copy_sugestao" e divida o campo "texto_slides" em slides estruturados do tipo [Slide 1] ..., [Slide 2] ...`)
      : '';

    // Montar prompt para regenerar um unico post
    const regenPrompt = `
      Voce e um estrategista de social media especialista em adaptacao de conteudo.

      Regere UM UNICO post para um calendario editorial, adaptando o conteudo abaixo para o FORMATO: "${targetFormato}".

      CONTEXTO DA MARCA:
      - Tom de Voz: ${branding.tone_of_voice}
    - Estilo Visual: ${branding.visual_style}
    - Publico: ${branding.audience}

      REGRAS OBRIGATORIAS (Nao viole):
      ${rules}

      POST ATUAL (referencia):
      {
        "data": "${originalPost.data}",
        "tema": "${originalPost.tema}",
        "formato": "${originalPost.formato}",
        "ideia_visual": "${originalPost.ideia_visual}",
        "copy_sugestao": "${originalPost.legenda || originalPost.copy_sugestao || ""}",
        "texto_slides": "${originalPost.texto_slides || originalPost.copy_inicial || ""}",
        "objetivo": "${originalPost.objetivo}",
        "image_generation_prompt": "${originalPost.image_generation_prompt || ""}"
      }

      INSTRUCOES DO ESTRATEGISTA (opcional/adicional):
      Adapte o conteudo para o novo formato mantendo a essencia estrategica, mas otimizando copy, ideia visual e objetivo para aumentar desempenho.
      INSTRUCOES ESPECIFICAS DO USUARIO: ${customPrompt || "Nenhuma instrucao extra."}${carouselRule}

      SAIDA ESPERADA:
      - Crie UMA UNICA SUGESTAO DE POST no formato JSON, sem markdown, com exatamente estes campos:
      {
        "data": "DD/MM", // mantenha a mesma data do post original
        "tema": "...",
        "formato": "${targetFormato}",
        "ideia_visual": "...",
        "copy_sugestao": "...", // legenda final do post
        "texto_slides": "...", // se for Carrossel, texto estruturado dos slides
        "objetivo": "...",
        "image_generation_prompt": "..." // prompt tecnico para IA de imagem
      }

      Se o formato for Carrossel, "ideia_visual" tambem deve vir estruturado em slides.
      Nao inclua explicacoes adicionais, apenas o JSON puro do objeto.
    `;

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

    let result;
    let responseText = "";

    // Lista de modelos para tentar em ordem (Fallback Robusto)
    const modelsToTry = getGeminiModelCandidates("quality");

    for (const modelName of modelsToTry) {
      try {
        console.log(`[DEBUG] Tentando modelo(regen): ${modelName}...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" }
        });
        result = await model.generateContent(regenPrompt);
        responseText = result.response.text();

        // Log de uso de tokens
        const usageMetadata = result.response.usageMetadata;
        if (usageMetadata) {
          console.log(`[TOKENS REGEN] Modelo: ${modelName}`);
          console.log(`[TOKENS REGEN] Prompt Tokens: ${usageMetadata.promptTokenCount || 0}`);
          console.log(`[TOKENS REGEN] Completion Tokens: ${usageMetadata.candidatesTokenCount || 0}`);
          console.log(`[TOKENS REGEN] Total Tokens: ${usageMetadata.totalTokenCount || 0}`);

          // Atualizar contador de tokens do cliente
          await updateTokenUsage(calendar.cliente_id, usageMetadata, "post_regeneration", modelName);
        }

        console.log(`�S&[DEBUG] Resposta recebida do ${modelName}(tamanho: ${responseText.length})`);
        break; // Sucesso
      } catch (modelError: any) {
        console.warn(`�a�️[DEBUG] ${modelName} falhou em regen: `, modelError.message);

        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          // Se foi o último, não tem mais o que fazer
          throw new Error(`Todos os modelos falharam em regen.Erro final: ${modelError.message} `);
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
        .replace(/```json\s*/gi, "")
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
    posts[index] = { ...originalPost, ...regeneratedPost };

    // Persistir no banco
    await db.query(
      `UPDATE calendarios 
       SET calendario_json = $1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [JSON.stringify(posts), calendarId]
    );

    console.log("�S& Post atualizado com sucesso");

    return res.json({
      success: true,
      post: posts[index],
    });
  } catch (error: any) {
    console.error("�R Erro ao regenerar post com IA:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao regenerar post com IA.",
      details: error.message,
    });
  }
});

// GET /api/calendars/:clientId/list - Lista todos os calendários de um cliente (para CampaignsList)
router.get("/calendars/:clientId/list", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const includeDrafts = req.query.includeDrafts === 'true';

    let statusFilter = "AND status = 'published'";
    if (includeDrafts) statusFilter = "";

    const result = await db.query(`
      SELECT 
        c.id,
        c.mes,
        c.periodo,
        c.status,
        c.criado_em,
        c.updated_at,
        c.generation_job_id,
        jsonb_array_length(c.calendario_json::jsonb) AS posts_count,
        j.status AS job_status,
        j.current_step AS job_step
      FROM calendarios c
      LEFT JOIN calendar_generation_jobs j ON j.id = c.generation_job_id
      WHERE c.cliente_id = $1 ${statusFilter}
      ORDER BY c.criado_em DESC
      LIMIT 50
    `, [clientId]);

    return res.json({
      success: true,
      calendars: result.rows.map(r => ({
        id: r.id,
        mes: r.mes,
        periodo: r.periodo,
        status: r.status,
        postsCount: parseInt(r.posts_count) || 0,
        criadoEm: r.criado_em,
        updatedAt: r.updated_at,
        jobId: r.generation_job_id,
        jobStatus: r.job_status,
        jobStep: r.job_step
      }))
    });
  } catch (error: any) {
    console.error("�R Erro ao listar calendários:", error);
    return res.status(500).json({ success: false, error: "Erro ao listar calendários." });
  }
});

// GET /api/calendars/:clientId - Retorna calendário do mês atual ou o último
router.get("/calendars/:clientId", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { month } = req.query;

    console.log(`[DEBUG] Buscando calend?rio para cliente: ${clientId}, m?s: ${month || '?ltimo'}`);
    console.log(`[DEBUG] Tipo do month: ${typeof month}, valor: "${month}"`);

    let query;
    let params;

    const includeDrafts = req.query.includeDrafts === 'true';

    // Base params
    params = [clientId];
    let statusFilter = "AND status = 'published'";
    if (includeDrafts) {
      statusFilter = ""; // Traz tudo (draft e published)
    }

    if (month && typeof month === 'string') {
      // Buscar calendário específico do mês
      // Normaliza o mês removendo preposições (ex: 'Agosto de 2026' == 'Agosto 2026')
      // para compatibilidade entre Intl.DateTimeFormat e date-fns
      console.log(`[DEBUG] Buscando calend?rio espec?fico do m?s: "${month}" (includeDrafts=${includeDrafts})`);
      query = `
        SELECT id, cliente_id, mes, calendario_json, periodo, criado_em, updated_at, metadata, status
        FROM calendarios
        WHERE cliente_id = $1
          AND LOWER(REGEXP_REPLACE(mes, '\\s+(de|do|da)\\s+', ' ', 'gi')) =
              LOWER(REGEXP_REPLACE($2, '\\s+(de|do|da)\\s+', ' ', 'gi'))
          ${statusFilter}
        ORDER BY criado_em DESC
        LIMIT 1
      `;
      params = [clientId, month];
    } else {
      // Buscar último calendário
      query = `
        SELECT id, cliente_id, mes, calendario_json, periodo, criado_em, updated_at, metadata, status
        FROM calendarios
        WHERE cliente_id = $1 ${statusFilter}
        ORDER BY criado_em DESC
        LIMIT 1
      `;
      params = [clientId];
    }

    console.log(`[DEBUG] Executando query: ${query}`);
    console.log(`[DEBUG] Par?metros:`, params);

    const result = await db.query(query, params);

    console.log(`[DEBUG] Resultados encontrados: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log(`[DEBUG] M?s encontrado no banco: "${result.rows[0].mes}"`);
    }

    if (result.rows.length === 0) {
      console.log(`[DEBUG] Nenhum calend?rio encontrado`);
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
        updatedAt: calendar.updated_at,
        status: calendar.status
      }
    });
  } catch (error: any) {
    console.error("�R Erro ao buscar calendário:", error);
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

    console.log(`[INFO] Atualizando calend?rio: ${calendarId}`);
    console.log(`[INFO] Total de posts recebidos: ${posts?.length || 0}`);

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

    console.log("�S& Calendário atualizado com sucesso");

    return res.json({
      success: true,
      message: "Calendário atualizado com sucesso."
    });
  } catch (error) {
    console.error("�R Erro ao atualizar calendário:", error);
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

    console.log(`�S�️ Atualizando post ${postIndex} do calendário ${calendarId}`);

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

    console.log("�S& Post atualizado com sucesso");

    return res.json({
      success: true,
      message: "Post atualizado com sucesso.",
      post: posts[index]
    });
  } catch (error) {
    console.error("�R Erro ao atualizar post:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao atualizar post."
    });
  }
});

// DELETE /api/calendars/post/:calendarId/:postIndex - Exclui um post específico
router.delete("/calendars/post/:calendarId/:postIndex", async (req: Request, res: Response) => {
  try {
    const { calendarId, postIndex } = req.params;

    console.log(`[INFO] Excluindo post ${postIndex} do calend?rio ${calendarId}`);

    if (!calendarId || !postIndex) {
      return res.status(400).json({
        success: false,
        error: "calendarId e postIndex são obrigatórios."
      });
    }

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

    // Remove o post
    posts.splice(index, 1);

    await db.query(
      `UPDATE calendarios 
       SET calendario_json = $1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [JSON.stringify(posts), calendarId]
    );

    console.log("�S& Post excluído com sucesso");

    return res.json({
      success: true,
      message: "Post excluído com sucesso."
    });
  } catch (error) {
    console.error("�R Erro ao excluir post:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao excluir post."
    });
  }
});

// DELETE /api/calendars/:clientId/:month - Exclui calendário completo do mês
router.delete("/calendars/:clientId/:month", async (req: Request, res: Response) => {
  try {
    const { clientId, month } = req.params;

    const includeDrafts = req.query.includeDrafts === 'true';

    console.log(`[INFO] Excluindo calend?rio do m?s ${month} para cliente: ${clientId} (includeDrafts=${includeDrafts})`);

    let query = "SELECT id FROM calendarios WHERE cliente_id = $1 AND LOWER(mes) = LOWER($2) AND status = 'published'";
    if (includeDrafts) {
      query = "SELECT id FROM calendarios WHERE cliente_id = $1 AND LOWER(mes) = LOWER($2)";
    }

    // Primeiro, buscar o calendário para confirmar que existe e validar status
    const result = await db.query(query, [clientId, month]);

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

    console.log(`�S& Calendário ${calendarId} excluído com sucesso`);

    return res.json({
      success: true,
      message: "Calendário excluído com sucesso."
    });

  } catch (error) {
    console.error("�R Erro ao excluir calendário:", error);
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

    console.log(`[INFO] Atualizando metadata do calend?rio: ${calendarId}`);

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

    console.log("�S& Metadata atualizado com sucesso");

    return res.json({
      success: true,
      message: "Metadata atualizado com sucesso.",
      metadata: updatedMetadata
    });
  } catch (error) {
    console.error(" Erro ao atualizar metadata:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao atualizar metadata.",
    });
  }
});

router.post("/calendars/export-excel", async (req: Request, res: Response): Promise<void> => {
  try {
    const { calendarId, clientName, monthsSelected } = (req.body ?? {}) as {
      calendarId?: string;
      clientName?: string;
      monthsSelected?: number[];
    };

    if (!calendarId) {
      res.status(400).json({ error: "calendarId é obrigatório." });
      return;
    }

    // 1. Buscar calendário
    const calResult = await db.query(
      "SELECT calendario_json, mes, cliente_id, periodo FROM calendarios WHERE id = $1",
      [calendarId]
    );
    if (calResult.rows.length === 0) {
      res.status(404).json({ error: "Calendário não encontrado" });
      return;
    }
    const calendar = calResult.rows[0];
    let posts = calendar.calendario_json;
    const monthLabel: string = calendar.mes || "Janeiro";
    const periodo = calendar.periodo;
    const clienteId = String(calendar.cliente_id);

    // 2. Resolver nome do cliente
    let resolvedClientName = clientName || "Cliente";
    try {
      const cRes = await db.query("SELECT nome FROM clientes WHERE id = $1", [clienteId]);
      if (cRes.rows[0]?.nome) resolvedClientName = cRes.rows[0].nome;
    } catch (_) {}

    // 3. Helpers de data/mês
    const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const monthNamePt = (m: number) => monthNames[m - 1] || `Mes${m}`;
    const parseMonthLabelToNumber = (label: string): number | null => {
      const token = String(label || "").trim().toLowerCase().split(/\s+/)[0] || "";
      const map: Record<string, number> = { janeiro:1,fevereiro:2,"março":3,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 };
      return map[token] ?? null;
    };
    const parseYearFromLabel = (label: string, fallback: number) => {
      const m = String(label || "").match(/(\d{4})/);
      const p = m?.[1] ? parseInt(m[1], 10) : NaN;
      return Number.isNaN(p) ? fallback : p;
    };
    const sanitize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"").trim();
    const parsePostDate = (value: any): { day: number; month: number; year?: number } | null => {
      const raw = String(value ?? "").trim();
      if (!raw || ["undefined","null","none"].includes(raw.toLowerCase())) return null;
      let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) return { day: parseInt(m[3]!,10), month: parseInt(m[2]!,10), year: parseInt(m[1]!,10) };
      m = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
      if (!m) return null;
      return { day: parseInt(m[1]!,10), month: parseInt(m[2]!,10), year: m[3] ? parseInt(m[3],10) : undefined };
    };

    const baseMonthNum = parseMonthLabelToNumber(monthLabel) || 1;
    const baseYearNum = parseInt(String(parseYearFromLabel(monthLabel, new Date().getFullYear())), 10);

    const normalizePosts = (calPosts: any[], srcLabel: string) => {
      const fbMonth = parseMonthLabelToNumber(srcLabel) || baseMonthNum;
      const fbYear = parseYearFromLabel(srcLabel, baseYearNum);
      return (Array.isArray(calPosts) ? calPosts : []).map((post: any) => {
        const pd = parsePostDate(post?.data);
        const rawDay = post?.dia ?? post?.day;
        const fbDay = parseInt(String(rawDay ?? ""), 10);
        let normalizedDate = "";
        if (pd?.day && pd?.month) {
          normalizedDate = `${String(pd.day).padStart(2,"0")}/${String(pd.month).padStart(2,"0")}/${pd.year || fbYear}`;
        } else if (!Number.isNaN(fbDay) && fbDay >= 1 && fbDay <= 31) {
          normalizedDate = `${String(fbDay).padStart(2,"0")}/${String(fbMonth).padStart(2,"0")}/${fbYear}`;
        } else if (typeof post?.data === "string") {
          normalizedDate = post.data;
        }
        return { ...post, data: normalizedDate, _export_month: fbMonth, _export_year: fbYear };
      });
    };

    const requestedMonths = Array.isArray(monthsSelected) && monthsSelected.length > 0
      ? monthsSelected.map(m => parseInt(String(m),10)).filter(m => !Number.isNaN(m) && m >= 1 && m <= 12).sort((a,b) => a-b)
      : [];

    const detectMonths = (calPosts: any[]) => {
      const months = new Set<number>();
      for (const p of calPosts || []) {
        const m = String((p as any)?.data || "").match(/\b(\d{1,2})\/(\d{1,2})\b/);
        if (m) { const mn = parseInt(String(m[2]||""),10); if (mn >= 1 && mn <= 12) months.add(mn); }
      }
      return Array.from(months).sort((a,b) => a-b);
    };

    const monthsToExport = requestedMonths.length > 0 ? requestedMonths : detectMonths(posts);
    let exportMonthLabel = monthLabel;
    const mergedPosts: any[] = [];
    const resolvedMonthLabels = new Map<number, string>();

    const appendPosts = (calPosts: any[], srcLabel: string) => {
      const normalized = normalizePosts(calPosts, srcLabel);
      if (normalized.length > 0) mergedPosts.push(...normalized);
      const n = parseMonthLabelToNumber(srcLabel);
      if (n && !resolvedMonthLabels.has(n)) resolvedMonthLabels.set(n, srcLabel);
    };

    const shouldUseRequested = requestedMonths.length > 0;
    const shouldIncludeBase = !shouldUseRequested || requestedMonths.includes(baseMonthNum);
    if (shouldIncludeBase) appendPosts(Array.isArray(posts) ? posts : [], monthLabel);

    if (shouldUseRequested) {
      const monthSearchTokens = (n: number) => n === 3 ? ["março","marco"] : [monthNamePt(n).toLowerCase()];
      for (const m of requestedMonths) {
        if (m === baseMonthNum && shouldIncludeBase) continue;
        const yNum = m < baseMonthNum && baseMonthNum >= 9 && m <= 4 ? baseYearNum + 1 : baseYearNum;
        const label = `${monthNamePt(m)} ${yNum}`;
        let other = await db.query(
          "SELECT calendario_json, mes FROM calendarios WHERE cliente_id = $1 AND lower(mes) = lower($2) ORDER BY updated_at DESC NULLS LAST, criado_em DESC NULLS LAST LIMIT 1",
          [clienteId, label]
        );
        if (!other.rows?.length) {
          for (const token of monthSearchTokens(m)) {
            other = await db.query(
              "SELECT calendario_json, mes FROM calendarios WHERE cliente_id = $1 AND lower(mes) LIKE $2 AND lower(mes) LIKE $3 ORDER BY updated_at DESC NULLS LAST, criado_em DESC NULLS LAST LIMIT 1",
              [clienteId, `%${token}%`, `%${String(yNum)}%`]
            );
            if (other.rows?.length) break;
          }
        }
        if (!other.rows?.length) continue;
        const otherPosts = other.rows[0]?.calendario_json;
        const srcLabel = String(other.rows[0]?.mes || label);
        if (Array.isArray(otherPosts) && otherPosts.length > 0) appendPosts(otherPosts, srcLabel);
      }
    }

    if (mergedPosts.length > 0) posts = mergedPosts;
    else posts = normalizePosts(Array.isArray(posts) ? posts : [], monthLabel);

    if (requestedMonths.length > 0) {
      const first = requestedMonths[0] ?? baseMonthNum;
      exportMonthLabel = resolvedMonthLabels.get(first) || `${monthNamePt(first)} ${baseYearNum}`;
    }

    // 4. Montar paths
    const backendDir = process.cwd();
    const projectDir = path.resolve(backendDir, "..");
    const pythonScript = path.resolve(backendDir, "python_gen", "calendar_to_excel.py");
    const templatePreferred = path.resolve(projectDir, "calendario", "modelo final.xlsx");
    const templateFallback = path.resolve(projectDir, "calendario", "CoreSport_Tri_2026.xlsx");
    const templatePath = fs.existsSync(templatePreferred) ? templatePreferred : templateFallback;

    const outputDir = path.resolve(projectDir, "calendario", "output");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const safeClient = sanitize(resolvedClientName) || "Cliente";
    const safeMonth = (() => {
      const nm = monthsToExport.filter(m => m >= 1 && m <= 12).sort((a,b) => a-b);
      if (nm.length >= 2) return sanitize(`${monthNamePt(nm[0])}-${monthNamePt(nm[nm.length-1])}_${baseYearNum}`);
      return sanitize(String(monthLabel).replace(/\s+/g,"_")) || "Mes";
    })();

    const outputFileName = `${safeClient}_${safeMonth}.xlsx`;
    const outputPath = path.join(outputDir, outputFileName);

    // 5. Rodar Python
    const pythonBin = process.env.PYTHON_BIN || "python3";
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(pythonBin, [
        pythonScript, "--stdin", templatePath, outputPath,
        resolvedClientName, String(exportMonthLabel), String(baseYearNum),
        String(periodo || ""), JSON.stringify(monthsToExport),
      ], { stdio: ["pipe","pipe","pipe"] });

      let pythonError = "";
      let startFailed = false;
      proc.on("error", (err: any) => { startFailed = true; reject(new Error(`Falha ao iniciar Python: ${err.message}`)); });
      proc.stderr.on("data", (d: any) => { pythonError += d.toString(); });
      proc.stdin?.end(JSON.stringify(posts));
      proc.on("close", (code: number) => {
        if (startFailed) return;
        if (code === 0 && fs.existsSync(outputPath)) resolve();
        else reject(new Error(`Python falhou (code=${code}): ${pythonError}`));
      });
    });

    // 6. Salvar no histórico (não-bloqueante)
    const deliveryTimestamp = Date.now();
    const deliveriesDir = path.resolve(backendDir, "..", "storage", "deliveries", "excel", clienteId, String(deliveryTimestamp));
    if (!fs.existsSync(deliveriesDir)) fs.mkdirSync(deliveriesDir, { recursive: true });
    const permanentPath = path.join(deliveriesDir, outputFileName);
    fs.copyFileSync(outputPath, permanentPath);

    const downloadUrl = `/api/storage/deliveries/excel/${clienteId}/${deliveryTimestamp}/${outputFileName}`;
    db.query(
      `INSERT INTO presentations (cliente_id, titulo, arquivos, dados_json, tipo, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
      [clienteId, `Excel: ${outputFileName}`, JSON.stringify([downloadUrl]), JSON.stringify(posts), 'excel',
       JSON.stringify({ months: monthsToExport, year: baseYearNum, generatedAt: new Date().toISOString() })]
    ).catch((e: any) => console.warn("⚠️ Falha ao registrar entrega no histórico:", e.message));

    // 7. Enviar arquivo diretamente
    res.download(outputPath, outputFileName, (err) => {
      if (err) console.error("[Excel] Erro ao enviar arquivo:", err.message);
    });

  } catch (error: any) {
    console.error("[ERRO] Erro ao gerar Excel:", error);
    res.status(500).json({ error: "Falha ao gerar Excel.", details: error?.message });
  }
});



export default router;
