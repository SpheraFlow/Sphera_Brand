import cors from 'cors';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { analyticsRouter } from './modules/analytics/router';
import { handoffRouter } from './modules/handoff/router';
import { identityRouter } from './modules/identity/router';
import { promptConfigRouter } from './modules/prompt-config/router';
import { webhookRouter } from './modules/webhook/router';
import { errorHandler } from './shared/middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());

  // Use raw middleware for chatwoot webhook to preserve signature
  app.use(express.json({
    verify: (req, res, buf) => {
      (req as any).rawBody = buf.toString();
    }
  }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'core_app',
      env: env.NODE_ENV,
      version: process.env.npm_package_version ?? '0.1.0',
    });
  });

  app.use('/api', identityRouter);
  app.use('/api', handoffRouter);
  app.use('/api', promptConfigRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/webhooks', webhookRouter);

  app.use(errorHandler);

  return app;
}
