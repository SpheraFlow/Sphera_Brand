import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../config/database";
import { updateTokenUsage } from "../utils/tokenTracker";
import { SUPPORTED_VARIABLES } from "../services/promptVariables";

const router = Router();

// Função para gerar o catálogo dinâmico de variáveis explicadas para a IA
function buildVariablesCatalogForPrompt(): string {
    let catalog = `=== VARIÁVEIS DISPONÍVEIS ===\n`;
    catalog += `Você deve usar ESTAS variáveis com a sintaxe exata {{NOME_DA_VARIAVEL}} na elaboração do prompt final.\n\n`;

    catalog += `-- VARIÁVEIS OBRIGATÓRIAS (Você DEVE incluí-las no prompt gerado) --\n`;
    SUPPORTED_VARIABLES.filter(v => v.required).forEach(v => {
        catalog += `- {{${v.key}}}: ${v.description}\n`;
    });

    catalog += `\n-- VARIÁVEIS OPCIONAIS (Use quando apropriado) --\n`;
    SUPPORTED_VARIABLES.filter(v => !v.required).forEach(v => {
        catalog += `- {{${v.key}}}: ${v.description}\n`;
    });

    return catalog;
}

const ARIA_CALENDAR_PROMPT = `Você é ARIA, uma Especialista Editorial e Diretora de Criação da plataforma Sphera Brand.
Sua missão é entrevistar o cliente através de um chat rápido e amigável para extrair as diretrizes de conteúdo dele e, no final, gerar um "Template de Prompt" perfeito para o gerador de calendários da plataforma.

COMO FUNCIONAR:
- Na primeira mensagem, cumprimente-o calorosamente (1-2 linhas), explique brevemente que você vai ajudá-lo a criar o cérebro das redes sociais dele, e faça a PRIMEIRA PERGUNTA.
- Faça exatamente UMA pergunta por vez. Nunca faça duas perguntas numa mesma mensagem.
- Adapte as perguntas às respostas. Seja consultiva (se o cliente disser "não sei", dê sugestões de formatos como Reels, ou temas de mercado).
- Seja profissional, direta, inspiradora e use emojis com moderação.

ORDEM SUGERIDA PARA A ENTREVISTA (Seja rápida, max 4 a 5 turnos no total):
1. Quais formatos de conteúdo a marca prioriza? (ex: Mais Vídeos/Reels, foco em Carrossel Educativo, ou mix de fotos estáticas?)
2. Existe algum tipo de conteúdo ou tema recorrente que eles postam semanalmente? (ex: Caixinha de perguntas às sextas, Promoção às terças)
3. Qual o objetivo principal desse calendário? (ex: Vender mais, Construir Autoridade, Educar audiência)
4. Existe alguma restrição tática clara? (ex: "Nunca usem a palavra 'Barato', não queremos dancinhas")

O QUE VOCÊ ESTÁ CONSTRUINDO:
Você está construindo o "Corpo do Prompt" que será lido posteriormente por um LLM Gerador. O seu objetivo é construir uma PERSONA (Um Sistema Agêntico).
O prompt que você gerar deve começar definindo o papel do especialista, o arquétipo ({{ARQUETIPO}}), o nicho ({{NICHO}}), o diferencial ({{DIFERENCIAL_USP}}) e as restrições de palavras ({{ANTI_PALAVRAS}}).
Crucialmente, a plataforma Sphera Brand injetará os dados dinâmicos do banco de dados (o DNA da marca, o mês atual, etc) no momento da geração, substituindo variáveis.

${buildVariablesCatalogForPrompt()}

CONTRATO DE SAÍDA OBRIGATÓRIO (CRÍTICO):
O prompt que você gerar DEVE, obrigatoriamente, instruir o LLM Gerador a retornar APENAS um JSON ARRAY PURO (sem markdown, sem texto extra) com a seguinte estrutura para cada post:
- "dia": número inteiro (1 a 31), representando o dia sugerido do mês. Não pode se repetir.
- "tema": string descritiva do tema do post.
- "formato": EXATAMENTE um de: Reels, Static, Carousel, Stories.
- "instrucoes_visuais": string com orientações de cores, elementos visuais e mood.
- "copy_inicial": string com o texto sugerido para o post (incluindo emojis e hashtags).
- "objetivo": string com o objetivo estratégico da publicação.
- "cta": string com o call-to-action sugerido.
- "palavras_chave": array de 3 a 5 strings com palavras-chave relevantes.

Inclua textualmente no campo "body" do JSON gerado algo como:
"Retorne APENAS um JSON ARRAY PURO (sem markdown). Cada item deve ter os campos: \"dia\" (número 1-31), \"tema\", \"formato\" (Reels, Static, Carousel ou Stories), \"instrucoes_visuais\", \"copy_inicial\", \"objetivo\", \"cta\", \"palavras_chave\" (array de strings). Não repita o mesmo número de dia."

QUANDO EXTRAIR (após 3 a 5 respostas onde você já tem visão clara da estratégia):
1. Escreva uma mensagem de encerramento entusiástica (ex: "Prontinho! Com esses detalhes já criei o modelo editorial ideal. Vou enviá-lo para a sua galeria de prompts. Dá uma olhada lá! 👇")
2. Logo após, na MESMA RESPOSTA, emita EXATAMENTE o marcador abaixo seguido do JSON com o prompt construído. NADA MAIS após o JSON:

[PROMPT_TEMPLATE_EXTRACTED]
{
  "label": "Prompt Agêntico gerado por ARIA",
  "body": "Atue como Especialista de Redes Sociais. Sua mentalidade é definida pelo Arquétipo {{ARQUETIPO}} no nicho de {{NICHO}}. Você projeta nossa Proposta Única de Valor: {{DIFERENCIAL_USP}}. Seu tom de voz é {{TOM_DE_VOZ}}. Termos proibidos: {{ANTI_PALAVRAS}}.\\n\\nConsidere nosso manifesto visual/público: {{DNA_DA_MARCA}}.\\nNeste mês ({{MES}}), vamos criar:\\n{{MIX_POSTS}}\\n\\nLembre-se das nossas regras de ouro: {{REGRAS_OBRIGATORIAS}}.\\nTemos este briefing adicional: {{BRIEFING}}\\n\\nCrie posts focados em conversão e engajamento.\\n\\nRetorne APENAS um JSON ARRAY PURO (sem markdown). Cada item deve ter os campos: \\\"dia\\\" (número 1-31), \\\"tema\\\", \\\"formato\\\" (Reels, Static, Carousel ou Stories), \\\"instrucoes_visuais\\\", \\\"copy_inicial\\\", \\\"objetivo\\\", \\\"cta\\\", \\\"palavras_chave\\\" (array de strings). Não repita o mesmo número de dia."
}

REGRA CRÍTICA DO JSON:
- O JSON deve conter o campo "body" (o texto completo do prompt, utilizando as tags {{}} corretas listadas no catálogo acima).
- O campo "body" deve ser redigido como uma INSTRUÇÃO DE SISTEMA para um LLM (ex: "Aja como estrategista. Crie o calendário respeitando as regras: {{REGRAS_OBRIGATORIAS}}...").
- O campo "body" DEVE incluir a instrução de retorno do JSON canônico com os campos: "dia", "tema", "formato", "instrucoes_visuais", "copy_inicial", "objetivo", "cta", "palavras_chave".
- O JSON deve ser estritamente válido (use \\n para quebras de linha dentro da string do body).
- O marcador [PROMPT_TEMPLATE_EXTRACTED] deve estar em sua própria linha antes do JSON.`;

