/**
 * STORY-014 — systemPromptBuilder
 *
 * Monta o system prompt do agente especializado por cliente em 3 camadas:
 *
 *   Camada 1 (sempre presente): DNA estrutural da marca
 *     SELECT * FROM branding WHERE cliente_id = $1
 *     (padrão real usado em calendarGenerationWorker.ts e briefingAgent.ts)
 *
 *   Camada 2 (dinâmica): memória de sessão + conhecimento RAG
 *     - rolling_summary da sessão (se existir)
 *     - top-k chunks RAG via ragService.retrieve(clienteId, query, { k })
 *       com graceful degradation: se o RAG falhar, o prompt segue sem ele.
 *
 *   Camada 3: persona do tipo de agente (briefing | creative | strategy)
 *
 * Isolamento por cliente: todas as queries filtram por cliente_id; o RAG já
 * isola internamente por cliente.
 */
import db from "../config/database";
import logger from "../utils/logger";
import { ragService } from "./ragService";

const builderLog = logger.child({ component: "systemPromptBuilder" });

export type AgentType = "briefing" | "creative" | "strategy";

export const AGENT_TYPES: readonly AgentType[] = ["briefing", "creative", "strategy"] as const;

export const isValidAgentType = (v: unknown): v is AgentType =>
  typeof v === "string" && (AGENT_TYPES as readonly string[]).includes(v);

/** Quantos chunks RAG injetar no contexto por mensagem. */
const RAG_TOP_K = 6;

/** Persona base de cada tipo de agente (Camada 3). */
const PERSONAS: Record<AgentType, string> = {
  briefing:
    "Você é um estrategista de marca sênior. Seu papel é conduzir conversas de " +
    "briefing profundas, fazendo perguntas perspicazes e ajudando a agência a " +
    "destilar a essência da marca do cliente. Seja consultivo, direto e foque em " +
    "decisões acionáveis de posicionamento, mensagem e diferenciação.",
  creative:
    "Você é um diretor criativo especializado em conteúdo para redes sociais e " +
    "campanhas de marca. Seu papel é gerar ideias visuais e de copy alinhadas ao " +
    "DNA do cliente, propor conceitos de campanha e refinar execuções criativas. " +
    "Seja inspirador, concreto e sempre fiel ao tom de voz e estilo visual da marca.",
  strategy:
    "Você é um consultor de negócios e marketing. Seu papel é analisar o contexto " +
    "do cliente sob a ótica de crescimento, posicionamento competitivo e ROI. " +
    "Conecte decisões de marca a objetivos de negócio e ofereça recomendações " +
    "estratégicas fundamentadas no DNA e no histórico do cliente.",
};

/** Resultado da montagem: o prompt + os ids dos chunks RAG usados (para auditoria). */
export interface BuiltSystemPrompt {
  systemInstruction: string;
  retrievedChunkIds: string[];
}

/**
 * Formata o DNA estrutural da marca (Camada 1) num bloco de texto legível pelo LLM.
 * Campos esperados (via migrate_branding_v2): visual_style, tone_of_voice,
 * audience, keywords, archetype, usp, anti_keywords, niche.
 */
