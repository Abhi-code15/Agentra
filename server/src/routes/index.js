import { Router } from 'express';
import authRouter from '../modules/auth/auth-routes.js';
import taskRouter from '../modules/tasks/task-routes.js';
import conversationRouter from '../modules/conversations/conversation-routes.js';
import proposalRouter from '../modules/proposals/proposal-routes.js';
import memoryRouter from '../modules/memories/memory-routes.js';

const apiRouter = Router();

apiRouter.get('/', (req, res) => {
  res.json({
    name: 'Agentra API',
    version: 'v1',
    status: 'operational',
    documentation: '/api/v1/docs'
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/conversations', conversationRouter);
apiRouter.use('/agent-runs', proposalRouter);
apiRouter.use('/memories', memoryRouter);

export default apiRouter;
