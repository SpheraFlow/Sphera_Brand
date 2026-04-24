import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import { emitEvent } from '../../shared/events/emitEvent';
import { EVENT_TYPES } from '../../shared/events/eventTypes';
import type {
  AddIdentityInput,
  ResolveIdentityInput,
  UpdatePersonInput,
} from './schemas';
import type { ChannelType, PersonRecord, ResolveIdentityResult, SearchPeopleInput } from './types';

function isWhatsappChannel(channel: string): boolean {
  return channel.startsWith('whatsapp');
}

function toPersonRecord(person: {
  id: number;
  tenantId: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  custom: Prisma.JsonValue;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  identities: Array<{
    id: number;
    tenantId: number;
    personId: number;
    channelType: ChannelType;
    externalId: string;
    displayName: string | null;
    verifiedAt: Date | null;
    createdAt: Date;
  }>;
}): PersonRecord {
  return {
    id: person.id,
    tenantId: person.tenantId,
    name: person.name,
    phone: person.phone,
    email: person.email,
    tags: [...person.tags],
    custom: person.custom,
    firstSeenAt: person.firstSeenAt,
    lastSeenAt: person.lastSeenAt,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
    identities: person.identities.map((identity) => ({
      id: identity.id,
      tenantId: identity.tenantId,
      personId: identity.personId,
      channelType: identity.channelType,
      externalId: identity.externalId,
      displayName: identity.displayName,
      verifiedAt: identity.verifiedAt,
      createdAt: identity.createdAt,
    })),
  };
}

function buildSearchWhere(
  tenantId: number,
  input: SearchPeopleInput,
): Prisma.PersonWhereInput {
  const or: Prisma.PersonWhereInput[] = [];

  if (input.q !== undefined) {
    or.push(
      { name: { contains: input.q, mode: 'insensitive' } },
      { phone: { contains: input.q, mode: 'insensitive' } },
      { email: { contains: input.q, mode: 'insensitive' } },
    );
  }

  if (input.phone !== undefined) {
    or.push({ phone: { contains: input.phone, mode: 'insensitive' } });
  }

  if (input.name !== undefined) {
    or.push({ name: { contains: input.name, mode: 'insensitive' } });
  }

  if (input.email !== undefined) {
    or.push({ email: { contains: input.email, mode: 'insensitive' } });
  }

  return or.length > 0 ? { tenantId, OR: or } : { tenantId };
}

async function fetchPerson(tenantId: number, personId: number): Promise<PersonRecord> {
  const person = await prisma.person.findFirst({
    where: { id: personId, tenantId },
    include: { identities: true },
  });

  if (!person) {
    throw new NotFoundError(`Person ${personId} not found`);
  }

  return toPersonRecord(person);
}

export class IdentityService {
  async resolve(tenantId: number, input: ResolveIdentityInput): Promise<ResolveIdentityResult> {
    const existingIdentity = await prisma.personIdentity.findUnique({
      where: {
        tenantId_channelType_externalId: {
          tenantId,
          channelType: input.channel,
          externalId: input.channel_identifier,
        },
      },
      include: {
        person: {
          include: {
            identities: true,
          },
        },
      },
    });

    if (existingIdentity) {
      const updated = await prisma.person.updateMany({
        where: { id: existingIdentity.personId, tenantId },
        data: {
          lastSeenAt: new Date(),
          ...(input.display_name !== undefined && !existingIdentity.person.name
            ? { name: input.display_name }
            : {}),
        },
      });

      if (updated.count === 0) {
        throw new NotFoundError(`Person ${existingIdentity.personId} not found`);
      }

      const person = await fetchPerson(tenantId, existingIdentity.personId);

      return {
        person_id: person.id,
        is_new: false,
        person: toPersonRecord(person),
      };
    }

    const person = await prisma.person.create({
      data: {
        tenantId,
        name: input.display_name ?? null,
        phone: isWhatsappChannel(input.channel) ? input.channel_identifier : null,
        identities: {
          create: {
            tenantId,
            channelType: input.channel,
            externalId: input.channel_identifier,
            displayName: input.display_name ?? null,
          },
        },
      },
      include: {
        identities: true,
      },
    });

    await emitEvent({
      tenantId,
      eventType: EVENT_TYPES.PERSON_CREATED,
      personId: person.id,
      channelType: input.channel,
      source: 'identity.service',
      payload: {
        channel_identifier: input.channel_identifier,
        is_new: true,
      },
    });

    return {
      person_id: person.id,
      is_new: true,
      person: toPersonRecord(person),
    };
  }

  async getById(tenantId: number, personId: number): Promise<PersonRecord> {
    return fetchPerson(tenantId, personId);
  }

  async search(tenantId: number, input: SearchPeopleInput): Promise<PersonRecord[]> {
    const where = buildSearchWhere(tenantId, input);

    const people = await prisma.person.findMany({
      where,
      include: {
        identities: true,
      },
      orderBy: [
        { updatedAt: 'desc' },
        { id: 'desc' },
      ],
    });

    return people.map((person) => toPersonRecord(person));
  }

  async addIdentity(tenantId: number, personId: number, input: AddIdentityInput) {
    await this.getById(tenantId, personId);

    const existingIdentity = await prisma.personIdentity.findUnique({
      where: {
        tenantId_channelType_externalId: {
          tenantId,
          channelType: input.channel,
          externalId: input.channel_identifier,
        },
      },
    });

    if (existingIdentity) {
      throw new ConflictError('Identity already exists for this tenant');
    }

    const identity = await prisma.personIdentity.create({
      data: {
        tenantId,
        personId,
        channelType: input.channel,
        externalId: input.channel_identifier,
        displayName: input.display_name ?? null,
      },
    });

    await emitEvent({
      tenantId,
      eventType: EVENT_TYPES.PERSON_IDENTITY_ADDED,
      personId,
      channelType: input.channel,
      source: 'identity.service',
      payload: {
        channel_identifier: input.channel_identifier,
      },
    });

    return identity;
  }

  async update(tenantId: number, personId: number, input: UpdatePersonInput): Promise<PersonRecord> {
    if (
      input.name === undefined &&
      input.phone === undefined &&
      input.email === undefined &&
      input.tags === undefined &&
      input.custom === undefined
    ) {
      throw new ValidationError('At least one field must be provided');
    }

    const data: Prisma.PersonUpdateManyMutationInput = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }

    if (input.phone !== undefined) {
      data.phone = input.phone;
    }

    if (input.email !== undefined) {
      data.email = input.email;
    }

    if (input.tags !== undefined) {
      data.tags = input.tags;
    }

    if (input.custom !== undefined) {
      data.custom = input.custom as Prisma.InputJsonValue;
    }

    const result = await prisma.person.updateMany({
      where: { id: personId, tenantId },
      data,
    });

    if (result.count === 0) {
      throw new NotFoundError(`Person ${personId} not found`);
    }

    return fetchPerson(tenantId, personId);
  }
}
