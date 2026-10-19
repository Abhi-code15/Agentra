import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

describe('Health and System Routes', () => {
  let app;

  before(() => {
    app = createApp();
  });

  after(async () => {
    await pool.end();
  });

  it('GET /health/live should return 200 and status ok', async () => {
    const res = await request(app).get('/health/live');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(typeof res.body.uptime === 'number');
    assert.ok(res.headers['x-request-id']);
  });

  it('GET /health/ready should return 200 and database connected', async () => {
    const res = await request(app).get('/health/ready');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ready');
    assert.equal(res.body.database, 'connected');
  });

  it('GET /api/v1 should return API metadata', async () => {
    const res = await request(app).get('/api/v1');
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Agentra API');
    assert.equal(res.body.version, 'v1');
  });

  it('GET /non-existent-route should return 404 with structured error', async () => {
    const res = await request(app).get('/non-existent-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.ok(res.body.error.requestId);
  });
});
