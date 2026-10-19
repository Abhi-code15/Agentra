import React, { useState } from 'react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { User, Shield, LogOut, Check, Globe } from 'lucide-react';

export function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  async function handleProfileSave(e) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);

    try {
      await updateProfile({
        displayName,
        timezone
      });
      setSuccessMsg('Profile settings updated successfully!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const commonTimezones = [
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Kolkata',
    'Asia/Tokyo',
    'Asia/Singapore'
  ];

  return (
    <div className="main-content" style={{ maxWidth: '720px' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          Settings & Profile
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
          Manage your personal details, default timezone for natural-language scheduling, and active session.
        </p>
      </div>

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.85rem 1.15rem',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 'var(--radius-md)',
            color: '#15803d',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-xs)'
          }}
        >
          <Check size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Profile Card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-default)' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)'
            }}
          >
            <User size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>Personal Information</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Update your public name and primary schedule parameters</p>
          </div>
        </div>

        <form onSubmit={handleProfileSave}>
          <div className="form-group">
            <label className="form-label">Email Address (Account Identifier)</label>
            <input
              type="text"
              className="form-input"
              value={user?.email || ''}
              disabled
              style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
              Email address is linked to your authentication provider and cannot be changed here.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              type="text"
              className="form-input"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Johnson"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Local Timezone</label>
            <input
              type="text"
              className="form-input"
              required
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. America/New_York or UTC"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
              Used by the AI engine to interpret relative dates like "tomorrow at 3 PM".
            </span>

            {/* Quick Timezone Pills */}
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {commonTimezones.map((tz) => (
                <button
                  key={tz}
                  type="button"
                  onClick={() => setTimezone(tz)}
                  style={{
                    border: '1px solid var(--border-default)',
                    backgroundColor: timezone === tz ? 'var(--accent-light)' : '#ffffff',
                    color: timezone === tz ? 'var(--accent)' : 'var(--text-secondary)',
                    borderColor: timezone === tz ? 'var(--accent-border)' : 'var(--border-default)',
                    fontSize: '0.725rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer'
                  }}
                >
                  {tz}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-default)' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Security & Sessions Card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-default)' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669'
            }}
          >
            <Shield size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>Session & Security</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Server-side authenticated session details</p>
          </div>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
          Your session token is cryptographically hashed and stored in secure HttpOnly cookies with CSRF Double-Submit validation. Active credentials never persist in browser localStorage.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={() => logout()} className="btn btn-danger">
            <LogOut size={15} />
            <span>Sign Out of Current Session</span>
          </button>
        </div>
      </div>
    </div>
  );
}
