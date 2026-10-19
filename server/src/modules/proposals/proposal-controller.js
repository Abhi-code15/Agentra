import { query } from '../../db/pool.js';
import { proposalService } from './proposal-service.js';
import { NotFoundError } from '../../shared/errors.js';

export class ProposalController {
  async getRun(req, res, next) {
    try {
      const { runId } = req.params;
      const resDb = await query(
        `SELECT id, conversation_id, user_id, status, model, started_at, finished_at, error_code, prompt_tokens, completion_tokens
         FROM agent_runs
         WHERE id = $1 AND user_id = $2`,
        [runId, req.user.id]
      );
      if (!resDb.rows[0]) {
        throw new NotFoundError('Agent run not found');
      }
      res.status(200).json({ run: resDb.rows[0] });
    } catch (err) {
      next(err);
    }
  }

  async getRunTools(req, res, next) {
    try {
      const { runId } = req.params;
      // First verify run belongs to user
      const runRes = await query(
        'SELECT id FROM agent_runs WHERE id = $1 AND user_id = $2',
        [runId, req.user.id]
      );
      if (!runRes.rows[0]) {
        throw new NotFoundError('Agent run not found');
      }

      const toolsRes = await query(
        `SELECT id, agent_run_id, tool_name, status, arguments, result_summary, started_at, finished_at, error_code
         FROM tool_executions
         WHERE agent_run_id = $1
         ORDER BY started_at ASC`,
        [runId]
      );
      res.status(200).json({ tools: toolsRes.rows });
    } catch (err) {
      next(err);
    }
  }

  async getRunProposals(req, res, next) {
    try {
      const { runId } = req.params;
      const proposals = await proposalService.listRunProposals(runId, req.user.id);
      res.status(200).json({ proposals });
    } catch (err) {
      next(err);
    }
  }

  async approve(req, res, next) {
    try {
      const { proposalId } = req.params;
      const result = await proposalService.approveProposal(proposalId, req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async reject(req, res, next) {
    try {
      const { proposalId } = req.params;
      const result = await proposalService.rejectProposal(proposalId, req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const proposalController = new ProposalController();
