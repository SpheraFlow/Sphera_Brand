import express from 'express';
import request from 'supertest';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/shared/middleware/errorHandler';
import { identityRouter } from '../../src/modules/identity/router';

type StoredIdentity = {
  id: number;
  tenantId: number;
  personId: number;
  channelType: string;
  externalId: string;
  displayName: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  person?: StoredPerson;
};

type StoredPerson = {
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
  identities: StoredIdentity[];
};

type StoredEvent = {
  id: number;
  tenantId: number;
  eventType: string;
  personId: number | null;
  channelType: string | null;
  source: string | null;
  payload: Record<string, unknown>;
  latencyMs: number | null;
};

type TenantApiKeyRow = {
  id: number;
  tenantId: number;
  label: string;
  keyHash: string;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
};

type InMemoryDb = {
  nextPersonId: number;
  nextIdentityId: number;
  nextEventId: number;
  persons: StoredPerson[];
  identities: StoredIdentity[];
  events: StoredEvent[];
  apiKeys: TenantApiKeyRow[];
};

const { prismaMock, resetDb, installBaseMocks } = vi.hoisted(() => {
  const db: InMemoryDb = {
    nextPersonId: 1,
    nextIdentityId: 1,
    nextEventId: 1,
    persons: [],
    identities: [],
    events: [],
    apiKeys: [],
  };

  const prismaMock = {
    tenantApiKey: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    personIdentity: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    person: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    eventLog: {
      create: vi.fn(),
    },
  };

  const cloneIdentity = (identity: StoredIdentity): StoredIdentity => ({
    ...identity,
    person: identity.person ? clonePerson(identity.person) : undefined,
  });

  function clonePerson(person: StoredPerson): StoredPerson {
    return {
      ...person,
      identities: person.identities.map((identity) => cloneIdentity(identity)),
    };
  }

  const resetDb = (): void => {
    db.nextPersonId = 1;
    db.nextIdentityId = 1;
    db.nextEventId = 1;
    db.persons = [];
    db.identities = [];
    db.events = [];
    db.apiKeys = [];
  };

  const attachRelations = (person: StoredPerson): StoredPerson => {
    const linkedIdentities = db.identities.filter((identity) => identity.personId === person.id);
    const identityCopies = linkedIdentities.map((identity) => ({
      ...identity,
      person: undefined,
    }));

    return {
      ...person,
      identities: identityCopies,
    };
  };

  const installBaseMocks = (): void => {
    prismaMock.tenantApiKey.findFirst.mockImplementation(async ({ where }) => {
      const tenantId = where.tenantId as number;
      const keyHash = where.keyHash as string;
      return (
        db.apiKeys.find((key) => key.tenantId === tenantId && key.keyHash === keyHash && key.revokedAt === null) ??
        null
      );
    });

    prismaMock.tenantApiKey.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      tenantId: where.id,
      label: 'n8n-dev',
      keyHash: '',
      revokedAt: null,
      lastUsedAt: data.lastUsedAt instanceof Date ? data.lastUsedAt : null,
    }));

    prismaMock.personIdentity.findUnique.mockImplementation(async ({ where, include }) => {
      const key = `${where.tenantId_channelType_externalId.tenantId}:${where.tenantId_channelType_externalId.channelType}:${where.tenantId_channelType_externalId.externalId}`;
      const identity = db.identities.find(
        (entry) =>
          `${entry.tenantId}:${entry.channelType}:${entry.externalId}` === key,
      );

      if (!identity) {
        return null;
      }

      if (include?.person) {
        const person = db.persons.find((entry) => entry.id === identity.personId && entry.tenantId === identity.tenantId);
        return person ? { ...identity, person: attachRelations(person) } : null;
      }

      return { ...identity };
    });

    prismaMock.personIdentity.create.mockImplementation(async ({ data }) => {
      const identity: StoredIdentity = {
        id: db.nextIdentityId++,
        tenantId: data.tenantId,
        personId: data.personId,
        channelType: data.channelType,
        externalId: data.externalId,
        displayName: data.displayName ?? null,
        verifiedAt: null,
        createdAt: new Date('2026-03-24T20:00:00.000Z'),
      };

      db.identities.push(identity);

      const person = db.persons.find((entry) => entry.id === data.personId && entry.tenantId === data.tenantId);
      if (person) {
        person.identities.push(identity);
      }

      return { ...identity };
    });

    prismaMock.person.create.mockImplementation(async ({ data }) => {
      const now = new Date('2026-03-24T20:00:00.000Z');
      const person: StoredPerson = {
        id: db.nextPersonId++,
        tenantId: data.tenantId,
        name: data.name ?? null,
        phone: data.phone ?? null,
        email: null,
        tags: [],
        custom: {},
        firstSeenAt: now,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
        identities: [],
      };

      db.persons.push(person);

      const createdIdentity = data.identities?.create;
      if (createdIdentity) {
        const identity: StoredIdentity = {
          id: db.nextIdentityId++,
          tenantId: createdIdentity.tenantId,
          personId: person.id,
          channelType: createdIdentity.channelType,
          externalId: createdIdentity.externalId,
          displayName: createdIdentity.displayName ?? null,
          verifiedAt: null,
          createdAt: now,
        };

        db.identities.push(identity);
        person.identities.push(identity);
      }

      return attachRelations(person);
    });

    prismaMock.person.findFirst.mockImplementation(async ({ where }) => {
      const person = db.persons.find(
        (entry) => entry.id === where.id && entry.tenantId === where.tenantId,
      );
      return person ? attachRelations(person) : null;
    });

    prismaMock.person.findMany.mockImplementation(async ({ where }) => {
      const tenantId = where.tenantId as number;
      const persons = db.persons.filter((entry) => entry.tenantId === tenantId);
      const or = Array.isArray(where.OR) ? (where.OR as Array<Record<string, unknown>>) : [];

      if (or.length === 0) {
        return persons.map((person) => attachRelations(person));
      }

      return persons
        .filter((person) =>
          or.some((clause: Record<string, unknown>) => {
            const name = clause.name as { contains?: unknown } | undefined;
            const phone = clause.phone as { contains?: unknown } | undefined;
            const email = clause.email as { contains?: unknown } | undefined;

            if (name && typeof name === 'object' && 'contains' in name) {
              const value = String(name.contains).toLowerCase();
              return (person.name ?? '').toLowerCase().includes(value);
            }

            if (phone && typeof phone === 'object' && 'contains' in phone) {
              const value = String(phone.contains).toLowerCase();
              return (person.phone ?? '').toLowerCase().includes(value);
            }

            if (email && typeof email === 'object' && 'contains' in email) {
              const value = String(email.contains).toLowerCase();
              return (person.email ?? '').toLowerCase().includes(value);
            }

            return false;
          }),
        )
        .map((person) => attachRelations(person));
    });

    prismaMock.person.updateMany.mockImplementation(async ({ where, data }) => {
      const person = db.persons.find(
        (entry) => entry.id === where.id && entry.tenantId === where.tenantId,
      );

      if (!person) {
        return { count: 0 };
      }

      if (typeof data.name === 'string') {
        person.name = data.name;
      }
      if (typeof data.phone === 'string') {
        person.phone = data.phone;
      }
      if (typeof data.email === 'string') {
        person.email = data.email;
      }
      if (Array.isArray(data.tags)) {
        person.tags = data.tags;
      }
      if (data.custom !== undefined) {
        person.custom = data.custom as Record<string, unknown>;
      }
      person.updatedAt = new Date('2026-03-24T20:05:00.000Z');
      if (data.lastSeenAt instanceof Date) {
        person.lastSeenAt = data.lastSeenAt;
      }

      return { count: 1 };
    });

    prismaMock.eventLog.create.mockImplementation(async ({ data }) => {
      const event: StoredEvent = {
        id: db.nextEventId++,
        tenantId: data.tenantId,
        eventType: data.eventType,
        personId: data.personId ?? null,
        channelType: data.channelType ?? null,
        source: data.source ?? null,
        payload: (data.payload ?? {}) as Record<string, unknown>,
        latencyMs: data.latencyMs ?? null,
      };

      db.events.push(event);
      return event;
    });
  };

  installBaseMocks();

  return { prismaMock, resetDb, installBaseMocks };
});

