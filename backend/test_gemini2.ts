import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

async function run() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Atue como Strategist Planner de marketing digital.
Crie um Planejamento de Conteúdo contendo EXATAMENTE esta quantidade de posts:
- 2 posts ESTÁTICOS.

Mês: Março. Data Ref: 2026-03-01.

DNA DA MARCA:
- Tom: Neutro
- Visual: Padrão
- Público: Geral

DATAS COMEMORATIVAS:
- 08/03/2026: Dia Internacional da Mulher

Retorne SOMENTE um JSON ARRAY PURO (sem markdown, sem texto extra antes ou depois):
[
  {
    "dia": 1,
    "tema": "string — tema central do post",
    "formato": "Reels|Static|Carousel|Stories",
    "instrucoes_visuais": "string — descrição visual detalhada",
    "copy_inicial": "string — texto de abertura do post",
    "objetivo": "string — objetivo de marketing (ex: engajamento, awareness)",
    "cta": "string — chamada para ação",
    "palavras_chave": ["string", "string"]
  }
]`;

    try {
        const result = await model.generateContent(prompt);
        fs.writeFileSync("gemini_output.txt", result.response.text());
        console.log("DONE");
    } catch (e) {
        console.error(e);
    }
}
run();
