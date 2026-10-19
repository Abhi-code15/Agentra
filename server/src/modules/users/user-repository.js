import { pool, query } from '../../db/pool.js';

export class UserRepository {
  async findByEmail(email) {
    const res = await query(
      'SELECT id, email, password_hash, display_name, timezone, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    return res.rows[0] || null;
  }

  async findById(id) {
    const res = await query(
      'SELECT id, email, display_name, timezone, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async createUser({ email, passwordHash, displayName, timezone = 'UTC' }, dbClient = pool) {
    const res = await dbClient.query(
      `INSERT INTO users (email, password_hash, display_name, timezone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, timezone, created_at, updated_at`,
      [email.toLowerCase(), passwordHash, displayName, timezone]
    );
    return res.rows[0];
  }

  async updateUser(id, { displayName, timezone }) {
    const updates = [];
    const values = [];
    let idx = 1;

    if (displayName !== undefined) {
      updates.push(`display_name = $${idx++}`);
      values.push(displayName);
    }
    if (timezone !== undefined) {
      updates.push(`timezone = $${idx++}`);
      values.push(timezone);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const res = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, email, display_name, timezone, created_at, updated_at`,
      values
    );
    return res.rows[0] || null;
  }

  async findIdentity(provider, providerSubject) {
    const res = await query(
      `SELECT ui.id, ui.user_id, ui.provider, ui.provider_subject, ui.provider_email,
              u.email, u.display_name, u.timezone, u.created_at
       FROM user_identities ui
       JOIN users u ON ui.user_id = u.id
       WHERE ui.provider = $1 AND ui.provider_subject = $2`,
      [provider, providerSubject]
    );
    return res.rows[0] || null;
  }

  async createIdentity({ userId, provider, providerSubject, providerEmail }, dbClient = pool) {
    const res = await dbClient.query(
      `INSERT INTO user_identities (user_id, provider, provider_subject, provider_email)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, provider, provider_subject, provider_email, created_at`,
      [userId, provider, providerSubject, providerEmail]
    );
    return res.rows[0];
  }
}

export const userRepository = new UserRepository();
