import { createHash } from 'node:crypto';
import express from 'express';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENT_TYPES } from '../../src/shared/events/eventTypes';
import { handoffRouter } from '../../src/modules/handoff/router';
type ApiKeyRow = {
  id: number;
  tenantId: number;
  keyHash: string;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
};

type PersonRow = {
  id: number;
  tenantId: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  custom: Record<string, unknown>;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type HandoffRow = {
  id: number;
  tenantId: number;
  personId: number;
  reason: string;
  reasonDetail: string | null;
  agentId: string | null;
  agentName: string | null;
  chatwootConversationId: string | null;
  chatwootLabel: string;
  startedAt: Date;
  resolvedAt: Date | null;
  botReactivatedAt: Date | null;
  waitSeconds: number | null;
  handleSeconds: number | null;
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type EventRow = {
  tenantId: number;
  eventType: string;
  personId: number | null;
  channelType: string | null;
  source: string | null;
  payload: Record<string, unknown>;
  latencyMs: number | null;
  errorCode: string | null;
  occurredAt: Date;
  createdAt: Date;
};

type MockState = {
  apiKeys: ApiKeyRow[];
  persons: PersonRow[];
  handoffs: HandoffRow[];
  events: EventRow[];
  nextHandoffId: number;
};

const TEST_TENANT_ID = 42;
const TEST_PERSON_ID = 7;
const TEST_API_KEY = 'handoff-test-api-key';

const { mockState, mockPrisma } = vi.hoisted(() => {
  const state: MockState = {
    apiKeys: [],
    persons: [],
    handoffs: [],
    events: [],
    nextHandoffId: 1,
  };

  function clonePerson(person: PersonRow): PersonRow {
    return {
      ...person,
      tags: [...person.tags],
      custom: { ...person.custom },
    };
  }

  function cloneHandoff(handoff: HandoffRow): HandoffRow {
    return {
      ...handoff,
      meta: { ...handoff.meta },
    };
  }

  function selectHandoff(handoff: HandoffRow, select: Record<string, boolean> | undefined): Partial<HandoffRow> {
    if (!select) {
      return cloneHandoff(handoff);
    }

    return Object.fromEntries(
      Object.entries(select)
        .filter(([, value]) => value)
        .map(([key]) => [key, handoff[key as keyof HandoffRow]]),
    ) as Partial<HandoffRow>;
  }

  function resolveHandoffWhere(where: Record<string, unknown>): HandoffRow[] {
    return state.handoffs.filter((handoff) => {
      for (const [key, value] of Object.entries(where)) {
        if (key === 'id' && handoff.id !== value) {
          return false;
        }
        if (key === 'tenantId' && handoff.tenantId !== value) {
          return false;
        }
        if (key === 'personId' && handoff.personId !== value) {
          return false;
        }
        if (key === 'resolvedAt' && handoff.resolvedAt !== value) {
          return false;
        }
      }

      return true;
    });
  }

  const prisma = {
    tenantApiKey: {
      findFirst: vi.fn(async ({ where }: { where: { tenantId: number; keyHash: string; revokedAt: null } }) => {
        return (
          state.apiKeys.find(
            (apiKey) =>
              apiKey.tenantId === where.tenantId &&
              apiKey.keyHash === where.keyHash &&
              apiKey.revokedAt === null,
          ) ?? null
        );
      }),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: { lastUsedAt: Date } }) => {
        const row = state.apiKeys.find((apiKey) => apiKey.id === where.id);
        if (!row) {
          throw new Error(`API key ${where.id} not found`);
        }

        row.lastUsedAt = data.lastUsedAt;
        return row;
      }),
    },
    person: {
      findFirst: vi.fn(async ({ where }: { where: { id: number; tenantId: number } }) => {
        return state.persons.find((person) => person.id === where.id && person.tenantId === where.tenantId) ?? null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: Partial<PersonRow> }) => {
        const person = state.persons.find((entry) => entry.id === where.id);
        if (!person) {
          throw new Error(`Person ${where.id} not found`);
        }

        Object.assign(person, data, { updatedAt: new Date() });
        return clonePerson(person);
      }),
    },
    personIdentity: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    humanHandoff: {
      findFirst: vi.fn(
        async ({
          where,
          select,
        }: {
          where: Record<string, unknown>;
          select?: Record<string, boolean>;
        }) => {
          const handoff = resolveHandoffWhere(where).sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0];
          if (!handoff) {
            return null;
          }

          return selectHandoff(handoff, select);
        },
      ),
      findMany: vi.fn(
        async ({
          where,
          select,
        }: {
          where: Record<string, unknown>;
          select?: Record<string, boolean>;
        }) => {
          const matched = resolveHandoffWhere(where).sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
          if (!select) {
            return matched.map(cloneHandoff);
          }

          return matched.map((handoff) => selectHandoff(handoff, select));
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { tenantId: number; personId: number; resolvedAt: null };
          data: { resolvedAt: Date };
        }) => {
          let count = 0;
          for (const handoff of state.handoffs) {
            if (
              handoff.tenantId === where.tenantId &&
              handoff.personId === where.personId &&
              handoff.resolvedAt === where.resolvedAt
            ) {
              handoff.resolvedAt = data.resolvedAt;
              handoff.updatedAt = new Date();
              count += 1;
            }
          }

          return { count };
        },
      ),
      create: vi.fn(async ({ data }: { data: Omit<HandoffRow, 'id' | 'startedAt' | 'resolvedAt' | 'botReactivatedAt' | 'waitSeconds' | 'handleSeconds' | 'createdAt' | 'updatedAt'> & Partial<Pick<HandoffRow, 'startedAt' | 'resolvedAt' | 'botReactivatedAt' | 'waitSeconds' | 'handleSeconds' | 'createdAt' | 'updatedAt'>> }) => {
        const now = new Date();
        const id = state.nextHandoffId;
        state.nextHandoffId += 1;
        const handoff: HandoffRow = {
          id,
          tenantId: data.tenantId,
          personId: data.personId,
          reason: data.reason,
          reasonDetail: data.reasonDetail ?? null,
          agentId: data.agentId ?? null,
          agentName: data.agentName ?? null,
          chatwootConversationId: data.chatwootConversationId ?? null,
          chatwootLabel: data.chatwootLabel,
          startedAt: data.startedAt ?? now,
          resolvedAt: data.resolvedAt ?? null,
          botReactivatedAt: data.botReactivatedAt ?? null,
          waitSeconds: data.waitSeconds ?? null,
          handleSeconds: data.handleSeconds ?? null,
          meta: (data.meta ?? {}) as Record<string, unknown>,
          createdAt: data.createdAt ?? now,
          updatedAt: data.updatedAt ?? now,
        };

        state.handoffs.push(handoff);
        return cloneHandoff(handoff);
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: number };
          data: Partial<HandoffRow> & { resolvedAt?: Date; botReactivatedAt?: Date; handleSeconds?: number };
        }) => {
          const handoff = state.handoffs.find((entry) => entry.id === where.id);
          if (!handoff) {
            throw new Error(`Handoff ${where.id} not found`);
          }

          Object.assign(handoff, data, { updatedAt: new Date() });
          return cloneHandoff(handoff);
        },
      ),
    },
    eventLog: {
      create: vi.fn(async ({ data }: { data: EventRow }) => {
        state.events.push({
          ...data,
          payload: { ...data.payload },
          occurredAt: new Date(),
          createdAt: new Date(),
        });

        return data;
      }),
    },
  };

  return { mockState: state, mockPrisma: prisma };
});

