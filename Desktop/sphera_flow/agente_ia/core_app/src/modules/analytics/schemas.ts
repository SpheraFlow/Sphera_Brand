import { z } from 'zod';
import { CHANNEL_TYPES } from './types';

export const RecordEventSchema = z.object({
  event_type: z.string().min(1),
  person_id: z.number().int().positive().optional(),
  channel: z.enum(CHANNEL_TYPES).optional(),
  source: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  payload: z.record(z.unknown()).optional(),
  latency_ms: z.number().int().optional(),
  error_code: z.string().min(1).optional(),
});

export const RecordBatchSchema = z.object({
  events: z.array(RecordEventSchema).min(1).max(100),
});

export const SummaryQuerySchema = z.object({
  period_days: z.coerce.number().int().positive().max(365).default(7),
});

export const ListEventsQuerySchema = z.object({
  event_type: z.string().min(1).optional(),
  person_id: z.coerce.number().int().positive().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type RecordEventInput = z.infer<typeof RecordEventSchema>;
export type RecordBatchInput = z.infer<typeof RecordBatchSchema>;
export type SummaryQueryInput = z.infer<typeof SummaryQuerySchema>;
export type ListEventsQueryInput = z.infer<typeof ListEventsQuerySchema>;
