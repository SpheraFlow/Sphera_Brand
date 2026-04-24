import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from '../errors/UnauthorizedError';

interface JwtPayload {
  userId: number;
  tenantId: number;
  role: string;
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<JwtPayload>;

  return (
    typeof candidate.userId === 'number' &&
    typeof candidate.tenantId === 'number' &&
    typeof candidate.role === 'string'
  );
}

export function authJwt(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, env.JWT_SECRET);

    if (!isJwtPayload(payload)) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    req.tenantId = payload.tenantId;
    req.userId = payload.userId;
    req.authType = 'jwt';
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid or expired token'));
      return;
    }

    next(err);
  }
}