vi.mock('../../src/config/database', () => ({
  prisma: mockPrisma,
}));

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', handoffRouter);
  return app;
}

function resetState(): void {
  mockState.apiKeys.length = 0;
  mockState.persons.length = 0;
  mockState.handoffs.length = 0;
  mockState.events.length = 0;
  mockState.nextHandoffId = 1;
  vi.clearAllMocks();
}

function seedBaseData(): void {
  const apiKeyHash = createHash('sha256').update(TEST_API_KEY).digest('hex');

  mockState.apiKeys.push({
    id: 1,
    tenantId: TEST_TENANT_ID,
    keyHash: apiKeyHash,
    revokedAt: null,
    lastUsedAt: null,
  });

  const now = new Date();
  mockState.persons.push({
    id: TEST_PERSON_ID,
    tenantId: TEST_TENANT_ID,
    name: 'Paciente HOC',
    phone: '5511999999999',
    email: null,
    tags: [],
    custom: {},
    firstSeenAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

describe('handoff module', () => {
  beforeEach(() => {
    resetState();
    seedBaseData();
  });

  it('returns false when there is no active handoff', async () => {
    const app = buildApp();

    const response = await request(app)
      .get('/api/handoffs/check')
    .set('X-API-Key', TEST_API_KEY)
    .set('X-Tenant-Id', String(TEST_TENANT_ID))
    .query({ person_id: TEST_PERSON_ID });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ is_human_handling: false });
  });

  it('creates a handoff, emits an event, and makes check return true', async () => {
    const app = buildApp();

    const startResponse = await request(app)
      .post('/api/handoffs')
      .set('X-API-Key', TEST_API_KEY)
      .set('X-Tenant-Id', String(TEST_TENANT_ID))
      .send({
        person_id: TEST_PERSON_ID,
        reason: 'solicitacao_usuario',
        agent_name: 'Joana',
      });

    expect(startResponse.status).toBe(201);
    expect(startResponse.body).toMatchObject({
      id: 1,
      tenantId: TEST_TENANT_ID,
      personId: TEST_PERSON_ID,
      reason: 'solicitacao_usuario',
      agentName: 'Joana',
      resolvedAt: null,
    });

    expect(mockState.events.map((event) => event.eventType)).toContain(EVENT_TYPES.HANDOFF_STARTED);

    const checkStarted = Date.now();
    const checkResponse = await request(app)
      .get('/api/handoffs/check')
      .set('X-API-Key', TEST_API_KEY)
      .set('X-Tenant-Id', String(TEST_TENANT_ID))
      .query({ person_id: TEST_PERSON_ID });
    const durationMs = Date.now() - checkStarted;

    expect(checkResponse.status).toBe(200);
    expect(checkResponse.body).toMatchObject({
      is_human_handling: true,
      handoff_id: 1,
      agent_name: 'Joana',
      reason: 'solicitacao_usuario',
    });
    expect(durationMs).toBeLessThan(100);
  });

  it('resolves a handoff, emits lifecycle events, and returns false again', async () => {
    const app = buildApp();

    const startResponse = await request(app)
      .post('/api/handoffs')
      .set('X-API-Key', TEST_API_KEY)
      .set('X-Tenant-Id', String(TEST_TENANT_ID))
      .send({
        person_id: TEST_PERSON_ID,
        reason: 'escalacao_agente',
        agent_name: 'Carlos',
      });

    const resolveResponse = await request(app)
      .post(`/api/handoffs/${startResponse.body.id}/resolve`)
      .set('X-API-Key', TEST_API_KEY)
      .set('X-Tenant-Id', String(TEST_TENANT_ID))
      .send({
        resolution_note: 'Atendimento concluido',
      });

    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.body).toMatchObject({
      id: startResponse.body.id,
      resolvedAt: expect.any(String),
      botReactivatedAt: expect.any(String),
    });

    expect(mockState.events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        EVENT_TYPES.HANDOFF_STARTED,
        EVENT_TYPES.HANDOFF_RESOLVED,
        EVENT_TYPES.HANDOFF_ENDED,
        EVENT_TYPES.BOT_REACTIVATED,
      ]),
    );

    const checkResponse = await request(app)
      .get('/api/handoffs/check')
      .set('X-API-Key', TEST_API_KEY)
      .set('X-Tenant-Id', String(TEST_TENANT_ID))
      .query({ person_id: TEST_PERSON_ID });

    expect(checkResponse.body).toEqual({ is_human_handling: false });
  });

  it('keeps only the latest handoff active for the same person', async () => {
    const app = buildApp();

    const firstStart = await request(app)
      .post('/api/handoffs')
      .set('X-API-Key', TEST_API_KEY)
      .set('X-Tenant-Id', String(TEST_TENANT_ID))
      .send({
        person_id: TEST_PERSON_ID,
        reason: 'label_humano',
        agent_name: 'Primeiro',
      });

    const secondStart = await request(app)
      .post('/api/handoffs')
      .set('X-API-Key', TEST_API_KEY)
      .set('X-Tenant-Id', String(TEST_TENANT_ID))
      .send({
        person_id: TEST_PERSON_ID,
        reason: 'campanha',
        agent_name: 'Segundo',
      });

    expect(firstStart.status).toBe(201);
    expect(secondStart.status).toBe(201);
    expect(firstStart.body.id).toBe(1);
    expect(secondStart.body.id).toBe(2);
    expect(mockState.handoffs).toHaveLength(2);
    expect(mockState.handoffs[0].resolvedAt).toBeInstanceOf(Date);
    expect(mockState.handoffs[1].resolvedAt).toBeNull();

    const checkResponse = await request(app)
      .get('/api/handoffs/check')
      .set('X-API-Key', TEST_API_KEY)
      .set('X-Tenant-Id', String(TEST_TENANT_ID))
      .query({ person_id: TEST_PERSON_ID });

    expect(checkResponse.body).toMatchObject({
      is_human_handling: true,
      handoff_id: 2,
      agent_name: 'Segundo',
    });
  });

  it('returns 401 without X-API-Key', async () => {
    const app = buildApp();

    const response = await request(app)
      .get('/api/handoffs/check')
      .set('X-Tenant-Id', String(TEST_TENANT_ID))
      .query({ person_id: TEST_PERSON_ID });

    expect(response.status).toBe(401);
  });
});
