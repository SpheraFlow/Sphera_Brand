import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../config/database";
import { updateTokenUsage } from "../utils/tokenTracker";

const router = Router();

interface PromptChainStep {
  order: number;
  name: string;
  prompt_template: string;
  expected_output?: string;
}

// Utilitário simples de substituição de variáveis {{var}}
const applyTemplate = (template: string, vars: Record<string, any>): string => {
  return template.replace(/{{\s*([a-zA-Z0-9_\.]+)\s*}}/g, (_match, key) => {
    const value = vars[key];
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  });
};

// POST /api/prompt-chains - criar
router.post("/prompt-chains", async (req: Request, res: Response) => {
  try {
    const { name, description, client_id, is_global, steps, created_by } = req.body;

    if (!name || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Campos obrigatórios: name e steps (array não vazio).",
      });
    }

    const normalizedSteps: PromptChainStep[] = steps
      .map((s: any, index: number) => ({
        order: typeof s.order === "number" ? s.order : index + 1,
        name: s.name || `Step ${index + 1}`,
        prompt_template: s.prompt_template || "",
        expected_output: s.expected_output || "",
      }))
      .sort((a, b) => a.order - b.order);

    const result = await db.query(
      `INSERT INTO prompt_chains (name, description, client_id, is_global, steps, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description || null, client_id || null, !!is_global, JSON.stringify(normalizedSteps), created_by || null]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("❌ Erro ao criar prompt chain:", error);
    return res.status(500).json({ success: false, message: "Erro ao criar prompt chain.", error: error.message });
  }
});

// GET /api/prompt-chains/:clientId - listar (globais + do cliente)
router.get("/prompt-chains/:clientId", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;

    const result = await db.query(
      `SELECT * FROM prompt_chains
       WHERE is_global = true OR client_id = $1
       ORDER BY created_at DESC`,
      [clientId]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error("❌ Erro ao listar prompt chains:", error);
    return res.status(500).json({ success: false, message: "Erro ao listar prompt chains.", error: error.message });
  }
});

// GET /api/prompt-chains/detail/:chainId - buscar uma
router.get("/prompt-chains/detail/:chainId", async (req: Request, res: Response) => {
  try {
    const { chainId } = req.params;

    const result = await db.query("SELECT * FROM prompt_chains WHERE id = $1", [chainId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Prompt chain não encontrada." });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("❌ Erro ao buscar prompt chain:", error);
    return res.status(500).json({ success: false, message: "Erro ao buscar prompt chain.", error: error.message });
  }
});

// PUT /api/prompt-chains/:chainId - editar
router.put("/prompt-chains/:chainId", async (req: Request, res: Response) => {
  try {
    const { chainId } = req.params;
    const { name, description, client_id, is_global, steps } = req.body;

    if (!name || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Campos obrigatórios: name e steps (array não vazio).",
      });
    }

    const normalizedSteps: PromptChainStep[] = steps
      .map((s: any, index: number) => ({
        order: typeof s.order === "number" ? s.order : index + 1,
        name: s.name || `Step ${index + 1}`,
        prompt_template: s.prompt_template || "",
        expected_output: s.expected_output || "",
      }))
      .sort((a, b) => a.order - b.order);

    const result = await db.query(
      `UPDATE prompt_chains
       SET name = $1,
           description = $2,
           client_id = $3,
           is_global = $4,
           steps = $5
       WHERE id = $6
       RETURNING *`,
      [name, description || null, client_id || null, !!is_global, JSON.stringify(normalizedSteps), chainId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Prompt chain não encontrada." });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("❌ Erro ao atualizar prompt chain:", error);
    return res.status(500).json({ success: false, message: "Erro ao atualizar prompt chain.", error: error.message });
  }
});

// DELETE /api/prompt-chains/:chainId - deletar
router.delete("/prompt-chains/:chainId", async (req: Request, res: Response) => {
  try {
    const { chainId } = req.params;

    const result = await db.query("DELETE FROM prompt_chains WHERE id = $1 RETURNING id", [chainId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Prompt chain não encontrada." });
    }

    return res.json({ success: true, message: "Prompt chain removida com sucesso." });
  } catch (error: any) {
    console.error("❌ Erro ao deletar prompt chain:", error);
    return res.status(500).json({ success: false, message: "Erro ao deletar prompt chain.", error: error.message });
  }
});

// POST /api/prompt-chains/execute/:chainId - executar
router.post("/prompt-chains/execute/:chainId", async (req: Request, res: Response) => {
  try {
    const { chainId } = req.params;
    const { clientId, briefing } = req.body as { clientId?: string; briefing?: string };

    if (!clientId) {
      return res.status(400).json({ success: false, message: "clientId é obrigatório para execução da chain." });
    }

    if (!process.env.GOOGLE_API_KEY) {
      return res.status(500).json({ success: false, message: "Configuração de IA ausente (GOOGLE_API_KEY)." });
    }

    const chainResult = await db.query("SELECT * FROM prompt_chains WHERE id = $1", [chainId]);
    if (chainResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Prompt chain não encontrada." });
    }

    const chain = chainResult.rows[0];
    const steps: PromptChainStep[] = (chain.steps || []).sort((a: any, b: any) => a.order - b.order);

    // Buscar branding do cliente
    const brandingResult = await db.query("SELECT * FROM branding WHERE cliente_id = $1", [clientId]);
    const branding = brandingResult.rows[0] || null;

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

    const contextVars: Record<string, any> = {
      branding,
      briefing: briefing || "",
    };

    const stepOutputs: string[] = [];

    for (const step of steps) {
      const tmpl = step.prompt_template || "";
      const filledPrompt = applyTemplate(tmpl, {
        ...contextVars,
        step_1_output: stepOutputs[0],
        step_2_output: stepOutputs[1],
        step_3_output: stepOutputs[2],
      });

      let result;
      let text = "";

      const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-pro-latest", "gemini-1.5-flash-latest"];

      for (const modelName of modelsToTry) {
        try {
          console.log(`🤖 [DEBUG] Tentando modelo (step ${step.order}): ${modelName}...`);
          const model = genAI.getGenerativeModel({ model: modelName });
          result = await model.generateContent(filledPrompt);
          text = result.response.text();
          console.log(`✅ [DEBUG] Sucesso com ${modelName} (step ${step.order})`);

          // Rastrear tokens gastos neste step da chain
          const usageMetadata = result.response.usageMetadata;
          if (usageMetadata) {
            await updateTokenUsage(clientId, usageMetadata, "prompt_chain_step", modelName);
          }
          break;
        } catch (modelError: any) {
          console.warn(`⚠️ [DEBUG] ${modelName} falhou (step ${step.order}):`, modelError.message);

          if (modelName === modelsToTry[modelsToTry.length - 1]) {
            throw new Error(`Todos os modelos falharam no step ${step.order}. Erro final: ${modelError.message}`);
          }

          console.log("⏳ [DEBUG] Aguardando 2s antes do próximo modelo...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      stepOutputs.push(text);
    }

    return res.json({
      success: true,
      data: {
        chainId,
        steps,
        outputs: stepOutputs,
      },
    });
  } catch (error: any) {
    console.error("❌ Erro ao executar prompt chain:", error);
    return res.status(500).json({ success: false, message: "Erro ao executar prompt chain.", error: error.message });
  }
});

export default router;
