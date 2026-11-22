import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateRangeValidation = (data) => {
  if (data.startDate && data.dueDate) {
    return data.startDate <= data.dueDate;
  }
  return true;
};

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  description: z.string().max(10000, 'Description must be 10000 characters or fewer').default(''),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).default('none'),
  startDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
  dueDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
  prevPosition: z.string().nullable().optional(),
  nextPosition: z.string().nullable().optional(),
}).refine(dateRangeValidation, {
  message: 'startDate must be before or equal to dueDate',
  path: ['dueDate'],
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer').optional(),
  description: z.string().max(10000, 'Description must be 10000 characters or fewer').optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  startDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
  dueDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
  expectedVersion: z.coerce.number().int().min(1, 'expectedVersion is required for optimistic locking'),
}).refine(dateRangeValidation, {
  message: 'startDate must be before or equal to dueDate',
  path: ['dueDate'],
});

export const moveTaskSchema = z.object({
  columnId: z.string().uuid('Invalid column ID').optional(),
  prevPosition: z.string().nullable().optional(),
  nextPosition: z.string().nullable().optional(),
  targetPosition: z.string().optional(),
  expectedVersion: z.coerce.number().int().min(1, 'expectedVersion is required'),
});

export const archiveTaskSchema = z.object({
  expectedVersion: z.coerce.number().int().min(1, 'expectedVersion is required'),
});

export const updateAssigneesSchema = z.object({
  userIds: z.array(z.string().uuid('Invalid user ID')),
});

export const updateLabelsSchema = z.object({
  labelIds: z.array(z.string().uuid('Invalid label ID')),
});

export const createLabelSchema = z.object({
  name: z.string().trim().min(1, 'Label name is required').max(50, 'Name must be 50 characters or fewer'),
  color: z.string().regex(/^#([0-9a-fA-F]{3,8})$/, 'Invalid hex color code (e.g. #3B82F6)'),
});

export const createSubtaskSchema = z.object({
  title: z.string().trim().min(1, 'Subtask title is required').max(200, 'Title must be 200 characters or fewer'),
});

export const updateSubtaskSchema = z.object({
  title: z.string().trim().min(1, 'Subtask title is required').max(200, 'Title must be 200 characters or fewer').optional(),
  completed: z.boolean().optional(),
});

export const moveSubtaskSchema = z.object({
  prevPosition: z.string().nullable().optional(),
  nextPosition: z.string().nullable().optional(),
});

export const listProjectTasksQuerySchema = z.object({
  search: z.string().max(100).optional(),
  columnId: z.string().uuid('Invalid column ID').optional(),
  category: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().uuid('Invalid assignee ID').optional(),
  labelId: z.string().uuid('Invalid label ID').optional(),
  dueDate: z.enum(['overdue', 'today', 'this_week', 'none']).optional(),
  includeArchived: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional().default(false),
  sortBy: z.enum(['position', 'title', 'priority', 'due_date', 'created_at']).optional().default('position'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
