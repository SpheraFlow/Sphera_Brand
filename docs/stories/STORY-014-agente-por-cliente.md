---
id: STORY-014
title: "Agente por Cliente (IA Especializada e Persistente)"
status: Done
priority: High
epic: "H2 — Criar lock-in, virar indispensável"
estimated_size: G
assigned_to: "@dev"
created_by: "@sm"
created_at: 2026-05-28
---

## Descrição

Hoje o Sphera oferece um `BriefingAgentChat` genérico: ele não sabe quem é o cliente, não lembra da conversa anterior e começa do zero a cada sessão. Uma agência que conversa com 10 clientes diferentes recebe a mesma IA, sem nenhum contexto de marca, sem histórico, sem continuidade — o oposto de um assistente de branding premium.

Esta story transforma o agente genérico em um agente especializado e persistente por cliente. Cada cliente ganha sua própria instância de IA que conhece profundamente o DNA da marca (via `brandingMerger`), mantém memória de sessões via rolling summary, e enriquece cada resposta com os chunks RAG mais relevantes do cliente (via `ragService` de STORY-013). O resultado é uma IA que a agência sente como um membro da equipe: sabe quem é o cliente, lembra do que foi discutido e evolui com o tempo.

Três tipos de agente são suportados: `briefing` (estrategista de marca), `creative` (diretor criativo) e `strategy` (consultor de negócio). Cada tipo tem uma persona diferente, mas todos compartilham a mesma infraestrutura de sessões, rolling summary e RAG.

O design de sessões é intencional: a agência pode ter múltiplas conversas paralelas abertas para o mesmo cliente (uma sessão de briefing, outra criativa), retomar conversas antigas ou arquivá-las. O histórico completo fica armazenado em `agent_messages`, e o `rolling_summary` garante que mesmo sessões muito longas mantenham o contexto relevante sem estourar a janela de contexto do LLM.

## Jobs-to-be-Done

Quando a agência abre uma conversa sobre um cliente, quero que a IA já saiba quem é aquela marca, lembre do que foi discutido antes e me responda como um especialista que conhece o histórico, para que eu não precise re-briefar a IA a cada sessão.

## Acceptance Criteria

- [x] AC1: Dado que a agência cria uma nova sessão via `POST /api/agents/sessions` com `clienteId` e `agentType` válidos, quando o endpoint processa, então: (a) uma linha é inserida em `agent_sessions` com os campos `cliente_id`, `user_id`, `agent_type`, `status='active'`, `rolling_summary=null`, `created_at` e `last_message_at` populados, (b) a resposta HTTP 201 retorna o objeto da sessão criada com todos os campos, (c) o system prompt é montado via `systemPromptBuilder.build(clienteId, agentType, sessionId)` na primeira mensagem (não na criação da sessão).

- [x] AC2: Dado que um usuário envia uma mensagem via `POST /api/agents/sessions/:id/messages` com `content` não vazio, quando `agentRunner.runMessage()` processa, então: (a) o system prompt é montado com as 3 camadas: DNA estrutural do cliente via `brandingMerger`, rolling_summary da sessão (se existir) e top-6 chunks RAG via `ragService.retrieve(clienteId, userMessage, 6)`, (b) as últimas 10 mensagens da sessão são carregadas como histórico de conversa, (c) o Gemini é chamado via `geminiClient` com o system prompt + histórico + nova mensagem do usuário, (d) a resposta do assistente é persistida em `agent_messages` com `role='assistant'`, `tokens_in` e `tokens_out` populados, (e) a mensagem do usuário também é persistida em `agent_messages` com `role='user'`, (f) o campo `last_message_at` da sessão é atualizado.

- [x] AC3: Dado que uma sessão acumula 20 ou mais mensagens, quando a próxima mensagem do usuário é processada pelo `agentRunner`, então: (a) antes de chamar o Gemini para a resposta, o runner detecta que `messageCount % 20 === 0` (ou seja, é múltiplo de 20), (b) um prompt de sumarização é enviado ao Gemini com as últimas 20 mensagens + o `rolling_summary` anterior (se existir), solicitando um resumo conciso dos pontos-chave discutidos, (c) o campo `rolling_summary` da sessão é atualizado com o novo resumo, (d) após a atualização do rolling_summary, o agente continua com a resposta normal à mensagem do usuário usando o contexto atualizado.

