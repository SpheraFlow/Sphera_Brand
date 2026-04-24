import { z } from 'zod';

export const HandoffReasonValues = [
  'label_humano',
  'solicitacao_usuario',
  'escalacao_agente',
  'timeout_bot',
  'campanha',
  'outro',
] as const;

export const StartHandoffSchema = z.object({
  person_id: z.number().int().positive(),
  reason: z.enum(HandoffReasonValues),
  reason_detail: z.string().optional(),
  agent_id: z.string().optional(),
  agent_name: z.string().optional(),
  chatwoot_conversation_id: z.string().optional(),
  chatwoot_label: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

export const ResolveHandoffSchema = z.object({
  resolution_note: z.string().optional(),
  reactivate_bot: z.boolean().optional().default(false),
});

export const CheckHandoffQuerySchema = z.object({
  person_id: z.coerce.number().int().positive(),
});

export const HandoffIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
