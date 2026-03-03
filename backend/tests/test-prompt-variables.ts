/**
 * test-prompt-variables.ts
 *
 * Teste unitário manual para o módulo promptVariables.ts
 * Executa: cd backend && npx ts-node tests/test-prompt-variables.ts
 */

import {
    SUPPORTED_VARIABLES,
    REQUIRED_VARIABLES,
    extractPlaceholders,
    buildPreviewContext
} from "../src/services/promptVariables";
import db from "../src/config/database";

let passed = 0;
let failed = 0;

function assert(testName: string, condition: boolean, message?: string) {
    if (condition) {
        console.log(`✅ PASS: ${testName}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${testName}`);
        if (message) console.error(`   ${message}`);
        failed++;
    }
}

async function runTests() {
    console.log("== Testa Constantes ==");

    assert("Deve listar ao menos DNA_DA_MARCA como variável obrigatória",
        REQUIRED_VARIABLES.includes("DNA_DA_MARCA") && REQUIRED_VARIABLES.includes("MES") && REQUIRED_VARIABLES.length >= 4);

    const keys = SUPPORTED_VARIABLES.map(v => v.key);
    assert("Não deve haver chaves duplicadas no SUPPORTED_VARIABLES", new Set(keys).size === keys.length);

    console.log("\n== Testa extractPlaceholders() ==");

    const p1 = extractPlaceholders(`Crie um post para {{DNA_DA_MARCA}} no {{MES}} considerando {{MIX_POSTS}}.`);
    assert("Deve extrair múltiplas variáveis válidas", p1.length === 3 && p1.includes("DNA_DA_MARCA") && p1.includes("MES"));

    const p2 = extractPlaceholders(`{{MES}} / {{MES}} - Outra var {{VARIAVEL_A}} e de novo {{VARIAVEL_A}}`);
    assert("Deve deduplicar variáveis repetidas", p2.length === 2 && p2.includes("MES") && p2.includes("VARIAVEL_A"));

    const p3 = extractPlaceholders(`{{VAR_123}} {{ABC}}`);
    assert("Deve lidar com chaves que contenham números ou underline", p3.length === 2 && p3.includes("VAR_123"));

    const p4 = extractPlaceholders(`Este texto não tem var {DNA} ou {{ }} ou {{a minúsculo}}`);
    assert("Deve retornar vazio se não houver placeholders válidos", p4.length === 0);

    console.log("\n== Testa buildPreviewContext() ==");

    const ctxMock = await buildPreviewContext("cli_123", "Fevereiro 2026", "mock");
    assert("Deve retornar exemplos estáticos no modo mock",
        ctxMock["DNA_DA_MARCA"] !== undefined && !(ctxMock["DNA_DA_MARCA"] || "").includes("[SIMULAÇÃO]"));
    assert("Modo mock deve incluir MES do catalogo",
        ctxMock["MES"] === SUPPORTED_VARIABLES.find(v => v.key === "MES")?.example);

    // Mockar db.query internamente sem jest
    const originalQuery = db.query;
    (db as any).query = async (queryStr: string) => {
        if (queryStr.includes("branding")) return { rows: [{ tone_of_voice: "Test Tone", visual_style: "Test Visual", audience: "B2B" }] };
        if (queryStr.includes("clientes")) return { rows: [{ categorias_nicho: ["Tech", "SaaS"] }] };
        if (queryStr.includes("brand_rules")) return { rows: [{ regra: "Nunca errar" }] };
        if (queryStr.includes("brand_docs")) return { rows: [] };
        return { rows: [] };
    };

    const ctxReal = await buildPreviewContext("cli_real", "Maio 2026", "real");

    assert("Deve consultar banco para buscar branding e categorias", (ctxReal["DNA_DA_MARCA"] || "").includes("Test Tone") && (ctxReal["DNA_DA_MARCA"] || "").includes("Tech, SaaS"));
    assert("Deve consultar banco para buscar brand_rules", (ctxReal["REGRAS_OBRIGATORIAS"] || "").includes("Nunca errar"));
    assert("Deve simular o calendário", ctxReal["MES"] === "Maio 2026" && (ctxReal["BRIEFING"] || "").includes("[SIMULAÇÃO]"));

    // Testa DB failure gracefully
    (db as any).query = async () => { throw new Error("Database falhou fatalmente"); };
    const ctxFail = await buildPreviewContext("cli_falho", "Maio 2026", "real");

    assert("Deve aplicar fallback gracefully se DB falhar no modo real", (ctxFail["DNA_DA_MARCA"] || "").includes("-- Erro ao carregar DNA --") && ctxFail["MES"] === "Maio 2026");

    // Limpar hack
    (db as any).query = originalQuery;

    console.log(`\n─────────────────────────────────────`);
    console.log(`Resultado: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
    else console.log("✅ Todos os testes passaram!");
}

runTests().catch(console.error);