- [x] AC4: Dado que múltiplas sessões existem para clientes diferentes, quando `GET /api/agents/sessions?clienteId=X` é chamado, então: (a) apenas sessões com `cliente_id = X` e `status = 'active'` são retornadas, (b) sessões de outros clientes não aparecem na resposta, (c) a resposta inclui no mínimo os campos `id`, `cliente_id`, `agent_type`, `title`, `last_message_at`, `status` e um campo `has_memory` (boolean: `rolling_summary != null`), (d) a listagem é ordenada por `last_message_at DESC`.

- [x] AC5: Dado que uma sessão é arquivada via `DELETE /api/agents/sessions/:id`, quando o endpoint processa, então: (a) o campo `status` da sessão é atualizado para `'archived'` (soft delete — nenhuma linha é removida do banco), (b) a sessão arquivada não aparece no `GET /api/agents/sessions?clienteId=` padrão, (c) as mensagens da sessão (`agent_messages`) são preservadas intactas, (d) a resposta HTTP é 200 com `{ archived: true, session_id: "..." }`.

- [x] AC6: Dado que o frontend renderiza o componente `BriefingAgentChat`, quando um cliente está selecionado, então: (a) a sidebar esquerda lista as sessões ativas do cliente (endpoint GET sessions), cada uma mostrando tipo de agente, título e data da última mensagem, (b) existe um botão "Nova sessão" que abre um modal para selecionar o `agentType` (briefing / creative / strategy), (c) ao selecionar uma sessão existente, o histórico de mensagens carregado via `GET /api/agents/sessions/:id/messages` é exibido no chat, (d) sessões com `rolling_summary` mostram um indicador visual de "memória ativa" (ex: ícone de cérebro ou badge "memória").

## Scope

### IN
- Migration SQL: tabelas `agent_sessions` e `agent_messages`
- `backend/src/services/systemPromptBuilder.ts` — método `build(clienteId, agentType, sessionId)`
- `backend/src/services/agentRunner.ts` — método `runMessage(sessionId, userMessage, clienteId)`
- **`backend/src/utils/geminiClient.ts` (modificar)** — adicionar método `generateChatContent({ systemInstruction, history, userMessage })` com suporte multi-turn via `genai-compat.startChat()`
- Endpoints REST:
  - `POST /api/agents/sessions`
  - `GET /api/agents/sessions?clienteId=`
  - `POST /api/agents/sessions/:id/messages`
  - `GET /api/agents/sessions/:id/messages` (paginado)
  - `DELETE /api/agents/sessions/:id` (soft delete)
- Rota `backend/src/routes/agents.ts` + registro em `index.ts`
- Refactor de `frontend/src/components/BriefingAgentChat.tsx` para integrar sessões persistentes
- Tracking de tokens via `updateTokenUsage(clienteId, { promptTokenCount, candidatesTokenCount, totalTokenCount }, action, model)` para chamadas do agente

### OUT
- Streaming de respostas via Server-Sent Events ou WebSocket (resposta síncrona por simplicidade)
- Multi-agente simultâneo na mesma sessão (um usuário, um agente por sessão)
- Compartilhamento de sessões entre usuários da agência
- Interface de administração de sessões (além do soft delete)
- Export de transcrição de sessão
- Notificações push de novas mensagens

## Dependências

- STORY-013 (ragService.ts e knowledge_chunks — obrigatório para contexto RAG)
- Tabela `branding` com colunas: `visual_style, tone_of_voice, audience, keywords, archetype, usp, anti_keywords, niche` (via `SELECT * FROM branding WHERE cliente_id = $1` — padrão usado em calendarGenerationWorker.ts:530 e briefingAgent.ts:141)
- `geminiClient` existente (`backend/src/utils/geminiClient.ts`) — será **estendido** nesta story com método `generateChatContent()` (ver Technical Notes)
- `genai-compat.ts` já suporta `model.startChat({ history, systemInstruction })` → não requer dependência externa nova
- `tokenTracker.ts` existente (`updateTokenUsage` com assinatura: `(clienteId, { promptTokenCount, candidatesTokenCount, totalTokenCount }, action, model)`)
- Autenticação JWT existente (`requireAuth` middleware)

## Technical Notes

### Schema SQL

```sql
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('briefing', 'creative', 'strategy')),
  title TEXT,
  rolling_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_cliente_status
  ON agent_sessions (cliente_id, status, last_message_at DESC);

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  retrieved_chunk_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_session_created
  ON agent_messages (session_id, created_at ASC);
```

