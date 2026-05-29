/**
 * STORY-013 — Tipos do Cérebro RAG por Cliente.
 *
 * Espelham o schema de `knowledge_chunks` e `embedding_jobs`
 * (ver backend/db/migrate_rag_knowledge.ts). Nomes em camelCase no domínio
 * TypeScript; o mapeamento para snake_case do Postgres acontece na camada de
 * acesso a dados (repository/service).
 */

/** Origens válidas de conhecimento — espelha o CHECK de knowledge_chunks.source_type. */
export type KnowledgeSourceType =
  | "brand_doc"
  | "brand_rule"
  | "past_post_approved"
  | "briefing_session"
  | "presentation"
  | "manual";

/** Estados do job de embedding — espelha o CHECK de embedding_jobs.status. */
export type EmbeddingJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/** Um chunk de conhecimento vetorizado, isolado por cliente. */
export interface KnowledgeChunk {
  id: string;
  clienteId: string;
  sourceType: KnowledgeSourceType;
  /** ID da linha de origem (brand_docs.id, brand_rules.id, etc). Opcional para 'manual'. */
  sourceId?: string;
  content: string;
  /** SHA-256 do `content`, usado na dedup (cliente_id, content_hash) UNIQUE. */
  contentHash: string;
  /** Vetor de 768 dimensões (text-embedding-004). Ausente até o job processar. */
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Chunk retornado por uma busca vetorial, com score de similaridade. */
export interface RetrievedChunk extends KnowledgeChunk {
  /** Similaridade de cosseno no intervalo 0–1 (1 = idêntico). */
  similarity: number;
}

/** Um job enfileirado para gerar o embedding de uma fonte. */
export interface EmbeddingJob {
  id: string;
  clienteId: string;
  sourceType: KnowledgeSourceType;
  sourceId?: string;
  status: EmbeddingJobStatus;
  attemptCount: number;
  lastError?: string;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

/** Opções de retrieval para a busca vetorial. */
export interface RetrieveOptions {
  /** Número de chunks a retornar. Default: 8. */
  k?: number;
  /** Filtra por tipos de origem. Quando ausente/null, considera todos. */
  sourceTypes?: KnowledgeSourceType[];
  /** Threshold de similaridade de cosseno (0–1). Default: 0.6. */
  minSimilarity?: number;
}
