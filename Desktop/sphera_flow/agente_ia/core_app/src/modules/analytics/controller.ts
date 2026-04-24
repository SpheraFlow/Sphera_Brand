import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors/UnauthorizedError';
import { AnalyticsService } from './service';
import {
  ListEventsQuerySchema,
  RecordBatchSchema,
  RecordEventSchema,
  SummaryQuerySchema,
} from './schemas';

const service = new AnalyticsService();

function ensureTenantId(req: Request): number {
  if (!req.tenantId) {
    throw new UnauthorizedError('Tenant context not set');
  }

  return req.tenantId;
}

export const analyticsController = {
  async recordEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = ensureTenantId(req);
      const body = RecordEventSchema.parse(req.body);
      const result = await service.recordEvent(tenantId, body);

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async recordBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = ensureTenantId(req);
      const body = RecordBatchSchema.parse(req.body);
      const result = await service.recordBatch(tenantId, body);

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async summary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = ensureTenantId(req);
      const query = SummaryQuerySchema.parse(req.query);
      const result = await service.getSummary(tenantId, query.period_days);

      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = ensureTenantId(req);
      const query = ListEventsQuerySchema.parse(req.query);
      const result = await service.listEvents(tenantId, query);

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};
