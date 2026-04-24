import { z } from 'zod';
import { CHANNEL_TYPES } from './types';

const trimString = z.string().trim();
const optionalQueryString = z.preprocess(
  (value: unknown) => (Array.isArray(value) ? value[0] : value),
  trimString.min(1).max(255).optional(),
);

export const ResolveIdentitySchema = z.object({
  channel: z.enum(CHANNEL_TYPES),
  channel_identifier: trimString.min(1).max(255),
  display_name: trimString.min(1).max(255).optional(),
});

export const AddIdentitySchema = z.object({
  channel: z.enum(CHANNEL_TYPES),
  channel_identifier: trimString.min(1).max(255),
  display_name: trimString.min(1).max(255).optional(),
});

export const UpdatePersonSchema = z
  .object({
    name: trimString.min(1).max(255).optional(),
    phone: trimString.min(1).max(64).optional(),
    email: trimString.email().optional(),
    tags: z.array(trimString.min(1).max(64)).max(50).optional(),
    custom: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.name === undefined &&
      value.phone === undefined &&
      value.email === undefined &&
      value.tags === undefined &&
      value.custom === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided',
      });
    }
  });

export const SearchPersonSchema = z
  .object({
    q: optionalQueryString,
    phone: optionalQueryString,
    name: optionalQueryString,
    email: z.preprocess(
      (value: unknown) => (Array.isArray(value) ? value[0] : value),
      trimString.email().optional(),
    ),
  })
  .superRefine((value, ctx) => {
    if (
      value.q === undefined &&
      value.phone === undefined &&
      value.name === undefined &&
      value.email === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one search filter must be provided',
      });
    }
  });

export const PersonIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type ResolveIdentityInput = z.infer<typeof ResolveIdentitySchema>;
export type AddIdentityInput = z.infer<typeof AddIdentitySchema>;
export type UpdatePersonInput = z.infer<typeof UpdatePersonSchema>;
export type SearchPersonInput = z.infer<typeof SearchPersonSchema>;
export type PersonIdParamInput = z.infer<typeof PersonIdParamSchema>;
