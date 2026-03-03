# RAG_SPHERA_BRAND_MVP.md

# 0. TL;DR (Visão em 60 segundos)
- **O que é**: O MVP Sphera Brand é um sistema de gestão de conteúdo e branding que utiliza IA (Google Gemini) para automatizar a criação de calendários editoriais estratégicos para agências de social media.
- **Para quem**: Agências e gestores de conteúdo que precisam escalar a criação de estratégias personalizadas para múltiplos clientes.
- **O que faz hoje**:
  - Extração de DNA de marca a partir de posts e documentos.
  - Geração de calendários editoriais (30-90 dias) com temas, copies, formatos e sugestões visuais.
  - Mix de conteúdo inteligente (Reels, Estáticos, Carrosséis).
  - Integração com Google Trends e Datas Comemorativas (Nicho).
  - Webhooks para ingestão automática de posts via n8n.
  - Exportação de calendários para Excel.
- **Principais Módulos**:
  - `backend`: API Node.js/TypeScript com integração Gemini e workers de job.
  - `frontend`: Dashboard React/Vite para gestão de clientes e calendários.
  - `python_gen`: Scripts auxiliares para exportação e integração com Trends.
  - `database`: PostgreSQL para persistência de DNA, calendários e configurações.

# 1. Glossário rápido
- **Cliente**: Entidade principal que isola os dados (Multitenancy). Cada cliente possui seu próprio DNA e calendários.
- **DNA / Branding**: Conjunto de dados (visual, tom de voz, persona) que define a marca. É construído incrementalmente.
- **Calendário Editorial**: Array de posts planejados para um período específico, gerado pela IA.
- **Job**: Processo assíncrono para tarefas pesadas, como geração de calendários longos.
- **Prompt Chain**: Sequência de instruções enviadas à IA onde o resultado de um passo alimenta o próximo.
- **Nicho / Categoria**: Segmento de mercado do cliente usado para filtrar datas comemorativas e tendências.

# 2. Arquitetura geral
- **Diagrama Textual**:
  `Frontend (React) <-> Backend API (Express) <-> Banco de Dados (PostgreSQL)`
  `Backend API <-> Google Gemini (IA)`
  `Backend API <-> Python Helpers (Excel/Trends)`
  `n8n Webhook -> Backend API`
- **Frontend**: 
  - Stack: React 18, Vite 5, Tailwind CSS, Axios.
  - Organização: Páginas em `frontend/src/pages/`, componentes reutilizáveis em `frontend/src/components/`, serviços de API em `frontend/src/services/api.ts`.
- **Backend**:
  - Stack: Node.js 18+, Express 5, TypeScript 5, node-postgres.
  - Organização: Rotas modulares em `backend/src/routes/`, lógica de IA em `backend/src/utils/geminiClient.ts` e serviços/utils.
- **Banco de Dados**: 
  - PostgreSQL 15+. Acesso via queries SQL diretas usando o pool do `pg`. O sistema utiliza UUIDs para IDs e JSONB para campos flexíveis (estilos, calendários).
- **Integrações Externas**:
  - **Google Gemini API**: Motor de IA para análise e geração.
  - **n8n**: Recebe posts de redes sociais e envia para o backend via webhook (`/api/webhooks/ingest-posts`).
  - **Google Trends**: (via script Python) busca tendências em tempo real para enriquecer o contexto dos calendários.

# 3. Mapa do repositório
- **Pastas Principais**:
  - `backend/`: Código fonte do servidor, migrações e configurações.
  - `frontend/`: Código fonte da interface do usuário.
  - `python_gen/`: Scripts Python para exportação Excel e Google Trends.
  - `storage/`: Uploads de arquivos (branding, logos, apresentações).
  - `docs/`: Documentação técnica e de deploy.
- **Arquivos-Chave**:
  - `backend/src/index.ts`: Entrypoint do servidor, define rotas e inicia workers.
  - `frontend/src/main.tsx`: Entrypoint do React.
  - `backend/src/config/database.ts`: Configuração do pool PostgreSQL.
  - `backend/db/schema.sql`: Definição original das tabelas.
  - `CLAUDE.md`: Guia rápido de comandos e regras do projeto.

