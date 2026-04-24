import { type HumanHandoff, HandoffReason, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors/NotFoundError';
import { emitEvent } from '../../shared/events/emitEvent';
import { EVENT_TYPES } from '../../shared/events/eventTypes';
import type {
  CheckHandoffResponse,
  HandoffListItem,
  ResolveHandoffInput,
  ResolveHandoffResponse,
  StartHandoffInput,
  StartHandoffResponse,
} from './types';

function mapToStartResponse(handoff: HumanHandoff): StartHandoffResponse {
  return {
    id: handoff.id,
    tenantId: handoff.tenantId,
    personId: handoff.personId,
    reason: handoff.reason,
    reasonDetail: handoff.reasonDetail ?? null,
    agentId: handoff.agentId ?? null,
    agentName: handoff.agentName ?? null,
    chatwootConversationId: handoff.chatwootConversationId ?? null,
    chatwootLabel: handoff.chatwootLabel,
    startedAt: handoff.startedAt,
    resolvedAt: handoff.resolvedAt ?? null,
    botReactivatedAt: handoff.botReactivatedAt ?? null,
    waitSeconds: handoff.waitSeconds ?? null,
    handleSeconds: handoff.handleSeconds ?? null,
    meta: handoff.meta,
    createdAt: handoff.createdAt,
    updatedAt: handoff.updatedAt,
  };
}

export class HandoffService {
  public async check(tenantId: number, personId: number): Promise<CheckHandoffResponse> {
    const activeHandoff = await prisma.humanHandoff.findFirst({
      where: {
        tenantId,
        personId,
        resolvedAt: null,
      },
      orderBy: {
        startedAt: 'desc',
      },
      select: {
        id: true,
        agentName: true,
        reason: true,
        startedAt: true,
      },
    });

    if (!activeHandoff) {
      return { is_human_handling: false };
    }

    return {
      is_human_handling: true,
      handoff_id: activeHandoff.id,
      agent_name: activeHandoff.agentName ?? null,
      started_at: activeHandoff.startedAt.toISOString(),
      reason: activeHandoff.reason,
    };
  }

  public async start(tenantId: number, input: StartHandoffInput): Promise<StartHandoffResponse> {
    const person = await prisma.person.findFirst({
      where: {
        id: input.person_id,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!person) {
      throw new NotFoundError(`Person ${input.person_id} not found`);
    }

    const activeHandoff = await prisma.humanHandoff.findFirst({
      where: {
        tenantId,
        personId: input.person_id,
        resolvedAt: null,
        ...(input.chatwoot_conversation_id
          ? { chatwootConversationId: input.chatwoot_conversation_id }
          : {}),
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (
      activeHandoff &&
      activeHandoff.agentId === (input.agent_id ?? null) &&
      activeHandoff.chatwootConversationId === (input.chatwoot_conversation_id ?? null)
    ) {
      return mapToStartResponse(activeHandoff);
    }

    await prisma.humanHandoff.updateMany({
      where: {
        tenantId,
        personId: input.person_id,
        resolvedAt: null,
      },
      data: {
        resolvedAt: new Date(),
      },
    });

    const handoff = await prisma.humanHandoff.create({
      data: {
        tenantId,
        personId: input.person_id,
        reason: input.reason as HandoffReason,
        reasonDetail: input.reason_detail ?? null,
        agentId: input.agent_id ?? null,
        agentName: input.agent_name ?? null,
        chatwootConversationId: input.chatwoot_conversation_id ?? null,
        chatwootLabel: input.chatwoot_label ?? 'humano',
        meta: (input.meta ?? {}) as Prisma.InputJsonValue,
      },
    });

    await emitEvent({
      tenantId,
      eventType: EVENT_TYPES.HANDOFF_STARTED,
      personId: input.person_id,
      source: 'handoff.service',
      payload: {
        handoff_id: handoff.id,
        reason: input.reason,
      },
    });

    return mapToStartResponse(handoff);
  }

  public async resolve(
    tenantId: number,
    handoffId: number,
    input: ResolveHandoffInput,
  ): Promise<ResolveHandoffResponse> {
    const handoff = await prisma.humanHandoff.findFirst({
      where: {
        id: handoffId,
        tenantId,
      },
    });

    if (!handoff) {
      throw new NotFoundError(`Handoff ${handoffId} not found`);
    }

    const now = new Date();
    const handleSeconds = Math.max(0, Math.floor((now.getTime() - handoff.startedAt.getTime()) / 1000));

    const updated = await prisma.humanHandoff.update({
      where: {
        id: handoffId,
      },
      data: {
        resolvedAt: now,
        botReactivatedAt: input.reactivate_bot ? now : null,
        handleSeconds,
        meta: {
          ...(handoff.meta as Record<string, unknown>),
          ...(input.resolution_note ? { resolution_note: input.resolution_note } : {}),
        } as Prisma.InputJsonValue,
      },
    });

    await emitEvent({
      tenantId,
      eventType: EVENT_TYPES.HANDOFF_RESOLVED,
      personId: handoff.personId,
      source: 'handoff.service',
      payload: {
        handoff_id: handoffId,
        handle_seconds: handleSeconds,
      },
    });

    await emitEvent({
      tenantId,
      eventType: EVENT_TYPES.HANDOFF_ENDED,
      personId: handoff.personId,
      source: 'handoff.service',
      payload: {
        handoff_id: handoffId,
        handle_seconds: handleSeconds,
      },
    });

    if (input.reactivate_bot) {
      await emitEvent({
        tenantId,
        eventType: EVENT_TYPES.BOT_REACTIVATED,
        personId: handoff.personId,
        source: 'handoff.service',
        payload: {
          handoff_id: handoffId,
        },
      });
    }

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      personId: updated.personId,
      reason: updated.reason,
      reasonDetail: updated.reasonDetail ?? null,
      agentId: updated.agentId ?? null,
      agentName: updated.agentName ?? null,
      chatwootConversationId: updated.chatwootConversationId ?? null,
      chatwootLabel: updated.chatwootLabel,
      startedAt: updated.startedAt,
      resolvedAt: updated.resolvedAt ?? null,
      botReactivatedAt: updated.botReactivatedAt ?? null,
      waitSeconds: updated.waitSeconds ?? null,
      handleSeconds: updated.handleSeconds ?? null,
      meta: updated.meta,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  public async resolveActiveByConversation(
    tenantId: number,
    chatwootConversationId: string,
    input: ResolveHandoffInput,
  ): Promise<ResolveHandoffResponse | null> {
    const handoff = await prisma.humanHandoff.findFirst({
      where: {
        tenantId,
        chatwootConversationId,
        resolvedAt: null,
      },
      orderBy: {
        startedAt: 'desc',
      },
      select: {
        id: true,
      },
    });

    if (!handoff) {
      return null;
    }

    return this.resolve(tenantId, handoff.id, input);
  }

  public async getById(tenantId: number, handoffId: number): Promise<StartHandoffResponse> {
    const handoff = await prisma.humanHandoff.findFirst({
      where: {
        id: handoffId,
        tenantId,
      },
    });

    if (!handoff) {
      throw new NotFoundError(`Handoff ${handoffId} not found`);
    }

    return mapToStartResponse(handoff);
  }

  public async listActive(tenantId: number): Promise<HandoffListItem[]> {
    const handoffs = await prisma.humanHandoff.findMany({
      where: {
        tenantId,
        resolvedAt: null,
      },
      orderBy: {
        startedAt: 'desc',
      },
      select: {
        id: true,
        personId: true,
        reason: true,
        agentName: true,
        startedAt: true,
        resolvedAt: true,
      },
    });

    return handoffs;
  }
}
