import type { NextFunction, Request, Response } from 'express';
import { PromptConfigService } from './service';
import {
  CreatePromptPackSchema,
  GetActivePromptPackQuerySchema,
  PromptPackIdParamsSchema,
  UpdatePromptPackSchema,
} from './schemas';

const service = new PromptConfigService();

export const promptConfigController = {
  async getCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = GetActivePromptPackQuerySchema.parse(req.query);
      const result = await service.getCurrent(req.tenantId!, query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async getActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = GetActivePromptPackQuerySchema.parse(req.query);
      const result = await service.getActive(req.tenantId!, query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = PromptPackIdParamsSchema.parse(req.params);
      const result = await service.getById(req.tenantId!, params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.list(req.tenantId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = CreatePromptPackSchema.parse(req.body);
      const result = await service.create(req.tenantId!, body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = PromptPackIdParamsSchema.parse(req.params);
      const body = UpdatePromptPackSchema.parse(req.body);
      const result = await service.update(req.tenantId!, params.id, body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = PromptPackIdParamsSchema.parse(req.params);
      const result = await service.activate(req.tenantId!, params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};
