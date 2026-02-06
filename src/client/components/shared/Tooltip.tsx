/**
 * Tooltip component for event hover information.
 * FR-ATL-008: Display agent, action, task_id, truncated details.
 */

import React from 'react';
import { LogEntry } from '../../types/log-entry';
import { TOOLTIP_DETAILS_MAX_LENGTH } from '../../config/constants';
import { ActionBadge } from './ActionBadge';

interface TooltipProps {
  entry: LogEntry;
  x: number;
  y: number;
  visible: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ entry, x, y, visible }) => {
  if (!visible) return null;

  const truncatedDetails =
    entry.details.length > TOOLTIP_DETAILS_MAX_LENGTH
      ? entry.details.substring(0, TOOLTIP_DETAILS_MAX_LENGTH) + '...'
      : entry.details;

  const styles: React.CSSProperties = {
    position: 'fixed',
    left: x + 12,
    top: y + 12,
    zIndex: 1000,
    padding: 'var(--space-3)',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    fontSize: '12px',
    maxWidth: '320px',
    pointerEvents: 'none',
  };

  return (
    <div style={styles}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <strong>{entry.agent}</strong>
        <ActionBadge action={entry.action} size="sm" />
      </div>
      {entry.task_id && (
        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>
          {entry.task_id}
        </div>
      )}
      {truncatedDetails && (
        <div style={{ color: 'var(--text-secondary)' }}>{truncatedDetails}</div>
      )}
      <div style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '11px' }}>
        {new Date(entry.timestamp).toLocaleString()}
      </div>
    </div>
  );
};
