import db from "../config/database";
import { generateCalendarForMonth, distributeMixAcrossMonths } from "../services/calendarGenerator";
import { generatePresentationContentPipeline, renderPresentationDeck } from "../routes/presentation";

// ConfiguraÃ§Ãµes
const POLLING_INTERVAL_MS = 5000; // 5 segundos
// const MAX_CONCURRENT_JOBS = 1; // Por instÃ¢ncia (simples por enquanto)

export const startCalendarGenerationWorker = () => {
    console.log("ðŸ‘· [WORKER] Iniciando Calendar Generation Worker...");

    // Loop infinito de polling
    const loop = async () => {
        try {
            await processNextJob();
        } catch (e) {
            console.error("âŒ [WORKER] Erro no loop de processamento:", e);
        } finally {
            setTimeout(loop, POLLING_INTERVAL_MS);
        }
    };

    // Cleanup de jobs Ã³rfÃ£os antes de iniciar o loop
    // Se o servidor foi reiniciado no meio de um job 'running', ele nunca voltaria a 'pending'
    // (o worker sÃ³ pega status='pending'). Marcamos como 'failed' para a UI parar o polling.
    const cleanupOrphanJobs = async () => {
        try {
            const result = await db.query(`
                UPDATE calendar_generation_jobs
                SET status = 'failed',
                    error = '{"message":"Job Ã³rfÃ£o: servidor foi reiniciado durante a execuÃ§Ã£o"}',
                    finished_at = NOW(),
                    updated_at = NOW()
                WHERE status = 'running'
                  AND updated_at < NOW() - INTERVAL '30 minutes'
            `);
            const count = result.rowCount ?? 0;
            if (count > 0) {
                console.warn(`âš ï¸ [WORKER] ${count} job(s) Ã³rfÃ£o(s) em 'running' marcados como 'failed'.`);
            }
        } catch (err) {
            console.error("âŒ [WORKER] Erro ao limpar jobs Ã³rfÃ£os:", err);
        }
    };

    cleanupOrphanJobs().then(() => loop());
};

const updateJobProgress = async (jobId: string, progress: number, currentStep: string) => {
    await db.query(
        `UPDATE calendar_generation_jobs
         SET progress = $1, current_step = $2, updated_at = NOW()
         WHERE id = $3`,
        [Math.max(0, Math.min(100, Math.round(progress))), currentStep, jobId]
    );
};

