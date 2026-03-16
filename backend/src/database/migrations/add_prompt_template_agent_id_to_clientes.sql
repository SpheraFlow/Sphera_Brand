ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS prompt_template_agent_id TEXT;

UPDATE clientes c
SET prompt_template_agent_id = pt.agent_id
FROM prompt_templates pt
WHERE pt.cliente_id = c.id
  AND pt.is_active = true
  AND pt.agent_id IS NOT NULL
  AND c.prompt_template_agent_id IS NULL;
