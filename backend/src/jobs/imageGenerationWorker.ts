/**
 * STORY-008 — Image Generation Worker
 *
 * Worker assíncrono que processa jobs de geração de imagem (Imagen 3 via Vertex AI).
 * Segue exatamente o padrão de `calendarGenerationWorker.ts`:
 *   - polling a cada 5s em image_generation_jobs WHERE status='pending'
 *   - claim via FOR UPDATE SKIP LOCKED LIMIT 1
 *   - transição pending → processing → completed/failed
 *   - retry com errorClassifier (STORY-012): máx 3 tentativas, backoff 1s/4s/16s
 *   - logging estruturado via pino child logger
 */
import fs from "fs/promises";
import path from "path";
import db from "../config/database";
import logger from "../utils/logger";
import { isTransientError, getBackoffMs, MAX_JOB_ATTEMPTS, sleep } from "../utils/errorClassifier";
import {
  getDefaultImageProvider,
  buildImagePrompt,
  ImageAspectRatio,
} from "../services/imageGenerationService";
import { updateTokenUsage } from "../utils/tokenTracker";

const workerLog = logger.child({ component: "imageGenerationWorker" });

const POLLING_INTERVAL_MS = 5000;

const creativeAssetsRoot = path.resolve(__dirname, "../../storage/creative-assets");

const safeSegment = (value: string): string =>
  String(value).replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "asset";

const extensionForMime = (mimeType: string): string => {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
};

export const startImageGenerationWorker = (): void => {
  workerLog.info({ event: "worker_starting" }, "Iniciando Image Generation Worker");

  const loop = async () => {
    try {
      await processNextImageJob();
    } catch (e: any) {
      workerLog.error(
        { event: "worker_loop_error", error_message: e?.message, error_code: e?.code },
        "Erro no loop do Image Worker"
      );
    } finally {
      setTimeout(loop, POLLING_INTERVAL_MS);
    }
  };

  cleanupOrphanImageJobs().then(() => loop()).catch(() => loop());
};

/**
 * Jobs presos em 'processing' após restart do servidor nunca voltariam a 'pending'.
 * Marcamos como 'failed' para a UI parar o polling.
 */
const cleanupOrphanImageJobs = async () => {
  try {
    const result = await db.query(`
      UPDATE image_generation_jobs
      SET status = 'failed',
          last_error = 'Job órfão: servidor foi reiniciado durante a execução',
          last_error_at = NOW(),
          finished_at = NOW()
      WHERE status = 'processing'
        AND started_at < NOW() - INTERVAL '30 minutes'
    `);
    const count = result.rowCount ?? 0;
    if (count > 0) {
      workerLog.warn({ event: "orphan_jobs_cleaned", count }, "Jobs de imagem orfaos marcados como failed");
      // Sincroniza o image_status dos itens correspondentes.
      await db.query(`
        UPDATE calendar_items ci
        SET image_status = 'failed', last_updated_at = NOW()
        FROM image_generation_jobs j
        WHERE ci.id = j.calendar_item_id
          AND j.status = 'failed'
          AND ci.image_status = 'pending'
      `);
    }
  } catch (err: any) {
    workerLog.error(
      { event: "orphan_cleanup_error", error_message: err?.message },
      "Erro ao limpar jobs de imagem orfaos"
    );
  }
};

