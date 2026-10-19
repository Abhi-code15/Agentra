import { pool, query } from '../../db/pool.js';

export class TaskRepository {
  async createTask(
    { userId, title, description = null, status = 'pending', priority = 'medium', dueAt = null, completedAt = null },
    dbClient = pool
  ) {
    const res = await dbClient.query(
      `INSERT INTO tasks (user_id, title, description, status, priority, due_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, title, description, status, priority, due_at, completed_at, created_at, updated_at`,
      [userId, title, description, status, priority, dueAt, completedAt]
    );
    return res.rows[0];
  }

  async findById(taskId, userId) {
    const res = await query(
      `SELECT id, user_id, title, description, status, priority, due_at, completed_at, created_at, updated_at
       FROM tasks
       WHERE id = $1 AND user_id = $2`,
      [taskId, userId]
    );
    return res.rows[0] || null;
  }

  _buildWhereClause({ userId, status, priority, search, filter }) {
    const conditions = ['user_id = $1'];
    const values = [userId];
    let idx = 2;

    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }

    if (priority) {
      conditions.push(`priority = $${idx++}`);
      values.push(priority);
    }

    if (search) {
      conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    if (filter === 'overdue') {
      conditions.push(`due_at IS NOT NULL AND due_at < CURRENT_TIMESTAMP AND status NOT IN ('completed', 'cancelled')`);
    } else if (filter === 'upcoming') {
      conditions.push(`due_at IS NOT NULL AND due_at >= CURRENT_TIMESTAMP AND status NOT IN ('completed', 'cancelled')`);
    } else if (filter === 'today') {
      conditions.push(`due_at IS NOT NULL AND due_at >= CURRENT_DATE AND due_at < CURRENT_DATE + INTERVAL '1 day'`);
    }

    return {
      where: `WHERE ${conditions.join(' AND ')}`,
      values,
      nextIdx: idx
    };
  }

  async listTasks({ userId, status, priority, search, filter, sortBy = 'created_at', order = 'desc', limit = 20, offset = 0 }) {
    const { where, values, nextIdx } = this._buildWhereClause({ userId, status, priority, search, filter });

    // Sanitize sort column and order
    const allowedSortCols = {
      due_at: 'due_at',
      created_at: 'created_at',
      priority: `CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`,
      title: 'title'
    };
    const sortExpr = allowedSortCols[sortBy] || 'created_at';
    const sortDir = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const querySql = `
      SELECT id, user_id, title, description, status, priority, due_at, completed_at, created_at, updated_at
      FROM tasks
      ${where}
      ORDER BY ${sortExpr} ${sortDir} NULLS LAST
      LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
    `;

    values.push(limit, offset);
    const res = await query(querySql, values);
    return res.rows;
  }

  async countTasks({ userId, status, priority, search, filter }) {
    const { where, values } = this._buildWhereClause({ userId, status, priority, search, filter });
    const countSql = `SELECT COUNT(*)::int AS total FROM tasks ${where}`;
    const res = await query(countSql, values);
    return res.rows[0].total;
  }

  async updateTask(taskId, userId, fields, dbClient = pool) {
    const updates = [];
    const values = [taskId, userId];
    let idx = 3;

    if (fields.title !== undefined) {
      updates.push(`title = $${idx++}`);
      values.push(fields.title);
    }
    if (fields.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(fields.description);
    }
    if (fields.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(fields.status);
    }
    if (fields.priority !== undefined) {
      updates.push(`priority = $${idx++}`);
      values.push(fields.priority);
    }
    if (fields.dueAt !== undefined) {
      updates.push(`due_at = $${idx++}`);
      values.push(fields.dueAt);
    }
    if (fields.completedAt !== undefined) {
      updates.push(`completed_at = $${idx++}`);
      values.push(fields.completedAt);
    }

    if (updates.length === 0) {
      return this.findById(taskId, userId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const updateSql = `
      UPDATE tasks
      SET ${updates.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, title, description, status, priority, due_at, completed_at, created_at, updated_at
    `;

    const res = await dbClient.query(updateSql, values);
    return res.rows[0] || null;
  }

  async deleteTask(taskId, userId) {
    const res = await query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [taskId, userId]
    );
    return res.rowCount > 0;
  }
}

export const taskRepository = new TaskRepository();