# 4. Como rodar local (passo a passo)
- **Pré-requisitos**: Node.js 18+, PostgreSQL (Docker ou Local), Python 3.9+.
- **Instalação**:
  1. Root: `npm install`
  2. Backend: `cd backend && npm install`
  3. Frontend: `cd frontend && npm install`
- **Comandos**:
  - Ambiente Simultâneo: `npm run dev` (no root).
  - Só Backend: `npm run dev:backend` (no root) ou `cd backend && npm run dev`.
  - Só Frontend: `npm run dev:frontend` (no root) ou `cd frontend && npm run dev` (porta 3006).
- **Migrations / Seeds**:
  - Rodar todas: `cd backend && npm run migrate:all`.
  - Seed de datas: `psql $POSTGRES_DB < backend/db/seeds/datas_comemorativas.sql`.
- **Testes**: `npx ts-node tests/nome-do-teste.ts` (na pasta backend).
- **Build**:
  - Backend: `cd backend && npm run build`.
  - Frontend: `cd frontend && npm run build`.

# 5. Como funciona o produto (fluxos reais)
- **Fluxo A: Gerar Calendário**
  - UI (`CalendarPage.tsx`) -> `POST /api/generate-calendar` -> Backend coleta context (DNA + Docs + Regras + Datas + Trends) -> Envia para Gemini -> Gemini retorna JSON -> Salva na tabela `calendarios` -> UI renderiza grid.
  - Principais endpoints: `POST /api/generate-calendar`, `GET /api/calendars/:clienteId`.
  - Tabelas: `calendarios`, `branding`, `brand_docs`, `brand_rules`, `datas_comemorativas`.
- **Fluxo B: Analisar DNA da Marca**
  - Usuário faz upload de post ou importa via webhook -> `POST /api/process-post` -> Gemini identifica estilo e tom -> `POST /api/analyze-branding` -> `brandingMerger.ts` faz merge com DNA existente.
  - Tabelas: `posts`, `posts_processados`, `branding`.
- **Fluxo C: Exportar para Excel**
  - UI clica em Exportar -> `POST /api/presentation/export-excel` -> Backend chama `python_gen/calendar_to_excel.py` -> Retorna arquivo `.xlsx` para download.

# 6. Backend em detalhes
- **Organização de Rotas**: `backend/src/routes/` contém arquivos dedicados a cada entidade (clients, branding, calendar, etc.). Centralizadas no `index.ts`.
- **Serviços**: Lógica complexa de IA em `backend/src/utils/` (`geminiClient.ts`, `brandingMerger.ts`, `geminiCalendar.ts`).
- **Jobs**: `backend/src/jobs/calendarGenerationWorker.ts` processa gerações persistidas na tabela `calendar_generation_jobs`.
- **Autenticação**: Baseada em `jsonwebtoken` e `bcryptjs`. Middleware `requireAuth` em `backend/src/middlewares/requireAuth.ts`.
- **Observabilidade**: Logs detalhados via `console.log` com prefixos como `🔴 [STARTUP]`, `📞 [GRAMPO]`, `🔔 [BACKEND RECEBEU]`.

# 7. Frontend em detalhes
- **Estado**: Utiliza React Hooks (`useState`, `useEffect`) para estado local. Chamadas via Axios no `frontend/src/services/api.ts`.
- **Calendário Editorial**: `CalendarPage.tsx` gerencia a visualização em grid por semanas e modais de edição de cada post.
- **Progresso de Jobs**: Monitora status de jobs via polling nos endpoints de `/api/jobs`.
- **UI Patterns**: Design premium, Dark Mode, Glassmorphism, Tailwind CSS para estilos rápidos e consistentes.

# 8. Banco de Dados
- **Tabelas Principais**:
  - `clientes`: Dados mestres (id, nome, nicho, token_usage).
  - `branding`: DNA consolidado (estilo, tom, persona - JSONB).
  - `calendarios`: Histórico de gerações (JSONB).
  - `brand_docs` / `brand_rules`: Base de conhecimento adicional.
  - `datas_comemorativas`: Cadastro de datas de nicho.
  - `prompt_chains`: Templates sequenciais de prompts.