const processNextJob = async () => {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const claimResult = await client.query(`
      SELECT id, cliente_id, payload 
      FROM calendar_generation_jobs
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
        const jobId = job.id;
        const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};
        const jobType = String(payload.jobType || 'calendar');
        const startStep = jobType === 'presentation' ? 'Iniciando apresentacao...' : 'Iniciando...';

        console.log(`👷 [WORKER] Processando Job ${jobId} (${jobType})...`);

        await client.query(`
      UPDATE calendar_generation_jobs
      SET status = 'running', started_at = NOW(), updated_at = NOW(), progress = 0, current_step = $2
      WHERE id = $1
    `, [jobId, startStep]);

        await client.query("COMMIT");

        try {
            const jobResult = await runJobLogic(jobId, job.cliente_id, payload);

            if (jobResult !== undefined) {
                await db.query(`
        UPDATE calendar_generation_jobs
        SET status = 'succeeded',
            progress = 100,
            current_step = 'Concluido',
            finished_at = NOW(),
            updated_at = NOW(),
            payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{result}', $2::jsonb, true)
        WHERE id = $1
      `, [jobId, JSON.stringify(jobResult)]);
            } else {
                await db.query(`
        UPDATE calendar_generation_jobs
        SET status = 'succeeded', progress = 100, current_step = 'Concluido', finished_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [jobId]);
            }

            console.log(`✅ [WORKER] Job ${jobId} concluido com sucesso.`);
        } catch (jobError: any) {
            if (jobError.message === 'JOB_CANCELED') {
                console.log(`🛑 [WORKER] Job ${jobId} interrompido pois foi cancelado.`);
                return;
            }

            console.error(`❌ [WORKER] Falha no Job ${jobId}:`, jobError);

            let errorData: any = { message: jobError.message, stack: jobError.stack };
            if (jobError.type === 'INVALID_CALENDAR_OUTPUT') {
                errorData = {
                    error: jobError.type,
                    details: jobError.details,
                    correlationId: jobError.correlationId
                };
            }

            await db.query(`
        UPDATE calendar_generation_jobs
        SET status = 'failed', error = $2, finished_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [jobId, JSON.stringify(errorData)]);
        }
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
};

const runPresentationJobLogic = async (jobId: string, clienteId: string, payload: any) => {
    const operation = String(payload?.operation || 'render');
    const checkCancellation = async () => {
        const check = await db.query("SELECT status FROM calendar_generation_jobs WHERE id = $1", [jobId]);
        if (check.rows[0]?.status === 'canceled') {
            throw new Error('JOB_CANCELED');
        }
    };

    const onProgress = async (progress: number, step: string) => {
        await checkCancellation();
        await updateJobProgress(jobId, progress, step);
    };

    await checkCancellation();

    if (operation === 'content') {
        const requestedMonths = Array.isArray(payload?.months)
            ? payload.months.map((month: any) => String(month || '').trim()).filter(Boolean)
            : [];
        const result = await generatePresentationContentPipeline(clienteId, requestedMonths, onProgress);
        return {
            operation: 'content',
            content: result.content,
            strategyBrief: result.strategyBrief,
            plannerLabel: result.plannerLabel,
            roadmapMonths: result.roadmapMonths,
        };
    }

    const input = payload?.input && typeof payload.input === 'object' ? payload.input : {};
    const result = await renderPresentationDeck(
        { ...input, clienteId: input?.clienteId || clienteId },
        { renderKey: jobId, onProgress }
    );
    return {
        operation: 'render',
        content: result.content,
        images: result.images,
        tempFiles: result.tempFiles,
        renderKey: result.renderKey,
    };
};

const runJobLogic = async (jobId: string, clienteId: string, payload: any) => {
    const jobType = String(payload?.jobType || 'calendar');
    if (jobType === 'presentation') {
        return runPresentationJobLogic(jobId, clienteId, payload);
    }
    return runCalendarJobLogic(jobId, clienteId, payload);
};

const runCalendarJobLogic = async (jobId: string, clienteId: string, payload: any) => {
    const {
        monthsToGenerate, briefing, monthReferences, formatInstructions, chainOutputFinal, generationPrompt, produtosFocoIds
    } = payload;

    const DEFAULT_MIX = { reels: 4, static: 8, carousel: 4, stories: 8, photos: 0 };
    const mix = payload.mix || DEFAULT_MIX;

    // Garantir que periodo venha certo (no payload do controller salvamos como 'periodo')
    const periodo = payload.periodo || payload.period || 30;

    // Busca dados auxiliares do cliente para passar ao service
    // Na verdade o service jÃ¡ faz algumas buscas de dados. Vamos otimizar.
    // O Service pede alguns dados que o payload jÃ¡ tem.
    // Faltam: rules, docsResumo, categoriasNicho. Vamos buscar aqui para passar limpo.

    // Buscar regras
    const rulesResult = await db.query("SELECT regra FROM brand_rules WHERE cliente_id = $1 AND ativa = true", [clienteId]);
    const rules = rulesResult.rows.map((r: any) => `- ${r.regra}`).join("\n");

    // Buscar docs
    const docsResult = await db.query("SELECT tipo, conteudo_texto FROM brand_docs WHERE cliente_id = $1", [clienteId]);
    const docsResumo = docsResult.rows.map((d: any) => `- (${d.tipo}) ${d.conteudo_texto}`).join("\n");

    // Buscar categorias/Branding completo se precisarmos re-hidratar algo que nÃ£o veio no payload
    // O payload tem 'briefing', 'mix', etc. mas nÃ£o o objeto branding completo com keywords, tom, etc.
    // Se o payload nÃ£o salvou o obojeto branding completo, precisamos buscar.
    // O controller salvou: clienteId, briefing, periodo, mix, generationPrompt, chainId, formatInstructions...
    // NÃƒO salvou o branding object. O service precisa dele.

    const brandingResult = await db.query("SELECT * FROM branding WHERE cliente_id = $1", [clienteId]);
    let branding = brandingResult.rows[0] || { tone_of_voice: "Neutro", visual_style: "PadrÃ£o", audience: "Geral" };

    // Categorias nicho
    let categoriasNicho: string[] = [];
    try {
        const clientRes = await db.query("SELECT categorias_nicho FROM clientes WHERE id = $1", [clienteId]);
        if (Array.isArray(clientRes.rows[0]?.categorias_nicho)) {
            categoriasNicho = clientRes.rows[0].categorias_nicho;
        }
    } catch (_) { }

    // DistribuiÃ§Ã£o de Mix por mÃªs
    // Prioridade: monthlyMix (por mÃªs) > distributeMixAcrossMonths (trimestral) > mix global
    const monthlyMix = payload.monthlyMix || null;
    const isTrimestral = periodo === 90;
    const mixesByMonth: any[] = monthlyMix
        ? monthsToGenerate.map((m: string) => monthlyMix[m] || mix) // usa mix specific do mÃªs ou fallback global
        : isTrimestral
            ? distributeMixAcrossMonths(mix, monthsToGenerate.length)
            : monthsToGenerate.map(() => mix);

    let continuityContext = "";
    const resultCalendarIds: string[] = [];
    const totalSteps = monthsToGenerate.length;

    for (let i = 0; i < totalSteps; i++) {
        const mes = monthsToGenerate[i];
        const mixForMes = mixesByMonth[i] || mix;

        // Checar Cancelamento
        const jobCheck = await db.query("SELECT status FROM calendar_generation_jobs WHERE id = $1", [jobId]);
        if (jobCheck.rows[0]?.status === 'canceled') {
            throw new Error('JOB_CANCELED');
        }

        // Progresso base para este mÃªs (ex: 1/3 = 33%)
        const baseProgress = (i / totalSteps) * 100;
        const stepSize = 100 / totalSteps;

        await db.query(`
      UPDATE calendar_generation_jobs 
      SET progress = $1, current_step = $2, updated_at = NOW()
      WHERE id = $3
    `, [Math.round(baseProgress), `[MÃªs ${i + 1}/${totalSteps}] Iniciando geraÃ§Ã£o para ${mes}...`, jobId]);

        // Gera
        const result = await generateCalendarForMonth({
            jobId,
            clienteId,
            mesToGenerate: mes,
            mixForThisMonth: mixForMes,
            branding,
            briefing,
            rules,
            docsResumo,
            formatInstructions,
            monthReferences,
            continuityContext,
            periodoFinal: periodo,
            effectiveGenerationPrompt: chainOutputFinal ? `${generationPrompt}\nCONTEXT:${chainOutputFinal}` : generationPrompt,
            categoriasNicho,
            produtosFocoIds,
            checkCancellation: async () => {
                const check = await db.query("SELECT status FROM calendar_generation_jobs WHERE id = $1", [jobId]);
                if (check.rows[0]?.status === 'canceled') {
                    throw new Error('JOB_CANCELED');
                }
            },
            onProgress: async (relativePct: number, stepMsg: string) => {
                const currentTotalProgress = Math.round(baseProgress + (stepSize * (relativePct / 100)));
                const stepMessage = `[MÃªs ${i + 1}/${totalSteps}] ${stepMsg}`;
                await db.query(`
                  UPDATE calendar_generation_jobs 
                  SET progress = $1, current_step = $2, updated_at = NOW()
                  WHERE id = $3
                `, [currentTotalProgress, stepMessage, jobId]);
            }
        });

        resultCalendarIds.push(result.calendarId);

        // Atualiza contexto para prÃ³ximo mÃªs
        if (Array.isArray(result.calendarData)) {
            const temas = result.calendarData.slice(0, 5).map((p: any) => p.tema).join(", ");
            continuityContext += `\n[${mes}]: ${temas}...`;
        }
    }

    // FinalizaÃ§Ã£o: Publicar calendÃ¡rios (Mudar de Draft -> Published)
    // Isso garante atomicidade visual para o usuÃ¡rio
    await db.query(`
    UPDATE calendarios 
    SET status = 'published' 
    WHERE generation_job_id = $1 AND status = 'draft'
  `, [jobId]);

    // Atualiza job com IDs gerados
    await db.query(`
    UPDATE calendar_generation_jobs 
    SET result_calendar_ids = $1
    WHERE id = $2
  `, [resultCalendarIds, jobId]);
};


