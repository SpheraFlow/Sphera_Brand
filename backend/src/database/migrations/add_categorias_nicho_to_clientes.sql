ALTER TABLE clientes ADD COLUMN IF NOT EXISTS categorias_nicho JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_clientes_categorias_nicho ON clientes USING GIN (categorias_nicho);
