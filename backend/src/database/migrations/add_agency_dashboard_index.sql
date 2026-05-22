-- STORY-011 — Dashboard Operacional para Dono de Agência
-- Índice de performance para a query agregada de /api/agency/dashboard.
-- A query filtra calendar_items por janela de mês (first_generated_at) e
-- agrupa por cliente_id contando por status. Este índice composto cobre
-- tanto o filtro de janela quanto a agregação por status.
-- SLA alvo: < 2s para agências com até 15 clientes e ~500 calendar_items.

CREATE INDEX IF NOT EXISTS idx_calendar_items_client_month
  ON calendar_items (cliente_id, first_generated_at, status);

-- Índice para a CTE last_approved (último post approved/published por cliente).
CREATE INDEX IF NOT EXISTS idx_calendar_items_status_updated
  ON calendar_items (cliente_id, status, last_updated_at);
