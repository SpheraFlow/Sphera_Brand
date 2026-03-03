import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";



// 1. Configuração de Pastas

const uploadDir = path.resolve(__dirname, '../../storage/uploads');

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



const upload = multer({ storage: storage });

const router = Router();



// 3. Rota POST /process-post

router.post("/process-post", (req: Request, res: Response, next: NextFunction) => {

    const uploadMiddleware = upload.any();



    uploadMiddleware(req, res, (err: any) => {

        if (err) {

            console.error("❌ [ERRO MULTER]:", err);

            // CORREÇÃO TS7030: Chamamos o res, mas retornamos VOID.

            res.status(500).json({ error: "Falha no upload físico", details: err.message });

            return;

        }

        // Caminho de sucesso também retorna void

        next();

    });

}, async (req: Request, res: Response): Promise<void> => {

    // Promise<void> para garantir consistência

    console.log("🔥 [DEBUG] Iniciando processamento...");



    try {

        const files = req.files as Express.Multer.File[] | undefined;



        if (!files || files.length === 0) {

            console.error("❌ Nenhum arquivo encontrado em req.files");

            res.status(400).json({ error: "Nenhum arquivo enviado." });

            return;

        }



        const file = files[0];

        // Verificação adicional para garantir que file não é undefined
        if (!file) {
            console.error("❌ Arquivo na posição 0 é undefined");
            res.status(400).json({ error: "Arquivo inválido." });
            return;
        }

        console.log(`📁 [DEBUG] Arquivo recebido: ${file.filename}`);



        // IA (Gemini)
        if (process.env.GOOGLE_API_KEY) {
            console.log("🤖 [IA] Enviando para Gemini...");

            const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

            const fileBuffer = fs.readFileSync(file.path);

            const imagePart = {
                inlineData: {
                    data: fileBuffer.toString("base64"),
                    mimeType: file.mimetype,
                },
            };

            const prompt = "Analise esta imagem para um post de rede social. Descreva o estilo visual, elementos principais e sugira uma categoria. Retorne JSON.";

            let result;
            let responseText = "";

            const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

            for (const modelName of modelsToTry) {
                try {
                    console.log(`🤖 [DEBUG] Tentando modelo: ${modelName}...`);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    result = await model.generateContent([prompt, imagePart]);
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

            console.log("✅ [IA] Sucesso.");

            res.json({
                success: true,
                message: "Arquivo processado",
                analysis: responseText,
                file: file.filename
            });
            return;

        } else {
            res.json({ success: true, message: "Arquivo salvo (sem IA configurada)", file: file.filename });
            return;
        }

    } catch (error: any) {
        console.error("❌ [ERRO GERAL]:", error);
        res.status(500).json({ error: "Erro interno", details: error.message });
        return;
    }

});



// Rota Simples de Upload (Backup)

router.post("/upload-post", upload.single("file"), (req: Request, res: Response) => {

    if (!req.file) {

        res.status(400).json({ error: "Nenhum arquivo enviado" });

        return;

    }

    res.json({

        success: true,

        postId: "temp-" + Date.now(),

        filePath: req.file.filename

    });

});



export default router;