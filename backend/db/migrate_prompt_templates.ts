/**
 * migrate_prompt_templates.ts
 * Migration idempotente para a tabela `prompt_templates`.
 * Executa: npm run migrate:prompt-templates
 */
import db from "../src/config/database";

const GLOBAL_TEMPLATE_BODY = `Atue como Strategist Planner.
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
    "data": "DD/MM",
    "tema": "string",
    "formato": "Reels|Static|Carousel|Stories",
    "ideia_visual": "string",
    "copy_sugestao": "string",
    "objetivo": "string",
    "image_generation_prompt": "string"
  }
]`;

// Campos obrigatórios que todo template deve mencionar
export const REQUIRED_PLACEHOLDERS = [
    "{{DNA_DA_MARCA}}",
    "{{BRIEFING}}",
    "{{MIX_POSTS}}",
    "{{MES}}",
];

// Campos do contrato canônico de saída que o template deve mencionar
export const OUTPUT_CONTRACT_FIELDS = [
    "data",
    "tema",
    "formato",
    "ideia_visual",
    "copy_sugestao",
    "objetivo",
];

const migratePromptTemplates = async () => {
    const client = await db.connect();

    try {
        console.log("🔄 Iniciando migração: prompt_templates...");
        await client.query("BEGIN");

        // 1. Habilitar extensão se necessário
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        // 2. Criar tabela (idempotente)
        await client.query(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        cliente_id  UUID        REFERENCES clientes(id) ON DELETE CASCADE,
        version     INTEGER     NOT NULL DEFAULT 1,
        label       TEXT        NOT NULL,
        body        TEXT        NOT NULL,
        is_active   BOOLEAN     NOT NULL DEFAULT false,
        created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

        // 3. Garantir índices (idempotente)
        // Garante somente 1 ativo por cliente (NULL = global)
        await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pt_single_active_per_client
        ON prompt_templates (COALESCE(cliente_id::text, 'global'), is_active)
        WHERE is_active = true;
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pt_cliente_id
        ON prompt_templates (cliente_id);
    `);

        // 4. Trigger para updated_at automático
        await client.query(`
      CREATE OR REPLACE FUNCTION update_prompt_templates_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
        const triggerCheck = await client.query(`
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pt_updated_at'
    `);
        if ((triggerCheck.rowCount ?? 0) === 0) {
            await client.query(`
        CREATE TRIGGER trg_pt_updated_at
        BEFORE UPDATE ON prompt_templates
        FOR EACH ROW
        EXECUTE FUNCTION update_prompt_templates_updated_at();
      `);
        }

        // 5. Seed do template global padrão (se não existir nenhum global)
        const existing = await client.query(
            `SELECT id FROM prompt_templates WHERE cliente_id IS NULL LIMIT 1`
        );
        if ((existing.rowCount ?? 0) === 0) {
            console.log("📝 Inserindo template global padrão...");
            await client.query(
                `INSERT INTO prompt_templates (cliente_id, version, label, body, is_active)
         VALUES (NULL, 1, 'v1 - Template Global Padrão', $1, true)`,
                [GLOBAL_TEMPLATE_BODY]
            );
        } else {
            console.log("✅ Template global já existe, pulando seed.");
        }

        await client.query("COMMIT");
        console.log("✅ Migration prompt_templates concluída com sucesso!");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Erro na migration prompt_templates:", error);
        process.exit(1);
    } finally {
        client.release();
        await db.end();
    }
};

migratePromptTemplates();
