# Estratégia Baseada no "Estado da Arte": Geração de Calendários IA (Março/2026)

Este documento descreve como sistemas de ponta estão gerando calendários editoriais e planejando conteúdo digital agora no início de 2026. A visão atual abandonou os "megaprompts estáticos" em favor de ecossistemas **multi-agentes orquestrados**, **recuperação contextual avançada (RAG)** e **garantia matemática de outputs**.

Ao analisar o código base de `Sphera_Brand`, confirmamos: **Atualmente não estamos usando *Embeddings* nem *Vector Stores* nativamente na montagem do calendário**. Os dados de referência (rules, docs do DNA) são extraídos via queries SQL brutas na tabela `brand_docs` e injetados de forma crua como string gigantesca no prompt. O banco PostgreSQL (versão 15+) consta na arquitetura, mas sua mecânica vetorial ou de busca híbrida por cos-similaridade não está ativa na timeline vital do `calendarGenerator.ts`.

---

## 🚀 Paradigma 2026: O Que Mudou no Planejamento de Conteúdo?

A arquitetura moderna que você deve exigir do seu time de engenharia foca em três pilares principais:

### 1. Garantia Estrita de Dados: "Structured Outputs / JSON Schema"

No fluxo atual do `Sphera`, o backend envia uma string em linguagem natural pedindo "Gere um array com estas chaves...". Depois há um script robusto ("cleanAndParseJSON") que usa Expressões Regulares (Regex) para tentar consertar quando a IA resolve mandar um markdown "Aqui está o seu código: ```json...".

* **A Prática 2026:** Prompts baseados em **Structured Outputs**. Ferramentas como Gemini 2.5 e OpenAI GPT-4o agora suportam nativamente um `Response Schema`. Você força a API no nível do servidor a só devolver exatamente a tipagem que você definiu no código (usando Zod/TypeScript). 
* **Impacto:** Fim das falhas 500 no parser, eliminação do código de limpeza inseguro e garantia matemática (100% de sucesso) de que os dias do mês nunca pularão e os formatos de post (Reels, Carrossel) existirão. O modelo não precisa mais focar esforço cognitivo em "aprender a formatar JSON"; ele foca apenas na criatividade do conteúdo.

### 2. Recuperação de Contexto Híbrida e Inteligente (Contextual/Advanced RAG)

Hoje, o `calendarGenerator.ts` despeja *TODO O CONHECIMENTO CADASTRADO DO CLIENTE* no prompt (Brand Docs, Regras, Palavras Negativadas, etc). Se a marca tiver 100 páginas de referências visuais de campanhas anteriores (o PDF do brandbook), o LLM vai ler as 100 páginas a cada request *de cada mês* gerado.

* **A Prática 2026:** Em 2026 dominamos arquiteturas de Contextual Retrieval (como MiA-RAG ou Chunking Semântico). Além da busca vetorial pura (Embeddings), usa-se busca híbrida (Keyword + Similaridade) e *Reranking*.
* **A Aplicação:** Em vez de jogar o PDF inteiro no `System_Prompt`, executamos um passo leve primeiro: *"Quais temas o usuário quer focar neste mês em específico (ex: Dia das Mães)?"*. A resposta desse agente é transformada num "Embedding" de busca (HyDE) e busca apenas os trechos exatos dos PDFs e arquivos do cliente no PostgreSQL (`pgvector` ativado no modo cos-similarity).
* **Impacto:** O modelo primário fica incrivelmente mais acurado, porque a "Atenção" (Attention Mechanism) dele não se dispersa no meio de laudas de texto irrelevantes.

### 3. Orquestração Multi-Agente (Agentic Frameworks) Em Vez De Single-Shot

No `Sphera`, para o calendário gerar UM post carrossel brilhante, um único prompt massivo tenta fazer o Gemini atuar como "Copywriter", "Estrategista de SEO" e "Diretor de Arte" na *mesma chamada do laço de repetição* (`generateCalendarForMonth`).

* **A Prática 2026:** Os grandes calendários de B2B segregaram a mente mecânica. Usa-se sistemas multi-agentes orquestrados (onde LLMs funcionam como componentes especializados, não ferramentas genéricas).
* **A Aplicação (Workflow Pipe):**
  1. `<The Macro Planner>` (Veloz/Barato - ex: Gemini Flash): Só decide *o quê* e *quando*. ("Dia 5; Formato: Carrossel; Tema: Como ensinar código cedo."). E cospe este JSON mínimo.
  2. `<Worker Threads (Promise.all)>`: A partir daí, o código dispara dezenas de requisições paralelas (uma para cada post) delegando para:
     - um *Sub-Agente Diretor de Arte* (focado apenas no descritivo visual detalhado)
     - um *Sub-Agente Copywriter* (focado apenas na persuasão)
* **Impacto:** A inteligência da copy escala absurdamente com a especialização. E, por rodar em instâncias assíncronas concorrentes, o tempo de geração de todo o período, seja 1 ou 3 meses, ocorre em uma fração ínfima do tempo do laço sequencial síncrono.

---

## 🎯 Proposta de Plano de Ação para Implementação

Caso você queira implementar este fluxo mais veloz e blindado no `Sphera` ou levá-lo para a mesa do seu gerente de projetos, este seria o Checklist Técnico prioritário:

1. **Implementar Structured Outputs Puros:** Mapear a interface `CalendarItems` em `z.object()` usando o pacote `zod`. Trocar a string brutal textual de concatenação por *System Instructions* nativas separadas dos dados do usuário (`gemini.createContent({ systemInstruction: coreDNA, parts: [...] })`). A Google garante o JSON.
   
2. **Ativar Busca Vetorial (pgvector):** O PostgreSQL 15 já suporta e foi provisionado. Crie as colunas `embedding vector(1536)`. Toda vez que o usuário *uploadar* um PDF ou cadastrar um novo Rulebook grande, converta no backend (via `text-embedding-004`) em vetores. Na hora de processar o calendário de Maio (exemplo, mês das mães), puxe apenas fragmentos vetoriais relevantes à temática, e não todo o livro de receitas da marca.

3. **Paralelismo Assíncrono:** Quebre o loop monstruoso que faz o "mês 2" ficar esperando o "mês 1" terminar. Crie um Workflow Builder onde os meses são mapeados de forma concorrente em Node.js (`await Promise.allSettled(mesesMapeados.map(gerarMes))`), reduzindo a latência global da aplicação para frações de segundos em vez de minutos.

A integração destas táticas resolve o desperdício de tokens na Janela de Contexto, elimina por completo "Erros de Parse (500)" e moderniza a arquitetura para suportar calendários colossais baseados puramente no poder dos grafos lógicos em rede, sem depender da sorte de um mega-prompt.
