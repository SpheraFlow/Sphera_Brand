import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../config/database";

const router = Router();

// Configuração do Multer DEDICADA para branding (separada da config geral)
const uploadDir = path.resolve(__dirname, "../../storage/branding");

// Criar diretório se não existir
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📂 [MULTER] Pasta de uploads criada:", uploadDir);
} else {
  console.log("📂 [MULTER] Pasta de uploads já existe:", uploadDir);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    console.log("📂 [MULTER] Salvando arquivo em:", uploadDir);
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `brand-${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    console.log("📝 [MULTER] Nome do arquivo:", uniqueName);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB por arquivo
  fileFilter: (_req, file, cb) => {
    console.log("🔍 [MULTER] Validando arquivo:", file.originalname, "Tipo:", file.mimetype);
    
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      console.log("✅ [MULTER] Arquivo aceito");
      return cb(null, true);
    } else {
      console.error("❌ [MULTER] Arquivo rejeitado - tipo não permitido");
      cb(new Error("Apenas imagens (JPEG, PNG, WEBP) são permitidas"));
    }
  }
});

// Função para converter imagem para base64
function fileToGenerativePart(filePath: string, mimeType: string) {
  console.log("🖼️ [GEMINI] Convertendo imagem para base64:", filePath);
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    }
  };
}

// Criar wrapper de debug para o Multer
const uploadMiddleware = upload.array('images', 3);

/**
 * POST /api/branding/extract-from-upload
 * 
 * Body (multipart/form-data):
 * - images: até 3 arquivos de imagem
 * - captions: string com legendas de exemplo (separadas por linha)
 * - clienteId: UUID do cliente
 */
router.post(
  "/branding/extract-from-upload",
  (req: Request, res: Response, next) => {
    console.log("\n🎨 ============================================");
    console.log("🎨 [BRANDING UPLOAD] Nova requisição recebida");
    console.log("🎨 ============================================");
    console.log("📍 Content-Type:", req.headers['content-type']);
    console.log("📍 URL:", req.url);
    console.log("📍 Method:", req.method);
    console.log("📦 Body inicial:", req.body);
    console.log("📦 Files inicial:", req.files);
    
    console.log("\n🔄 Iniciando processamento do Multer...");
    
    return uploadMiddleware(req, res, (err: any) => {
      if (err) {
        console.error("\n❌ ============================================");
        console.error("❌ [ERRO MULTER CRÍTICO]");
        console.error("❌ ============================================");
        console.error("Tipo do erro:", err.constructor.name);
        console.error("Mensagem:", err.message);
        console.error("Stack:", err.stack);
        
        if (err instanceof multer.MulterError) {
          console.error("Código Multer:", err.code);
          console.error("Campo:", err.field);
        }
        
        return res.status(500).json({ 
          success: false,
          error: "Erro no processamento do arquivo", 
          details: err.message,
          code: err.code || 'UNKNOWN'
        });
      }
      
      console.log("✅ [MULTER] Processamento concluído sem erros!");
      console.log("📦 Body após Multer:", req.body);
      console.log("📁 Files após Multer:", req.files);
      return next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      console.log("\n🤖 ============================================");
      console.log("🤖 [CONTROLLER] Iniciando processamento com IA");
      console.log("🤖 ============================================");
      console.log("📦 Body final:", JSON.stringify(req.body, null, 2));
      console.log("📁 Files final:", req.files);
      
      const { clienteId, captions } = req.body;
      const files = req.files as Express.Multer.File[];

      // Validações
      if (!clienteId) {
        console.error("❌ clienteId não fornecido");
        return res.status(400).json({ success: false, error: "clienteId é obrigatório" });
      }

      if (!files || files.length === 0) {
        console.error("❌ Nenhum arquivo recebido");
        return res.status(400).json({ success: false, error: "É necessário enviar pelo menos 1 imagem" });
      }

      console.log(`📸 Total de imagens: ${files.length}`);
      console.log(`📝 Legendas fornecidas: ${captions ? 'Sim' : 'Não'}`);

      // Verificar se o cliente existe
      console.log(`🔍 Verificando cliente: ${clienteId}`);
      const clientCheck = await db.query(
        "SELECT id, nome FROM clientes WHERE id = $1",
        [clienteId]
      );

      if (clientCheck.rows.length === 0) {
        console.error("❌ Cliente não encontrado no banco");
        return res.status(404).json({ success: false, error: "Cliente não encontrado" });
      }

      const clientName = clientCheck.rows[0].nome;
      console.log(`✅ Cliente encontrado: ${clientName}`);

      // Preparar partes para o Gemini (imagens)
      console.log("🖼️ Preparando imagens para o Gemini...");
      const imageParts = files.map(file => {
        console.log(`  - ${file.filename} (${file.mimetype})`);
        return fileToGenerativePart(file.path, file.mimetype);
      });

      // Montar prompt para o Gemini
      const prompt = `
Você é um especialista em Branding e Design Visual.

Analise as ${files.length} imagens fornecidas${captions ? ' e as legendas abaixo' : ''}.

${captions ? `\n**LEGENDAS DE EXEMPLO:**\n${captions}\n` : ''}

**TAREFA:**
Extraia e identifique:
1. **Paleta de Cores:** Liste até 5 cores principais em formato HEX (ex: #FF5733)
2. **Estilo Visual:** Descreva o estilo (minimalista, vibrante, corporativo, orgânico, etc)
3. **Tom de Voz:** Baseado nas legendas (se fornecidas) ou no estilo visual, descreva o tom (formal, descontraído, inspirador, técnico, etc)
4. **Público-Alvo:** Infira o público ideal (idade, interesses, comportamento)
5. **Palavras-chave:** Liste 5-10 palavras que representam a marca

**FORMATO DE RESPOSTA:**
Retorne APENAS um JSON válido (sem markdown, sem explicações extras):

{
  "visual_style": {
    "primary_colors": ["#HEX1", "#HEX2", "#HEX3"],
    "secondary_colors": ["#HEX4", "#HEX5"],
    "fonts": ["Nome da fonte sugerida 1", "Nome da fonte sugerida 2"],
    "style_description": "Descrição do estilo visual"
  },
  "tone_of_voice": {
    "personality": "Descrição da personalidade da marca",
    "communication_style": "Estilo de comunicação",
    "examples": ["Exemplo de frase 1", "Exemplo de frase 2"]
  },
  "audience": {
    "demographics": "Faixa etária, gênero, localização",
    "psychographics": "Interesses, valores, comportamentos",
    "pain_points": ["Dor 1", "Dor 2"]
  },
  "keywords": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"]
}
`;

      // Chamar Gemini
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        console.error("❌ GOOGLE_API_KEY não configurada");
        return res.status(500).json({ success: false, error: "API Key do Gemini não configurada" });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Tentar primeiro com 2.0-flash-exp, depois fallback para 1.5-flash
      let model;
      let modelName = "gemini-3-flash-preview";
      
      try {
        model = genAI.getGenerativeModel({ model: modelName });
        console.log(`🤖 Usando Gemini ${modelName} (Vision)...`);
      } catch (e: any) {
        console.error(`❌ Erro ao inicializar modelo ${modelName}:`, e.message);
        return res.status(500).json({ success: false, error: "Erro ao inicializar IA" });
      }
      
      console.log("🤖 Enviando requisição para o Gemini...");
      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      let rawText = response.text();
      
      console.log(`✅ Resposta recebida do ${modelName}`);
      console.log("📥 Resposta bruta (primeiros 200 chars):", rawText.substring(0, 200) + "...");

      // Limpar resposta (remover markdown se houver)
      rawText = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      // Encontrar o JSON válido
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("❌ Gemini não retornou JSON válido");
        console.error("Resposta completa:", rawText);
        return res.status(500).json({ 
          success: false, 
          error: "IA não conseguiu extrair dados estruturados",
          raw: rawText.substring(0, 500)
        });
      }

      const brandingData = JSON.parse(jsonMatch[0]);
      console.log("✅ JSON parseado com sucesso!");
      console.log("📊 Dados extraídos:", JSON.stringify(brandingData, null, 2));

      // Salvar no banco (UPSERT)
      console.log("💾 Salvando no banco de dados...");
      const upsertQuery = `
        INSERT INTO branding (
          cliente_id, 
          visual_style, 
          tone_of_voice, 
          audience, 
          keywords,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (cliente_id) 
        DO UPDATE SET
          visual_style = EXCLUDED.visual_style,
          tone_of_voice = EXCLUDED.tone_of_voice,
          audience = EXCLUDED.audience,
          keywords = EXCLUDED.keywords,
          updated_at = NOW()
        RETURNING id, cliente_id
      `;

      const dbResult = await db.query(upsertQuery, [
        clienteId,
        JSON.stringify(brandingData.visual_style),
        JSON.stringify(brandingData.tone_of_voice),
        JSON.stringify(brandingData.audience),
        brandingData.keywords
      ]);

      console.log(`✅ DNA salvo no banco (ID: ${dbResult.rows[0].id})`);

      // Limpar arquivos temporários
      console.log("🧹 Limpando arquivos temporários...");
      files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
          console.log(`  ✅ Deletado: ${file.filename}`);
        } catch (e) {
          console.warn(`  ⚠️ Não foi possível deletar: ${file.filename}`);
        }
      });

      console.log("🎉 Processo completo com sucesso!\n");

      return res.json({
        success: true,
        message: "DNA da marca extraído com sucesso!",
        data: {
          brandingId: dbResult.rows[0].id,
          clienteId: clienteId,
          extracted: brandingData
        }
      });

    } catch (error: any) {
      console.error("\n❌ ============================================");
      console.error("❌ [ERRO BRANDING UPLOAD]");
      console.error("❌ ============================================");
      console.error("Mensagem:", error.message);
      console.error("Stack:", error.stack);
      
      // Log detalhado para debug
      if (error.response) {
        console.error("Erro da API:", error.response.data);
      }
      
      return res.status(500).json({
        success: false,
        error: error.message || "Erro ao processar upload",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Middleware de erro do Multer
router.use((error: any, _req: Request, res: Response, next: any) => {
  if (error instanceof multer.MulterError) {
    console.error("❌ [MULTER ERROR]:", error.message);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'Arquivo muito grande (máx: 10MB)' });
    }
    return res.status(400).json({ success: false, error: error.message });
  }
  
  if (error) {
    console.error("❌ [UPLOAD ERROR]:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
  
  return next();
});

export default router;
