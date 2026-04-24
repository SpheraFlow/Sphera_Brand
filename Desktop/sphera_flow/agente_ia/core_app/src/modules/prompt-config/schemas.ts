import { z } from 'zod';

export const promptChannelValues = [
  'whatsapp_cloud',
  'whatsapp_evo',
  'instagram_dm',
  'chatwoot',
  'telegram',
  'email',
  'outro',
] as const;

export const PromptChannelSchema = z.enum(promptChannelValues);

export const GetActivePromptPackQuerySchema = z.object({
  channel: PromptChannelSchema.optional(),
});

export const CreatePromptPackSchema = z.object({
  name: z.string().min(1),
  channel_type: PromptChannelSchema.optional().nullable(),
  system_prompt: z.string().min(1),
  context_template: z.string().optional().nullable(),
  model_name: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional().nullable(),
  context_window_size: z.number().int().positive().optional(),
});

export const UpdatePromptPackSchema = z.object({
  name: z.string().min(1).optional(),
  channel_type: PromptChannelSchema.optional().nullable(),
  system_prompt: z.string().min(1).optional(),
  context_template: z.string().optional().nullable(),
  model_name: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional().nullable(),
  context_window_size: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
});

export const PromptPackIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type GetActivePromptPackQuery = z.infer<typeof GetActivePromptPackQuerySchema>;
export type CreatePromptPackInput = z.infer<typeof CreatePromptPackSchema>;
export type UpdatePromptPackInput = z.infer<typeof UpdatePromptPackSchema>;
export type PromptPackIdParams = z.infer<typeof PromptPackIdParamsSchema>;

