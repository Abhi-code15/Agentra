import { pool, query } from '../../db/pool.js';

export class ConversationRepository {
  async createConversation(userId, title = 'New Conversation', dbClient = pool) {
    const res = await dbClient.query(
      `INSERT INTO conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING id, user_id, title, created_at, updated_at`,
      [userId, title]
    );
    return res.rows[0];
  }

  async findById(conversationId, userId) {
    const res = await query(
      `SELECT id, user_id, title, created_at, updated_at
       FROM conversations
       WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
    return res.rows[0] || null;
  }

  async listConversations(userId) {
    const res = await query(
      `SELECT c.id, c.user_id, c.title, c.created_at, c.updated_at,
              (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_preview,
              (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) as message_count
       FROM conversations c
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC`,
      [userId]
    );
    return res.rows;
  }

  async updateTitle(conversationId, userId, title) {
    const res = await query(
      `UPDATE conversations
       SET title = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, title, created_at, updated_at`,
      [title, conversationId, userId]
    );
    return res.rows[0] || null;
  }

  async touchConversation(conversationId, dbClient = pool) {
    await dbClient.query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [conversationId]
    );
  }

  async deleteConversation(conversationId, userId) {
    const res = await query(
      'DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id',
      [conversationId, userId]
    );
    return res.rowCount > 0;
  }

  async createMessage({ conversationId, role, content, metadata = {} }, dbClient = pool) {
    const res = await dbClient.query(
      `INSERT INTO messages (conversation_id, role, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING id, conversation_id, role, content, metadata, created_at`,
      [conversationId, role, content, JSON.stringify(metadata)]
    );
    return res.rows[0];
  }

  async listMessages(conversationId, limit = 100) {
    const res = await query(
      `SELECT id, conversation_id, role, content, metadata, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [conversationId, limit]
    );
    return res.rows;
  }

  async getRecentMessages(conversationId, limit = 20) {
    const res = await query(
      `SELECT * FROM (
         SELECT id, conversation_id, role, content, metadata, created_at
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       ) sub
       ORDER BY created_at ASC`,
      [conversationId, limit]
    );
    return res.rows;
  }

  async searchConversations(userId, searchQuery, limit = 10) {
    const res = await query(
      `SELECT m.id, m.conversation_id, c.title AS conversation_title, m.role, m.content, m.created_at
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = $1 AND m.content ILIKE $2
       ORDER BY m.created_at DESC
       LIMIT $3`,
      [userId, `%${searchQuery}%`, limit]
    );
    return res.rows;
  }
}

export const conversationRepository = new ConversationRepository();
