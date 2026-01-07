# 📐 Mapeamento Técnico Completo da Arquitetura - Sphera Brand System

**Data de Auditoria:** 06/01/2026  
**Versão do Sistema:** 1.0.0  
**Status:** ✅ Produção (30 clientes ativos)

---

## 1. 🏗️ Arquitetura de Pastas

### **Backend** (`/backend`)

```
backend/
├── src/
│   ├── config/                    # Configurações centralizadas
│   │   ├── database.ts           # Pool PostgreSQL
│   │   └── multer.ts             # Upload de arquivos
│   │
│   ├── routes/                    # Módulos de API (RESTful)
│   │   ├── calendar.ts           # ⭐ Geração de calendários (Item 4)
│   │   ├── branding.ts           # DNA da Marca (Item 3)
│   │   ├── brandingUpload.ts     # Upload de arquivos de branding
│   │   ├── promptChains.ts       # Prompt Chains (Item 6)
│   │   ├── knowledge.ts          # Base de Conhecimento
│   │   ├── clients.ts            # Gestão de clientes
│   │   ├── posts.ts              # Posts de social media
│   │   ├── presentation.ts       # Geração de apresentações
│   │   ├── webhooks.ts           # Integração n8n
│   │   ├── datasComemorativas.ts # Datas comemorativas
│   │   ├── photoIdeas.ts         # Ideias de fotos
│   │   ├── tokenUsage.ts         # Rastreamento de tokens IA
│   │   └── clientLogos.ts        # Logos dos clientes
│   │
│   ├── services/                  # Serviços de negócio
│   │   └── (lógica de negócio complexa)
│   │
│   ├── utils/                     # Utilitários
│   │   ├── geminiClient.ts       # Cliente Google Gemini AI
│   │   ├── brandingMerger.ts     # Merge inteligente de DNA
│   │   ├── tokenTracker.ts       # Rastreamento de uso de IA
│   │   └── uuid.ts               # Geração de UUIDs
│   │
│   ├── middlewares/               # Middlewares Express
│   │   └── validateApiKey.ts     # Autenticação de webhooks
│   │
│   ├── database/                  # Migrações e scripts DB
│   │   └── migrations/           # Scripts SQL de migração
│   │
│   └── index.ts                   # ⚡ Entry point do servidor
│
├── python_gen/                    # Scripts Python auxiliares
│   ├── calendar_to_excel.py      # Exportação de calendários
│   ├── main.py                   # Geração de imagens/lâminas
│   ├── trends_service.py         # 🆕 Google Trends (Item 4)
│   ├── trends_cli.py             # CLI para Trends
│   ├── trends_refresh.py         # Job de atualização de cache
│   └── test_trends_service.py    # Testes unitários
│
├── storage/                       # Armazenamento de arquivos
│   └── branding/                 # Uploads de DNA da marca
│
├── dist/                          # Build TypeScript (produção)
└── .venv/                         # Virtualenv Python (produção)
```

### **Frontend** (`/frontend`)

```
frontend/
├── src/
│   ├── pages/                     # Páginas principais
│   │   ├── Dashboard.tsx         # Dashboard geral (Item 1)
│   │   ├── ClientsHome.tsx       # Listagem de clientes
│   │   ├── BrandProfile.tsx      # DNA da Marca (Item 3)
│   │   ├── CalendarPage.tsx      # ⭐ Calendário Editorial (Item 4)
│   │   ├── KnowledgeBase.tsx     # Base de Conhecimento (Item 6)
│   │   ├── ReferencesPage.tsx    # Referências visuais
│   │   └── GeneralCalendarPage.tsx # Calendário geral
│   │
│   ├── components/                # Componentes reutilizáveis
│   │   ├── ContentMixSelector.tsx # Seletor de mix de conteúdo
│   │   ├── PeriodSelector.tsx    # Seletor de período
│   │   ├── PresentationGenerator.tsx # Gerador de apresentações
│   │   ├── TokenUsageDisplay.tsx # Display de uso de tokens
│   │   └── PhotoIdeasModal.tsx   # Modal de ideias de fotos
│   │
│   ├── services/
│   │   └── api.ts                # Cliente Axios (chamadas API)
│   │
│   ├── layouts/                   # Layouts de página
│   ├── utils/                     # Utilitários frontend
│   ├── App.tsx                    # Componente raiz
│   └── main.tsx                   # Entry point React
│
└── dist/                          # Build de produção (Vite)
```

