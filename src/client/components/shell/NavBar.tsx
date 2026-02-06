/**
 * Top navigation bar.
 * UI-002: View access, file info, controls.
 * FR-PPD-005: Error badge visible in nav.
 */

import React from 'react';
import { useLog } from '../../store/LogContext';
import { useTheme } from '../../store/ThemeContext';
import { VIEWS, ViewId } from '../../config/constants';

interface NavBarProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  onLoadFile: () => void;
  liveTailActive: boolean;
  onToggleLiveTail: () => void;
  onExport: () => void;
  lastPollTime: string | null;
}

export const NavBar: React.FC<NavBarProps> = ({
  activeView,
  onViewChange,
  onLoadFile,
  liveTailActive,
  onToggleLiveTail,
  onExport,
  lastPollTime,
}) => {
  const { state } = useLog();
  const { theme, toggleTheme } = useTheme();

  const errorCount = state.entries.filter(
    (e) => e.action === 'REVIEW_FAIL' || e.action === 'ERROR' || e.action === 'TEST_FAIL'
  ).length;

  const navStyles: React.CSSProperties = {
    height: 'var(--nav-height)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 var(--space-4)',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-primary)',
    gap: 'var(--space-4)',
    flexShrink: 0,
  };

  const tabStyles = (isActive: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 400,
    backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
    color: isActive ? '#ffffff' : 'var(--text-secondary)',
  });

  const buttonStyles: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-primary)',
    cursor: 'pointer',
    fontSize: '13px',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  };

  return (
    <nav style={navStyles}>
      <strong style={{ fontSize: '16px', marginRight: 'var(--space-2)' }}>
        Activity Log Viewer
      </strong>

      {state.metadata.fileName && (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: 'var(--space-2)' }}>
          {state.metadata.fileName} ({state.metadata.totalEntries} entries
          {state.metadata.skippedLines > 0 && `, ${state.metadata.skippedLines} skipped`})
        </span>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-1)', marginLeft: 'auto' }}>
        {VIEWS.map((view) => (
          <button
            key={view.id}
            style={tabStyles(activeView === view.id)}
            onClick={() => onViewChange(view.id)}
            title={`${view.label} (${view.shortcut})`}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <button style={buttonStyles} onClick={onLoadFile} title="Load log file (Ctrl+O)">
          Open
        </button>

        <button
          style={{
            ...buttonStyles,
            backgroundColor: liveTailActive ? 'var(--success-bg)' : 'var(--bg-primary)',
            color: liveTailActive ? 'var(--success-text)' : 'var(--text-primary)',
          }}
          onClick={onToggleLiveTail}
          title={liveTailActive ? `Live tail active (last: ${lastPollTime ?? 'never'})` : 'Enable live tail'}
          disabled={!state.metadata.fileName}
        >
          {liveTailActive ? 'Live' : 'Tail'}
        </button>

        <button style={buttonStyles} onClick={toggleTheme} title="Toggle theme (T)">
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>

        <button
          style={buttonStyles}
          onClick={onExport}
          title="Export as PNG"
          disabled={!state.metadata.fileName}
        >
          Export
        </button>

        {errorCount > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '24px',
              height: '24px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--error-bg)',
              color: 'var(--error-text)',
              fontSize: '12px',
              fontWeight: 700,
              padding: '0 6px',
            }}
            title={`${errorCount} errors/failures`}
          >
            {errorCount}
          </span>
        )}
      </div>
    </nav>
  );
};
