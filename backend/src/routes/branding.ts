import { Router, Request, Response } from "express";
import db from "../config/database";
import { generateUUID } from "../utils/uuid";
import { geminiClient } from "../utils/geminiClient";
import { mergeBrandingData } from "../utils/brandingMerger";
import { join } from "path";
import { existsSync } from "fs";

const router = Router();

type BrandingRow = {
  id: string;
  cliente_id: string;
  visual_style: any;
  tone_of_voice: any;
  audience: any;
  keywords: string[] | null;
  archetype?: string | null;
  usp?: string | null;
  anti_keywords?: string[] | null;
  niche?: string | null;
  updated_at?: string;
};

const snapshotBrandingVersion = async (opts: {
  clienteId: string;
  brandingRow: BrandingRow;
  reason?: string;
}) => {
  const versionId = generateUUID();
  await db.query(
    `INSERT INTO branding_versions (id, cliente_id, branding_id, snapshot, reason, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      versionId,
      opts.clienteId,
      opts.brandingRow.id,
      JSON.stringify({
        id: opts.brandingRow.id,
        cliente_id: opts.brandingRow.cliente_id,
        visual_style: opts.brandingRow.visual_style || {},
        tone_of_voice: opts.brandingRow.tone_of_voice || {},
        audience: opts.brandingRow.audience || {},
        keywords: opts.brandingRow.keywords || [],
        archetype: opts.brandingRow.archetype || null,
        usp: opts.brandingRow.usp || null,
        anti_keywords: opts.brandingRow.anti_keywords || [],
        niche: opts.brandingRow.niche || null,
        updated_at: opts.brandingRow.updated_at || null,
      }),
      opts.reason || null,
    ]
  );
  return versionId;
};

const getCurrentBrandingRow = async (clienteId: string): Promise<BrandingRow | null> => {
  const result = await db.query(`SELECT * FROM branding WHERE cliente_id = $1`, [clienteId]);
  return result.rows[0] || null;
};

// Função robusta para limpar e fazer parse do JSON da resposta do Gemini
const cleanAndParseBrandingJSON = (text: string) => {
  try {
    // 1. Tentar encontrar o primeiro '{' e o último '}'
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
      const jsonCandidate = text.substring(firstBrace, lastBrace + 1);
      try {
        const parsed = JSON.parse(jsonCandidate);
        console.log("✅ JSON parseado com sucesso (método 1)");
        return parsed;
      } catch (e) {
        console.warn("⚠️ Falha no parse do método 1, tentando método 2...");
      }
    }

    // 2. Fallback: Limpar markdown e tentar parse
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    console.log("✅ JSON parseado com sucesso (método 2)");
    return parsed;
  } catch (error) {
    console.error("❌ Erro ao fazer parse do JSON:", error);
    // Retornar estrutura padrão se falhar
    return {
      visual_style: { colors: [], fonts: [], archeType: "Não definido" },
      tone_of_voice: { description: "Não definido", keywords: [] },
      audience: { persona: "Não definido", demographics: "" },
      keywords: []
    };
  }
};

// POST /analyze-branding - Analisa post e atualiza DNA de branding do cliente
router.post("/analyze-branding", async (req: Request, res: Response) => {
  try {
    const { clienteId, postId } = req.body;

    // Validação: clienteId obrigatório
    if (!clienteId) {
      res.status(400).json({
        success: false,
        error: "clienteId é obrigatório"
      });
      return;
    }

    // Validação: postId obrigatório
    if (!postId) {
      res.status(400).json({
        success: false,
        error: "postId é obrigatório"
      });
      return;
    }

    // Buscar o post no banco de dados
    const postResult = await db.query(
      `SELECT * FROM posts WHERE id = $1 AND cliente_id = $2`,
      [postId, clienteId]
    );

    if (postResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: "Post não encontrado para este cliente"
      });
      return;
    }

    const post = postResult.rows[0];

    // Verificar se o arquivo existe
    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    const filePath = join(uploadDir, post.arquivo);

    if (!existsSync(filePath)) {
      res.status(404).json({
        success: false,
        error: "Arquivo do post não encontrado"
      });
      return;
    }

    // Analisar com Google Gemini - Prompt específico para branding
    const brandingPrompt = `Analise este post e retorne APENAS um JSON puro (sem markdown) com esta estrutura:
{
  "visual_style": {
    "colors": ["#HEX1", "#HEX2", "#HEX3"],
    "fonts": ["Nome Fonte 1", "Nome Fonte 2"],
    "archeType": "O Criador"
  },
  "tone_of_voice": {
    "description": "Descrição do tom de voz",
    "keywords": ["palavra1", "palavra2", "palavra3"]
  },
  "audience": {
    "persona": "Descrição da persona",
    "demographics": "Dados demográficos"
  },
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Analise:
1. Estilo Visual: extraia cores HEX, fontes, arquétipo da marca
2. Tom de Voz: personalidade, linguagem, estilo de comunicação
3. Público-Alvo: persona, demografia, comportamento
4. Palavras-chave: termos que definem a marca

Retorne APENAS o JSON, sem texto adicional.`;

    console.log("🤖 Analisando imagem com Gemini...");
    const geminiAnalysis = await geminiClient.analyzeImage(filePath, brandingPrompt);
    console.log("✅ Resposta recebida do Gemini");

    // Processar resposta do Gemini com parser robusto
    const parsedInsights = cleanAndParseBrandingJSON(geminiAnalysis);

    // Buscar branding existente do cliente
    const existingBrandingResult = await db.query(
      `SELECT * FROM branding WHERE cliente_id = $1`,
      [clienteId]
    );

    let brandingId: string;
    let mergedData;

    if (existingBrandingResult.rows.length > 0) {
      // Atualizar branding existente (merge)
      const existing = existingBrandingResult.rows[0];
      brandingId = existing.id;

      mergedData = mergeBrandingData(
        {
          visual_style: existing.visual_style,
          tone_of_voice: existing.tone_of_voice,
          audience: existing.audience,
          keywords: existing.keywords
        },
        parsedInsights
      );

      await db.query(
        `UPDATE branding 
         SET visual_style = $1, tone_of_voice = $2, audience = $3, keywords = $4, updated_at = NOW()
         WHERE cliente_id = $5`,
        [
          JSON.stringify(mergedData.visual_style),
          JSON.stringify(mergedData.tone_of_voice),
          JSON.stringify(mergedData.audience),
          mergedData.keywords,
          clienteId
        ]
      );
    } else {
      // Criar novo registro de branding
      brandingId = generateUUID();
      mergedData = mergeBrandingData(null, parsedInsights);

      await db.query(
        `INSERT INTO branding (id, cliente_id, visual_style, tone_of_voice, audience, keywords, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          brandingId,
          clienteId,
          JSON.stringify(mergedData.visual_style),
          JSON.stringify(mergedData.tone_of_voice),
          JSON.stringify(mergedData.audience),
          mergedData.keywords
        ]
      );
    }

    // Retornar resultado
    res.status(200).json({
      success: true,
      brandingId,
      clienteId,
      postId,
      insights: mergedData,
      rawAnalysis: geminiAnalysis
    });
  } catch (error) {
    console.error("Erro ao analisar branding:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao analisar branding. Tente novamente."
    });
  }
});

