/**
 * backend/src/services/promptVariables.ts
 *
 * Fonte de verdade para as variáveis (placeholders) do Editor de Prompt.
 * - Define o catálogo oficial de {{VAR_NAME}}
 * - Extrai placeholders de strings
 * - Resolve contexto (Mock ou Real) consultando o DB
 */

import db from "../config/database";

export type VariableScope = "global" | "client" | "calendar" | "optional";

export interface PromptVariable {
    key: string;
    description: string;
    example: string;
    required: boolean;
    scope: VariableScope;
}

export const SUPPORTED_VARIABLES: PromptVariable[] = [
    // Obrigatórias do Client / Brand
    {
        key: "DNA_DA_MARCA",
        description: "Informações completas de Tom de Voz, Visual, Público e Keywords da marca.",
        example: "- Tom: Energético\n- Visual: Moderno\n- Público: Jovens Adultos\n- Keywords: inovação, tech",
        required: true,
        scope: "client"
    },
    {
        key: "REGRAS_OBRIGATORIAS",
        description: "Regras de marca cadastradas (o que não fazer, restrições).",
        example: "- Nunca usar gírias regionais.\n- Sempre incluir o slogan no final.",
        required: false,
        scope: "client"
    },

    // Variáveis de Agent Persona (Branding Avançado)
    {
        key: "ARQUETIPO",
        description: "O arquétipo de marca (ex: O Criador, O Mago, O Sábio).",
        example: "O Sábio (Foco em conhecimento e autoridade)",
        required: false,
        scope: "client"
    },
    {
        key: "NICHO",
        description: "Nicho de mercado de atuação da marca.",
        example: "Clínica de Estética Avançada",
        required: false,
        scope: "client"
    },
    {
        key: "DIFERENCIAL_USP",
        description: "Proposta Única de Valor (USP) ou Diferencial da marca.",
        example: "Atendimento 24h com foco em resultados reais e humanizados.",
        required: false,
        scope: "client"
    },
    {
        key: "ANTI_PALAVRAS",
        description: "Palavras, gírias ou termos que a marca NUNCA deve usar.",
        example: "barato, dancinha, promoção imperdível, galera",
        required: false,
        scope: "client"
    },
    {
        key: "TOM_DE_VOZ",
        description: "Descrição específica e detalhada do tom de voz da marca.",
        example: "Acessível, direto e empático. Usa emojis com moderação.",
        required: false,
        scope: "client"
    },

    // Obrigatórias do Ciclo / Briefing
    {
        key: "BRIEFING",
        description: "O briefing ou objetivo específico preenchido na criação do ciclo.",
        example: "Lançamento da nova linha de produtos de verão.",
        required: true,
        scope: "calendar"
    },
    {
        key: "MIX_POSTS",
        description: "Distribuição calculada de posts para o mês (ex: 4 Reels, 8 Static).",
        example: "- 4 roteiros de REELS.\n- 8 posts ESTÁTICOS.\n- 4 CARROSSÉIS.",
        required: true,
        scope: "calendar"
    },
    {
        key: "MES",
        description: "O mês de referência para a geração atual (ex: Maio 2026).",
        example: "Maio 2026",
        required: true,
        scope: "calendar"
    },

    // Opcionais / Contexto Adicional
    {
        key: "DATA_HOJE",
        description: "A data do sistema no momento da geração (útil para referências temporais).",
        example: new Date().toISOString().split("T")[0] || "2026-05-12",
        required: false,
        scope: "global"
    },
    {
        key: "DATAS_COMEMORATIVAS",
        description: "Feriados e datas especiais do mês gerado.",
        example: "12/05 - Dia das Mães",
        required: false,
        scope: "calendar"
    },
    {
        key: "REFERENCIAS_MES",
        description: "Referências de links ou tendências sugeridas para o mês.",
        example: "https://tiktok.com/trend1 (Áudio em alta)",
        required: false,
        scope: "calendar"
    },
    {
        key: "CONTINUIDADE",
        description: "Contexto dos meses anteriores (usado em calendários multi-mês para evitar repetição).",
        example: "[Abril 2026]: Lançamento de produto, Promoção de páscoa...",
        required: false,
        scope: "calendar"
    },
    {
        key: "DOCS_EXTRAS",
        description: "Documentos de marca anexados (Textos, Políticas).",
        example: "- (Tom de Voz) Nosso tom é sempre prestativo e cordial.",
        required: false,
        scope: "client"
    },
    {
        key: "INSTRUCOES_AVANCADAS",
        description: "Instruções adicionais injetadas pelo estrategista no gerador.",
        example: "Foque muito em posts de topo de funil neste ciclo.",
        required: false,
        scope: "calendar"
    },
    {
        key: "INSTRUCOES_POR_FORMATO",
        description: "Instruções específicas para cada formato de post.",
        example: "- Reels: 15 a 30 segundos, hook nos primeiros 3s.\n- Carousel: Máximo 5 slides.",
        required: false,
        scope: "global"
    }
];

