/**
 * backend/src/utils/calendarValidator.ts
 *
 * Módulo de validação rigorosa (Runtime) para o output do LLM.
 * Assegura o cumprimento do contrato canônico V1.
 */

import { randomUUID } from "crypto";

// ─── Tipos e Contratos ────────────────────────────────────────────────────────

// Mapa de sinônimos: cada chave (normalizada lowercase) mapeia para o valor canônico PT-BR.
// O LLM às vezes retorna variantes em inglês — normalizamos aqui em vez de falhar a geração.
const FORMAT_ALIASES: Record<string, string> = {
    "reels": "Reels",
    "reel": "Reels",
    "arte": "Arte",
    "static": "Arte",
    "carrossel": "Carrossel",
    "carousel": "Carrossel",
    "story": "Story",
    "stories": "Story",
    "foto": "Foto",
    "fotos": "Foto",
    "photo": "Foto",
    "photos": "Foto",
};

const ALLOWED_FORMATS = new Set(Object.values(FORMAT_ALIASES));

/** Normaliza o valor de formato do LLM para o canônico PT-BR, retornando undefined se inválido. */
function normalizeFormato(raw: any): string | undefined {
    if (typeof raw !== "string") return undefined;
    return FORMAT_ALIASES[raw.trim().toLowerCase()];
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
        super("O calendário gerado não cumpre o schema requerido.");
        this.name = "InvalidCalendarOutputError";
        this.details = details;
        this.correlationId = correlationId;
        Object.setPrototypeOf(this, InvalidCalendarOutputError.prototype);
    }
}

// ─── Funções de Validação ─────────────────────────────────────────────────────

/**
 * Valida o JSON (já parseado como objeto/array) retornado pelo LLM.
 * Verifica a estrutura, campos obrigatórios, tipos e restrições simples.
 */
export function validateCalendarSchema(data: any): ValidationResult {
    const errors: string[] = [];
    const correlationId = randomUUID();

    // 1. Deve ser um array
    if (!Array.isArray(data)) {
        return {
            isValid: false,
            errors: ["A raiz do retorno deve ser um Array JSON."],
            correlationId,
        };
    }

    if (data.length === 0) {
        errors.push("O array retornado está vazio.");
    }

    // 2. Iterar cada post e validar
    const usedDays = new Set<number>();

    for (let i = 0; i < data.length; i++) {
        const post = data[i];
        const prefix = `[Post #${i + 1}]`;

        if (!post || typeof post !== "object") {
            errors.push(`${prefix} não é um objeto JSON válido.`);
            continue;
        }

        // -- Validando "dia"
        if (typeof post.dia !== "number" || post.dia < 1 || post.dia > 31) {
            errors.push(`${prefix} Campo 'dia' deve ser um número entre 1 e 31.`);
        } else {
            if (usedDays.has(post.dia)) {
                errors.push(`${prefix} Campo 'dia' (${post.dia}) está repetido.`);
            }
            usedDays.add(post.dia);
        }

        // -- Validando "formato" e normalizando alias em inglês para PT-BR
        const normalizedFormato = normalizeFormato(post.formato);
        if (!normalizedFormato) {
            errors.push(`${prefix} Campo 'formato' deve ser: Reels, Arte, Carrossel, Foto ou Story. Veio: "${post.formato}"`);
        } else if (normalizedFormato !== post.formato) {
            // Corrige silenciosamente o valor para o canônico (ex: Photo → Foto)
            post.formato = normalizedFormato;
        }

        // -- Validando "palavras_chave"
        if (!Array.isArray(post.palavras_chave) || post.palavras_chave.length === 0) {
            errors.push(`${prefix} Campo 'palavras_chave' deve ser um array com pelo menos 1 string.`);
        } else {
            const allStrings = post.palavras_chave.every((k: any) => typeof k === "string" && k.trim().length > 0);
            if (!allStrings) {
                errors.push(`${prefix} Campo 'palavras_chave' não pode conter itens vazios ou não-strings.`);
            }
        }

        // -- Validando os demais campos textuais
        const stringFields = ["tema", "instrucoes_visuais", "copy_inicial", "objetivo", "cta"];
        for (const field of stringFields) {
            if (typeof post[field] !== "string" || post[field].trim() === "") {
                errors.push(`${prefix} Campo '${field}' é obrigatório e não pode ser vazio.`);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        correlationId,
    };
}