---

## 2. 🗄️ Schema de Dados e Relacionamentos

### **Diagrama de Relacionamentos**

```
┌─────────────┐
│  clientes   │ (30 clientes isolados por cliente_id)
└──────┬──────┘
       │
       ├──────────────────────────────────────┐
       │                                      │
       ▼                                      ▼
┌─────────────┐                      ┌──────────────┐
│  branding   │ (1:1)                │ calendarios  │ (1:N)
│             │                      │              │
│ DNA da      │◄─────────────────────┤ Calendários  │
│ Marca       │  (usado na geração)  │ Editoriais   │
└─────────────┘                      └──────────────┘
       ▲                                      ▲
       │                                      │
       │                              ┌───────┴────────┐
       │                              │                │
┌──────┴──────┐                ┌──────┴──────┐ ┌──────┴──────┐
│ brand_docs  │ (1:N)          │prompt_chains│ │datas_comem. │
│             │                │             │ │             │
│ Documentos  │                │ Chains de   │ │ Datas       │
│ de DNA      │                │ Prompts     │ │ Relevantes  │
└─────────────┘                └─────────────┘ └─────────────┘
       │
       │
┌──────┴──────┐
│ brand_rules │ (1:N)
│             │
│ Regras da   │
│ Marca       │
└─────────────┘
```

### **Tabelas Principais**

#### **`clientes`** - Multitenancy
```sql
CREATE TABLE clientes (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  persona_atualizada TEXT,
  categorias_nicho JSONB DEFAULT '[]',  -- ["fitness", "saude"]
  logo_url TEXT,
  token_usage JSONB DEFAULT '{"total_tokens": 0}',
  criado_em TIMESTAMP DEFAULT NOW()
);
```
**Função:** Base do multitenancy. Cada cliente é isolado por `cliente_id`.

---

#### **`branding`** - DNA da Marca (Item 3)
```sql
CREATE TABLE branding (
  id UUID PRIMARY KEY,
  cliente_id UUID UNIQUE NOT NULL,  -- 1:1 com cliente
  visual_style JSONB,               -- Paleta, tipografia, mood
  tone_of_voice JSONB,              -- Personalidade, linguagem
  audience JSONB,                   -- Persona, demografia
  keywords TEXT[],                  -- Palavras-chave da marca
  archetype TEXT,                   -- Arquétipo (O Criador, O Herói)
  usp TEXT,                         -- Proposta única de valor
  anti_keywords TEXT[],             -- Palavras a evitar
  niche TEXT,                       -- Nicho principal
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);
```
**Função:** Armazena o DNA consolidado da marca. **1 registro por cliente** (UNIQUE constraint).

**Merge Inteligente:** Novos insights são combinados com dados existentes sem sobrescrever.

---

#### **`brand_docs`** - Documentos de DNA (Item 3)
```sql
CREATE TABLE brand_docs (
  id UUID PRIMARY KEY,
  cliente_id UUID NOT NULL,
  tipo TEXT NOT NULL,              -- "manual", "pdf", "website"
  conteudo_texto TEXT,             -- Conteúdo extraído
  criado_em TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);
```
**Função:** Armazena documentos de referência da marca (manuais, PDFs, etc.).

---

#### **`brand_rules`** - Regras da Marca (Item 3)
```sql
CREATE TABLE brand_rules (
  id UUID PRIMARY KEY,
  cliente_id UUID NOT NULL,
  regra TEXT NOT NULL,             -- "Nunca usar vermelho"
  categoria TEXT,                  -- "visual", "tom", "conteudo"
  ativa BOOLEAN DEFAULT TRUE,
  origem TEXT DEFAULT 'manual',    -- "manual" ou "ia"
  criado_em TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);
```
**Função:** Regras e diretrizes específicas da marca.

---

