import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import db from "../config/database";
import { requireAuth, requirePermission, AuthRequest } from "../middlewares/requireAuth";

const router = Router();

// Todas as rotas de usuários requerem autenticação e a permissão team_manage
router.use(requireAuth);
router.use(requirePermission('team_manage'));

// GET /api/users - Listar todos os usuários (exceto o próprio para não excluir a si mesmo acidentalmente)
router.get("/", async (_req: AuthRequest, res: Response) => {
    try {
        const result = await db.query(
            `SELECT id, nome, email, role, permissions, ativo, criado_em 
       FROM users 
       ORDER BY criado_em DESC`
        );
        return res.json({ success: true, users: result.rows });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: "Erro ao listar usuários." });
    }
});

// POST /api/users - Criar novo usuário
router.post("/", async (req: AuthRequest, res: Response) => {
    try {
        const { nome, email, password, role, permissions } = req.body;

        if (!nome || !email || !password || !role) {
            return res.status(400).json({ success: false, error: "Nome, email, senha e papel são obrigatórios." });
        }

        if (!['admin', 'atendente'].includes(role)) {
            return res.status(400).json({ success: false, error: "Papel inválido. Use 'admin' ou 'atendente'." });
        }

        const fallbackPermissions = {
            dashboard_view: role === 'admin',
            clients_manage: role === 'admin',
            team_manage: role === 'admin',
            content_generate: true,
            content_approve: role === 'admin',
        };

        const finalPermissions = permissions ? { ...fallbackPermissions, ...permissions } : fallbackPermissions;

        const hash = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO users (nome, email, password_hash, role, permissions) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, nome, email, role, permissions, ativo, criado_em`,
            [nome, String(email).trim().toLowerCase(), hash, role, JSON.stringify(finalPermissions)]
        );

        return res.status(201).json({ success: true, user: result.rows[0] });
    } catch (error: any) {
        if (error.code === '23505') { // unique_violation
            return res.status(400).json({ success: false, error: "Email já cadastrado." });
        }
        return res.status(500).json({ success: false, error: "Erro ao criar usuário." });
    }
});

// PUT /api/users/:id/status - Ativar/Desativar usuário
router.put("/:id/status", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { ativo } = req.body;

        if (id === req.user?.id) {
            return res.status(400).json({ success: false, error: "Você não pode desativar o próprio usuário." });
        }

        const result = await db.query(
            "UPDATE users SET ativo = $1 WHERE id = $2 RETURNING id, nome, email, role, ativo",
            [ativo, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Usuário não encontrado." });
        }

        return res.json({ success: true, user: result.rows[0], message: `Usuário ${ativo ? 'ativado' : 'desativado'} com sucesso.` });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: "Erro ao alterar status do usuário." });
    }
});

// PUT /api/users/:id/password - Resetar senha
router.put("/:id/password", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, error: "A nova senha deve ter pelo menos 6 caracteres." });
        }

        const hash = await bcrypt.hash(password, 10);

        const result = await db.query(
            "UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id",
            [hash, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Usuário não encontrado." });
        }

        return res.json({ success: true, message: "Senha atualizada com sucesso." });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: "Erro ao atualizar senha." });
    }
});

export default router;
