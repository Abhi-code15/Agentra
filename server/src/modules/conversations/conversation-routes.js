import { Router } from 'express';
import { conversationController } from './conversation-controller.js';
import { requireAuth } from '../../middleware/auth.js';

const conversationRouter = Router();

conversationRouter.use(requireAuth);

conversationRouter.post('/', conversationController.create);
conversationRouter.get('/', conversationController.list);
conversationRouter.get('/:conversationId', conversationController.get);
conversationRouter.delete('/:conversationId', conversationController.delete);
conversationRouter.get('/:conversationId/messages', conversationController.listMessages);
conversationRouter.post('/:conversationId/messages', conversationController.sendMessage);

export default conversationRouter;
