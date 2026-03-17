import { Router, Request, Response, NextFunction } from "express";
import db from "../config/database";
import multer from "multer";
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();

// GET /api/knowledge/doc/:clienteId/:type
router.get("/doc/:clienteId/:type", async (req: Request, res: Response) => {
  try {
    const { clienteId, type } = req.params;
    const result = await db.query(
      "SELECT conteudo_texto FROM brand_docs WHERE cliente_id = $1 AND tipo = $2",
      [clienteId, type]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, content: null });
    }

    // Tenta fazer parse se for JSON (para links e galeria)
    let content = result.rows[0].conteudo_texto;
    try {
      if (type !== 'general_references') { // general_references é texto puro
        content = JSON.parse(content);
      }
    } catch (e) {
      // mantem como string se falhar
    }

    return res.json({ success: true, content });
  } catch (error) {
    console.error(`Erro ao buscar doc ${req.params.type}:`, error);
    return res.status(500).json({ success: false, error: "Erro ao buscar documento." });
  }
});

// PUT /api/knowledge/doc/:clienteId/:type
router.put("/doc/:clienteId/:type", async (req: Request, res: Response) => {
  try {
    const { clienteId, type } = req.params;
    let { content } = req.body;

    // Se for objeto (links/galeria), stringify antes de salvar
    if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }

    // Tenta atualizar
    const updateResult = await db.query(
      "UPDATE brand_docs SET conteudo_texto = $1 WHERE cliente_id = $2 AND tipo = $3 RETURNING *",
      [content, clienteId, type]
    );

    // Se não atualizou nada, insere
    if (updateResult.rowCount === 0) {
      await db.query(
        "INSERT INTO brand_docs (cliente_id, tipo, conteudo_texto) VALUES ($1, $2, $3)",
        [clienteId, type, content]
      );
    }

    return res.json({ success: true });
  } catch (error) {
    console.error(`Erro ao salvar doc ${req.params.type}:`, error);
    return res.status(500).json({ success: false, error: "Erro ao salvar documento." });
  }
});

// ==========================================
// CONFIGURAÇÃO DE UPLOAD E IA
// ==========================================

// 1. Configuração de Pastas
const uploadDir = path.resolve(__dirname, '../../storage/branding');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Configuração do Multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limite de 10MB por arquivo
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo inválido. Apenas imagens e PDFs são permitidos.'));
    }
  }
});

// 3. Função para limpar e fazer parse do JSON
const cleanAndParseJSON = (text: string) => {
  // 1. Tenta encontrar o primeiro '{' e o último '}'
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1) {
    const jsonCandidate = text.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (e) {
      console.error("⚠️ [DEBUG] Erro ao fazer parse do trecho extraído:", e);
    }
  }

  // 2. Fallback: Tenta limpar markdown comum
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
};

// ==========================================
// ROTA DE UPLOAD DE ASSETS (Galeria)
// ==========================================
router.post("/assets", upload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Nenhum arquivo enviado." });
    }

    // Retorna o caminho relativo para acesso via static
    // Assumindo que o backend serve /uploads ou similar
    // Ajustar conforme a configuração de arquivos estáticos do servidor
    const fileUrl = `/storage/branding/${req.file.filename}`;

    return res.json({
      success: true,
      url: fileUrl,
      filename: req.file.originalname,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error("Erro no upload de asset:", error);
    return res.status(500).json({ success: false, error: "Erro interno no upload." });
  }
});

// ==========================================
// 1. PROMPTS (Biblioteca)
// ==========================================

// GET /api/knowledge/prompts/:clienteId
router.get("/prompts/:clienteId", async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.params;

    const result = await db.query(
      "SELECT * FROM client_prompts WHERE cliente_id = $1 ORDER BY criado_em DESC",
      [clienteId]
    );

    return res.json({ success: true, prompts: result.rows });
  } catch (error) {
    console.error("Erro ao buscar prompts:", error);
    return res.status(500).json({ success: false, error: "Erro ao buscar prompts." });
  }
});