#### **`calendarios`** - Calendários Editoriais (Item 4)
```sql
CREATE TABLE calendarios (
  id UUID PRIMARY KEY,
  cliente_id UUID NOT NULL,
  periodo INTEGER,                 -- Dias do calendário
  briefing TEXT,                   -- Briefing do cliente
  mes TEXT,                        -- "abril 2026"
  calendario_json JSONB,           -- Array de posts estruturados
  metadata JSONB,                  -- Branding usado, trends, etc
  criado_em TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);
```
**Função:** Armazena calendários gerados pela IA.

**Estrutura `calendario_json`:**
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

---

#### **`prompt_chains`** - Prompt Chains (Item 6)
```sql
CREATE TABLE prompt_chains (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID,                  -- NULL = global
  is_global BOOLEAN DEFAULT false,
  steps JSONB DEFAULT '[]',        -- Array de steps sequenciais
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE
);
```
**Função:** Armazena chains de prompts sequenciais para geração avançada.

**Estrutura `steps`:**
```json
[
  {
    "order": 1,
    "name": "Análise de Contexto",
    "prompt_template": "Analise o briefing: {{briefing}}...",
    "expected_output": "Análise estruturada"
  },
  {
    "order": 2,
    "name": "Geração de Ideias",
    "prompt_template": "Com base em: {{step_1_output}}...",
    "expected_output": "Lista de ideias"
  }
]
```

---

#### **`datas_comemorativas`** - Datas Relevantes
```sql
CREATE TABLE datas_comemorativas (
  id UUID PRIMARY KEY,
  data DATE NOT NULL,
  titulo TEXT NOT NULL,
  categorias JSONB DEFAULT '[]',   -- ["geral", "saude", "fitness"]
  descricao TEXT,
  relevancia INT DEFAULT 0,        -- 0-10
  origem TEXT DEFAULT 'manual',    -- "manual", "brasilapi"
  fontes JSONB DEFAULT '[]',
  criado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE (data, titulo)
);
```
**Função:** Datas comemorativas filtradas por nicho para enriquecer calendários.

---

### **Relacionamento DNA → Calendário**

```
┌──────────────────────────────────────────────────────────────┐
│                    FLUXO DE GERAÇÃO                          │
└──────────────────────────────────────────────────────────────┘

1. Cliente solicita geração de calendário
   ↓
2. Backend busca DNA consolidado (branding)
   ├── visual_style
   ├── tone_of_voice
   ├── audience
   ├── keywords
   ├── archetype
   └── niche
   ↓
3. Backend busca documentos de referência (brand_docs)
   ↓
4. Backend busca regras ativas (brand_rules)
   ↓
5. Backend busca datas comemorativas filtradas por nicho
   ↓
6. Backend busca Google Trends (se habilitado)
   ↓
7. Backend monta prompt estruturado com:
   ├── DNA da marca
   ├── Documentos de referência
   ├── Regras da marca
   ├── Datas comemorativas
   ├── Trends relevantes
   ├── Briefing do cliente
   ├── Mix de conteúdo (reels, static, carousel)
   └── Prompt Chain (se selecionada)
   ↓
8. Gemini AI gera calendário JSON
   ↓
9. Backend salva em calendarios (calendario_json)
   ↓
10. Frontend renderiza calendário
```

---

## 3. 🏢 Lógica de Multitenancy (30 Clientes)

### **Modelo: Single Database + Tenant Isolation**

**Estratégia:** Banco de dados **único** com isolamento por `cliente_id` (UUID).

### **Implementação**

#### **Nível de Banco de Dados**
```sql
-- Todas as tabelas têm cliente_id como FK
CREATE TABLE branding (
  cliente_id UUID NOT NULL UNIQUE,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX idx_branding_cliente_id ON branding(cliente_id);
CREATE INDEX idx_calendarios_cliente_id ON calendarios(cliente_id);
CREATE INDEX idx_brand_docs_cliente_id ON brand_docs(cliente_id);
```

#### **Nível de API**
```typescript
// Todas as rotas filtram por clienteId
router.get("/branding/:clienteId", async (req, res) => {
  const { clienteId } = req.params;
  const result = await db.query(
    "SELECT * FROM branding WHERE cliente_id = $1",
    [clienteId]
  );
  // ...
});
```

#### **Nível de Frontend**
```typescript
// Context global do cliente selecionado
const [selectedClient, setSelectedClient] = useState<string | null>(null);

// Todas as chamadas API incluem clientId
const response = await api.get(`/api/branding/${selectedClient}`);
```

