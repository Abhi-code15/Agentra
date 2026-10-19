import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Check,
  Wrench,
  X
} from 'lucide-react';

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConvIdFromQuery = searchParams.get('id');

  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputContent, setInputContent] = useState('');
  const [loadingConv, setLoadingConv] = useState(true);
  const [sending, setSending] = useState(false);
  const [approvingProposalId, setApprovingProposalId] = useState(null);
  const [expandedTools, setExpandedTools] = useState({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeConvIdFromQuery && (!currentConversation || currentConversation.id !== activeConvIdFromQuery)) {
      selectConversation(activeConvIdFromQuery);
    }
  }, [activeConvIdFromQuery, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function loadConversations() {
    setLoadingConv(true);
    try {
      const res = await api.get('/conversations');
      const list = res.conversations || [];
      setConversations(list);

      if (!activeConvIdFromQuery && list.length > 0) {
        selectConversation(list[0].id);
      } else if (list.length === 0) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoadingConv(false);
    }
  }

  async function selectConversation(convId) {
    setSearchParams({ id: convId });
    try {
      const [convRes, msgRes] = await Promise.all([
        api.get(`/conversations/${convId}`),
        api.get(`/conversations/${convId}/messages`)
      ]);
      setCurrentConversation(convRes.conversation);
      setMessages(msgRes.messages || []);
    } catch (err) {
      console.error('Failed to select conversation', err);
    }
  }

  async function handleCreateNewConversation() {
    try {
      const res = await api.post('/conversations', { title: 'New Conversation' });
      const newConv = res.conversation;
      setConversations((prev) => [newConv, ...prev]);
      selectConversation(newConv.id);
      if (textareaRef.current) textareaRef.current.focus();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDeleteConversation(convId, e) {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;

    try {
      await api.delete(`/conversations/${convId}`);
      const updated = conversations.filter((c) => c.id !== convId);
      setConversations(updated);

      if (currentConversation?.id === convId) {
        if (updated.length > 0) {
          selectConversation(updated[0].id);
        } else {
          setCurrentConversation(null);
          setMessages([]);
          setSearchParams({});
        }
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSendMessage(e) {
    if (e) e.preventDefault();
    if (!inputContent.trim() || sending) return;

    let convId = currentConversation?.id;
    if (!convId) {
      const newConvRes = await api.post('/conversations', {
        title: inputContent.slice(0, 30)
      });
      convId = newConvRes.conversation.id;
      setCurrentConversation(newConvRes.conversation);
      setConversations((prev) => [newConvRes.conversation, ...prev]);
      setSearchParams({ id: convId });
    }

    const userText = inputContent.trim();
    setInputContent('');
    setSending(true);

    // Optimistically add user message
    const tempUserMsg = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await api.post(`/conversations/${convId}/messages`, { content: userText });

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
        return [
          ...filtered,
          { ...tempUserMsg, id: `user_${Date.now()}` },
          {
            ...res.message,
            toolsExecuted: res.tools,
            proposals: res.proposals
          }
        ];
      });

      loadConversations();
    } catch (err) {
      alert(`Error processing request: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  async function handleApproveProposal(runId, proposalId) {
    setApprovingProposalId(proposalId);
    try {
      const res = await api.post(`/agent-runs/${runId || 'run'}/proposals/${proposalId}/approve`);
      alert(`Plan Approved! Created ${res.executedResults?.length || 0} tasks.`);
      if (currentConversation) {
        const msgRes = await api.get(`/conversations/${currentConversation.id}/messages`);
        setMessages(msgRes.messages || []);
      }
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setApprovingProposalId(null);
    }
  }

  async function handleRejectProposal(runId, proposalId) {
    try {
      await api.post(`/agent-runs/${runId || 'run'}/proposals/${proposalId}/reject`);
      if (currentConversation) {
        const msgRes = await api.get(`/conversations/${currentConversation.id}/messages`);
        setMessages(msgRes.messages || []);
      }
    } catch (err) {
      alert(`Reject error: ${err.message}`);
    }
  }

  function toggleToolDetails(toolId) {
    setExpandedTools((prev) => ({ ...prev, [toolId]: !prev[toolId] }));
  }

  // Clean Markdown Renderer
  function renderMarkdown(text) {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('> [!IMPORTANT]')) {
        return (
          <div key={idx} style={{ padding: '0.6rem 0.85rem', backgroundColor: '#eef2ff', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--radius-xs)', margin: '0.5rem 0', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600 }}>
            IMPORTANT:
          </div>
        );
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} style={{ paddingLeft: '0.75rem', borderLeft: '2px solid var(--border-strong)', margin: '0.35rem 0', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.875rem' }}>
            {line.substring(2)}
          </blockquote>
        );
      }
      if (line.startsWith('### ')) {
        return <h4 key={idx} style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0.6rem 0 0.2rem', color: 'var(--text-main)' }}>{line.substring(4)}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.8rem 0 0.25rem', color: 'var(--text-main)' }}>{line.substring(3)}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={idx} style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.9rem 0 0.3rem', color: 'var(--text-main)' }}>{line.substring(2)}</h2>;
      }
      if (line.startsWith('- ')) {
        return (
          <li key={idx} style={{ marginLeft: '1.25rem', marginBottom: '0.2rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
            {renderInlineMarkdown(line.substring(2))}
          </li>
        );
      }
      if (!line.trim()) {
        return <div key={idx} style={{ height: '0.35rem' }} />;
      }
      return (
        <p key={idx} style={{ marginBottom: '0.35rem', fontSize: '0.9rem', lineHeight: 1.55, color: 'var(--text-main)' }}>
          {renderInlineMarkdown(line)}
        </p>
      );
    });
  }

  function renderInlineMarkdown(str) {
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: 'var(--text-main)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} style={{ backgroundColor: '#f1f5f9', padding: '0.12rem 0.35rem', borderRadius: '4px', fontSize: '0.85em', color: 'var(--accent)', border: '1px solid var(--border-default)' }}>
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 58px)', overflow: 'hidden', backgroundColor: 'var(--bg-app)' }}>
      {/* Sidebar: Conversations */}
      <div
        style={{
          width: '270px',
          backgroundColor: '#ffffff',
          borderRight: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}
      >
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-default)' }}>
          <button
            onClick={handleCreateNewConversation}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.45rem 0.8rem' }}
          >
            <Plus size={15} />
            <span>New Chat</span>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {loadingConv ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Loading chats...
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
              No chat history yet.
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = currentConversation?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '0.2rem',
                    cursor: 'pointer',
                    backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'all 0.12s ease',
                    fontWeight: isActive ? 600 : 400
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', flex: 1 }}>
                    <MessageSquare size={14} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.6 }} />
                    <span style={{ fontSize: '0.825rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.title}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleDeleteConversation(c.id, e)}
                    className="btn btn-ghost"
                    style={{ padding: '0.15rem 0.3rem', color: 'var(--text-muted)' }}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)', position: 'relative' }}>
        {/* Chat Header */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid var(--border-default)',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {currentConversation?.title || 'New AI Conversation'}
            </h2>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
            Bounded Multi-Step Tools Active
          </span>
        </div>

        {/* Message Thread */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.5rem 6rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {messages.length === 0 && !sending && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '440px', padding: '2rem 1rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}
              >
                <Sparkles size={22} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                How can Agentra assist you?
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Ask anything or select a one-click productivity prompt below:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', textAlign: 'left' }}>
                {[
                  'Show my pending tasks and plan tomorrow morning',
                  'Create task: Review project requirements and verify tests',
                  'Check what tasks are overdue right now',
                  'What are my saved personal preferences and goals?'
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputContent(prompt);
                      if (textareaRef.current) textareaRef.current.focus();
                    }}
                    className="card"
                    style={{
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.825rem',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-default)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    💬 {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata || '{}') : msg.metadata || {};
            const tools = msg.toolsExecuted || [];
            const proposals = msg.proposals || [];

            return (
              <div
                key={msg.id || i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: isUser ? '75%' : '80%',
                  gap: '0.35rem'
                }}
              >
                {/* Assistant Label */}
                {!isUser && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>Agentra</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent)', backgroundColor: 'var(--accent-light)', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>AI</span>
                  </div>
                )}

                {/* Tool execution badge (subtle, clean pill) */}
                {tools.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.25rem' }}>
                    {tools.map((t, idx) => {
                      const isExpanded = expandedTools[t.id || idx];
                      return (
                        <div key={idx} style={{ fontSize: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => toggleToolDetails(t.id || idx)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: '#ffffff',
                              border: '1px solid var(--border-default)',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            <Wrench size={11} color="var(--accent)" />
                            <span>Tool: <strong>{t.toolName}</strong></span>
                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>

                          {isExpanded && (
                            <div
                              style={{
                                marginTop: '0.35rem',
                                padding: '0.5rem 0.75rem',
                                backgroundColor: '#ffffff',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                maxWidth: '420px',
                                overflowX: 'auto'
                              }}
                            >
                              <div><strong>Arguments:</strong> {JSON.stringify(t.arguments)}</div>
                              <div style={{ marginTop: '0.25rem' }}><strong>Result:</strong> {JSON.stringify(t.result)}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  style={{
                    padding: isUser ? '0.65rem 0.95rem' : '0.85rem 1.15rem',
                    borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    backgroundColor: isUser ? 'var(--accent)' : '#ffffff',
                    color: isUser ? '#ffffff' : 'var(--text-main)',
                    border: isUser ? 'none' : '1px solid var(--border-default)',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                >
                  {isUser ? (
                    <p style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{msg.content}</p>
                  ) : (
                    <div>{renderMarkdown(msg.content)}</div>
                  )}
                </div>

                {/* Action Proposal Card (Clean Notion-like Callout) */}
                {proposals.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.35rem' }}>
                    {proposals.map((prop, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid var(--accent-border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.95rem',
                          boxShadow: 'var(--shadow-xs)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <ShieldCheck size={16} color="var(--accent)" />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              Proposed Action Plan
                            </span>
                          </div>
                          <span className="badge badge-pending">Needs Approval</span>
                        </div>

                        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.45 }}>
                          {prop.summary}
                        </p>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleApproveProposal(metadata.agentRunId, prop.proposalId)}
                            disabled={approvingProposalId === prop.proposalId}
                            className="btn btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#16a34a' }}
                          >
                            <Check size={13} />
                            <span>{approvingProposalId === prop.proposalId ? 'Approving...' : 'Approve Plan'}</span>
                          </button>
                          <button
                            onClick={() => handleRejectProposal(metadata.agentRunId, prop.proposalId)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {sending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)', animation: 'pulse 1.2s infinite' }} />
              <span>Agentra is thinking & checking tools...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating Centered Input Container (ChatGPT/Claude Style) */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '1rem 1.5rem',
            background: 'linear-gradient(180deg, rgba(248, 250, 252, 0) 0%, rgba(248, 250, 252, 0.95) 30%, #f8fafc 100%)',
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <div style={{ width: '100%', maxWidth: '768px' }}>
            <form
              onSubmit={handleSendMessage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-full)',
                padding: '0.4rem 0.6rem 0.4rem 1.15rem',
                boxShadow: 'var(--shadow-md)',
                transition: 'border-color 0.15s ease'
              }}
            >
              <input
                ref={textareaRef}
                type="text"
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                placeholder="Ask Agentra to schedule, create tasks, or plan workflows..."
                disabled={sending}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.9rem',
                  color: 'var(--text-main)',
                  backgroundColor: 'transparent'
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sending || !inputContent.trim()}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  padding: 0,
                  flexShrink: 0
                }}
                title="Send message"
              >
                <Send size={15} />
              </button>
            </form>
            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Press <strong>Enter</strong> to send • Sensitive plans will request your approval before executing
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
