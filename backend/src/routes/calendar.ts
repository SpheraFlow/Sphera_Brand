import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../config/database";
import { updateTokenUsage } from "../utils/tokenTracker";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

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
  console.log("\n🛑 [DEBUG] ROTA /generate-calendar ACIONADA (Async Job)");

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
      console.log(`✅ [DEBUG] Usando meses diretos do corpo da requisição:`, monthsToGenerate);
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
            janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
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

    console.log(`✅ [DEBUG] Meses para geração:`, monthsToGenerate);

    // CRIAÇÃO DO JOB
    const { randomUUID } = await import('crypto');
    const jobId = randomUUID();

    const jobPayload = {
      clienteId,
      briefing,
      periodo: periodoFinal,
      mix,
      monthlyMix: req.body.monthlyMix || null,  // mix por mês (opcional)
      generationPrompt,
      chainId,
      formatInstructions,
      monthReferences,
      monthsToGenerate,
      chainOutputFinal,
      produtosFocoIds
    };

    console.log(`🚀 [JOB] Criando job ${jobId} para cliente ${clienteId}`);

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
    console.error("❌ Erro ao iniciar job:", error);
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
        ? `\n\nObrigatório para Carrosséis: divida sua resposta em exatamente ${slideCount} slides estruturados do tipo [Slide 1] ..., [Slide 2] ...`
        : `\n\nObrigatório para Carrosséis: divida sua resposta em slides estruturados do tipo [Slide 1] ..., [Slide 2] ...`)
      : '';

    // Montar prompt para regenerar um único post
    const regenPrompt = `
      Você é um estrategista de social media especialista em adaptação de conteúdo.

      Regere UM ÚNICO post para um calendário editorial, adaptando o conteúdo abaixo para o FORMATO: "${targetFormato}".

      CONTEXTO DA MARCA:
      - Tom de Voz: ${branding.tone_of_voice}
    - Estilo Visual: ${branding.visual_style}
    - Público: ${branding.audience}

      REGRAS OBRIGATÓRIAS(Não viole):
      ${rules}

      POST ATUAL(referência):
      {
        "data": "${originalPost.data}",
        "tema": "${originalPost.tema}",
        "formato": "${originalPost.formato}",
        "ideia_visual": "${originalPost.ideia_visual}",
        "copy_sugestao": "${originalPost.copy_sugestao}",
        "objetivo": "${originalPost.objetivo}",
        "image_generation_prompt": "${originalPost.image_generation_prompt || ""}"
      }

      INSTRUÇÕES DO ESTRATEGISTA(opcional/adicional):
      Adapte o conteúdo para o novo formato mantendo a essência estratégica, mas otimizando copy, ideia visual e objetivo para aumentar desempenho.
      INSTRUÇÕES ESPECÍFICAS DO USUÁRIO: ${customPrompt || "Nenhuma instrução extra."}${carouselRule}

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
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];

    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖[DEBUG] Tentando modelo(regen): ${modelName}...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" }
        });
        result = await model.generateContent(regenPrompt);
        responseText = result.response.text();

        // Log de uso de tokens
        const usageMetadata = result.response.usageMetadata;
        if (usageMetadata) {
          console.log(`📊[TOKENS REGEN] Modelo: ${modelName}`);
          console.log(`📊[TOKENS REGEN] Prompt Tokens: ${usageMetadata.promptTokenCount || 0}`);
          console.log(`📊[TOKENS REGEN] Completion Tokens: ${usageMetadata.candidatesTokenCount || 0}`);
          console.log(`📊[TOKENS REGEN] Total Tokens: ${usageMetadata.totalTokenCount || 0}`);

          // Atualizar contador de tokens do cliente
          await updateTokenUsage(calendar.cliente_id, usageMetadata, "post_regeneration", modelName);
        }

        console.log(`✅[DEBUG] Resposta recebida do ${modelName}(tamanho: ${responseText.length})`);
        break; // Sucesso
      } catch (modelError: any) {
        console.warn(`⚠️[DEBUG] ${modelName} falhou em regen: `, modelError.message);

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

    console.log("✅ Post atualizado com sucesso");

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
    console.error("❌ Erro ao listar calendários:", error);
    return res.status(500).json({ success: false, error: "Erro ao listar calendários." });
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
      console.log(`🔍 [DEBUG] Buscando calendário específico do mês: "${month}" (includeDrafts=${includeDrafts})`);
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
        updatedAt: calendar.updated_at,
        status: calendar.status
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

// DELETE /api/calendars/post/:calendarId/:postIndex - Exclui um post específico
router.delete("/calendars/post/:calendarId/:postIndex", async (req: Request, res: Response) => {
  try {
    const { calendarId, postIndex } = req.params;

    console.log(`🗑️ Excluindo post ${postIndex} do calendário ${calendarId}`);

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

    console.log("✅ Post excluído com sucesso");

    return res.json({
      success: true,
      message: "Post excluído com sucesso."
    });
  } catch (error) {
    console.error("❌ Erro ao excluir post:", error);
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

    console.log(`🗑️ Excluindo calendário do mês ${month} para cliente: ${clientId} (includeDrafts=${includeDrafts})`);

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
    console.error(" Erro ao atualizar metadata:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao atualizar metadata.",
    });
  }
});

router.post("/calendars/export-excel", async (req: Request, res: Response): Promise<void> => {
  console.log("\n [DEBUG] ROTA /export-excel ACIONADA");
  console.log(" [DEBUG] Payload:", JSON.stringify(req.body, null, 2));

  try {
    if (!req.is("application/json") || !req.body) {
      res.status(400).json({
        error: "Body JSON é obrigatório.",
        details: "Envie Content-Type: application/json e um JSON com { calendarId }",
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

    console.log(` Buscando calendário ID: ${calendarId}`);
    const result = await db.query(
      "SELECT calendario_json, mes, cliente_id, periodo FROM calendarios WHERE id = $1",
      [calendarId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Calendário não encontrado" });
      return;
    }

    const calendar = result.rows[0];
    let posts = calendar.calendario_json;
    const monthLabel = calendar.mes || "Janeiro";
    const periodo = calendar.periodo;

    let resolvedClientName = (clientName as string) || "Cliente";
    try {
      if (calendar.cliente_id) {
        const clientResult = await db.query("SELECT nome FROM clientes WHERE id = $1", [calendar.cliente_id]);
        const dbName = clientResult.rows?.[0]?.nome;
        if (dbName) {
          resolvedClientName = dbName;
        }
      }
    } catch (e: any) {
      console.log(` [ERROR] Falha no merge multi-mês: ${e?.message || String(e)}`);
    }

    const yearMatch = String(monthLabel).match(/(\d{4})/);
    const year = yearMatch?.[1] || String(new Date().getFullYear());

    const monthNamePt = (m?: number): string => {
      const names = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ];
      if (!m) return "Mes";
      return names[m - 1] || `Mes${m}`;
    };

    const parseMonthLabelToNumber = (label: string): number | null => {
      const s = String(label || "").trim().toLowerCase();
      if (!s) return null;
      const token = s.split(/\s+/)[0] || "";
      const map: Record<string, number> = {
        janeiro: 1,
        fevereiro: 2,
        "março": 3,
        marco: 3,
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
      return map[token] ?? null;
    };

    const sanitizeFilePart = (value: string): string => {
      return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "")
        .trim();
    };

    const detectMonths = (calendarPosts: any[]): number[] => {
      const months = new Set<number>();
      for (const p of calendarPosts || []) {
        const dateStr = String((p as any)?.data || "");
        const m = dateStr.match(/\b(\d{1,2})\/(\d{1,2})\b/);
        if (!m) continue;
        const monthNum = parseInt(String(m?.[2] || ""), 10);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          months.add(monthNum);
        }
      }
      return Array.from(months).sort((a, b) => a - b);
    };

    const monthsDetected = detectMonths(posts);
    const monthsToExport = Array.isArray(monthsSelected) && monthsSelected.length > 0 ? monthsSelected : monthsDetected;

    try {
      const baseCount = Array.isArray(posts) ? posts.length : 0;
      console.log(` [DEBUG] Export meses solicitados: ${JSON.stringify(monthsToExport)} | posts base=${baseCount}`);
    } catch (_e) {
      // ignore
    }

    // Merge posts dos outros meses selecionados (tolerante ao formato do campo mes no banco)
    try {
      const normalizedMonths = Array.isArray(monthsToExport)
        ? monthsToExport
          .map((mm) => parseInt(String(mm), 10))
          .filter((mm) => !isNaN(mm) && mm >= 1 && mm <= 12)
        : [];

      console.log(` [DEBUG] Merge check: normalizedMonths=${JSON.stringify(normalizedMonths)}, cliente_id=${calendar.cliente_id || 'NULL'}`);

      if (normalizedMonths.length >= 2 && calendar.cliente_id) {
        console.log(` [DEBUG] Iniciando merge de ${normalizedMonths.length} meses para cliente_id=${calendar.cliente_id}`);
        const baseMonthNum = parseMonthLabelToNumber(String(monthLabel)) || normalizedMonths[0] || 1;
        const baseYearNum = parseInt(String(year), 10) || new Date().getFullYear();
        const mergedPosts: any[] = Array.isArray(posts) ? [...posts] : [];

        const monthSearchTokens = (monthNum: number): string[] => {
          const n = Number(monthNum);
          if (n == 3) return ["março", "marco"];
          return [monthNamePt(n).toLowerCase()];
        };

        for (const m of normalizedMonths) {
          if (m === baseMonthNum) continue;
          const yNum = m < baseMonthNum ? baseYearNum + 1 : baseYearNum;
          const label = `${monthNamePt(m)} ${yNum}`;

          // 1) Match exato
          let other = await db.query(
            "SELECT calendario_json, mes FROM calendarios WHERE cliente_id = $1 AND lower(mes) = lower($2) ORDER BY updated_at DESC NULLS LAST, criado_em DESC NULLS LAST LIMIT 1",
            [calendar.cliente_id, label]
          );

          // 2) Fallback tolerante: contém mês + contém ano
          if (!other.rows?.length) {
            const yearToken = String(yNum);
            for (const token of monthSearchTokens(m)) {
              other = await db.query(
                "SELECT calendario_json, mes FROM calendarios WHERE cliente_id = $1 AND lower(mes) LIKE $2 AND lower(mes) LIKE $3 ORDER BY updated_at DESC NULLS LAST, criado_em DESC NULLS LAST LIMIT 1",
                [calendar.cliente_id, `%${token}%`, `%${yearToken}%`]
              );
              if (other.rows?.length) break;
            }
          }

          // 3) Fallback extra: contém apenas o mês (quando o campo mes não tem ano)
          if (!other.rows?.length) {
            for (const token of monthSearchTokens(m)) {
              other = await db.query(
                "SELECT calendario_json, mes FROM calendarios WHERE cliente_id = $1 AND lower(mes) LIKE $2 ORDER BY updated_at DESC NULLS LAST, criado_em DESC NULLS LAST LIMIT 1",
                [calendar.cliente_id, `%${token}%`]
              );
              if (other.rows?.length) break;
            }
          }

          if (!other.rows?.length) {
            console.log(
              ` [WARN] Não encontrei calendário para merge do cliente_id=${calendar.cliente_id} mes=${label} (tentativas: exact + like month/year + like month)`
            );
            continue;
          }

          console.log(
            ` [DEBUG] Merge mês ${label}: encontrado mes='${String(other.rows?.[0]?.mes || "")}'`
          );

          const otherPosts = other.rows?.[0]?.calendario_json;
          if (Array.isArray(otherPosts) && otherPosts.length > 0) {
            console.log(
              ` [DEBUG] Merge mês ${label}: adicionando ${otherPosts.length} posts (cliente_id=${calendar.cliente_id})`
            );
            mergedPosts.push(...otherPosts);
          } else {
            console.log(
              ` [WARN] Merge mês ${label}: calendário encontrado mas sem posts (cliente_id=${calendar.cliente_id})`
            );
          }
        }

        posts = mergedPosts;

        try {
          const mergedCount = Array.isArray(posts) ? posts.length : 0;
          console.log(` [DEBUG] Export merge finalizado: posts total=${mergedCount}`);
        } catch (_e) {
          // ignore
        }
      }
    } catch (_e) {
      // fallback
    }

    const safeClient = sanitizeFilePart(resolvedClientName || "Cliente") || "Cliente";
    const safeMonth = (() => {
      const normalized = Array.isArray(monthsToExport)
        ? monthsToExport
          .map((m) => parseInt(String(m), 10))
          .filter((m) => !isNaN(m) && m >= 1 && m <= 12)
          .sort((a, b) => a - b)
        : [];

      if (normalized.length >= 2) {
        const startNum = normalized[0]!;
        const endNum = normalized[normalized.length - 1]!;
        const start = monthNamePt(startNum);
        const end = monthNamePt(endNum);
        return sanitizeFilePart(`${start}-${end}_${year}`);
      }

      return sanitizeFilePart(String(monthLabel).replace(/\s+/g, "_")) || "Mes";
    })();

    const backendDir = process.cwd();
    const projectDir = path.resolve(backendDir, "..");
    const pythonScript = path.resolve(backendDir, "python_gen", "calendar_to_excel.py");
    const templatePreferred = path.resolve(projectDir, "calendario", "modelo final.xlsx");
    const templateFallback = path.resolve(projectDir, "calendario", "CoreSport_Tri_2026.xlsx");
    const templatePath = fs.existsSync(templatePreferred) ? templatePreferred : templateFallback;
    console.log(` Template escolhido: ${templatePath}`);

    const outputDir = path.resolve(projectDir, "calendario", "output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(` Diretório criado: ${outputDir}`);
    }

    const outputFileName = `${safeClient}_${safeMonth}.xlsx`;
    const outputPath = path.join(outputDir, outputFileName);

    console.log(` Executando Python script...`);
    console.log(`  Script: ${pythonScript}`);
    console.log(`  Template: ${templatePath}`);
    console.log(`  Output: ${outputPath}`);

    const pythonBin = process.env.PYTHON_BIN || "python3";
    const pythonProcess = spawn(pythonBin, [
      pythonScript,
      JSON.stringify(posts),
      templatePath,
      outputPath,
      resolvedClientName,
      String(monthLabel),
      year,
      String(periodo || ""),
      JSON.stringify(monthsToExport),
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

    pythonProcess.on("close", async (code: any) => {
      if (code === 0) {
        console.log(` [SUCCESS] Python script executado com sucesso`);
        if (fs.existsSync(outputPath)) {
          console.log(` Arquivo Excel criado: ${outputPath}`);

          // --- NOVO: Gravar no histórico de entregas ---
          try {
            const clienteId = result.rows[0].cliente_id;
            if (clienteId) {
              const deliveryTimestamp = Date.now();
              // Pasta permanente: storage/deliveries/excel/CLIENT_ID/TIMESTAMP/filename
              const deliveriesDir = path.resolve(backendDir, "..", "storage", "deliveries", "excel", String(clienteId), String(deliveryTimestamp));

              if (!fs.existsSync(deliveriesDir)) {
                fs.mkdirSync(deliveriesDir, { recursive: true });
              }

              const permanentPath = path.join(deliveriesDir, outputFileName);
              fs.copyFileSync(outputPath, permanentPath);

              const savedUrl = `/storage/deliveries/excel/${clienteId}/${deliveryTimestamp}/${outputFileName}`;

              await db.query(
                `INSERT INTO presentations (cliente_id, titulo, arquivos, dados_json, tipo, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  clienteId,
                  `Excel: ${outputFileName}`,
                  JSON.stringify([savedUrl]),
                  JSON.stringify(posts),
                  'excel',
                  JSON.stringify({
                    months: monthsToExport,
                    year,
                    generatedAt: new Date().toISOString()
                  })
                ]
              );
              console.log(` [SUCCESS] Entrega Excel registrada no banco para cliente ${clienteId}`);
            }
          } catch (historyErr) {
            console.error(` [ERROR] Falha ao registrar entrega no histórico:`, historyErr);
          }
          // --------------------------------------------

          res.download(outputPath, outputFileName, (err: any) => {
            if (err) {
              console.error(` [ERROR] Erro ao enviar arquivo: ${err}`);
              if (!res.headersSent) {
                res.status(500).json({ error: "Erro ao enviar arquivo" });
              }
            } else {
              console.log(` [SUCCESS] Arquivo enviado para download`);
            }
          });
        } else {
          console.error(` [ERROR] Arquivo não foi criado: ${outputPath}`);
          res.status(500).json({ error: "Arquivo Excel não foi gerado", details: pythonOutput });
        }
      } else {
        console.error(` [ERROR] Python script falhou com código: ${code}`);
        res.status(500).json({ error: "Erro ao gerar Excel", details: pythonError || pythonOutput });
      }
    });

    return;
  } catch (error: any) {
    console.error(" [ERRO FATAL] Erro ao exportar Excel:", error);
    res.status(500).json({
      error: "Falha interna ao exportar Excel.",
      details: error?.message || String(error),
    });
    return;
  }
});

export default router;
