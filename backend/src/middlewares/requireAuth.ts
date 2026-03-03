import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';

export interface AuthRequest extends Request {
    user?: TokenPayload;
}

/**
 * Middleware para garantir que a rota seja acessada apenas por usuários autenticados
 */
export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ success: false, error: 'Token não fornecido ou inválido' });
            return;
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            res.status(401).json({ success: false, error: 'Token não fornecido' });
            return;
        }

        const payload = verifyToken(token);
        req.user = payload;
        next();
    } catch (error) {
        console.error('Erro na autenticação:', error);
        res.status(401).json({ success: false, error: 'Sessão expirada ou inválida' });
    }
};

/**
 * Middleware focado em requerer privilégios de Admin 
 * Como fallback e retrocompatibilidade com código existente
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
        res.status(401).json({ success: false, error: 'Não autenticado' });
        return;
    }

    if (req.user.role !== 'admin' && !req.user.permissions?.team_manage) {
        res.status(403).json({ success: false, error: 'Acesso negado. Requer nível Administrativo' });
        return;
    }

    next();
};

/**
 * Middleware dinâmico para requerimento de permissões específicas do JSONB
 */
export const requirePermission = (permissionKey: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Não autenticado' });
            return;
        }

        // Se o usuário é um super admin absoluto garantido via role (fallback) ou tem a flag específica
        if (req.user.role === 'admin' || req.user.permissions?.[permissionKey] === true) {
            return next();
        }

        res.status(403).json({ success: false, error: `Acesso negado. A permissão '${permissionKey}' é obrigatória.` });
    };
};
