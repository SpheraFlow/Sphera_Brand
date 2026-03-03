/**
 * migrate_prompt_templates_v2.ts
 * PR4: Corrige índices NULL-safe + atualiza seed para contrato canônico.
 *
 * Executa: npm run migrate:prompt-templates-v2
 *
 * O que faz (idempotente em toda operação):
 *   1. Dropa o índice antigo idx_pt_single_active_per_client (COALESCE-based)
 *   2. Cria dois índices separados NULL-safe:
 *      - idx_pt_one_active_per_client  (WHERE cliente_id IS NOT NULL AND is_active = true)
 *      - idx_pt_one_active_global      (WHERE cliente_id IS NULL     AND is_active = true)
 *   3. Corrige eventual inconsistência de estado (múltiplos ativos no mesmo escopo):
 *      mantém somente o mais recente ativo e desativa os demais (por cliente + global).
 *   4. Atualiza o template global com o contrato canônico de output se o body
 *      ainda estiver com contrato antigo (detectado por "copy_sugestao" no body).
 */
import db from "../src/config/database";

// ─── Contrato canônico (PR4) ──────────────────────────────────────────────────
export const CANONICAL_OUTPUT_CONTRACT_FIELDS = [
    "\"dia\"",
    "\"tema\"",
    "\"formato\"",
    "\"instrucoes_visuais\"",
    "\"copy_inicial\"",
    "\"objetivo\"",
    "\"cta\"",
    "\"palavras_chave\"",
];

export const CANONICAL_GLOBAL_TEMPLATE_BODY = `Atue como Strategist Planner de marketing digital.
Crie um Planejamento de Conteúdo contendo EXATAMENTE esta quantidade de posts:
{{MIX_POSTS}}

Mês: {{MES}}. Data Ref: {{DATA_HOJE}}.

DNA DA MARCA:
{{DNA_DA_MARCA}}

DATAS COMEMORATIVAS:
{{DATAS_COMEMORATIVAS}}

REGRAS OBRIGATÓRIAS:
{{REGRAS_OBRIGATORIAS}}

BRIEFING: "{{BRIEFING}}"

REFERÊNCIAS DO MÊS: {{REFERENCIAS_MES}}
CONTINUIDADE: {{CONTINUIDADE}}
DOCS EXTRAS: {{DOCS_EXTRAS}}

INSTRUÇÕES AVANÇADAS:
{{INSTRUCOES_AVANCADAS}}

INSTRUÇÕES POR FORMATO:
{{INSTRUCOES_POR_FORMATO}}

Retorne SOMENTE um JSON ARRAY PURO (sem markdown, sem texto antes ou depois):
[
  {
    "dia": 1,
    "tema": "string — tema central do post",
    "formato": "Reels|Static|Carousel|Stories",
    "instrucoes_visuais": "string — descrição visual detalhada",
    "copy_inicial": "string — texto de abertura do post",
    "objetivo": "string — objetivo de marketing (ex: engajamento, awareness)",
    "cta": "string — chamada para ação",
    "palavras_chave": ["string", "string"]
  }
]`;

// ─── Campos legados (contrato antigo) — usados para detectar seeds desatualizados
const LEGACY_FIELD_MARKER = "copy_sugestao";

