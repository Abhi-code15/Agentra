import { taskService } from './task-service.js';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema
} from './task-schemas.js';

export class TaskController {
  async create(req, res, next) {
    try {
      const data = createTaskSchema.parse(req.body);
      const task = await taskService.createTask(req.user.id, data);
      res.status(201).json({ task });
    } catch (err) {
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const queryParams = listTasksQuerySchema.parse(req.query);
      const result = await taskService.listTasks(req.user.id, queryParams);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async get(req, res, next) {
    try {
      const task = await taskService.getTask(req.params.taskId, req.user.id);
      res.status(200).json({ task });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const data = updateTaskSchema.parse(req.body);
      const updated = await taskService.updateTask(req.params.taskId, req.user.id, data);
      res.status(200).json({ task: updated });
    } catch (err) {
      next(err);
    }
  }

  async complete(req, res, next) {
    try {
      const completed = await taskService.completeTask(req.params.taskId, req.user.id);
      res.status(200).json({ task: completed });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await taskService.deleteTask(req.params.taskId, req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const taskController = new TaskController();
