import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment body is required').max(5000, 'Body must be 5000 characters or fewer'),
  parentId: z.string().uuid('Invalid parent comment ID').nullable().optional(),
  mentions: z.array(z.string().uuid('Invalid user ID')).optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment body is required').max(5000, 'Body must be 5000 characters or fewer'),
  expectedVersion: z.coerce.number().int().min(1, 'expectedVersion is required'),
});
