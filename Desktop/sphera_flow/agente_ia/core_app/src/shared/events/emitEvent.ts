import { ChannelType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { EventType } from './eventTypes';

interface EmitEventParams {
  tenantId: number;
  eventType: EventType;
  personId?: number | null;
  channelType?: ChannelType | null;
  source?: string | null;
  payload?: Prisma.InputJsonValue;
  latencyMs?: number | null;
}

export async function emitEvent(params: EmitEventParams): Promise<void> {
  try {
    await prisma.eventLog.create({
      data: {
        tenantId: params.tenantId,
        eventType: params.eventType,
        personId: params.personId ?? null,
        channelType: params.channelType ?? null,
        source: params.source ?? 'core_app',
        payload: params.payload ?? {},
        latencyMs: params.latencyMs ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, eventType: params.eventType }, 'Failed to emit event');
  }
}
