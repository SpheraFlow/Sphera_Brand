-- Criação da tabela de posts
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  cliente_id VARCHAR(255) NOT NULL,
  titulo VARCHAR(255),
  descricao TEXT,
  arquivo_path VARCHAR(500),
  arquivo_nome VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pendente',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX idx_posts_cliente_id ON posts(cliente_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- Comentários
COMMENT ON TABLE posts IS 'Tabela de posts dos clientes';
COMMENT ON COLUMN posts.cliente_id IS 'ID do cliente que criou o post';
COMMENT ON COLUMN posts.status IS 'Status do post: pendente, processado, erro, etc';
COMMENT ON COLUMN posts.metadata IS 'Dados adicionais em JSON';

