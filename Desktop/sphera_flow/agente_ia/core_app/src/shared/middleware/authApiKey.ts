import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { UnauthorizedError } from '../errors/UnauthorizedError';

function normalizeHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export async function authApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = normalizeHeaderValue(req.headers['x-api-key']);
    const tenantIdHeader = normalizeHeaderValue(req.headers['x-tenant-id']);

    if (!apiKey || !tenantIdHeader) {
      throw new UnauthorizedError('Missing X-API-Key or X-Tenant-Id headers');
    }

    const tenantId = Number.parseInt(tenantIdHeader, 10);
    if (Number.isNaN(tenantId)) {
      throw new UnauthorizedError('Invalid X-Tenant-Id');
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const apiKeyRecord = await prisma.tenantApiKey.findFirst({
      where: {
        tenantId,
        keyHash,
        revokedAt: null,
      },
    });

    if (!apiKeyRecord) {
      throw new UnauthorizedError('Invalid or revoked API key');
    }

    void prisma.tenantApiKey
      .update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        // Fire-and-forget: telemetry should never block auth.
      });

    req.tenantId = tenantId;
    req.authType = 'api_key';
    next();
  } catch (err) {
    next(err);
  }
}
