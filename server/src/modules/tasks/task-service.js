import { taskRepository } from './task-repository.js';
import { NotFoundError, BadRequestError } from '../../shared/errors.js';
import { buildPaginatedResponse } from '../../shared/pagination.js';

export class TaskService {
  async createTask(userId, data, dbClient) {
    let completedAt = null;
    if (data.status === 'completed') {
      completedAt = new Date().toISOString();
    }

    return taskRepository.createTask(
      {
        userId,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        dueAt: data.dueAt,
        completedAt
      },
      dbClient
    );
  }

  async getTask(taskId, userId) {
    const task = await taskRepository.findById(taskId, userId);
    if (!task) {
      throw new NotFoundError('Task not found');
    }
    return task;
  }

  async listTasks(userId, params) {
    const { page, limit, status, priority, search, filter, sortBy, order } = params;
    const offset = (page - 1) * limit;

    const [tasks, totalCount] = await Promise.all([
      taskRepository.listTasks({
        userId,
        status,
        priority,
        search,
        filter,
        sortBy,
        order,
        limit,
        offset
      }),
      taskRepository.countTasks({
        userId,
        status,
        priority,
        search,
        filter
      })
    ]);

    return buildPaginatedResponse(tasks, totalCount, { page, limit });
  }

  async updateTask(taskId, userId, updateData, dbClient) {
    const existing = await this.getTask(taskId, userId);

    const fields = { ...updateData };

    if (fields.status) {
      if (fields.status === 'completed' && existing.status !== 'completed') {
        fields.completedAt = new Date().toISOString();
      } else if (fields.status !== 'completed' && existing.status === 'completed') {
        fields.completedAt = null;
      }
    }

    const updated = await taskRepository.updateTask(taskId, userId, fields, dbClient);
    return updated;
  }

  async completeTask(taskId, userId) {
    return this.updateTask(taskId, userId, { status: 'completed' });
  }

  async deleteTask(taskId, userId) {
    const deleted = await taskRepository.deleteTask(taskId, userId);
    if (!deleted) {
      throw new NotFoundError('Task not found');
    }
    return { id: taskId, deleted: true };
  }
}

export const taskService = new TaskService();
