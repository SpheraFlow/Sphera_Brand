import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyticsRouter } from '../../src/modules/analytics/router';

const prismaMock = vi.hoisted(() => ({
  eventLog: {
    create: vi.fn(),
    createMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
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

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api', analyticsRouter);
  return app;
}

function makeJwt(tenantId: number): string {
  return jwt.sign(
    {
      userId: 9,
      tenantId,
      role: 'admin',
    },
    process.env.JWT_SECRET ?? 'test_secret_with_at_least_32_characters',
    { expiresIn: '15m' },
  );
}

describe('analytics module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tenantApiKey.findFirst.mockResolvedValue({
      id: 1,
      tenantId: 101,
      keyHash: 'hashed-key',
      revokedAt: null,
    });
    prismaMock.tenantApiKey.update.mockResolvedValue({});
    prismaMock.eventLog.create.mockResolvedValue({
      id: 10,
      tenantId: 101,
      eventType: 'message.received',
      personId: 77,
      channelType: 'whatsapp_evo',
      source: 'n8n',
      payload: { foo: 'bar' },
      latencyMs: null,
      errorCode: null,
      occurredAt: new Date('2026-03-24T00:00:00.000Z'),
      createdAt: new Date('2026-03-24T00:00:00.000Z'),
    });
    prismaMock.eventLog.createMany.mockResolvedValue({ count: 2 });
    prismaMock.eventLog.count.mockResolvedValue(0);
    prismaMock.eventLog.aggregate.mockResolvedValue({
      _avg: { latencyMs: 321.7 },
    });
    prismaMock.eventLog.findMany.mockResolvedValue([]);
  });

  it('records a single event through POST /api/events', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/events')
      .set('X-API-Key', 'plain-api-key')
      .set('X-Tenant-Id', '101')
      .send({
        event_type: 'message.received',
        person_id: 77,
        channel: 'whatsapp_evo',
        source: 'n8n',
        payload: { foo: 'bar' },
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: 10,
      tenantId: 101,
      eventType: 'message.received',
      personId: 77,
      channelType: 'whatsapp_evo',
      source: 'n8n',
      payload: { foo: 'bar' },
    });
    expect(prismaMock.tenantApiKey.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.eventLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 101,
        eventType: 'message.received',
        personId: 77,
        channelType: 'whatsapp_evo',
        source: 'n8n',
      }),
    });
  });

  it('records batches and returns count', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/events/batch')
      .set('X-API-Key', 'plain-api-key')
      .set('X-Tenant-Id', '101')
      .send({
        events: [
          {
            event_type: 'message.received',
            channel: 'whatsapp_evo',
          },
          {
            event_type: 'message.sent',
            channel: 'whatsapp_evo',
            latency_ms: 120,
          },
        ],
      })
      .expect(201);

    expect(response.body).toEqual({ count: 2 });
    expect(prismaMock.eventLog.createMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.eventLog.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          tenantId: 101,
          eventType: 'message.received',
        }),
        expect.objectContaining({
          tenantId: 101,
          eventType: 'message.sent',
          latencyMs: 120,
        }),
      ]),
    });
  });

  it('returns tenant-scoped summary data', async () => {
    const app = buildApp();
    prismaMock.eventLog.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1);

    const response = await request(app)
      .get('/api/analytics/summary')
      .query({ period_days: 14 })
      .set('Authorization', `Bearer ${makeJwt(101)}`)
      .expect(200);

    expect(response.body).toMatchObject({
      period_days: 14,
      messages_received: 12,
      messages_sent: 7,
      handoff_count: 3,
      handoff_resolved_count: 2,
      leads_created: 5,
      appointments_created: 1,
      handoff_rate: 0.25,
      avg_ai_response_ms: 322,
    });
    expect(prismaMock.eventLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 101, eventType: 'message.received' }),
      }),
    );
  });

  it('does not leak another tenant summary data', async () => {
    const app = buildApp();
    prismaMock.eventLog.count.mockResolvedValue(0);
    prismaMock.eventLog.aggregate.mockResolvedValue({ _avg: { latencyMs: null } });

    await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${makeJwt(202)}`)
      .expect(200);

    const summaryCalls = prismaMock.eventLog.count.mock.calls.map((call) => call[0]);
    expect(summaryCalls.every((args) => args.where.tenantId === 202)).toBe(true);
  });
});
