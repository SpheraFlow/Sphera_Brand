import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";

/**
 * Cliente para interagir com Google Gemini API
 */
class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey || apiKey === "your_google_api_key_here") {
      console.warn("⚠️  GOOGLE_API_KEY não configurada. A rota /process-post não funcionará.");
      // Não quebrar o servidor, apenas avisar
      this.genAI = null as any;
      this.model = null as any;
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    // Usando gemini-2.5-flash (versão atualizada) para multimodalidade (imagem + texto)
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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
      throw new Error("GOOGLE_API_KEY não configurada. Configure no .env para usar esta funcionalidade.");
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
      
      const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-pro-latest", "gemini-1.5-flash-latest"];

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
      throw new Error("GOOGLE_API_KEY não configurada. Configure no .env para usar esta funcionalidade.");
    }

    try {
      let result;
      let text = "";
      
      const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-pro-latest", "gemini-1.5-flash-latest"];

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

