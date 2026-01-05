import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import db from '../config/database';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

// Caminhos absolutos
// Ajuste para sair de src/routes/presentation.ts -> backend/python_gen
const GEN_DIR = path.resolve(__dirname, '../../python_gen');
const CONTENT_FILE = path.join(GEN_DIR, 'content.json');
const SCRIPT_FILE = path.join(GEN_DIR, 'main.py');
const OUTPUT_DIR = path.join(GEN_DIR, 'output');

const resolveClientLogoPathFromUrl = (logoUrl: unknown): string | null => {
    if (!logoUrl || typeof logoUrl !== 'string') return null;

    let pathname = logoUrl;
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        // Remover scheme + host e manter apenas o path
        pathname = logoUrl.replace(/^https?:\/\/[^/]+/i, '');
    }

    const marker = '/static/client-logos/';
    const idx = pathname.lastIndexOf(marker);
    if (idx === -1) return null;

    const filenamePart = pathname.slice(idx + marker.length);
    const beforeQuery = filenamePart.split('?')[0] || '';
    const filename = beforeQuery.split('#')[0] || '';
    if (!filename) return null;

    const absolutePath = path.resolve(__dirname, '../../storage/client-logos', filename);
    if (!fs.existsSync(absolutePath)) return null;
    return absolutePath;
};

