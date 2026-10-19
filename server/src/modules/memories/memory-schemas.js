import { z } from 'zod';

export const createMemorySchema = z.object({
  content: z.string().min(1, 'Memory content cannot be empty').max(2000).trim(),
  category: z.enum(['general', 'preference', 'project', 'goal']).default('general')
});

export const updateMemorySchema = z.object({
  content: z.string().min(1).max(2000).trim().optional(),
  category: z.enum(['general', 'preference', 'project', 'goal']).optional()
});

export const listMemoriesQuerySchema = z.object({
  category: z.enum(['general', 'preference', 'project', 'goal']).optional(),
  search: z.string().max(100).optional()
});
