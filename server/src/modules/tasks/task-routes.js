import { Router } from 'express';
import { taskController } from './task-controller.js';
import { requireAuth } from '../../middleware/auth.js';

const taskRouter = Router();

taskRouter.use(requireAuth);

taskRouter.post('/', taskController.create);
taskRouter.get('/', taskController.list);
taskRouter.get('/:taskId', taskController.get);
taskRouter.patch('/:taskId', taskController.update);
taskRouter.post('/:taskId/complete', taskController.complete);
taskRouter.delete('/:taskId', taskController.delete);

export default taskRouter;
