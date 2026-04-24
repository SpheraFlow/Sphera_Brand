import type { HumanHandoff } from '@prisma/client';
import type { z } from 'zod';
import {
  CheckHandoffQuerySchema,
  HandoffIdParamsSchema,
  ResolveHandoffSchema,
  StartHandoffSchema,
} from './schemas';

export type StartHandoffInput = z.infer<typeof StartHandoffSchema>;
export type ResolveHandoffInput = z.infer<typeof ResolveHandoffSchema>;
export type CheckHandoffQueryInput = z.infer<typeof CheckHandoffQuerySchema>;
export type HandoffIdParamsInput = z.infer<typeof HandoffIdParamsSchema>;

export interface CheckHandoffResponse {
  is_human_handling: boolean;
  handoff_id?: number;
  agent_name?: string | null;
  started_at?: string;
  reason?: string;
}

export interface StartHandoffResponse {
  id: number;
  tenantId: number;
  personId: number;
  reason: HumanHandoff['reason'];
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
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export type ResolveHandoffResponse = StartHandoffResponse;

export interface HandoffListItem {
  id: number;
  personId: number;
  reason: HumanHandoff['reason'];
  agentName: string | null;
  startedAt: Date;
  resolvedAt: Date | null;
}