const processNextImageJob = async () => {
  const client = await db.connect();

  let claimedJobId: string | null = null;
  let claimedClienteId: string | null = null;
  let claimedItemId: string | null = null;
  let claimedAspectRatio: ImageAspectRatio = "1:1";
  let claimedAttemptCount = 0;

  try {
    await client.query("BEGIN");

    const claimResult = await client.query(`
      SELECT id, calendar_item_id, cliente_id, aspect_ratio, COALESCE(attempt_count, 0) AS attempt_count
      FROM image_generation_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (claimResult.rows.length === 0) {
      await client.query("COMMIT");
      return;
    }

    const job = claimResult.rows[0];
    claimedJobId = job.id;
    claimedClienteId = job.cliente_id;
    claimedItemId = job.calendar_item_id;
    claimedAspectRatio = (job.aspect_ratio as ImageAspectRatio) || "1:1";
    claimedAttemptCount = Number(job.attempt_count) || 0;

    await client.query(
      `UPDATE image_generation_jobs
       SET status = 'processing', started_at = NOW()
       WHERE id = $1`,
      [claimedJobId]
    );

    await client.query("COMMIT");
  } catch (err: any) {
    await client.query("ROLLBACK");
    workerLog.error(
      { event: "claim_error", error_message: err?.message, error_code: err?.code, job_id: claimedJobId },
      "Erro na transacao de claim do job de imagem"
    );
    throw err;
  } finally {
    client.release();
  }

  if (!claimedJobId || !claimedItemId || !claimedClienteId) return;

  const currentAttempt = claimedAttemptCount + 1;
  const jobLog = workerLog.child({
    job_id: claimedJobId,
    job_type: "image_generation",
    client_id: claimedClienteId,
    calendar_item_id: claimedItemId,
    attempt: currentAttempt,
  });
  const startedAt = Date.now();
  jobLog.info({ event: "job_started" }, "Processando job de imagem");

  try {
    await runImageJob(claimedJobId, claimedItemId, claimedClienteId, claimedAspectRatio, jobLog);
    jobLog.info(
      { event: "job_completed", duration_ms: Date.now() - startedAt },
      "Job de imagem concluido com sucesso"
    );
  } catch (jobError: any) {
    const errorMessage = String(jobError?.message || "Unknown error");
    const errorCode = jobError?.code || jobError?.status || jobError?.response?.status || null;
    const transient = isTransientError(jobError);
    const canRetry = transient && currentAttempt < MAX_JOB_ATTEMPTS;

    jobLog.error(
      {
        event: "job_failed",
        error_message: errorMessage,
        error_code: errorCode,
        transient,
        will_retry: canRetry,
      },
      "Falha no job de imagem"
    );

    // Persiste attempt + last_error independente da decisão de retry.
    await db.query(
      `UPDATE image_generation_jobs
       SET attempt_count = $2, last_error = $3, last_error_at = NOW()
       WHERE id = $1`,
      [claimedJobId, currentAttempt, errorMessage]
    );

    if (canRetry) {
      const backoffMs = getBackoffMs(currentAttempt);
      jobLog.info(
        { event: "job_retry_scheduled", attempt: currentAttempt, backoff_ms: backoffMs },
        "Reagendando job de imagem apos erro transitorio"
      );
      // Re-enfileira como 'pending' (started_at limpo) para o worker pegar após backoff.
      await db.query(
        `UPDATE image_generation_jobs
         SET status = 'pending', started_at = NULL
         WHERE id = $1`,
        [claimedJobId]
      );
      await sleep(backoffMs);
      return;
    }

    // Falha final.
    await db.query(
      `UPDATE image_generation_jobs
       SET status = 'failed', finished_at = NOW()
       WHERE id = $1`,
      [claimedJobId]
    );
    await db.query(
      `UPDATE calendar_items
       SET image_status = 'failed', last_updated_at = NOW()
       WHERE id = $1`,
      [claimedItemId]
    );
  }
};

const readString = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Branding JSONB normalmente guarda { description: "..." } ou { colors: [...] }.
    if (typeof obj.description === "string") return obj.description.trim();
    if (Array.isArray((obj as any).colors)) return (obj as any).colors.map(String).join(", ");
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value).trim();
};

const getPostDay = (post: Record<string, unknown>): number => {
  if (typeof post.dia === "number") return post.dia;
  const data = String(post.data ?? "").trim();
  const parsed = parseInt(data.split("/")[0] || "0", 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const runImageJob = async (
  jobId: string,
  calendarItemId: string,
  clienteId: string,
  aspectRatio: ImageAspectRatio,
  jobLog: ReturnType<typeof logger.child>
) => {
  // 1. Busca o calendar_item.
  const itemResult = await db.query(
    `SELECT id, cliente_id, calendario_id, dia, tema, formato
     FROM calendar_items WHERE id = $1`,
    [calendarItemId]
  );
  if (itemResult.rows.length === 0) {
    throw new Error(`Calendar item não encontrado: ${calendarItemId}`);
  }
  const item = itemResult.rows[0];

  // 2. Busca o calendário para extrair instrucoes_visuais do post correspondente.
  const calendarResult = await db.query(
    `SELECT calendario_json FROM calendarios WHERE id = $1`,
    [item.calendario_id]
  );
  const rawPosts = calendarResult.rows[0]?.calendario_json;
  const posts: Record<string, unknown>[] = Array.isArray(rawPosts)
    ? rawPosts.filter((p: unknown): p is Record<string, unknown> => !!p && typeof p === "object" && !Array.isArray(p))
    : [];

  const itemTema = String(item.tema ?? "").trim();
  const itemFormato = String(item.formato ?? "").trim();
  const itemDay = Number(item.dia || 0);
  const calendarPost =
    posts.find(
      (p) =>
        getPostDay(p) === itemDay &&
        String(p.tema ?? "").trim() === itemTema &&
        String(p.formato ?? "").trim() === itemFormato
    ) || {};

  const instrucoesVisuais = readString(
    (calendarPost as any).instrucoes_visuais ?? (calendarPost as any).ideia_visual
  );

  // 3. Busca o DNA visual da marca via tabela branding.
  const brandingResult = await db.query(
    `SELECT visual_style, tone_of_voice FROM branding WHERE cliente_id = $1 LIMIT 1`,
    [clienteId]
  );
  const branding = brandingResult.rows[0] || {};
  const estiloVisual = readString(branding.visual_style);
  const tomEstetico = readString(branding.tone_of_voice);
  // Cores: tenta extrair de visual_style.colors.
  let cores = "";
  try {
    const vs = typeof branding.visual_style === "string" ? JSON.parse(branding.visual_style) : branding.visual_style;
    if (vs && Array.isArray(vs.colors)) cores = vs.colors.map(String).join(", ");
  } catch {
    /* visual_style pode não ser JSON parseável — ignora */
  }

  // 4. Monta o prompt.
  const prompt = buildImagePrompt({
    instrucoesVisuais,
    tema: itemTema,
    estiloVisual,
    cores,
    tomEstetico,
    aspectRatio,
  });

  await db.query(`UPDATE image_generation_jobs SET prompt_used = $2 WHERE id = $1`, [jobId, prompt]);

  // 5. Gera a imagem.
  const provider = getDefaultImageProvider();
  const result = await provider.generate(prompt, { aspectRatio });

  // 6. Salva o arquivo em disco.
  const clienteSeg = safeSegment(clienteId);
  const directory = path.join(creativeAssetsRoot, clienteSeg);
  await fs.mkdir(directory, { recursive: true });
  const ext = extensionForMime(result.mimeType);
  const fileName = `${safeSegment(jobId)}.${ext}`;
  const absolutePath = path.join(directory, fileName);
  await fs.writeFile(absolutePath, result.imageBytes);

  const imageUrl = `/storage/creative-assets/${clienteSeg}/${fileName}`;

  // 7. Atualiza o job → completed.
  await db.query(
    `UPDATE image_generation_jobs
     SET status = 'completed',
         image_url = $2,
         image_path = $3,
         cost_cents = $4,
         finished_at = NOW()
     WHERE id = $1`,
    [jobId, imageUrl, absolutePath, result.costCents]
  );

  // 8. Atualiza o calendar_item.
  await db.query(
    `UPDATE calendar_items
     SET image_url = $2, image_status = 'generated', last_updated_at = NOW()
     WHERE id = $1`,
    [calendarItemId, imageUrl]
  );

  // 9. Registra o custo no histórico de uso do cliente (clientes.token_usage JSONB).
  //    Não há tabela token_usage dedicada — o sistema usa a coluna JSONB existente.
  try {
    await updateTokenUsage(
      clienteId,
      { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
      "image_generation",
      "vertex-imagen"
    );
  } catch (costErr: any) {
    jobLog.warn(
      { event: "cost_tracking_failed", error_message: costErr?.message },
      "Falha ao registrar custo de geração de imagem"
    );
  }

  jobLog.info(
    { event: "image_saved", image_url: imageUrl, cost_cents: result.costCents },
    "Imagem gerada e salva"
  );
};
