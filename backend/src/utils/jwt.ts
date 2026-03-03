import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sphera_brand_dev_secret_key_123';
const JWT_EXPIRES_IN = '8h';

export interface TokenPayload {
    id: string;
    role: string;
    permissions?: Record<string, boolean>;
    iat?: number;
    exp?: number;
}

/**
 * Gera um token JWT para o usuário
 */
export function signToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
}

/**
 * Verifica e decodifica um token JWT
 */
export function verifyToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
