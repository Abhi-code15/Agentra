import { z } from 'zod';
import { taskService } from '../modules/tasks/task-service.js';
import { conversationRepository } from '../modules/conversations/conversation-repository.js';
import { memoryRepository } from '../modules/memories/memory-repository.js';
import { pool } from '../db/pool.js';
import { logger } from '../shared/logger.js';

// Tool 1: list_tasks
const listTasksSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  search: z.string().optional(),
  filter: z.enum(['all', 'overdue', 'upcoming', 'today']).optional(),
  limit: z.number().int().min(1).max(50).optional().default(20)
});

// Tool 2: get_task
const getTaskSchema = z.object({
  taskId: z.string().uuid('Valid task UUID required')
});

// Tool 3: create_task
const createTaskToolSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  dueAt: z.string().optional().describe('ISO 8601 UTC timestamp for when task is due')
});

// Tool 4: update_task
const updateTaskToolSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueAt: z.string().optional().nullable()
});

// Tool 5: complete_task
const completeTaskToolSchema = z.object({
  taskId: z.string().uuid()
});

// Tool 6: search_conversations
const searchConversationsSchema = z.object({
  query: z.string().min(1).max(100)
});

// Tool 7: get_saved_memories
const getSavedMemoriesSchema = z.object({
  category: z.enum(['general', 'preference', 'project', 'goal']).optional(),
  search: z.string().max(100).optional()
});

// Tool 8: propose_action (for sensitive workflows, bulk tasks, multi-step plans)
const proposeActionSchema = z.object({
  actionType: z.string().min(1).max(100),
  summary: z.string().min(1).max(500),
  payload: z.record(z.any()).or(z.array(z.any()))
});

