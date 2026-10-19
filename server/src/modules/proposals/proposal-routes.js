import { Router } from 'express';
import { proposalController } from './proposal-controller.js';
import { requireAuth } from '../../middleware/auth.js';

const proposalRouter = Router();

proposalRouter.use(requireAuth);

proposalRouter.get('/:runId', proposalController.getRun);
proposalRouter.get('/:runId/tools', proposalController.getRunTools);
proposalRouter.get('/:runId/proposals', proposalController.getRunProposals);
proposalRouter.post('/:runId/proposals/:proposalId/approve', proposalController.approve);
proposalRouter.post('/:runId/proposals/:proposalId/reject', proposalController.reject);

export default proposalRouter;
