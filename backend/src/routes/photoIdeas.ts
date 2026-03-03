import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../config/database";
import { updateTokenUsage } from "../utils/tokenTracker";

const router = Router();

// Rota para gerar ideias de fotos baseadas na campanha do mês
router.post("/generate-photo-ideas", async (req: Request, res: Response) => {
  console.log("\n📸 [DEBUG] ROTA /generate-photo-ideas ACIONADA");

  try {
    const { clienteId, mes, briefing, quantity } = req.body;

    if (!clienteId || !mes) {
      return res.status(400).json({
        success: false,
        error: "clienteId e mes são obrigatórios"
      });
    }

    console.log(`➡️ [DEBUG] Cliente ID: ${clienteId}, Mês: ${mes}, Quantidade: ${quantity || 3}`);

    // 1. Buscar Branding do Cliente
    console.log("🔍 [DEBUG] Buscando branding...");
    const brandingResult = await db.query(
      "SELECT * FROM branding WHERE cliente_id = $1 ORDER BY updated_at DESC LIMIT 1",
      [clienteId]
    );

    const branding = brandingResult.rows[0] || {
      visual_style: "Padrão",
      tone_of_voice: "Neutro",
      audience: "Geral",
      niche: "Geral"
    };

    // 2. Buscar Regras de Marca
    const rulesResult = await db.query(
      "SELECT * FROM brand_rules WHERE cliente_id = $1",
      [clienteId]
    );
    const brandRules = rulesResult.rows.map(r => r.rule_text).join(", ");

    // 3. Buscar Datas Comemorativas do Mês
    const datasResult = await db.query(
      "SELECT * FROM datas_comemorativas WHERE mes = $1",
      [mes]
    );
    const datasComemorativas = datasResult.rows.map(d => d.nome).join(", ");

    // 4. Construir Prompt para IA
    const prompt = `Você é um especialista em fotografia para redes sociais e marketing digital.

**CONTEXTO DO CLIENTE:**
- Nicho: ${branding.niche || "Não especificado"}
- Estilo Visual: ${JSON.stringify(branding.visual_style)}
- Tom de Voz: ${JSON.stringify(branding.tone_of_voice)}
- Público-Alvo: ${JSON.stringify(branding.audience)}
- Palavras-chave: ${JSON.stringify(branding.keywords)}
${brandRules ? `- Regras de Marca: ${brandRules}` : ""}

**MÊS DA CAMPANHA:** ${mes}
${datasComemorativas ? `**DATAS COMEMORATIVAS:** ${datasComemorativas}` : ""}
${briefing ? `**BRIEFING ADICIONAL:** ${briefing}` : ""}

**TAREFA:**
Gere ${quantity || 3} ideias criativas de fotos para este cliente, considerando a campanha do mês.

Para cada ideia, especifique:
1. **Tipo de Foto**: (Institucional, Produto, Humanizada, Bastidores, Lifestyle, etc.)
2. **Conceito**: Descrição clara do que fotografar
3. **Elementos Visuais**: O que deve aparecer na foto
4. **Objetivo**: Qual mensagem ou sentimento transmitir
5. **Dica Técnica**: Sugestão de iluminação, ângulo ou composição

Retorne APENAS um JSON válido neste formato:
{
  "photo_ideas": [
    {
      "tipo": "Institucional",
      "conceito": "Descrição do conceito",
      "elementos_visuais": "O que deve aparecer",
      "objetivo": "Mensagem a transmitir",
      "dica_tecnica": "Sugestão técnica"
    }
  ]
}`;

    console.log("🤖 [DEBUG] Enviando para Gemini...");

    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY não configurada");
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    let result;
    let responseText = "";

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
          console.log(`📊 [TOKENS PHOTO IDEAS] Modelo: ${modelName}`);
          console.log(`📊 [TOKENS PHOTO IDEAS] Prompt Tokens: ${usageMetadata.promptTokenCount || 0}`);
          console.log(`📊 [TOKENS PHOTO IDEAS] Completion Tokens: ${usageMetadata.candidatesTokenCount || 0}`);
          console.log(`📊 [TOKENS PHOTO IDEAS] Total Tokens: ${usageMetadata.totalTokenCount || 0}`);

          // Atualizar contador de tokens do cliente
          await updateTokenUsage(clienteId, usageMetadata, "photo_ideas_generation", modelName);
        }

        console.log(`✅ [DEBUG] Sucesso com ${modelName}`);
        break;
      } catch (modelError: any) {
        console.warn(`⚠️ [DEBUG] ${modelName} falhou:`, modelError.message);

        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          throw new Error(`Todos os modelos falharam. Erro final: ${modelError.message}`);
        }

        console.log("⏳ [DEBUG] Aguardando 2s antes do próximo modelo...");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log("📝 [DEBUG] Resposta recebida (primeiros 500 chars):", responseText.substring(0, 500));

    // 5. Extrair JSON da resposta
    let jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    }

    const photoIdeas = JSON.parse(jsonStr);

    console.log("✅ [DEBUG] Ideias de fotos geradas com sucesso");

    return res.json({
      success: true,
      data: photoIdeas
    });

  } catch (error: any) {
    console.error("❌ Erro ao gerar ideias de fotos:", error);

    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return res.status(500).json({
        success: false,
        error: "A IA retornou um formato inválido. Tente novamente."
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao gerar ideias de fotos"
    });
  }
});

export default router;
