import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

describe('Application Security & Penetration Tests', () => {
  let app;
  let testUser = {
    email: `sec_user_${Date.now()}@example.com`,
    password: 'Password123!',
    displayName: 'Security Tester'
  };
  let cookie;
  let csrfToken;

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

  it('SECURITY: SQL Injection in task search should be safely treated as literal parameter', async () => {
    const sqlInjectionPayload = "'; DROP TABLE tasks; --";
    const res = await request(app)
      .get(`/api/v1/tasks?search=${encodeURIComponent(sqlInjectionPayload)}`)
      .set('Cookie', cookie);

    assert.equal(res.status, 200);
    // Verify tasks table still exists and query succeeded with 0 rows
    assert.equal(res.body.data.length, 0);

    const checkTable = await pool.query("SELECT to_regclass('tasks') AS tbl");
    assert.ok(checkTable.rows[0].tbl, 'tasks table must not have been dropped');
  });

  it('SECURITY: Protected endpoints without authentication must return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/tasks');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('SECURITY: State-changing cookie requests without CSRF token must return 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', cookie) // Has session cookie, but omitted X-CSRF-Token header
      .send({ title: 'CSRF Attack Attempt' });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('SECURITY: State-changing cookie requests with mismatched CSRF token must return 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', [cookie, 'agentra_csrf=legitimate_csrf_value'])
      .set('X-CSRF-Token', 'forged_csrf_value')
      .send({ title: 'CSRF Mismatch Attempt' });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('SECURITY: Password hashes and session token hashes must not be exposed in user responses', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.password_hash, undefined);
    assert.equal(res.body.user.token_hash, undefined);
    assert.equal(res.body.user.password, undefined);
  });

  it('SECURITY: Rate limiter protects against high-frequency authentication attempts', async () => {
    // Send 35 rapid login requests
    const attempts = [];
    for (let i = 0; i < 35; i++) {
      attempts.push(
        request(app)
          .post('/api/v1/auth/login')
          .send({ email: testUser.email, password: 'WrongPassword!' })
      );
    }
    const results = await Promise.all(attempts);
    const rateLimited = results.filter((r) => r.status === 429);
    assert.ok(rateLimited.length > 0, 'At least one request should have been rate-limited with 429');
    assert.equal(rateLimited[0].body.error.code, 'RATE_LIMIT_EXCEEDED');
  });
});
