import { Router, Response } from "express";
import axios from "axios";
import db from "../config/database";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth";

const router = Router();
router.use(requireAuth);

export interface ClickUpExportPayload {
    clienteId: string;
    post: {
        tema: string;
        formato: string;
        data: string;
        copy_sugestao: string;
        ideia_visual: string;
        objetivo: string;
        referencias?: string;
        palavras_chave?: string[];
        legenda?: string;
        texto_slides?: string;
        copy_inicial?: string;
    };
}

// POST /api/clickup/export - Exporta um post para o ClickUp
router.post("/export", async (req: AuthRequest, res: Response) => {
    try {
        const { clienteId, post } = req.body as ClickUpExportPayload;

        if (!clienteId || !post) {
            return res.status(400).json({ success: false, error: "Dados incompletos (clienteId, post)." });
        }

        const token = process.env.CLICKUP_API_TOKEN;
        if (!token) {
            return res.status(500).json({ success: false, error: "CLICKUP_API_TOKEN nao configurado no servidor." });
        }

        const clientResult = await db.query("SELECT clickup_list_id FROM clientes WHERE id = $1", [clienteId]);
        if (clientResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Cliente nao encontrado." });
        }

        const listId = clientResult.rows[0].clickup_list_id;
        if (!listId) {
            return res.status(400).json({ success: false, error: "Cliente nao tem 'ID da Lista ClickUp' configurado." });
        }

        const legendaFinal = post.legenda || post.copy_sugestao || '-';
        const textoSlides = post.texto_slides || post.copy_inicial || '';
        const descriptionSections = [
            `**Legenda:**\n${legendaFinal}`,
            `**Instrucoes Visuais:**\n${post.ideia_visual || '-'}`,
            post.formato?.toLowerCase().includes('carrossel') && textoSlides
                ? `**Texto dos Slides:**\n${textoSlides}`
                : null,
            `**Objetivo:**\n${post.objetivo || '-'}`,
            `**Referencias:**\n${post.referencias || '-'}`,
            `**Data Sugerida:** ${post.data || '-'}`,
        ].filter(Boolean);

        const description = descriptionSections.join("\n\n");
        const taskName = `[${post.formato || 'Post'}] ${post.tema || 'Sem tema'}`;

        const clickupResponse = await axios.post(
            `https://api.clickup.com/api/v2/list/${listId}/task`,
            {
                name: taskName,
                markdown_description: description,
                status: "Open"
            },
            {
                headers: {
                    Authorization: token,
                    "Content-Type": "application/json"
                }
            }
        );

        return res.json({ success: true, task: clickupResponse.data });
    } catch (error: any) {
        console.error("Erro ao integrar com ClickUp:", error.response?.data || error.message);
        const apiError = error.response?.data?.err || error.message;
        return res.status(500).json({ success: false, error: "Falha na exportacao para ClickUp: " + apiError });
    }
});

export default router;
