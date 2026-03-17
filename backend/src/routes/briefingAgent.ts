import { Router, Request, Response } from "express";
import db from "../config/database";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiModelCandidates } from "../utils/googleModels";
import { updateTokenUsage } from "../utils/tokenTracker";

const router = Router();

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface CampaignContext {
  goal: string;
  selectedMonths: string[];
  contentMix?: string;
  commemorativeDates?: string;
  restrictions?: string;
}

function buildSystemPrompt(params: {
  goal: string;
  months: string;
  niche: string;
  tone: string;
  audience: string;
  products: string;
  usp: string;
  keywords: string;
  contentMix: string;
  comemDates: string;
  restrictions: string;
}): string {
  const knownContext = [
    params.goal && `- Objetivo da campanha: ${params.goal}`,
    params.months && `- Meses selecionados: ${params.months}`,
    params.contentMix && `- Mix de conteúdo já definido: ${params.contentMix}`,
    params.comemDates && `- Datas comemorativas relevantes: ${params.comemDates}`,
    params.restrictions && `- Restrições já informadas: ${params.restrictions}`,
    params.niche && `- Nicho do cliente: ${params.niche}`,
    params.tone && `- Tom de voz da marca: ${params.tone}`,
    params.audience && `- Público-alvo base: ${params.audience}`,
    params.products && `- Produtos/serviços cadastrados: ${params.products}`,
    params.usp && `- Proposta de valor (USP): ${params.usp}`,
    params.keywords && `- Palavras-chave da marca: ${params.keywords}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `Você é um estrategista sênior de conteúdo digital especializado em criar briefings excepcionais para calendários editoriais de marketing.

## Contexto já disponível (NÃO pergunte sobre estes itens — você já sabe)
${knownContext || "Nenhum contexto adicional disponível."}

## Sua missão
Conduzir uma conversa natural e direta para montar um briefing completo — estratégico E operacional. Você alterna entre perguntas de alto nível (estratégia, posicionamento) e perguntas práticas (formatos, quantidade de posts, foco do mês). Pense como um estrategista que também sabe o que o time de produção precisa.

## Dimensões que você precisa entender (de forma adaptativa — não em ordem fixa)

### Estratégicas
- **objetivo**: o que esta campanha precisa entregar de resultado para o negócio?
- **publico_ideal**: quem especificamente deve ser movido por este conteúdo?
- **diferencial**: o que torna esta marca/produto irresistível neste período?
- **produto_foco**: qual produto/serviço será o protagonista?
- **nao_fazer**: restrições absolutas — temas, tons, posicionamentos proibidos
- **tom_emocional**: como o público deve se sentir ao consumir este conteúdo?
- **referencias**: marcas ou estilos que inspiram (ou devem ser evitados)

### Operacionais (tão importantes quanto as estratégicas)
- **foco_periodo**: tem algo específico neste(s) mês(es) que deve dominar o conteúdo? (lançamento, data comemorativa, promoção)
- **restricoes_visuais**: cores, elementos ou estilos que NÃO podem aparecer

IMPORTANTE: Os formatos, quantidades e restrições já foram definidos pelo usuário antes do chat. NÃO pergunte sobre número de posts, formatos (Reels, Arte, etc.) ou restrições que já constam no contexto acima. Foque em estratégia, diferencial, posicionamento e tom emocional.

## Regras de condução (OBRIGATÓRIAS)
1. **NUNCA faça mais de uma pergunta por mensagem** — escolha a de maior valor
2. **Comece com uma pergunta aberta e convidativa**, não com formulário. Exemplos de boas aberturas:
   - "Para começar — o que você quer que seja o conteúdo deste mês para essa marca? Pode ser bem livre."
   - "Qual é o grande objetivo dessa campanha? O que você quer que aconteça de diferente depois que ela rodar?"
   - "Me conta: tem algum lançamento, promoção ou data especial nesse período que precisa ser o centro do calendário?"
3. **Misture perguntas estratégicas e operacionais** — não foque só em estratégia. Exemplos de perguntas práticas:
   - "Quais formatos você prefere para esse mês? (Reels, carrosséis, artes estáticas...)"
   - "Quantos posts você está pensando? Tem uma cadência ideal em mente?"
   - "Prefere focar em um tema central ou diversificar os assuntos?"
4. **Após cada resposta, faça UMA das seguintes ações** (nesta ordem de prioridade):
   a) Se a resposta levantou algo intrigante → aprofunde antes de mudar de assunto
   b) Se a resposta foi vaga → reformule com contexto específico da marca
   c) Se você inferiu uma hipótese → verbalize e peça confirmação
   d) Se falta uma dimensão importante → pergunte de forma conversacional
5. **Pule o que já está claro** pelo contexto disponível
6. Após 5-6 trocas com informações suficientes, **ou obrigatoriamente após 8 trocas**, sintetize o briefing

