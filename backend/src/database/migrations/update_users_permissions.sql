-- Migração: Adicionar suporte granular a permissões via JSONB na tabela users.

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"dashboard_view": false, "clients_manage": false, "team_manage": false, "content_generate": true, "content_approve": false}'::jsonb;

-- Garantir que todo Admin atual vire um dono completo do sistema
UPDATE users 
SET permissions = '{"dashboard_view": true, "clients_manage": true, "team_manage": true, "content_generate": true, "content_approve": true}'::jsonb 
WHERE role = 'admin';

-- Ajuste para os atendentes (caso queira garantir)
UPDATE users 
SET permissions = '{"dashboard_view": false, "clients_manage": false, "team_manage": false, "content_generate": true, "content_approve": false}'::jsonb
WHERE role = 'atendente' AND permissions IS NULL;
