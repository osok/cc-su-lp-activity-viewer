/**
 * Active filter chip with remove button.
 * FR-FLT-008: Display active filters as removable chips.
 */

import React from 'react';

interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, value, onRemove }) => {
  const styles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: '12px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-primary)',
  };

  const buttonStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    fontSize: '14px',
    lineHeight: 1,
    padding: 0,
  };

  return (
    <span style={styles}>
      <span style={{ fontWeight: 500 }}>{label}:</span> {value}
      <button
        style={buttonStyles}
        onClick={onRemove}
        aria-label={`Remove ${label} filter: ${value}`}
      >
        x
      </button>
    </span>
  );
};
