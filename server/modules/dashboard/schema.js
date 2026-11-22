import { z } from 'zod';

export const workspaceDashboardParamsSchema = z.object({
  wid: z.string().uuid(),
});

export const myTasksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
