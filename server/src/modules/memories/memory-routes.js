import { Router } from 'express';
import { memoryController } from './memory-controller.js';
import { requireAuth } from '../../middleware/auth.js';

const memoryRouter = Router();

memoryRouter.use(requireAuth);

memoryRouter.post('/', memoryController.create);
memoryRouter.get('/', memoryController.list);
memoryRouter.patch('/:memoryId', memoryController.update);
memoryRouter.delete('/:memoryId', memoryController.delete);

export default memoryRouter;
