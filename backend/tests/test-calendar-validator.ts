/**
 * test-calendar-validator.ts
 *
 * Teste unitário para a validação runtime do schema do LLM (PR5).
 * Executa: cd backend && npx ts-node tests/test-calendar-validator.ts
 */

import { validateCalendarSchema } from "../src/utils/calendarValidator";

let passed = 0;
let failed = 0;

function assertEqual(testName: string, actual: any, expected: any) {
    if (actual === expected) {
        console.log(`✅ PASS: ${testName}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${testName}`);
        console.error(`   Expected: ${expected}`);
        console.error(`   Got:      ${actual}`);
        failed++;
    }
}

// Helper: gera um post válido
function getValidPost(dia: number = 1) {
    return {
        dia,
        tema: "Tema Teste",
        formato: "Reels",
        instrucoes_visuais: "Instruções visuais",
        copy_inicial: "Copy de teste",
        objetivo: "Engajamento",
        cta: "Comente",
        palavras_chave: ["teste", "marketing"],
    };
}

// ── Teste 1: JSON válido perfeito
const validJson = [getValidPost(1), getValidPost(5)];
const res1 = validateCalendarSchema(validJson);
assertEqual("JSON válido retorna isValid = true", res1.isValid, true);
assertEqual("JSON válido retorna 0 erros", res1.errors.length, 0);

// ── Teste 2: Não é Array (ex: objeto ou string solta)
const res2 = validateCalendarSchema({ dia: 1 });
assertEqual("Não é array: isValid=false", res2.isValid, false);

// ── Teste 3: Ausência de campos (ex: removendo formato)
const invalidPost3 = getValidPost(1) as any;
delete invalidPost3.formato;
const res3 = validateCalendarSchema([invalidPost3]);
assertEqual("Falta campo 'formato': falha", res3.isValid, false);
assertEqual("Falta campo 'formato': erro menciona formato", res3.errors.some(e => e.includes("formato")), true);

// ── Teste 4: Enum de formato inválido
const invalidPost4 = getValidPost(1) as any;
invalidPost4.formato = "TikTok";
const res4 = validateCalendarSchema([invalidPost4]);
assertEqual("Enum formato inválido: falha", res4.isValid, false);
assertEqual("Enum formato inválido: erro de enum", res4.errors.some(e => e.includes("Reels, Static, Carousel ou Stories")), true);

// ── Teste 5: palavras_chave inválidas
const invalidPost5 = getValidPost(1) as any;
invalidPost5.palavras_chave = []; // Vazio
const res5 = validateCalendarSchema([invalidPost5]);
assertEqual("Palavras-chave vazias: falha", res5.isValid, false);

// ── Teste 6: dia não sequencial ou repetido
const repetitiveDays = [getValidPost(1), getValidPost(1)];
const res6 = validateCalendarSchema(repetitiveDays);
assertEqual("Dia repetido: falha", res6.isValid, false);
assertEqual("Dia repetido: relata repetição", res6.errors.some(e => e.includes("está repetido")), true);

console.log(`\n─────────────────────────────────────`);
console.log(`Resultado: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log("✅ Todos os testes passaram!");
