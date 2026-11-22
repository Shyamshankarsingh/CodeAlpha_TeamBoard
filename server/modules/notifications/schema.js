import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
  unreadOnly: z.preprocess((val) => {
    if (typeof val === 'string') return val === 'true' || val === '1';
    return Boolean(val);
  }, z.boolean().optional().default(false)),
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid(),
});
