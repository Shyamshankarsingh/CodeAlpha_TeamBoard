import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  APP_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_PATH: z.string().min(1).default('data/teamboard.db'),
  SESSION_IDLE_DAYS: z.coerce.number().positive().default(7),
  SESSION_MAX_DAYS: z.coerce.number().positive().default(30),
  COOKIE_SECURE: z
    .string()
    .transform((val) => val === 'true')
    .or(z.boolean())
    .default(false),
  REQUIRE_EMAIL_VERIFICATION: z
    .string()
    .transform((val) => val === 'true')
    .or(z.boolean())
    .default(false),
  MAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
});

export function loadConfig(env = process.env) {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`Configuration validation error: ${errorDetails}`);
  }

  const config = result.data;

  // Production safety guards
  if (config.NODE_ENV === 'production') {
    if (!config.APP_ORIGIN.startsWith('https://')) {
      throw new Error('In production, APP_ORIGIN must use HTTPS');
    }
  }

  return config;
}

export const config = loadConfig();
