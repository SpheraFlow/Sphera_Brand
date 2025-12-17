-- Adicionar coluna para rastrear uso de tokens por cliente
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS token_usage JSONB DEFAULT '{
  "total_tokens": 0,
  "prompt_tokens": 0,
  "completion_tokens": 0,
  "last_updated": null,
  "history": []
}'::jsonb;

-- Criar índice para melhor performance em consultas
CREATE INDEX IF NOT EXISTS idx_clientes_token_usage ON clientes USING GIN (token_usage);

-- Comentário explicativo
COMMENT ON COLUMN clientes.token_usage IS 'Rastreamento de uso de tokens da API Gemini por cliente. Inclui total, prompt, completion tokens e histórico de uso.';
