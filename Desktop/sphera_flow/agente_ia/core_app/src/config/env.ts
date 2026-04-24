import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORE_APP_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('7d'),
});

export const env = envSchema.parse(process.env);

export type Env = typeof env;
