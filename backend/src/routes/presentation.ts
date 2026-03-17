import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import db from '../config/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { updateTokenUsage } from '../utils/tokenTracker';
import { getGeminiModelCandidates } from '../utils/googleModels';

const router = Router();

const GEN_DIR = path.resolve(__dirname, '../../python_gen');
const SCRIPT_FILE = path.join(GEN_DIR, 'main.py');
const OUTPUT_DIR = path.join(GEN_DIR, 'output');
const TMP_DIR = path.join(GEN_DIR, 'tmp');
const execAsync = promisify(exec);

const resolveClientLogoPathFromUrl = (logoUrl: unknown): string | null => {
    if (!logoUrl || typeof logoUrl !== 'string') return null;

    let pathname = logoUrl;
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        pathname = logoUrl.replace(/^https?:\/\/[^/]+/i, '');
    }

    const marker = '/static/client-logos/';
    const idx = pathname.lastIndexOf(marker);
    if (idx === -1) return null;

    const filenamePart = pathname.slice(idx + marker.length);
    const beforeQuery = filenamePart.split('?')[0] || '';
    const filename = beforeQuery.split('#')[0] || '';
    if (!filename) return null;

    const absolutePath = path.resolve(__dirname, '../../storage/client-logos', filename);
    if (!fs.existsSync(absolutePath)) return null;
    return absolutePath;
};

