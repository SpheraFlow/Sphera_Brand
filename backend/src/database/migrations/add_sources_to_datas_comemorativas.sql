ALTER TABLE datas_comemorativas ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual';
ALTER TABLE datas_comemorativas ADD COLUMN IF NOT EXISTS fontes JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_datas_comemorativas_origem ON datas_comemorativas(origem);
CREATE INDEX IF NOT EXISTS idx_datas_comemorativas_fontes ON datas_comemorativas USING GIN (fontes);