### **Isolamento de Dados**

| Recurso | Isolamento | Compartilhamento |
|---------|------------|------------------|
| **Branding** | ✅ Por cliente | ❌ Nenhum |
| **Calendários** | ✅ Por cliente | ❌ Nenhum |
| **Documentos DNA** | ✅ Por cliente | ❌ Nenhum |
| **Regras** | ✅ Por cliente | ❌ Nenhum |
| **Prompt Chains** | ✅ Por cliente | ✅ Globais (is_global=true) |
| **Datas Comemorativas** | ❌ Compartilhadas | ✅ Todas |
| **Trends Cache** | ❌ Compartilhado | ✅ Todos |

### **Vantagens**
- ✅ **Simplicidade:** 1 banco, 1 deploy
- ✅ **Performance:** Índices otimizados por cliente
- ✅ **Manutenção:** Migrações centralizadas
- ✅ **Custo:** Infraestrutura única

### **Segurança**
- ✅ **Foreign Keys:** Integridade referencial garantida
- ✅ **CASCADE DELETE:** Remoção de cliente limpa todos os dados
- ✅ **Validação:** Todas as queries validam `cliente_id`

---

## 4. 🤖 Integração de IA

### **Arquitetura de IA**

```
┌──────────────────────────────────────────────────────────────┐
│                  GOOGLE GEMINI AI INTEGRATION                │
└──────────────────────────────────────────────────────────────┘

Frontend (React)
    ↓ HTTP Request
Backend (Node.js + Express)
    ↓ Monta Prompt
┌───────────────────────────────────────────────────────────┐
│  Prompt Assembly Layer                                    │
│  ├── DNA da Marca (branding)                             │
│  ├── Documentos (brand_docs)                             │
│  ├── Regras (brand_rules)                                │
│  ├── Datas Comemorativas (filtradas por nicho)           │
│  ├── Google Trends (trends_service.py)                   │
│  ├── Briefing do Cliente                                 │
│  └── Prompt Chain (steps sequenciais)                    │
└───────────────────────────────────────────────────────────┘
    ↓ Prompt Estruturado
┌───────────────────────────────────────────────────────────┐
│  Google Gemini AI                                         │
│  ├── gemini-2.5-flash (primário)                         │
│  ├── gemini-1.5-flash (fallback)                         │
│  └── gemini-1.5-pro (fallback final)                     │
└───────────────────────────────────────────────────────────┘
    ↓ JSON Response
Backend (Parse + Validação)
    ↓ Salva no Banco
PostgreSQL (calendarios)
    ↓ Retorna Dados
Frontend (Renderização)
```

### **Módulos de IA**

#### **1. Geração de Calendário** (`calendar.ts`)

**Localização:** `backend/src/routes/calendar.ts`

**Prompt Assembly:**
```typescript
const prompt = `
Você é um estrategista de conteúdo especializado.

## DNA DA MARCA
${JSON.stringify(branding, null, 2)}

## DOCUMENTOS DE REFERÊNCIA
${brandDocs.map(d => d.conteudo_texto).join('\n')}

## REGRAS DA MARCA
${brandRules.map(r => `- ${r.regra}`).join('\n')}

## DATAS COMEMORATIVAS RELEVANTES
${datasComemorativos}

## GOOGLE TRENDS RELEVANTES
${trendsBlock}

## BRIEFING DO CLIENTE
${briefing}

## MIX DE CONTEÚDO
- Reels: ${mix.reels}
- Posts Estáticos: ${mix.static}
- Carrosséis: ${mix.carousel}
- Stories: ${mix.stories}

Gere um calendário editorial em JSON com a seguinte estrutura:
[
  {
    "dia": 1,
    "tema": "...",
    "formato": "Reels|Static|Carousel|Stories",
    "instrucoes_visuais": "...",
    "copy_inicial": "...",
    "objetivo": "...",
    "cta": "...",
    "palavras_chave": ["..."]
  }
]
`;
```

**Fallback de Modelos:**
```typescript
const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

for (const modelName of modelsToTry) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    break; // Sucesso
  } catch (error) {
    // Tenta próximo modelo
  }
}
```

---

#### **2. Prompt Chains** (`promptChains.ts`)

