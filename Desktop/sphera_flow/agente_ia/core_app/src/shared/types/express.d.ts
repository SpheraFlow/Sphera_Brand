import 'express';

declare global {
  namespace Express {
    interface Request {
      tenantId?: number;
      userId?: number;
      authType?: 'api_key' | 'jwt';
    }
  }
}

export {};
