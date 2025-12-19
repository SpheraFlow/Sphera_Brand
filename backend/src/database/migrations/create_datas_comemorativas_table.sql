-- Criar tabela de datas comemorativas e relevantes (com categorias) para uso na geração de calendários

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS datas_comemorativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  titulo TEXT NOT NULL,
  categorias JSONB DEFAULT '[]'::jsonb,
  descricao TEXT,
  relevancia INT DEFAULT 0,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS datas_comemorativas_unique ON datas_comemorativas (data, titulo);
CREATE INDEX IF NOT EXISTS datas_comemorativas_data_idx ON datas_comemorativas (data);
CREATE INDEX IF NOT EXISTS datas_comemorativas_relevancia_idx ON datas_comemorativas (relevancia);

-- Seed mínimo (pode ser expandido)
-- Categorias sugeridas: ["geral"], ["saude"], ["fitness"], ["bem-estar"], ["psicologia"], etc

INSERT INTO datas_comemorativas (data, titulo, categorias, relevancia) VALUES
  ('2026-01-01', 'Confraternização Universal', '["geral"]', 10),
  ('2026-01-20', 'Dia do Farmacêutico', '["saude"]', 4),
  ('2026-01-30', 'Dia da Saudade', '["geral"]', 3),

  ('2026-02-04', 'Dia Mundial do Câncer', '["saude"]', 8),
  ('2026-02-14', 'Valentine''s Day', '["geral"]', 4),

  ('2026-03-08', 'Dia Internacional da Mulher', '["geral"]', 9),
  ('2026-03-20', 'Início do Outono', '["geral"]', 5),

  ('2026-04-07', 'Dia Mundial da Saúde', '["saude","fitness"]', 10),
  ('2026-04-22', 'Dia da Terra', '["geral"]', 4),

  ('2026-05-01', 'Dia do Trabalho', '["geral"]', 7),
  ('2026-05-10', 'Dia das Mães', '["geral"]', 7),

  ('2026-06-12', 'Dia dos Namorados', '["geral"]', 8),
  ('2026-06-21', 'Início do Inverno', '["geral"]', 5),

  ('2026-07-20', 'Dia do Amigo', '["geral"]', 5),
  ('2026-07-26', 'Dia dos Avós', '["geral"]', 4),

  ('2026-08-09', 'Dia dos Pais', '["geral"]', 7),
  ('2026-08-27', 'Dia do Psicólogo', '["psicologia","bem-estar"]', 6),

  ('2026-09-07', 'Independência do Brasil', '["geral"]', 7),
  ('2026-09-23', 'Início da Primavera', '["geral"]', 5),

  ('2026-10-12', 'Dia das Crianças', '["geral"]', 7),
  ('2026-10-10', 'Dia Mundial da Saúde Mental', '["bem-estar","psicologia","saude"]', 8),

  ('2026-11-02', 'Finados', '["geral"]', 5),
  ('2026-11-15', 'Proclamação da República', '["geral"]', 5),

  ('2026-12-24', 'Véspera de Natal', '["geral"]', 6),
  ('2026-12-25', 'Natal', '["geral"]', 10),
  ('2026-12-31', 'Réveillon', '["geral"]', 8)
ON CONFLICT DO NOTHING;
