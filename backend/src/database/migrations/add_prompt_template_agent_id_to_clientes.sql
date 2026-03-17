ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS prompt_template_agent_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'prompt_templates'
      AND column_name = 'agent_id'
  ) THEN
    UPDATE clientes c
    SET prompt_template_agent_id = pt.agent_id
    FROM prompt_templates pt
    WHERE pt.cliente_id = c.id
      AND pt.is_active = true
      AND pt.agent_id IS NOT NULL
      AND c.prompt_template_agent_id IS NULL;
  END IF;
END $$;
