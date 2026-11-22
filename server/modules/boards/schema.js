import { z } from 'zod';

export const createBoardSchema = z.object({
  name: z.string().trim().min(1, 'Board name is required').max(100, 'Name must be 100 characters or fewer'),
});

export const updateBoardSchema = z.object({
  name: z.string().trim().min(1, 'Board name is required').max(100, 'Name must be 100 characters or fewer'),
  expectedVersion: z.coerce.number().int().min(1, 'expectedVersion is required'),
});

export const createColumnSchema = z.object({
  name: z.string().trim().min(1, 'Column name is required').max(50, 'Column name must be 50 characters or fewer'),
  category: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']),
  prevPosition: z.string().nullable().optional(),
  nextPosition: z.string().nullable().optional(),
});

export const updateColumnSchema = z.object({
  name: z.string().trim().min(1, 'Column name is required').max(50, 'Column name must be 50 characters or fewer').optional(),
  category: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']).optional(),
  expectedVersion: z.coerce.number().int().min(1, 'expectedVersion is required'),
});

export const moveColumnSchema = z.object({
  prevPosition: z.string().nullable().optional(),
  nextPosition: z.string().nullable().optional(),
  targetPosition: z.string().optional(),
  expectedVersion: z.coerce.number().int().min(1, 'expectedVersion is required'),
});

export const deleteColumnSchema = z.object({
  moveToColumnId: z.string().uuid('Invalid destination column ID').optional(),
}).optional();