// POST /api/knowledge/prompts
router.post("/prompts", async (req: Request, res: Response) => {
  try {
    const { clienteId, titulo, conteudo, categoria } = req.body;

    if (!clienteId || !titulo || !conteudo) {
      return res.status(400).json({ success: false, error: "Campos obrigatórios: clienteId, titulo, conteudo." });
    }

    const result = await db.query(
      `INSERT INTO client_prompts (cliente_id, titulo, conteudo_prompt, categoria)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [clienteId, titulo, conteudo, categoria || 'Geral']
    );

    return res.status(201).json({ success: true, prompt: result.rows[0] });
  } catch (error) {
    console.error("Erro ao criar prompt:", error);
    return res.status(500).json({ success: false, error: "Erro ao criar prompt." });
  }
});

// DELETE /api/knowledge/prompts/:id
router.delete("/prompts/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM client_prompts WHERE id = $1", [id]);

    return res.json({ success: true, message: "Prompt removido com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar prompt:", error);
    return res.status(500).json({ success: false, error: "Erro ao deletar prompt." });
  }
});

// ==========================================
// 2. REGRAS (Brand Rules)
// ==========================================

// GET /api/knowledge/rules/:clienteId
router.get("/rules/:clienteId", async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.params;

    const result = await db.query(
      "SELECT * FROM brand_rules WHERE cliente_id = $1 ORDER BY criado_em DESC",
      [clienteId]
    );

    return res.json({ success: true, rules: result.rows });
  } catch (error) {
    console.error("Erro ao buscar regras:", error);
    return res.status(500).json({ success: false, error: "Erro ao buscar regras." });
  }
});

// POST /api/knowledge/rules
router.post("/rules", async (req: Request, res: Response) => {
  console.log("📝 POST /api/knowledge/rules - Payload recebido:", req.body);

  try {
    const { clienteId, regra, categoria, origem } = req.body;

    if (!clienteId) {
      console.warn("⚠️ Tentativa de criar regra sem clienteId");
      return res.status(400).json({ success: false, error: "clienteId é obrigatório." });
    }
    if (!regra) {
      console.warn("⚠️ Tentativa de criar regra sem texto da regra");
      return res.status(400).json({ success: false, error: "O texto da regra é obrigatório." });
    }

    console.log("🛠️ Inserindo regra no banco...");

    // Query robusta com fallback para valores opcionais
    const query = `
      INSERT INTO brand_rules (cliente_id, regra, categoria, origem, ativa)
      VALUES ($1, $2, $3, $4, true)
      RETURNING *
    `;

    const values = [
      clienteId,
      regra,
      categoria || 'Geral',
      origem || 'manual'
    ];

    const result = await db.query(query, values);

    console.log("✅ Regra criada com sucesso! ID:", result.rows[0].id);
    return res.status(201).json({ success: true, rule: result.rows[0] });

  } catch (error) {
    console.error("❌ ERRO CRÍTICO ao criar regra:", error);

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido no banco de dados";
    return res.status(500).json({
      success: false,
      error: `Erro interno ao salvar regra: ${errorMessage}`
    });
  }
});

// DELETE /api/knowledge/rules/:id
router.delete("/rules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM brand_rules WHERE id = $1", [id]);

    return res.json({ success: true, message: "Regra removida com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar regra:", error);
    return res.status(500).json({ success: false, error: "Erro ao deletar regra." });
  }
});

// ==========================================
// 3. DOCS (Contexto)
// ==========================================

// POST /api/knowledge/docs
router.post("/docs", async (req: Request, res: Response) => {
  try {
    const { clienteId, tipo, conteudo_texto } = req.body;

    if (!clienteId || !conteudo_texto) {
      return res.status(400).json({ success: false, error: "Campos obrigatórios: clienteId, conteudo_texto." });
    }

    const result = await db.query(
      `INSERT INTO brand_docs (cliente_id, tipo, conteudo_texto)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [clienteId, tipo || 'Nota', conteudo_texto]
    );

    return res.status(201).json({ success: true, doc: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar documento:", error);
    return res.status(500).json({ success: false, error: "Erro ao salvar documento." });
  }
});

// ==========================================
// 4. BRANDING - Extração de DNA
// ==========================================

// POST /api/knowledge/branding/extract
router.post("/branding/extract", (req: Request, res: Response, next: NextFunction) => {
  console.log("🎯 [BRANDING EXTRACT] Rota chamada - Iniciando processamento Multer");
  console.log("📥 [API DNA] Dados recebidos - clienteId:", req.body?.clienteId || 'NÃO ENCONTRADO');

  const uploadMiddleware = upload.any();

  uploadMiddleware(req, res, (err: any) => {
    if (err) {
      console.error("❌ [ERRO MULTER]:", err);
      res.status(500).json({ error: "Falha no upload físico", details: err.message });
      return;
    }
    console.log("✅ [BRANDING EXTRACT] Multer processado com sucesso");
    next();
  });
}, async (req: Request, res: Response): Promise<void> => {

  console.log("🎨 [BRANDING EXTRACT] Handler principal executado - Iniciando extração de DNA...");

  try {
    const files = req.files as Express.Multer.File[] | undefined;
    const { clienteId } = req.body;

    console.log("📥 [API DNA] clienteId extraído do req.body:", clienteId);

    // Validações
    if (!files || files.length === 0) {
      console.error("❌ Nenhum arquivo encontrado em req.files");
      res.status(400).json({ error: "Nenhum arquivo enviado." });
      return;
    }

    // VALIDAÇÃO CRÍTICA DO clienteId
    if (!clienteId || clienteId === 'undefined' || clienteId === undefined) {
      console.error("❌ clienteId obrigatório no FormData - Recebido:", clienteId);
      res.status(400).json({ error: "Cliente ID obrigatório no FormData" });
      return;
    }

    console.log("✅ [API DNA] clienteId válido:", clienteId);

    const file = files[0];

    // Verificação adicional para garantir que file não é undefined
    if (!file) {
      console.error("❌ Arquivo na posição 0 é undefined");
      res.status(400).json({ error: "Arquivo inválido." });
      return;
    }

    console.log(`📁 [DEBUG] Arquivo recebido: ${file.filename}`);

    // Verificar se tem GOOGLE_API_KEY
    if (!process.env.GOOGLE_API_KEY) {
      console.error("❌ GOOGLE_API_KEY não configurada");
      res.status(500).json({ error: "Configuração de IA não disponível." });
      return;
    }

    // Usar Gemini para extrair dados ricos de branding (Brand DNA 2.0)
    console.log("🤖 [IA] Iniciando extração com Gemini (fallback robusto)...");

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    let result;
    let responseText = "";

    const modelsToTry = ["gemini-3-flash-preview", "gemini-2.5-flash"];

    const prompt = `Analise estas imagens visualmente. Aja como um especialista de branding e retorne APENAS um JSON válido (sem markdown) com esta estrutura exata:

{
  "visual_style": "Descreva as cores, estilo de foto (minimalista/vibrante) e elementos visuais",
  "tone_of_voice": "Descreva o tom de voz e comunicação",
  "audience": "Descreva o público-alvo detalhadamente",
  "colors": ["#HEX1", "#HEX2", "#HEX3"],
  "fonts": ["Fonte1", "Fonte2"],
  "keywords": ["palavra1", "palavra2", "palavra3"],
  "archetype": "Nome do arquétipo de marca (ex: O Criador, O Herói, A Sábia)",
  "usp": "Proposta Única de Valor - o que torna esta marca especial",
  "anti_keywords": ["aversão1", "aversão2", "aversão3"],
  "niche": "Nicho de mercado específico onde a marca se posiciona"
}`;

    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 [DEBUG] Tentando modelo: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });

        console.log("🎯 [IA] Enviando prompt para Gemini...");
        result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: file.mimetype,
              data: file.buffer.toString('base64')
            }
          }
        ]);

        responseText = result.response.text();
        console.log(`✅ [DEBUG] Sucesso com ${modelName}`);
        break;
      } catch (modelError: any) {
        console.warn(`⚠️ [DEBUG] ${modelName} falhou:`, modelError.message);

        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          throw new Error(`Todos os modelos falharam. Erro final: ${modelError.message}`);
        }

        console.log("⏳ [DEBUG] Aguardando 2s antes do próximo modelo...");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log("📝 [IA] Resposta bruta da IA:", responseText);

    // Parse do JSON
    const brandingData = cleanAndParseJSON(responseText);
    console.log("✅ [IA] JSON parseado com sucesso:", brandingData);

    // APENAS RETORNAR OS DADOS - NÃO SALVAR NO BANCO
    console.log("🔄 [BRANDING EXTRACT] Retornando sugestões da IA (não salva no banco)");

    res.json({
      success: true,
      message: "DNA de marca sugerido pela IA",
      suggestion: brandingData
    });
    return;

  } catch (error: any) {
    console.error("❌ [ERRO GERAL]:", error);
    res.status(500).json({ error: "Erro interno", details: error.message });
    return;
  }
});

