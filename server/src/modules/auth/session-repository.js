import { query } from '../../db/pool.js';

export class SessionRepository {
  async createSession({ userId, tokenHash, expiresAt }) {
    const res = await query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, expires_at, created_at`,
      [userId, tokenHash, expiresAt]
    );
    return res.rows[0];
  }

  async findActiveSession(tokenHash) {
    const res = await query(
      `SELECT s.id AS session_id, s.user_id, s.expires_at,
              u.id, u.email, u.display_name, u.timezone, u.created_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  async deleteSession(tokenHash) {
    const res = await query(
      'DELETE FROM sessions WHERE token_hash = $1',
      [tokenHash]
    );
    return res.rowCount > 0;
  }

  async deleteUserSessions(userId) {
    const res = await query(
      'DELETE FROM sessions WHERE user_id = $1',
      [userId]
    );
    return res.rowCount;
  }

  async deleteExpiredSessions() {
    const res = await query(
      'DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP'
    );
    return res.rowCount;
  }
}

export const sessionRepository = new SessionRepository();
