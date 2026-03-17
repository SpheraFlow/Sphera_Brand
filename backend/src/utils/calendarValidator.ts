/**
 * backend/src/utils/calendarValidator.ts
 *
 * Runtime validation for the canonical calendar schema returned by the LLM.
 */

import { randomUUID } from "crypto";

const FORMAT_ALIASES: Record<string, string> = {
    reels: "Reels",
    reel: "Reels",
    arte: "Arte",
    static: "Arte",
    carrossel: "Carrossel",
    carousel: "Carrossel",
    story: "Story",
    stories: "Story",
    foto: "Foto",
    fotos: "Foto",
    photo: "Foto",
    photos: "Foto",
};

function normalizeFormato(raw: any): string | undefined {
    if (typeof raw !== "string") return undefined;

    const normalized = raw
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[()\[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const direct = FORMAT_ALIASES[normalized];
    if (direct) return direct;

    if (normalized.includes("reel")) return "Reels";
    if (normalized.includes("carrossel") || normalized.includes("carousel")) return "Carrossel";
    if (normalized.includes("story") || normalized.includes("stories")) return "Story";
    if (normalized.includes("foto") || normalized.includes("photo")) return "Foto";
    if (
        normalized.includes("arte") ||
        normalized.includes("static") ||
        normalized.includes("estatico") ||
        normalized.includes("imagem unica") ||
        normalized.includes("editorial")
    ) {
        return "Arte";
    }

    return undefined;
}

function isCarouselFormato(raw: any): boolean {
    return normalizeFormato(raw) === "Carrossel";
}

/**
 * Auto-repairs common LLM output issues before strict validation.
 * Safety net para modelos que ignoram responseSchema constraints.
 * Nunca lança exceção — retorna { repaired, warnings }.
 */
export function repairCalendarSchema(data: any[]): { repaired: any[]; warnings: string[] } {
    const warnings: string[] = [];

    const repaired = data.map((post: any, idx: number) => {
        if (!post || typeof post !== "object") return post;
        const p = { ...post };

        // Repara formato ausente/inválido: tenta inferir do texto, fallback "Arte"
        if (!normalizeFormato(p.formato)) {
            const textHint = [p.instrucoes_visuais, p.tema, p.copy_inicial]
                .filter(Boolean)
                .map(String)
                .join(" ");
            const inferred = normalizeFormato(textHint);
            const fallback = inferred ?? "Arte";
            warnings.push(
                `[Post #${idx + 1}] formato "${p.formato}" inválido → auto-corrigido para "${fallback}"`
            );
            p.formato = fallback;
        }

        // Repara palavras_chave ausente: fallback [tema]
        if (!Array.isArray(p.palavras_chave) || p.palavras_chave.length === 0) {
            const fallback =
                typeof p.tema === "string" && p.tema.trim() ? [p.tema.trim()] : ["conteúdo"];
            warnings.push(`[Post #${idx + 1}] palavras_chave ausente → usando fallback`);
            p.palavras_chave = fallback;
        }

        // Repara legenda ausente em Carrossel
        if (isCarouselFormato(p.formato)) {
            if (typeof p.legenda !== "string" || !p.legenda.trim()) {
                const fallback = String(p.copy_inicial || p.tema || "")
                    .replace(/\[slide\s*\d+\][^[[\]]*(?=\[|$)/gi, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                warnings.push(`[Post #${idx + 1}] legenda ausente em Carrossel → usando fallback`);
                p.legenda = fallback || String(p.tema || "Carrossel").trim();
            }
        }

        return p;
    });

    return { repaired, warnings };
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    correlationId: string;
}

export class InvalidCalendarOutputError extends Error {
    public type = "INVALID_CALENDAR_OUTPUT";
    public details: string[];
    public correlationId: string;

    constructor(details: string[], correlationId: string) {
        super("O calendario gerado nao cumpre o schema requerido.");
        this.name = "InvalidCalendarOutputError";
        this.details = details;
        this.correlationId = correlationId;
        Object.setPrototypeOf(this, InvalidCalendarOutputError.prototype);
    }
}

export function validateCalendarSchema(data: any): ValidationResult {
    const errors: string[] = [];
    const correlationId = randomUUID();

    if (!Array.isArray(data)) {
        return {
            isValid: false,
            errors: ["A raiz do retorno deve ser um Array JSON."],
            correlationId,
        };
    }

    if (data.length === 0) {
        errors.push("O array retornado esta vazio.");
    }

    const usedDays = new Set<number>();
    const getNextDay = (startFrom: number): number => {
        let d = startFrom;
        while (usedDays.has(d) && d <= 31) d++;
        if (d > 31) {
            d = 1;
            while (usedDays.has(d) && d <= 31) d++;
        }
        return d;
    };

    for (let i = 0; i < data.length; i++) {
        const post = data[i];
        const prefix = `[Post #${i + 1}]`;

        if (!post || typeof post !== "object") {
            errors.push(`${prefix} nao e um objeto JSON valido.`);
            continue;
        }

        if (typeof post.dia !== "number" || post.dia < 1 || post.dia > 31) {
            errors.push(`${prefix} Campo 'dia' deve ser um numero entre 1 e 31.`);
        } else {
            if (usedDays.has(post.dia)) {
                post.dia = getNextDay(post.dia + 1);
            }
            usedDays.add(post.dia);
        }

        const normalizedFormato = normalizeFormato(post.formato);
        if (!normalizedFormato) {
            errors.push(`${prefix} Campo 'formato' deve ser: Reels, Arte, Carrossel, Foto ou Story. Veio: "${post.formato}"`);
        } else if (normalizedFormato !== post.formato) {
            post.formato = normalizedFormato;
        }

        if (!Array.isArray(post.palavras_chave) || post.palavras_chave.length === 0) {
            errors.push(`${prefix} Campo 'palavras_chave' deve ser um array com pelo menos 1 string.`);
        } else {
            const allStrings = post.palavras_chave.every((k: any) => typeof k === "string" && k.trim().length > 0);
            if (!allStrings) {
                errors.push(`${prefix} Campo 'palavras_chave' nao pode conter itens vazios ou nao-strings.`);
            }
        }

        const stringFields = ["tema", "instrucoes_visuais", "copy_inicial", "objetivo", "cta"];
        for (const field of stringFields) {
            if (typeof post[field] !== "string" || post[field].trim() === "") {
                errors.push(`${prefix} Campo '${field}' e obrigatorio e nao pode ser vazio.`);
            }
        }

        if (isCarouselFormato(post.formato)) {
            if (typeof post.legenda !== "string" || post.legenda.trim() === "") {
                errors.push(`${prefix} Carrossel deve incluir o campo 'legenda' com a legenda final do post.`);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        correlationId,
    };
}
