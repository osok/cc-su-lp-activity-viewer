/**
 * Color-coded action type badge.
 * FR-ATL-003: Consistent color coding by action type.
 * UR-004: Includes text label, not just color.
 */

import React from 'react';
import { useTheme } from '../../store/ThemeContext';
import { ACTION_COLORS } from '../../config/constants';

interface ActionBadgeProps {
  action: string;
  size?: 'sm' | 'md';
}

export const ActionBadge: React.FC<ActionBadgeProps> = ({ action, size = 'md' }) => {
  const { theme } = useTheme();
  const colorConfig = ACTION_COLORS[action] ?? { light: '#6b7280', dark: '#9ca3af', label: action };
  const color = theme === 'dark' ? colorConfig.dark : colorConfig.light;

  const styles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: size === 'sm' ? '1px 6px' : '2px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: size === 'sm' ? '10px' : '11px',
    fontWeight: 600,
    color: color,
    backgroundColor: `${color}1a`,
    border: `1px solid ${color}40`,
    whiteSpace: 'nowrap',
  };

  return <span style={styles}>{colorConfig.label}</span>;
};
