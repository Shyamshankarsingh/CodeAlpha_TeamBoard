import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required').max(80, 'Name must be 80 characters or fewer'),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required').max(80, 'Name must be 80 characters or fewer'),
});

export const deleteWorkspaceSchema = z.object({
  confirmName: z.string().trim().min(1, 'Please confirm by entering the workspace name'),
});

export const transferOwnershipSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(['admin', 'member', 'viewer']),
});

export const changeRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const listMembersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().optional(),
});
