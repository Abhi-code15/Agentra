import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

describe('User Long-Term Memory Integration Tests', () => {
  let app;
  let testUser = {
    email: `mem_user_${Date.now()}@example.com`,
    password: 'Password123!',
    displayName: 'Memory Tester'
  };
  let cookie;
  let csrfToken;
  let memoryId;

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

  it('POST /api/v1/memories should create a memory record', async () => {
    const res = await request(app)
      .post('/api/v1/memories')
      .set('Cookie', [cookie, `agentra_csrf=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken)
      .send({
        content: 'I prefer morning meetings before 11 AM EST',
        category: 'preference'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.memory.content, 'I prefer morning meetings before 11 AM EST');
    assert.equal(res.body.memory.category, 'preference');
    assert.ok(res.body.memory.id);
    memoryId = res.body.memory.id;
  });

  it('GET /api/v1/memories should list memories with filtering', async () => {
    const res = await request(app)
      .get('/api/v1/memories?category=preference')
      .set('Cookie', cookie);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.memories));
    assert.equal(res.body.memories.length, 1);
    assert.equal(res.body.memories[0].id, memoryId);
  });

  it('PATCH /api/v1/memories/:memoryId should update memory', async () => {
    const res = await request(app)
      .patch(`/api/v1/memories/${memoryId}`)
      .set('Cookie', [cookie, `agentra_csrf=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken)
      .send({
        content: 'I prefer morning meetings before 10 AM EST'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.memory.content, 'I prefer morning meetings before 10 AM EST');
  });

  it('DELETE /api/v1/memories/:memoryId should remove memory', async () => {
    const res = await request(app)
      .delete(`/api/v1/memories/${memoryId}`)
      .set('Cookie', [cookie, `agentra_csrf=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken);

    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, true);

    const checkRes = await request(app)
      .get('/api/v1/memories')
      .set('Cookie', cookie);
    assert.equal(checkRes.body.memories.length, 0);
  });
});