const migrate = async () => {
    const client = await db.connect();
    try {
        console.log("🔄 PR4 — Iniciando migrate_prompt_templates_v2...");
        await client.query("BEGIN");

        // ── 1. Dropar índice antigo (COALESCE-based) se existir ──────────────────
        console.log("🔧 Dropando índice antigo se existir...");
        await client.query(`
      DROP INDEX IF EXISTS idx_pt_single_active_per_client;
    `);

        // ── 2. Criar índice NULL-safe para cliente (NOT NULL) ─────────────────────
        console.log("📌 Criando índice NULL-safe para clientes...");
        await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pt_one_active_per_client
        ON prompt_templates (cliente_id)
        WHERE cliente_id IS NOT NULL AND is_active = true;
    `);

        // ── 3. Criar índice NULL-safe para global (IS NULL) ───────────────────────
        console.log("📌 Criando índice NULL-safe para template global...");
        await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pt_one_active_global
        ON prompt_templates ((cliente_id IS NULL))
        WHERE cliente_id IS NULL AND is_active = true;
    `);

        // ── 4. Corrigir estado inconsistente: múltiplos ativos no mesmo escopo ────
        // Para cada cliente, mantém ativo apenas o mais recente (maior updated_at / id)
        console.log("🔍 Verificando e corrigindo múltiplos templates ativos por cliente...");

        // 4a. Clientes com mais de 1 ativo
        const multiActiveClients = await client.query(`
      SELECT cliente_id, COUNT(*) as cnt
      FROM prompt_templates
      WHERE cliente_id IS NOT NULL AND is_active = true
      GROUP BY cliente_id
      HAVING COUNT(*) > 1
    `);

        for (const row of multiActiveClients.rows) {
            // Mantém o mais recente ativo, desativa os demais
            await client.query(`
        UPDATE prompt_templates
        SET is_active = false, updated_at = NOW()
        WHERE cliente_id = $1
          AND is_active = true
          AND id <> (
            SELECT id FROM prompt_templates
            WHERE cliente_id = $1 AND is_active = true
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
          )
      `, [row.cliente_id]);
            console.log(`  ↳ Corrigido: cliente ${row.cliente_id} tinha ${row.cnt} ativos → manteve 1.`);
        }

        // 4b. Global com mais de 1 ativo
        const multiActiveGlobal = await client.query(`
      SELECT COUNT(*) as cnt FROM prompt_templates
      WHERE cliente_id IS NULL AND is_active = true
    `);

        if (parseInt(multiActiveGlobal.rows[0].cnt) > 1) {
            await client.query(`
        UPDATE prompt_templates
        SET is_active = false, updated_at = NOW()
        WHERE cliente_id IS NULL
          AND is_active = true
          AND id <> (
            SELECT id FROM prompt_templates
            WHERE cliente_id IS NULL AND is_active = true
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
          )
      `);
            console.log(`  ↳ Corrigido: template global tinha ${multiActiveGlobal.rows[0].cnt} ativos → manteve 1.`);
        }

        // ── 5. Atualizar seed global para contrato canônico (se ainda no contrato antigo) ──
        const legacyGlobal = await client.query(`
      SELECT id FROM prompt_templates
      WHERE cliente_id IS NULL AND body LIKE $1
      LIMIT 1
    `, [`%${LEGACY_FIELD_MARKER}%`]);

        if ((legacyGlobal.rowCount ?? 0) > 0) {
            console.log("🔄 Template global com contrato antigo detectado — atualizando para contrato canônico...");
            await client.query(`
        UPDATE prompt_templates
        SET body = $1, label = 'v1 - Template Global (Contrato Canônico)', updated_at = NOW()
        WHERE id = $2
      `, [CANONICAL_GLOBAL_TEMPLATE_BODY, legacyGlobal.rows[0].id]);
        } else if ((await client.query(`SELECT id FROM prompt_templates WHERE cliente_id IS NULL LIMIT 1`)).rowCount === 0) {
            // Sem nenhum global, inserir
            console.log("📝 Inserindo template global com contrato canônico...");
            await client.query(`
        INSERT INTO prompt_templates (cliente_id, version, label, body, is_active)
        VALUES (NULL, 1, 'v1 - Template Global (Contrato Canônico)', $1, true)
      `, [CANONICAL_GLOBAL_TEMPLATE_BODY]);
        } else {
            console.log("✅ Template global já está no contrato canônico, sem alterações.");
        }

        await client.query("COMMIT");
        console.log("✅ migrate_prompt_templates_v2 concluída!");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Erro em migrate_prompt_templates_v2:", error);
        process.exit(1);
    } finally {
        client.release();
        await db.end();
    }
};

migrate();
