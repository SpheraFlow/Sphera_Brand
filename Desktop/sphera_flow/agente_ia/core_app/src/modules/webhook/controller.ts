import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { BadRequestError } from '../../shared/errors/BadRequestError';
import { UnauthorizedError } from '../../shared/errors/UnauthorizedError';
import { HandoffService } from '../handoff/service';
import { IdentityService } from '../identity/service';
import { ChatwootWebhookSchema } from './schemas';

type UnknownRecord = Record<string, unknown>;

type AssignmentAction = 'assigned' | 'unassigned' | 'ignored';

interface ChatwootConversationState {
  event: string;
  action: AssignmentAction;
  conversationId: string | null;
  contactIdentifier: string | null;
  contactId: string | null;
  contactName: string | undefined;
  assigneeId: string | null;
  assigneeName: string | null;
  accountId: string | null;
  inboxId: string | null;
}

interface ChatwootTenantResolution {
  tenantId: number;
  source: 'chatwoot_inbox_id' | 'chatwoot_account_id';
  accountId: string | null;
  inboxId: string | null;
}

const handoffService = new HandoffService();
const identityService = new IdentityService();

function asRecord(value: unknown): UnknownRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as UnknownRecord;
}

function hasOwn(record: UnknownRecord | undefined, key: string): boolean {
  return !!record && Object.prototype.hasOwnProperty.call(record, key);
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function extractConversationState(body: Record<string, unknown>): ChatwootConversationState {
  const event = toOptionalString(body.event) ?? 'unknown';
  const conversation = asRecord(body.conversation);
  const contact = asRecord(body.contact) ?? asRecord(conversation?.contact);
  const assignee = asRecord(body.assignee) ?? asRecord(conversation?.assignee);
  const account = asRecord(body.account) ?? asRecord(conversation?.account);
  const inbox = asRecord(body.inbox) ?? asRecord(conversation?.inbox);
  const contactInbox =
    asRecord(body.contact_inbox) ??
    asRecord(conversation?.contact_inbox) ??
    asRecord(contact?.contact_inbox);

  const assigneeId =
    toOptionalString(conversation?.assignee_id) ??
    toOptionalString(body.assignee_id) ??
    toOptionalString(assignee?.id) ??
    null;

  const assigneeFieldPresent =
    hasOwn(conversation, 'assignee_id') ||
    hasOwn(body, 'assignee_id') ||
    hasOwn(body, 'assignee') ||
    hasOwn(conversation, 'assignee');

  const conversationId =
    toOptionalString(conversation?.id) ??
    toOptionalString(body.conversation_id) ??
    null;

  const accountId =
    toOptionalString(body.account_id) ??
    toOptionalString(conversation?.account_id) ??
    toOptionalString(account?.id) ??
    null;

  const inboxId =
    toOptionalString(body.inbox_id) ??
    toOptionalString(conversation?.inbox_id) ??
    toOptionalString(inbox?.id) ??
    toOptionalString(contactInbox?.inbox_id) ??
    null;

  const chatwootContactId = toOptionalString(contact?.id) ?? null;
  const contactIdentifier =
    chatwootContactId ??
    toOptionalString(contactInbox?.source_id) ??
    (conversationId ? `conversation:${conversationId}` : null);

  let action: AssignmentAction = 'ignored';
  if (event === 'conversation_updated' && assigneeId) {
    action = 'assigned';
  } else if (event === 'conversation_updated' && assigneeFieldPresent && !assigneeId) {
    action = 'unassigned';
  }

  return {
    event,
    action,
    conversationId,
    contactIdentifier,
    contactId: chatwootContactId,
    contactName:
      toOptionalString(contact?.name) ??
      toOptionalString(contact?.identifier) ??
      toOptionalString(asRecord(body.sender)?.name),
    assigneeId,
    assigneeName:
      toOptionalString(assignee?.name) ??
      toOptionalString(conversation?.assignee_name) ??
      null,
    accountId,
    inboxId,
  };
}

async function resolveTenantFromChatwoot(
  state: ChatwootConversationState,
): Promise<ChatwootTenantResolution> {
  if (state.inboxId) {
    const match = await prisma.tenantConfig.findFirst({
      where: {
        key: 'chatwoot_inbox_id',
        value: state.inboxId,
      },
      select: {
        tenantId: true,
      },
    });

    if (match) {
      return {
        tenantId: match.tenantId,
        source: 'chatwoot_inbox_id',
        accountId: state.accountId,
        inboxId: state.inboxId,
      };
    }
  }

  if (state.accountId) {
    const match = await prisma.tenantConfig.findFirst({
      where: {
        key: 'chatwoot_account_id',
        value: state.accountId,
      },
      select: {
        tenantId: true,
      },
    });

    if (match) {
      return {
        tenantId: match.tenantId,
        source: 'chatwoot_account_id',
        accountId: state.accountId,
        inboxId: state.inboxId,
      };
    }
  }

  throw new BadRequestError(
    `Unable to resolve tenant from Chatwoot payload (account_id=${state.accountId ?? 'n/a'}, inbox_id=${state.inboxId ?? 'n/a'})`,
  );
}

export const webhookController = {
  async handleChatwoot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['x-chatwoot-signature'];
      const timestamp = req.headers['x-chatwoot-timestamp'];
      const secret = process.env.CHATWOOT_WEBHOOK_SECRET;

      if (signature && timestamp && secret) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const ts = Number(timestamp);
        if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 300) {
          throw new UnauthorizedError('Webhook rejected: timestamp expired');
        }

        const rawBody = (req as { rawBody?: string }).rawBody || JSON.stringify(req.body);
        const expected = `sha256=${crypto
          .createHmac('sha256', secret)
          .update(`${timestamp}.${rawBody}`)
          .digest('hex')}`;

        const provided = Buffer.from(String(signature));
        const computed = Buffer.from(expected);
        const isValid =
          provided.length === computed.length &&
          crypto.timingSafeEqual(computed, provided);

        if (!isValid) {
          throw new UnauthorizedError('Invalid Chatwoot signature');
        }
      }

      const body = ChatwootWebhookSchema.parse(req.body);
      const parsedBody = body as Record<string, unknown>;
      const state = extractConversationState(parsedBody);
      const tenantResolution = await resolveTenantFromChatwoot(state);
      const startTime = Date.now();

      if (!signature || !timestamp) {
        logger.warn(
          {
            tenantId: tenantResolution.tenantId,
            account_id: tenantResolution.accountId,
            inbox_id: tenantResolution.inboxId,
          },
          'Missing Chatwoot signature headers - skipping validation for now',
        );
      }

      logger.info(
        {
          tenantId: tenantResolution.tenantId,
          tenant_resolution_source: tenantResolution.source,
          account_id: tenantResolution.accountId,
          inbox_id: tenantResolution.inboxId,
          event: state.event,
          action: state.action,
          conversation_id: state.conversationId,
          contact_id: state.contactId,
        },
        'Chatwoot webhook routed',
      );

      res.status(200).json({ received: true });

      setImmediate(async () => {
        try {
          if (state.action === 'assigned') {
            if (!state.contactIdentifier || !state.conversationId || !state.assigneeId) {
              logger.warn(
                {
                  tenantId: tenantResolution.tenantId,
                  conversation_id: state.conversationId,
                },
                'Chatwoot assignment ignored: missing required identifiers',
              );
              return;
            }

            const identity = await identityService.resolve(tenantResolution.tenantId, {
              channel: 'chatwoot',
              channel_identifier: state.contactIdentifier,
              display_name: state.contactName,
            });

            const handoff = await handoffService.start(tenantResolution.tenantId, {
              person_id: identity.person_id,
              reason: 'escalacao_agente',
              reason_detail: `chatwoot:${state.event}`,
              agent_id: state.assigneeId,
              agent_name: state.assigneeName ?? undefined,
              chatwoot_conversation_id: state.conversationId,
              chatwoot_label: 'humano',
              meta: {
                chatwoot_event: state.event,
                chatwoot_account_id: tenantResolution.accountId,
                chatwoot_inbox_id: tenantResolution.inboxId,
                chatwoot_contact_id: state.contactId,
                chatwoot_contact_identifier: state.contactIdentifier,
                assignee_id: state.assigneeId,
                assignee_name: state.assigneeName,
              },
            });

            logger.info(
              {
                tenantId: tenantResolution.tenantId,
                person_id: identity.person_id,
                handoff_id: handoff.id,
                conversation_id: state.conversationId,
                assignee_id: state.assigneeId,
                assignee_name: state.assigneeName,
              },
              'Chatwoot handoff activated; bot sleeping',
            );
            return;
          }

          if (state.action === 'unassigned') {
            if (!state.conversationId) {
              logger.warn(
                {
                  tenantId: tenantResolution.tenantId,
                },
                'Chatwoot unassignment ignored: missing conversation id',
              );
              return;
            }

            const resolved = await handoffService.resolveActiveByConversation(
              tenantResolution.tenantId,
              state.conversationId,
              {
                resolution_note: `chatwoot:${state.event}:assignee_cleared`,
                reactivate_bot: true,
              },
            );

            if (!resolved) {
              logger.info(
                {
                  tenantId: tenantResolution.tenantId,
                  conversation_id: state.conversationId,
                },
                'Chatwoot unassignment ignored: no active handoff found',
              );
              return;
            }

            logger.info(
              {
                tenantId: tenantResolution.tenantId,
                person_id: resolved.personId,
                handoff_id: resolved.id,
                conversation_id: state.conversationId,
              },
              'Chatwoot handoff resolved; bot awakened',
            );
            return;
          }

          logger.info(
            {
              tenantId: tenantResolution.tenantId,
              event: state.event,
              action: state.action,
            },
            'Chatwoot webhook ignored: no handoff state change detected',
          );
        } catch (error) {
          logger.error(
            {
              tenantId: tenantResolution.tenantId,
              err: error,
              event: state.event,
              action: state.action,
            },
            'Chatwoot webhook processing failed',
          );
        } finally {
          logger.info(
            {
              tenantId: tenantResolution.tenantId,
              event: state.event,
              action: state.action,
              latency_ms: Date.now() - startTime,
            },
            'Chatwoot webhook processing finished',
          );
        }
      });
    } catch (error) {
      next(error);
    }
  },
};
