/**
 * STORY-013 — RAG Service (Retrieval-Augmented Generation por cliente)
 *
 * Núcleo do "cérebro" persistente: ingestão de textos em chunks vetorizados e
 * recuperação por similaridade de cosseno via pgvector (HNSW). Todas as queries
 * filtram por `cliente_id` ANTES da busca vetorial — o isolamento entre clientes
 * é garantido tanto pela cláusula WHERE quanto pelo índice composto
 * (cliente_id, source_type).
 *
 * Pipeline de ingestão:
 *   texto bruto → chunking (~400 tokens, split por parágrafo/sentença) →
 *   hash SHA-256 → embedding via Vertex AI → INSERT ... ON CONFLICT DO NOTHING
 *   (dedup por UNIQUE(cliente_id, content_hash)).
 *
 * Pipeline de retrieval:
 *   query → embedQuery → SET LOCAL hnsw.ef_search → SELECT ... ORDER BY
 *   embedding <=> $vector LIMIT k → filtro por similarity >= minSimilarity.
 *
 * Decisões PO/Arch:
 *   - Índice HNSW (não IVFFlat) — já aplicado pela migration.
 *   - `hnsw.ef_search` ajustado dentro da transação via SET LOCAL para não
 *     vazar para outras conexões.
 *   - Reindex completo deleta e re-ingere; estratégia simples para STORY-013,
 *     suficiente para o volume esperado (poucos milhares de chunks/cliente).
 */
import db from "../config/database";
import logger from "../utils/logger";
import { embeddingService, hashText } from "./embeddingService";
import type {
  KnowledgeSourceType,
  RetrievedChunk,
  RetrieveOptions,
} from "../types/rag";

const serviceLog = logger.child({ component: "ragService" });

/**
 * Tamanho-alvo de cada chunk em tokens (≈ chars/4). Mantemos chunks pequenos
 * para que a similaridade fique mais focada no trecho relevante e o LLM
 * consumidor possa concatenar múltiplos chunks dentro do orçamento de contexto.
 */
const CHUNK_TARGET_TOKENS = 400;
const CHUNK_TARGET_CHARS = CHUNK_TARGET_TOKENS * 4;
/** Tamanho mínimo de um chunk emitido — evita ruído de fragmentos. */
const CHUNK_MIN_CHARS = 40;