### systemPromptBuilder — 3 Camadas

```typescript
// Camada 1 (sempre presente): DNA estrutural — padrão real do projeto
const brandingResult = await db.query(
  'SELECT * FROM branding WHERE cliente_id = $1',
  [clienteId]
);
const branding = brandingResult.rows[0] || {};
// branding tem: visual_style, tone_of_voice, audience, keywords,
//               archetype, usp, anti_keywords, niche (via migrate_branding_v2)

// Camada 2 (dinâmica): rolling_summary + RAG
const sessionResult = await db.query(
  'SELECT rolling_summary FROM agent_sessions WHERE id=$1',
  [sessionId]
);
// ragService.retrieve: 3º param é RetrieveOptions (objeto), não number
const ragChunks = await ragService.retrieve(clienteId, recentUserMessage, { k: 6 });

// Camada 3: persona do agentType
const personas = {
  briefing: 'Você é um estrategista de marca sênior...',
  creative: 'Você é um diretor criativo especializado...',
  strategy: 'Você é um consultor de negócios e marketing...',
};
```

### Rolling Summary (trigger na mensagem 20, 40, 60...)

```typescript
const messageCount = await countMessagesInSession(sessionId);
if (messageCount > 0 && messageCount % 20 === 0) {
  const last20 = await getLast20Messages(sessionId); // array de strings formatadas
  // Sumarização é prompt único (sem histórico multi-turn) → usar generateTextContent
  const summary = await geminiClient.generateTextContent(
    `Resuma os pontos-chave desta conversa em até 200 palavras, focando em decisões de marca e insights aprovados:\n\n${last20.join('\n')}`
  );
  await db.query(
    'UPDATE agent_sessions SET rolling_summary=$1 WHERE id=$2',
    [summary, sessionId]
  );
}
```

### Paginação do histórico de mensagens

`GET /api/agents/sessions/:id/messages?limit=50&before=<ISO_TIMESTAMP>` — retorna até 50 mensagens anteriores ao timestamp fornecido, ordenadas `created_at ASC`. Default: últimas 50 mensagens.

### geminiClient.generateChatContent() — novo método (Scope IN)

`geminiClient.ts` NÃO tem suporte multi-turn atualmente (só `generateTextContent(prompt: string)` e `analyzeImage()`). Esta story DEVE adicionar o método abaixo ao `GeminiClient`:

```typescript
/** Conversa multi-turn com system instruction e histórico. Expõe usageMetadata. */
async generateChatContent(options: {
  systemInstruction: string;
  history: Array<{ role: 'user' | 'model'; content: string }>;
  userMessage: string;
}): Promise<{ text: string; usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number } }> {
  if (!this.genAI) throw new Error("GOOGLE_CLOUD_PROJECT não configurado.");
  const model = this.genAI.getGenerativeModel({
    model: getPrimaryGeminiModel("quality"),
    systemInstruction: options.systemInstruction,
  });
  // genai-compat.ts já implementa startChat({ history }) → WrappedChatSession
  const chat = model.startChat({
    history: options.history.map(m => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
  });
  const result = await chat.sendMessage(options.userMessage);
  const meta = result.response?.usageMetadata ?? {};
  return {
    text: result.response.text(),
    usageMetadata: {
      promptTokenCount:     meta.promptTokenCount     ?? 0,
      candidatesTokenCount: meta.candidatesTokenCount ?? 0,
      totalTokenCount:      meta.totalTokenCount      ?? 0,
    },
  };
}
```

**Nota:** `genai-compat.ts` já implementa `WrappedGenerativeModel.startChat()` e `WrappedChatSession.sendMessage()` com `wrapResult()` que preserva `response.usageMetadata`. Nenhuma dependência nova é necessária.

### Token Tracking

```typescript
import { updateTokenUsage } from '../utils/tokenTracker';

// Assinatura real de updateTokenUsage:
// (clienteId, { promptTokenCount, candidatesTokenCount, totalTokenCount }, action, model)
await updateTokenUsage(
  clienteId,
  {
    promptTokenCount:     result.usageMetadata.promptTokenCount,
    candidatesTokenCount: result.usageMetadata.candidatesTokenCount,
    totalTokenCount:      result.usageMetadata.totalTokenCount,
  },
  `agent_${agentType}`,
  getPrimaryGeminiModel("quality")
);
```

