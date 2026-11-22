import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email().max(255).toLowerCase(),
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 characters or fewer'),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(128, 'Password must be 128 characters or fewer'),
});

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(128, 'Password must be 128 characters or fewer'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(10, 'New password must be at least 10 characters')
    .max(128, 'New password must be 128 characters or fewer'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});
