CREATE TABLE IF NOT EXISTS presentations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL DEFAULT 'Apresentação Gerada',
    arquivos JSONB NOT NULL, -- Array com caminhos das imagens: ["/storage/...", "..."]
    dados_json JSONB, -- O JSON usado para gerar (para poder regenerar/editar depois)
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index para buscar rápido por cliente
CREATE INDEX IF NOT EXISTS idx_presentations_cliente ON presentations(cliente_id);
