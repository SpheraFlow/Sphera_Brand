import db from "../config/database";
import fs from "fs/promises";
import path from "path";
import {
  addCreativeJobEvent,
  getCreativeTemplateById,
  getVisualRecipeById,
  hydrateCreativeContextForItem,
  insertCreativePhaseOneAssets,
  insertRenderedCreativeAsset,
  listActiveCreativeTemplates,
  listVisualRecipesForClient,
  updateCreativeJob,
} from "../services/creativeRepository";
import { generateCreativePhaseOneOutput } from "../services/creativeService";
import { CreativeGenerationOutput, HydratedCreativeContext, normalizeGenerateArtRequest } from "../services/creativeTypes";
import { generateAiVisualImage } from "../services/creativeImageProvider";
import { writeCreativeAssetFile } from "../services/creativeStorage";
import { CreativeTemplateRecord, selectBestCreativeTemplate } from "../services/creativeTemplateSelector";
import { VisualRecipeRecord } from "../services/creativeRecipeTypes";
import { rankVisualRecipes } from "../services/creativeRecipeSelector";
import { buildRecipeRenderBackground } from "../services/creativeRecipeBackground";
import { renderRecipeToSvg } from "../services/creativeRecipeRenderer";
import { renderSvgToPngBuffer, renderTemplateSvgToSvg, TemplateRenderConfig } from "../services/creativeSvgRenderer";
import { completeTemplateMasterCreativeJob } from "../services/templateMasterCalendarFlow";
import logger from "../utils/logger";
import { isTransientError, getBackoffMs, MAX_JOB_ATTEMPTS, sleep } from "../utils/errorClassifier";

const POLLING_INTERVAL_MS = 5000;

const workerLog = logger.child({ component: "creativeProductionWorker" });

export const startCreativeProductionWorker = (): void => {
  workerLog.info({ event: "worker_starting" }, "Iniciando Creative Production Worker");

  const loop = async () => {
    try {
      await processNextCreativeJob();
    } catch (error: any) {
      workerLog.error(
        { event: "worker_loop_error", error_message: error?.message, error_code: error?.code },
        "Erro no loop do Creative Worker"
      );
    } finally {
      setTimeout(loop, POLLING_INTERVAL_MS);
    }
  };

  cleanupOrphanCreativeJobs().then(() => loop()).catch(() => loop());
};

const cleanupOrphanCreativeJobs = async () => {
  await db.query(`
    UPDATE creative_jobs
    SET status='failed',
        error='{"message":"Creative job orphaned during server restart"}',
        completed_at=NOW(),
        updated_at=NOW()
    WHERE status IN ('hydrating_context','briefing','selecting_template','prompting','rendering','quality_check')
      AND updated_at < NOW() - INTERVAL '30 minutes'
  `);
};