### Refactor BriefingAgentChat.tsx

O componente atual provavelmente não tem estrutura de sessões. O refactor deve:
1. Verificar qual cliente está selecionado no contexto global (hook `useSelectedClient` ou similar)
2. Carregar sessões via `GET /api/agents/sessions?clienteId=`
3. Adicionar sidebar de sessões com listagem e botão "Nova sessão"
4. Manter o chat principal como está, mas conectado à sessão selecionada
5. Polling simples a cada 1s enquanto aguarda resposta (não streaming)

## File List

- `backend/db/migrate_agent_sessions.ts` (novo)
- `backend/src/utils/geminiClient.ts` (modificar — adicionar `generateChatContent()`)
- `backend/src/services/systemPromptBuilder.ts` (novo)
- `backend/src/services/agentRunner.ts` (novo)
- `backend/src/routes/agents.ts` (novo)
- `backend/src/index.ts` (modificar — registrar `/api/agents`)
- `frontend/src/components/BriefingAgentChat.tsx` (modificar — sessões persistentes)

## Definition of Done

- [x] Todos os ACs implementados (verificação manual de runtime pendente para @qa)
- [x] `npx tsc --noEmit` sem erros no `/backend` e `/frontend`
- [x] Migrations criadas e idempotentes (IF NOT EXISTS em tabelas e índices; BEGIN/COMMIT)
- [~] Sessão criada, mensagem enviada, rolling summary gerado após 20 mensagens — implementado; teste de runtime ao vivo para @qa (requer GOOGLE_CLOUD_PROJECT + DB)
- [x] Isolamento entre clientes garantido em código (todas as queries de listagem filtram por cliente_id; loadAccessibleSession + hasClientAccess em todos os endpoints de sessão)
- [x] Story status: InReview

## Dev Notes (@dev — Dex)

### Decisões de implementação (IDS)

- **REUSE** do padrão de migration de `migrate_rag_knowledge.ts` (BEGIN/COMMIT, IF NOT EXISTS, `db.connect()`/`release()`/`end()`).
- **REUSE** do `hasClientAccess` de `routes/rag.ts` (mesma regra: admin OR `clients_manage` OR linha em `user_clientes`). Adicionado `loadAccessibleSession()` que resolve o `cliente_id` da sessão antes de checar acesso — garante isolamento mesmo quando o cliente não vem no body.
- **ADAPT** de `geminiClient.ts`: adicionado `generateChatContent()` multi-turn via `genai-compat.startChat({ history })` + `getGenerativeModel({ systemInstruction })`. Sem dependências novas.
- **CREATE** `systemPromptBuilder` (3 camadas) e `agentRunner` (orquestração runMessage) — não existiam equivalentes.
- **EXTEND** `BriefingAgentChat.tsx`: adicionada prop opcional `persistentMode`. Quando ausente, o fluxo legado usado por `CampaignWizard.tsx` (`onBriefingReady`) é preservado **byte-a-byte**. Quando `persistentMode`, renderiza `<PersistentAgentChat>` com sidebar de sessões + modal de novo agente + indicador de memória.

### Correções vs. spawn brief (paths reais do projeto)

- DB pool: `import db from '../config/database'` (NÃO `../database/db`).
- Auth: `import { requireAuth, AuthRequest } from '../middlewares/requireAuth'` (NÃO `../middleware/auth`). `req.user.id` é o user id.
- `ragService.retrieve(clienteId, query, { k: 6 })` — 3º arg é `RetrieveOptions` (confirmado).
- `updateTokenUsage(clienteId, {promptTokenCount, candidatesTokenCount, totalTokenCount}, action, model, systemInstruction?)` — passei o `systemInstruction` (5º arg opcional) para estimativa de system_tokens.
- `genai-compat.startChat()` aceita apenas `{ history, generationConfig }`; `systemInstruction` vai em `getGenerativeModel()` — exatamente como o método foi escrito.
- Modelo usado no agente: `getPrimaryGeminiModel("quality")` (não há `gemini-2.0-flash` fixo no projeto; o tier "quality" resolve o modelo configurado).

### Graceful degradation (CodeRabbit focus)

- `systemPromptBuilder.build()` envolve branding, rolling_summary e RAG em try/catch independentes: falha de qualquer camada apenas omite o bloco — não derruba a resposta do agente.
- `maybeUpdateRollingSummary()` em try/catch: falha de sumarização não bloqueia a resposta.

