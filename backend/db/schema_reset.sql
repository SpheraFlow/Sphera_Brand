-- ⚠️  ATENÇÃO: ESTE SCRIPT É DESTRUTIVO!
-- Apaga TODOS os dados do banco e recria as tabelas. Use apenas em ambiente de DEV local.
-- Em produção NUNCA execute este arquivo.

DROP TABLE IF EXISTS generated_ideas CASCADE;
DROP TABLE IF EXISTS client_prompts CASCADE;
DROP TABLE IF EXISTS brand_rules CASCADE;
DROP TABLE IF EXISTS brand_docs CASCADE;
DROP TABLE IF EXISTS calendarios CASCADE;
DROP TABLE IF EXISTS branding CASCADE;
DROP TABLE IF EXISTS posts_processados CASCADE;
DROP TABLE IF EXISTS posts_originais CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS user_clientes CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Depois de rodar este arquivo, execute: npm run migrate
