import dotenv from "dotenv";
// Configuração do dotenv - Deve ser a primeira coisa
dotenv.config();

// ============================================
// 🔴 PROVA DE VIDA - STARTUP ID ÚNICO
// ============================================
const STARTUP_ID = Date.now();
console.log(`\n\n🔴 ============================================`);
console.log(`🔴 [STARTUP] INICIANDO SERVIDOR - ID: ${STARTUP_ID}`);
console.log(`🔴 ============================================`);
console.log(`📂 [STARTUP] Diretório de execução: ${process.cwd()}`);
console.log(`📂 [STARTUP] Arquivo atual: ${__filename}`);
console.log(`📂 [STARTUP] Node version: ${process.version}`);
console.log(`📂 [STARTUP] Timestamp: ${new Date().toISOString()}`);
console.log(`🔴 ============================================\n`);

import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import postsRouter from "./routes/posts";
import brandingRouter from "./routes/branding";
import calendarRouter from "./routes/calendar";
import webhooksRouter from "./routes/webhooks";
import knowledgeRouter from "./routes/knowledge";
import clientsRouter from "./routes/clients";
import brandingUploadRouter from "./routes/brandingUpload";
import promptChainsRouter from "./routes/promptChains";
import datasComemorativasRoutes from "./routes/datasComemorativas";
import clientLogosRouter from "./routes/clientLogos";
import presentationRouter from "./routes/presentation";
import photoIdeasRouter from "./routes/photoIdeas";
import tokenUsageRouter from "./routes/tokenUsage";
import db from "./config/database";

// Inicialização do Express
const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// 📞 GRAMPO TELEFÔNICO - PRIMEIRA LINHA
// ============================================
app.use((req: Request, _res: Response, next) => {
  console.log(`📞 [GRAMPO] ${req.method} ${req.url} - Timestamp: ${Date.now()}`);
  next();
});

// Middlewares
// CONEXÃO DIRETA: Liberar CORS para permitir conexões diretas do frontend
app.use(cors({
  origin: '*', // Permite qualquer origem (Modo Dev)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const clientLogosPath = path.resolve(__dirname, "../storage/client-logos");
app.use("/static/client-logos", express.static(clientLogosPath));

// Expor assets de branding (galeria)
const brandingAssetsPath = path.resolve(__dirname, "../storage/branding");
app.use("/storage/branding", express.static(brandingAssetsPath));

// Middleware de Log GLOBAL (SEGUNDA LINHA - DEBUG DETALHADO)
app.use((req: Request, _res: Response, next) => {
  console.log(`🔔 [BACKEND RECEBEU] ${req.method} ${req.url}`);
  console.log(`📍 Origin: ${req.headers.origin || 'N/A'}`);
  console.log(`📍 Content-Type: ${req.headers['content-type'] || 'N/A'}`);
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    console.log(`📦 Body:`, req.body);
  }
  next();
});

// Rota de teste
app.get("/", (_req: Request, res: Response) => {
  res.json({ 
    message: "MVP Backend ON",
    status: "running",
    timestamp: new Date().toISOString()
  });
});

// Rota de health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ 
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// === ROTA DE DEBUG (Verificação de Schema) ===
app.get("/api/debug/tables", async (_req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // Buscar colunas da tabela brand_rules se ela existir
    let columns: any[] = [];
    const hasRules = result.rows.find((r: any) => r.table_name === 'brand_rules');
    
    if (hasRules) {
      const colsResult = await db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'brand_rules'
      `);
      columns = colsResult.rows;
    }

    res.json({ 
      success: true, 
      tables: result.rows.map((r: any) => r.table_name),
      brand_rules_columns: columns
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Erro no debug" });
  }
});

// Rotas da aplicação
app.use("/api", postsRouter);
app.use("/api", brandingRouter);
app.use("/api", calendarRouter);
app.use("/api", webhooksRouter);
app.use("/api/knowledge", knowledgeRouter);
app.use("/api/clients", clientsRouter);
app.use("/api", brandingUploadRouter);
app.use("/api", promptChainsRouter);
app.use("/api", datasComemorativasRoutes);
app.use("/api", clientLogosRouter);
app.use("/api/presentation", presentationRouter);
app.use("/api/photos", photoIdeasRouter);
app.use("/api/token-usage", tokenUsageRouter);

// Servir arquivos gerados pelo Python (Temporários)
const presentationOutputPath = path.resolve(__dirname, "../python_gen/output");
app.use("/presentation-output", express.static(presentationOutputPath));

// Servir fontes usadas pelo gerador (para o editor do frontend)
const presentationFontsPath = path.resolve(__dirname, "../python_gen/fonts");
app.use("/presentation-fonts", express.static(presentationFontsPath));

// Servir apresentações salvas (Permanentes)
const presentationsStoragePath = path.resolve(__dirname, "../storage/presentations");
app.use("/storage/presentations", express.static(presentationsStoragePath));

// Teste de conexão com PostgreSQL e Ambiente
const checkEnvironment = async () => {
  try {
    // 1. Check DB
    const result = await db.query("SELECT NOW()");
    console.log(`✅ DB conectado: ${result.rows[0]?.now}`);

    // 2. Check Google API Key
    const apiKey = process.env.GOOGLE_API_KEY;
    if (apiKey) {
      console.log(`✅ GOOGLE_API_KEY carregada: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
    } else {
      console.error("❌ GOOGLE_API_KEY NÃO DEFINIDA no .env");
    }

  } catch (error) {
    console.error("❌ Erro ao conectar ao DB:", error instanceof Error ? error.message : error);
  }
};

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`\n🚀 ============================================`);
  console.log(`🚀 Backend ONLINE na porta ${PORT}`);
  console.log(`🚀 Startup ID: ${STARTUP_ID}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🚀 ============================================\n`);
  
  checkEnvironment();
  
  // Listar todas as rotas registradas
  console.log(`\n📋 ============================================`);
  console.log(`📋 ROTAS REGISTRADAS:`);
  console.log(`📋 ============================================`);
  
  try {
    if (app._router && app._router.stack) {
      app._router.stack.forEach((r: any) => {
        if (r.route && r.route.path) {
          const methods = Object.keys(r.route.methods).join(', ').toUpperCase();
          console.log(`  ${methods.padEnd(10)} ${r.route.path}`);
        } else if (r.name === 'router') {
          console.log(`  ROUTER     ${r.regexp}`);
        }
      });
    } else {
      console.log(`  ⚠️ Não foi possível listar rotas (app._router não disponível)`);
    }
  } catch (e) {
    console.log(`  ⚠️ Erro ao listar rotas:`, e);
  }
  
  console.log(`📋 ============================================\n`);
});

export default app;
