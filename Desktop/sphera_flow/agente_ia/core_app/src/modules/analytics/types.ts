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

export interface RecordEventResponse {
  id: number;
  tenantId: number;
  eventType: string;
  personId: number | null;
  channelType: ChannelType | null;
  source: string | null;
  payload: Prisma.JsonValue;
  latencyMs: number | null;
  errorCode: string | null;
  occurredAt: Date;
  createdAt: Date;
}

export interface AnalyticsSummaryResponse {
  period_days: number;
  since: string;
  messages_received: number;
  messages_sent: number;
  handoff_count: number;
  handoff_resolved_count: number;
  handoff_rate: number;
  leads_created: number;
  appointments_created: number;
  avg_ai_response_ms: number | null;
}

export interface AnalyticsEventsResponse {
  events: RecordEventResponse[];
  total: number;
  limit: number;
  offset: number;
}