const PT_MONTHS = ['Janeiro', 'Fevereiro', 'MarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§o', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const PT_MONTH_ALIASES: Record<string, number> = {
    janeiro: 0,
    fevereiro: 1,
    marco: 2,
    abril: 3,
    maio: 4,
    junho: 5,
    julho: 6,
    agosto: 7,
    setembro: 8,
    outubro: 9,
    novembro: 10,
    dezembro: 11,
};

const normalizeAscii = (value: string) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const DANGLING_ENDINGS = new Set([
    'a', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'ou', 'para', 'por', 'que', 'sem', 'sobre', 'um', 'uma'
]);

const stripDanglingEnding = (value: string, minWordsToTrim = 3): string => {
    let current = String(value || '').trim();

    while (current) {
        const words = current.split(/\s+/).filter(Boolean);
        if (words.length < minWordsToTrim) return current;

        const lastWord = normalizeAscii(words[words.length - 1] || '').replace(/[^a-z0-9]/g, '');
        if (!DANGLING_ENDINGS.has(lastWord)) return current;

        words.pop();
        current = words.join(' ').replace(/[,:;\/-]+$/g, '').trim();
    }

    return current;
};

const hasDanglingEnding = (value: string) => {
    const lastWord = normalizeAscii(String(value || '').trim().split(/\s+/).pop() || '').replace(/[^a-z0-9]/g, '');
    return !!lastWord && DANGLING_ENDINGS.has(lastWord);
};

const looksMonthDriven = (value: string, months: string[]) => {
    const normalizedValue = normalizeAscii(String(value || ''));
    const matches = months
        .map((month) => normalizeAscii(month))
        .filter(Boolean)
        .filter((month) => normalizedValue.includes(month));
    return matches.length >= 2;
};

const buildDiagnosticFallback = (clientName: string) => {
    const brand = cleanSingleLine(clientName || 'a marca', 28, { keepTrailingPunctuation: true }) || 'a marca';
    return [
        'O cenario atual mostra ' + brand + ' inserida em um ambiente mais disputado, com excesso de mensagens, menor paciencia do publico e uma necessidade crescente de provar valor de forma imediata, clara e consistente em cada ponto de contato.',
        'Nesse contexto, a tensao nao esta apenas em aparecer mais, mas em organizar a comunicacao para reduzir ruido, sustentar relevancia e transformar percepcao dispersa em uma leitura mais nitida da proposta, com mais coerencia entre marca, oferta e resultado.',
        'A oportunidade esta em construir uma narrativa mais proprietaria, repetivel e estrategica, capaz de aumentar lembranca, diferenciar a marca no curto prazo e criar base para uma resposta comercial mais forte ao longo de toda a campanha.'
    ].join('\n\n');
};

const buildCampaignGoalsFallback = (clientName: string) => {
    const brand = cleanSingleLine(clientName || 'a marca', 28, { keepTrailingPunctuation: true }) || 'a marca';
    return [
        'A campanha foi desenhada para fortalecer o posicionamento de ' + brand + ', aumentar o valor percebido da marca e transformar interesse disperso em uma intencao comercial mais clara, consistente e recorrente ao longo de todo o periodo.',
        'A estrategia organiza a comunicacao em torno de uma promessa unica, capaz de sustentar desejo, reconhecimento e proximidade com o publico sem perder clareza, relevancia e ritmo de mercado durante a jornada completa.',
        'Com isso, a marca ganha mais presenca, mais consistencia narrativa e mais capacidade de converter atencao em resposta, conectando construcao de imagem e resultado de forma integrada.'
    ].join('\n\n');
};

const buildCampaignDefenseFallback = (clientName: string, slogan: string) => {
    const brand = cleanSingleLine(clientName || 'a marca', 28, { keepTrailingPunctuation: true }) || 'a marca';
    const promise = cleanSingleLine(slogan || 'uma proposta clara de valor', 42, { keepTrailingPunctuation: true }) || 'uma proposta clara de valor';
    return [
        'A defesa da campanha parte da ideia de que ' + brand + ' precisa ocupar um lugar mais nitido na mente do publico, com uma narrativa capaz de traduzir valor, diferenciar a oferta e reduzir a distancia entre percepcao e decisao.',
        'Ao organizar a comunicacao em torno de ' + promise + ', a campanha cria uma leitura mais simples, memoravel e consistente, ajudando a marca a repetir a mesma promessa com mais forca em diferentes pontos de contato.',
        'Essa constancia melhora o entendimento da proposta, sustenta relevancia ao longo do periodo e faz com que cada ativacao reforce a anterior, em vez de competir por atencao como uma mensagem isolada.',
        'O resultado esperado e uma campanha que combina imagem e resposta comercial, elevando lembranca, afinidade e intencao de compra com uma construcao estrategica mais coesa.'
    ].join('\n\n');
};

const buildSloganFallback = (clientName: string) => {
    const brand = cleanSingleLine(clientName || '', 18, { keepTrailingPunctuation: true });
    return cleanSingleLine(
        brand ? brand + ': mais valor em cada contato' : 'Mais valor em cada contato',
        42,
        { keepTrailingPunctuation: true }
    );
};

const isWeakHeadline = (value: string, minWords = 3) => {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    return words.length < minWords || hasDanglingEnding(value);
};

const trimToWordBoundary = (value: string, maxChars: number): string => {
    const clean = String(value || '').trim();
    if (!clean || maxChars <= 0 || clean.length <= maxChars) return clean;

    const sliced = clean.slice(0, maxChars + 1).trim();
    const breakChars = [' ', '/', '-', ','];
    let bestIndex = -1;
    for (const char of breakChars) {
        const found = sliced.lastIndexOf(char);
        if (found > bestIndex) bestIndex = found;
    }

    if (bestIndex > Math.floor(maxChars * 0.35)) {
        return sliced.slice(0, bestIndex).trim();
    }

    return clean.slice(0, maxChars).trim();
};

const cleanSingleLine = (
    value: unknown,
    maxChars: number,
    options: { keepTrailingPunctuation?: boolean } = {}
): string => {
    const normalized = String(value ?? '')
        .replace(/\r/g, ' ')
        .replace(/\n+/g, ' ')
        .replace(/[\u2022\u00B7\u25AA\u25A0\u25CF]/g, ' ')
        .replace(/^\s*\d+[.)-]\s*/g, '')
        .replace(/[\u201C\u201D"']/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) return '';

    const clipped = trimToWordBoundary(normalized, maxChars);
    const stabilized = stripDanglingEnding(clipped);
    return options.keepTrailingPunctuation
        ? stabilized.trim()
        : stabilized.replace(/[.!?,;:]+$/g, '').trim();
};

const CHALLENGE_INCOMPLETE_HEADS = new Set([
    'ausencia', 'carencia', 'deficit', 'dependencia', 'desconexao', 'desalinhamento', 'desperdicio',
    'distancia', 'escassez', 'excesso', 'falta', 'fragilidade', 'gap', 'gargalo', 'necessidade',
    'prisoes', 'prisao', 'queda', 'risco'
]);

const normalizeChallengeItem = (
    value: unknown,
    maxWords = 5,
    maxChars = 42
): string => {
    const source = String(value ?? '')
        .replace(/\r/g, ' ')
        .replace(/\n+/g, ' ')
        .replace(/[\u2022\u00B7\u25AA\u25A0\u25CF]/g, ' ')
        .replace(/^\s*\d+[.)-]\s*/g, '')
        .replace(/[\u201C\u201D"']/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!source) return '';

    const limitedWords = source.split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ');
    const clipped = trimToWordBoundary(limitedWords, maxChars);
    const cleaned = stripDanglingEnding(clipped, 2).replace(/[.!?,;:]+$/g, '').trim();
    if (!cleaned || hasDanglingEnding(cleaned)) return '';

    const words = cleaned.split(/\s+/).filter(Boolean);
    const firstWord = normalizeAscii(words[0] || '').replace(/[^a-z0-9]/g, '');
    if (words.length <= 2 && CHALLENGE_INCOMPLETE_HEADS.has(firstWord)) return '';

    return cleaned;
};

const buildChallengesFallback = () => ([
    'Baixa previsibilidade comercial',
    'Mensagem sem continuidade',
    'Dependencia de esforco manual',
    'Ritmo lento de resposta',
    'Baixo aproveitamento de dados',
    'Distancia entre marca e venda',
    'Escala com custo elevado',
    'Inovacao sem consistencia',
    'Operacao pouco integrada'
]);

const cleanParagraphText = (
    value: unknown,
    maxChars: number,
    maxParagraphs: number,
    maxCharsPerParagraph: number
): string => {
    const source = String(value ?? '')
        .replace(/\r/g, '')
        .replace(/[ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢?ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦?]/g, ' ')
        .trim();

    if (!source) return '';

    const paragraphSeeds = source
        .split(/\n{2,}|\n/)
        .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    const normalizedParagraphs: string[] = [];
    for (const seed of paragraphSeeds) {
        const sentences = seed
            .split(/(?<=[.!?])\s+/)
            .map((sentence) => cleanSingleLine(sentence, maxCharsPerParagraph, { keepTrailingPunctuation: true }))
            .filter(Boolean);

        if (sentences.length === 0) continue;

        let paragraph = '';
        for (const sentence of sentences) {
            const next = paragraph ? `${paragraph} ${sentence}` : sentence;
            if (next.length > maxCharsPerParagraph) break;
            paragraph = next;
        }

        normalizedParagraphs.push(
            paragraph || cleanSingleLine(seed, maxCharsPerParagraph, { keepTrailingPunctuation: true })
        );

        if (normalizedParagraphs.length >= maxParagraphs) break;
    }

    const finalParagraphs: string[] = [];
    let remaining = maxChars;
    for (const paragraph of normalizedParagraphs) {
        const separatorCost = finalParagraphs.length > 0 ? 2 : 0;
        const allowance = Math.min(maxCharsPerParagraph, remaining - separatorCost);
        if (allowance <= 0) break;

        const clipped = cleanSingleLine(paragraph, allowance, { keepTrailingPunctuation: true });
        if (!clipped) continue;

        finalParagraphs.push(clipped);
        remaining -= clipped.length + separatorCost;
        if (finalParagraphs.length >= maxParagraphs) break;
    }

    return finalParagraphs.join('\n\n').trim();
};

const parseMonthToken = (value: string, fallbackIndex: number) => {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const normalized = normalizeAscii(raw);
    const monthAlias = Object.keys(PT_MONTH_ALIASES).find((alias) => normalized.includes(alias));
    const monthIndex = monthAlias !== undefined ? (PT_MONTH_ALIASES[monthAlias] ?? -1) : -1;
    const yearMatch = normalized.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : null;

    if (monthIndex === -1) {
        return {
            key: `raw-${fallbackIndex}-${normalized}`,
            title: raw,
            sortKey: Number.MAX_SAFE_INTEGER - 100 + fallbackIndex,
        };
    }

    return {
        key: `${year ?? 'none'}-${monthIndex}`,
        title: PT_MONTHS[monthIndex],
        sortKey: (year ?? 9999) * 12 + monthIndex,
    };
};

const normalizeMonthList = (months: string[], fallbackLabel = ''): string[] => {
    const primary = Array.isArray(months) && months.length > 0 ? months : String(fallbackLabel || '').split('|');

    const parsed = primary
        .map((item, index) => parseMonthToken(String(item || '').trim(), index))
        .filter(Boolean) as Array<{ key: string; title: string; sortKey: number }>;

    const deduped: Array<{ key: string; title: string; sortKey: number }> = [];
    const seen = new Set<string>();
    for (const item of parsed) {
        if (seen.has(item.key)) continue;
        seen.add(item.key);
        deduped.push(item);
    }

    deduped.sort((a, b) => a.sortKey - b.sortKey);
    return deduped.map((item) => item.title).filter(Boolean).slice(0, 3);
};

const buildPlannerLabel = (months: string[]) => months.filter(Boolean).slice(0, 3).join(' | ');

const normalizeShortItems = (items: unknown, count = 9, maxChars = 42, maxWords = 5): string[] => {
    const source = Array.isArray(items)
        ? items
        : String(items || '')
            .split(/\n+/)
            .map((item) => item.trim())
            .filter(Boolean);

    const normalized = source
        .map((item) => normalizeChallengeItem(item, maxWords, maxChars))
        .filter(Boolean)
        .slice(0, count);

    const fallbackItems = buildChallengesFallback();
    for (const fallbackItem of fallbackItems) {
        if (normalized.length >= count) break;
        if (normalized.includes(fallbackItem)) continue;
        normalized.push(fallbackItem);
    }

    while (normalized.length < count) normalized.push('');
    return normalized;
};

const normalizeRoadmapCards = (cards: any, fallbackMonths: string[]) => {
    const source = Array.isArray(cards) ? cards : [];
    const normalized = [];
    for (let index = 0; index < 3; index += 1) {
        const card = source[index] && typeof source[index] === 'object' ? source[index] : {};
        const fallbackMonth = fallbackMonths[index] || '';
        const normalizedMonth = normalizeMonthList([String(card.mes || fallbackMonth)], fallbackMonth)[0] || fallbackMonth;
        normalized.push({
            mes: normalizedMonth,
            titulo: cleanSingleLine(card.titulo || '', 24),
            detalhe: '',
            descricao: cleanSingleLine(card.descricao || '', 58),
            sugestao: cleanSingleLine(card.sugestao || '', 28),
        });
    }
    return normalized;
};

const normalizeGeneratedContent = (
    rawContent: any,
    options: { plannerLabel: string; roadmapMonths: string[]; clientName?: string; logoPath?: string | null }
) => {
    const content = typeof rawContent === 'object' && rawContent ? rawContent : {};

    content.planner = typeof content.planner === 'object' && content.planner ? content.planner : {};
    content.diagnostico = typeof content.diagnostico === 'object' && content.diagnostico ? content.diagnostico : {};
    content.desafios = typeof content.desafios === 'object' && content.desafios ? content.desafios : {};
    content.grid = typeof content.grid === 'object' && content.grid ? content.grid : {};
    content.slogan = typeof content.slogan === 'object' && content.slogan ? content.slogan : {};
    content.defesa = typeof content.defesa === 'object' && content.defesa ? content.defesa : {};
    content.roadmap = typeof content.roadmap === 'object' && content.roadmap ? content.roadmap : {};

    content.planner.mes = options.plannerLabel;
    content.planner.nome_cliente = cleanSingleLine(options.clientName || content.planner.nome_cliente || '', 38, { keepTrailingPunctuation: true });
    if (options.logoPath) {
        content.planner.logo_path = options.logoPath;
    }

    const normalizedDiagnosticText = cleanParagraphText(
        content.diagnostico.texto_longo || content.diagnostico.texto || '',
        900,
        3,
        290
    );
    const diagnosticParagraphCount = normalizedDiagnosticText ? normalizedDiagnosticText.split(/\n{2,}/).filter(Boolean).length : 0;
    content.diagnostico.texto_longo = !normalizedDiagnosticText || normalizedDiagnosticText.length < 520 || diagnosticParagraphCount < 3
        ? buildDiagnosticFallback(options.clientName || '')
        : normalizedDiagnosticText;

    content.desafios.itens = normalizeShortItems(content.desafios.itens, 9, 42, 5);

    content.grid.mes = options.plannerLabel;
    const rawGridText = String(content.grid.texto_longo || content.grid.texto || '').trim();
    const normalizedGridText = cleanParagraphText(
        rawGridText,
        980,
        3,
        320
    );
    const gridParagraphCount = normalizedGridText ? normalizedGridText.split(/\n{2,}/).filter(Boolean).length : 0;
    content.grid.texto_longo = !normalizedGridText || normalizedGridText.length < 420 || gridParagraphCount < 2 || looksMonthDriven(rawGridText, options.roadmapMonths)
        ? buildCampaignGoalsFallback(options.clientName || '')
        : normalizedGridText;

    const sloganSource = cleanSingleLine(String(content.slogan.frase || '').trim(), 42, { keepTrailingPunctuation: true });
    content.slogan.frase = isWeakHeadline(sloganSource)
        ? buildSloganFallback(options.clientName || '')
        : sloganSource;

    const defesaSubtitleSource = cleanSingleLine(String(content.defesa.subtitulo || content.slogan.frase || '').trim(), 42, { keepTrailingPunctuation: true });
    content.defesa.subtitulo = isWeakHeadline(defesaSubtitleSource)
        ? content.slogan.frase
        : defesaSubtitleSource;
    const normalizedDefenseText = cleanParagraphText(
        content.defesa.texto_longo || content.defesa.texto || '',
        1280,
        4,
        330
    );
    const defenseParagraphCount = normalizedDefenseText ? normalizedDefenseText.split(/\n{2,}/).filter(Boolean).length : 0;
    content.defesa.texto_longo = !normalizedDefenseText || normalizedDefenseText.length < 560 || defenseParagraphCount < 3
        ? buildCampaignDefenseFallback(options.clientName || '', content.slogan.frase)
        : normalizedDefenseText;

    content.roadmap.cards = normalizeRoadmapCards(content.roadmap.cards, options.roadmapMonths);
    return content;
};

const getClientContext = async (clienteId: string) => {
    const clientResult = await db.query('SELECT nome, logo_url FROM clientes WHERE id = $1', [clienteId]);
    const clientRow = clientResult.rows?.[0] || {};
    const clientName = clientRow?.nome || '';

    const brandResult = await db.query(
        'SELECT * FROM branding WHERE cliente_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [clienteId]
    );

    const brandingRow = brandResult.rows?.[0] || null;
    const logoUrl = (brandingRow
        ? (brandingRow.logo_url ?? brandingRow.logoUrl ?? brandingRow.logo ?? brandingRow.logo_path ?? brandingRow.logoPath)
        : null) ?? clientRow?.logo_url ?? null;

    return {
        clientName,
        logoPath: resolveClientLogoPathFromUrl(logoUrl),
        branding: brandingRow
            ? {
                visual_style: brandingRow.visual_style,
                tone_of_voice: brandingRow.tone_of_voice,
                audience: brandingRow.audience,
                keywords: brandingRow.keywords,
            }
            : {},
    };
};

type PresentationProgressCallback = (progress: number, step: string) => Promise<void> | void;

type PresentationGenerationContext = {
    clienteId: string;
    calendar: any;
    monthLabel: string;
    deckMonths: string[];
    plannerLabel: string;
    clientName: string;
    logoPath: string | null;
    branding: Record<string, any>;
};

const reportPresentationProgress = async (
    callback: PresentationProgressCallback | undefined,
    progress: number,
    step: string
) => {
    if (!callback) return;
    await callback(Math.max(0, Math.min(100, Math.round(progress))), step);
};

const extractJsonObjectFromResponse = (responseText: string) => {
    let jsonStr = String(responseText || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    }
    return JSON.parse(jsonStr);
};

const runGeminiJsonPrompt = async (
    clienteId: string,
    prompt: string,
    usageScope: string,
    tier: 'fast' | 'quality' = 'quality'
) => {
    if (!process.env.GOOGLE_API_KEY) {
        throw new Error('GOOGLE_API_KEY nao configurada');
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const modelsToTry = getGeminiModelCandidates(tier);
    let lastError: any = null;

    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: 'application/json' }
            });
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            if (result.response.usageMetadata) {
                await updateTokenUsage(clienteId, result.response.usageMetadata, usageScope, modelName);
            }

            return {
                modelName,
                parsed: extractJsonObjectFromResponse(responseText),
                rawText: responseText,
            };
        } catch (error: any) {
            lastError = error;
            console.warn(`[PRESENTATION] ${modelName} falhou em ${usageScope}:`, error?.message || error);
            if (modelName !== modelsToTry[modelsToTry.length - 1]) {
                await new Promise((resolve) => setTimeout(resolve, 1500));
            }
        }
    }

    throw lastError || new Error('Falha ao obter resposta JSON da IA.');
};