## Formato de síntese (use exatamente quando for finalizar)

Aqui está o briefing que construímos juntos:

[BRIEFING_READY]
**CONTEXTO ESTRATÉGICO**
{síntese do objetivo de negócio e o que a campanha precisa entregar — 2-3 frases}

**PÚBLICO-ALVO PRIMÁRIO**
{quem deve ser movido por este conteúdo — com nuances da conversa}

**DIFERENCIAL E POSICIONAMENTO**
{o que torna esta marca/produto único e irresistível neste período}

**FOCO DE PRODUTO/SERVIÇO**
{o que será protagonista no conteúdo deste calendário}

**ESPECIFICAÇÕES OPERACIONAIS**
{formatos preferidos, volume de posts, cadência e foco do período — conforme combinado}

**TOM E EMOÇÃO DESEJADA**
{como o público deve se sentir ao consumir este conteúdo}

**RESTRIÇÕES EDITORIAIS**
{o que não fazer — temas, tom, visuais e posicionamentos proibidos}

**REFERÊNCIAS E INSPIRAÇÕES**
{marcas, estilos ou conteúdos que servem de bússola}
[/BRIEFING_READY]`;
}

// POST /api/briefing-agent/chat
router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { clientId, messages, campaignContext } = req.body as {
      clientId: string;
      messages: ChatMessage[];
      campaignContext: CampaignContext;
    };

    if (!clientId || !Array.isArray(messages) || !campaignContext) {
      return res.status(400).json({ error: "clientId, messages e campaignContext são obrigatórios." });
    }

    // 1. Fetch client branding context
    let niche = "", tone = "", audience = "", products = "", usp = "", keywords = "";
    try {
      const b = await db.query("SELECT * FROM branding WHERE cliente_id = $1", [clientId]);
      if (b.rows[0]) {
        const row = b.rows[0];
        niche = row.niche || "";
        const toneObj = row.tone_of_voice;
        tone = typeof toneObj === "string" ? toneObj : (toneObj?.description || JSON.stringify(toneObj || ""));
        const audienceObj = row.audience;
        audience = typeof audienceObj === "string" ? audienceObj : (audienceObj?.persona || JSON.stringify(audienceObj || ""));
        usp = row.usp || "";
        keywords = Array.isArray(row.keywords) ? row.keywords.join(", ") : (row.keywords || "");
      }
      const p = await db.query(
        "SELECT nome FROM produtos WHERE cliente_id = $1 AND ativo = true LIMIT 6",
        [clientId]
      );
      products = p.rows.map((r: any) => r.nome).join(", ");
    } catch {
      // proceed without context
    }

    // 2. Build system prompt
    const systemPrompt = buildSystemPrompt({
      goal: campaignContext.goal || "",
      months: (campaignContext.selectedMonths || []).join(", "),
      contentMix: campaignContext.contentMix || "",
      comemDates: campaignContext.commemorativeDates || "",
      restrictions: campaignContext.restrictions || "",
      niche,
      tone,
      audience,
      products,
      usp,
      keywords,
    });

    // 3. Build history, force synthesis at 8 user turns
    const userTurnCount = messages.filter((m) => m.role === "user").length;
    const historyToSend: ChatMessage[] = [...messages];
    if (userTurnCount >= 8) {
      historyToSend.push({
        role: "user",
        content:
          "[INSTRUÇÃO DO SISTEMA: Você atingiu o limite de trocas. Sintetize agora o briefing com todas as informações coletadas, usando o formato [BRIEFING_READY]...[/BRIEFING_READY].]",
      });
    }

    // 4. Call Gemini with full conversation history
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GOOGLE_API_KEY não configurada." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelsToTry = getGeminiModelCandidates("fast");
    let reply = "";

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });

        let result;
        if (historyToSend.length === 0) {
          // Primeira chamada: pedir ao agente que inicie a conversa
          result = await model.generateContent(
            "Inicie a conversa com sua primeira pergunta estratégica de alto valor."
          );
        } else {
          const contents = historyToSend.map((m) => ({
            role: m.role,
            parts: [{ text: m.content }],
          }));
          result = await model.generateContent({ contents });
        }
        reply = result.response.text();
        if (result.response.usageMetadata) {
          await updateTokenUsage(clientId, result.response.usageMetadata, 'briefing_agent_chat', modelName);
        }
        break;
      } catch (err: any) {
        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          throw err;
        }
      }
    }

    // 5. Detect [BRIEFING_READY] marker
    const match = reply.match(/\[BRIEFING_READY\]([\s\S]*?)\[\/BRIEFING_READY\]/);
    if (match && match[1]) {
      return res.json({ reply, done: true, briefing: match[1].trim() });
    }

    return res.json({ reply, done: false });
  } catch (error: any) {
    console.error("[BriefingAgent] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro interno no agente de briefing." });
  }
});

export default router;
