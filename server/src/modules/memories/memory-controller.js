import { memoryRepository } from './memory-repository.js';
import {
  createMemorySchema,
  updateMemorySchema,
  listMemoriesQuerySchema
} from './memory-schemas.js';
import { NotFoundError } from '../../shared/errors.js';

export class MemoryController {
  async create(req, res, next) {
    try {
      const data = createMemorySchema.parse(req.body);
      const memory = await memoryRepository.createMemory({
        userId: req.user.id,
        content: data.content,
        category: data.category,
        source: 'user'
      });
      res.status(201).json({ memory });
    } catch (err) {
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const query = listMemoriesQuerySchema.parse(req.query);
      const memories = await memoryRepository.listMemories(req.user.id, query);
      res.status(200).json({ memories });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const data = updateMemorySchema.parse(req.body);
      const updated = await memoryRepository.updateMemory(req.params.memoryId, req.user.id, data);
      if (!updated) {
        throw new NotFoundError('Memory not found');
      }
      res.status(200).json({ memory: updated });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const deleted = await memoryRepository.deleteMemory(req.params.memoryId, req.user.id);
      if (!deleted) {
        throw new NotFoundError('Memory not found');
      }
      res.status(200).json({ id: req.params.memoryId, deleted: true });
    } catch (err) {
      next(err);
    }
  }
}

export const memoryController = new MemoryController();
