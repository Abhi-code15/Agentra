import { pool, query } from '../../db/pool.js';

export class MemoryRepository {
  async createMemory({ userId, content, category = 'general', source = 'user' }, dbClient = pool) {
    const res = await dbClient.query(
      `INSERT INTO user_memories (user_id, content, category, source)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, content, category, source, created_at, updated_at`,
      [userId, content, category, source]
    );
    return res.rows[0];
  }

  async findById(memoryId, userId) {
    const res = await query(
      `SELECT id, user_id, content, category, source, created_at, updated_at
       FROM user_memories
       WHERE id = $1 AND user_id = $2`,
      [memoryId, userId]
    );
    return res.rows[0] || null;
  }

  async listMemories(userId, { category, search } = {}) {
    const conditions = ['user_id = $1'];
    const values = [userId];
    let idx = 2;

    if (category) {
      conditions.push(`category = $${idx++}`);
      values.push(category);
    }

    if (search) {
      conditions.push(`content ILIKE $${idx++}`);
      values.push(`%${search}%`);
    }

    const sql = `
      SELECT id, user_id, content, category, source, created_at, updated_at
      FROM user_memories
      WHERE ${conditions.join(' AND ')}
      ORDER BY updated_at DESC
    `;

    const res = await query(sql, values);
    return res.rows;
  }

  async searchRelevantMemories(userId, text, limit = 5) {
    if (!text || text.trim().length === 0) {
      return this.listMemories(userId);
    }

    // Split text into significant search terms (ignore common stopwords)
    const stopwords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'have', 'from', 'what', 'your']);
    const terms = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w));

    if (terms.length === 0) {
      const res = await query(
        `SELECT id, content, category FROM user_memories WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2`,
        [userId, limit]
      );
      return res.rows;
    }

    // Score based on term matches in content
    const likes = terms.map((_, i) => `content ILIKE $${i + 2}`).join(' OR ');
    const sql = `
      SELECT id, content, category, updated_at
      FROM user_memories
      WHERE user_id = $1 AND (${likes})
      ORDER BY updated_at DESC
      LIMIT $${terms.length + 2}
    `;

    const values = [userId, ...terms.map((t) => `%${t}%`), limit];
    const res = await query(sql, values);
    return res.rows;
  }

  async updateMemory(memoryId, userId, { content, category }) {
    const updates = [];
    const values = [memoryId, userId];
    let idx = 3;

    if (content !== undefined) {
      updates.push(`content = $${idx++}`);
      values.push(content);
    }
    if (category !== undefined) {
      updates.push(`category = $${idx++}`);
      values.push(category);
    }

    if (updates.length === 0) {
      return this.findById(memoryId, userId);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `
      UPDATE user_memories
      SET ${updates.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, content, category, source, created_at, updated_at
    `;

    const res = await query(sql, values);
    return res.rows[0] || null;
  }

  async deleteMemory(memoryId, userId) {
    const res = await query(
      'DELETE FROM user_memories WHERE id = $1 AND user_id = $2 RETURNING id',
      [memoryId, userId]
    );
    return res.rowCount > 0;
  }
}

export const memoryRepository = new MemoryRepository();
