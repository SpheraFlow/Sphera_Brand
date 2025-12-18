-- Adicionar coluna updated_at na tabela calendarios
ALTER TABLE calendarios
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