const loadPresentationGenerationContext = async (
    clienteId: string,
    months: string[] = []
): Promise<PresentationGenerationContext> => {
    const requestedMonths = Array.isArray(months)
        ? months.map((month) => String(month || '').trim()).filter(Boolean)
        : [];

    let calendar: any = null;
    let monthLabel = '';

    if (requestedMonths.length > 0) {
        const calResult = await db.query(
            `SELECT mes, calendario_json, criado_em
             FROM calendarios
             WHERE cliente_id = $1 AND mes = ANY($2::text[])
             ORDER BY criado_em DESC`,
            [clienteId, requestedMonths]
        );

        if (calResult.rows.length === 0) {
            throw new Error('Nenhum calendario encontrado para o periodo selecionado.');
        }

        monthLabel = requestedMonths.join(' | ');
        calendar = {
            selected_months: requestedMonths,
            calendars: calResult.rows.map((row: any) => ({ mes: row.mes, calendario_json: row.calendario_json })),
        };
    } else {
        const calResult = await db.query(
            'SELECT * FROM calendarios WHERE cliente_id = $1 ORDER BY criado_em DESC LIMIT 1',
            [clienteId]
        );

        if (calResult.rows.length === 0) {
            throw new Error('Nenhum calendario encontrado para este cliente.');
        }

        calendar = calResult.rows[0].calendario_json;
        monthLabel = calResult.rows[0].mes;
    }

    const { clientName, logoPath, branding } = await getClientContext(clienteId);
    const deckMonths = normalizeMonthList(requestedMonths, monthLabel);
    const plannerLabel = buildPlannerLabel(deckMonths) || cleanSingleLine(monthLabel, 40, { keepTrailingPunctuation: true });

    return {
        clienteId,
        calendar,
        monthLabel,
        deckMonths,
        plannerLabel,
        clientName,
        logoPath,
        branding,
    };
};

