-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'atendente' CHECK (role IN ('admin', 'atendente')),
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMP DEFAULT NOW()
);

-- Relação many-to-many entre usuário e cliente
CREATE TABLE IF NOT EXISTS user_clientes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_user_clientes_user ON user_clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clientes_cliente ON user_clientes(cliente_id);

COMMENT ON TABLE users IS 'Tabela de usuários do sistema (admin/atendente)';
COMMENT ON TABLE user_clientes IS 'Vínculo de atendentes a clientes específicos';
