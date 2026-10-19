import { pool, withTransaction, query } from '../../db/pool.js';
import { taskRepository } from '../tasks/task-repository.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

export class ProposalService {
  async getProposal(proposalId, userId) {
    const res = await query(
      `SELECT id, user_id, agent_run_id, action_type, payload, status, expires_at, approved_at, executed_at, created_at
       FROM action_proposals
       WHERE id = $1 AND user_id = $2`,
      [proposalId, userId]
    );
    if (!res.rows[0]) {
      throw new NotFoundError('Proposal not found');
    }
    return res.rows[0];
  }

  async listRunProposals(agentRunId, userId) {
    const res = await query(
      `SELECT id, user_id, agent_run_id, action_type, payload, status, expires_at, approved_at, executed_at, created_at
       FROM action_proposals
       WHERE agent_run_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [agentRunId, userId]
    );
    return res.rows;
  }

  async approveProposal(proposalId, userId) {
    const proposal = await this.getProposal(proposalId, userId);

    if (proposal.status !== 'pending') {
      throw new ConflictError(`Proposal cannot be approved because it is already ${proposal.status}`);
    }

    if (new Date(proposal.expires_at) < new Date()) {
      await pool.query('UPDATE action_proposals SET status = $1 WHERE id = $2', ['expired', proposalId]);
      throw new BadRequestError('Proposal has expired and cannot be approved');
    }

    const payload = proposal.payload?.data || proposal.payload;
    const executedResults = [];

    // Atomically execute approved actions in a transaction
    await withTransaction(async (client) => {
      if (Array.isArray(payload)) {
        for (const item of payload) {
          const task = await taskRepository.createTask(
            {
              userId,
              title: item.title,
              description: item.description || null,
              priority: item.priority || 'medium',
              status: item.status || 'pending',
              dueAt: item.dueAt || item.due_at || null
            },
            client
          );
          executedResults.push(task);
        }
      } else if (payload && payload.tasks && Array.isArray(payload.tasks)) {
        for (const item of payload.tasks) {
          const task = await taskRepository.createTask(
            {
              userId,
              title: item.title,
              description: item.description || null,
              priority: item.priority || 'medium',
              status: item.status || 'pending',
              dueAt: item.dueAt || item.due_at || null
            },
            client
          );
          executedResults.push(task);
        }
      } else if (payload && payload.title) {
        // Single task payload
        const task = await taskRepository.createTask(
          {
            userId,
            title: payload.title,
            description: payload.description || null,
            priority: payload.priority || 'medium',
            status: payload.status || 'pending',
            dueAt: payload.dueAt || payload.due_at || null
          },
          client
        );
        executedResults.push(task);
      }

      await client.query(
        `UPDATE action_proposals
         SET status = 'executed', approved_at = CURRENT_TIMESTAMP, executed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [proposalId]
      );
    });

    logger.info('Proposal approved and executed', { proposalId, userId, itemsCount: executedResults.length });

    return {
      proposalId,
      status: 'executed',
      message: 'Proposal successfully approved and executed',
      executedResults
    };
  }

  async rejectProposal(proposalId, userId) {
    const proposal = await this.getProposal(proposalId, userId);

    if (proposal.status !== 'pending') {
      throw new ConflictError(`Proposal is already ${proposal.status}`);
    }

    await pool.query(
      `UPDATE action_proposals
       SET status = 'rejected'
       WHERE id = $1 AND user_id = $2`,
      [proposalId, userId]
    );

    return {
      proposalId,
      status: 'rejected',
      message: 'Proposal rejected'
    };
  }
}

export const proposalService = new ProposalService();