**Localização:** `backend/src/routes/promptChains.ts`

**Conceito:** Execução sequencial de prompts onde o output de um step é input do próximo.

**Estrutura:**
```typescript
interface PromptChainStep {
  order: number;
  name: string;
  prompt_template: string;  // Suporta {{variáveis}}
  expected_output?: string;
}
```

**Execução:**
```typescript
const stepOutputs: string[] = [];

for (const step of steps) {
  const filledPrompt = applyTemplate(step.prompt_template, {
    branding,
    briefing,
    step_1_output: stepOutputs[0],
    step_2_output: stepOutputs[1],
    previous_output: stepOutputs[stepOutputs.length - 1]
  });
  
  const result = await model.generateContent(filledPrompt);
  stepOutputs.push(result.response.text());
}
```

**Exemplo de Chain:**
```json
{
  "name": "Análise Profunda + Geração",
  "steps": [
    {
      "order": 1,
      "name": "Análise de Contexto",
      "prompt_template": "Analise o briefing: {{briefing}} e o DNA: {{branding}}"
    },
    {
      "order": 2,
      "name": "Geração de Ideias",
      "prompt_template": "Com base na análise: {{step_1_output}}, gere 10 ideias"
    },
    {
      "order": 3,
      "name": "Refinamento",
      "prompt_template": "Refine as ideias: {{step_2_output}} para formato de calendário"
    }
  ]
}
```

---

#### **3. Google Trends Integration** (`trends_service.py`)

**Localização:** `backend/python_gen/trends_service.py`

**Arquitetura:**
```
Node.js (calendar.ts)
    ↓ spawn()
Python Script (trends_cli.py)
    ↓ import
TrendsService (trends_service.py)
    ↓ pytrends
Google Trends API (realtime_trending_searches)
    ↓ JSON
Cache (trends_cache.json) - 24h TTL
    ↓
Node.js (injeta no prompt)
```

**Integração:**
```typescript
// backend/src/routes/calendar.ts
const fetchTrendsBlock = async (dnaKeywords, categorias) => {
  const pythonBin = fs.existsSync(venvPython) ? venvPython : "python3";
  const pythonScript = path.resolve(backendRoot, "python_gen", "trends_cli.py");
  
  const proc = spawn(pythonBin, [pythonScript, JSON.stringify(input)]);
  
  // Retorna trends filtrados por relevância ao DNA da marca
  return trendsBlock;
};
```

**Fallback Silencioso:** Se trends falhar, sistema continua sem eles.

---

### **Onde Residem os Ativos de IA (Item 6)**

| Ativo | Localização | Tipo | Acesso |
|-------|-------------|------|--------|
| **Prompt Chains** | `prompt_chains` (DB) | JSONB | API `/api/prompt-chains` |
| **Templates de Prompt** | `prompt_chains.steps` | JSONB | Embedded nos steps |
| **DNA da Marca** | `branding` (DB) | JSONB | API `/api/branding/:clientId` |
| **Documentos de Referência** | `brand_docs` (DB) | TEXT | API `/api/knowledge/:clientId` |
| **Regras da Marca** | `brand_rules` (DB) | TEXT | API `/api/knowledge/:clientId` |
| **Datas Comemorativas** | `datas_comemorativas` (DB) | DATE + JSONB | API `/api/datas-comemorativas` |
| **Google Trends Cache** | `python_gen/trends_cache.json` | JSON File | Python script |

**Interface de Gerenciamento:** `frontend/src/pages/KnowledgeBase.tsx`

---

## 5. 🔄 Workflow de Geração de Calendário

