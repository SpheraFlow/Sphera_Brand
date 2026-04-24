import { NextFunction, Request, Response } from 'express';
import {
  AddIdentitySchema,
  PersonIdParamSchema,
  ResolveIdentitySchema,
  SearchPersonSchema,
  UpdatePersonSchema,
} from './schemas';
import { IdentityService } from './service';

const service = new IdentityService();

function parsePersonIdParam(req: Request): number {
  const params = PersonIdParamSchema.parse(req.params);
  return params.id;
}

export const identityController = {
  async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = ResolveIdentitySchema.parse(req.body);
      const result = await service.resolve(req.tenantId!, body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const personId = parsePersonIdParam(req);
      const person = await service.getById(req.tenantId!, personId);
      res.status(200).json(person);
    } catch (error) {
      next(error);
    }
  },

  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = SearchPersonSchema.parse(req.query);
      const people = await service.search(req.tenantId!, query);
      res.status(200).json(people);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const personId = parsePersonIdParam(req);
      const body = UpdatePersonSchema.parse(req.body);
      const person = await service.update(req.tenantId!, personId, body);
      res.status(200).json(person);
    } catch (error) {
      next(error);
    }
  },

  async addIdentity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const personId = parsePersonIdParam(req);
      const body = AddIdentitySchema.parse(req.body);
      const identity = await service.addIdentity(req.tenantId!, personId, body);
      res.status(201).json(identity);
    } catch (error) {
      next(error);
    }
  },
};
