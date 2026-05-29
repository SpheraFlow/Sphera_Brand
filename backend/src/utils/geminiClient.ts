import { GoogleGenerativeAI } from "./genai-compat";
import { readFileSync } from "fs";
import { getGeminiModelCandidates, getPrimaryGeminiModel } from "./googleModels";

/**
 * Cliente para interagir com Google Gemini API
 */
class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model;

  constructor() {
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID;

    if (!project) {
      console.warn("⚠️  GOOGLE_CLOUD_PROJECT não configurado. A rota /process-post não funcionará.");
      this.genAI = null as any;
      this.model = null as any;
      return;
    }

    this.genAI = new GoogleGenerativeAI();
    this.model = this.genAI.getGenerativeModel({ model: getPrimaryGeminiModel("fast") });
  }

  /**
   * Analisa uma imagem de social media usando Gemini
   * @param filePath Caminho do arquivo de imagem
   * @param prompt Prompt para análise (opcional)
   * @returns Análise da IA em texto
   */
  async analyzeImage(filePath: string, prompt?: string): Promise<string> {
    // Verificar se a API Key está configurada
    if (!this.model) {
      throw new Error("GOOGLE_CLOUD_PROJECT não configurado. Configure no .env para usar esta funcionalidade.");
    }

    try {
      // Ler o arquivo como base64
      const imageBuffer = readFileSync(filePath);
      const base64Image = imageBuffer.toString("base64");

      // Detectar o tipo MIME da imagem
      const mimeType = this.getMimeType(filePath);

      // Prompt padrão para análise de social media
      const defaultPrompt = `Analise esta peça de social media. Extraia estilo visual, tom da marca, elementos importantes, público-alvo, e possíveis categorias de conteúdo.`;

      // Criar conteúdo multimodal (texto + imagem)
      let result;
      let text = "";

      const modelsToTry = getGeminiModelCandidates("quality");

      for (const modelName of modelsToTry) {
        try {
          console.log(`🤖 [DEBUG] Tentando modelo (imagem): ${modelName}...`);
          const model = this.genAI.getGenerativeModel({ model: modelName });

          result = await model.generateContent([
            {
              inlineData: {
                data: base64Image,
                mimeType,
              },
            },
            prompt || defaultPrompt,
          ]);

          const response = result.response;
          text = response.text();
          console.log(`✅ [DEBUG] Sucesso com ${modelName}`);
          break;
        } catch (modelError: any) {
          console.warn(`⚠️ [DEBUG] ${modelName} falhou:`, modelError.message);

          if (modelName === modelsToTry[modelsToTry.length - 1]) {
            throw new Error(`Todos os modelos falharam na análise de imagem. Erro final: ${modelError.message}`);
          }

          console.log("⏳ [DEBUG] Aguardando 2s antes do próximo modelo...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      return text;
    } catch (error) {
      console.error("Erro ao analisar imagem com Gemini:", error);
      throw new Error("Falha ao processar imagem com IA");
    }
  }

  /**
   * Gera conteúdo apenas com texto (sem imagem)
   * @param prompt Prompt de texto
   * @returns Resposta da IA em texto
   */
  async generateTextContent(prompt: string): Promise<string> {
    // Verificar se a API Key está configurada
    if (!this.model) {
      throw new Error("GOOGLE_CLOUD_PROJECT não configurado. Configure no .env para usar esta funcionalidade.");
    }

    try {
      let result;
      let text = "";

      const modelsToTry = getGeminiModelCandidates("quality");

      for (const modelName of modelsToTry) {
        try {
          console.log(`🤖 [DEBUG] Tentando modelo (texto): ${modelName}...`);
          const model = this.genAI.getGenerativeModel({ model: modelName });
          result = await model.generateContent(prompt);

          const response = result.response;
          text = response.text();
          console.log(`✅ [DEBUG] Sucesso com ${modelName}`);
          break;
        } catch (modelError: any) {
          console.warn(`⚠️ [DEBUG] ${modelName} falhou:`, modelError.message);

          if (modelName === modelsToTry[modelsToTry.length - 1]) {
            throw new Error(`Todos os modelos falharam na geração de texto. Erro final: ${modelError.message}`);
          }

          console.log("⏳ [DEBUG] Aguardando 2s antes do próximo modelo...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      return text;
    } catch (error) {
      console.error("Erro ao gerar conteúdo com Gemini:", error);
      throw new Error("Falha ao processar com IA");
    }
  }

  /**
   * Conversa multi-turn com system instruction e histórico (STORY-014).
   * Diferente de generateTextContent (prompt único), expõe usageMetadata para
   * tracking de tokens e usa o modo chat do Vertex AI via genai-compat.startChat().
   *
   * @param options.systemInstruction Instrução de sistema (persona + contexto/DNA + RAG)
   * @param options.history Histórico de turnos anteriores (role user|model)
   * @param options.userMessage Nova mensagem do usuário
   * @returns Texto da resposta + usageMetadata (prompt/candidates/total token counts)
   */
  async generateChatContent(options: {
    systemInstruction: string;
    history: Array<{ role: "user" | "model"; content: string }>;
    userMessage: string;
  }): Promise<{
    text: string;
    usageMetadata: {
      promptTokenCount: number;
      candidatesTokenCount: number;
      totalTokenCount: number;
    };
  }> {
    if (!this.genAI) {
      throw new Error("GOOGLE_CLOUD_PROJECT não configurado. Configure no .env para usar esta funcionalidade.");
    }

    const model = this.genAI.getGenerativeModel({
      model: getPrimaryGeminiModel("quality"),
      systemInstruction: options.systemInstruction,
    });

    // genai-compat.ts implementa startChat({ history }) → WrappedChatSession.
    const chat = model.startChat({
      history: options.history.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
    });

    const result = await chat.sendMessage(options.userMessage);
    const meta = result.response?.usageMetadata ?? {};

    return {
      text: result.response.text(),
      usageMetadata: {
        promptTokenCount: meta.promptTokenCount ?? 0,
        candidatesTokenCount: meta.candidatesTokenCount ?? 0,
        totalTokenCount: meta.totalTokenCount ?? 0,
      },
    };
  }

  /**
   * Detecta o tipo MIME baseado na extensão do arquivo
   * @param filePath Caminho do arquivo
   * @returns MIME type
   */
  private getMimeType(filePath: string): string {
    const extension = filePath.split(".").pop()?.toLowerCase();

    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      mp4: "video/mp4",
      mpeg: "video/mpeg",
    };

    return mimeTypes[extension || ""] || "image/jpeg";
  }
}

// Exportar instância singleton
export const geminiClient = new GeminiClient();