export const TOOLS = {
  list_tasks: {
    name: 'list_tasks',
    description: 'List, filter, and inspect the user tasks. Can filter by status, priority, search text, or filters like overdue, upcoming, today.',
    schema: listTasksSchema,
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'], description: 'Filter by task status' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Filter by priority' },
        search: { type: 'string', description: 'Keyword to search in task title and description' },
        filter: { type: 'string', enum: ['all', 'overdue', 'upcoming', 'today'], description: 'Quick filter preset' },
        limit: { type: 'integer', description: 'Maximum number of tasks to return (default 20)' }
      }
    },
    async execute({ userId, args }) {
      const result = await taskService.listTasks(userId, {
        page: 1,
        limit: args.limit || 20,
        status: args.status,
        priority: args.priority,
        search: args.search,
        filter: args.filter,
        sortBy: 'created_at',
        order: 'desc'
      });
      return {
        total: result.pagination.total,
        count: result.data.length,
        tasks: result.data
      };
    }
  },

  get_task: {
    name: 'get_task',
    description: 'Retrieve detailed information for a specific task by its unique UUID.',
    schema: getTaskSchema,
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The UUID of the task' }
      },
      required: ['taskId']
    },
    async execute({ userId, args }) {
      const task = await taskService.getTask(args.taskId, userId);
      return { task };
    }
  },

  create_task: {
    name: 'create_task',
    description: 'Create a new task with a title, optional description, priority, and due date.',
    schema: createTaskToolSchema,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Optional details or notes for the task' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority level (default: medium)' },
        dueAt: { type: 'string', description: 'ISO 8601 formatted date/time string for the deadline' }
      },
      required: ['title']
    },
    async execute({ userId, args }) {
      const task = await taskService.createTask(userId, {
        title: args.title,
        description: args.description || null,
        priority: args.priority || 'medium',
        status: 'pending',
        dueAt: args.dueAt || null
      });
      return {
        success: true,
        message: `Task "${task.title}" created successfully`,
        task
      };
    }
  },

  update_task: {
    name: 'update_task',
    description: 'Update properties of an existing task (title, description, status, priority, or due date).',
    schema: updateTaskToolSchema,
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'UUID of the task to update' },
        title: { type: 'string', description: 'Updated title' },
        description: { type: 'string', description: 'Updated description' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        dueAt: { type: 'string', description: 'Updated ISO 8601 deadline or null' }
      },
      required: ['taskId']
    },
    async execute({ userId, args }) {
      const { taskId, ...fields } = args;
      const updated = await taskService.updateTask(taskId, userId, fields);
      return {
        success: true,
        message: `Task "${updated.title}" updated successfully`,
        task: updated
      };
    }
  },

  complete_task: {
    name: 'complete_task',
    description: 'Mark a task as completed.',
    schema: completeTaskToolSchema,
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'UUID of the task to mark completed' }
      },
      required: ['taskId']
    },
    async execute({ userId, args }) {
      const task = await taskService.completeTask(args.taskId, userId);
      return {
        success: true,
        message: `Task "${task.title}" marked as completed`,
        task
      };
    }
  },

  search_conversations: {
    name: 'search_conversations',
    description: 'Search past chat messages across conversations to find previously discussed items or details.',
    schema: searchConversationsSchema,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or keywords' }
      },
      required: ['query']
    },
    async execute({ userId, args }) {
      const results = await conversationRepository.searchConversations(userId, args.query, 10);
      return {
        count: results.length,
        messages: results
      };
    }
  },

  get_saved_memories: {
    name: 'get_saved_memories',
    description: 'Retrieve user saved long-term preferences, goals, and background context.',
    schema: getSavedMemoriesSchema,
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['general', 'preference', 'project', 'goal'] },
        search: { type: 'string', description: 'Optional search term' }
      }
    },
    async execute({ userId, args }) {
      const memories = await memoryRepository.listMemories(userId, args);
      return {
        count: memories.length,
        memories
      };
    }
  },

  propose_action: {
    name: 'propose_action',
    description: 'Propose a multi-task plan, schedule, or bulk modification that requires user approval before executing.',
    schema: proposeActionSchema,
    parameters: {
      type: 'object',
      properties: {
        actionType: { type: 'string', description: 'The type of action, e.g. "create_tasks_plan" or "bulk_update"' },
        summary: { type: 'string', description: 'Clear human-readable summary of what will be done upon approval' },
        payload: { type: 'object', description: 'The structured payload containing the items to be executed' }
      },
      required: ['actionType', 'summary', 'payload']
    },
    async execute({ userId, agentRunId, args }) {
      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 24 hours expiry
      const payloadWithSummary = {
        summary: args.summary,
        data: args.payload
      };

      const res = await pool.query(
        `INSERT INTO action_proposals (user_id, agent_run_id, action_type, payload, status, expires_at)
         VALUES ($1, $2, $3, $4, 'pending', $5)
         RETURNING id, action_type, payload, status, expires_at, created_at`,
        [userId, agentRunId || null, args.actionType, JSON.stringify(payloadWithSummary), expiresAt]
      );

      const proposal = res.rows[0];
      return {
        proposalId: proposal.id,
        actionType: proposal.action_type,
        status: 'pending',
        summary: args.summary,
        expiresAt: proposal.expires_at,
        requiresApproval: true,
        message: `Plan proposal created with ID ${proposal.id}. Waiting for user approval.`
      };
    }
  }
};

export class ToolRegistry {
  getTools() {
    return Object.values(TOOLS);
  }

  getTool(name) {
    return TOOLS[name] || null;
  }

  // OpenAI format
  getOpenAITools() {
    return Object.values(TOOLS).map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));
  }

  // Gemini format
  getGeminiDeclarations() {
    return Object.values(TOOLS).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }));
  }

  async executeTool(name, { userId, agentRunId, args }) {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Unregistered tool: "${name}"`);
    }

    // Validate arguments with Zod schema
    const validationResult = tool.schema.safeParse(args);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Invalid arguments for tool "${name}": ${errorMsg}`);
    }

    // Execute tool directly through application service
    return await tool.execute({
      userId,
      agentRunId,
      args: validationResult.data
    });
  }
}

export const toolRegistry = new ToolRegistry();
