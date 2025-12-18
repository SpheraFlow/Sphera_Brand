# 📋 PROJECT CONTEXT - MVP Sistema de Gestão de Conteúdo

**Data de criação:** 01/12/2025  
**Versão:** 1.0.0  
**Objetivo:** Sistema completo de gestão de conteúdo com IA para social media

---

## 🎯 OBJETIVO DO MVP

Sistema de **Gestão Inteligente de Conteúdo para Social Media** que:

1. **Coleta** posts de clientes (upload manual ou webhook n8n)
2. **Analisa** conteúdo usando Google Gemini AI
3. **Extrai** DNA de branding (estilo visual, tom de voz, público-alvo)
4. **Gera** calendários editoriais estratégicos automaticamente
5. **Armazena** todo histórico e insights consolidados

### Principais Funcionalidades:

- ✅ Upload de posts com arquivos (imagens/vídeos)
- ✅ Processamento de imagens com Google Gemini AI
- ✅ Extração e consolidação de DNA de branding
- ✅ Geração automática de calendários editoriais
- ✅ Integração via webhook com n8n
- ✅ Dashboard para visualização e gestão
- ✅ API RESTful completa

---

## 📁 ESTRUTURA DE PASTAS

```
MVP_SYSTEM/
│
├── backend/                           # Backend Node.js + TypeScript + Express
│   ├── db/                           # Scripts de banco de dados
│   │   ├── migrate.ts               # Script de migração
│   │   └── schema.sql               # Schema completo do banco
│   │
│   ├── src/
│   │   ├── config/                  # Configurações
│   │   │   ├── database.ts         # Pool PostgreSQL
│   │   │   └── multer.ts           # Config upload de arquivos
│   │   │
│   │   ├── middlewares/            # Middlewares customizados
│   │   │   └── validateApiKey.ts   # Validação de API Key (n8n)
│   │   │
│   │   ├── routes/                 # Rotas da API
│   │   │   ├── posts.ts           # Upload e processamento
│   │   │   ├── branding.ts        # Branding Intelligence
│   │   │   ├── calendar.ts        # Calendar Generator
│   │   │   └── webhooks.ts        # Webhook n8n
│   │   │
│   │   ├── utils/                  # Utilitários
│   │   │   ├── uuid.ts            # Gerador de UUID
│   │   │   ├── geminiClient.ts    # Cliente Google Gemini
│   │   │   ├── brandingMerger.ts  # Merge de insights
│   │   │   └── geminiCalendar.ts  # Gerador de calendário
│   │   │
│   │   └── index.ts               # Entry point do servidor
│   │
│   ├── tests/                      # Testes REST Client
│   │   ├── test-process-post.rest
│   │   ├── test-branding.rest
│   │   ├── test-calendar.rest
│   │   └── test-webhook.rest
│   │
│   ├── uploads/                    # Diretório de uploads
│   ├── package.json
│   ├── tsconfig.json
│   ├── nodemon.json
│   ├── .env                        # Variáveis de ambiente
│   ├── env.example
│   └── README.md
│
├── frontend/                        # Frontend React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   └── Dashboard.tsx      # Dashboard principal
│   │   │
│   │   ├── services/
│   │   │   └── api.ts             # Cliente Axios
│   │   │
│   │   ├── App.tsx                # Componente raiz
│   │   ├── main.tsx               # Entry point
│   │   └── index.css              # Estilos Tailwind
│   │
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── docs/                           # Documentação adicional
├── flows/                          # Fluxos n8n (futuros)
├── storage/                        # Armazenamento externo
└── SETUP_COMPLETO.md              # Guia de setup geral

```

---

## 🗄️ SCHEMA DO BANCO DE DADOS (PostgreSQL)

### Tabelas Implementadas:

#### 1. **clientes**
```sql
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);
```
**Descrição:** Cadastro de clientes do sistema

---

#### 2. **posts**
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  titulo TEXT,
  descricao TEXT,
  arquivo TEXT,                    -- Nome do arquivo salvo
  criado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);