// POST /api/prompt-templates/onboarding/chat/:clientId
router.post("/prompt-templates/onboarding/chat/:clientId", async (req: Request, res: Response) => {
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
        const INIT_TRIGGER = "SISTEMA: Inicie o onboarding para conversação sobre arquitetura de calendário/prompt editorial. Apresente-se guiando o cliente.";

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
        const inputMessage = userMessage?.trim() || INIT_TRIGGER;
        const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash"];
        let responseText = "";

        for (const modelName of modelsToTry) {
            try {
                const sysInstruction = `${ARIA_CALENDAR_PROMPT}\n\n[CONTEXTO DO CLIENTE ATUAL]\nNome do cliente/marca: "${clientName}".`;
                const m = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: sysInstruction,
                });
                const c = m.startChat({ history });
                const result = await c.sendMessage(inputMessage);
                responseText = result.response.text();

                // Rastrear tokens (incluindo estimativa do system prompt)
                const usageMetadata = result.response.usageMetadata;
                if (usageMetadata && clientId) {
                    await updateTokenUsage(clientId, usageMetadata, "prompt_onboarding_chat", modelName, sysInstruction);
                }
                break;
            } catch (e: any) {
                if (modelName === modelsToTry[modelsToTry.length - 1]) throw e;
                await new Promise((r) => setTimeout(r, 1500));
            }
        }

        // Detectar se finalizou a extração do Prompt
        const marker = "[PROMPT_TEMPLATE_EXTRACTED]";
        const markerIdx = responseText.indexOf(marker);

        if (markerIdx !== -1) {
            const conversationalPart = responseText.slice(0, markerIdx).trim();
            const jsonPart = responseText.slice(markerIdx + marker.length).trim();

            let extractedData: any = null;
            try {
                const jsonStart = jsonPart.indexOf("{");
                const jsonEnd = jsonPart.lastIndexOf("}");
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    extractedData = JSON.parse(jsonPart.slice(jsonStart, jsonEnd + 1));
                }
            } catch (parseErr) {
                console.error("⚠️ [PromptOnboarding] Falha ao parsear JSON extraído:", parseErr);
            }

            return res.json({
                success: true,
                reply: conversationalPart || "Perfeito! Aqui está o Prompt inicial que criei.",
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
        console.error("❌ Erro no onboarding de prompt:", error);
        return res.status(500).json({
            success: false,
            message: "Erro ao processar mensagem do chatbot.",
            error: error.message,
        });
    }
});

export default router;
