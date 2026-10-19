import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255).transform((val) => val.trim().toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  displayName: z.string().min(1, 'Display name is required').max(100).trim(),
  timezone: z.string().max(50).default('UTC')
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').transform((val) => val.trim().toLowerCase()),
  password: z.string().min(1, 'Password is required')
});

export const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google credential token is required')
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).trim().optional(),
  timezone: z.string().max(50).optional()
});
