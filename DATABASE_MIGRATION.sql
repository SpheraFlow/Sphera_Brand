-- 🐘 Script de Migração de Banco de Dados
-- Execute este script no PostgreSQL da VPS após criar o banco de dados

-- 1. Criar banco de dados (execute como postgres)
-- CREATE DATABASE mvp_system;
-- CREATE USER deploy WITH PASSWORD 'SENHA_FORTE';
-- GRANT ALL PRIVILEGES ON DATABASE mvp_system TO deploy;

-- 2. Conectar ao banco e executar schema completo
-- psql -h localhost -U deploy -d mvp_system

-- Schema principal
\i db/schema.sql

-- Migrações adicionais
\i backend/src/database/migrations/add_token_usage_to_clients.sql
\i backend/src/database/migrations/create_prompt_chains.sql
\i backend/src/database/migrations/create_presentations_table.sql

-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verificar estrutura da tabela clientes (deve incluir token_usage)
\d clientes;

-- Verificar dados iniciais
SELECT COUNT(*) as total_clientes FROM clientes;
SELECT COUNT(*) as total_calendarios FROM calendarios;
SELECT COUNT(*) as total_branding FROM branding;

-- Se precisar importar dados do desenvolvimento:
-- 1. Export do desenvolvimento:
-- pg_dump -h localhost -U postgres mvp_system > backup_desenvolvimento.sql
-- 
-- 2. Import na produção:
-- psql -h localhost -U deploy -d mvp_system < backup_desenvolvimento.sql
