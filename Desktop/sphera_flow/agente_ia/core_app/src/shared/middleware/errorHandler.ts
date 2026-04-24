import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../config/logger';
import { AppError } from '../errors/AppError';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.flatten().fieldErrors,
      },
    });
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, 'Application error');
    }

    return res.status(err.statusCode).json({
      error: {
        code: err.code ?? 'APP_ERROR',
        message: err.message,
        details: err.details,
      },
    });
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}
