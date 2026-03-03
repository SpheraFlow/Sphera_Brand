-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ⚠️  ATENÇÃO: DROP TABLE removido intencionalmente.
-- Para resetar COMPLETAMENTE o banco execute schema_reset.sql (DESTRUTIVO).
-- Este arquivo é seguro e idempotente (IF NOT EXISTS em todas as tabelas).

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'atendente' CHECK (role IN ('admin', 'atendente')),
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMP DEFAULT NOW()
);

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome               TEXT NOT NULL,
  persona_atualizada TEXT,
  categorias_nicho   JSONB DEFAULT '[]'::jsonb,
  logo_url           TEXT,
  clickup_list_id    TEXT,
  criado_em          TIMESTAMP DEFAULT NOW()
);

-- Relação usuário <-> cliente (atendentes)
CREATE TABLE IF NOT EXISTS user_clientes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, cliente_id)
);

-- Tabela de posts
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  titulo TEXT,
  descricao TEXT,
  arquivo TEXT,
  criado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Tabela de posts originais (vindo do n8n/webhook)
CREATE TABLE IF NOT EXISTS posts_originais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  imagem_path TEXT NOT NULL,
  legenda TEXT,
  data_post TIMESTAMP,
  id_externo TEXT,
  importado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente_post_original FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Tabela de posts processados
CREATE TABLE IF NOT EXISTS posts_processados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  metadata JSONB,
  status TEXT,
  processado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- Tabela de branding intelligence
CREATE TABLE IF NOT EXISTS branding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  visual_style JSONB,
  tone_of_voice JSONB,
  audience JSONB,
  keywords TEXT[],
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente_branding FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  CONSTRAINT unique_cliente_branding UNIQUE (cliente_id)
);

 -- Migration para gerenciar usuários e auth
\i 'src/database/migrations/create_users_table.sql'

-- Migration para Update the users Table JSONB permissions
\i 'src/database/migrations/update_users_permissions.sql'

-- Migration para atualizar jobs de calendário
\i 'src/database/migrations/update_calendar_jobs.sql'

-- Tabela de jobs de geração de calendário (criada antes de calendarios por conta da FK)
CREATE TABLE IF NOT EXISTS calendar_generation_jobs (
  id UUID PRIMARY KEY,
  cliente_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'canceled')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  result_calendar_ids UUID[],
  error JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_cliente_job FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Tabela de calendários editoriais
CREATE TABLE IF NOT EXISTS calendarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  periodo INTEGER,
  briefing TEXT,
  mes TEXT,
  calendario_json JSONB,
  dias JSONB,  -- Opcional: usado para formato legado
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'published',
  generation_job_id UUID REFERENCES calendar_generation_jobs(id) ON DELETE SET NULL,
  criado_em TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente_calendario FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Itens individuais de calendário (tracking de aprovação, revisões, publicação)
CREATE TABLE IF NOT EXISTS calendar_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id         UUID NOT NULL,
  calendario_id      UUID NOT NULL,
  dia                INTEGER NOT NULL,
  tema               TEXT NOT NULL DEFAULT '',
  formato            TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'approved', 'needs_edit', 'redo', 'published')),
  revisions_count    INTEGER NOT NULL DEFAULT 0,
  first_generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at        TIMESTAMPTZ,
  published_at       TIMESTAMPTZ,
  last_updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by         UUID,
  notes              TEXT,
  CONSTRAINT fk_ci_cliente    FOREIGN KEY (cliente_id)    REFERENCES clientes(id)    ON DELETE CASCADE,
  CONSTRAINT fk_ci_calendario FOREIGN KEY (calendario_id) REFERENCES calendarios(id) ON DELETE CASCADE
);

-- NOVAS TABELAS (Gestão de Conhecimento)

-- Tabela de documentos da marca
CREATE TABLE IF NOT EXISTS brand_docs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  conteudo_texto TEXT,
  criado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente_docs FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Tabela de regras da marca
CREATE TABLE IF NOT EXISTS brand_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  regra TEXT NOT NULL,
  categoria TEXT,
  ativa BOOLEAN DEFAULT TRUE,
  origem TEXT DEFAULT 'manual', -- 'manual' ou 'ia'
  criado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente_rules FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Tabela de biblioteca de prompts
CREATE TABLE IF NOT EXISTS client_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  conteudo_prompt TEXT NOT NULL,
  categoria TEXT,
  uso_frequente BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente_prompts FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Tabela de histórico de gerações
CREATE TABLE IF NOT EXISTS generated_ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  input_original TEXT,
  output_ia JSONB,
  criado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente_ideas FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_posts_cliente_id ON posts(cliente_id);
CREATE INDEX IF NOT EXISTS idx_posts_criado_em ON posts(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_posts_originais_cliente_id ON posts_originais(cliente_id);
CREATE INDEX IF NOT EXISTS idx_posts_originais_id_externo ON posts_originais(id_externo);
CREATE INDEX IF NOT EXISTS idx_posts_originais_data_post ON posts_originais(data_post DESC);
CREATE INDEX IF NOT EXISTS idx_posts_processados_post_id ON posts_processados(post_id);
CREATE INDEX IF NOT EXISTS idx_posts_processados_status ON posts_processados(status);
CREATE INDEX IF NOT EXISTS idx_posts_processados_processado_em ON posts_processados(processado_em DESC);
CREATE INDEX IF NOT EXISTS idx_branding_cliente_id ON branding(cliente_id);
CREATE INDEX IF NOT EXISTS idx_branding_updated_at ON branding(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendarios_cliente_id ON calendarios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_calendarios_criado_em ON calendarios(criado_em DESC);

-- Índices novos
CREATE INDEX IF NOT EXISTS idx_brand_docs_cliente_id ON brand_docs(cliente_id);
CREATE INDEX IF NOT EXISTS idx_brand_rules_cliente_id ON brand_rules(cliente_id);
CREATE INDEX IF NOT EXISTS idx_client_prompts_cliente_id ON client_prompts(cliente_id);
CREATE INDEX IF NOT EXISTS idx_generated_ideas_cliente_id ON generated_ideas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_user_clientes_user ON user_clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clientes_cliente ON user_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_calendar_items_calendario ON calendar_items(calendario_id);
CREATE INDEX IF NOT EXISTS idx_calendar_items_cliente_status ON calendar_items(cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_calendar_items_cliente_generated ON calendar_items(cliente_id, first_generated_at DESC);

-- Comentários
COMMENT ON TABLE users IS 'Tabela de usuários do sistema (admin/atendente)';
COMMENT ON TABLE user_clientes IS 'Vínculo de atendentes a clientes específicos';
COMMENT ON TABLE clientes IS 'Tabela de clientes do sistema';
COMMENT ON TABLE posts IS 'Tabela de posts dos clientes';
COMMENT ON TABLE posts_originais IS 'Tabela de posts importados via webhook (n8n)';
COMMENT ON TABLE posts_processados IS 'Tabela de posts processados com metadata';
COMMENT ON TABLE branding IS 'Tabela de DNA de branding dos clientes - insights consolidados';
COMMENT ON TABLE calendarios IS 'Tabela de calendários editoriais gerados';
COMMENT ON TABLE brand_docs IS 'Documentos de referência da marca';
COMMENT ON TABLE brand_rules IS 'Regras e diretrizes da marca';
COMMENT ON TABLE client_prompts IS 'Biblioteca de prompts personalizados';
COMMENT ON TABLE generated_ideas IS 'Histórico de gerações e ideias';
