CREATE TABLE IF NOT EXISTS branding_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  branding_id UUID,
  snapshot JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_branding_versions_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_branding_versions_branding FOREIGN KEY (branding_id) REFERENCES branding(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_branding_versions_cliente_id ON branding_versions(cliente_id);
CREATE INDEX IF NOT EXISTS idx_branding_versions_created_at ON branding_versions(created_at DESC);
