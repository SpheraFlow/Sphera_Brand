import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors/UnauthorizedError';

export function tenantContext(req: Request, _res: Response, next: NextFunction): void {
  if (!Number.isInteger(req.tenantId)) {
    next(new UnauthorizedError('Tenant context not set'));
    return;
  }

  next();
}