const distillBrandingContext = (branding: Record<string, any>): string => {
    const toneObj = branding.tone_of_voice;
    const toneStr = typeof toneObj === 'string' ? toneObj : (toneObj?.description || '');
    const audienceObj = branding.audience;
    const audienceStr = typeof audienceObj === 'string' ? audienceObj : (audienceObj?.persona || '');
    const keywords = Array.isArray(branding.keywords) ? branding.keywords.join(', ') : (branding.keywords || '');
    const lines = [
        branding.niche && `NICHO: ${branding.niche}`,
        toneStr && `TOM DE VOZ: ${toneStr}`,
        audienceStr && `PUBLICO-ALVO: ${audienceStr}`,
        branding.usp && `USP: ${branding.usp}`,
        keywords && `PALAVRAS-CHAVE: ${keywords}`,
    ].filter(Boolean);
    return lines.length > 0 ? lines.join('\n') : JSON.stringify(branding, null, 2);
};

const buildPresentationStrategyPrompt = (context: PresentationGenerationContext): string => {
    const pilaresSlots = context.deckMonths
        .map(mes => `    { "mes": "${mes}", "foco": "", "campanha": "", "apoio_tatico": "" }`)
        .join(',\n');

    return `Voce e um estrategista senior de campanhas criando o brief de uma apresentacao executiva de agencia para o cliente.

CLIENTE: ${context.clientName || 'Cliente'}
PERIODO: ${context.monthLabel}
MESES SELECIONADOS: ${context.plannerLabel}

BRANDING DO CLIENTE:
${distillBrandingContext(context.branding)}

CALENDARIO:
${JSON.stringify(context.calendar, null, 2)}

REGRAS:
- Pense como planejamento de campanha, nao como cronograma bruto.
- Identifique tensoes reais e especificas do cliente — nao tensoes genericas de marketing.
- Encontre uma grande ideia que conecte diagnostico, metas, slogan, defesa e roadmap.
- Se houver muitos temas, sintetize em uma narrativa unica e clara.
- pilares_mensais.campanha: nome criativo da ideia do mes, sem prefixo "Campanha".
- Gere APENAS ${context.deckMonths.length} entrada(s) em pilares_mensais — uma por mes selecionado.
- Responda APENAS JSON valido.

JSON:
{
  "contexto_competitivo": "",
  "objetivo_macro": "",
  "promessa_central": "",
  "grande_ideia": "",
  "tom_editorial": "",
  "tensoes_do_publico": ["", "", ""],
  "oportunidades": ["", "", ""],
  "pilares_mensais": [
${pilaresSlots}
  ]
}`;
};

