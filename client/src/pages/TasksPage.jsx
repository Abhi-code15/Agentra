import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { Modal } from '../components/Modal.jsx';
import {
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  AlertCircle,
  X
} from 'lucide-react';

export function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [order, setOrder] = useState('desc');

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('pending');
  const [priority, setPriority] = useState('medium');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTasks(1);
  }, [statusFilter, priorityFilter, quickFilter, sortBy, order]);

  async function loadTasks(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', 20);
      params.set('sortBy', sortBy);
      params.set('order', order);

      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (quickFilter !== 'all') params.set('filter', quickFilter);

      const res = await api.get(`/tasks?${params.toString()}`);
      setTasks(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadTasks(1);
  }

  function handleClearSearch() {
    setSearch('');
    // Reload with page 1 and no search
    const params = new URLSearchParams();
    params.set('page', 1);
    params.set('limit', 20);
    params.set('sortBy', sortBy);
    params.set('order', order);
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (quickFilter !== 'all') params.set('filter', quickFilter);

    setLoading(true);
    api.get(`/tasks?${params.toString()}`)
      .then((res) => {
        setTasks(res.data || []);
        setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  function openCreateModal() {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setStatus('pending');
    setPriority('medium');
    setDueAt('');
    setIsModalOpen(true);
  }

  function openEditModal(task) {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setStatus(task.status);
    setPriority(task.priority);
    setDueAt(task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : '');
    setIsModalOpen(true);
  }

  async function handleSaveTask(e) {
    e.preventDefault();
    if (!title.trim() || saving) return;

    setSaving(true);
    try {
      const payload = {
        title,
        description: description || null,
        status,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null
      };

      if (editingTask) {
        await api.patch(`/tasks/${editingTask.id}`, payload);
      } else {
        await api.post('/tasks', payload);
      }

      setIsModalOpen(false);
      loadTasks(pagination.page);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(task) {
    try {
      if (task.status === 'completed') {
        await api.patch(`/tasks/${task.id}`, { status: 'pending' });
      } else {
        await api.post(`/tasks/${task.id}/complete`);
      }
      loadTasks(pagination.page);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(taskId) {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      loadTasks(pagination.page);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="main-content">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Tasks
            </h1>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-surface-active)',
                padding: '0.15rem 0.6rem',
                borderRadius: 'var(--radius-full)'
              }}
            >
              {pagination.total}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Organize, prioritize, and track your daily priorities and agent-generated workflows.
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary" style={{ padding: '0.55rem 1.1rem' }}>
          <Plus size={16} />
          <span>New Task</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '0.85rem 1.15rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Quick preset tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'overdue', label: 'Overdue' }
            ].map((f) => {
              const active = quickFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setQuickFilter(f.id)}
                  style={{
                    border: 'none',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '0.8rem',
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    backgroundColor: active ? '#ffffff' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    boxShadow: active ? 'var(--shadow-xs)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', position: 'relative', flex: '1', minWidth: '200px', maxWidth: '340px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', pointerEvents: 'none' }} />
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              style={{ paddingLeft: '2.25rem', paddingRight: search ? '2rem' : '0.75rem', fontSize: '0.85rem' }}
            />
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            )}
          </form>

          {/* Status & Priority dropdowns */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '0.45rem 0.7rem', fontSize: '0.825rem', width: 'auto' }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              className="form-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ padding: '0.45rem 0.7rem', fontSize: '0.825rem', width: 'auto' }}
            >
              <option value="">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task List Container */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1.5rem', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={44} style={{ margin: '0 auto 1rem', color: 'var(--border-strong)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
              No tasks found
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              {search || statusFilter || priorityFilter || quickFilter !== 'all'
                ? 'Try clearing your filters or search keywords.'
                : 'Create your first task or ask Agentra in chat to organize a plan for you.'}
            </p>
            <button onClick={openCreateModal} className="btn btn-secondary">
              <Plus size={15} /> Create Task
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tasks.map((task, idx) => {
              const isOverdue =
                task.due_at &&
                new Date(task.due_at) < new Date() &&
                task.status !== 'completed' &&
                task.status !== 'cancelled';
              const isDone = task.status === 'completed';

              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.95rem 1.25rem',
                    borderBottom: idx === tasks.length - 1 ? 'none' : '1px solid var(--border-default)',
                    backgroundColor: isDone ? 'var(--bg-subtle)' : '#ffffff',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggleComplete(task)}
                      style={{
                        width: '18px',
                        height: '18px',
                        marginTop: '0.2rem',
                        cursor: 'pointer',
                        accentColor: 'var(--accent)'
                      }}
                    />

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '0.925rem',
                            color: isDone ? 'var(--text-muted)' : 'var(--text-main)',
                            textDecoration: isDone ? 'line-through' : 'none'
                          }}
                        >
                          {task.title}
                        </span>
                        <span className={`badge badge-${task.status}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        <span className={`priority-indicator priority-${task.priority}`}>
                          <span className="priority-dot" />
                          <span style={{ textTransform: 'capitalize' }}>{task.priority}</span>
                        </span>
                      </div>

                      {task.description && (
                        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginLeft: '1rem' }}>
                    {task.due_at && (
                      <span
                        style={{
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          color: isOverdue ? 'var(--priority-high)' : 'var(--text-muted)',
                          fontWeight: isOverdue ? 600 : 500,
                          backgroundColor: isOverdue ? '#fee2e2' : 'transparent',
                          padding: isOverdue ? '0.15rem 0.5rem' : '0',
                          borderRadius: isOverdue ? 'var(--radius-xs)' : '0'
                        }}
                      >
                        <Calendar size={13} />
                        {new Date(task.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {isOverdue && ' (Overdue)'}
                      </span>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        onClick={() => openEditModal(task)}
                        className="btn btn-ghost"
                        style={{ padding: '0.35rem 0.5rem', color: 'var(--text-secondary)' }}
                        title="Edit task"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="btn btn-ghost"
                        style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        title="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination controls */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-default)', fontSize: '0.85rem', color: 'var(--text-secondary)', backgroundColor: '#ffffff' }}>
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                disabled={!pagination.hasPrevPage}
                onClick={() => loadTasks(pagination.page - 1)}
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                disabled={!pagination.hasNextPage}
                onClick={() => loadTasks(pagination.page + 1)}
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTask ? 'Edit Task' : 'Create Task'}>
        <form onSubmit={handleSaveTask}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              type="text"
              className="form-input"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prepare quarterly review presentation"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details, context, or links..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Due Date & Time (Optional)</label>
            <input
              type="datetime-local"
              className="form-input"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-default)' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
              {saving ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
