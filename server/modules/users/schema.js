import { z } from 'zod';

export const updateMeSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  timezone: z
    .string()
    .refine((tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Invalid IANA timezone')
    .optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  notificationPrefs: z.record(z.string(), z.boolean()).optional(),
});

export const searchUsersSchema = z.object({
  workspaceId: z.string().optional(),
  q: z.string().min(2, 'Search query must be at least 2 characters'),
  limit: z.coerce.number().int().min(1).max(10).default(10),
});
