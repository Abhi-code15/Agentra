import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

describe('Task Management Integration Tests', () => {
  let app;
  let userA = { email: `user_a_${Date.now()}@example.com`, password: 'Password123!', displayName: 'User A' };
  let userB = { email: `user_b_${Date.now()}@example.com`, password: 'Password123!', displayName: 'User B' };
  let tokenA, tokenB;
  let cookieA, cookieB;
  let csrfA, csrfB;
  let createdTaskId;

  before(async () => {
    app = createApp();

    // Register User A
    const resA = await request(app).post('/api/v1/auth/register').send(userA);
    tokenA = resA.body.token;
    csrfA = resA.body.csrfToken;
    cookieA = resA.headers['set-cookie'].find((c) => c.startsWith('agentra_session=')).split(';')[0];

    // Register User B
    const resB = await request(app).post('/api/v1/auth/register').send(userB);
    tokenB = resB.body.token;
    csrfB = resB.body.csrfToken;
    cookieB = resB.headers['set-cookie'].find((c) => c.startsWith('agentra_session=')).split(';')[0];
  });

  after(async () => {
    await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [userA.email, userB.email]);
    await pool.end();
  });

  it('POST /api/v1/tasks should create a new task for authenticated user', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', [cookieA, `agentra_csrf=${csrfA}`])
      .set('X-CSRF-Token', csrfA)
      .send({
        title: 'Review Project Architecture',
        description: 'Check database migrations and auth flow',
        priority: 'high',
        status: 'pending',
        dueAt: new Date(Date.now() + 86400000).toISOString()
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.task.title, 'Review Project Architecture');
    assert.equal(res.body.task.priority, 'high');
    assert.equal(res.body.task.status, 'pending');
    assert.ok(res.body.task.id);
    createdTaskId = res.body.task.id;
  });

  it('GET /api/v1/tasks should list tasks with pagination and filters', async () => {
    const res = await request(app)
      .get('/api/v1/tasks?priority=high&page=1&limit=10')
      .set('Cookie', cookieA);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
    assert.equal(res.body.pagination.page, 1);
    assert.equal(res.body.pagination.limit, 10);
  });

  it('GET /api/v1/tasks/:taskId should retrieve task for owner', async () => {
    const res = await request(app)
      .get(`/api/v1/tasks/${createdTaskId}`)
      .set('Cookie', cookieA);

    assert.equal(res.status, 200);
    assert.equal(res.body.task.id, createdTaskId);
    assert.equal(res.body.task.title, 'Review Project Architecture');
  });

  it('PATCH /api/v1/tasks/:taskId should update task fields', async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/${createdTaskId}`)
      .set('Cookie', [cookieA, `agentra_csrf=${csrfA}`])
      .set('X-CSRF-Token', csrfA)
      .send({
        title: 'Review Project Architecture Updated',
        priority: 'medium'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.task.title, 'Review Project Architecture Updated');
    assert.equal(res.body.task.priority, 'medium');
  });

  it('POST /api/v1/tasks/:taskId/complete should mark task completed', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${createdTaskId}/complete`)
      .set('Cookie', [cookieA, `agentra_csrf=${csrfA}`])
      .set('X-CSRF-Token', csrfA);

    assert.equal(res.status, 200);
    assert.equal(res.body.task.status, 'completed');
    assert.ok(res.body.task.completed_at);
  });

  it('SECURITY: User B should NOT be able to view User A task (404/Cross-user isolation)', async () => {
    const res = await request(app)
      .get(`/api/v1/tasks/${createdTaskId}`)
      .set('Cookie', cookieB);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('SECURITY: User B should NOT be able to update User A task', async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/${createdTaskId}`)
      .set('Cookie', [cookieB, `agentra_csrf=${csrfB}`])
      .set('X-CSRF-Token', csrfB)
      .send({ title: 'Hacked by User B' });

    assert.equal(res.status, 404);
  });

  it('SECURITY: User B should NOT be able to delete User A task', async () => {
    const res = await request(app)
      .delete(`/api/v1/tasks/${createdTaskId}`)
      .set('Cookie', [cookieB, `agentra_csrf=${csrfB}`])
      .set('X-CSRF-Token', csrfB);

    assert.equal(res.status, 404);
  });

  it('DELETE /api/v1/tasks/:taskId should delete task by owner', async () => {
    const res = await request(app)
      .delete(`/api/v1/tasks/${createdTaskId}`)
      .set('Cookie', [cookieA, `agentra_csrf=${csrfA}`])
      .set('X-CSRF-Token', csrfA);

    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, true);

    // Verify it is gone
    const checkRes = await request(app)
      .get(`/api/v1/tasks/${createdTaskId}`)
      .set('Cookie', cookieA);
    assert.equal(checkRes.status, 404);
  });
});
