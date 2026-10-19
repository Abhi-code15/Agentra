import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

describe('AI Agent Engine & Multi-Step Orchestration Integration Tests', () => {
  let app;
  let testUser = {
    email: `agent_user_${Date.now()}@example.com`,
    password: 'Password123!',
    displayName: 'Agent Tester'
  };
  let cookie;
  let csrfToken;
  let conversationId;
  let createdRunId;
  let createdProposalId;

  before(async () => {
    app = createApp();
    const res = await request(app).post('/api/v1/auth/register').send(testUser);
    cookie = res.headers['set-cookie'].find((c) => c.startsWith('agentra_session=')).split(';')[0];
    csrfToken = res.body.csrfToken;
  });

  after(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    await pool.end();
  });

  it('POST /api/v1/conversations should create a new conversation', async () => {
    const res = await request(app)
      .post('/api/v1/conversations')
      .set('Cookie', [cookie, `agentra_csrf=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Task Planning Session' });

    assert.equal(res.status, 201);
    assert.equal(res.body.conversation.title, 'Task Planning Session');
    assert.ok(res.body.conversation.id);
    conversationId = res.body.conversation.id;
  });

  it('POST /api/v1/conversations/:id/messages should execute tool create_task via agent loop', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Cookie', [cookie, `agentra_csrf=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken)
      .send({ content: 'Create task: Implement Unit Tests with high priority' });

    assert.equal(res.status, 200);
    assert.ok(res.body.agentRun);
    createdRunId = res.body.agentRun.id;
    assert.equal(res.body.agentRun.status, 'completed');
    assert.ok(res.body.message);
    assert.equal(res.body.message.role, 'assistant');
    assert.ok(res.body.message.content.includes('Implement Unit Tests'));

    // Verify tool execution
    assert.equal(res.body.tools.length, 1);
    assert.equal(res.body.tools[0].toolName, 'create_task');
    assert.equal(res.body.tools[0].status, 'success');

    // Verify the task was genuinely created in the database!
    const taskRes = await pool.query(
      'SELECT id, title, priority, status FROM tasks WHERE title = $1',
      ['Implement Unit Tests with high priority']
    );
    assert.equal(taskRes.rowCount, 1);
    assert.equal(taskRes.rows[0].priority, 'high');
  });

  it('POST /api/v1/conversations/:id/messages should execute list_tasks tool', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Cookie', [cookie, `agentra_csrf=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken)
      .send({ content: 'Show my pending tasks' });

    assert.equal(res.status, 200);
    assert.ok(res.body.message.content.includes('Implement Unit Tests'));
    assert.equal(res.body.tools[0].toolName, 'list_tasks');
    assert.equal(res.body.tools[0].status, 'success');
  });

  it('POST /api/v1/conversations/:id/messages should handle multi-step planning and create action proposal', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Cookie', [cookie, `agentra_csrf=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken)
      .send({ content: 'Create a plan for tomorrow' });

    assert.equal(res.status, 200);
    assert.ok(res.body.tools.length >= 1);
    assert.equal(res.body.tools[0].toolName, 'list_tasks');

    // Manually create a proposal to test the approval workflow directly
    const proposalRes = await pool.query(
      `INSERT INTO action_proposals (user_id, agent_run_id, action_type, payload, status, expires_at)
       VALUES ($1, $2, 'create_tasks_plan', $3, 'pending', CURRENT_TIMESTAMP + INTERVAL '1 day')
       RETURNING id`,
      [
        (await pool.query('SELECT id FROM users WHERE email = $1', [testUser.email])).rows[0].id,
        createdRunId,
        JSON.stringify({
          tasks: [
            { title: 'Morning Standup', priority: 'medium' },
            { title: 'Deploy Staging Build', priority: 'high' }
          ]
        })
      ]
    );
    createdProposalId = proposalRes.rows[0].id;
  });

  it('GET /api/v1/agent-runs/:runId/tools should audit executed tools', async () => {
    const res = await request(app)
      .get(`/api/v1/agent-runs/${createdRunId}/tools`)
      .set('Cookie', cookie);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.tools));
    assert.ok(res.body.tools.length >= 1);
    assert.equal(res.body.tools[0].tool_name, 'create_task');
  });

  it('POST /api/v1/agent-runs/:runId/proposals/:proposalId/approve should execute proposal atomically', async () => {
    const res = await request(app)
      .post(`/api/v1/agent-runs/${createdRunId}/proposals/${createdProposalId}/approve`)
      .set('Cookie', [cookie, `agentra_csrf=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'executed');
    assert.equal(res.body.executedResults.length, 2);

    // Verify the approved tasks exist in the database!
    const morningTask = await pool.query('SELECT id FROM tasks WHERE title = $1', ['Morning Standup']);
    const deployTask = await pool.query('SELECT id FROM tasks WHERE title = $1', ['Deploy Staging Build']);
    assert.equal(morningTask.rowCount, 1);
    assert.equal(deployTask.rowCount, 1);
  });

  it('POST /api/v1/agent-runs/:runId/proposals/:proposalId/approve should reject re-approving executed proposal', async () => {
    const res = await request(app)
      .post(`/api/v1/agent-runs/${createdRunId}/proposals/${createdProposalId}/approve`)
      .set('Cookie', [cookie, `agentra_csrf=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken);

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CONFLICT');
  });
});
