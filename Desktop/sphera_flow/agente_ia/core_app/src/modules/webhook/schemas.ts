import { z } from 'zod';

export const ChatwootWebhookSchema = z.object({
  event: z.string(),
  conversation: z.record(z.unknown()).optional(),
  contact: z.record(z.unknown()).optional(),
  message_type: z.string().optional(),
  content_type: z.string().optional(),
  private: z.boolean().optional(),
  sender: z.record(z.unknown()).optional(),
}).passthrough();
