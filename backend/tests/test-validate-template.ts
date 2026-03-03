/**
 * test-validate-template.ts
 * Teste unitário da função validateTemplateBody (sem banco de dados).
 * Executar: cd backend && npx ts-node tests/test-validate-template.ts
 */

// Importamos diretamente a função do módulo para testá-la isoladamente.
// Como o módulo usa db.query, não podemos importar a rota inteira — então
// copiamos a lógica pura aqui. Em breve, mover validateTemplateBody para
// backend/src/utils/promptValidator.ts para reuso.

const REQUIRED_PLACEHOLDERS = [
    "{{DNA_DA_MARCA}}",
    "{{BRIEFING}}",
    "{{MIX_POSTS}}",
    "{{MES}}",
];

const OUTPUT_CONTRACT_FIELDS = [
    "dia",
    "tema",
    "formato",
    "instrucoes_visuais",
    "copy_inicial",
    "objetivo",
    "cta",
    "palavras_chave",
];

const FORBIDDEN_PATTERNS: { re: RegExp; msg: string }[] = [
    { re: /responda em markdown/i, msg: 'Frase proibida: "responda em markdown"' },
    { re: /```/g, msg: "Template não deve conter delimitadores de código (```)" },
];

function validateTemplateBody(body: string): string[] {
    const errors: string[] = [];
    for (const ph of REQUIRED_PLACEHOLDERS) {
        if (!body.includes(ph)) errors.push(`Placeholder obrigatório ausente: ${ph}`);
    }
    const missingFields = OUTPUT_CONTRACT_FIELDS.filter((f) => !body.includes(f));
    if (missingFields.length > 0) {
        errors.push(`Template não menciona campo(s) do contrato de saída: ${missingFields.join(", ")}`);
    }
    for (const { re, msg } of FORBIDDEN_PATTERNS) {
        if (re.test(body)) errors.push(msg);
    }
    return errors;
}

// ─── Casos de teste ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assertEqual(testName: string, actual: any, expected: any) {
    const ok =
        typeof expected === "number"
            ? actual === expected
            : JSON.stringify(actual) === JSON.stringify(expected);

    if (ok) {
        console.log(`✅ PASS: ${testName}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${testName}`);
        console.error(`   Expected: ${JSON.stringify(expected)}`);
        console.error(`   Got:      ${JSON.stringify(actual)}`);
        failed++;
    }
}

// ── Teste 1: body válido (sem erros)
const VALID_BODY = `Atue como Strategist Planner.
DNA DA MARCA: {{DNA_DA_MARCA}}
BRIEFING: "{{BRIEFING}}"
MIX: {{MIX_POSTS}}
MÊS: {{MES}}
Retorne JSON: [{ "dia": 1, "tema": "...", "formato": "...", "instrucoes_visuais": "...", "copy_inicial": "...", "objetivo": "...", "cta": "...", "palavras_chave": [] }]`;

assertEqual("body válido retorna array vazio", validateTemplateBody(VALID_BODY).length, 0);

// ── Teste 2: body sem placeholder obrigatório
const BODY_SEM_DNA = VALID_BODY.replace("{{DNA_DA_MARCA}}", "DNA AQUI");
const erros2 = validateTemplateBody(BODY_SEM_DNA);
assertEqual("detecta placeholder ausente: DNA_DA_MARCA", erros2.some(e => e.includes("DNA_DA_MARCA")), true);

// ── Teste 3: body sem campo do contrato de saída
const BODY_SEM_CONTRATO = VALID_BODY.replace('"instrucoes_visuais"', '"instrucao"').replace('"copy_inicial"', '"copy"');
const erros3 = validateTemplateBody(BODY_SEM_CONTRATO);
assertEqual("detecta campos do contrato ausentes", erros3.some(e => e.includes("instrucoes_visuais")), true);

// ── Teste 4: body completamente vazio
const erros4 = validateTemplateBody("");
assertEqual("body vazio tem 4+ erros (placeholders + contrato)", erros4.length >= REQUIRED_PLACEHOLDERS.length, true);

// ── Teste 5: padrão proibido (```json)
const BODY_COM_BACKTICK = VALID_BODY + "\n```json\n[...]\n```";
const erros5 = validateTemplateBody(BODY_COM_BACKTICK);
assertEqual("detecta backtick proibido", erros5.some(e => e.includes("delimitadores de código")), true);

// ── Teste 6: body com 'responda em markdown' (proibido)
const BODY_MARKDOWN = VALID_BODY + "\nresponda em markdown por favor.";
const erros6 = validateTemplateBody(BODY_MARKDOWN);
assertEqual("detecta frase proibida 'responda em markdown'", erros6.some(e => e.includes("markdown")), true);

// ── Resultado final
console.log(`\n─────────────────────────────────────`);
console.log(`Resultado: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log("✅ Todos os testes passaram!");
