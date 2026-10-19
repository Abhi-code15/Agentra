import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { Modal } from '../components/Modal.jsx';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  Plus,
  ArrowRight,
  Calendar,
  Sparkles,
  MessageSquare,
  ChevronRight
} from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickPrompt, setQuickPrompt] = useState('');
  const [prompting, setPrompting] = useState(false);

  // New task modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDueAt, setNewDueAt] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [tasksRes, convsRes] = await Promise.all([
        api.get('/tasks?limit=50'),
        api.get('/conversations')
      ]);
      setTasks(tasksRes.data || []);
      setConversations(convsRes.conversations || []);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  }

  // Greeting based on user's current hour
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  // Derived metrics
  const now = new Date();
  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const overdueTasks = tasks.filter(
    (t) => t.due_at && new Date(t.due_at) < now && t.status !== 'completed' && t.status !== 'cancelled'
  );
  const upcomingTasks = tasks
    .filter((t) => t.due_at && new Date(t.due_at) >= now && t.status !== 'completed')
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
    .slice(0, 5);

  async function handleQuickAsk(promptText) {
    const textToRun = typeof promptText === 'string' ? promptText : quickPrompt;
    if (!textToRun.trim() || prompting) return;

    setPrompting(true);
    try {
      const convRes = await api.post('/conversations', {
        title: textToRun.length > 30 ? textToRun.substring(0, 30) + '...' : textToRun
      });
      const convId = convRes.conversation.id;

      await api.post(`/conversations/${convId}/messages`, { content: textToRun });
      navigate(`/chat?id=${convId}`);
    } catch (err) {
      console.error('Quick prompt failed', err);
    } finally {
      setPrompting(false);
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!newTitle.trim() || savingTask) return;

    setSavingTask(true);
    try {
      await api.post('/tasks', {
        title: newTitle,
        description: newDesc || null,
        priority: newPriority,
        dueAt: newDueAt ? new Date(newDueAt).toISOString() : null
      });

      setIsModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewDueAt('');
      await loadDashboardData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingTask(false);
    }
  }

  async function toggleComplete(task) {
    try {
      if (task.status === 'completed') {
        await api.patch(`/tasks/${task.id}`, { status: 'pending' });
      } else {
        await api.post(`/tasks/${task.id}/complete`);
      }
      await loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="main-content">
      {/* Welcome Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '0.2rem' }}>
            {greeting}, {user?.display_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Here is your daily productivity overview.
          </p>
        </div>

        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>New Task</span>
        </button>
      </div>

      {/* 4 Clean Metric Cards */}
      <div className="grid grid-cols-4" style={{ marginBottom: '1.75rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending</span>
            <Clock size={16} color="var(--priority-medium)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {pendingTasks.length + inProgressTasks.length}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Active items to finish</span>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overdue</span>
            <AlertCircle size={16} color="var(--priority-high)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: overdueTasks.length > 0 ? 'var(--priority-high)' : 'var(--text-main)' }}>
            {overdueTasks.length}
          </div>
          <span style={{ fontSize: '0.78rem', color: overdueTasks.length > 0 ? '#dc2626' : 'var(--text-muted)' }}>
            {overdueTasks.length > 0 ? 'Needs immediate attention' : 'All deadlines on track'}
          </span>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Completed</span>
            <CheckCircle2 size={16} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#16a34a' }}>
            {completedTasks.length}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Finished tasks</span>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Tasks</span>
            <CheckSquare size={16} color="var(--accent)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {tasks.length}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Across all lists</span>
        </div>
      </div>

      {/* Agentra Command Bar */}
      <div className="card" style={{ marginBottom: '1.75rem', padding: '1.25rem', backgroundColor: '#ffffff', border: '1px solid var(--accent-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Sparkles size={16} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
            Ask Agentra
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            — Analyze tasks, create plans, or update schedules
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleQuickAsk();
          }}
          style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}
        >
          <input
            type="text"
            className="form-input"
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            placeholder="Type a request: e.g. 'Show my pending tasks and plan tomorrow morning's schedule'..."
            disabled={prompting}
            style={{ fontSize: '0.9rem', padding: '0.65rem 0.9rem' }}
          />
          <button type="submit" className="btn btn-primary" disabled={prompting || !quickPrompt.trim()}>
            {prompting ? 'Running...' : 'Execute'}
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Suggestions:</span>
          {[
            'Show my pending tasks',
            'Plan tomorrow morning',
            'Check overdue deadlines'
          ].map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleQuickAsk(prompt)}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: 'var(--radius-full)' }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Two Columns: Agenda & Conversations */}
      <div className="grid grid-cols-2">
        {/* Left Column: Agenda & Deadlines */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>Priority Agenda</h3>
            <button onClick={() => navigate('/tasks')} className="btn btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>
              View All <ArrowRight size={13} />
            </button>
          </div>

          {upcomingTasks.length === 0 && overdueTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No upcoming deadlines right now. Everything is clear!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {overdueTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#fef2f2',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #fecaca'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={() => toggleComplete(task)}
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#b91c1c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, marginLeft: '0.5rem' }}>
                    Overdue
                  </span>
                </div>
              ))}

              {upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={() => toggleComplete(task)}
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`priority-indicator priority-${task.priority}`}>
                      <span className="priority-dot" />
                      {task.priority}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(task.due_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: AI Workflows */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>Recent AI Workflows</h3>
            <button onClick={() => navigate('/chat')} className="btn btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>
              Open Chat <ArrowRight size={13} />
            </button>
          </div>

          {conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No conversations yet. Use the command bar above to start your first session.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {conversations.slice(0, 5).map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => navigate(`/chat?id=${conv.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-subtle)';
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.last_message_preview || 'No messages yet'}
                    </div>
                  </div>
                  <ChevronRight size={15} color="var(--text-muted)" style={{ flexShrink: 0, marginLeft: '0.5rem' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Task">
        <form onSubmit={handleCreateTask}>
          <div className="form-group">
            <label className="form-label">Task Title</label>
            <input
              type="text"
              className="form-input"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Prepare architecture diagram for review"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Add key criteria, notes, or links..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Due Date & Time</label>
              <input
                type="datetime-local"
                className="form-input"
                value={newDueAt}
                onChange={(e) => setNewDueAt(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={savingTask || !newTitle.trim()}>
              {savingTask ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