### **Fluxo Técnico Completo: "Gerar Calendário"**

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND: CalendarPage.tsx                                 │
└─────────────────────────────────────────────────────────────┘
    │
    │ 1. Usuário preenche formulário:
    │    ├── Briefing
    │    ├── Mês (abril 2026)
    │    ├── Período (30 dias ou 3 meses)
    │    ├── Mix de Conteúdo (reels: 1, static: 1, carousel: 1)
    │    ├── Prompt Chain (opcional)
    │    └── Instruções por formato
    │
    │ 2. Clica "Gerar Calendário"
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  API REQUEST: POST /api/generate-calendar                   │
│  Body: {                                                    │
│    clienteId: "uuid",                                       │
│    briefing: "campanhas de óculos 3D",                     │
│    mes: "abril 2026",                                       │
│    periodo: 30,                                             │
│    monthsCount: 3,                                          │
│    specificMonths: ["abril 2026", "maio 2026", "junho"],   │
│    mix: { reels: 1, static: 1, carousel: 1 },             │
│    chainId: "uuid-da-chain" (opcional)                     │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND: calendar.ts - router.post("/generate-calendar")  │
└─────────────────────────────────────────────────────────────┘
    │
    │ STEP 1: Buscar DNA da Marca
    ├─→ SELECT * FROM branding WHERE cliente_id = $1
    │   ├── visual_style (JSONB)
    │   ├── tone_of_voice (JSONB)
    │   ├── audience (JSONB)
    │   ├── keywords (TEXT[])
    │   ├── archetype (TEXT)
    │   └── niche (TEXT)
    │
    │ STEP 2: Buscar Documentos de Referência
    ├─→ SELECT * FROM brand_docs WHERE cliente_id = $1
    │   └── conteudo_texto (extraído de PDFs/manuais)
    │
    │ STEP 3: Buscar Regras da Marca
    ├─→ SELECT * FROM brand_rules WHERE cliente_id = $1 AND ativa = true
    │   └── regras (ex: "Nunca usar vermelho", "Tom sempre inspirador")
    │
    │ STEP 4: Buscar Categorias/Nicho do Cliente
    ├─→ SELECT categorias_nicho FROM clientes WHERE id = $1
    │   └── ["fitness", "saude", "bem-estar"]
    │
    │ STEP 5: Buscar Datas Comemorativas (filtradas por nicho)
    ├─→ SELECT * FROM datas_comemorativas 
    │   WHERE EXTRACT(MONTH FROM data) = $1
    │   AND categorias @> ANY($2)  -- filtro por nicho
    │   ORDER BY relevancia DESC
    │   └── Ex: "07/04/2026: Dia Mundial da Saúde"
    │
    │ STEP 6: Buscar Google Trends (se habilitado)
    ├─→ spawn(python, [trends_cli.py, JSON.stringify({
    │     dna_keywords: branding.keywords,
    │     categorias: categoriasNicho,
    │     config: { CACHE_DURATION_HOURS: 24 }
    │   })])
    │   ├── Python: TrendsService.buscar_trends_brasil()
    │   ├── Python: TrendsService.filtrar_trends_relevantes()
    │   └── Retorna: trends filtrados por relevância ao DNA
    │
    │ STEP 7: Executar Prompt Chain (se chainId fornecido)
    ├─→ SELECT * FROM prompt_chains WHERE id = $1
    │   ├── Para cada step:
    │   │   ├── Aplicar template com variáveis
    │   │   ├── Enviar para Gemini
    │   │   └── Armazenar output
    │   └── Output final vira contexto adicional
    │
    │ STEP 8: Montar Prompt Estruturado
    ├─→ Combinar todos os dados:
    │   ├── DNA da marca
    │   ├── Documentos de referência
    │   ├── Regras da marca
    │   ├── Datas comemorativas
    │   ├── Google Trends
    │   ├── Output da Prompt Chain
    │   ├── Briefing do cliente
    │   ├── Mix de conteúdo
    │   └── Instruções de formato JSON
    │
    │ STEP 9: Enviar para Google Gemini AI
    ├─→ GoogleGenerativeAI.getGenerativeModel("gemini-2.5-flash")
    │   ├── Fallback 1: gemini-1.5-flash
    │   ├── Fallback 2: gemini-1.5-pro
    │   └── Timeout: 60s por modelo
    │
    │ STEP 10: Parse da Resposta
    ├─→ cleanAndParseJSON(geminiResponse)
    │   ├── Remove markdown (```json)
    │   ├── Extrai JSON válido
    │   └── Valida estrutura
    │
    │ STEP 11: Salvar no Banco
    ├─→ INSERT INTO calendarios (
    │     cliente_id,
    │     mes,
    │     periodo,
    │     briefing,
    │     calendario_json,  -- Array de posts
    │     metadata          -- Branding usado, trends, etc
    │   ) VALUES (...)
    │
    │ STEP 12: Rastrear Uso de Tokens
    ├─→ updateTokenUsage(clienteId, tokensUsados)
    │   └── UPDATE clientes SET token_usage = ...
    │
    │ STEP 13: Retornar Resposta
    └─→ res.json({
          success: true,
          calendarioId: "uuid",
          dias: [...],
          metadata: {...}
        })
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND: CalendarPage.tsx                                 │
└─────────────────────────────────────────────────────────────┘
    │
    │ STEP 14: Renderizar Calendário
    ├─→ Recebe array de posts
    ├─→ Agrupa por semana
    ├─→ Renderiza grid de cards
    │   ├── Badge colorido por formato (Reels, Static, Carousel)
    │   ├── Tema do post
    │   ├── Copy inicial
    │   ├── Instruções visuais
    │   ├── CTA
    │   └── Palavras-chave
    │
    │ STEP 15: Permitir Edição
    ├─→ Modal de edição por post
    ├─→ Salva alterações no banco
    │   └── UPDATE calendarios SET calendario_json = ...
    │
    │ STEP 16: Exportar para Excel
    └─→ POST /api/calendars/export-excel
        ├── Seleciona meses (1 ou 3)
        ├── Merge de múltiplos calendários
        ├─→ spawn(python, [calendar_to_excel.py])
        └── Download do arquivo .xlsx
```

---

### **Timing Estimado**

| Etapa | Tempo Médio | Observações |
|-------|-------------|-------------|
| Busca de dados (DB) | 200-500ms | 6-8 queries paralelas |
| Google Trends | 2-4s | Cache: <100ms |
| Prompt Chain (3 steps) | 15-30s | Sequencial |
| Gemini AI (1 mês) | 10-20s | Depende do modelo |
| Gemini AI (3 meses) | 30-60s | 3 chamadas sequenciais |
| Parse + Salvar | 100-300ms | JSON parsing |
| **Total (1 mês)** | **15-30s** | Sem chain |
| **Total (3 meses)** | **45-90s** | Sem chain |
| **Total (com chain)** | **+15-30s** | Por chain |

---

## 📊 Resumo Executivo

### **Pontos Fortes da Arquitetura**

✅ **Multitenancy Eficiente:** Single DB com isolamento por `cliente_id`  
✅ **DNA Evolutivo:** Branding consolidado que melhora com o tempo  
✅ **IA Modular:** Prompt Chains permitem customização avançada  
✅ **Fallback Robusto:** Múltiplos modelos Gemini + fallback silencioso  
✅ **Cache Inteligente:** Google Trends com TTL de 24h  
✅ **Escalabilidade:** Índices otimizados para 30+ clientes  

### **Oportunidades de Melhoria**

⚠️ **Performance:** Geração de 3 meses é sequencial (30-60s)  
⚠️ **Resiliência:** Sem retry automático em falhas de IA  
⚠️ **Observabilidade:** Logs não estruturados (falta APM)  
⚠️ **Testes:** Cobertura de testes unitários baixa  
⚠️ **Documentação:** Falta OpenAPI/Swagger para APIs  

---

## 🔧 Stack Tecnológico

### **Backend**
- **Runtime:** Node.js 18+
- **Linguagem:** TypeScript 5.9
- **Framework:** Express 5.2
- **Database:** PostgreSQL 15+ (Docker)
- **ORM:** pg (node-postgres)
- **IA:** Google Gemini AI (@google/generative-ai)
- **Python:** 3.10+ (scripts auxiliares)
- **Bibliotecas Python:** pytrends, openpyxl, Pillow

### **Frontend**
- **Framework:** React 18
- **Linguagem:** TypeScript
- **Build Tool:** Vite 5
- **Styling:** Tailwind CSS 3.3
- **HTTP Client:** Axios
- **UI:** Dark Mode, Glassmorphism

### **Infraestrutura**
- **Database:** PostgreSQL 15+ (Docker)
- **Storage:** Sistema de arquivos local
- **Ports:**
  - Frontend: 3005
  - Backend: 3001
  - PostgreSQL: 5432
- **Deploy:** PM2 + Nginx (VPS)

---

**Documentação gerada em:** 06/01/2026  
**Versão do Sistema:** 1.0.0  
**Status:** ✅ Produção (30 clientes ativos)