```
**Descrição:** Posts feitos via upload manual

**Índices:**
- `idx_posts_cliente_id` - Por cliente
- `idx_posts_criado_em` - Por data (DESC)

---

#### 3. **posts_originais**
```sql
CREATE TABLE posts_originais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  imagem_path TEXT NOT NULL,       -- Nome do arquivo baixado
  legenda TEXT,
  data_post TIMESTAMP,             -- Data original da publicação
  id_externo TEXT,                 -- ID na rede social (Instagram, Facebook, etc)
  importado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente_post_original FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);
```
**Descrição:** Posts importados via webhook n8n (redes sociais)

**Índices:**
- `idx_posts_originais_cliente_id` - Por cliente
- `idx_posts_originais_id_externo` - Por ID externo
- `idx_posts_originais_data_post` - Por data (DESC)

---

#### 4. **posts_processados**
```sql
CREATE TABLE posts_processados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  metadata JSONB,                  -- Resposta completa do Gemini
  status TEXT,                     -- "processado", "erro", etc
  processado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
```
**Descrição:** Posts processados pela IA (análise de conteúdo)

**Índices:**
- `idx_posts_processados_post_id` - Por post
- `idx_posts_processados_status` - Por status
- `idx_posts_processados_processado_em` - Por data (DESC)

---

#### 5. **branding**
```sql
CREATE TABLE branding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL UNIQUE, -- Um registro por cliente
  visual_style JSONB,              -- Estilo visual consolidado
  tone_of_voice JSONB,             -- Tom de voz da marca
  audience JSONB,                  -- Público-alvo
  keywords TEXT[],                 -- Array de palavras-chave
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente_branding FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  CONSTRAINT unique_cliente_branding UNIQUE (cliente_id)
);
```
**Descrição:** DNA de branding consolidado por cliente (Branding Intelligence)

**Características:**
- UNIQUE por cliente - apenas um registro por cliente
- Merge inteligente de insights ao longo do tempo
- Atualização incremental com novos posts

**Índices:**
- `idx_branding_cliente_id` - Por cliente
- `idx_branding_updated_at` - Por atualização (DESC)

---

#### 6. **calendarios**
```sql
CREATE TABLE calendarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  periodo INTEGER NOT NULL,        -- Quantidade de dias
  briefing TEXT,                   -- Briefing do cliente
  dias JSONB NOT NULL,            -- Array de dias do calendário
  metadata JSONB,                  -- Branding e histórico usado
  criado_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_cliente_calendario FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);
```
**Descrição:** Calendários editoriais gerados pela IA

**Campo `dias` (JSONB):**
```json
[
  {
    "dia": 1,
    "tema": "Dica de Produtividade",
    "formato": "Carrossel",
    "instrucoes_visuais": "...",
    "copy_inicial": "...",
    "objetivo": "...",
    "cta": "...",
    "palavras_chave": ["..."]
  }
]
```

**Índices:**
- `idx_calendarios_cliente_id` - Por cliente
- `idx_calendarios_criado_em` - Por criação (DESC)

---

### Relacionamentos:

```
clientes (1) ─────── (N) posts
clientes (1) ─────── (N) posts_originais
clientes (1) ─────── (1) branding
clientes (1) ─────── (N) calendarios
posts (1) ─────────── (N) posts_processados
```

---

## 🚀 ROTAS DO BACKEND

**Base URL:** `http://localhost:3001/api`

### 📤 Módulo: Posts

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/upload-post` | Upload de arquivo com multer | - |
| GET | `/posts/:clienteId` | Buscar posts de um cliente | - |
| POST | `/process-post` | Processar post com Gemini AI | - |

#### **POST /upload-post**
- **Body:** `multipart/form-data`
  - `file` (arquivo)
  - `clienteId` (UUID)
  - `titulo` (texto)
  - `descricao` (texto)
- **Retorna:** `{ success, postId, filePath }`
- **Salva em:** Tabela `posts` + arquivo em `UPLOAD_DIR`

#### **POST /process-post**
- **Body:** `{ postId }`
- **Processo:** Envia imagem para Gemini → Analisa → Salva em `posts_processados`
- **Retorna:** `{ success, postId, processedId, analysis }`

---

### 🎨 Módulo: Branding Intelligence

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/analyze-branding` | Analisa post e atualiza DNA | - |
| GET | `/branding/:clienteId` | Retorna branding consolidado | - |