const processNextCreativeJob = async () => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const claim = await client.query(`
      SELECT id, cliente_id, calendar_item_id, input, requested_by
      FROM creative_jobs
      WHERE status='queued'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (claim.rows.length === 0) {
      await client.query("COMMIT");
      return;
    }

    const job = claim.rows[0];

    // STORY-012: load attempt_count for retry tracking (column added by migrate_job_retry_fields).
    let currentAttemptCount = 0;
    try {
      const attemptRes = await client.query(
        `SELECT COALESCE(attempt_count, 0) AS attempt_count FROM creative_jobs WHERE id = $1`,
        [job.id]
      );
      currentAttemptCount = Number(attemptRes.rows[0]?.attempt_count) || 0;
    } catch (_) {
      currentAttemptCount = 0;
    }
    (job as any).__attempt_count = currentAttemptCount;

    await client.query(
      `UPDATE creative_jobs
       SET status='briefing',
           progress=10,
           current_step='Hidratando contexto criativo...',
           started_at=NOW(),
           updated_at=NOW()
       WHERE id=$1`,
      [job.id]
    );

    await client.query(
      `UPDATE calendar_items
       SET creative_status='generating',
           latest_creative_job_id=$1,
           last_updated_at=NOW()
       WHERE id=$2`,
      [job.id, job.calendar_item_id]
    );

    await client.query("COMMIT");

    await runCreativeJob(
      job.id,
      job.calendar_item_id,
      job.input,
      job.requested_by || undefined,
      ((job as any).__attempt_count || 0) + 1
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const runCreativeJob = async (
  jobId: string,
  calendarItemId: string,
  input: unknown,
  requestedBy?: string,
  attempt: number = 1
) => {
  const jobLog = workerLog.child({
    job_id: jobId,
    job_type: "creative",
    calendar_item_id: calendarItemId,
    attempt,
  });
  const startedAt = Date.now();
  try {
    jobLog.info({ event: "job_started" }, "Creative job iniciado");
    await addCreativeJobEvent(jobId, "job_started", "Creative job started.");
    await updateCreativeJob(jobId, { progress: 20, currentStep: "Buscando DNA da marca e post..." });

    const request = normalizeGenerateArtRequest(input);
    const context = await hydrateCreativeContextForItem(calendarItemId, request, requestedBy);

    if (context.request.mode === "template_master") {
      await completeTemplateMasterCreativeJob(jobId, context);
      await addCreativeJobEvent(jobId, "assets_created", "Template Master asset created.");
      return;
    }

    await updateCreativeJob(jobId, { status: "prompting", progress: 45, currentStep: "Gerando briefing e prompt..." });
    const output = await generateCreativePhaseOneOutput(context);

    if (context.request.mode === "template_svg") {
      await runTemplateSvgPipeline(jobId, context, output);
    } else if (context.request.mode === "design_recipe") {
      await runDesignRecipePipeline(jobId, context, output);
    } else {
      await runAiVisualPipeline(jobId, context, output);
    }

    await addCreativeJobEvent(jobId, "assets_created", "Creative assets created.");

    await updateCreativeJob(jobId, {
      status: "quality_check",
      progress: 90,
      currentStep: "Validando saida criativa...",
      visualBrief: output.visualBrief,
      selectedTemplateReason: undefined,
      imagePrompt: output.imagePrompt,
      layoutSpec: output.layoutSpec,
      output: {
        mode: context.request.mode,
        warnings: output.warnings,
        qualityReport: output.qualityReport,
      },
    });

    await updateCreativeJob(jobId, {
      status: "completed",
      progress: 100,
      currentStep: "Arte criativa pronta para revisao.",
      completedAt: new Date(),
    });

    jobLog.info(
      { event: "job_completed", duration_ms: Date.now() - startedAt },
      "Creative job concluido com sucesso"
    );
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown creative job error.";
    const errorCode = error?.code || error?.status || error?.response?.status || null;
    const transient = isTransientError(error);
    const canRetry = transient && attempt < MAX_JOB_ATTEMPTS;

    jobLog.error(
      {
        event: "job_failed",
        error_message: errorMessage,
        error_code: errorCode,
        transient,
        will_retry: canRetry,
      },
      "Falha no Creative job"
    );

    // Persist attempt_count + last_error (STORY-012 AC3/AC4).
    try {
      await db.query(
        `UPDATE creative_jobs
         SET attempt_count = $2,
             last_error = $3,
             last_error_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [jobId, attempt, errorMessage]
      );
    } catch (persistErr: any) {
      jobLog.warn(
        { event: "attempt_persist_failed", error_message: persistErr?.message },
        "Falha ao persistir attempt_count"
      );
    }

    if (canRetry) {
      const backoffMs = getBackoffMs(attempt);
      jobLog.info(
        { event: "job_retry_scheduled", attempt, backoff_ms: backoffMs },
        "Reagendando creative job apos erro transitorio"
      );
      // Re-queue: set back to queued so the worker picks it up again.
      await db.query(
        `UPDATE creative_jobs
         SET status='queued',
             progress=0,
             current_step='Aguardando nova tentativa...',
             started_at=NULL,
             updated_at=NOW()
         WHERE id=$1`,
        [jobId]
      );
      await db.query(
        `UPDATE calendar_items
         SET creative_status='queued',
             last_updated_at=NOW()
         WHERE latest_creative_job_id=$1`,
        [jobId]
      );
      // Defer return until backoff elapses so the same node doesn't immediately re-pick it.
      await sleep(backoffMs);
      return;
    }

    await updateCreativeJob(jobId, {
      status: "failed",
      progress: 100,
      currentStep: "Falha na producao criativa.",
      error: {
        message: errorMessage,
        stack: error?.stack || null,
      },
      completedAt: new Date(),
    });

    await db.query(
      `UPDATE calendar_items
       SET creative_status='failed',
           last_updated_at=NOW()
       WHERE latest_creative_job_id=$1`,
      [jobId]
    );
  }
};

const readObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const readString = (value: unknown, fallback = ""): string => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const extractCopy = (
  context: HydratedCreativeContext,
  output: CreativeGenerationOutput
): Record<string, unknown> => {
  const copy = readObject(output.copy);
  return {
    headline: readString(copy.headline, readString(context.request.overrides.headline, readString(context.request.overrides.tema, readString(context.calendarPost.tema, "Arte do post")))),
    body: readString(copy.body, readString(context.request.overrides.body, readString(context.calendarPost.copy_inicial, readString(context.calendarPost.legenda)))),
    callout: readString(copy.callout, readString(context.request.overrides.callout, readString(context.calendarPost.cta))),
    caption: readString(copy.caption, readString(context.request.overrides.legenda, readString(context.calendarPost.copy_inicial))),
  };
};

const extractBrandPalette = (context: HydratedCreativeContext): Record<string, string> => {
  const visualStyle = readObject(context.brandDNA.visual_style);
  const colors = Array.isArray(visualStyle.colors) ? visualStyle.colors.map(String) : [];
  const palette = readObject(visualStyle.palette);

  return {
    background: readString(palette.background, colors[0] || "#F7EFE8"),
    text: readString(palette.text, colors[1] || "#3F3A36"),
    accent: readString(palette.accent, colors[2] || "#C46F55"),
    primary: readString(palette.primary, colors[3] || "#A9B8AD"),
    muted: readString(palette.muted, colors[4] || "#EFE6DC"),
  };
};

const inferPostType = (context: HydratedCreativeContext, output: CreativeGenerationOutput): string => {
  if (context.request.postType) return context.request.postType;
  const source = [
    context.calendarPost.formato,
    context.calendarPost.tema,
    context.calendarPost.objetivo,
    output.visualBrief.title,
    output.visualBrief.strategicAngle,
  ].map((value) => String(value ?? "").toLowerCase()).join(" ");

  if (source.includes("frase") || source.includes("citacao") || source.includes("citação") || source.includes("reflex")) return "frase_do_dia";
  if (source.includes("dica")) return "dica";
  if (source.includes("oferta") || source.includes("promo")) return "oferta";
  if (source.includes("depoimento") || source.includes("prova")) return "prova_social";
  if (source.includes("antes") && source.includes("depois")) return "antes_depois";
  if (source.includes("bastidor")) return "bastidor";
  if (source.includes("live") || source.includes("evento")) return "chamada";
  return "educativo";
};

const defaultTemplateSvg = (width: number, height: number): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" data-color-token="background" fill="#F7EFE8"/>
  <circle cx="${Math.round(width * 0.88)}" cy="${Math.round(height * 0.12)}" r="${Math.round(width * 0.23)}" data-color-token="muted" fill="#EFE6DC"/>
  <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.08)}" width="${Math.round(width * 0.84)}" height="${Math.round(height * 0.5)}" rx="34" data-color-token="primary" fill="#A9B8AD" opacity="0.32"/>
  <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.63)}" width="${Math.round(width * 0.14)}" height="8" data-color-token="accent" fill="#C46F55"/>
  <text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.7)}" data-role="headline" data-max-line-length="24" data-line-height="1.08" font-family="Georgia, serif" font-size="68" font-weight="700" fill="#3F3A36">Headline</text>
  <text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.86)}" data-role="body" data-max-line-length="56" data-line-height="1.35" font-family="Arial, sans-serif" font-size="30" fill="#3F3A36">Body</text>
  <text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.94)}" data-role="callout" data-max-line-length="42" data-line-height="1.2" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#C46F55">Callout</text>
