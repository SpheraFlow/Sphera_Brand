import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../../shared/errors/NotFoundError';
import { CheckHandoffQuerySchema, HandoffIdParamsSchema, ResolveHandoffSchema, StartHandoffSchema } from './schemas';
import { HandoffService } from './service';

const handoffService = new HandoffService();

export const handoffController = {
  async check(req: Request, res: Response): Promise<void> {
    try {
      const query = CheckHandoffQuerySchema.parse(req.query);
      const result = await handoffService.check(req.tenantId!, query.person_id);
      res.status(200).json(result);
    } catch {
      res.status(200).json({ is_human_handling: false });
    }
  },

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = StartHandoffSchema.parse(req.body);
      const result = await handoffService.start(req.tenantId!, body);
      res.status(201).json(result);
    } catch (error: unknown) {
      next(error);
    }
  },

  async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = HandoffIdParamsSchema.parse(req.params);
      const body = ResolveHandoffSchema.parse(req.body);
      const result = await handoffService.resolve(req.tenantId!, params.id, body);
      res.status(200).json(result);
    } catch (error: unknown) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = HandoffIdParamsSchema.parse(req.params);
      const result = await handoffService.getById(req.tenantId!, params.id);
      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof NotFoundError) {
        next(error);
        return;
      }

      next(error);
    }
  },

  async listActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await handoffService.listActive(req.tenantId!);
      res.status(200).json(result);
    } catch (error: unknown) {
      next(error);
    }
  },
};