#### **POST /analyze-branding**
- **Body:** `{ clienteId, postId }`
- **Processo:** 
  1. Busca post e arquivo
  2. Envia para Gemini com prompt de branding
  3. Extrai insights (visual_style, tone_of_voice, audience, keywords)
  4. Faz merge com dados existentes
  5. Salva/atualiza na tabela `branding`
- **Retorna:** `{ success, brandingId, insights, rawAnalysis }`

#### **GET /branding/:clienteId**
- **Retorna:** DNA de branding consolidado do cliente
- **Formato:** `{ success, branding: { visual_style, tone_of_voice, audience, keywords } }`

---

### 📅 Módulo: Calendar Generator

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/generate-calendar` | Gera calendário editorial com IA | - |
| GET | `/calendars/:clienteId` | Busca último calendário gerado | - |

#### **POST /generate-calendar**
- **Body:** `{ clienteId, periodo, briefing }`
- **Processo:**
  1. Busca branding consolidado
  2. Busca posts processados (histórico)
  3. Cria dataset resumido
  4. Envia para Gemini com prompt estruturado
  5. Recebe calendário em JSON
  6. Salva na tabela `calendarios`
- **Retorna:** `{ success, calendarioId, dias[], metadata }`

#### **GET /calendars/:clienteId**
- **Retorna:** Último calendário gerado do cliente
- **Formato:** `{ success, dias[], periodo, briefing, criado_em }`

---

### 🔗 Módulo: Webhooks (n8n)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/webhooks/ingest-posts` | Recebe posts do n8n | API Key |

#### **POST /webhooks/ingest-posts**
- **Headers:** `x-api-key: N8N_API_KEY`
- **Body:** `{ clienteId, posts: [{ url, legenda, data, id_externo }] }`
- **Processo:**
  1. Valida API Key
  2. Para cada post:
     - Baixa imagem da URL
     - Salva em UPLOAD_DIR
     - Insere na tabela `posts_originais`
- **Retorna:** `{ success, imported, total, errors? }`

---

### 🏥 Rotas de Sistema

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | Status do backend |
| GET | `/health` | Health check |

---

## 🔧 CONFIGURAÇÕES E TECNOLOGIAS

### Backend Stack:

- **Runtime:** Node.js 18+
- **Linguagem:** TypeScript 5.9
- **Framework:** Express 5.2
- **Database:** PostgreSQL (Docker)
- **ORM:** pg (node-postgres)
- **Upload:** Multer 1.4
- **IA:** Google Gemini (@google/generative-ai)
- **HTTP Client:** Axios
- **Dev Tools:** ts-node, nodemon

### Frontend Stack:

- **Framework:** React 18
- **Linguagem:** TypeScript
- **Build Tool:** Vite 5
- **Styling:** Tailwind CSS 3.3
- **HTTP Client:** Axios
- **UI:** Dark Mode, Glassmorphism

### Infraestrutura:

- **Database:** PostgreSQL 15+ (Docker - ankane/pgvector)
- **Storage:** Sistema de arquivos local (./uploads)
- **Ports:**
  - Frontend: 3005
  - Backend: 3001
  - PostgreSQL: 5432

---

## 🔐 VARIÁVEIS DE AMBIENTE

### Backend (.env):

```env
# Server
PORT=3001

# Database (PostgreSQL Docker)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=app_db
DB_USER=spheraflow
DB_PASSWORD=@Trafego123

# Upload
UPLOAD_DIR=./uploads

# Google Gemini API
GOOGLE_API_KEY=your_google_api_key_here

# n8n Webhook Security
N8N_API_KEY=secret_key_n8n_webhook_2024
```

---

## 📊 REGRAS DE NEGÓCIO

### 1. Upload e Processamento de Posts

**Fluxo:**
```
Upload → Validação → Salvar Arquivo → Inserir no Banco → 
Processar com IA → Extrair Insights → Salvar Processamento
```

**Validações:**
- ✅ Arquivo obrigatório (imagem/vídeo)
- ✅ clienteId obrigatório
- ✅ titulo obrigatório
- ✅ Limite de 50MB por arquivo
- ✅ Formatos aceitos: jpg, jpeg, png, gif, webp, mp4, mpeg