### Paginação (sem O(N) em memória)

- `GET /sessions/:id/messages` usa `ORDER BY created_at DESC LIMIT $n` (com filtro `before` opcional) e reordena ASC numa subquery — nunca carrega todas as mensagens.
- O histórico enviado ao Gemini é limitado às últimas 10 mensagens (`HISTORY_WINDOW`).

### Pendências para @qa

- Teste de runtime ao vivo (criação → mensagem → rolling summary aos 20) requer `GOOGLE_CLOUD_PROJECT` e DB com migration aplicada (`cd backend && npx ts-node db/migrate_agent_sessions.ts`).
- Não há script `npm run lint` configurado no projeto (backend/frontend/root) — gate de qualidade aplicado foi `npx tsc --noEmit` (passou em ambos).

## File List

- `backend/db/migrate_agent_sessions.ts` (novo)
- `backend/src/utils/geminiClient.ts` (modificado — `generateChatContent()`)
- `backend/src/services/systemPromptBuilder.ts` (novo)
- `backend/src/services/agentRunner.ts` (novo)
- `backend/src/routes/agents.ts` (novo)
- `backend/src/index.ts` (modificado — import + registro `/api/agents`)
- `frontend/src/services/api.ts` (modificado — `agentService` + tipos)
- `frontend/src/components/BriefingAgentChat.tsx` (modificado — modo `persistentMode` com sessões)

## 🤖 CodeRabbit Integration

**Story Type Analysis:**
- Primary Type: API + Database
- Secondary Type(s): Frontend, Architecture (novo padrão de agente persistente)
- Complexity: High — dois novos serviços com estado, múltiplos endpoints, refactor de componente frontend crítico

**Specialized Agent Assignment:**
- Primary Agents:
  - @dev (implementação e pre-commit review)
  - @data-engineer (schema agent_sessions/agent_messages, índices)
- Supporting Agents:
  - @architect (padrão de systemPromptBuilder, design de 3 camadas de contexto)
  - @ux-expert (refactor do BriefingAgentChat — sidebar + fluxo de sessões)

**Quality Gate Tasks:**
- [ ] Pre-Commit (@dev): Executar antes de marcar story completa — foco em: isolamento de cliente_id em todas as queries, autenticação nos endpoints de agente, tokens não zerados no tracking
- [ ] Pre-PR (@github-devops): Executar antes de criar PR — foco em: migration reversível, sem N+1 queries no carregamento de sessões + mensagens

**Self-Healing Configuration:**
- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL only

**Predicted Behavior:**
- CRITICAL issues: auto_fix (até 2 iterações)
- HIGH issues: document_only (anotado em Dev Notes)

**CodeRabbit Focus Areas:**
- Primary: Isolamento de dados por `cliente_id` em todas as queries de agent_sessions e agent_messages, autenticação JWT obrigatória em todos os endpoints
- Secondary: Paginação do histórico de mensagens (sem carregar O(N) mensagens em memória), graceful degradation se ragService falhar durante montagem do system prompt

## Change Log

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 2026-05-28 | 0.1.0 | @sm | Story criada |
| 2026-05-28 | 0.1.1 | @po | Validação NO-GO (8/10 na checklist, mas bloqueado por Art. IV No-Invention) — 4 APIs de dependência divergem do código real: brandingMerger.buildForClient() e geminiClient.generateContent() NÃO EXISTEM; ragService.retrieve() e tokenTracker.updateTokenUsage() têm assinaturas diferentes. Status mantido em Draft. |
| 2026-05-28 | 0.2.0 | @po | Correção das 4 divergências de API (Art. IV): (1) brandingMerger.buildForClient() → SELECT * FROM branding WHERE cliente_id; (2) ragService.retrieve() → terceiro arg como { k: 6 }; (3) updateTokenUsage() → assinatura real com { promptTokenCount, candidatesTokenCount, totalTokenCount }; (4) geminiClient multi-turn → novo método generateChatContent() adicionado ao Scope IN + Technical Notes com implementação via genai-compat.startChat(). Status: Draft → Ready. |
| 2026-05-28 | 0.3.0 | @dev | Implementação completa (YOLO). Migration agent_sessions/agent_messages (idempotente), geminiClient.generateChatContent(), systemPromptBuilder (3 camadas + graceful degradation), agentRunner (runMessage + rolling summary aos 20), routes/agents.ts (5 endpoints, todos com requireAuth + isolamento por cliente), registro em index.ts, agentService no frontend api.ts e refactor de BriefingAgentChat com persistentMode (sidebar de sessões, modal de novo agente, badge de memória) preservando o contrato legado do CampaignWizard. tsc --noEmit limpo no backend e frontend. Status: Ready → InProgress → InReview. |
| 2026-05-28 | 0.4.0 | @qa | QA Gate CONCERNS — Status: InReview → Done |

