/**
 * test-dashboard-metrics.ts
 * Testes unitários para a lógica do dashboard de métricas (PR6).
 * Run: npx ts-node tests/test-dashboard-metrics.ts
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────
type ChurnLabel = "Baixo" | "Médio" | "Alto";

interface ChurnInput {
    lastGeneratedAt: Date | string | null;
    approvalRate: number | null;
    publishedRate: number | null;
    avgRevisions: number;
}

interface ChurnResult {
    score: number;
    label: ChurnLabel;
    reasons: string[];
}

// ─── Implementação (duplicada do clients.ts para testes isolados) ─────────────
function computeChurnRisk(input: ChurnInput): ChurnResult {
    let score = 0;
    const reasons: string[] = [];

    if (!input.lastGeneratedAt) {
        score++;
        reasons.push("Nenhum calendário gerado ainda");
    } else {
        const daysSince =
            (Date.now() - new Date(input.lastGeneratedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 30) {
            score++;
            reasons.push(`Sem geração há ${Math.floor(daysSince)} dias`);
        }
    }

    if (input.approvalRate !== null && input.approvalRate < 0.5) {
        score++;
        reasons.push(`Taxa de aprovação baixa (${Math.round(input.approvalRate * 100)}%)`);
    }

    if (input.publishedRate !== null && input.publishedRate < 0.3) {
        score++;
        reasons.push(`Taxa de publicação baixa (${Math.round(input.publishedRate * 100)}%)`);
    }

    if (input.avgRevisions > 2) {
        score++;
        reasons.push(`Alta média de revisões (${input.avgRevisions.toFixed(1)})`);
    }

    const label: ChurnLabel = score <= 1 ? "Baixo" : score <= 2 ? "Médio" : "Alto";
    return { score, label, reasons };
}

// ─── Helpers de teste ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
    if (condition) {
        console.log(`  ✅ ${description}`);
        passed++;
    } else {
        console.error(`  ❌ FALHOU: ${description}`);
        failed++;
    }
}

function section(name: string) {
    console.log(`\n📋 ${name}`);
}

// ─── Testes: computeChurnRisk ─────────────────────────────────────────────────
section("computeChurnRisk — score 0 (Baixo)");
{
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 dias atrás
    const result = computeChurnRisk({
        lastGeneratedAt: recent,
        approvalRate: 0.8,
        publishedRate: 0.6,
        avgRevisions: 1.0,
    });
    assert(result.score === 0, "Score deve ser 0");
    assert(result.label === "Baixo", "Label deve ser Baixo");
    assert(result.reasons.length === 0, "Sem reasons");
}

section("computeChurnRisk — score 1 (Baixo)");
{
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const result = computeChurnRisk({
        lastGeneratedAt: recent,
        approvalRate: 0.3, // < 0.5 → +1
        publishedRate: 0.6,
        avgRevisions: 1.0,
    });
    assert(result.score === 1, "Score deve ser 1");
    assert(result.label === "Baixo", "Label deve ser Baixo");
    assert(result.reasons.some(r => r.includes("aprovação")), "Reason deve mencionar aprovação");
}

section("computeChurnRisk — score 2 (Médio)");
{
    const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000); // 45 dias atrás → +1
    const result = computeChurnRisk({
        lastGeneratedAt: old,
        approvalRate: 0.3, // < 0.5 → +1
        publishedRate: 0.6,
        avgRevisions: 1.0,
    });
    assert(result.score === 2, "Score deve ser 2");
    assert(result.label === "Médio", "Label deve ser Médio");
}

section("computeChurnRisk — score 4 (Alto)");
{
    const result = computeChurnRisk({
        lastGeneratedAt: null,          // +1
        approvalRate: 0.2,              // +1
        publishedRate: 0.1,             // +1
        avgRevisions: 3.5,              // +1
    });
    assert(result.score === 4, "Score deve ser 4");
    assert(result.label === "Alto", "Label deve ser Alto");
    assert(result.reasons.length === 4, "Deve ter 4 reasons");
}

section("computeChurnRisk — publishedRate nulo não conta");
{
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const result = computeChurnRisk({
        lastGeneratedAt: recent,
        approvalRate: null, // null não penaliza
        publishedRate: null,
        avgRevisions: 1.0,
    });
    assert(result.score === 0, "Score deve ser 0 com rates nulos");
}

// ─── Testes: cálculo de approval_rate ────────────────────────────────────────
section("approval_rate — cálculo básico");
{
    const total = 20;
    const approved = 14;
    const approvalRate = Math.round((approved / total) * 100) / 100;
    assert(approvalRate === 0.7, `approval_rate correto: ${approvalRate}`);
}

section("approval_rate — 0 itens retorna null");
{
    const total = 0;
    const approvalRate = total > 0 ? 0 / total : null;
    assert(approvalRate === null, "Deve retornar null para 0 itens");
}

// ─── Testes: custo LLM em BRL ────────────────────────────────────────────────
section("custo LLM — cálculo com tokens");
{
    const BRL_PER_PROMPT_TOKEN     = 0.000000435;
    const BRL_PER_COMPLETION_TOKEN = 0.00000174;

    const prompt_tokens     = 5_000;
    const completion_tokens = 2_000;

    const cost = prompt_tokens * BRL_PER_PROMPT_TOKEN + completion_tokens * BRL_PER_COMPLETION_TOKEN;
    const costRounded = Math.round(cost * 100) / 100;

    // 5000 * 0.000000435 = 0.002175 + 2000 * 0.00000174 = 0.00348 → total ≈ 0.0056
    assert(costRounded > 0, "Custo deve ser positivo");
    assert(costRounded < 1, "Custo de 7k tokens deve ser < R$1");
    console.log(`    Custo calculado: R$ ${costRounded}`);
}

// ─── Testes: mapeamento dia do post ──────────────────────────────────────────
section("getDiaFromPost — data DD/MM");
{
    const post = { data: "15/02", tema: "X", formato: "Reels" };
    const day  = parseInt(post.data.split("/")[0] ?? "0", 10);
    assert(day === 15, `Dia extraído correto: ${day}`);
}

section("getDiaFromPost — dia numérico (schema canônico)");
{
    const post: any = { dia: 7, data: "07/02", tema: "Y", formato: "Static" };
    const day = typeof post.dia === "number" ? post.dia : parseInt(post.data.split("/")[0], 10);
    assert(day === 7, `Dia canônico correto: ${day}`);
}

// ─── Resumo ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`📊 Resultado: ${passed} passou, ${failed} falhou`);
if (failed > 0) {
    console.error(`❌ ${failed} teste(s) falharam!`);
    process.exit(1);
} else {
    console.log("✅ Todos os testes passaram!");
    process.exit(0);
}