// GET /api/knowledge/test - Endpoint de teste
router.get("/test", (_req: Request, res: Response) => {
  console.log("🧪 [TEST] Endpoint de teste chamado");
  res.json({
    success: true,
    message: "Rota knowledge funcionando!",
    timestamp: new Date().toISOString(),
    routes: {
      branding_extract: "/api/knowledge/branding/extract",
      rules: "/api/knowledge/rules/:clienteId",
      prompts: "/api/knowledge/prompts/:clienteId"
    }
  });
});

// POST /api/knowledge/test-ai - Teste direto da IA (sem salvar)
router.post("/test-ai", async (_req: Request, res: Response): Promise<void> => {
  console.log("🤖 [TEST AI] Testando IA diretamente...");

  try {
    if (!process.env.GOOGLE_API_KEY) {
      res.status(500).json({ error: "GOOGLE_API_KEY não configurada" });
      return;
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `Analise estas imagens visualmente. Aja como um especialista de branding.

Extraia e retorne APENAS um JSON válido (sem markdown) com esta estrutura exata:

{
  "visual_style": "Descreva as cores, estilo de foto (minimalista/vibrante) e elementos visuais",
  "tone_of_voice": "Descreva o tom (sério/divertido), arquétipo e linguagem",
  "audience": "Descreva o público-alvo provável",
  "colors": ["#HEX1", "#HEX2", "#HEX3"],
  "fonts": ["Nome da Fonte (estimada)"],
  "keywords": ["tag1", "tag2", "tag3"]
}`;

    console.log("🤖 [TEST AI] Enviando prompt para IA...");
    const result = await model.generateContent([prompt, "Descreva uma marca de café premium"]);
    const responseText = result.response.text();

    console.log("📝 [TEST AI] Resposta bruta da IA:", responseText);

    // Parse do JSON
    const brandingData = cleanAndParseJSON(responseText);
    console.log("✅ [TEST AI] JSON parseado:", brandingData);

    res.json({
      success: true,
      raw_response: responseText,
      parsed_data: brandingData
    });

  } catch (error: any) {
    console.error("❌ [TEST AI] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/knowledge/debug - Endpoint de debug para verificar estado
router.get("/debug", async (_req: Request, res: Response) => {
  console.log("🔍 [DEBUG] Endpoint de debug chamado");

  try {
    // Verificar branding existente
    const brandingResult = await db.query("SELECT * FROM branding LIMIT 5");
    const clientsResult = await db.query("SELECT id, nome FROM clientes LIMIT 5");

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      branding_count: brandingResult.rows.length,
      branding_records: brandingResult.rows,
      clients: clientsResult.rows,
      message: "Debug information retrieved"
    });

  } catch (error: any) {
    console.error("❌ [DEBUG] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});


export default router;