</svg>`;

const aiOverlaySvg = (width: number, height: number, hasImage: boolean): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="aiGradient" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#F7EFE8"/>
      <stop offset="56%" stop-color="#A9B8AD"/>
      <stop offset="100%" stop-color="#C46F55"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#aiGradient)"/>
  ${hasImage ? `<image data-role="hero_image" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" opacity="0.92"/>` : ""}
  <rect width="${width}" height="${height}" fill="#000" opacity="0.16"/>
  <rect x="${Math.round(width * 0.07)}" y="${Math.round(height * 0.57)}" width="${Math.round(width * 0.86)}" height="${Math.round(height * 0.35)}" rx="32" fill="#F7EFE8" opacity="0.9"/>
  <rect x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.62)}" width="${Math.round(width * 0.12)}" height="8" data-color-token="accent" fill="#C46F55"/>
  <text x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.69)}" data-role="headline" data-max-line-length="23" data-line-height="1.05" font-family="Georgia, serif" font-size="62" font-weight="700" fill="#3F3A36">Headline</text>
  <text x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.84)}" data-role="body" data-max-line-length="58" data-line-height="1.28" font-family="Arial, sans-serif" font-size="27" fill="#3F3A36">Body</text>
</svg>`;

const defaultTemplateRecord = (context: HydratedCreativeContext): CreativeTemplateRecord => ({
  id: "system-default-template",
  name: "Sphera Editorial Default",
  description: "Fallback system template for immediate SVG rendering.",
  niche: readString(context.brandDNA.niche, "generic"),
  format: readString(context.request.format, readString(context.calendarPost.formato, "Arte")),
  platform: context.request.platform,
  width: context.request.dimensions.width,
  height: context.request.dimensions.height,
  aspect_ratio: context.request.dimensions.aspectRatio,
  svg_content: defaultTemplateSvg(context.request.dimensions.width, context.request.dimensions.height),
  tags: ["fallback", "editorial"],
  editable_slots: {
    headline: { selector: "[data-role='headline']", maxLength: 90 },
    body: { selector: "[data-role='body']", maxLength: 220 },
    callout: { selector: "[data-role='callout']", maxLength: 80 },
  },
  color_tokens: {
    background: "#F7EFE8",
    text: "#3F3A36",
    accent: "#C46F55",
    primary: "#A9B8AD",
    muted: "#EFE6DC",
  },
  quality_score: 6,
  status: "active",
});

const defaultVisualRecipeRecord = (
  context: HydratedCreativeContext,
  postType: string,
  format: string
): VisualRecipeRecord => ({
  id: "system-default-recipe",
  clientId: null,
  sourceAssetId: null,
  sourceImageUrl: null,
  qualityScore: 6,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  name: "Sphera Editorial Recipe",
  scope: "global",
  postType: postType as VisualRecipeRecord["postType"],
  platform: context.request.platform,
  format,
  dimensions: context.request.dimensions,
  tags: ["fallback", "editorial"],
  mood: ["minimalista", "premium"],
  requiredSlots: ["eyebrow", "headline", "signature"],
  optionalSlots: ["background_image", "logo"],
  layoutRules: {
    safeArea: { top: 88, right: 88, bottom: 88, left: 88 },
    slots: {
      eyebrow: { role: "eyebrow", x: Math.round(context.request.dimensions.width * 0.68), y: 82, width: Math.round(context.request.dimensions.width * 0.24), height: 40, align: "right", maxFontSize: 22, maxLines: 1 },
      headline: { role: "headline", x: Math.round(context.request.dimensions.width * 0.2), y: Math.round(context.request.dimensions.height * 0.31), width: Math.round(context.request.dimensions.width * 0.6), height: Math.round(context.request.dimensions.height * 0.38), align: "center", minFontSize: 58, maxFontSize: 84, maxLines: 6 },
      signature: { role: "signature", x: Math.round(context.request.dimensions.width * 0.1), y: Math.round(context.request.dimensions.height * 0.92), width: Math.round(context.request.dimensions.width * 0.25), height: 44, align: "left", maxFontSize: 22, maxLines: 1 },
    },
    decorativeElements: [
      { type: "line", role: "top_rule", x1: 0, y1: 88, x2: Math.round(context.request.dimensions.width * 0.7), y2: 88, opacity: 0.74 },
      { type: "line", role: "bottom_rule", x1: Math.round(context.request.dimensions.width * 0.31), y1: Math.round(context.request.dimensions.height * 0.93), x2: context.request.dimensions.width, y2: Math.round(context.request.dimensions.height * 0.93), opacity: 0.74 },
    ],
  },
  styleRules: {
    backgroundStyle: "abstract_shadow_photo",
    contrast: "high",
    texture: "subtle_film_grain",
    typography: {
      headline: { family: "serif_display", weight: "bold", italicStrategy: "emphasize_keywords" },
      support: { family: "sans", weight: "regular", letterSpacing: 0.22 },
    },
    paletteStrategy: "brand_neutral_high_contrast",
  },
  backgroundPolicy: {
    supportsAiGenerated: true,
    supportsClientUpload: true,
    supportsAssetLibrary: true,
    defaultSource: "recipe_default",
  },
  status: "approved",
});

const loadTemplateSvg = async (template: CreativeTemplateRecord): Promise<string> => {
  if (template.svg_content) return template.svg_content;
  if (!template.svg_url) throw new Error("Template SVG source is empty.");

  if (template.svg_url.startsWith("http://") || template.svg_url.startsWith("https://")) {
    const response = await fetch(template.svg_url);
    if (!response.ok) throw new Error(`Template SVG fetch failed: ${response.status}`);
    return response.text();
  }

  if (template.svg_url.startsWith("/storage/")) {
    const localPath = path.resolve(__dirname, "../..", template.svg_url.replace(/^\//, ""));
    return fs.readFile(localPath, "utf8");
  }

  throw new Error("Unsupported template svg_url.");
};

const readSlotConfigRecord = (value: unknown): Record<string, { selector?: string; maxLength?: number }> => {
  const source = readObject(value);
  return Object.fromEntries(
    Object.entries(source).map(([key, raw]) => {
      const slot = readObject(raw);
      return [
        key,
        {
          selector: typeof slot.selector === "string" ? slot.selector : undefined,
          maxLength: Number.isFinite(Number(slot.maxLength)) ? Number(slot.maxLength) : undefined,
        },
      ];
    })
  );
};

const templateConfigFor = (template: CreativeTemplateRecord): TemplateRenderConfig => ({
  editableSlots: readSlotConfigRecord(template.editable_slots),
  colorTokens: Object.fromEntries(
    Object.entries(readObject(template.color_tokens)).map(([key, value]) => [key, String(value)])
  ),
  imageSlots: readSlotConfigRecord(template.image_slots),
});

const extensionForMime = (mimeType: string): string => {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return ".jpg";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("svg")) return ".svg";
  return ".png";
};

const runTemplateSvgPipeline = async (
  jobId: string,
  context: HydratedCreativeContext,
  output: CreativeGenerationOutput
) => {
  await updateCreativeJob(jobId, { status: "selecting_template", progress: 58, currentStep: "Selecionando template SVG..." });

  const requestedFormat = readString(context.request.format, readString(context.calendarPost.formato, "Arte"));
  const candidates = context.request.templateId
    ? [await getCreativeTemplateById(context.request.templateId)].filter((template): template is CreativeTemplateRecord => !!template)
    : await listActiveCreativeTemplates(context.request.platform, requestedFormat);

  const fallbackTemplate = defaultTemplateRecord(context);
  const selected = selectBestCreativeTemplate(
    candidates.length > 0 ? candidates : [fallbackTemplate],
    {
      format: requestedFormat,
      platform: context.request.platform,
      niche: readString(context.brandDNA.niche, readString(context.calendarPost.nicho)),
      tags: [readString(context.calendarPost.objetivo), readString(output.visualBrief.visualStyle)].filter(Boolean),
      dimensions: context.request.dimensions,
    }
  );

  const template = selected?.template || fallbackTemplate;
  const templateSvg = await loadTemplateSvg(template);
  const brandPalette = extractBrandPalette(context);
  const copy = extractCopy(context, output);

  await updateCreativeJob(jobId, {
    status: "rendering",
    progress: 72,
    currentStep: "Renderizando template SVG...",
    selectedTemplateReason: {
      templateId: template.id,
      name: template.name,
      score: selected?.score || 0,
      reasons: selected?.reasons || ["fallback"],
    },
    renderPayload: {
      mode: "template_svg",
      copy,
      dimensions: context.request.dimensions,
    },
    provider: {
      textModel: "gemini",
      imageModel: "not_used_template_svg",
      renderer: "svg_puppeteer",
    },
  });

  const rendered = renderTemplateSvgToSvg({
    templateSvg,
    copy,
    brandPalette,
    templateConfig: templateConfigFor(template),
  });

  const svgFile = await writeCreativeAssetFile(context.clienteId, jobId, "template-render.svg", rendered.svg, "image/svg+xml");
  const pngBuffer = await renderSvgToPngBuffer({
    svg: rendered.svg,
    width: context.request.dimensions.width,
    height: context.request.dimensions.height,
  });
  const pngFile = await writeCreativeAssetFile(context.clienteId, jobId, "template-render.png", pngBuffer, "image/png");

  await insertRenderedCreativeAsset({
    jobId,
    context,
    templateId: template.id === fallbackTemplate.id ? null : template.id,
    assetType: "rendered_post",
    title: readString(copy.headline, "Arte por template SVG"),
    description: readString(output.visualBrief.strategicAngle),
    fileUrl: pngFile.publicUrl,
    previewUrl: pngFile.publicUrl,
    editableSvgUrl: svgFile.publicUrl,
    width: context.request.dimensions.width,
    height: context.request.dimensions.height,
    mimeType: pngFile.mimeType,
    fileSize: pngFile.fileSize,
    prompt: output.imagePrompt,
    metadata: {
      mode: "template_svg",
      template: { id: template.id, name: template.name },
      svgUrl: svgFile.publicUrl,
      warnings: [...output.warnings, ...rendered.warnings],
    },
    qualityReport: output.qualityReport,
  });

  await insertCreativePhaseOneAssets(jobId, context, output);
};

const runAiVisualPipeline = async (
  jobId: string,
  context: HydratedCreativeContext,
  output: CreativeGenerationOutput
) => {
  await updateCreativeJob(jobId, { status: "rendering", progress: 66, currentStep: "Gerando imagem com IA Visual..." });

  const prompt = readString(output.imagePrompt.technicalPrompt, `Premium editorial visual about ${readString(output.visualBrief.title, readString(context.calendarPost.tema))}`);
  const negativePrompt = readString(output.imagePrompt.negativePrompt);
  const visualReferences = context.request.references
    .filter((reference) => reference.type === "image" && !!reference.url)
    .map((reference) => ({
      url: String(reference.url),
      usage: reference.usage,
      weight: reference.weight,
    }));
  const imageResult = await generateAiVisualImage({
    prompt,
    negativePrompt,
    dimensions: context.request.dimensions,
    referenceImages: visualReferences,
  });

  const copy = extractCopy(context, output);
  const brandPalette = extractBrandPalette(context);
  let imageDataUri: string | undefined;
  let sourceImageUrl: string | undefined;
  let provider = imageResult?.provider || {
    imageModel: "fallback_system_render",
    generatedBy: "system_fallback",
    reason: "GOOGLE_API_KEY or image response unavailable",
  };

  if (imageResult) {
    const extension = extensionForMime(imageResult.mimeType);
    const source = await writeCreativeAssetFile(context.clienteId, jobId, `ai-generated-source${extension}`, imageResult.bytes, imageResult.mimeType);
    sourceImageUrl = source.publicUrl;
    imageDataUri = `data:${imageResult.mimeType};base64,${imageResult.bytes.toString("base64")}`;
    await insertRenderedCreativeAsset({
      jobId,
      context,
      assetType: "ai_generated_image",
      title: "Imagem base gerada por IA",
      description: prompt,
      fileUrl: source.publicUrl,
      previewUrl: source.publicUrl,
      width: context.request.dimensions.width,
      height: context.request.dimensions.height,
      mimeType: source.mimeType,
      fileSize: source.fileSize,
      prompt: output.imagePrompt,
      metadata: { mode: "ai_visual", sourceOnly: true },
      qualityReport: output.qualityReport,
    });
  }

  const rendered = renderTemplateSvgToSvg({
    templateSvg: aiOverlaySvg(context.request.dimensions.width, context.request.dimensions.height, !!imageDataUri),
    copy,
    brandPalette,
    images: imageDataUri ? { hero_image: imageDataUri } : {},
    templateConfig: {
      editableSlots: {
        headline: { selector: "[data-role='headline']", maxLength: 90 },
        body: { selector: "[data-role='body']", maxLength: 180 },
      },
      colorTokens: {
        background: readString(brandPalette.background, "#F7EFE8"),
        accent: readString(brandPalette.accent, "#C46F55"),
      },
      imageSlots: {
        hero_image: { selector: "[data-role='hero_image']" },
      },
    },
  });

  const svgFile = await writeCreativeAssetFile(context.clienteId, jobId, "ai-visual-final.svg", rendered.svg, "image/svg+xml");
  const pngBuffer = await renderSvgToPngBuffer({
    svg: rendered.svg,
    width: context.request.dimensions.width,
    height: context.request.dimensions.height,
  });
  const pngFile = await writeCreativeAssetFile(context.clienteId, jobId, "ai-visual-final.png", pngBuffer, "image/png");

  await updateCreativeJob(jobId, {
    renderPayload: {
      mode: "ai_visual",
      prompt,
      negativePrompt,
      copy,
      sourceImageUrl: sourceImageUrl || null,
      visualReferences,
    },
    provider: {
      textModel: "gemini",
      renderer: "svg_puppeteer_overlay",
      ...provider,
    },
  });

  await insertRenderedCreativeAsset({
    jobId,
    context,
    assetType: "rendered_post",
    title: readString(copy.headline, "Arte IA Visual"),
    description: readString(output.visualBrief.strategicAngle),
    fileUrl: pngFile.publicUrl,
    previewUrl: pngFile.publicUrl,
    editableSvgUrl: svgFile.publicUrl,
    width: context.request.dimensions.width,
    height: context.request.dimensions.height,
    mimeType: pngFile.mimeType,
    fileSize: pngFile.fileSize,
    prompt: output.imagePrompt,
    metadata: {
      mode: "ai_visual",
      sourceImageUrl: sourceImageUrl || null,
      visualReferences,
      fallback: !imageResult,
      svgUrl: svgFile.publicUrl,
      warnings: [...output.warnings, ...rendered.warnings],
    },
    qualityReport: output.qualityReport,
  });

  await insertCreativePhaseOneAssets(jobId, context, output);
};

const runDesignRecipePipeline = async (
  jobId: string,
  context: HydratedCreativeContext,
  output: CreativeGenerationOutput
) => {
  await updateCreativeJob(jobId, { status: "selecting_template", progress: 58, currentStep: "Selecionando receita visual..." });

  const postType = inferPostType(context, output);
  const requestedFormat = readString(context.request.format, readString(context.calendarPost.formato, "Arte"));
  const fallbackRecipe = defaultVisualRecipeRecord(context, postType, requestedFormat);
  const explicitRecipe = context.request.recipeId
    ? context.request.recipeId === fallbackRecipe.id
      ? fallbackRecipe
      : await getVisualRecipeById(context.request.recipeId)
    : null;

  const ranked = explicitRecipe
    ? [{ recipe: explicitRecipe, score: 100, reasons: ["explicit_recipe"] }]
    : [
        ...rankVisualRecipes(
        await listVisualRecipesForClient(context.clienteId, {
          postType,
          platform: context.request.platform,
          format: requestedFormat,
        }),
        {
          clientId: context.clienteId,
          postType,
          platform: context.request.platform,
          format: requestedFormat,
          tags: [readString(context.calendarPost.objetivo), readString(context.calendarPost.tema)].filter(Boolean),
          dimensions: context.request.dimensions,
          brandDNA: context.brandDNA,
        }
      ),
        { recipe: fallbackRecipe, score: 58, reasons: ["system_fallback"] },
      ];

  if (context.request.decisionMode === "suggest_first" && !context.request.recipeId) {
    await updateCreativeJob(jobId, {
      status: "completed",
      progress: 100,
      currentStep: "Sugestoes de receitas prontas para escolha.",
      output: {
        mode: "design_recipe",
        postType,
        suggestions: ranked.slice(0, context.request.suggestionsCount).map((item) => ({
          recipeId: item.recipe.id,
          name: item.recipe.name,
          score: item.score,
          reasons: item.reasons,
          scope: item.recipe.scope,
        })),
      },
      completedAt: new Date(),
    });
    return;
  }

  const selected = ranked[0];
  if (!selected) {
    throw new Error(`Nenhuma receita visual aprovada encontrada para ${postType}.`);
  }

  const copy: Record<string, unknown> = {
    ...extractCopy(context, output),
    eyebrow: readString(context.request.overrides.eyebrow, postType === "frase_do_dia" ? "FRASE DO DIA" : requestedFormat.toUpperCase()),
    signature: readString(context.request.overrides.signature, readString(context.brandDNA.instagram_handle, "@SPHERA")),
  };
  const brandPalette = extractBrandPalette(context);

  const recipeBackground = await buildRecipeRenderBackground({
    clienteId: context.clienteId,
    jobId,
    recipe: selected.recipe,
    backgroundSource: context.request.backgroundSource,
    dimensions: context.request.dimensions,
    generationOptions: {
      generateImage: context.request.generationOptions.generateImage,
    },
    imagePrompt: output.imagePrompt,
  });

  if (recipeBackground.storedBackground) {
    await insertRenderedCreativeAsset({
      jobId,
      context,
      visualRecipeId: selected.recipe.id === fallbackRecipe.id ? null : selected.recipe.id,
      assetType: "ai_generated_image",
      title: "Fundo gerado por IA",
      description: readString(output.imagePrompt.technicalPrompt, "Imagem de fundo para receita visual"),
      fileUrl: recipeBackground.storedBackground.publicUrl,
      previewUrl: recipeBackground.storedBackground.publicUrl,
      width: context.request.dimensions.width,
      height: context.request.dimensions.height,
      mimeType: recipeBackground.storedBackground.mimeType,
      fileSize: recipeBackground.storedBackground.fileSize,
      prompt: output.imagePrompt,
      metadata: {
        mode: "design_recipe",
        recipe: { id: selected.recipe.id, name: selected.recipe.name, scope: selected.recipe.scope },
        backgroundSource: context.request.backgroundSource,
      },
      qualityReport: output.qualityReport,
    });
  }

  await updateCreativeJob(jobId, {
    status: "rendering",
    progress: 74,
    currentStep: "Renderizando receita visual...",
    selectedTemplateReason: {
      visualRecipeId: selected.recipe.id,
      name: selected.recipe.name,
      score: selected.score,
      reasons: selected.reasons,
      postType,
    },
    renderPayload: {
      mode: "design_recipe",
      postType,
      recipeId: selected.recipe.id,
      copy,
      backgroundSource: context.request.backgroundSource,
      generatedBackgroundUrl: recipeBackground.generatedBackgroundUrl || null,
    },
    provider: {
      textModel: "gemini",
      renderer: "recipe_svg_puppeteer",
      backgroundImage: recipeBackground.provider || null,
    },
  });

  const rendered = renderRecipeToSvg({
    recipe: selected.recipe,
    dimensions: context.request.dimensions,
    copy,
    brandPalette,
    background: recipeBackground.background,
  });

  const svgFile = await writeCreativeAssetFile(context.clienteId, jobId, "design-recipe-final.svg", rendered.svg, "image/svg+xml");
  const pngBuffer = await renderSvgToPngBuffer({
    svg: rendered.svg,
    width: context.request.dimensions.width,
    height: context.request.dimensions.height,
  });
  const pngFile = await writeCreativeAssetFile(context.clienteId, jobId, "design-recipe-final.png", pngBuffer, "image/png");

  await insertRenderedCreativeAsset({
    jobId,
    context,
    visualRecipeId: selected.recipe.id === fallbackRecipe.id ? null : selected.recipe.id,
    assetType: "rendered_post",
    title: readString(copy.headline, "Arte por receita visual"),
    description: readString(output.visualBrief.strategicAngle),
    fileUrl: pngFile.publicUrl,
    previewUrl: pngFile.publicUrl,
    editableSvgUrl: svgFile.publicUrl,
    width: context.request.dimensions.width,
    height: context.request.dimensions.height,
    mimeType: pngFile.mimeType,
    fileSize: pngFile.fileSize,
    prompt: output.imagePrompt,
    metadata: {
      mode: "design_recipe",
      postType,
      recipe: { id: selected.recipe.id, name: selected.recipe.name, scope: selected.recipe.scope },
      generatedBackgroundUrl: recipeBackground.generatedBackgroundUrl || null,
      svgUrl: svgFile.publicUrl,
      warnings: [...output.warnings, ...recipeBackground.warnings, ...rendered.warnings],
    },
    qualityReport: output.qualityReport,
  });

  await insertCreativePhaseOneAssets(jobId, context, output);
};
