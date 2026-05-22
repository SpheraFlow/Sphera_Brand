/**
 * Shim de compatibilidade: substitui @google/generative-ai pelo Vertex AI SDK.
 * Mantém a mesma interface pública (GoogleGenerativeAI, SchemaType) para que
 * todos os arquivos existentes funcionem sem reescritas profundas.
 */
import { VertexAI } from "@google-cloud/vertexai";

// Espelha os valores usados no projeto — Vertex AI aceita as mesmas strings
export enum SchemaType {
  STRING = "STRING",
  NUMBER = "NUMBER",
  INTEGER = "INTEGER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  OBJECT = "OBJECT",
}

function createVertexAI(): VertexAI {
  const project =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.VERTEX_PROJECT_ID ||
    process.env.GCLOUD_PROJECT;

  if (!project) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT não configurado. Defina no .env para usar o Vertex AI."
    );
  }

  const location =
    process.env.GOOGLE_CLOUD_LOCATION ||
    process.env.VERTEX_LOCATION ||
    "us-central1";

  return new VertexAI({ project, location });
}

function normalizeInput(input: unknown): object {
  if (typeof input === "string") {
    return { contents: [{ role: "user", parts: [{ text: input }] }] };
  }

  if (Array.isArray(input)) {
    const parts = input.map((item) => {
      if (typeof item === "string") return { text: item };
      // inlineData (imagens base64) — formato idêntico entre os dois SDKs
      if (item && typeof item === "object" && "inlineData" in item) return item;
      return item;
    });
    return { contents: [{ role: "user", parts }] };
  }

  // Já está no formato completo { contents: [...] }
  return input as object;
}

function extractText(response: unknown): string {
  const r = response as any;
  const candidates = r?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return "";
  return parts.map((p: any) => p.text ?? "").join("");
}

function wrapResult(result: any): any {
  return {
    response: {
      text: () => extractText(result.response),
      usageMetadata: result.response?.usageMetadata ?? null,
      candidates: result.response?.candidates ?? [],
    },
  };
}

class WrappedChatSession {
  constructor(private vertexChat: any) {}

  async sendMessage(input: unknown): Promise<any> {
    // Vertex AI sendMessage aceita string ou Part[]
    const result = await this.vertexChat.sendMessage(input);
    return wrapResult(result);
  }
}

class WrappedGenerativeModel {
  constructor(private vertexModel: any) {}

  async generateContent(input: unknown): Promise<any> {
    const request = normalizeInput(input);
    const result = await this.vertexModel.generateContent(request);
    return wrapResult(result);
  }

  async generateContentStream(input: unknown): Promise<any> {
    const request = normalizeInput(input);
    return this.vertexModel.generateContentStream(request);
  }

  startChat(options?: { history?: unknown[]; generationConfig?: unknown }): WrappedChatSession {
    const chat = this.vertexModel.startChat(options ?? {});
    return new WrappedChatSession(chat);
  }
}

export class GoogleGenerativeAI {
  private vertexAI: VertexAI;

  // O parâmetro apiKey é ignorado — auth feita via ADC (GOOGLE_APPLICATION_CREDENTIALS)
  constructor(_apiKey?: string) {
    this.vertexAI = createVertexAI();
  }

  getGenerativeModel(config: {
    model: string;
    generationConfig?: Record<string, unknown>;
    systemInstruction?: unknown;
    tools?: unknown;
    safetySettings?: unknown;
  }): WrappedGenerativeModel {
    const vertexModel = this.vertexAI.getGenerativeModel(config as any);
    return new WrappedGenerativeModel(vertexModel);
  }
}
