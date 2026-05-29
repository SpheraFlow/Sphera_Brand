/**
 * STORY-013 — Embedding Service (Vertex AI text-embedding-004)
 *
 * Camada fina sobre o endpoint REST `:predict` do Vertex AI para o modelo
 * `text-embedding-004` (768 dimensões). Usa exatamente a mesma estratégia de
 * autenticação do `imageGenerationService.ts` (STORY-008): GoogleAuth via ADC
 * com escopo `cloud-platform`.
 *
 * Recursos:
 *   - Cache LRU em memória (Map ordenado, max 500 entradas) usando SHA-256 do
 *     texto como chave. Hits do cache retornam em < 1ms sem chamada de rede.
 *   - Batching: até 250 textos por request (limite atual do Vertex AI).
 *   - Retry com backoff exponencial via `errorClassifier.ts` (STORY-012):
 *     3 tentativas, 1s/4s/16s, apenas para erros transientes (429/503/504/timeouts).
 *   - Registro opcional de uso de tokens via `tokenTracker.updateTokenUsage()`
 *     (escopo do cliente). Como embeddings só têm input, registramos
 *     `candidatesTokenCount=0` e `promptTokenCount` estimado por chars/4.
 *
 * Decisão (PO note #2): em vez de criar uma tabela nova `token_usage`, reusamos
 * o tracker JSONB existente (`updateTokenUsage`), como o resto do backend faz
 * para Gemini. Output tokens = 0 (embedding não tem completion).
 */
import { GoogleAuth } from "google-auth-library";
import { createHash } from "crypto";
import logger from "../utils/logger";
import {
  isTransientError,
  getBackoffMs,
  MAX_JOB_ATTEMPTS,
  sleep,
} from "../utils/errorClassifier";
import { updateTokenUsage } from "../utils/tokenTracker";

const serviceLog = logger.child({ component: "embeddingService" });

const EMBEDDING_MODEL =
  process.env.VERTEX_EMBEDDING_MODEL || "text-embedding-004";

/** Limite oficial do endpoint :predict do text-embedding-004. */
const MAX_BATCH_SIZE = 250;

/** Capacidade máxima do cache LRU em memória. */
const CACHE_MAX_ENTRIES = 500;

/** Dimensão do vetor de embedding (text-embedding-004 → 768). */
export const EMBEDDING_DIMENSIONS = 768;

/**
 * task_type aceitos pelo modelo. RETRIEVAL_DOCUMENT para conteúdo armazenado,
 * RETRIEVAL_QUERY para queries de busca. A escolha afeta o vetor gerado
 * (Google otimiza embeddings assimétricos para retrieval).
 */
export type EmbeddingTaskType =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY"
  | "SEMANTIC_SIMILARITY"
  | "CLASSIFICATION"
  | "CLUSTERING";

const getProject = (): string => {
  const project =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.VERTEX_PROJECT_ID ||
    process.env.GCLOUD_PROJECT;
  if (!project) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT não configurado. Defina no .env para usar o Vertex AI Embeddings."
    );
  }
  return project;
};

const getLocation = (): string =>
  process.env.GOOGLE_CLOUD_LOCATION ||
  process.env.VERTEX_LOCATION ||
  "us-central1";

/** Estima tokens via heurística (4 chars ≈ 1 token PT/EN). */
const estimateTokens = (text: string): number =>
  Math.ceil(text.length / 4);

/** Hash SHA-256 estável usado como chave de cache (e também como `content_hash` da tabela). */
export const hashText = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

/**
 * Cache LRU simples baseado em Map (ordem de inserção do JS = ordem de uso).
 * Em hit, remove + reinsere para mover ao final ("mais recente").
 */
class LRUEmbeddingCache {
  private cache = new Map<string, number[]>();

  get(key: string): number[] | undefined {
    const value = this.cache.get(key);
    if (value === undefined) return undefined;
    // Move para o final = mais recente.
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: string, value: number[]): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= CACHE_MAX_ENTRIES) {
      // Remove o mais antigo (primeira chave do Map).
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, value);
  }

  size(): number {
    return this.cache.size;
  }
}

export interface EmbedOptions {
  /** task_type do Vertex AI; default RETRIEVAL_DOCUMENT (para ingestão). */
  taskType?: EmbeddingTaskType;
  /** Cliente para registro de tokens em `token_usage` (JSONB em clientes). Opcional. */
  clienteId?: string;
  /** Rótulo de ação para o histórico de tokens (ex.: "rag_ingest"). */
  action?: string;
}

export class EmbeddingService {
  private auth: GoogleAuth;
  private cache = new LRUEmbeddingCache();

  constructor() {
    this.auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }

