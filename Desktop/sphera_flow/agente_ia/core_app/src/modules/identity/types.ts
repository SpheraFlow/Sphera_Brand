import type { Prisma } from '@prisma/client';

export const CHANNEL_TYPES = [
  'whatsapp_cloud',
  'whatsapp_evo',
  'instagram_dm',
  'chatwoot',
  'telegram',
  'email',
  'outro',
] as const;

export type ChannelType = (typeof CHANNEL_TYPES)[number];

export interface IdentityRecord {
  id: number;
  tenantId: number;
  personId: number;
  channelType: ChannelType;
  externalId: string;
  displayName: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface PersonRecord {
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
  identities: IdentityRecord[];
}

export interface ResolveIdentityResult {
  person_id: number;
  is_new: boolean;
  person: PersonRecord;
}

export interface SearchPeopleInput {
  q?: string;
  phone?: string;
  name?: string;
  email?: string;
}

export interface PersonIdParams {
  id: number;
}
