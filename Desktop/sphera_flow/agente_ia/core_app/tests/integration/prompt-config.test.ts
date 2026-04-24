import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promptConfigRouter } from '../../src/modules/prompt-config/router';

const prismaMock = vi.hoisted(() => ({
  promptPack: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  tenantConfig: {
    findMany: vi.fn(),
  },
  tenantApiKey: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../src/config/database', () => ({
  prisma: prismaMock,
}));

const sharedHeaders = {
  'x-api-key': 'test-api-key',
  'x-tenant-id': '1',
};

const jwtSecret = 'test_secret_with_at_least_32_characters';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api', promptConfigRouter);
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof Error && err.name === 'UnauthorizedError') {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: err.message } });
      return;
    }

    if (err instanceof Error && err.name === 'NotFoundError') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      return;
    }

    if (err instanceof Error && err.name === 'ValidationError') {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      return;
    }

    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  });

  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Prompt Config Module', () => {
  it('returns the active pack for the correct channel and includes tenant variables', async () => {
    prismaMock.tenantConfig.findMany.mockResolvedValueOnce([
      { key: 'bot_name', value: 'Atendente HOC' },
      { key: 'default_timezone', value: 'America/Sao_Paulo' },
    ]);

    prismaMock.tenantApiKey.findFirst.mockResolvedValueOnce({
      id: 1,
      tenantId: 1,
      label: 'n8n-dev',
      keyHash: 'hash',
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });
    prismaMock.tenantApiKey.update.mockResolvedValueOnce({ id: 1 });

    prismaMock.promptPack.findFirst.mockResolvedValueOnce({
      id: 10,
      name: 'WhatsApp HOC',
      systemPrompt: 'System prompt here',
      modelName: 'gemini-pro',
      temperature: 0.7,
      contextWindowSize: 50,
      channelType: 'whatsapp_evo',
    });

    const app = createApp();

    const response = await request(app)
      .get('/api/prompt-packs/active?channel=whatsapp_evo')
      .set(sharedHeaders)
      .expect(200);

    expect(response.body).toEqual({
      id: 10,
      name: 'WhatsApp HOC',
      system_prompt: 'System prompt here',
      model_name: 'gemini-pro',
      temperature: 0.7,
      context_window_size: 50,
      variables: {
        bot_name: 'Atendente HOC',
        default_timezone: 'America/Sao_Paulo',
      },
    });
  });

  it('returns 404 when there is no active prompt pack', async () => {
    prismaMock.tenantConfig.findMany.mockResolvedValueOnce([]);
    prismaMock.tenantApiKey.findFirst.mockResolvedValueOnce({
      id: 1,
      tenantId: 1,
      label: 'n8n-dev',
      keyHash: 'hash',
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });
    prismaMock.tenantApiKey.update.mockResolvedValueOnce({ id: 1 });
    prismaMock.promptPack.findFirst.mockResolvedValueOnce(null);
    prismaMock.promptPack.findFirst.mockResolvedValueOnce(null);

    const app = createApp();

    const response = await request(app)
      .get('/api/prompt-packs/active?channel=whatsapp_evo')
      .set(sharedHeaders)
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'No active prompt pack for tenant 1 channel whatsapp_evo',
      },
    });
  });

  it('creates packs as inactive and allows activating only the selected pack', async () => {
    prismaMock.tenantApiKey.findFirst.mockResolvedValueOnce({
      id: 1,
      tenantId: 1,
      label: 'n8n-dev',
      keyHash: 'hash',
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });
    prismaMock.tenantApiKey.update.mockResolvedValueOnce({ id: 1 });

    prismaMock.promptPack.findFirst.mockResolvedValueOnce({
      id: 22,
      tenantId: 1,
      channelType: 'whatsapp_evo',
      version: 2,
      systemPrompt: 'Active prompt',
      modelName: 'gemini-pro',
      temperature: 0.7,
      contextWindowSize: 50,
      isActive: true,
    });

    prismaMock.promptPack.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.promptPack.update.mockResolvedValueOnce({
      id: 22,
      tenantId: 1,
      channelType: 'whatsapp_evo',
      version: 2,
      systemPrompt: 'Active prompt',
      modelName: 'gemini-pro',
      temperature: 0.7,
      contextWindowSize: 50,
      isActive: true,
    });

    prismaMock.promptPack.create.mockResolvedValueOnce({
      id: 21,
      tenantId: 1,
      name: 'New pack',
      channelType: 'whatsapp_evo',
      version: 1,
      systemPrompt: 'Draft prompt',
      contextTemplate: null,
      modelName: 'gemini-pro',
      temperature: 0.7,
      maxTokens: null,
      contextWindowSize: 50,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = createApp();
    const token = jwt.sign({ userId: 7, tenantId: 1, role: 'admin' }, jwtSecret);

    const createResponse = await request(app)
      .post('/api/prompt-packs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New pack',
        channel_type: 'whatsapp_evo',
        system_prompt: 'Draft prompt',
      })
      .expect(201);

    expect(createResponse.body.isActive).toBe(false);

    const activateResponse = await request(app)
      .post('/api/prompt-packs/22/activate')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(prismaMock.promptPack.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 1,
        channelType: 'whatsapp_evo',
        id: { not: 22 },
        isActive: true,
      },
      data: { isActive: false },
    });

    expect(activateResponse.body.isActive).toBe(true);
  });
});