const buildPresentationSlidesPrompt = (context: PresentationGenerationContext, strategyBrief: any): string => {
    const nMonths = context.deckMonths.length;
    const roadmapCardSlots = context.deckMonths
        .map(mes => `      { "mes": "${mes}", "titulo": "", "detalhe": "", "descricao": "", "sugestao": "" }`)
        .join(',\n');

    return `Voce e um diretor de criacao e redator senior. Escreva os textos das laminas de uma apresentacao executiva de agencia para o cliente.

CLIENTE: ${context.clientName || 'Cliente'}
PERIODO: ${context.monthLabel}
MESES SELECIONADOS: ${context.plannerLabel}

BRIEF ESTRATEGICO (use como fonte da verdade):
${JSON.stringify(strategyBrief, null, 2)}

CALENDARIO DE APOIO:
${JSON.stringify(context.calendar, null, 2)}

═══════════════════════════════════════════════════════
FUNCAO DE CADA LAMINA — leia antes de escrever qualquer campo
═══════════════════════════════════════════════════════

LAMINA: DIAGNOSTICO (diagnostico.texto_longo)
Diagnostico consultivo do cenario competitivo da marca.
Estrutura obrigatoria — 3 paragrafos separados por linha dupla (\\n\\n):
  - Paragrafo 1: cenario atual do mercado e da marca (onde estao hoje)
  - Paragrafo 2: a tensao central — o problema ou ameaca que impede o crescimento
  - Paragrafo 3: a oportunidade — por que agora e o momento certo
Tom: consultivo, direto, sem jargao vazio. Especifico ao nicho do cliente.
LIMITES: minimo 520 chars, maximo 900 chars, maximo 290 chars por paragrafo.

LAMINA: DESAFIOS (desafios.itens)
Grid visual com 9 frases que o cliente deve reconhecer imediatamente em si mesmo.
Seja especifico ao nicho — nao use desafios genericos como "melhorar vendas" ou "aumentar presenca".
Cada item deve ser forte e especifico, como "Custo de aquisicao alto" ou "Marca sem autoridade local".
LIMITES: exatamente 9 itens, maximo 5 palavras e 42 chars por item, sem ponto final.

LAMINA: METAS DA CAMPANHA (grid.texto_longo)
Visao estrategica do que a campanha intende alcançar no periodo como um todo.
NAO cite meses especificos. NAO organize o texto por mes. Escreva sobre a campanha de forma unificada.
Tom: estrategico, propositivo, com densidade editorial.
LIMITES: minimo 420 chars, maximo 980 chars, maximo 320 chars por paragrafo.

LAMINA: SLOGAN (slogan.frase)
A tagline central da campanha. Frase completa, memoravel, pode quebrar em 2 linhas.
Derive da "grande_ideia" do brief estrategico.
LIMITE ABSOLUTO: maximo 42 caracteres — sera cortado se ultrapassar.

LAMINA: DEFESA DA CAMPANHA (defesa.subtitulo + defesa.texto_longo)
Por que esta campanha funciona. Tom consultivo, persuasivo, sem inventar dados.
  - subtitulo: variacao ou complemento do slogan. Maximo 42 chars.
  - texto_longo: argumentacao em 3-4 paragrafos separados por linha dupla (\\n\\n).
    Estrutura sugerida: premissa -> evidencia concreta -> por que agora -> convite a acao.
LIMITES: minimo 560 chars, maximo 1280 chars, maximo 330 chars por paragrafo.

LAMINA: ROADMAP / PLANNER (roadmap.cards)
${nMonths} card(s) — exatamente um por mes selecionado.
  - titulo: nome criativo da campanha do mes. Maximo 24 chars, sem prefixo "Campanha".
  - detalhe: SEMPRE vazio ("") — nao e exibido no layout.
  - descricao: o que a campanha vai entregar/fazer. Frase completa. Maximo 58 chars.
  - sugestao: sugestao tatica complementar (ex: "Impulsionar 3 posts-chave"). Maximo 28 chars.
ATENCAO: gere exatamente ${nMonths} card(s) para os meses: ${context.deckMonths.join(', ')}.
Nao invente meses adicionais.

═══════════════════════════════════════════════════════
REGRAS GERAIS
- Paragrafos DEVEM ser separados por linha dupla (\\n\\n) — nunca por linha simples.
- Cada lamina serve uma funcao diferente — nao repita informacoes entre elas.
- Nao invente datas, numeros ou promessas sem base no calendario ou branding.
- Nao use bullets numerados dentro de textos corridos.
- Priorize clareza, ritmo visual, acentuacao correta e especificidade ao nicho.
- Use o brief estrategico como fonte da verdade; o calendario serve como apoio e prova.

Retorne APENAS este JSON preenchido:
{
  "planner": {
    "mes": "${context.plannerLabel}",
    "nome_cliente": "${context.clientName || 'Nome do Cliente'}"
  },
  "diagnostico": {
    "texto_longo": ""
  },
  "desafios": {
    "itens": ["", "", "", "", "", "", "", "", ""]
  },
  "grid": {
    "mes": "${context.plannerLabel}",
    "texto_longo": ""
  },
  "slogan": {
    "frase": ""
  },
  "defesa": {
    "subtitulo": "",
    "texto_longo": ""
  },
  "roadmap": {
    "cards": [
${roadmapCardSlots}
    ]
  }
}`;
};

const buildPresentationReviewPrompt = (context: PresentationGenerationContext, strategyBrief: any, draftContent: any): string => {
    const nMonths = context.deckMonths.length;

    return `Voce e um revisor editorial de apresentacoes executivas de agencia. Revise o rascunho e devolva uma versao final mais coerente, mais enxuta e mais alinhada ao layout de cada lamina.

CLIENTE: ${context.clientName || 'Cliente'}
PERIODO: ${context.monthLabel}
MESES SELECIONADOS: ${context.plannerLabel}

BRIEF ESTRATEGICO:
${JSON.stringify(strategyBrief, null, 2)}

RASCUNHO DAS LAMINAS:
${JSON.stringify(draftContent, null, 2)}

CHECKLIST OBRIGATORIO — verifique campo por campo:

diagnostico.texto_longo:
- Estrutura: 3 paragrafos separados por \\n\\n (cenario -> tensao -> oportunidade).
- Minimo 520 chars, maximo 900 chars, maximo 290 chars por paragrafo.
- Tom consultivo e especifico ao nicho — sem generalidades de marketing.

desafios.itens:
- Exatamente 9 itens. Maximo 5 palavras e 42 chars por item. Sem ponto final.
- Especificos ao nicho — nao use "melhorar vendas" ou similares genericos.

grid.texto_longo:
- Visao da campanha como um todo — sem citar meses especificos.
- Paragrafos separados por \\n\\n. Minimo 420 chars, maximo 980 chars, maximo 320 chars/par.

slogan.frase:
- Frase completa, memoravel. LIMITE ABSOLUTO: 42 chars.

defesa.subtitulo:
- Coerente com o slogan. LIMITE ABSOLUTO: 42 chars.

defesa.texto_longo:
- Argumentacao consultiva em 3-4 paragrafos separados por \\n\\n.
- Minimo 560 chars, maximo 1280 chars, maximo 330 chars por paragrafo.

roadmap.cards:
- Exatamente ${nMonths} card(s) para os meses: ${context.deckMonths.join(', ')}.
- titulo: maximo 24 chars. descricao: maximo 58 chars. sugestao: maximo 28 chars.
- detalhe: SEMPRE vazio ("").
- Nao invente meses adicionais.

REGRAS FINAIS:
- Paragrafos de texto longo DEVEM usar \\n\\n como separador — nunca \\n simples.
- Remova cortes estranhos, palavras penduradas e frases sem fechamento.
- Preserve o sentido estrategico do brief.
- Responda APENAS o JSON final no mesmo schema do rascunho.

Retorne somente o JSON final.`;
};

