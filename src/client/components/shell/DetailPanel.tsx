/**
 * Slide-out entry detail panel.
 * FR-EDP-001: Slide-out on right side.
 * FR-EDP-002: Display all fields in human-readable format.
 * FR-EDP-003: Parent/child navigation.
 * FR-EDP-004: Raw JSON toggle.
 * FR-EDP-005: Close via X, Escape, or click outside.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useLog } from '../../store/LogContext';
import { ActionBadge } from '../shared/ActionBadge';

export const DetailPanel: React.FC = () => {
  const { state, selectEntry } = useLog();
  const { selectedEntry, indices } = state;
  const [showRaw, setShowRaw] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowRaw(false);
  }, [selectedEntry]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedEntry) {
        selectEntry(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedEntry, selectEntry]);

  if (!selectedEntry) return null;

  const entry = selectedEntry;
  const childSeqs = indices.parentChildMap.get(entry.log_seq) ?? [];

  const navigateTo = (logSeq: number) => {
    const target = indices.entryMap.get(logSeq);
    if (target) selectEntry(target);
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const panelStyles: React.CSSProperties = {
    position: 'fixed',
    right: 0,
    top: 'var(--nav-height)',
    bottom: 0,
    width: 'var(--detail-panel-width)',
    backgroundColor: 'var(--bg-primary)',
    borderLeft: '1px solid var(--border-primary)',
    boxShadow: 'var(--shadow-lg)',
    overflowY: 'auto',
    zIndex: 20,
    padding: 'var(--space-4)',
  };

  const sectionStyles: React.CSSProperties = {
    marginBottom: 'var(--space-4)',
  };

  const labelStyles: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: 'var(--space-1)',
  };

  const linkStyles: React.CSSProperties = {
    color: 'var(--accent-primary)',
    cursor: 'pointer',
    textDecoration: 'underline',
    border: 'none',
    background: 'none',
    padding: 0,
    font: 'inherit',
  };

  const listStyles: React.CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    fontSize: '13px',
  };

  return (
    <div ref={panelRef} style={panelStyles}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Entry Detail</h3>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            onClick={() => setShowRaw(!showRaw)}
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-primary)',
              cursor: 'pointer',
              fontSize: '11px',
              backgroundColor: showRaw ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: showRaw ? '#ffffff' : 'var(--text-secondary)',
            }}
          >
            {showRaw ? 'Formatted' : 'Raw JSON'}
          </button>
          <button
            onClick={() => selectEntry(null)}
            style={{
              padding: '4px 8px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: 'var(--text-muted)',
            }}
            aria-label="Close detail panel"
          >
            x
          </button>
        </div>
      </div>

      {showRaw ? (
        <pre
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            backgroundColor: 'var(--bg-tertiary)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(entry, null, 2)}
        </pre>
      ) : (
        <>
          {/* Identifiers */}
          <div style={sectionStyles}>
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              <div>
                <div style={labelStyles}>Log Seq</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>#{entry.log_seq}</div>
              </div>
              <div>
                <div style={labelStyles}>Work Seq</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{entry.work_seq}</div>
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div style={sectionStyles}>
            <div style={labelStyles}>Timestamp</div>
            <div style={{ fontSize: '13px' }}>
              {new Date(entry.timestamp).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
            </div>
          </div>

          {/* Agent + Action */}
          <div style={sectionStyles}>
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              <div>
                <div style={labelStyles}>Agent</div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{entry.agent}</div>
              </div>
              <div>
                <div style={labelStyles}>Action</div>
                <ActionBadge action={entry.action} />
              </div>
            </div>
          </div>

          {/* Phase */}
          <div style={sectionStyles}>
            <div style={labelStyles}>Phase</div>
            <div style={{ fontSize: '13px' }}>{entry.phase}</div>
          </div>

          {/* Task ID */}
          {entry.task_id && (
            <div style={sectionStyles}>
              <div style={labelStyles}>Task ID</div>
              <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>{entry.task_id}</div>
            </div>
          )}

          {/* Parent */}
          {entry.parent_log_seq !== null && (
            <div style={sectionStyles}>
              <div style={labelStyles}>Parent</div>
              <button style={linkStyles} onClick={() => navigateTo(entry.parent_log_seq!)}>
                #{entry.parent_log_seq}
              </button>
            </div>
          )}

          {/* Children */}
          {childSeqs.length > 0 && (
            <div style={sectionStyles}>
              <div style={labelStyles}>Children ({childSeqs.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                {childSeqs.map((seq) => (
                  <button key={seq} style={linkStyles} onClick={() => navigateTo(seq)}>
                    #{seq}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          {entry.details && (
            <div style={sectionStyles}>
              <div style={labelStyles}>Details</div>
              <div style={{ fontSize: '13px', lineHeight: 1.6 }}>{entry.details}</div>
            </div>
          )}

          {/* Requirements */}
          {entry.requirements.length > 0 && (
            <div style={sectionStyles}>
              <div style={labelStyles}>Requirements</div>
              <ul style={listStyles}>
                {entry.requirements.map((req, i) => (
                  <li key={i} style={{ padding: '1px 0' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Files Created */}
          {entry.files_created.length > 0 && (
            <div style={sectionStyles}>
              <div style={labelStyles}>Files Created ({entry.files_created.length})</div>
              <ul style={listStyles}>
                {entry.files_created.map((f, i) => (
                  <li key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '1px 0' }}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Files Modified */}
          {entry.files_modified.length > 0 && (
            <div style={sectionStyles}>
              <div style={labelStyles}>Files Modified ({entry.files_modified.length})</div>
              <ul style={listStyles}>
                {entry.files_modified.map((f, i) => (
                  <li key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '1px 0' }}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Decisions */}
          {entry.decisions.length > 0 && (
            <div style={sectionStyles}>
              <div style={labelStyles}>Decisions</div>
              <ul style={listStyles}>
                {entry.decisions.map((d, i) => (
                  <li key={i} style={{ fontSize: '13px', padding: '1px 0' }}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Errors */}
          {entry.errors.length > 0 && (
            <div style={{ ...sectionStyles, backgroundColor: 'var(--error-bg)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ ...labelStyles, color: 'var(--error-text)' }}>Errors</div>
              <ul style={listStyles}>
                {entry.errors.map((e, i) => (
                  <li key={i} style={{ fontSize: '13px', color: 'var(--error-text)', padding: '1px 0' }}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Duration */}
          {entry.duration_ms !== null && (
            <div style={sectionStyles}>
              <div style={labelStyles}>Duration</div>
              <div style={{ fontSize: '13px' }}>{formatDuration(entry.duration_ms)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
