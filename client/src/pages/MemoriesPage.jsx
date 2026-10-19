import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { Modal } from '../components/Modal.jsx';
import { Brain, Plus, Trash2, Edit2, Search, Tag, Info, X } from 'lucide-react';

export function MemoriesPage() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState(null);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('preference');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMemories();
  }, [categoryFilter]);

  async function loadMemories() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await api.get(`/memories?${params.toString()}`);
      setMemories(res.memories || []);
    } catch (err) {
      console.error('Failed to load memories', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadMemories();
  }

  function handleClearSearch() {
    setSearch('');
    const params = new URLSearchParams();
    if (categoryFilter) params.set('category', categoryFilter);
    setLoading(true);
    api.get(`/memories?${params.toString()}`)
      .then((res) => setMemories(res.memories || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  function openCreateModal() {
    setEditingMemory(null);
    setContent('');
    setCategory('preference');
    setIsModalOpen(true);
  }

  function openEditModal(mem) {
    setEditingMemory(mem);
    setContent(mem.content);
    setCategory(mem.category);
    setIsModalOpen(true);
  }

  async function handleSaveMemory(e) {
    e.preventDefault();
    if (!content.trim() || saving) return;

    setSaving(true);
    try {
      if (editingMemory) {
        await api.patch(`/memories/${editingMemory.id}`, { content, category });
      } else {
        await api.post('/memories', { content, category });
      }
      setIsModalOpen(false);
      loadMemories();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMemory(id) {
    if (!window.confirm('Delete this memory? Agentra will no longer remember this context.')) return;
    try {
      await api.delete(`/memories/${id}`);
      loadMemories();
    } catch (err) {
      alert(err.message);
    }
  }

  const categoryColorMap = {
    preference: { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe' },
    goal: { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
    project: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
    general: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' }
  };

  return (
    <div className="main-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Long-Term Memory
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
              {memories.length}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Persistent personal preferences, working style, and project constraints retrieved by Agentra during reasoning.
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary" style={{ padding: '0.55rem 1.1rem' }}>
          <Plus size={16} />
          <span>Add Memory</span>
        </button>
      </div>

      {/* Explanatory Info Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.85rem',
          padding: '0.85rem 1.15rem',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          color: '#1e40af'
        }}
      >
        <Info size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
        <div>
          <strong style={{ fontWeight: 600 }}>How Agentra uses memories:</strong> When you converse in chat or ask the assistant to propose a schedule, relevant memories are dynamically retrieved and injected into the prompt context to personalize recommendations to your style.
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '0.85rem 1.15rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: 'var(--radius-sm)', flexWrap: 'wrap' }}>
          {[
            { id: '', label: 'All Context' },
            { id: 'preference', label: 'Preferences' },
            { id: 'goal', label: 'Goals' },
            { id: 'project', label: 'Projects' },
            { id: 'general', label: 'General' }
          ].map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
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
                {cat.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', position: 'relative', flex: '1', minWidth: '200px', maxWidth: '320px' }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', pointerEvents: 'none' }} />
          <input
            type="text"
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved memories..."
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
      </div>

      {/* Memory Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Loading stored context...
        </div>
      ) : memories.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1.5rem', color: 'var(--text-muted)' }}>
          <Brain size={44} style={{ margin: '0 auto 1rem', color: 'var(--border-strong)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
            No memories saved yet
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 1.25rem' }}>
            Save preferences like "I prefer focus blocks on Tuesday mornings" or "Current goal: Launch Q3 Mobile App" so Agentra automatically tailors plans to your style.
          </p>
          <button onClick={openCreateModal} className="btn btn-secondary">
            <Plus size={15} /> Add First Memory
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
          {memories.map((mem) => {
            const tagStyle = categoryColorMap[mem.category] || categoryColorMap.general;
            return (
              <div
                key={mem.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '1.25rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-default)',
                  transition: 'box-shadow 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.55rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: tagStyle.bg,
                        color: tagStyle.text,
                        border: `1px solid ${tagStyle.border}`,
                        textTransform: 'capitalize'
                      }}
                    >
                      <Tag size={11} />
                      {mem.category}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Updated {new Date(mem.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.925rem', color: 'var(--text-main)', lineHeight: 1.55, fontWeight: 400 }}>
                    {mem.content}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-default)', paddingTop: '0.75rem' }}>
                  <button
                    onClick={() => openEditModal(mem)}
                    className="btn btn-ghost"
                    style={{ padding: '0.3rem 0.55rem', color: 'var(--text-secondary)' }}
                    title="Edit memory"
                  >
                    <Edit2 size={13} />
                    <span style={{ fontSize: '0.78rem' }}>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteMemory(mem.id)}
                    className="btn btn-ghost"
                    style={{ padding: '0.3rem 0.55rem', color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    title="Delete memory"
                  >
                    <Trash2 size={13} />
                    <span style={{ fontSize: '0.78rem' }}>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingMemory ? 'Edit Memory' : 'Save New Memory'}>
        <form onSubmit={handleSaveMemory}>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="preference">Preference (communication style, working hours, habits)</option>
              <option value="goal">Goal (quarterly targets, personal milestones)</option>
              <option value="project">Project Context (tech stack, team constraints, links)</option>
              <option value="general">General Note</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Memory Content</label>
            <textarea
              className="form-textarea"
              rows={4}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="e.g. Always schedule deep work sessions on Tuesday and Thursday mornings before 11:00 AM."
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-default)' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !content.trim()}>
              {saving ? 'Saving...' : editingMemory ? 'Update Memory' : 'Save Memory'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
