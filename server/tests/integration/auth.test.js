import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

describe('Authentication Module Integration Tests', () => {
  let app;
  const testUser = {
    email: `test_auth_${Date.now()}@example.com`,
    password: 'Password123!',
    displayName: 'Auth Test User',
    timezone: 'America/New_York'
  };

  let sessionCookie;
  let csrfToken;

  before(async () => {
    app = createApp();
  });

  after(async () => {
    // Clean up test user
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test_auth_%']);
    await pool.end();
  });

  it('POST /api/v1/auth/register should create a user and set cookies', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, testUser.email.toLowerCase());
    assert.equal(res.body.user.display_name, testUser.displayName);
    assert.ok(res.body.token);
    assert.ok(res.body.csrfToken);

    // Verify cookies
    const cookies = res.headers['set-cookie'];
    assert.ok(cookies);
    const sessionCookieStr = cookies.find((c) => c.startsWith('agentra_session='));
    const csrfCookieStr = cookies.find((c) => c.startsWith('agentra_csrf='));
    assert.ok(sessionCookieStr, 'Session cookie must be set');
    assert.ok(csrfCookieStr, 'CSRF cookie must be set');

    sessionCookie = sessionCookieStr.split(';')[0];
    csrfToken = res.body.csrfToken;
  });

  it('POST /api/v1/auth/register should reject duplicate email with 409', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CONFLICT');
  });

  it('POST /api/v1/auth/login should authenticate with valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, testUser.email.toLowerCase());
    assert.ok(res.body.token);
  });

  it('POST /api/v1/auth/login should reject invalid password with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword999!'
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('GET /api/v1/auth/me should return current user profile with valid session', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, testUser.email.toLowerCase());
    assert.equal(res.body.user.display_name, testUser.displayName);
  });

  it('PATCH /api/v1/auth/me should update profile fields with CSRF token', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Cookie', [sessionCookie, `agentra_csrf=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken)
      .send({
        displayName: 'Updated Auth User',
        timezone: 'Europe/London'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.display_name, 'Updated Auth User');
    assert.equal(res.body.user.timezone, 'Europe/London');
  });

  it('POST /api/v1/auth/google should authenticate via mock Google token in dev/test', async () => {
    const mockEmail = `mockgoogle_${Date.now()}@example.com`;
    const mockSub = `sub_${Date.now()}`;
    const credential = `mock-google-token:${mockEmail}:${mockSub}:Mock Google Tester`;

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, mockEmail);
    assert.equal(res.body.user.display_name, 'Mock Google Tester');

    // Clean up
    await pool.query('DELETE FROM users WHERE email = $1', [mockEmail]);
  });

  it('POST /api/v1/auth/logout should revoke session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [sessionCookie, `agentra_csrf=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken);

    assert.equal(res.status, 200);

    // After logout, me request must fail with 401
    const checkRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie);

    assert.equal(checkRes.status, 401);
  });
});
