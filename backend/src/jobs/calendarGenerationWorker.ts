import db from "../config/database";
import { generateCalendarForMonth, distributeMixAcrossMonths } from "../services/calendarGenerator";
import { generatePresentationContentPipeline, renderPresentationDeck } from "../routes/presentation";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

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

const fetchHistoricalContext = async (clienteId: string): Promise<string> => {
    try {
        const result = await db.query(
            `SELECT mes, calendario_json FROM calendarios
             WHERE cliente_id = $1 AND status = 'published'
             ORDER BY criado_em DESC LIMIT 2`,
            [clienteId]
        );
        if (result.rows.length === 0) return "";
        return result.rows
            .reverse()
            .map((c: any) => {
                const posts = Array.isArray(c.calendario_json) ? c.calendario_json : [];
                const temas = posts.slice(0, 5).map((p: any) => p.tema).filter(Boolean).join(", ");
                return temas ? `[${c.mes}]: ${temas}` : "";
            })
            .filter(Boolean)
            .join("\n");
    } catch (_) {
        return "";
    }
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

const runExcelJobLogic = async (jobId: string, _clienteId: string, payload: any) => {
    const { calendarId, clientName, monthsSelected } = payload as {
        calendarId: string;
        clientName?: string;
        monthsSelected?: number[];
    };

    await updateJobProgress(jobId, 5, 'Buscando dados do calendário...');

    const result = await db.query(
        "SELECT calendario_json, mes, cliente_id, periodo FROM calendarios WHERE id = $1",
        [calendarId]
    );
    if (result.rows.length === 0) throw new Error(`Calendário não encontrado: ${calendarId}`);

    const calendar = result.rows[0];
    let posts = calendar.calendario_json;
    const monthLabel: string = calendar.mes || "Janeiro";
    const periodo = calendar.periodo;
    const clienteId = String(calendar.cliente_id || _clienteId);

    let resolvedClientName = clientName || "Cliente";
    try {
        if (clienteId) {
            const clientResult = await db.query("SELECT nome FROM clientes WHERE id = $1", [clienteId]);
            const dbName = clientResult.rows?.[0]?.nome;
            if (dbName) resolvedClientName = dbName;
        }
    } catch (_) {}

    const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const monthNamePt = (m?: number) => m ? (monthNames[m - 1] || `Mes${m}`) : "Mes";

    const parseMonthLabelToNumber = (label: string): number | null => {
        const token = String(label || "").trim().toLowerCase().split(/\s+/)[0] || "";
        const map: Record<string, number> = { janeiro:1,fevereiro:2,"março":3,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 };
        return map[token] ?? null;
    };

    const parseYearFromLabel = (label: string, fallback: number) => {
        const m = String(label || "").match(/(\d{4})/);
        const p = m?.[1] ? parseInt(m[1], 10) : NaN;
        return Number.isNaN(p) ? fallback : p;
    };

    const sanitize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"").trim();

    const parsePostDate = (value: any): { day: number; month: number; year?: number } | null => {
        const raw = String(value ?? "").trim();
        if (!raw || ["undefined","null","none"].includes(raw.toLowerCase())) return null;
        let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return { day: parseInt(m[3]!,10), month: parseInt(m[2]!,10), year: parseInt(m[1]!,10) };
        m = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
        if (!m) return null;
        return { day: parseInt(m[1]!,10), month: parseInt(m[2]!,10), year: m[3] ? parseInt(m[3],10) : undefined };
    };

    const baseMonthNum = parseMonthLabelToNumber(monthLabel) || 1;
    const baseYearNum = parseInt(String(parseYearFromLabel(monthLabel, new Date().getFullYear())), 10);

    const normalizePosts = (calPosts: any[], srcLabel: string) => {
        const fbMonth = parseMonthLabelToNumber(srcLabel) || baseMonthNum;
        const fbYear = parseYearFromLabel(srcLabel, baseYearNum);
        return (Array.isArray(calPosts) ? calPosts : []).map((post: any) => {
            const pd = parsePostDate(post?.data);
            const rawDay = post?.dia ?? post?.day;
            const fbDay = parseInt(String(rawDay ?? ""), 10);
            let normalizedDate = "";
            if (pd?.day && pd?.month) {
                normalizedDate = `${String(pd.day).padStart(2,"0")}/${String(pd.month).padStart(2,"0")}/${pd.year || fbYear}`;
            } else if (!Number.isNaN(fbDay) && fbDay >= 1 && fbDay <= 31) {
                normalizedDate = `${String(fbDay).padStart(2,"0")}/${String(fbMonth).padStart(2,"0")}/${fbYear}`;
            } else if (typeof post?.data === "string") {
                normalizedDate = post.data;
            }
            return { ...post, data: normalizedDate, _export_month: fbMonth, _export_year: fbYear };
        });
    };

    const requestedMonths = Array.isArray(monthsSelected) && monthsSelected.length > 0
        ? monthsSelected.map(m => parseInt(String(m),10)).filter(m => !Number.isNaN(m) && m >= 1 && m <= 12).sort((a,b) => a-b)
        : [];

    const detectMonths = (calPosts: any[]) => {
        const months = new Set<number>();
        for (const p of calPosts || []) {
            const m = String((p as any)?.data || "").match(/\b(\d{1,2})\/(\d{1,2})\b/);
            if (m) { const mn = parseInt(String(m[2]||""),10); if (mn >= 1 && mn <= 12) months.add(mn); }
        }
        return Array.from(months).sort((a,b) => a-b);
    };

    const monthsToExport = requestedMonths.length > 0 ? requestedMonths : detectMonths(posts);
    let exportMonthLabel = monthLabel;

    await updateJobProgress(jobId, 20, 'Consolidando posts dos meses...');

    const mergedPosts: any[] = [];
    const resolvedMonthLabels = new Map<number, string>();

    const appendPosts = (calPosts: any[], srcLabel: string) => {
        const normalized = normalizePosts(calPosts, srcLabel);
        if (normalized.length > 0) mergedPosts.push(...normalized);
        const n = parseMonthLabelToNumber(srcLabel);
        if (n && !resolvedMonthLabels.has(n)) resolvedMonthLabels.set(n, srcLabel);
    };

    const shouldUseRequested = requestedMonths.length > 0;
    const shouldIncludeBase = !shouldUseRequested || requestedMonths.includes(baseMonthNum);
    if (shouldIncludeBase) appendPosts(Array.isArray(posts) ? posts : [], monthLabel);

    if (shouldUseRequested && clienteId) {
        const monthSearchTokens = (n: number) => n === 3 ? ["março","marco"] : [monthNamePt(n).toLowerCase()];
        for (const m of requestedMonths) {
            if (m === baseMonthNum && shouldIncludeBase) continue;
            const yNum = m < baseMonthNum && baseMonthNum >= 9 && m <= 4 ? baseYearNum + 1 : baseYearNum;
            const label = `${monthNamePt(m)} ${yNum}`;
            let other = await db.query(
                "SELECT calendario_json, mes FROM calendarios WHERE cliente_id = $1 AND lower(mes) = lower($2) ORDER BY updated_at DESC NULLS LAST, criado_em DESC NULLS LAST LIMIT 1",
                [clienteId, label]
            );
            if (!other.rows?.length) {
                for (const token of monthSearchTokens(m)) {
                    other = await db.query(
                        "SELECT calendario_json, mes FROM calendarios WHERE cliente_id = $1 AND lower(mes) LIKE $2 AND lower(mes) LIKE $3 ORDER BY updated_at DESC NULLS LAST, criado_em DESC NULLS LAST LIMIT 1",
                        [clienteId, `%${token}%`, `%${String(yNum)}%`]
                    );
                    if (other.rows?.length) break;
                }
            }
            if (!other.rows?.length) continue;
            const otherPosts = other.rows[0]?.calendario_json;
            const srcLabel = String(other.rows[0]?.mes || label);
            if (Array.isArray(otherPosts) && otherPosts.length > 0) appendPosts(otherPosts, srcLabel);
        }
    }

    if (mergedPosts.length > 0) posts = mergedPosts;
    else posts = normalizePosts(Array.isArray(posts) ? posts : [], monthLabel);

    if (requestedMonths.length > 0) {
        const first = requestedMonths[0] ?? baseMonthNum;
        exportMonthLabel = resolvedMonthLabels.get(first) || `${monthNamePt(first)} ${baseYearNum}`;
    }

    const safeClient = sanitize(resolvedClientName || "Cliente") || "Cliente";
    const safeMonth = (() => {
        const nm = monthsToExport.filter(m => m >= 1 && m <= 12).sort((a,b) => a-b);
        if (nm.length >= 2) return sanitize(`${monthNamePt(nm[0])}-${monthNamePt(nm[nm.length-1])}_${baseYearNum}`);
        return sanitize(String(monthLabel).replace(/\s+/g,"_")) || "Mes";
    })();

    const backendDir = process.cwd();
    const projectDir = path.resolve(backendDir, "..");
    const pythonScript = path.resolve(backendDir, "python_gen", "calendar_to_excel.py");
    const templatePreferred = path.resolve(projectDir, "calendario", "modelo final.xlsx");
    const templateFallback = path.resolve(projectDir, "calendario", "CoreSport_Tri_2026.xlsx");
    const templatePath = fs.existsSync(templatePreferred) ? templatePreferred : templateFallback;

    const outputDir = path.resolve(projectDir, "calendario", "output");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputFileName = `${safeClient}_${safeMonth}.xlsx`;
    const outputPath = path.join(outputDir, outputFileName);

    await updateJobProgress(jobId, 40, 'Gerando planilha Excel...');

    const pythonBin = process.env.PYTHON_BIN || "python3";
    await new Promise<void>((resolve, reject) => {
        const proc = spawn(pythonBin, [
            pythonScript, "--stdin", templatePath, outputPath,
            resolvedClientName, String(exportMonthLabel), String(baseYearNum),
            String(periodo || ""), JSON.stringify(monthsToExport),
        ], { stdio: ["pipe","pipe","pipe"] });

        let pythonError = "";
        let startFailed = false;

        proc.on("error", (err: any) => {
            startFailed = true;
            reject(new Error(`Falha ao iniciar Python: ${err.message}`));
        });
        proc.stderr.on("data", (d: any) => { pythonError += d.toString(); });
        proc.stdin?.end(JSON.stringify(posts));
        proc.on("close", (code: number) => {
            if (startFailed) return;
            if (code === 0 && fs.existsSync(outputPath)) resolve();
            else reject(new Error(`Python falhou (code=${code}): ${pythonError}`));
        });
    });

    await updateJobProgress(jobId, 80, 'Salvando arquivo...');

    const deliveryTimestamp = Date.now();
    const deliveriesDir = path.resolve(backendDir, "..", "storage", "deliveries", "excel", clienteId, String(deliveryTimestamp));
    if (!fs.existsSync(deliveriesDir)) fs.mkdirSync(deliveriesDir, { recursive: true });

    const permanentPath = path.join(deliveriesDir, outputFileName);
    fs.copyFileSync(outputPath, permanentPath);

    const downloadUrl = `/api/storage/deliveries/excel/${clienteId}/${deliveryTimestamp}/${outputFileName}`;

    try {
        await db.query(
            `INSERT INTO presentations (cliente_id, titulo, arquivos, dados_json, tipo, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
            [clienteId, `Excel: ${outputFileName}`, JSON.stringify([downloadUrl]), JSON.stringify(posts), 'excel',
             JSON.stringify({ months: monthsToExport, year: baseYearNum, generatedAt: new Date().toISOString() })]
        );
    } catch (histErr) {
        console.error("⚠️ [Worker] Falha ao registrar entrega no histórico:", histErr);
    }

    return { downloadUrl, fileName: outputFileName };
};

const runJobLogic = async (jobId: string, clienteId: string, payload: any) => {
    const jobType = String(payload?.jobType || 'calendar');
    if (jobType === 'presentation') {
        return runPresentationJobLogic(jobId, clienteId, payload);
    }
    if (jobType === 'excel') {
        return runExcelJobLogic(jobId, clienteId, payload);
    }
    return runCalendarJobLogic(jobId, clienteId, payload);
};

const runCalendarJobLogic = async (jobId: string, clienteId: string, payload: any) => {
    const {
        monthsToGenerate, briefing, monthReferences, formatInstructions,
        chainOutputFinal, generationPrompt, produtosFocoIds,
    } = payload;

    const DEFAULT_MIX = { reels: 4, static: 8, carousel: 4, stories: 8, photos: 0 };
    const mix = payload.mix || DEFAULT_MIX;
    const periodo = payload.periodo || payload.period || 30;

    const [rulesResult, docsResult, brandingResult] = await Promise.all([
        db.query("SELECT regra FROM brand_rules WHERE cliente_id = $1 AND ativa = true", [clienteId]),
        db.query("SELECT tipo, conteudo_texto FROM brand_docs WHERE cliente_id = $1", [clienteId]),
        db.query("SELECT * FROM branding WHERE cliente_id = $1", [clienteId]),
    ]);

    const rules = rulesResult.rows.map((r: any) => `- ${r.regra}`).join("\n");
    const docsResumo = docsResult.rows.map((d: any) => `- (${d.tipo}) ${d.conteudo_texto}`).join("\n");
    const branding = brandingResult.rows[0] || { tone_of_voice: "Neutro", visual_style: "Padrão", audience: "Geral" };

    let categoriasNicho: string[] = [];
    try {
        const clientRes = await db.query("SELECT categorias_nicho FROM clientes WHERE id = $1", [clienteId]);
        if (Array.isArray(clientRes.rows[0]?.categorias_nicho)) {
            categoriasNicho = clientRes.rows[0].categorias_nicho;
        }
    } catch (_) { }

    const monthlyMix = payload.monthlyMix || null;
    const isTrimestral = periodo === 90;
    const mixesByMonth: any[] = monthlyMix
        ? monthsToGenerate.map((m: string) => monthlyMix[m] || mix)
        : isTrimestral
            ? distributeMixAcrossMonths(mix, monthsToGenerate.length)
            : monthsToGenerate.map(() => mix);

    // Pré-busca contexto histórico do banco (independente do job atual)
    const dbContext = await fetchHistoricalContext(clienteId);

    // Resolve overrides por mês (briefing, formatInstructions, monthReferences)
    const resolveMonthOpts = (mes: string) => {
        const override = ((payload.monthlyBriefings || {}) as Record<string, any>)[mes] || {};
        const effectiveBriefing = override.briefing
            ? `${briefing || ""}\n\n[Briefing específico para ${mes}]:\n${override.briefing}`.trim()
            : (briefing || "");
        const effectiveFormatInstructions = override.formatInstructions
            ? { ...(formatInstructions || {}), ...override.formatInstructions }
            : formatInstructions;
        const effectiveMonthReferences = [monthReferences, override.monthReferences]
            .filter(Boolean).join("\n");
        return { effectiveBriefing, effectiveFormatInstructions, effectiveMonthReferences };
    };

    const checkCancellation = async () => {
        const check = await db.query("SELECT status FROM calendar_generation_jobs WHERE id = $1", [jobId]);
        if (check.rows[0]?.status === "canceled") throw new Error("JOB_CANCELED");
    };

    const buildGenerateOpts = (mes: string, idx: number, continuityCtx: string, rangeStart: number, rangeEnd: number) => {
        const { effectiveBriefing, effectiveFormatInstructions, effectiveMonthReferences } = resolveMonthOpts(mes);
        return {
            jobId,
            clienteId,
            mesToGenerate: mes,
            mixForThisMonth: mixesByMonth[idx] || mix,
            branding,
            briefing: effectiveBriefing,
            rules,
            docsResumo,
            formatInstructions: effectiveFormatInstructions,
            monthReferences: effectiveMonthReferences,
            continuityContext: continuityCtx,
            periodoFinal: periodo,
            effectiveGenerationPrompt: chainOutputFinal
                ? `${generationPrompt}\nCONTEXT:${chainOutputFinal}`
                : generationPrompt,
            categoriasNicho,
            produtosFocoIds,
            checkCancellation,
            onProgress: async (relativePct: number, stepMsg: string) => {
                const totalProgress = Math.round(rangeStart + (rangeEnd - rangeStart) * (relativePct / 100));
                await db.query(
                    `UPDATE calendar_generation_jobs SET progress = $1, current_step = $2, updated_at = NOW() WHERE id = $3`,
                    [totalProgress, `[${mes}] ${stepMsg}`, jobId]
                );
            },
        };
    };

    const resultCalendarIds: string[] = [];
    const totalMonths = monthsToGenerate.length;

    // ── Cascade: Mês 1 sequencial → Meses 2+ em paralelo ────────────────────
    const month0 = monthsToGenerate[0];
    const rangeEnd0 = totalMonths === 1 ? 100 : 50;

    await checkCancellation();
    await db.query(
        `UPDATE calendar_generation_jobs SET progress = 0, current_step = $2, updated_at = NOW() WHERE id = $1`,
        [jobId, `[Mês 1/${totalMonths}] Iniciando geração para ${month0}...`]
    );

    const result0 = await generateCalendarForMonth(buildGenerateOpts(month0, 0, dbContext, 0, rangeEnd0));
    resultCalendarIds.push(result0.calendarId);

    if (totalMonths > 1) {
        const temas0 = Array.isArray(result0.calendarData)
            ? result0.calendarData.slice(0, 5).map((p: any) => p.tema).filter(Boolean).join(", ")
            : "";
        const cascadeContext = [dbContext, temas0 ? `[${month0}]: ${temas0}` : ""].filter(Boolean).join("\n");

        await db.query(
            `UPDATE calendar_generation_jobs SET progress = 50, current_step = $2, updated_at = NOW() WHERE id = $1`,
            [jobId, `Gerando ${totalMonths - 1} mês(es) restante(s) em paralelo...`]
        );

        const remaining = monthsToGenerate.slice(1);
        const rangePerMonth = 50 / remaining.length;

        const remainingResults = await Promise.allSettled(
            remaining.map((mes: string, i: number) => {
                const rangeStart = 50 + i * rangePerMonth;
                return generateCalendarForMonth(buildGenerateOpts(mes, i + 1, cascadeContext, rangeStart, rangeStart + rangePerMonth));
            })
        );

        for (const r of remainingResults) {
            if (r.status === "fulfilled") {
                resultCalendarIds.push(r.value.calendarId);
            } else {
                if ((r.reason as any)?.message === "JOB_CANCELED") throw r.reason;
                console.error(`❌ [Worker] Mês paralelo falhou:`, r.reason);
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    await db.query(
        `UPDATE calendarios SET status = 'published' WHERE generation_job_id = $1 AND status = 'draft'`,
        [jobId]
    );

    await db.query(
        `UPDATE calendar_generation_jobs SET result_calendar_ids = $1 WHERE id = $2`,
        [resultCalendarIds, jobId]
    );
};


