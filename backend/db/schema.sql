-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Dropar tabelas existentes (ordem inversa por causa das FKs)
DROP TABLE IF EXISTS generated_ideas CASCADE;
DROP TABLE IF EXISTS client_prompts CASCADE;
DROP TABLE IF EXISTS brand_rules CASCADE;
DROP TABLE IF EXISTS brand_docs CASCADE;
DROP TABLE IF EXISTS calendarios CASCADE;
DROP TABLE IF EXISTS branding CASCADE;
DROP TABLE IF EXISTS posts_processados CASCADE;
DROP TABLE IF EXISTS posts_originais CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;

-- Tabela de clientes
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  persona_atualizada TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Tabela de posts
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  titulo TEXT,
  descricao TEXT,
  arquivo TEXT,
  criado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Tabela de posts originais (vindo do n8n/webhook)
CREATE TABLE posts_originais (
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
CREATE TABLE posts_processados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  metadata JSONB,
  status TEXT,
  processado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- Tabela de branding intelligence
CREATE TABLE branding (
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

-- Tabela de calendários editoriais
CREATE TABLE calendarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  periodo INTEGER,
  briefing TEXT,
  mes TEXT,
  calendario_json JSONB,
  dias JSONB,  -- Opcional: usado para formato legado
  metadata JSONB,
  criado_em TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente_calendario FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- NOVAS TABELAS (Gestão de Conhecimento)

-- Tabela de documentos da marca
CREATE TABLE brand_docs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  conteudo_texto TEXT,
  criado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente_docs FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Tabela de regras da marca
CREATE TABLE brand_rules (
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
CREATE TABLE client_prompts (
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
CREATE TABLE generated_ideas (
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

-- Comentários
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