- **Migrações**: Executadas via scripts em `backend/db/` usando `ts-node`. Reverter geralmente exige comando manual via SQL.

# 9. Configuração e variáveis de ambiente
- **Backend (.env)**:
  - `PORT`: Porta do servidor (default 3001).
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: Conexão PostgreSQL.
  - `GOOGLE_API_KEY`: Chave do Gemini AI [REDACTED].
  - `JWT_SECRET`: Chave para tokens de login [REDACTED].
  - `N8N_API_KEY`: Segurança do webhook [REDACTED].
  - `CORS_ORIGIN`: URL do frontend (ex: `http://localhost:3006`).
- **Frontend (.env)**:
  - `VITE_API_URL`: URL base do backend (ex: `http://localhost:3001/api`).

# 10. Deploy (VPS)
- **Status HOJE**: Deploy manual em VPS Ubuntu via Git Pull + PM2 + Nginx. Documentado em `DEPLOYMENT_GUIDE.md`.
- **Checklist de Deploy**:
  1. `git pull origin main`
  2. `cd backend && npm install && npm run build`
  3. `cd ../frontend && npm install && npm run build`
  4. `cd ../backend && npm run migrate:all`
  5. `pm2 restart ecosystem.config.js`
- **Configuração**:
  - PM2: `ecosystem.config.js` no root gerencia o processo do backend.
  - Nginx: Atua como Reverse Proxy para o backend (`/api`) e serve o `dist/` do frontend.

# 11. Segurança e riscos
- **Riscos**:
  - Exposição de `GOOGLE_API_KEY` em logs (mitigado por regras no `CLAUDE.md`).
  - Falta de rate limiting na API.
  - Dependência direta de scripts Python para exportação (pode falhar se env mudar).
- **Melhorias necessárias**: Implementar HTTPS em todos os endpoints (vias Certbot), fortalecer autenticação e adicionar validações de payload mais rigorosas (Zod/Joi).

# 12. “Como mexer sem quebrar”
- **Áreas Críticas**:
  - `backend/src/utils/brandingMerger.ts`: Algoritmo de merge de DNA. Alterações aqui impactam o "cérebro" do sistema.
  - `backend/src/routes/calendar.ts`: Fluxo de montagem de prompt complexo.
- **Convenções**:
  - Usar TypeScript rigoroso.
  - Seguir o Contrato Canônico de Calendário (8 campos obrigatórios).
  - Adicionar logs de debug para novas rotas.

# 13. Roadmap técnico e dívidas
- **Falta para Produção**: Autenticação Multi-fator, Dashboard de métricas avançado, Integração direta com APIs de redes sociais (Post direto).
- **Dívidas Técnicas**: Migrações baseadas em scripts isolados em vez de um framework como Prisma ou Sequelize. Falta de testes unitários automatizados (atualmente apenas manuais via `.rest`).

# 14. Apêndice: inventário técnico
- **Node.js**: 18.x / 24.x
- **PostgreSQL**: 15+
- **Google Gemini SDK**: `@google/generative-ai` ^0.21.0
- **React**: 18.2.0
- **Vite**: 5.0.8

---

# RESUMO PARA CLAUDE.md (compacto)
## 🚀 Guia Rápido de Trabalho
- **Stack**: Node/TS/Express (Backend) + React/Vite/Tailwind (Frontend) + PostgreSQL.
- **Início Rápido**: `npm run dev` (root) para rodar tudo.
- **Backend**: Porta 3001. Entrypoint `backend/src/index.ts`.
- **Frontend**: Porta 3006. Entrypoint `frontend/src/main.tsx`.
- **Banco de Dados**: Rodar migrações com `npm run migrate:all` em `/backend`.
- **IA**: Contrato de calendário deve ter 8 campos: `dia, tema, formato, instrucoes_visuais, copy_inicial, objetivo, cta, palavras_chave`.
- **Logs**: Procure por prefixos como `🔴 [STARTUP]` ou `📞 [GRAMPO]`.
- **Config**: Variáveis em `.env` no root ou subpastas. Nunca commitar segredos.
- **Módulos Críticos**: `brandingMerger.ts` (DNA), `geminiCalendar.ts` (Prompt Assembly).