**Armazenamento:**
- Arquivo: `UPLOAD_DIR/nome-timestamp-random.ext`
- Banco: Tabela `posts` com UUID

---

### 2. Branding Intelligence

**Conceito:**
Sistema que **aprende** o DNA da marca através da análise de posts ao longo do tempo.

**Fluxo:**
```
Post → Gemini (análise) → Parse de Insights → 
Merge com Dados Existentes → Atualizar Branding
```

**Merge Inteligente:**
- **Primeira análise:** Cria registro inicial
- **Análises seguintes:** Combina com dados existentes
  - Keywords: Remove duplicatas, adiciona novos
  - Objetos JSONB: Merge profundo, mantém histórico
  - Prioriza: Dados mais recentes

**Campos Extraídos:**
- **visual_style:** Paleta, tipografia, mood, elementos visuais
- **tone_of_voice:** Personalidade, linguagem, características
- **audience:** Demografia, comportamento, interesses
- **keywords:** Termos relevantes que definem a marca

**Regra:** UM registro por cliente (UNIQUE constraint)

---

### 3. Calendar Generator

**Conceito:**
Gera calendários editoriais estratégicos baseados no DNA da marca e histórico.

**Inputs:**
- Branding consolidado do cliente
- Histórico de posts processados (últimos 20)
- Período desejado (1-90 dias)
- Briefing opcional do cliente

**Processo:**
```
1. Buscar Branding
2. Buscar Posts Processados
3. Criar Dataset Resumido
   ├── Tom de voz
   ├── Estilo visual
   ├── Público-alvo
   ├── Keywords
   ├── Temas recorrentes
   ├── Categorias
   └── Força da marca
4. Construir Prompt Estruturado
5. Enviar para Gemini
6. Receber Calendário JSON
7. Salvar no Banco
8. Retornar Resultado
```

**Output por Dia:**
- dia (número)
- tema
- formato (Carrossel, Reels, Stories, etc)
- instrucoes_visuais
- copy_inicial (texto completo)
- objetivo
- cta
- palavras_chave[]

**Variação:** Mix de conteúdo educacional, promocional, inspiracional

---

### 4. Webhook n8n

**Conceito:**
Permite automação de importação de posts de redes sociais via n8n.

**Segurança:**
- Header obrigatório: `x-api-key`
- Validação contra `N8N_API_KEY`
- Retorna 401 se inválida

**Processo:**
```
1. Validar API Key
2. Validar clienteId e posts[]
3. Para cada post:
   a) Baixar imagem da URL
   b) Salvar com nome único
   c) Inserir na tabela posts_originais
4. Retornar contagem de importados
```

**Resiliência:**
- Continua processando mesmo se um post falhar
- Retorna lista de erros parciais
- Nunca quebra o servidor

---

## 🤖 INTEGRAÇÃO COM GOOGLE GEMINI AI

### Modelo Utilizado:
- **gemini-1.5-flash** - Multimodal (texto + imagem)

### Casos de Uso:

#### 1. Processamento de Posts
**Prompt:**
```
Analise esta peça de social media. Extraia estilo visual, tom da marca, 
elementos importantes, público-alvo, e possíveis categorias de conteúdo.
```

#### 2. Análise de Branding
**Prompt:**
```
Analise este post e descreva:
1. Estilo Visual: paleta de cores, tipografia, elementos visuais, mood geral
2. Tom de Voz: como a marca se comunica, personalidade, linguagem utilizada
3. Intenção Comunicacional: objetivo da mensagem, call-to-action, estratégia
4. Público-Alvo: quem é o público, características demográficas e comportamentais
5. Palavras-chave: termos relevantes que definem a marca e o conteúdo

Seja específico e detalhado.
```

#### 3. Geração de Calendário
**Prompt Estruturado:**
- Branding completo da marca
- Histórico de conteúdo
- Temas recorrentes
- Categorias utilizadas
- Briefing do cliente
- Instruções de formato JSON

**Retorno:** JSON com array de dias estruturados

---

## 🎨 FRONTEND - DASHBOARD

### Componentes:

#### **Dashboard.tsx**
Componente principal com:

**Seções:**
1. **Header** - Título e descrição
2. **Toasts** - Sistema de notificações (sucesso/erro/info)
3. **ID Cliente** - Input global
4. **Novo Post** - Upload e processamento
5. **Planejamento** - Geração de calendário
6. **Grid de Calendário** - Visualização dos dias

