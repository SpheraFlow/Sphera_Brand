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
import jobsRouter from "./routes/jobs";
import promptTemplatesRouter from "./routes/promptTemplates";
import promptOnboardingRouter from "./routes/promptOnboarding";
import calendarItemsRouter from "./routes/calendarItems";
import onboardingRouter from "./routes/onboarding";
import clickupRouter from "./routes/clickup";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import produtosRouter from "./routes/produtos";
import briefingAgentRouter from "./routes/briefingAgent";
import { requireAuth } from "./middlewares/requireAuth";
import db from "./config/database";
import http from "http";
import { startCalendarGenerationWorker } from "./jobs/calendarGenerationWorker";

// Inicialização do Express
const app = express();
const PORT = process.env.PORT || 3001;

const setNoCacheHeaders = (res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
};

// ============================================
// 📞 GRAMPO TELEFÔNICO - PRIMEIRA LINHA
// ============================================
app.use((req: Request, _res: Response, next) => {
  console.log(`📞 [GRAMPO] ${req.method} ${req.url} - Timestamp: ${Date.now()}`);
  next();
});

// CORS - suporta origem única ou lista separada por vírgula
// Ex.: CORS_ORIGIN=http://localhost:3006
// Ex.: CORS_ORIGIN=http://localhost:3006,http://localhost:3005,https://app.sphera.com
// Nota: credentials: true removido — sistema não usa cookies/sessão.
//       Reintroduzir junto com origin whitelist se auth por cookie for adotada.
const _rawOrigin = (process.env.CORS_ORIGIN || 'http://localhost:3006').trim();
const ALLOWED_ORIGIN: string | string[] = _rawOrigin.includes(',')
  ? _rawOrigin.split(',').map((o) => o.trim()).filter(Boolean)
  : _rawOrigin;

app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  // credentials: true — omitido (sem cookies/sessão no sistema atual)
}));
console.log(`🔒 [CORS] Origem(ns) permitida(s): ${Array.isArray(ALLOWED_ORIGIN) ? ALLOWED_ORIGIN.join(', ') : ALLOWED_ORIGIN}`);
app.use(express.json({ strict: false }));
app.use((req: Request, _res: Response, next) => {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json') && req.body === null) {
    (req as any).body = {};
  }
  next();
});
app.use(express.urlencoded({ extended: true }));

const clientLogosPath = path.resolve(__dirname, "../storage/client-logos");
app.use(
  "/static/client-logos",
  express.static(clientLogosPath, {
    setHeaders: (res) => setNoCacheHeaders(res as unknown as Response)
  })
);

// Compat: em produção o Nginx costuma fazer proxy apenas de /api,
// então também expomos os mesmos assets em /api/static/client-logos
app.use(
  "/api/static/client-logos",
  express.static(clientLogosPath, {
    setHeaders: (res) => setNoCacheHeaders(res as unknown as Response)
  })
);

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

// Rotas públicas (não passam pelo requireAuth)
app.use("/api/auth", authRouter);
app.use("/api/webhooks", webhooksRouter);

// Middlewares e Rotas Protegidas API baseadas no header Autorization
app.use("/api", requireAuth);

// Rotas da aplicação (Protegidas)
app.use("/api/users", usersRouter);
app.use("/api", postsRouter);
app.use("/api/branding", brandingRouter);
app.use("/api", calendarRouter);
app.use("/api/knowledge", knowledgeRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/branding-upload", brandingUploadRouter);
app.use("/api/prompt-chains", promptChainsRouter);
app.use("/api/datas-comemorativas", datasComemorativasRoutes);
app.use("/api/client-logos", clientLogosRouter);
app.use("/api/presentation", presentationRouter);
app.use("/api/photo-ideas", photoIdeasRouter);
app.use("/api/token-usage", tokenUsageRouter);
app.use("/api/jobs", jobsRouter); // Register jobs routes
app.use("/api", promptTemplatesRouter);
app.use("/api", promptOnboardingRouter);
app.use("/api", onboardingRouter);
app.use("/api", calendarItemsRouter);
app.use("/api/clickup", clickupRouter);
app.use("/api", produtosRouter);
app.use("/api/briefing-agent", briefingAgentRouter);

// Servir arquivos gerados pelo Python (Temporários)
const presentationOutputPath = path.resolve(__dirname, "../python_gen/output");
app.use(
  "/presentation-output",
  express.static(presentationOutputPath, {
    setHeaders: (res) => setNoCacheHeaders(res as unknown as Response)
  })
);

// Servir fontes usadas pelo gerador (para o editor do frontend)
const presentationFontsPath = path.resolve(__dirname, "../python_gen/fonts");
app.use("/presentation-fonts", express.static(presentationFontsPath));

// Servir apresentações salvas (Permanentes)
const presentationsStoragePath = path.resolve(__dirname, "../storage/presentations");
app.use(
  "/storage/presentations",
  express.static(presentationsStoragePath, {
    setHeaders: (res) => setNoCacheHeaders(res as unknown as Response)
  })
);

const deliveriesStoragePath = path.resolve(__dirname, "../storage/deliveries");
app.use(
  "/storage/deliveries",
  express.static(deliveriesStoragePath, {
    setHeaders: (res) => setNoCacheHeaders(res as unknown as Response)
  })
);
// Alias com prefixo /api para compatibilidade com Nginx (que só faz proxy de /api/*)
app.use(
  "/api/storage/deliveries",
  express.static(deliveriesStoragePath, {
    setHeaders: (res) => setNoCacheHeaders(res as unknown as Response)
  })
);

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
const server = http.createServer(app);

// Aumentar timeouts do Node para requests longas (IA pode demorar)
// Obs: ainda pode ser necessário ajustar timeouts do Nginx/Proxy na VPS.
server.requestTimeout = 15 * 60 * 1000; // 15min
server.headersTimeout = 16 * 60 * 1000; // deve ser > requestTimeout
server.keepAliveTimeout = 65 * 1000;

server.listen(PORT, () => {
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

  // Iniciar Worker de Geração de Calendário
  startCalendarGenerationWorker();
});

export default app;
