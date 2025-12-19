-- Adicionar coluna logo_url na tabela clientes para persistir a URL da logo
-- Isso serve como fallback para o localStorage e permite sincronização entre dispositivos

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Criar índice para melhorar performance em queries que filtram por logo
CREATE INDEX IF NOT EXISTS idx_clientes_logo_url ON clientes(logo_url) WHERE logo_url IS NOT NULL;

-- Comentário na coluna para documentação
COMMENT ON COLUMN clientes.logo_url IS 'URL relativa da logo do cliente (ex: /static/client-logos/logo-123.png)';