  /**
   * Gera embeddings para um array de textos. Respeita ordem de entrada.
   * Faz cache por SHA-256(text). Textos vazios viram vetor de zeros (sem
   * chamada de rede) — útil quando o caller filtra depois.
   */
  async embed(texts: string[], options: EmbedOptions = {}): Promise<number[][]> {
    if (!Array.isArray(texts)) {
      throw new Error("embeddingService.embed: 'texts' precisa ser array.");
    }

    const taskType: EmbeddingTaskType = options.taskType || "RETRIEVAL_DOCUMENT";
    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const missingIndices: number[] = [];
    const missingTexts: string[] = [];

    // Passo 1: resolve cache hits e seleciona textos que precisam de chamada.
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i] ?? "";
      if (text.length === 0) {
        // Vetor de zeros para textos vazios — caller decide se aceita.
        results[i] = new Array(EMBEDDING_DIMENSIONS).fill(0);
        continue;
      }
      const key = `${taskType}:${hashText(text)}`;
      const cached = this.cache.get(key);
      if (cached) {
        results[i] = cached;
      } else {
        missingIndices.push(i);
        missingTexts.push(text);
      }
    }

    if (missingTexts.length === 0) {
      return results as number[][];
    }

    // Passo 2: batches de no máximo MAX_BATCH_SIZE textos por request.
    let totalInputTokens = 0;
    for (let start = 0; start < missingTexts.length; start += MAX_BATCH_SIZE) {
      const batch = missingTexts.slice(start, start + MAX_BATCH_SIZE);
      const batchIndices = missingIndices.slice(start, start + MAX_BATCH_SIZE);

      const vectors = await this.callVertexWithRetry(batch, taskType);

      for (let j = 0; j < vectors.length; j++) {
        const vector = vectors[j];
        const text = batch[j];
        const idx = batchIndices[j];
        if (vector === undefined || text === undefined || idx === undefined) continue;
        results[idx] = vector;
        const key = `${taskType}:${hashText(text)}`;
        this.cache.set(key, vector);
        totalInputTokens += estimateTokens(text);
      }
    }

    // Passo 3: registro de uso de tokens (apenas se cliente foi informado).
    if (options.clienteId && totalInputTokens > 0) {
      try {
        await updateTokenUsage(
          options.clienteId,
          {
            promptTokenCount: totalInputTokens,
            candidatesTokenCount: 0,
            totalTokenCount: totalInputTokens,
          },
          options.action || "embedding",
          EMBEDDING_MODEL
        );
      } catch (err: any) {
        // Logging de tokens nunca derruba o fluxo de embedding.
        serviceLog.warn(
          { event: "token_tracking_failed", err: err?.message, cliente_id: options.clienteId },
          "Falha ao registrar tokens de embedding"
        );
      }
    }

    return results as number[][];
  }

  /** Conveniência para queries (taskType RETRIEVAL_QUERY). Retorna um único vetor. */
  async embedQuery(query: string, options: Omit<EmbedOptions, "taskType"> = {}): Promise<number[]> {
    const result = await this.embed([query], {
      ...options,
      taskType: "RETRIEVAL_QUERY",
    });
    const vector = result[0];
    if (!vector) {
      throw new Error("embeddingService.embedQuery: resposta vazia do Vertex AI.");
    }
    return vector;
  }

  /** Métricas leves para observabilidade. */
  getCacheStats(): { size: number; maxSize: number } {
    return { size: this.cache.size(), maxSize: CACHE_MAX_ENTRIES };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────────────────────

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

  /**
   * Chama o Vertex AI :predict com retry exponencial para erros transientes.
   * Erros fatais (4xx/validação) propagam imediatamente sem retry.
   */
  private async callVertexWithRetry(
    texts: string[],
    taskType: EmbeddingTaskType
  ): Promise<number[][]> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_JOB_ATTEMPTS; attempt++) {
      try {
        return await this.callVertex(texts, taskType);
      } catch (err: any) {
        lastError = err;
        const transient = isTransientError(err);
        const canRetry = transient && attempt < MAX_JOB_ATTEMPTS;
        serviceLog.warn(
          {
            event: "embedding_request_error",
            attempt,
            transient,
            will_retry: canRetry,
            error_message: err?.message,
            error_status: err?.status || err?.statusCode,
          },
          "Falha em chamada ao Vertex AI embeddings"
        );
        if (!canRetry) break;
        await sleep(getBackoffMs(attempt));
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Embedding request failed (sem detalhes adicionais).");
  }

  private async callVertex(
    texts: string[],
    taskType: EmbeddingTaskType
  ): Promise<number[][]> {
    const project = getProject();
    const location = getLocation();
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${EMBEDDING_MODEL}:predict`;

    const accessToken = await this.getAccessToken();

    const body = {
      instances: texts.map((content) => ({ content, task_type: taskType })),
    };

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
      const err: any = new Error(
        `Vertex Embeddings falhou (HTTP ${response.status}): ${errorText.slice(0, 500)}`
      );
      err.status = response.status;
      err.statusCode = response.status;
      throw err;
    }

    const json: any = await response.json();
    const predictions: any[] = Array.isArray(json?.predictions) ? json.predictions : [];

    if (predictions.length !== texts.length) {
      throw new Error(
        `Vertex Embeddings: número de predictions (${predictions.length}) difere do número de inputs (${texts.length}).`
      );
    }

    const vectors: number[][] = predictions.map((p, idx) => {
      const values = p?.embeddings?.values;
      if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Vertex Embeddings: prediction[${idx}] sem 'embeddings.values' válido (esperado array de ${EMBEDDING_DIMENSIONS} floats).`
        );
      }
      return values as number[];
    });

    return vectors;
  }
}

/** Instância singleton compartilhada (cache LRU vive durante o processo). */
export const embeddingService = new EmbeddingService();