// GET /:clienteId/versions - Lista versões (mais recentes primeiro)
router.get("/:clienteId/versions", async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.params;

    if (!clienteId) {
      return res.status(400).json({ success: false, error: "clienteId é obrigatório" });
    }

    const result = await db.query(
      `SELECT id, cliente_id, branding_id, reason, created_at
       FROM branding_versions
       WHERE cliente_id = $1
       ORDER BY created_at DESC`,
      [clienteId]
    );

    return res.status(200).json({ success: true, clienteId, versions: result.rows });
  } catch (error) {
    console.error("Erro ao listar versões do branding:", error);
    return res.status(500).json({ success: false, error: "Erro ao listar versões do branding" });
  }
});

// GET /:clienteId/versions/:versionId - Retorna snapshot de uma versão
router.get("/:clienteId/versions/:versionId", async (req: Request, res: Response) => {
  try {
    const { clienteId, versionId } = req.params;

    if (!clienteId || !versionId) {
      return res.status(400).json({ success: false, error: "clienteId e versionId são obrigatórios" });
    }

    const result = await db.query(
      `SELECT id, cliente_id, branding_id, snapshot, reason, created_at
       FROM branding_versions
       WHERE id = $1 AND cliente_id = $2`,
      [versionId, clienteId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Versão não encontrada" });
    }

    return res.status(200).json({ success: true, clienteId, version: result.rows[0] });
  } catch (error) {
    console.error("Erro ao buscar versão do branding:", error);
    return res.status(500).json({ success: false, error: "Erro ao buscar versão do branding" });
  }
});

// POST /:clienteId/versions/:versionId/restore - Restaura uma versão
router.post("/:clienteId/versions/:versionId/restore", async (req: Request, res: Response) => {
  try {
    const { clienteId, versionId } = req.params;

    if (!clienteId || !versionId) {
      return res.status(400).json({ success: false, error: "clienteId e versionId são obrigatórios" });
    }

    const current = await getCurrentBrandingRow(clienteId);
    if (!current) {
      return res.status(404).json({ success: false, error: "Branding não encontrado para este cliente" });
    }

    const versionResult = await db.query(
      `SELECT snapshot
       FROM branding_versions
       WHERE id = $1 AND cliente_id = $2`,
      [versionId, clienteId]
    );

    if (versionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Versão não encontrada" });
    }

    // Snapshot do estado atual antes de restaurar
    await snapshotBrandingVersion({
      clienteId,
      brandingRow: current,
      reason: `auto: before restore ${versionId}`,
    });

    const snapshot = versionResult.rows[0]?.snapshot || {};
    const visual_style = snapshot.visual_style || {};
    const tone_of_voice = snapshot.tone_of_voice || {};
    const audience = snapshot.audience || {};
    const keywords = snapshot.keywords || [];
    const archetype = snapshot.archetype || null;
    const usp = snapshot.usp || null;
    const anti_keywords = snapshot.anti_keywords || [];
    const niche = snapshot.niche || null;

    await db.query(
      `UPDATE branding
       SET visual_style = $1, tone_of_voice = $2, audience = $3, keywords = $4,
           archetype = $5, usp = $6, anti_keywords = $7, niche = $8, updated_at = NOW()
       WHERE cliente_id = $9`,
      [
        JSON.stringify(visual_style),
        JSON.stringify(tone_of_voice),
        JSON.stringify(audience),
        keywords,
        archetype,
        usp,
        anti_keywords,
        niche,
        clienteId,
      ]
    );

    return res.status(200).json({ success: true, message: "Versão restaurada com sucesso" });
  } catch (error) {
    console.error("Erro ao restaurar versão do branding:", error);
    return res.status(500).json({ success: false, error: "Erro ao restaurar versão do branding" });
  }
});

// GET /branding/:clienteId - Retorna DNA de branding consolidado do cliente
router.get("/:clienteId", async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.params;

    if (!clienteId) {
      res.status(400).json({
        success: false,
        error: "clienteId é obrigatório"
      });
      return;
    }

    // Buscar branding do cliente
    const result = await db.query(
      `SELECT * FROM branding WHERE cliente_id = $1`,
      [clienteId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: "Branding não encontrado para este cliente. Analise alguns posts primeiro."
      });
      return;
    }

    const branding = result.rows[0];

    // Retornar dados consolidados (Brand DNA 2.0)
    res.status(200).json({
      success: true,
      clienteId,
      branding: {
        id: branding.id,
        cliente_id: branding.cliente_id,
        visual_style: branding.visual_style,
        tone_of_voice: branding.tone_of_voice,
        audience: branding.audience,
        keywords: branding.keywords,
        archetype: branding.archetype,
        usp: branding.usp,
        anti_keywords: branding.anti_keywords,
        niche: branding.niche,
        updated_at: branding.updated_at
      }
    });
  } catch (error) {
    console.error("Erro ao buscar branding:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar branding do cliente"
    });
  }
});