const formatBrandingBlock = (branding: Record<string, any>, clienteNome?: string): string => {
  const lines: string[] = [];
  if (clienteNome) lines.push(`Cliente: ${clienteNome}`);

  const fieldLabels: Array<[string, string]> = [
    ["niche", "Nicho"],
    ["archetype", "Arquétipo"],
    ["usp", "Proposta única de valor (USP)"],
    ["audience", "Público-alvo"],
    ["tone_of_voice", "Tom de voz"],
    ["visual_style", "Estilo visual"],
    ["keywords", "Palavras-chave"],
    ["anti_keywords", "Palavras a evitar (anti-keywords)"],
  ];

  for (const [key, label] of fieldLabels) {
    const raw = branding?.[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = Array.isArray(raw) ? raw.join(", ") : String(raw).trim();
    if (!value) continue;
    lines.push(`${label}: ${value}`);
  }

  if (lines.length === 0) {
    return "DNA da marca ainda não preenchido. Conduza a conversa para ajudar a agência a definir esses elementos.";
  }
  return lines.join("\n");
};

/**
 * Monta o system prompt completo para uma mensagem do agente.
 *
 * @param clienteId    Cliente dono da sessão (isolamento)
 * @param agentType    Tipo de agente (define a persona)
 * @param sessionId    Sessão atual (para carregar rolling_summary)
 * @param recentUserMessage Texto da última mensagem do usuário (query do RAG)
 */
export const systemPromptBuilder = {
  async build(
    clienteId: string,
    agentType: AgentType,
    sessionId: string,
    recentUserMessage: string
  ): Promise<BuiltSystemPrompt> {
    // ── Camada 1: DNA estrutural ──────────────────────────────────────────
    let branding: Record<string, any> = {};
    let clienteNome: string | undefined;
    try {
      const brandingResult = await db.query(
        "SELECT * FROM branding WHERE cliente_id = $1",
        [clienteId]
      );
      branding = brandingResult.rows[0] || {};
      const clientResult = await db.query("SELECT nome FROM clientes WHERE id = $1", [clienteId]);
      clienteNome = clientResult.rows[0]?.nome;
    } catch (err: any) {
      builderLog.warn(
        { event: "system_prompt_branding_failed", cliente_id: clienteId, err: err?.message },
        "Falha ao carregar DNA da marca; seguindo sem o bloco de branding"
      );
    }
    const brandingBlock = formatBrandingBlock(branding, clienteNome);

    // ── Camada 2a: rolling_summary da sessão ──────────────────────────────
    let rollingSummary: string | null = null;
    try {
      const sessionResult = await db.query(
        "SELECT rolling_summary FROM agent_sessions WHERE id = $1",
        [sessionId]
      );
      rollingSummary = sessionResult.rows[0]?.rolling_summary ?? null;
    } catch (err: any) {
      builderLog.warn(
        { event: "system_prompt_summary_failed", session_id: sessionId, err: err?.message },
        "Falha ao carregar rolling_summary; seguindo sem memória resumida"
      );
    }

    // ── Camada 2b: chunks RAG (graceful degradation) ──────────────────────
    let ragBlock = "";
    const retrievedChunkIds: string[] = [];
    const query = String(recentUserMessage || "").trim();
    if (query) {
      try {
        const chunks = await ragService.retrieve(clienteId, query, { k: RAG_TOP_K });
        if (chunks.length > 0) {
          ragBlock = chunks
            .map((c, i) => `[${i + 1}] ${c.content}`)
            .join("\n\n");
          for (const c of chunks) retrievedChunkIds.push(c.id);
        }
      } catch (err: any) {
        // Graceful degradation: RAG indisponível não derruba a resposta do agente.
        builderLog.warn(
          { event: "system_prompt_rag_failed", cliente_id: clienteId, err: err?.message },
          "Retrieval RAG falhou; seguindo sem contexto recuperado"
        );
      }
    }

    // ── Camada 3: persona ─────────────────────────────────────────────────
    const persona = PERSONAS[agentType];

    // ── Composição final ──────────────────────────────────────────────────
    const sections: string[] = [
      persona,
      "",
      "## DNA DA MARCA",
      brandingBlock,
    ];

    if (rollingSummary && rollingSummary.trim()) {
      sections.push("", "## MEMÓRIA DA CONVERSA (resumo de sessões anteriores)", rollingSummary.trim());
    }

    if (ragBlock) {
      sections.push(
        "",
        "## CONHECIMENTO RELEVANTE DO CLIENTE (use quando pertinente, sem citar como fonte literal)",
        ragBlock
      );
    }

    sections.push(
      "",
      "Responda sempre em português, de forma alinhada ao DNA da marca acima. " +
        "Nunca contradiga as palavras a evitar (anti-keywords)."
    );

    return {
      systemInstruction: sections.join("\n"),
      retrievedChunkIds,
    };
  },
};
