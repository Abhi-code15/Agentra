import { z } from 'zod';

export const taskStatusEnum = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);
export const taskPriorityEnum = z.enum(['low', 'medium', 'high']);

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(255).trim(),
  description: z.string().max(2000).optional().nullable(),
  status: taskStatusEnum.default('pending'),
  priority: taskPriorityEnum.default('medium'),
  dueAt: z.string().datetime({ offset: true }).optional().nullable()
    .or(z.string().datetime().optional().nullable())
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(2000).optional().nullable(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable()
    .or(z.string().datetime().optional().nullable())
});

export const listTasksQuerySchema = z.object({
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  search: z.string().max(100).optional(),
  filter: z.enum(['all', 'overdue', 'upcoming', 'today']).optional(),
  sortBy: z.enum(['due_at', 'created_at', 'priority', 'title']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});
