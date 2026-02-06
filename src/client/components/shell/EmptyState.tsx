/**
 * Empty state shown when no log file is loaded.
 * UR-006: Clear guidance on how to get started.
 */

import React from 'react';

interface EmptyStateProps {
  onLoadFile: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onLoadFile }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: 'var(--space-8)',
        color: 'var(--text-secondary)',
      }}
    >
      <div
        style={{
          fontSize: '64px',
          marginBottom: 'var(--space-6)',
          opacity: 0.3,
        }}
      >
        [ ]
      </div>
      <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
        No log file loaded
      </h2>
      <p style={{ fontSize: '15px', marginBottom: 'var(--space-6)', textAlign: 'center', maxWidth: '400px' }}>
        Load your activity.log file to visualize agent activity, phase progress, file impact, and requirements traceability.
      </p>
      <button
        onClick={onLoadFile}
        style={{
          padding: '12px 32px',
          borderRadius: 'var(--radius-lg)',
          border: 'none',
          backgroundColor: 'var(--accent-primary)',
          color: '#ffffff',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 'var(--space-3)',
        }}
      >
        Open File
      </button>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        or press Ctrl+O
      </span>
    </div>
  );
};