const sanitizePresentationRenderKey = (value?: string) => {
    const raw = String(value || randomUUID()).trim();
    const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80);
    return cleaned || randomUUID();
};

const ensureDirExists = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const normalizePresentationRenderInput = async (rawData: any) => {
    const data = typeof rawData === 'object' && rawData ? { ...rawData } : {};
    const requestedMonths = normalizeMonthList(
        Array.isArray(data?.months) ? data.months.map((month: any) => String(month)).filter(Boolean) : [],
        data?.planner?.mes || ''
    );
    const roadmapMonths = requestedMonths.length > 0
        ? requestedMonths
        : normalizeMonthList([], data?.planner?.mes || '');
    const plannerLabel = buildPlannerLabel(roadmapMonths) || cleanSingleLine(data?.planner?.mes || '', 40, { keepTrailingPunctuation: true });

    data.planner = typeof data.planner === 'object' && data.planner ? data.planner : {};
    data.grid = typeof data.grid === 'object' && data.grid ? data.grid : {};
    data.diagnostico = typeof data.diagnostico === 'object' && data.diagnostico ? data.diagnostico : { texto_longo: '' };
    data.slogan = typeof data.slogan === 'object' && data.slogan ? data.slogan : { frase: '' };
    data.defesa = typeof data.defesa === 'object' && data.defesa ? data.defesa : { subtitulo: '', texto_longo: '' };
    data.desafios = typeof data.desafios === 'object' && data.desafios ? data.desafios : { itens: [] };
    data.roadmap = typeof data.roadmap === 'object' && data.roadmap ? data.roadmap : { cards: [] };
    data.link_cta = typeof data.link_cta === 'object' && data.link_cta ? data.link_cta : { url: '' };
    data.encerramento = typeof data.encerramento === 'object' && data.encerramento ? data.encerramento : {};

    let normalizedClientName = cleanSingleLine(data?.planner?.nome_cliente || '', 38, { keepTrailingPunctuation: true });
    let normalizedLogoPath = data?.planner?.logo_path || null;

    const clienteId = data?.clienteId;
    if (clienteId) {
        try {
            const { clientName, logoPath } = await getClientContext(clienteId);
            if (clientName) {
                normalizedClientName = clientName;
            }
            if (data?.planner?.logo_url) {
                const fromPayload = resolveClientLogoPathFromUrl(data.planner.logo_url);
                if (fromPayload) {
                    normalizedLogoPath = fromPayload;
                }
            }
            if (logoPath && !normalizedLogoPath) {
                normalizedLogoPath = logoPath;
            }
        } catch (contextError) {
            console.warn('[PRESENTATION] Falha ao enriquecer planner com dados do cliente:', contextError);
        }
    }

    return normalizeGeneratedContent(data, {
        plannerLabel,
        roadmapMonths,
        clientName: normalizedClientName,
        logoPath: normalizedLogoPath,
    });
};

export const generatePresentationContentPipeline = async (
    clienteId: string,
    months: string[] = [],
    onProgress?: PresentationProgressCallback
) => {
    await reportPresentationProgress(onProgress, 5, 'Carregando calendario e branding...');
    const context = await loadPresentationGenerationContext(clienteId, months);

    await reportPresentationProgress(onProgress, 20, 'Montando o brief estrategico da campanha...');
    const strategyResponse = await runGeminiJsonPrompt(
        clienteId,
        buildPresentationStrategyPrompt(context),
        'presentation_strategy',
        'quality'
    );

    await reportPresentationProgress(onProgress, 48, 'Escrevendo os textos das laminas...');
    const slidesDraftResponse = await runGeminiJsonPrompt(
        clienteId,
        buildPresentationSlidesPrompt(context, strategyResponse.parsed),
        'presentation_slides',
        'quality'
    );

    await reportPresentationProgress(onProgress, 76, 'Revisando coerencia, tamanho e ritmo visual...');
    let reviewedContent = slidesDraftResponse.parsed;
    try {
        const reviewResponse = await runGeminiJsonPrompt(
            clienteId,
            buildPresentationReviewPrompt(context, strategyResponse.parsed, slidesDraftResponse.parsed),
            'presentation_review',
            'fast'
        );
        reviewedContent = reviewResponse.parsed;
    } catch (reviewError) {
        console.warn('[PRESENTATION] Revisao editorial falhou, seguindo com rascunho normalizado:', reviewError);
    }

    const content = normalizeGeneratedContent(reviewedContent, {
        plannerLabel: context.plannerLabel,
        roadmapMonths: context.deckMonths,
        clientName: context.clientName,
        logoPath: context.logoPath,
    });

    await reportPresentationProgress(onProgress, 100, 'Conteudo da apresentacao concluido.');
    return {
        content,
        strategyBrief: strategyResponse.parsed,
        plannerLabel: context.plannerLabel,
        roadmapMonths: context.deckMonths,
        clientName: context.clientName,
    };
};

