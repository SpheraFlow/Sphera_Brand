ALTER TABLE prompt_templates
ADD COLUMN IF NOT EXISTS agent_id TEXT;

UPDATE prompt_templates
SET agent_id = CASE
  WHEN cliente_id IS NULL THEN 'estrategista'
  WHEN label ILIKE '%estrategista%' THEN 'estrategista'
  WHEN label ILIKE '%contador%' OR label ILIKE '%historia%' THEN 'storyteller'
  WHEN label ILIKE '%visionario%' THEN 'visionario'
  ELSE 'custom'
END
WHERE agent_id IS NULL;

DROP INDEX IF EXISTS idx_prompt_templates_single_active_per_client;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_templates_single_active_per_scope
  ON prompt_templates (cliente_id, agent_id, is_active)
  WHERE is_active = true;