/** ef_search default do retrieval — controla recall/latência do HNSW. */
const HNSW_EF_SEARCH = (() => {
  const parsed = parseInt(String(process.env.RAG_HNSW_EF_SEARCH || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 40;
})();

/** Threshold default de similaridade de cosseno (0–1). */
const DEFAULT_MIN_SIMILARITY = (() => {
  const parsed = parseFloat(String(process.env.RAG_SIMILARITY_THRESHOLD || ""));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.6;
})();

/** k default de chunks retornados pelo retrieve. */
const DEFAULT_K = 8;

const VALID_SOURCE_TYPES: readonly KnowledgeSourceType[] = [
  "brand_doc",
  "brand_rule",
  "past_post_approved",
  "briefing_session",
  "presentation",
  "manual",
] as const;

const isValidSourceType = (v: unknown): v is KnowledgeSourceType =>
  typeof v === "string" && (VALID_SOURCE_TYPES as readonly string[]).includes(v);

export interface IngestResult {
  inserted: number;
  skipped: number;
}

export interface ReindexResult {
  indexed: number;
  skipped: number;
  clienteId: string;
  durationMs: number;
}

/**
 * Divide um texto em chunks de ~CHUNK_TARGET_CHARS, respeitando primeiro a
 * quebra por parágrafo (\n\n+) e, dentro de um parágrafo gigante, por
 * sentença (período seguido de espaço). Garante que o chunk emitido nunca
 * exceda significativamente o alvo — sem overlap (mantemos simples; chunks
 * pequenos já cobrem a maior parte do recall útil).
 */
export const chunkText = (text: string): string[] => {
  const normalized = String(text || "").trim();
  if (!normalized) return [];
  if (normalized.length <= CHUNK_TARGET_CHARS) {
    return [normalized];
  }

  const paragraphs = normalized
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let buffer = "";

  const flushBuffer = () => {
    const trimmed = buffer.trim();
    if (trimmed.length >= CHUNK_MIN_CHARS) chunks.push(trimmed);
    buffer = "";
  };

  const pushPiece = (piece: string) => {
    if (!piece) return;
    if (buffer.length + piece.length + 2 <= CHUNK_TARGET_CHARS) {
      buffer = buffer.length === 0 ? piece : `${buffer}\n\n${piece}`;
      return;
    }
    // Fecha buffer atual e começa novo.
    flushBuffer();
    if (piece.length <= CHUNK_TARGET_CHARS) {
      buffer = piece;
    } else {
      // Parágrafo > target: quebra por sentença.
      const sentences = piece.split(/(?<=[.!?…])\s+/g).filter(Boolean);
      let sentBuffer = "";
      for (const s of sentences) {
        if (sentBuffer.length + s.length + 1 <= CHUNK_TARGET_CHARS) {
          sentBuffer = sentBuffer.length === 0 ? s : `${sentBuffer} ${s}`;
        } else {
          if (sentBuffer.trim().length >= CHUNK_MIN_CHARS) chunks.push(sentBuffer.trim());
          // Sentença sozinha maior que o alvo: corta cru.
          if (s.length > CHUNK_TARGET_CHARS) {
            for (let i = 0; i < s.length; i += CHUNK_TARGET_CHARS) {
              chunks.push(s.slice(i, i + CHUNK_TARGET_CHARS));
            }
            sentBuffer = "";
          } else {
            sentBuffer = s;
          }
        }
      }
      buffer = sentBuffer;
    }
  };

  for (const p of paragraphs) pushPiece(p);
  flushBuffer();

  return chunks;
};

/**
 * Formata o vetor de embedding no literal aceito pelo pgvector via parâmetro
 * (`'[0.1,0.2,...]'::vector`). Postgres aceita esse literal por cast explícito.
 */
const toVectorLiteral = (vector: number[]): string =>
  `[${vector.map((v) => Number.isFinite(v) ? v.toString() : "0").join(",")}]`;

export class RAGService {
  /**
   * Ingere textos como chunks no `knowledge_chunks` do cliente. Idempotente:
   * chunks com hash idêntico já presentes para o mesmo cliente são ignorados
   * via UNIQUE(cliente_id, content_hash) + ON CONFLICT DO NOTHING.
   */
  async ingest(
    clienteId: string,
    sourceType: KnowledgeSourceType,
    sourceId: string | null,
    texts: string[],
    metadata: Record<string, unknown> = {}
  ): Promise<IngestResult> {
    if (!clienteId) {
      throw new Error("ragService.ingest: clienteId obrigatório.");
    }
    if (!isValidSourceType(sourceType)) {
      throw new Error(
        `ragService.ingest: source_type inválido: ${String(sourceType)}. Aceitos: ${VALID_SOURCE_TYPES.join(", ")}.`
      );
    }
    if (!Array.isArray(texts) || texts.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    // 1) Quebra cada texto de entrada em chunks (semântico/parágrafo).
    const allChunks: string[] = [];
    for (const t of texts) {
      allChunks.push(...chunkText(t));
    }
    if (allChunks.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    // 2) Dedup intra-batch (mesmo hash dentro do mesmo lote).
    const seenInBatch = new Set<string>();
    const deduped: { content: string; contentHash: string }[] = [];
    for (const chunk of allChunks) {
      const h = hashText(chunk);
      if (seenInBatch.has(h)) continue;
      seenInBatch.add(h);
      deduped.push({ content: chunk, contentHash: h });
    }

    // 3) Filtra chunks já existentes para o cliente (dedup contra DB).
    //    Evita gastar embedding em chunk que vai dar ON CONFLICT depois.
    const hashes = deduped.map((d) => d.contentHash);
    const existingResult = await db.query<{ content_hash: string }>(
      `SELECT content_hash FROM knowledge_chunks
       WHERE cliente_id = $1 AND content_hash = ANY($2::text[])`,
      [clienteId, hashes]
    );
    const existingSet = new Set(existingResult.rows.map((r) => r.content_hash));
    const toEmbed = deduped.filter((d) => !existingSet.has(d.contentHash));
    let skipped = deduped.length - toEmbed.length;

    if (toEmbed.length === 0) {
      serviceLog.info(
        {
          event: "rag_ingest_all_skipped",
          cliente_id: clienteId,
          source_type: sourceType,
          source_id: sourceId,
          skipped,
        },
        "Todos os chunks já existiam (dedup)"
      );
      return { inserted: 0, skipped };
    }

    // 4) Gera embeddings em batch (RETRIEVAL_DOCUMENT).
    const vectors = await embeddingService.embed(
      toEmbed.map((d) => d.content),
      {
        taskType: "RETRIEVAL_DOCUMENT",
        clienteId,
        action: `rag_ingest:${sourceType}`,
      }
    );

    // 5) Insere em batch com ON CONFLICT DO NOTHING (corrida com inserts paralelos).
    let inserted = 0;
    for (let i = 0; i < toEmbed.length; i++) {
      const item = toEmbed[i];
      const vector = vectors[i];
      if (!item || !vector) continue;
      try {
        const result = await db.query(
          `INSERT INTO knowledge_chunks
             (cliente_id, source_type, source_id, content, content_hash, embedding, metadata)
           VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb)
           ON CONFLICT (cliente_id, content_hash) DO NOTHING`,
          [
            clienteId,
            sourceType,
            sourceId,
            item.content,
            item.contentHash,
            toVectorLiteral(vector),
            JSON.stringify(metadata),
          ]
        );
        if ((result.rowCount ?? 0) > 0) {
          inserted++;
        } else {
          skipped++;
        }
      } catch (err: any) {
        serviceLog.error(
          {
            event: "rag_ingest_insert_failed",
            cliente_id: clienteId,
            source_type: sourceType,
            source_id: sourceId,
            err: err?.message,
          },
          "Falha ao inserir chunk no knowledge_chunks"
        );
        // Continua com os demais — não derruba a ingestão inteira por um chunk.
      }
    }

    serviceLog.info(
      {
        event: "rag_ingest_completed",
        cliente_id: clienteId,
        source_type: sourceType,
        source_id: sourceId,
        inserted,
        skipped,
        total_chunks: deduped.length,
      },
      "Ingestão RAG concluída"
    );

    return { inserted, skipped };
  }

  /**
   * Recupera os chunks mais similares à `query` para o cliente informado.
   * Filtra por `source_types` (opcional) e por `minSimilarity` (default 0.6).
   * Usa SET LOCAL hnsw.ef_search dentro de transação para não vazar configuração.
   */
  async retrieve(
    clienteId: string,
    query: string,
    options: RetrieveOptions = {}
  ): Promise<RetrievedChunk[]> {
    if (!clienteId) {
      throw new Error("ragService.retrieve: clienteId obrigatório.");
    }
    const q = String(query || "").trim();
    if (!q) return [];

    const k = Number.isFinite(options.k) && (options.k as number) > 0
      ? Math.min(Math.floor(options.k as number), 50)
      : DEFAULT_K;
    const minSimilarity = Number.isFinite(options.minSimilarity)
      ? Math.max(0, Math.min(1, options.minSimilarity as number))
      : DEFAULT_MIN_SIMILARITY;
    const sourceTypes = Array.isArray(options.sourceTypes) && options.sourceTypes.length > 0
      ? options.sourceTypes.filter(isValidSourceType)
      : null;

    // 1) Embedding da query (RETRIEVAL_QUERY).
    const queryVector = await embeddingService.embedQuery(q, { clienteId, action: "rag_retrieve" });
    const queryLiteral = toVectorLiteral(queryVector);

    // 2) Busca dentro de transação para confinar SET LOCAL hnsw.ef_search.
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL hnsw.ef_search = ${HNSW_EF_SEARCH}`);

      const params: any[] = [clienteId, queryLiteral, k];
      let typeClause = "";
      if (sourceTypes && sourceTypes.length > 0) {
        params.push(sourceTypes);
        typeClause = ` AND source_type = ANY($${params.length}::text[])`;
      }

      const result = await client.query(
        `SELECT id, cliente_id, source_type, source_id, content, content_hash,
                metadata, created_at, updated_at,
                1 - (embedding <=> $2::vector) AS similarity
           FROM knowledge_chunks
          WHERE cliente_id = $1
            AND embedding IS NOT NULL${typeClause}
          ORDER BY embedding <=> $2::vector ASC
          LIMIT $3`,
        params
      );
      await client.query("COMMIT");

      const chunks: RetrievedChunk[] = result.rows
        .map((row: any): RetrievedChunk => ({
          id: row.id,
          clienteId: row.cliente_id,
          sourceType: row.source_type,
          sourceId: row.source_id ?? undefined,
          content: row.content,
          contentHash: row.content_hash,
          metadata: row.metadata || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          similarity: Number(row.similarity),
        }))
        .filter((c) => Number.isFinite(c.similarity) && c.similarity >= minSimilarity);

      serviceLog.info(
        {
          event: "rag_retrieve_completed",
          cliente_id: clienteId,
          k,
          min_similarity: minSimilarity,
          returned: chunks.length,
          source_types: sourceTypes,
        },
        "Retrieval RAG concluído"
      );

      return chunks;
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => undefined);
      serviceLog.error(
        {
          event: "rag_retrieve_failed",
          cliente_id: clienteId,
          err: err?.message,
        },
        "Falha no retrieval RAG"
      );
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Reindex completo do cliente: limpa todos os chunks e re-ingere a partir das
   * fontes canônicas (brand_docs, brand_rules ativas, posts aprovados).
   */
  async reindexCliente(clienteId: string): Promise<ReindexResult> {
    const startedAt = Date.now();
    if (!clienteId) {
      throw new Error("ragService.reindexCliente: clienteId obrigatório.");
    }

    serviceLog.info(
      { event: "rag_reindex_started", cliente_id: clienteId },
      "Reindex completo iniciado"
    );

    // 1) Limpa todos os chunks existentes do cliente.
    await db.query(`DELETE FROM knowledge_chunks WHERE cliente_id = $1`, [clienteId]);

    let indexed = 0;
    let skipped = 0;

    // 2) brand_docs: ingestão por documento. metadata.tipo preserva a categoria.
    try {
      const docsResult = await db.query(
        `SELECT id, tipo, conteudo_texto FROM brand_docs
          WHERE cliente_id = $1
            AND conteudo_texto IS NOT NULL
            AND length(conteudo_texto) > 0`,
        [clienteId]
      );
      for (const row of docsResult.rows) {
        const content = String(row.conteudo_texto || "").trim();
        if (!content) continue;
        const result = await this.ingest(
          clienteId,
          "brand_doc",
          row.id,
          [content],
          { tipo: row.tipo || null }
        );
        indexed += result.inserted;
        skipped += result.skipped;
      }
    } catch (err: any) {
      serviceLog.warn(
        { event: "rag_reindex_brand_docs_failed", cliente_id: clienteId, err: err?.message },
        "Falha ao reindexar brand_docs"
      );
    }

    // 3) brand_rules ativas: cada regra vira um chunk pequeno.
    try {
      const rulesResult = await db.query(
        `SELECT id, regra, categoria FROM brand_rules
          WHERE cliente_id = $1 AND ativa = true
            AND regra IS NOT NULL AND length(regra) > 0`,
        [clienteId]
      );
      for (const row of rulesResult.rows) {
        const content = String(row.regra || "").trim();
        if (!content) continue;
        const result = await this.ingest(
          clienteId,
          "brand_rule",
          row.id,
          [content],
          { categoria: row.categoria || null }
        );
        indexed += result.inserted;
        skipped += result.skipped;
      }
    } catch (err: any) {
      serviceLog.warn(
        { event: "rag_reindex_brand_rules_failed", cliente_id: clienteId, err: err?.message },
        "Falha ao reindexar brand_rules"
      );
    }

    // 4) Posts aprovados: junta tema + copy_inicial (e legenda, se houver).
    //    Pega o post do calendar_items pelo (calendario_id, dia, tema, formato).
    try {
      const approvedResult = await db.query(
        `SELECT ci.id, ci.dia, ci.tema, ci.formato, c.calendario_json
           FROM calendar_items ci
           LEFT JOIN calendarios c ON c.id = ci.calendario_id
          WHERE ci.cliente_id = $1
            AND ci.approval_status = 'approved'`,
        [clienteId]
      );
      for (const row of approvedResult.rows) {
        const text = buildApprovedPostText(row);
        if (!text) continue;
        const result = await this.ingest(
          clienteId,
          "past_post_approved",
          row.id,
          [text],
          { format: row.formato, dia: row.dia }
        );
        indexed += result.inserted;
        skipped += result.skipped;
      }
    } catch (err: any) {
      serviceLog.warn(
        { event: "rag_reindex_approved_posts_failed", cliente_id: clienteId, err: err?.message },
        "Falha ao reindexar posts aprovados"
      );
    }

    const durationMs = Date.now() - startedAt;
    serviceLog.info(
      {
        event: "rag_reindex_completed",
        cliente_id: clienteId,
        indexed,
        skipped,
        duration_ms: durationMs,
      },
      "Reindex completo concluído"
    );

    return { indexed, skipped, clienteId, durationMs };
  }
}

/**
 * Monta o texto canônico de um post aprovado a partir do calendar_item +
 * calendario_json. Junta tema + copy_inicial (+ legenda quando disponível).
 */
const buildApprovedPostText = (row: any): string => {
  const tema = String(row?.tema || "").trim();
  const formato = String(row?.formato || "").trim();
  const dia = row?.dia;
  const calendarioJson = row?.calendario_json;
  let copy = "";
  let legenda = "";

  const posts: any[] = Array.isArray(calendarioJson)
    ? calendarioJson
    : typeof calendarioJson === "string"
      ? safeJsonArray(calendarioJson)
      : [];
  const match = posts.find((p) => {
    if (!p || typeof p !== "object") return false;
    const pDia = typeof p.dia === "number" ? p.dia : parseInt(String(p.dia || ""), 10);
    return (
      pDia === Number(dia) &&
      String(p.tema || "").trim() === tema &&
      String(p.formato || "").trim() === formato
    );
  });
  if (match) {
    copy = String(match.copy_inicial || "").trim();
    legenda = String(match.legenda || "").trim();
  }

  const parts = [
    tema ? `Tema: ${tema}` : "",
    formato ? `Formato: ${formato}` : "",
    copy ? `Copy: ${copy}` : "",
    legenda ? `Legenda: ${legenda}` : "",
  ].filter(Boolean);
  return parts.join("\n");
};

const safeJsonArray = (raw: string): any[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Instância singleton. */
export const ragService = new RAGService();