export const renderPresentationDeck = async (
    rawData: any,
    options: { renderKey?: string; onProgress?: PresentationProgressCallback } = {}
) => {
    await reportPresentationProgress(options.onProgress, 10, 'Preparando estrutura da apresentacao...');
    const normalizedData = await normalizePresentationRenderInput(rawData);

    ensureDirExists(TMP_DIR);
    ensureDirExists(OUTPUT_DIR);

    const renderKey = sanitizePresentationRenderKey(options.renderKey);
    const outputDir = path.join(OUTPUT_DIR, renderKey);
    const contentFile = path.join(TMP_DIR, `${renderKey}.json`);

    fs.rmSync(outputDir, { recursive: true, force: true });
    ensureDirExists(outputDir);
    fs.writeFileSync(contentFile, JSON.stringify(normalizedData, null, 2), { encoding: 'utf-8' });

    await reportPresentationProgress(options.onProgress, 38, 'Renderizando as laminas no motor grafico...');

    const pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    if (!fs.existsSync(SCRIPT_FILE)) {
        throw new Error(`Script Python nao encontrado: ${SCRIPT_FILE}`);
    }

    try {
        await execAsync(`${pythonBin} "${SCRIPT_FILE}"`, {
            cwd: GEN_DIR,
            env: {
                ...process.env,
                PRESENTATION_CONTENT_FILE: contentFile,
                PRESENTATION_OUTPUT_DIR: outputDir,
            },
        });
    } catch (error: any) {
        const details = error?.stderr || error?.message || 'Falha na execucao do script Python';
        throw new Error(details);
    }

    await reportPresentationProgress(options.onProgress, 92, 'Organizando arquivos gerados...');

    const files = fs.existsSync(outputDir)
        ? fs.readdirSync(outputDir).filter((file) => file.endsWith('.png')).sort((a, b) => a.localeCompare(b))
        : [];
    const tempFiles = files.map((file) => `${renderKey}/${file}`);
    const images = files.map((file) => `/presentation-output/${renderKey}/${file}?t=${Date.now()}`);

    await reportPresentationProgress(options.onProgress, 100, 'Apresentacao renderizada com sucesso.');
    return {
        content: normalizedData,
        images,
        tempFiles,
        renderKey,
    };
};
router.get('/available-months/:clienteId', async (req: Request, res: Response) => {
    try {
        const { clienteId } = req.params;
        if (!clienteId) {
            return res.status(400).json({ success: false, error: 'Cliente ID e obrigatorio' });
        }

        const result = await db.query(
            `SELECT mes
             FROM calendarios
             WHERE cliente_id = $1 AND status = 'published'
             GROUP BY mes
             ORDER BY MAX(criado_em) DESC`,
            [clienteId]
        );

        const months = (result.rows || [])
            .map((row: any) => (row?.mes ? String(row.mes) : ''))
            .filter(Boolean);

        return res.json({ success: true, months });
    } catch (error: any) {
        console.error('[PRESENTATION] Erro ao listar meses:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/generate-content', async (req: Request, res: Response) => {
    try {
        const { clienteId, months } = req.body || {};
        if (!clienteId) {
            return res.status(400).json({ success: false, error: 'Cliente ID e obrigatorio' });
        }

        const requestedMonths = Array.isArray(months)
            ? months.map((month: any) => String(month || '').trim()).filter(Boolean)
            : [];
        const result = await generatePresentationContentPipeline(String(clienteId), requestedMonths);
        return res.json({ success: true, content: result.content, strategyBrief: result.strategyBrief });
    } catch (error: any) {
        console.error('[PRESENTATION] Erro ao gerar conteudo:', error);
        if (error?.status === 429) {
            return res.status(429).json({
                success: false,
                error: 'Cota da API Gemini excedida. Aguarde alguns minutos e tente novamente.',
                retryAfter: error.errorDetails?.find((detail: any) => detail['@type']?.includes('RetryInfo'))?.retryDelay || '1 minuto',
            });
        }
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
            return res.status(500).json({
                success: false,
                error: 'A IA retornou um formato invalido. Tente novamente ou preencha manualmente.',
            });
        }
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/generate-content-job', async (req: Request, res: Response) => {
    try {
        const { clienteId, months } = req.body || {};
        if (!clienteId) {
            return res.status(400).json({ success: false, error: 'Cliente ID e obrigatorio' });
        }

        const requestedMonths = Array.isArray(months)
            ? months.map((month: any) => String(month || '').trim()).filter(Boolean)
            : [];
        const jobId = randomUUID();
        const payload = {
            jobType: 'presentation',
            operation: 'content',
            clienteId: String(clienteId),
            months: requestedMonths,
        };

        await db.query(
            `INSERT INTO calendar_generation_jobs (id, cliente_id, status, progress, current_step, payload, created_at)
             VALUES ($1, $2, 'pending', 0, 'Aguardando inicio...', $3, NOW())`,
            [jobId, clienteId, JSON.stringify(payload)]
        );

        return res.status(202).json({
            success: true,
            message: 'Geracao de conteudo iniciada em background.',
            jobId,
        });
    } catch (error: any) {
        console.error('[PRESENTATION] Erro ao iniciar job de conteudo:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/generate-job', async (req: Request, res: Response) => {
    try {
        const data = req.body || {};
        const clienteId = String(data?.clienteId || '').trim();
        if (!clienteId) {
            return res.status(400).json({ success: false, error: 'Cliente ID e obrigatorio' });
        }

        const jobId = randomUUID();
        const payload = {
            jobType: 'presentation',
            operation: 'render',
            clienteId,
            input: data,
        };

        await db.query(
            `INSERT INTO calendar_generation_jobs (id, cliente_id, status, progress, current_step, payload, created_at)
             VALUES ($1, $2, 'pending', 0, 'Aguardando inicio...', $3, NOW())`,
            [jobId, clienteId, JSON.stringify(payload)]
        );

        return res.status(202).json({
            success: true,
            message: 'Geracao da apresentacao iniciada em background.',
            jobId,
        });
    } catch (error: any) {
        console.error('[PRESENTATION] Erro ao iniciar job de render:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/generate', async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await renderPresentationDeck(req.body || {});
        res.json({
            success: true,
            message: 'Laminas geradas com sucesso',
            images: result.images,
            tempFiles: result.tempFiles,
            content: result.content,
        });
    } catch (error: any) {
        console.error('[PRESENTATION] Erro no handler:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/save', async (req: Request, res: Response) => {
    try {
        const { clienteId, tempFiles, dataJson, titulo, tipo, metadata } = req.body;
        if (!clienteId || !tempFiles || !Array.isArray(tempFiles)) {
            return res.status(400).json({ success: false, error: 'Dados incompletos' });
        }

        const timestamp = Date.now();
        const clientStorageDir = path.resolve(__dirname, `../../storage/presentations/${clienteId}/${timestamp}`);
        if (!fs.existsSync(clientStorageDir)) {
            fs.mkdirSync(clientStorageDir, { recursive: true });
        }

        const savedUrls: string[] = [];
        for (const tempFile of tempFiles) {
            const relativeFile = String(tempFile || '').replace(/\\/g, '/').replace(/^\/+/, '');
            const sourcePath = path.resolve(OUTPUT_DIR, relativeFile);
            const relativeToOutput = path.relative(OUTPUT_DIR, sourcePath);
            if (relativeToOutput.startsWith("..") || path.isAbsolute(relativeToOutput)) {
                continue;
            }
            const finalName = path.basename(relativeFile);
            const destPath = path.join(clientStorageDir, finalName);
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
                savedUrls.push(`/storage/presentations/${clienteId}/${timestamp}/${finalName}`);
            }
        }

        const result = await db.query(
            `INSERT INTO presentations (cliente_id, titulo, arquivos, dados_json, tipo, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, criado_em`,
            [
                clienteId,
                titulo || `Apresentacao ${new Date().toLocaleDateString()}`,
                JSON.stringify(savedUrls),
                JSON.stringify(dataJson),
                tipo || 'laminas',
                metadata ? JSON.stringify(metadata) : null,
            ]
        );

        return res.json({
            success: true,
            message: 'Apresentacao salva com sucesso!',
            id: result.rows[0].id,
            savedUrls,
        });
    } catch (error: any) {
        console.error('[PRESENTATION] Erro ao salvar apresentacao:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/history/:clienteId', async (req: Request, res: Response) => {
    try {
        const { clienteId } = req.params;
        const result = await db.query(
            'SELECT * FROM presentations WHERE cliente_id = $1 ORDER BY criado_em DESC',
            [clienteId]
        );

        const history = result.rows.map((row: any) => {
            let arquivos = row.arquivos;
            let dados_json = row.dados_json;

            try {
                if (typeof arquivos === 'string') arquivos = JSON.parse(arquivos);
            } catch (_error) {
                // noop
            }

            try {
                if (typeof dados_json === 'string') dados_json = JSON.parse(dados_json);
            } catch (_error) {
                // noop
            }

            return { ...row, arquivos, dados_json };
        });

        res.json({ success: true, history });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── PRESENTATION CHAT AGENT ─────────────────────────────────────────────────

const buildPresentationChatAgentPrompt = (context: PresentationGenerationContext): string =>
    `Voce e um estrategista senior conduzindo uma entrevista rapida para enriquecer uma apresentacao executiva de agencia para o cliente.

VOCE JA TEM ACESSO AO CALENDARIO E BRANDING DO CLIENTE — NAO PERGUNTE SOBRE ESTES ITENS:
CLIENTE: ${context.clientName || 'Cliente'}
MESES: ${context.plannerLabel}
BRANDING:
${distillBrandingContext(context.branding)}

## Sua missao
Fazer 4-5 perguntas DIRETAS para coletar o que o calendario e branding nao tem:
- Posicionamento competitivo especifico deste periodo
- Grande mensagem central da campanha
- Prova/argumento concreto para a lamina de defesa
- Tom emocional desejado
- Restricoes e evitacoes

## Regras
1. NUNCA mais de uma pergunta por mensagem.
2. Comece pela pergunta de maior impacto: o diferencial competitivo.
3. Apos cada resposta, aprofunde OU avance para a proxima dimensao.
4. Apos 4-5 trocas, sintetize e encerre com o marcador abaixo.

## Formato de encerramento (use EXATAMENTE quando tiver informacao suficiente)

[PRESENTATION_CONTEXT_READY]
POSICIONAMENTO: {diferencial competitivo da marca neste periodo}
MENSAGEM_CENTRAL: {a grande ideia ou o que o cliente deve lembrar}
PROVA_DEFESA: {argumentos, dados ou depoimentos para a defesa}
TOM_EMOCIONAL: {como o cliente deve se sentir ao ver a apresentacao}
RESTRICOES: {temas, tons ou abordagens a evitar}
[/PRESENTATION_CONTEXT_READY]`;

const buildPresentationSlidesPromptWithChat = (
    context: PresentationGenerationContext,
    strategyBrief: any,
    chatContext: string
): string => {
    const base = buildPresentationSlidesPrompt(context, strategyBrief);
    const injection = `CONTEXTO ADICIONAL DO USUARIO (prioridade maxima para diagnostico, slogan e defesa):\n${chatContext}\n\n`;
    return base.replace(
        '═══════════════════════════════════════════════════════\nFUNCAO DE CADA LAMINA',
        injection + '═══════════════════════════════════════════════════════\nFUNCAO DE CADA LAMINA'
    );
};

const generatePresentationContentWithChatContext = async (
    clienteId: string,
    months: string[],
    chatContext: string
): Promise<any> => {
    const context = await loadPresentationGenerationContext(clienteId, months);

    const strategyResponse = await runGeminiJsonPrompt(
        clienteId,
        buildPresentationStrategyPrompt(context),
        'presentation_strategy_chat',
        'quality'
    );

    const slidesDraftResponse = await runGeminiJsonPrompt(
        clienteId,
        buildPresentationSlidesPromptWithChat(context, strategyResponse.parsed, chatContext),
        'presentation_slides_chat',
        'quality'
    );

    let reviewedContent = slidesDraftResponse.parsed;
    try {
        const reviewResponse = await runGeminiJsonPrompt(
            clienteId,
            buildPresentationReviewPrompt(context, strategyResponse.parsed, slidesDraftResponse.parsed),
            'presentation_review_chat',
            'fast'
        );
        reviewedContent = reviewResponse.parsed;
    } catch {
        // segue com rascunho normalizado
    }

    return normalizeGeneratedContent(reviewedContent, {
        plannerLabel: context.plannerLabel,
        roadmapMonths: context.deckMonths,
        clientName: context.clientName,
        logoPath: context.logoPath,
    });
};

router.post('/chat-agent', async (req: Request, res: Response) => {
    try {
        const { clientId, messages, months } = req.body as {
            clientId: string;
            messages: Array<{ role: 'user' | 'model'; content: string }>;
            months?: string[];
        };

        if (!clientId) {
            return res.status(400).json({ error: 'clientId obrigatorio.' });
        }

        const safeMonths = Array.isArray(months) ? months : [];
        const context = await loadPresentationGenerationContext(clientId, safeMonths);
        const systemPrompt = buildPresentationChatAgentPrompt(context);

        const safeMsgs = Array.isArray(messages) ? messages : [];
        const userTurnCount = safeMsgs.filter(m => m.role === 'user').length;
        const historyToSend = [...safeMsgs];
        if (userTurnCount >= 5) {
            historyToSend.push({
                role: 'user',
                content: '[SISTEMA]: Limite de trocas atingido. Sintetize agora e emita o marcador [PRESENTATION_CONTEXT_READY] com tudo que foi coletado.'
            });
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GOOGLE_API_KEY nao configurada.' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelsToTry = getGeminiModelCandidates('fast');
        let reply = '';

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
                const result = historyToSend.length === 0
                    ? await model.generateContent('Inicie a conversa com sua primeira pergunta estrategica.')
                    : await model.generateContent({
                        contents: historyToSend.map(m => ({ role: m.role, parts: [{ text: m.content }] }))
                    });
                reply = result.response.text();
                if (result.response.usageMetadata) {
                    await updateTokenUsage(clientId, result.response.usageMetadata, 'presentation_chat_agent', modelName);
                }
                break;
            } catch (err: any) {
                if (modelName === modelsToTry[modelsToTry.length - 1]) throw err;
            }
        }

        const readyMatch = reply.match(/\[PRESENTATION_CONTEXT_READY\]([\s\S]*?)\[\/PRESENTATION_CONTEXT_READY\]/);
        if (readyMatch && readyMatch[1]) {
            const chatContext = readyMatch[1].trim();
            const content = await generatePresentationContentWithChatContext(clientId, safeMonths, chatContext);
            return res.json({ reply, done: true, content });
        }

        return res.json({ reply, done: false });

    } catch (error: any) {
        console.error('[PresentationChatAgent] Erro:', error);
        return res.status(500).json({ error: error.message || 'Erro interno.' });
    }
});

export default router;



















