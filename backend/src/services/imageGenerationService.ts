/**
 * STORY-008 — Serviço de geração de imagem (Imagen 3 via Vertex AI).
 *
 * Provider extensível: a interface `ImageProvider` permite trocar/empilhar
 * backends de geração de imagem no futuro (ex.: outro modelo, outro fornecedor)
 * sem alterar o worker. A implementação atual é `VertexImagenProvider`, que
 * chama o endpoint REST `predict` do modelo Imagen 3 no Vertex AI.
 *
 * Autenticação: mesma credencial GCP usada pelo restante do backend
 * (GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION + ADC via
 * GOOGLE_APPLICATION_CREDENTIALS ou `gcloud auth application-default login`).
 * O token de acesso é obtido via `google-auth-library` (mesma lib que o
 * Vertex SDK usa internamente).
 */
import { GoogleAuth } from "google-auth-library";
import logger from "../utils/logger";

const serviceLog = logger.child({ component: "imageGenerationService" });

export type ImageAspectRatio = "1:1" | "9:16" | "4:5";

export interface ImageOptions {
  aspectRatio: ImageAspectRatio;
  style?: string;
}

export interface ImageResult {
  imageBytes: Buffer;
  mimeType: string;
  costCents: number;
}

export interface ImageProvider {
  generate(prompt: string, options: ImageOptions): Promise<ImageResult>;
}

/**
 * Custo fixo estimado por imagem Imagen 3 (em centavos de dólar).
 * Configurável via env IMAGEN_3_COST_CENTS — NÃO hardcoded no worker.
 */
export const IMAGEN_3_COST_CENTS = (() => {
  const parsed = parseInt(String(process.env.IMAGEN_3_COST_CENTS || ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 4;
})();

const IMAGEN_MODEL = process.env.VERTEX_IMAGEN_MODEL || "imagegeneration@006";

const getProject = (): string => {
  const project =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.VERTEX_PROJECT_ID ||
    process.env.GCLOUD_PROJECT;
  if (!project) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT não configurado. Defina no .env para usar o Vertex AI Imagen."
    );
  }
  return project;
};

const getLocation = (): string =>
  process.env.GOOGLE_CLOUD_LOCATION ||
  process.env.VERTEX_LOCATION ||
  "us-central1";

/**
 * Implementação Vertex AI Imagen 3 via REST predict endpoint.
 */
export class VertexImagenProvider implements ImageProvider {
  private auth: GoogleAuth;

  constructor() {
    // Escopo cloud-platform — necessário para chamar o Vertex AI prediction API.
    this.auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }

  async generate(prompt: string, options: ImageOptions): Promise<ImageResult> {
    const project = getProject();
    const location = getLocation();
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${IMAGEN_MODEL}:predict`;

    const accessToken = await this.getAccessToken();

    const body = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: options.aspectRatio,
      },
    };

    serviceLog.info(
      { event: "imagen_request", model: IMAGEN_MODEL, aspect_ratio: options.aspectRatio },
      "Chamando Vertex AI Imagen"
    );

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      // Propaga o status HTTP para o errorClassifier (STORY-012) decidir retry.
      const err: any = new Error(
        `Vertex Imagen falhou (HTTP ${response.status}): ${errorText.slice(0, 500)}`
      );
      err.status = response.status;
      err.statusCode = response.status;
      throw err;
    }

    const json: any = await response.json();
    const prediction = Array.isArray(json?.predictions) ? json.predictions[0] : null;
    const base64 = prediction?.bytesBase64Encoded;

    if (!base64 || typeof base64 !== "string") {
      throw new Error(
        "Vertex Imagen retornou resposta sem imagem (bytesBase64Encoded ausente). Possível bloqueio por safety filter."
      );
    }

    const mimeType: string = prediction?.mimeType || "image/png";

    return {
      imageBytes: Buffer.from(base64, "base64"),
      mimeType,
      costCents: IMAGEN_3_COST_CENTS,
    };
  }

  private async getAccessToken(): Promise<string> {
    const clientAuth = await this.auth.getClient();
    const tokenResponse = await clientAuth.getAccessToken();
    const token = tokenResponse?.token;
    if (!token) {
      throw new Error(
        "Não foi possível obter access token do GCP (ADC). Verifique GOOGLE_APPLICATION_CREDENTIALS ou rode `gcloud auth application-default login`."
      );
    }
    return token;
  }
}

/** Provider singleton padrão do sistema. */
let defaultProvider: ImageProvider | null = null;

export const getDefaultImageProvider = (): ImageProvider => {
  if (!defaultProvider) {
    defaultProvider = new VertexImagenProvider();
  }
  return defaultProvider;
};

/**
 * Monta o prompt de imagem combinando as instruções visuais do post com o
 * DNA visual da marca (cores, estilo visual, tom estético).
 */
export interface ImagePromptInput {
  instrucoesVisuais: string;
  tema?: string;
  estiloVisual?: string;
  cores?: string;
  tomEstetico?: string;
  aspectRatio: ImageAspectRatio;
}

const ASPECT_LABEL: Record<ImageAspectRatio, string> = {
  "1:1": "imagem quadrada para feed Instagram",
  "9:16": "imagem vertical para Stories/Reels",
  "4:5": "imagem vertical para feed Instagram",
};

export const buildImagePrompt = (input: ImagePromptInput): string => {
  const base =
    (input.instrucoesVisuais || "").trim() ||
    (input.tema ? `Arte visual sobre: ${input.tema}` : "Arte visual para post de redes sociais");

  const segments: string[] = [base];
  if (input.estiloVisual) segments.push(`Estilo visual da marca: ${input.estiloVisual}`);
  if (input.cores) segments.push(`Paleta de cores predominante: ${input.cores}`);
  if (input.tomEstetico) segments.push(`Tom estético: ${input.tomEstetico}`);
  segments.push(`Formato: ${ASPECT_LABEL[input.aspectRatio]}`);
  segments.push(
    "Sem texto, logos, marca d'água ou palavras legíveis na imagem."
  );

  return segments.join(". ") + ".";
};