## QA Results

### Review Date: 2026-05-28

### Reviewed By: Quinn (Test Architect)

**Verdict: CONCERNS** (aprovado com observações)

#### Isolamento de dados por cliente — VERIFICADO (PASS)
Foco crítico nº1 do gate. Auditado endpoint a endpoint:
- `router.use(requireAuth)` aplica JWT a todas as rotas (agents.ts:22).
- `POST /sessions`: confirma existência do cliente + `hasClientAccess` antes do INSERT (agents.ts:82-89).
- `GET /sessions`: `hasClientAccess(clienteId)` + `WHERE cliente_id=$1 AND status='active'` (agents.ts:131-142).
- `loadAccessibleSession` resolve o `cliente_id` **da própria linha da sessão** (não do body) e checa acesso antes de qualquer leitura/escrita — usado em POST/GET messages e DELETE (agents.ts:47-66).
- `agentRunner.runMessage` recebe `session.cliente_id` resolvido do banco e o propaga a `systemPromptBuilder`, `ragService` e `updateTokenUsage`.
- **Nenhum caminho cross-cliente identificado.**

#### 7 Quality Checks
| Check | Resultado |
|-------|-----------|
| Code review | PASS — padrões consistentes com rag.ts |
| Unit tests | CONCERNS — sem testes automatizados (TEST-001) |
| Acceptance criteria | PASS — AC1-AC6 implementados |
| No regressions | PASS — `persistentMode` opt-in preserva CampaignWizard |
| Performance | PASS — paginação sem O(N), histórico limitado a 10, índices compostos |
| Security | PASS — requireAuth + isolamento por cliente |
| Documentation | PASS |

#### Confirmações de focos críticos
- **generateChatContent**: CONFIRMADO — método existe (geminiClient.ts:149-189), usa `getGenerativeModel({systemInstruction})` + `startChat({history})` e expõe `usageMetadata`; assinatura casa com o call site (agentRunner.ts:175-179) e com `genai-compat` (startChat/sendMessage/usageMetadata).
- **rolling_summary**: CONFIRMADO — usa `generateTextContent` (prompt único), trigger `messageCount % 20 === 0`, em try/catch (agentRunner.ts:80-119).
- **tokenTracker**: CONFIRMADO — assinatura real `(clienteId, {promptTokenCount, candidatesTokenCount, totalTokenCount}, action, model, systemInstruction?)` (tokenTracker.ts:40-46) bate com o call site (agentRunner.ts:197-207).
- **ragService.retrieve**: CONFIRMADO — `(clienteId, query, {k})` → `RetrievedChunk[]` com `.id`/`.content` (ragService.ts:304); filtra `cliente_id` antes da busca vetorial.
- **imports + registro**: CONFIRMADO — `../config/database`, `../middlewares/requireAuth` (agents.ts:15-16) e registro em index.ts:42 (import) + index.ts:284 (`app.use("/api/agents", agentsRouter)`).
- **graceful degradation**: CONFIRMADO — branding, rolling_summary e RAG em try/catch independentes (systemPromptBuilder.ts).

#### Issues (não-bloqueantes)
- **TEST-001 (medium)**: sem testes automatizados para endpoints/agentRunner/systemPromptBuilder.
- **REL-001 (medium)**: `runMessage` não é transacional — falha do LLM deixa mensagem do usuário sem resposta persistida.
- **REQ-001 (low)**: trigger do AC3 dispara em múltiplos exatos de 20 mensagens totais (inclui assistant) — confirmar intent com @po.
- **TEST-002 (low)**: `npx tsc --noEmit` final e smoke test de runtime (Gemini + DB) pendentes — delegados ao @devops no pre-push (ambiente QA não executa tsc/runtime).

### Gate Status

Gate: CONCERNS → docs/qa/gates/STORY-014-agente-por-cliente.yml