router.get('/available-months/:clienteId', async (req: Request, res: Response) => {
    try {
        const { clienteId } = req.params;
        if (!clienteId) return res.status(400).json({ success: false, error: 'Cliente ID é obrigatório' });

        const result = await db.query(
            `SELECT mes
             FROM calendarios
             WHERE cliente_id = $1
             GROUP BY mes
             ORDER BY MAX(criado_em) DESC`,
            [clienteId]
        );

        const months = (result.rows || [])
            .map((r: any) => (r?.mes ? String(r.mes) : ''))
            .filter((m: string) => !!m);

        return res.json({ success: true, months });
    } catch (error: any) {
        console.error('❌ Erro ao listar meses disponíveis:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ROTA NOVA: Gerar conteúdo com IA baseado no calendário
router.post('/generate-content', async (req: Request, res: Response) => {
    try {
        const { clienteId, months } = req.body;

        if (!clienteId) {
            return res.status(400).json({ success: false, error: 'Cliente ID é obrigatório' });
        }

        // 1. Buscar Calendário e Posts (último ou período selecionado)
        const requestedMonths: string[] = Array.isArray(months)
            ? months.map((m: any) => String(m)).filter((m: string) => !!m)
            : [];

        let calendar: any = null;
        let monthLabel = '';

        if (requestedMonths.length > 0) {
            const calResult = await db.query(
                `SELECT mes, calendario_json, criado_em
                 FROM calendarios
                 WHERE cliente_id = $1 AND mes = ANY($2::text[])
                 ORDER BY criado_em DESC`,
                [clienteId, requestedMonths]
            );

            if (calResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Nenhum calendário encontrado para o período selecionado.' });
            }

            monthLabel = requestedMonths.join(' | ');
            calendar = {
                selected_months: requestedMonths,
                calendars: calResult.rows.map((r: any) => ({ mes: r.mes, calendario_json: r.calendario_json }))
            };
        } else {
            const calResult = await db.query(
                "SELECT * FROM calendarios WHERE cliente_id = $1 ORDER BY criado_em DESC LIMIT 1",
                [clienteId]
            );

            if (calResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Nenhum calendário encontrado para este cliente.' });
            }

            calendar = calResult.rows[0].calendario_json;
            monthLabel = calResult.rows[0].mes;
        }

        // 2. Buscar Branding (para contexto)
        const brandResult = await db.query(
            "SELECT * FROM branding WHERE cliente_id = $1 ORDER BY updated_at DESC LIMIT 1",
            [clienteId]
        );
        
        let logoPath = null;
        let brandingData = {};

        if (brandResult.rows.length > 0) {
            const b = brandResult.rows[0];
            brandingData = {
                visual_style: b.visual_style,
                tone_of_voice: b.tone_of_voice,
                audience: b.audience,
                keywords: b.keywords
            };
            
            const logoUrl = (b.logo_url ?? b.logoUrl ?? b.logo ?? b.logo_path ?? b.logoPath) as unknown;
            logoPath = resolveClientLogoPathFromUrl(logoUrl);
        }
        
        const branding = brandingData;

        // 2.1 Buscar nome do cliente (para o planner)
        const clientResult = await db.query(
            "SELECT nome FROM clientes WHERE id = $1",
            [clienteId]
        );
        const clientName = clientResult.rows?.[0]?.nome || '';

        // 3. Montar Prompt para IA
        const prompt = `Você é um assistente de marketing. Analise os dados e retorne APENAS JSON válido, sem texto adicional.

CALENDÁRIO (Período: ${monthLabel}):
${JSON.stringify(calendar, null, 2)}

BRANDING:
${JSON.stringify(branding, null, 2)}

REGRAS IMPORTANTES:
- "defesa.texto_longo" deve ter no máximo 850 caracteres (contando espaços e quebras de linha)
- "grid.texto_longo" deve ter no máximo 850 caracteres (contando espaços e quebras de linha)
- "desafios.itens" deve conter exatamente 9 itens
- cada item em "desafios.itens" deve ter no máximo 55 caracteres (contando espaços e quebras de linha)

Retorne APENAS este JSON preenchido:
{
  "defesa": {
    "subtitulo": "Frase do slogan",
    "texto_longo": "Estratégia em 3 parágrafos (ATÉ 850 caracteres, contando espaços e quebras de linha)"
  },
  "grid": {
    "texto_longo": "Metas em 2 parágrafos (ATÉ 850 caracteres, contando espaços e quebras de linha)"
  },
  "slogan": {
    "frase": "Máximo 5 palavras"
  },
  "desafios": {
    "itens": ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6", "Item 7", "Item 8", "Item 9"]
  },
  "planner": {
    "mes": "MÊS1 | MÊS2 | MÊS3",
    "nome_cliente": "${clientName || 'Nome do Cliente'}"
  }
}`;

        // 4. Chamar Gemini
        if (!process.env.GOOGLE_API_KEY) {
            throw new Error('GOOGLE_API_KEY não configurada');
        }
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        
        let result;
        let responseText = "";

        const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

        for (const modelName of modelsToTry) {
            try {
                console.log(`🤖 [DEBUG] Tentando modelo: ${modelName}...`);
                const model = genAI.getGenerativeModel({ model: modelName });
                result = await model.generateContent(prompt);
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
        
        console.log("🤖 [AI] Resposta recebida (primeiros 500 chars):", responseText.substring(0, 500));

        // Extrair JSON da resposta (pode vir com texto extra)
        let jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Tentar encontrar o JSON entre { e }
        const startIdx = jsonStr.indexOf('{');
        const endIdx = jsonStr.lastIndexOf('}');
        
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            jsonStr = jsonStr.substring(startIdx, endIdx + 1);
        }
        
        console.log("📦 [AI] JSON extraído (primeiros 300 chars):", jsonStr.substring(0, 300));
        
        const content = JSON.parse(jsonStr);

        // Injetar logoPath no planner se existir (prioriza logo vinda do frontend, se houver)
        if (content.planner) {
            const fromPayload = resolveClientLogoPathFromUrl(content.planner.logo_url);
            const finalLogoPath = fromPayload || logoPath;
            if (finalLogoPath) content.planner.logo_path = finalLogoPath;
        }

        // Garantir nome do cliente vindo do cadastro
        if (content.planner && clientName) {
            content.planner.nome_cliente = clientName;
        }

        // 🚨 CRÍTICO: Metas (grid) NUNCA deve ter mês - remover se IA gerou
        if (content.grid) {
            delete content.grid.mes;
        }

        return res.json({ success: true, content });

    } catch (error: any) {
        console.error("❌ Erro ao gerar conteúdo com IA:", error);
        
        // Tratamento especial para erro de cota
        if (error.status === 429) {
            return res.status(429).json({ 
                success: false, 
                error: 'Cota da API Gemini excedida. Aguarde alguns minutos e tente novamente, ou preencha os campos manualmente.',
                retryAfter: error.errorDetails?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay || '1 minuto'
            });
        }
        
        // Se for erro de parsing JSON, logar a resposta completa
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
            console.error("📄 Resposta da IA que causou erro:");
            console.error(error.message);
            return res.status(500).json({ 
                success: false, 
                error: 'A IA retornou um formato inválido. Tente novamente ou preencha manualmente.'
            });
        }
        
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/generate', async (req: Request, res: Response): Promise<void> => {
    console.log("🎨 [PRESENTATION] Solicitada geração de lâminas");
    try {
        const data = req.body;

        // Metas (grid): o usuário não quer mês nessa lâmina.
        // Garantir que nunca vai para o Python, independente do payload/estado.
        if (data?.grid && typeof data.grid === 'object') {
            const before = (data.grid as any).mes;
            if (before !== undefined && before !== '') {
                console.log(`🧼 [PRESENTATION] Removendo grid.mes no início do /generate (antes: "${String(before)}")`);
            }
            delete (data.grid as any).mes;
        }

        const requestedMonths: string[] = Array.isArray(data?.months)
            ? data.months.map((m: any) => String(m)).filter((m: string) => !!m)
            : [];

        if (requestedMonths.length > 0) {
            const label = requestedMonths.join(' | ');
            if (data?.planner && (!data.planner.mes || String(data.planner.mes).toLowerCase().includes('mês'))) {
                data.planner.mes = label;
            }
        }

        // Resolver logo do planner vinda do frontend (se existir)
        if (data?.planner?.logo_url) {
            const fromPayload = resolveClientLogoPathFromUrl(data.planner.logo_url);
            if (fromPayload) data.planner.logo_path = fromPayload;
        }

        // Injetar nome do cliente e logo no planner, se clienteId vier no payload
        const clienteId = data?.clienteId;
        if (clienteId) {
            try {
                const clientResult = await db.query(
                    "SELECT nome FROM clientes WHERE id = $1",
                    [clienteId]
                );
                const clientName = clientResult.rows?.[0]?.nome;

                const brandResult = await db.query(
                    "SELECT * FROM branding WHERE cliente_id = $1 ORDER BY updated_at DESC LIMIT 1",
                    [clienteId]
                );
                const b = brandResult.rows?.[0];
                const logoUrl = b ? (b.logo_url ?? b.logoUrl ?? b.logo ?? b.logo_path ?? b.logoPath) : null;

                const logoPath = resolveClientLogoPathFromUrl(logoUrl);

                if (data.planner && clientName) {
                    data.planner.nome_cliente = clientName;
                }
                if (data.planner && logoPath && !data.planner.logo_path) {
                    data.planner.logo_path = logoPath;
                }
            } catch (e) {
                console.warn('⚠️ [PRESENTATION] Falha ao enriquecer planner com dados do cliente:', e);
            }
        }
        
        // 1. Salvar JSON
        // Blindagem final: garantir que nada reintroduziu o mês nas Metas
        if (data?.grid && typeof data.grid === 'object') {
            const beforeFinal = (data.grid as any).mes;
            if (beforeFinal !== undefined && beforeFinal !== '') {
                console.log(`🧼 [PRESENTATION] Removendo grid.mes antes de salvar content.json (antes: "${String(beforeFinal)}")`);
            }
            delete (data.grid as any).mes;
        }
        console.log(`📝 [PRESENTATION] Payload final antes de salvar - grid.mes: "${(data?.grid as any)?.mes ?? 'undefined'}"`);
        fs.writeFileSync(CONTENT_FILE, JSON.stringify(data, null, 2), { encoding: 'utf-8' });
        console.log("📝 [PRESENTATION] content.json salvo");

        // 2. Rodar Python
        // Comando: python main.py
        // cwd é importante para o script achar templates/fonts relativos a ele
        const pythonBin = process.env.PYTHON_BIN || "python3";
        if (!fs.existsSync(SCRIPT_FILE)) {
            res.status(500).json({
                success: false,
                error: 'Script Python não encontrado',
                details: SCRIPT_FILE
            });
            return;
        }

        exec(`${pythonBin} "${SCRIPT_FILE}"`, { cwd: GEN_DIR }, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ [PRESENTATION] Erro ao executar Python: ${error.message}`);
                console.error(`❌ [PRESENTATION] Stderr: ${stderr}`);
                res.status(500).json({ 
                    success: false, 
                    error: 'Falha na execução do script Python', 
                    details: stderr || error.message 
                });
                return;
            }
            
            console.log(`✅ [PRESENTATION] Python output: ${stdout}`);

            // 3. Listar arquivos gerados
            let files: string[] = [];
            try {
                if (fs.existsSync(OUTPUT_DIR)) {
                    files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
                }
            } catch (readErr) {
                console.error("Erro ao ler pasta output:", readErr);
            }

            // Retornar URLs para o frontend
            // As URLs serão servidas estaticamente
            const urls = files.map(f => `/presentation-output/${f}?t=${Date.now()}`); // timestamp para evitar cache
            
            res.json({ 
                success: true, 
                message: 'Lâminas geradas com sucesso',
                images: urls,
                tempFiles: files // Nomes dos arquivos para salvar depois
            });
        });

    } catch (error: any) {
        console.error("❌ [PRESENTATION] Erro no handler:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ROTA NOVA: Salvar versão definitiva
router.post('/save', async (req: Request, res: Response) => {
    try {
        const { clienteId, tempFiles, dataJson, titulo } = req.body;
        
        if (!clienteId || !tempFiles || !Array.isArray(tempFiles)) {
            return res.status(400).json({ success: false, error: 'Dados incompletos' });
        }

        // Criar pasta de destino
        const timestamp = Date.now();
        const clientStorageDir = path.resolve(__dirname, `../../storage/presentations/${clienteId}/${timestamp}`);
        
        if (!fs.existsSync(clientStorageDir)) {
            fs.mkdirSync(clientStorageDir, { recursive: true });
        }

        const savedUrls: string[] = [];

        // Mover arquivos
        for (const filename of tempFiles) {
            const sourcePath = path.join(OUTPUT_DIR, filename);
            const destPath = path.join(clientStorageDir, filename);
            
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
                savedUrls.push(`/storage/presentations/${clienteId}/${timestamp}/${filename}`);
            }
        }

        // Salvar no banco
        const result = await db.query(
            `INSERT INTO presentations (cliente_id, titulo, arquivos, dados_json)
             VALUES ($1, $2, $3, $4)
             RETURNING id, criado_em`,
            [clienteId, titulo || `Apresentação ${new Date().toLocaleDateString()}`, JSON.stringify(savedUrls), JSON.stringify(dataJson)]
        );

        return res.json({ 
            success: true, 
            message: 'Apresentação salva com sucesso!',
            id: result.rows[0].id,
            savedUrls
        });

    } catch (error: any) {
        console.error("❌ Erro ao salvar apresentação:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ROTA NOVA: Listar histórico
router.get('/history/:clienteId', async (req: Request, res: Response) => {
    try {
        const { clienteId } = req.params;
        const result = await db.query(
            "SELECT * FROM presentations WHERE cliente_id = $1 ORDER BY criado_em DESC",
            [clienteId]
        );

        const history = result.rows.map((row: any) => {
            let arquivos = row.arquivos;
            let dados_json = row.dados_json;

            try {
                if (typeof arquivos === 'string') arquivos = JSON.parse(arquivos);
            } catch (_e) {
                // manter como está
            }

            try {
                if (typeof dados_json === 'string') dados_json = JSON.parse(dados_json);
            } catch (_e) {
                // manter como está
            }

            return { ...row, arquivos, dados_json };
        });

        res.json({ success: true, history });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