export const REQUIRED_VARIABLES = SUPPORTED_VARIABLES.filter(v => v.required).map(v => v.key);

/**
 * Retorna todos os placeholders usados em um texto, ex: ["DNA_DA_MARCA", "MES"]
 */
export function extractPlaceholders(text: string): string[] {
    const matches = [...text.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)];
    return [...new Set(matches.map(m => m[1] as string))];
}

/**
 * Monta os valores para renderizar no preview.
 * @param clientId ID do cliente 
 * @param mes Mês a ser gerado
 * @param mode 'mock' para usar examplos predefinidos, 'real' para buscar no banco
 */
export async function buildPreviewContext(
    clientId: string,
    mes: string = "Mês de Teste",
    mode: "mock" | "real" = "mock"
): Promise<Record<string, string>> {

    if (mode === "mock") {
        return SUPPORTED_VARIABLES.reduce((acc, v) => {
            acc[v.key] = v.example;
            return acc;
        }, {} as Record<string, string>);
    }

    // MODO REAL: Busca no banco de dados para o clientId
    const context: Record<string, string> = {};

    try {
        // Busca Branding
        const brandRes = await db.query("SELECT * FROM branding WHERE cliente_id = $1", [clientId]);
        const branding = brandRes.rows[0] || {};
        const toneOfVoice = branding.tone_of_voice || "Não cadastrado";

        // Busca Categorias (Keywords) e Nicho
        const clientRes = await db.query("SELECT categorias_nicho, nicho FROM clientes WHERE id = $1", [clientId]);
        const categorias = (clientRes.rows[0]?.categorias_nicho || []).join(", ");
        const nicho = clientRes.rows[0]?.nicho || "Não cadastrado";

        context.ARQUETIPO = branding.archetype || "Não definido";
        context.NICHO = nicho;
        context.DIFERENCIAL_USP = branding.usp || "Não definido";
        context.ANTI_PALAVRAS = branding.anti_keywords || "Não definidas";
        context.TOM_DE_VOZ = toneOfVoice;

        context.DNA_DA_MARCA = `- Tom: ${toneOfVoice}\n- Visual: ${branding.visual_style || "Não cadastrado"}\n- Público: ${branding.audience || "Não cadastrado"}\n- Keywords: ${categorias || "Não cadastradas"}`;

        // Busca Regras
        const rulesRes = await db.query("SELECT regra FROM brand_rules WHERE cliente_id = $1 AND ativa = true", [clientId]);
        context.REGRAS_OBRIGATORIAS = rulesRes.rows.length > 0
            ? rulesRes.rows.map((r: any) => `- ${r.regra}`).join("\n")
            : "Nenhuma regra cadastrada.";

        // Busca Docs Extras
        const docsRes = await db.query("SELECT tipo, conteudo_texto FROM brand_docs WHERE cliente_id = $1", [clientId]);
        context.DOCS_EXTRAS = docsRes.rows.length > 0
            ? docsRes.rows.map((d: any) => `- (${d.tipo}) ${d.conteudo_texto.substring(0, 100)}...`).join("\n") // truncado por segurança
            : "Nenhum documento cadastrado.";

    } catch (error) {
        console.warn(`[Preview Real] Falha ao buscar dados do cliente ${clientId}:`, error);
        // Fallback gracioso para mock nesses campos se falhar
        context.DNA_DA_MARCA = "-- Erro ao carregar DNA --";
    }

    // Preenchemos os de calendário ("calendar") com simulações amigáveis,
    // já que o preview não está gerando um Job real com Briefing de entrada agora.
    context.BRIEFING = "[SIMULAÇÃO] Briefing será injetado na geração.";
    context.MIX_POSTS = "[SIMULAÇÃO] Mix de posts será distribuído aqui.";
    context.MES = mes || "[SIMULAÇÃO] Mês Atual";
    context.DATA_HOJE = new Date().toISOString().split("T")[0] || "2026-05-12";
    context.DATAS_COMEMORATIVAS = "[SIMULAÇÃO] Busca de feriados ocorrerá aqui.";
    context.REFERENCIAS_MES = "[SIMULAÇÃO] Nenhuma referência preenchida no momento.";
    context.CONTINUIDADE = "[SIMULAÇÃO] Primeiro ciclo não possui continuidade.";
    context.INSTRUCOES_AVANCADAS = "[SIMULAÇÃO] Nenhuma instrução avançada definida.";
    context.INSTRUCOES_POR_FORMATO = SUPPORTED_VARIABLES.find(v => v.key === "INSTRUCOES_POR_FORMATO")?.example || "";

    return context;
}
