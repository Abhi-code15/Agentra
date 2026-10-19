import { conversationRepository } from './conversation-repository.js';
import { agentRunner } from '../../ai/agent-runner.js';
import { createConversationSchema, sendMessageSchema } from './conversation-schemas.js';
import { NotFoundError } from '../../shared/errors.js';

export class ConversationController {
  async create(req, res, next) {
    try {
      const data = createConversationSchema.parse(req.body);
      const conversation = await conversationRepository.createConversation(req.user.id, data.title);
      res.status(201).json({ conversation });
    } catch (err) {
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const conversations = await conversationRepository.listConversations(req.user.id);
      res.status(200).json({ conversations });
    } catch (err) {
      next(err);
    }
  }

  async get(req, res, next) {
    try {
      const conversation = await conversationRepository.findById(req.params.conversationId, req.user.id);
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }
      res.status(200).json({ conversation });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const deleted = await conversationRepository.deleteConversation(req.params.conversationId, req.user.id);
      if (!deleted) {
        throw new NotFoundError('Conversation not found');
      }
      res.status(200).json({ id: req.params.conversationId, deleted: true });
    } catch (err) {
      next(err);
    }
  }

  async listMessages(req, res, next) {
    try {
      const conversation = await conversationRepository.findById(req.params.conversationId, req.user.id);
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }
      const messages = await conversationRepository.listMessages(req.params.conversationId, 100);
      res.status(200).json({ messages });
    } catch (err) {
      next(err);
    }
  }

  async sendMessage(req, res, next) {
    try {
      const conversation = await conversationRepository.findById(req.params.conversationId, req.user.id);
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      const { content } = sendMessageSchema.parse(req.body);

      // Execute AI agent runner loop
      const result = await agentRunner.run({
        user: req.user,
        conversationId: req.params.conversationId,
        userMessageContent: content
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const conversationController = new ConversationController();
