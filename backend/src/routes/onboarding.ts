import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../config/database";
import { updateTokenUsage } from "../utils/tokenTracker";

const router = Router();

const ARIA_SYSTEM_PROMPT = `Você é ARIA, uma especialista em branding e estratégia de marca da plataforma Sphera Brand. Sua missão é conduzir um onboarding conversacional para extrair o DNA completo de uma marca de forma natural, empática e eficiente.

COMO FUNCIONAR:
- Na primeira mensagem, apresente-se brevemente (1-2 linhas) e faça imediatamente a PRIMEIRA PERGUNTA.
- Faça exatamente UMA pergunta por vez. Nunca faça duas perguntas numa mesma mensagem.
- Adapte as perguntas às respostas anteriores — seja contextual, não mecânica.
- Seja profissional, direta e levemente calorosa. Use emojis com moderação.
- Respostas curtas ou vagas: peça um pouco mais de detalhe antes de prosseguir.

ORDEM SUGERIDA DE TÓPICOS (adapte conforme a conversa):
1. Nome da marca e o que ela faz (produto/serviço principal)
2. Público-alvo: quem é, faixa etária, profissão, dores, desejos
3. Tom de voz e personalidade da comunicação (formal/informal, sério/divertido etc.)
4. Identidade visual: cores principais, referências visuais, estilo
5. Diferenciais e proposta de valor (o que a torna única?)
6. Palavras-chave que definem a marca e palavras/temas que NUNCA devem aparecer

CAMPOS QUE PRECISAM SER EXTRAÍDOS:
- visual_style: cores (hex quando possível), fontes, descrição do estilo visual
- tone_of_voice: descrição do tom e lista de palavras que definem a voz
- audience: persona detalhada e dados demográficos
- keywords: 5-10 palavras-chave estratégicas
- archetype: arquétipo Jungiano da marca (escolha um: Inocente, Órfão, Herói, Cuidador, Explorador, Rebelde, Amante, Criador, Bobo, Sábio, Mago, Governante)
- usp: proposta única de valor (1-2 frases objetivas)
- anti_keywords: palavras e temas que a marca evita
- niche: nicho de mercado específico

QUANDO EXTRAIR (após pelo menos 5 respostas do usuário que cubram a maioria dos campos):
1. Escreva uma mensagem de encerramento natural e positiva (ex: "Perfeito! Com tudo isso em mãos, consegui montar o DNA inicial da sua marca. Dá uma olhada e ajuste o que precisar 👇")
2. Logo após, emita EXATAMENTE o marcador abaixo seguido do JSON. NADA mais após o JSON:

[BRANDING_EXTRACTED]
{
  "visual_style": { "colors": ["#HEX1", "#HEX2"], "fonts": ["Fonte Principal"], "archeType": "descrição do estilo visual" },
  "tone_of_voice": { "description": "descrição completa e rica do tom de voz", "keywords": ["palavra1", "palavra2"] },
  "audience": { "persona": "descrição detalhada da persona", "demographics": "faixa etária, localização, profissão etc." },
  "keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "archetype": "nome do arquétipo",
  "usp": "proposta de valor única e clara",
  "anti_keywords": ["evitar1", "evitar2"],
  "niche": "nicho específico"
}

REGRA CRÍTICA: O marcador [BRANDING_EXTRACTED] deve estar em sua própria linha e o JSON deve ser válido. Não adicione nada após o JSON.`;

// POST /api/onboarding/chat/:clientId
router.post("/onboarding/chat/:clientId", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { messages, userMessage } = req.body as {
      messages: Array<{ role: "user" | "model"; content: string }>;
      userMessage?: string;
    };

    if (!process.env.GOOGLE_API_KEY) {
      return res.status(500).json({ success: false, message: "Configuração de IA ausente." });
    }

    // Verificar se cliente existe
    const clientResult = await db.query("SELECT id, nome FROM clientes WHERE id = $1", [clientId]);
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Cliente não encontrado." });
    }
    const clientName = clientResult.rows[0].nome as string;

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

    // Construir histórico para o chat
    // Mensagem de gatilho usada na chamada inicial (quando não havia userMessage)
    const INIT_TRIGGER = "SISTEMA: Inicie o onboarding. Apresente-se e faça a primeira pergunta.";

    // Construir histórico Gemini
    // O Gemini exige que o histórico comece SEMPRE com role 'user'.
    // Como a primeira mensagem salva no frontend é a saudação da ARIA (role: 'model'),
    // re-inserimos o gatilho inicial como user logo antes dela.
    let rawHistory = (messages || []).map((m) => ({
      role: m.role as "user" | "model",
      parts: [{ text: m.content }],
    }));

    if (rawHistory.length > 0 && rawHistory[0]?.role === "model") {
      rawHistory = [
        { role: "user", parts: [{ text: INIT_TRIGGER }] },
        ...rawHistory,
      ];
    }

    const history = rawHistory;

    // Se não há mensagem do usuário, é a chamada de início — ARIA se apresenta
    const inputMessage = userMessage?.trim() || INIT_TRIGGER;

    const modelsToTry = ["gemini-3-flash-preview", "gemini-2.5-flash"];
    let responseText = "";

    for (const modelName of modelsToTry) {
      try {
        const sysInstruction = `${ARIA_SYSTEM_PROMPT}\n\nNome do cliente/marca: "${clientName}".`;
        const m = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: sysInstruction,
        });
        const c = m.startChat({ history });
        const result = await c.sendMessage(inputMessage);
        responseText = result.response.text();

        // Rastrear tokens gastos neste turno do onboarding (incluindo estimativa do system prompt)
        const usageMetadata = result.response.usageMetadata;
        if (usageMetadata && clientId) {
          await updateTokenUsage(clientId, usageMetadata, "onboarding_chat", modelName, sysInstruction);
        }
        break;
      } catch (e: any) {
        if (modelName === modelsToTry[modelsToTry.length - 1]) throw e;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Detectar se o ARIA finalizou e incluiu o JSON
    const marker = "[BRANDING_EXTRACTED]";
    const markerIdx = responseText.indexOf(marker);

    if (markerIdx !== -1) {
      // Separar a mensagem conversacional do JSON
      const conversationalPart = responseText.slice(0, markerIdx).trim();
      const jsonPart = responseText.slice(markerIdx + marker.length).trim();

      let extractedData: any = null;
      try {
        // Limpar e parsear o JSON
        const jsonStart = jsonPart.indexOf("{");
        const jsonEnd = jsonPart.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          extractedData = JSON.parse(jsonPart.slice(jsonStart, jsonEnd + 1));
        }
      } catch (parseErr) {
        console.error("⚠️ [Onboarding] Falha ao parsear JSON extraído:", parseErr);
        // Continua sem os dados extraídos — frontend pedirá para tentar novamente
      }

      return res.json({
        success: true,
        reply: conversationalPart || "Perfeito! Aqui está o DNA extraído da sua marca. Revise e ajuste o que precisar.",
        isComplete: extractedData !== null,
        extractedData,
      });
    }

    return res.json({
      success: true,
      reply: responseText,
      isComplete: false,
    });
  } catch (error: any) {
    console.error("❌ Erro no onboarding chat:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao processar mensagem.",
      error: error.message,
    });
  }
});

export default router;
