CREATE TABLE IF NOT EXISTS prompt_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,  -- NULL = template global/padrão
  version    INTEGER NOT NULL,
  label      TEXT NOT NULL,
  body       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT false,
  agent_id   TEXT DEFAULT 'estrategista',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Garante apenas uma versão ativa por cliente (ou uma global ativa quando cliente_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_templates_single_active_per_scope
  ON prompt_templates (cliente_id, agent_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_prompt_templates_cliente_id
  ON prompt_templates (cliente_id);

-- Template global padrão (cliente_id = NULL), usado como fallback para clientes sem template próprio
INSERT INTO prompt_templates (cliente_id, version, label, body, is_active, agent_id) VALUES (
  NULL, 1, 'v1 - Template Padrão',
  'Atue como Strategist Planner.
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

Retorne JSON ARRAY PURO (sem markdown):
[{ "data": "DD/MM", "tema": "...", "formato": "...", "ideia_visual": "...", "copy_sugestao": "...", "objetivo": "...", "image_generation_prompt": "..." }]',
  true,
  'estrategista'
)
ON CONFLICT DO NOTHING;
