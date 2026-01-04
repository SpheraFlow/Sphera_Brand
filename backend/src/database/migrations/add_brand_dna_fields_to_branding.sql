-- Adicionar colunas do Brand DNA 2.0 na tabela branding
ALTER TABLE branding ADD COLUMN IF NOT EXISTS archetype TEXT;
ALTER TABLE branding ADD COLUMN IF NOT EXISTS usp TEXT;
ALTER TABLE branding ADD COLUMN IF NOT EXISTS anti_keywords TEXT[];
ALTER TABLE branding ADD COLUMN IF NOT EXISTS niche TEXT;

-- Comentários para documentação
COMMENT ON COLUMN branding.archetype IS 'Arquétipo principal da marca (ex: O Criador, O Herói)';
COMMENT ON COLUMN branding.usp IS 'Unique Selling Proposition - Diferencial único';
COMMENT ON COLUMN branding.anti_keywords IS 'Palavras proibidas ou que a marca evita';
COMMENT ON COLUMN branding.niche IS 'Nicho de mercado específico';