vi.mock('../../src/config/database', () => ({
  prisma: prismaMock,
}));

const apiKeys = new Map<number, string>([
  [1, 'tenant-one-key'],
  [2, 'tenant-two-key'],
]);

function createTestApp(): express.Express {
  const app = express();

  app.use(express.json());
  app.use('/api', identityRouter);
  app.use(errorHandler);

  return app;
}

function mockTenantApiKeyLookup(): void {
  prismaMock.tenantApiKey.findFirst.mockImplementation(async ({ where }) => {
    const tenantId = where.tenantId as number;
    const plaintext = apiKeys.get(tenantId);

    if (!plaintext) {
      return null;
    }

    const expectedHash = createHash('sha256').update(plaintext).digest('hex');
    if (where.keyHash !== expectedHash || where.revokedAt !== null) {
      return null;
    }

    return {
      id: tenantId,
      tenantId,
      label: 'n8n-dev',
      keyHash: expectedHash,
      revokedAt: null,
      lastUsedAt: null,
    };
  });
}

function authHeadersForTenant(tenantId: number): Record<string, string> {
  const apiKey = apiKeys.get(tenantId);

  if (!apiKey) {
    throw new Error(`Missing api key fixture for tenant ${tenantId}`);
  }

  return {
    'X-API-Key': apiKey,
    'X-Tenant-Id': String(tenantId),
  };
}

