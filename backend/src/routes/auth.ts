import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database';
import { signToken } from '../utils/jwt';
import { requireAuth, AuthRequest } from '../middlewares/requireAuth';

const router = Router();

// ==========================================
// Rota de Login
// ==========================================// POST /api/auth/login
router.post("/login", async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: "Email e senha são obrigatórios." });
        }

        const result = await db.query(
            "SELECT id, nome, email, password_hash, role, ativo, permissions FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: "Credenciais inválidas." });
        }

        const user = result.rows[0];

        if (!user.ativo) {
            return res.status(403).json({ success: false, error: "Usuário inativo. Contate o administrador." });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ success: false, error: "Credenciais inválidas." });
        }

        const token = signToken({
            id: user.id,
            role: user.role,
            permissions: user.permissions
        });

        return res.json({
            success: true,
            token,
            user: {
                id: user.id,
                nome: user.nome,
                email: user.email,
                role: user.role,
                permissions: user.permissions
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ success: false, error: 'Erro interno no servidor' });
    }
});

// ==========================================
// Rota "Me" (Valida// POST /api/auth/me (reaproveita rota POST ou GET, faremos GET como convenço padrão, mas mantendo a interface)
router.get("/me", requireAuth, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, error: "Não autenticado." });
        }

        const result = await db.query(
            "SELECT id, nome, email, role, ativo, permissions FROM users WHERE id = $1",
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Usuário não encontrado." });
        }

        const user = result.rows[0];

        if (!user.ativo) {
            return res.status(403).json({ success: false, error: "Usuário inativo." });
        }

        return res.json({
            success: true,
            user: {
                id: user.id,
                nome: user.nome,
                email: user.email,
                role: user.role,
                permissions: user.permissions
            }
        });
    } catch (error) {
        console.error('Erro na validação do token (me):', error);
        res.status(500).json({ success: false, error: 'Erro no servidor' });
    }
});

export default router;
