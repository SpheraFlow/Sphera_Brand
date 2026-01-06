-- Adicionar coluna 'origem' para rastrear a fonte das datas comemorativas
-- Exemplos: 'calendario_2026', 'brasilapi', 'manual', etc.

ALTER TABLE datas_comemorativas 
ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual';

-- Criar índice para facilitar consultas por origem
CREATE INDEX IF NOT EXISTS datas_comemorativas_origem_idx ON datas_comemorativas (origem);

-- Atualizar registros existentes sem origem definida
UPDATE datas_comemorativas 
SET origem = 'seed_inicial' 
WHERE origem IS NULL OR origem = 'manual';