function jwtForTenant(tenantId: number): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET not set in tests');
  }

  return jwt.sign(
    {
      userId: tenantId * 100,
      tenantId,
      role: 'admin',
    },
    secret,
  );
}

beforeEach(() => {
  resetDb();
  vi.resetAllMocks();
  installBaseMocks();
  mockTenantApiKeyLookup();
});

describe('identity module', () => {
  it('creates a new person when the identity does not exist', async () => {
    const app = createTestApp();

    const response = await request(app)
      .post('/api/persons/resolve')
      .set(authHeadersForTenant(1))
      .send({
        channel: 'whatsapp_evo',
        channel_identifier: '5511999999999',
        display_name: 'Maria Silva',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      person_id: 1,
      is_new: true,
      person: {
        id: 1,
        tenantId: 1,
        name: 'Maria Silva',
        phone: '5511999999999',
        identities: [
          {
            channelType: 'whatsapp_evo',
            externalId: '5511999999999',
            displayName: 'Maria Silva',
          },
        ],
      },
    });
    expect(prismaMock.person.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.eventLog.create).toHaveBeenCalledTimes(1);
  });

  it('returns the existing person when the identity already exists', async () => {
    const now = new Date('2026-03-24T20:00:00.000Z');
    const tenantId = 1;
    const existingPerson: StoredPerson = {
      id: 10,
      tenantId,
      name: 'Maria Silva',
      phone: '5511999999999',
      email: null,
      tags: [],
      custom: {},
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
      identities: [],
    };
    const existingIdentity: StoredIdentity = {
      id: 77,
      tenantId,
      personId: existingPerson.id,
      channelType: 'whatsapp_evo',
      externalId: '5511999999999',
      displayName: 'Maria Silva',
      verifiedAt: null,
      createdAt: now,
      person: existingPerson,
    };
    existingPerson.identities = [existingIdentity];

    prismaMock.personIdentity.findUnique.mockResolvedValue(existingIdentity);
    prismaMock.person.findFirst.mockResolvedValue(existingPerson);
    prismaMock.person.updateMany.mockResolvedValue({ count: 1 });

    const app = createTestApp();

    const response = await request(app)
      .post('/api/persons/resolve')
      .set(authHeadersForTenant(tenantId))
      .send({
        channel: 'whatsapp_evo',
        channel_identifier: '5511999999999',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      person_id: 10,
      is_new: false,
      person: {
        id: 10,
        tenantId,
        identities: [
          {
            id: 77,
            channelType: 'whatsapp_evo',
            externalId: '5511999999999',
          },
        ],
      },
    });
    expect(prismaMock.person.create).not.toHaveBeenCalled();
    expect(prismaMock.eventLog.create).not.toHaveBeenCalled();
  });

  it('keeps tenants isolated when resolving the same identifier', async () => {
    const app = createTestApp();

    const first = await request(app)
      .post('/api/persons/resolve')
      .set(authHeadersForTenant(1))
      .send({
        channel: 'whatsapp_evo',
        channel_identifier: '5511888888888',
      })
      .expect(200);

    const second = await request(app)
      .post('/api/persons/resolve')
      .set(authHeadersForTenant(2))
      .send({
        channel: 'whatsapp_evo',
        channel_identifier: '5511888888888',
      })
      .expect(200);

    expect(first.body.person_id).not.toBe(second.body.person_id);
    expect(first.body.person.tenantId).toBe(1);
    expect(second.body.person.tenantId).toBe(2);
  });

  it('returns 404 when a person belongs to another tenant', async () => {
    const app = createTestApp();

    await request(app)
      .get('/api/persons/999')
      .set({
        Authorization: `Bearer ${jwtForTenant(1)}`,
      })
      .expect(404);
  });

  it('rejects resolve requests without api key headers', async () => {
    const app = createTestApp();

    await request(app)
      .post('/api/persons/resolve')
      .send({
        channel: 'whatsapp_evo',
        channel_identifier: '5511777777777',
      })
      .expect(401);
  });

  it('records the person.created event when resolving a new person', async () => {
    const app = createTestApp();

    await request(app)
      .post('/api/persons/resolve')
      .set(authHeadersForTenant(1))
      .send({
        channel: 'instagram_dm',
        channel_identifier: 'ig_123',
        display_name: 'Conta Instagram',
      })
      .expect(200);

    expect(prismaMock.eventLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 1,
          eventType: 'person.created',
          personId: 1,
        }),
      }),
    );
  });
});
