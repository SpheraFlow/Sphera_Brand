import { Prisma, type ChannelType as PrismaChannelType } from '@prisma/client';
import { prisma } from '../../config/database';
import type {
  AnalyticsEventsResponse,
  AnalyticsSummaryResponse,
  RecordEventResponse,
} from './types';
import type {
  ListEventsQueryInput,
  RecordBatchInput,
  RecordEventInput,
} from './schemas';

type EventLogCreateData = Prisma.EventLogUncheckedCreateInput;
type EventLogCreateManyData = Prisma.EventLogCreateManyInput;

function toNullableChannel(channel: RecordEventInput['channel']): PrismaChannelType | null {
  return channel ?? null;
}

export class AnalyticsService {
  async recordEvent(tenantId: number, input: RecordEventInput): Promise<RecordEventResponse> {
    const metadata = input.metadata ?? input.payload ?? {};

    const created = await prisma.eventLog.create({
      data: {
        tenantId,
        eventType: input.event_type,
        personId: input.person_id ?? null,
        channelType: toNullableChannel(input.channel),
        source: input.source ?? 'n8n',
        payload: metadata as Prisma.InputJsonValue,
        latencyMs: input.latency_ms ?? null,
        errorCode: input.error_code ?? null,
      } satisfies EventLogCreateData,
    });

    return created;
  }

  async recordBatch(tenantId: number, input: RecordBatchInput): Promise<{ count: number }> {
    const data: EventLogCreateManyData[] = input.events.map((event) => {
      const metadata = event.metadata ?? event.payload ?? {};

      return {
        tenantId,
        eventType: event.event_type,
        personId: event.person_id ?? null,
        channelType: toNullableChannel(event.channel),
        source: event.source ?? 'n8n',
        payload: metadata as Prisma.InputJsonValue,
        latencyMs: event.latency_ms ?? null,
        errorCode: event.error_code ?? null,
      };
    });

    const result = await prisma.eventLog.createMany({
      data,
    });

    return { count: result.count };
  }

  async getSummary(tenantId: number, periodDays = 7): Promise<AnalyticsSummaryResponse> {
    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    const [
      totalReceived,
      totalSent,
      handoffCount,
      handoffEnded,
      leadCreated,
      appointmentCreated,
    ] = await Promise.all([
      prisma.eventLog.count({
        where: { tenantId, eventType: 'message.received', occurredAt: { gte: since } },
      }),
      prisma.eventLog.count({
        where: { tenantId, eventType: 'message.sent', occurredAt: { gte: since } },
      }),
      prisma.eventLog.count({
        where: { tenantId, eventType: 'handoff.started', occurredAt: { gte: since } },
      }),
      prisma.eventLog.count({
        where: { tenantId, eventType: 'handoff.ended', occurredAt: { gte: since } },
      }),
      prisma.eventLog.count({
        where: { tenantId, eventType: 'lead.created', occurredAt: { gte: since } },
      }),
      prisma.eventLog.count({
        where: { tenantId, eventType: 'appointment.created', occurredAt: { gte: since } },
      }),
    ]);

    const latencyAgg = await prisma.eventLog.aggregate({
      where: {
        tenantId,
        eventType: 'ai.reply_sent',
        latencyMs: { not: null },
        occurredAt: { gte: since },
      },
      _avg: { latencyMs: true },
    });

    return {
      period_days: periodDays,
      since: since.toISOString(),
      messages_received: totalReceived,
      messages_sent: totalSent,
      handoff_count: handoffCount,
      handoff_resolved_count: handoffEnded,
      handoff_rate: totalReceived > 0 ? Number((handoffCount / totalReceived).toFixed(4)) : 0,
      leads_created: leadCreated,
      appointments_created: appointmentCreated,
      avg_ai_response_ms: latencyAgg._avg.latencyMs ? Math.round(latencyAgg._avg.latencyMs) : null,
    };
  }

  async listEvents(
    tenantId: number,
    filters: ListEventsQueryInput,
  ): Promise<AnalyticsEventsResponse> {
    const occurredAt: { gte?: Date; lte?: Date } = {};

    if (filters.from) {
      occurredAt.gte = new Date(filters.from);
    }

    if (filters.to) {
      occurredAt.lte = new Date(filters.to);
    }

    const where = {
      tenantId,
      ...(filters.event_type ? { eventType: filters.event_type } : {}),
      ...(filters.person_id ? { personId: filters.person_id } : {}),
      ...(filters.from || filters.to ? { occurredAt } : {}),
    };

    const [events, total] = await Promise.all([
      prisma.eventLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      }),
      prisma.eventLog.count({ where }),
    ]);

    return {
      events,
      total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }
}
