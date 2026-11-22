import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateRangeValidation = (data) => {
  if (data.startDate && data.deadline) {
    return data.startDate <= data.deadline;
  }
  return true;
};

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(100, 'Name must be 100 characters or fewer'),
  description: z.string().max(5000, 'Description must be 5000 characters or fewer').default(''),
  visibility: z.enum(['workspace', 'private']).default('workspace'),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).default('none'),
  startDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
  deadline: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
}).refine(dateRangeValidation, {
  message: 'startDate must be before or equal to deadline',
  path: ['deadline'],
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(100, 'Name must be 100 characters or fewer').optional(),
  description: z.string().max(5000, 'Description must be 5000 characters or fewer').optional(),
  visibility: z.enum(['workspace', 'private']).optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  startDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
  deadline: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
  expectedVersion: z.coerce.number().int().min(1, 'expectedVersion is required for optimistic locking'),
}).refine(dateRangeValidation, {
  message: 'startDate must be before or equal to deadline',
  path: ['deadline'],
});

export const archiveProjectSchema = z.object({
  expectedVersion: z.coerce.number().int().min(1, 'expectedVersion is required'),
});

export const deleteProjectSchema = z.object({
  confirmName: z.string().trim().min(1, 'Please confirm by entering the project name'),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['lead', 'member']).default('member'),
});

export const updateProjectMemberSchema = z.object({
  role: z.enum(['lead', 'member']),
});

export const listProjectsQuerySchema = z.object({
  archived: z.enum(['true', 'false', 'all']).default('false'),
  search: z.string().optional(),
});

export const activityQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