**Features:**
- ✅ Dark mode (bg-gray-950)
- ✅ Glassmorphism
- ✅ Gradientes coloridos
- ✅ Hover effects
- ✅ Loading states
- ✅ Toasts animados
- ✅ Grid responsivo (1/2/3 colunas)
- ✅ Cards com badges coloridos por formato

**Integrações API:**
- `uploadPost()` - Upload de arquivo
- `processPost()` - Processar com IA
- `generateCalendar()` - Gerar calendário
- `getCalendar()` - Buscar calendário

---

## 🔄 FLUXOS PRINCIPAIS

### Fluxo 1: Upload Manual
```
Usuário → Upload arquivo + dados → Backend → Salvar arquivo → 
Inserir no banco (posts) → Processar com Gemini → 
Salvar análise (posts_processados) → Retornar sucesso
```

### Fluxo 2: Importação Automática (n8n)
```
n8n → Webhook POST → Validar API Key → Baixar imagens → 
Salvar arquivos → Inserir no banco (posts_originais) → 
Retornar contagem
```

### Fluxo 3: Análise de Branding
```
Cliente + Post → Buscar arquivo → Enviar para Gemini → 
Parse de insights → Merge com dados existentes → 
Atualizar/Criar branding → Retornar consolidado
```

### Fluxo 4: Geração de Calendário
```
Cliente → Buscar branding → Buscar histórico → Criar dataset → 
Construir prompt → Gemini gera calendário → Parse JSON → 
Salvar no banco → Retornar calendário
```

### Fluxo 5: Visualização Frontend
```
Usuário digita ID → Carregar calendário → API GET → 
Renderizar grid → Exibir cards formatados
```

---

## 📦 DEPENDÊNCIAS PRINCIPAIS

### Backend:
```json
{
  "@google/generative-ai": "^0.21.0",  // Google Gemini
  "axios": "^1.13.2",                   // HTTP client
  "cors": "^2.8.5",                     // CORS
  "dotenv": "^17.2.3",                  // Env vars
  "express": "^5.2.0",                  // Framework
  "multer": "^1.4.5-lts.1",            // Upload
  "pg": "^8.16.3"                       // PostgreSQL
}
```

