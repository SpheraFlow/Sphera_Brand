import { Router, Response } from "express";
import db from "../config/database";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth";

const router = Router();
router.use(requireAuth);

// Verifica se o usuário autenticado tem acesso ao cliente
async function hasClientAccess(req: AuthRequest, clienteId: string): Promise<boolean> {
    const userRole = req.user?.role;
    const canManage = req.user?.permissions?.clients_manage;
    const userId = req.user?.id;

    if (userRole === "admin" || canManage) return true;

    const result = await db.query(
        "SELECT 1 FROM user_clientes WHERE user_id=$1 AND cliente_id=$2",
        [userId, clienteId]
    );
    return result.rows.length > 0;
}

// GET /api/clientes/:clientId/produtos
router.get("/clientes/:clientId/produtos", async (req: AuthRequest, res: Response) => {
    try {
        const { clientId } = req.params;
        const ativoOnly = req.query.ativo === "true";

        if (!clientId) {
            return res.status(400).json({ success: false, error: "clientId é obrigatório." });
        }

        if (!(await hasClientAccess(req, clientId))) {
            return res.status(403).json({ success: false, error: "Acesso negado ao cliente." });
        }

        let query = "SELECT * FROM produtos WHERE cliente_id = $1";
        const params: any[] = [clientId];

        if (ativoOnly) {
            query += " AND ativo = true";
        }

        query += " ORDER BY created_at DESC";

        const result = await db.query(query, params);
        return res.json({ success: true, produtos: result.rows });
    } catch (error: any) {
        console.error("Erro ao buscar produtos:", error);
        return res.status(500).json({ success: false, error: "Erro interno do servidor." });
    }
});

// POST /api/clientes/:clientId/produtos
router.post("/clientes/:clientId/produtos", async (req: AuthRequest, res: Response) => {
    try {
        const { clientId } = req.params;
        const { nome, categoria, preco, descricao, link_referencia, ativo } = req.body;

        if (!clientId) {
            return res.status(400).json({ success: false, error: "clientId é obrigatório." });
        }

        if (!(await hasClientAccess(req, clientId))) {
            return res.status(403).json({ success: false, error: "Acesso negado ao cliente." });
        }

        if (!nome || typeof nome !== "string") {
            return res.status(400).json({ success: false, error: "O nome do produto é obrigatório." });
        }

        const result = await db.query(
            `INSERT INTO produtos 
                (cliente_id, nome, categoria, preco, descricao, link_referencia, ativo)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                clientId,
                nome,
                categoria || null,
                preco || null,
                descricao || null,
                link_referencia || null,
                ativo !== undefined ? ativo : true
            ]
        );

        return res.status(201).json({ success: true, produto: result.rows[0] });
    } catch (error: any) {
        console.error("Erro ao criar produto:", error);
        return res.status(500).json({ success: false, error: "Erro interno do servidor." });
    }
});

// PUT /api/produtos/:id
router.put("/produtos/:id", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { nome, categoria, preco, descricao, link_referencia, ativo } = req.body;

        // Verificar posse
        const prodResult = await db.query("SELECT cliente_id FROM produtos WHERE id = $1", [id]);
        if (prodResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Produto não encontrado." });
        }

        const clienteId = prodResult.rows[0].cliente_id;
        if (!(await hasClientAccess(req, clienteId))) {
            return res.status(403).json({ success: false, error: "Acesso negado ao cliente." });
        }

        if (!nome || typeof nome !== "string") {
            return res.status(400).json({ success: false, error: "O nome do produto é obrigatório." });
        }

        const result = await db.query(
            `UPDATE produtos 
             SET nome = $1, 
                 categoria = $2, 
                 preco = $3, 
                 descricao = $4, 
                 link_referencia = $5, 
                 ativo = $6,
                 updated_at = NOW()
             WHERE id = $7
             RETURNING *`,
            [
                nome,
                categoria || null,
                preco || null,
                descricao || null,
                link_referencia || null,
                ativo !== undefined ? ativo : true,
                id
            ]
        );

        return res.json({ success: true, produto: result.rows[0] });
    } catch (error: any) {
        console.error("Erro ao atualizar produto:", error);
        return res.status(500).json({ success: false, error: "Erro interno do servidor." });
    }
});

// DELETE /api/produtos/:id
router.delete("/produtos/:id", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Verificar posse
        const prodResult = await db.query("SELECT cliente_id FROM produtos WHERE id = $1", [id]);
        if (prodResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Produto não encontrado." });
        }

        const clienteId = prodResult.rows[0].cliente_id;
        if (!(await hasClientAccess(req, clienteId))) {
            return res.status(403).json({ success: false, error: "Acesso negado ao cliente." });
        }

        await db.query("DELETE FROM produtos WHERE id = $1", [id]);

        return res.json({ success: true, message: "Produto removido com sucesso." });
    } catch (error: any) {
        console.error("Erro ao remover produto:", error);
        return res.status(500).json({ success: false, error: "Erro interno do servidor." });
    }
});

export default router;