// PUT /api/branding/:clienteId - Salva branding definitivo (Brand DNA 2.0)
router.put("/:clienteId", async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.params;
    const {
      visual_style,
      tone_of_voice,
      audience,
      keywords,
      archetype,
      usp,
      anti_keywords,
      niche
    } = req.body;

    console.log("💾 [BRANDING SAVE] Salvando branding definitivo para cliente:", clienteId);

    if (!clienteId) {
      return res.status(400).json({
        success: false,
        error: "clienteId é obrigatório"
      });
    }

    // Verificar se o branding existe
    const existingResult = await db.query(
      `SELECT * FROM branding WHERE cliente_id = $1`,
      [clienteId]
    );

    if (existingResult.rows.length === 0) {
      // Criar novo se não existir
      const brandingId = generateUUID();
      await db.query(
        `INSERT INTO branding (
          id, cliente_id, visual_style, tone_of_voice, audience, keywords,
          archetype, usp, anti_keywords, niche, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          brandingId,
          clienteId,
          JSON.stringify(visual_style || {}),
          JSON.stringify(tone_of_voice || {}),
          JSON.stringify(audience || {}),
          keywords || [],
          archetype || null,
          usp || null,
          anti_keywords || [],
          niche || null
        ]
      );

      console.log("✅ [BRANDING SAVE] Novo branding criado com sucesso");
      return res.status(201).json({
        success: true,
        message: "Branding criado com sucesso",
        brandingId
      });
    }

    // Snapshot automático antes de atualizar
    const current = existingResult.rows[0] as BrandingRow;
    try {
      await snapshotBrandingVersion({
        clienteId,
        brandingRow: current,
        reason: "auto: before update",
      });
    } catch (e) {
      console.error("⚠️ Falha ao salvar versão do branding (continua update):", e);
    }

    // Atualizar existente (Brand DNA 2.0)
    await db.query(
      `UPDATE branding
       SET visual_style = $1, tone_of_voice = $2, audience = $3, keywords = $4,
           archetype = $5, usp = $6, anti_keywords = $7, niche = $8, updated_at = NOW()
       WHERE cliente_id = $9`,
      [
        JSON.stringify(visual_style || {}),
        JSON.stringify(tone_of_voice || {}),
        JSON.stringify(audience || {}),
        keywords || [],
        archetype || null,
        usp || null,
        anti_keywords || [],
        niche || null,
        clienteId
      ]
    );

    console.log("✅ [BRANDING SAVE] Branding atualizado com sucesso");
    return res.status(200).json({
      success: true,
      message: "Branding salvo com sucesso"
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar branding:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao atualizar branding"
    });
  }
});

export default router;