### Frontend:
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "axios": "^1.6.2",
  "tailwindcss": "^3.3.6",
  "vite": "^5.0.8"
}
```

---

## 📝 SCRIPTS DISPONÍVEIS

### Backend:
```bash
npm run dev      # Desenvolvimento com nodemon
npm run build    # Build TypeScript
npm run start    # Produção
npm run migrate  # Executar migração do banco
```

### Frontend:
```bash
npm run dev      # Vite dev server (porta 3005)
npm run build    # Build para produção
npm run preview  # Preview da build
```

---

## 🗂️ MÓDULOS E HELPERS

### Backend Helpers:

#### **uuid.ts**
- `generateUUID()` - Gera UUID v4

#### **geminiClient.ts**
- `analyzeImage(filePath, prompt)` - Análise de imagem
- `generateTextContent(prompt)` - Geração de texto

#### **brandingMerger.ts**
- `parseGeminiResponse(text)` - Extrai insights estruturados
- `mergeBrandingData(existing, new)` - Merge inteligente
- `deepMerge()` - Merge recursivo de objetos JSONB

#### **geminiCalendar.ts**
- `createBrandingDataset()` - Cria dataset resumido
- `buildCalendarPrompt()` - Constrói prompt estruturado
- `generateCalendarWithGemini()` - Gera calendário

---

## 🔒 SEGURANÇA

### Implementações:

1. **CORS Configurado:**
   - Origins permitidas: localhost:3005, localhost:3000
   - Credentials habilitado

2. **API Key para Webhooks:**
   - Middleware `validateApiKey`
   - Header `x-api-key` obrigatório
   - Validação contra env var

3. **Validações de Entrada:**
   - UUIDs validados
   - Arquivos validados (tipo e tamanho)
   - Campos obrigatórios verificados

4. **Foreign Keys:**
   - Integridade referencial no banco
   - CASCADE DELETE configurado

---

## 📈 MÉTRICAS E INSIGHTS

### Por Cliente:

- **Posts Totais:** COUNT de posts + posts_originais
- **Posts Processados:** COUNT de posts_processados
- **Calendários Gerados:** COUNT de calendarios
- **Força da Marca:** 
  - Forte: > 5 posts processados
  - Moderada: 2-5 posts
  - Inicial: < 2 posts

### Análises Disponíveis:

- Temas recorrentes
- Categorias de conteúdo
- Evolução do branding
- Histórico de calendários

---

## 🧪 TESTES

### Arquivos de Teste (REST Client):

- `test-process-post.rest` - Teste completo de upload e processamento
- `test-branding.rest` - Teste de análise de branding
- `test-calendar.rest` - Teste de geração de calendário
- `test-webhook.rest` - Teste de webhook n8n

### Exemplo de Teste Completo:

```
1. Upload post → POST /upload-post
2. Processar → POST /process-post
3. Analisar branding → POST /analyze-branding
4. Gerar calendário → POST /generate-calendar
5. Buscar calendário → GET /calendars/:clienteId
6. Visualizar no Dashboard → Frontend
```

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

### Curto Prazo:
- [ ] Configurar Google API Key para produção
- [ ] Criar mais clientes de teste
- [ ] Implementar autenticação de usuários
- [ ] Adicionar paginação nas listagens
- [ ] Implementar filtros no dashboard

### Médio Prazo:
- [ ] Sistema de templates de posts
- [ ] Agendamento automático de publicações
- [ ] Integração direta com APIs de redes sociais
- [ ] Analytics e métricas de engajamento
- [ ] Exportação de calendários (PDF, Excel)

### Longo Prazo:
- [ ] Multi-tenancy (isolamento por cliente)
- [ ] Sistema de permissões granulares
- [ ] Versionamento de calendários
- [ ] A/B testing de conteúdo
- [ ] Dashboard com gráficos e insights

---

## 🚨 TROUBLESHOOTING COMUM

### Backend não inicia:
- Verificar PostgreSQL rodando (Docker)
- Verificar credenciais no .env
- Executar `npm run migrate`

### CORS Error:
- Verificar origins no backend/src/index.ts
- Frontend deve rodar em porta 3005

### IA não funciona:
- Configurar GOOGLE_API_KEY no .env
- Reiniciar servidor

### Webhook retorna 401:
- Verificar header x-api-key
- Confirmar N8N_API_KEY no .env

### Tabelas não existem:
- Executar `npm run migrate` no backend

---

## 📚 DOCUMENTAÇÃO ADICIONAL

### Backend:
- `README.md` - Setup e uso geral
- `BRANDING-INTELLIGENCE.md` - Módulo de branding
- `CALENDAR-GENERATOR.md` - Módulo de calendário
- `WEBHOOKS-N8N.md` - Integração n8n
- `SETUP.md` - Guia detalhado de instalação

### Frontend:
- `README.md` - Como executar

### Geral:
- `SETUP_COMPLETO.md` - Setup completo do sistema

---

## 🎓 CONCEITOS-CHAVE

### Branding Intelligence:
Sistema que **evolui** com cada post analisado, consolidando o DNA da marca.

### Calendar Generator:
IA que cria calendários **personalizados** baseados em branding real, não templates genéricos.

### Merge Inteligente:
Algoritmo que **combina** insights novos com histórico, sem perder informações relevantes.

### Dataset Resumido:
Compilação otimizada de branding + histórico para enviar à IA de forma eficiente.

---

## 🔄 PRÓXIMA SESSÃO

Ao retomar o projeto, você terá:

✅ **Backend completo** rodando em 3001  
✅ **Frontend dashboard** rodando em 3005  
✅ **PostgreSQL** com 6 tabelas configuradas  
✅ **4 módulos** implementados (Posts, Branding, Calendar, Webhooks)  
✅ **Integração IA** pronta com Google Gemini  
✅ **Sistema de merge** de insights funcionando  
✅ **Webhook n8n** pronto para automação  

**Estado:** MVP funcional e pronto para testes e melhorias! 🚀

---

**Última atualização:** 01/12/2025  
**Status:** ✅ Totalmente funcional  
**Versão:** 1.0.0

