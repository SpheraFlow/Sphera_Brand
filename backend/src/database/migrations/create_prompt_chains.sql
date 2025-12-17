CREATE TABLE IF NOT EXISTS prompt_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  is_global BOOLEAN DEFAULT false,
  steps JSONB DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_prompt_chains_client_id ON prompt_chains(client_id);
CREATE INDEX IF NOT EXISTS idx_prompt_chains_is_global ON prompt_chains(is_global);
