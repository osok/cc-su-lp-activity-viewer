/**
 * Keyboard shortcut handler.
 * FR-KBD-001 through FR-KBD-006.
 */

import { useEffect, useState, useCallback } from 'react';
import { ViewId } from '../config/constants';
import { useTheme } from '../store/ThemeContext';

interface KeyboardShortcutOptions {
  onViewChange: (view: ViewId) => void;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onLoadFile: () => void;
  onRefresh: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions) {
  const { toggleTheme } = useTheme();
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (e.key) {
        case '1':
          e.preventDefault();
          options.onViewChange('timeline');
          break;
        case '2':
          e.preventDefault();
          options.onViewChange('dashboard');
          break;
        case '3':
          e.preventDefault();
          options.onViewChange('heatmap');
          break;
        case '4':
          e.preventDefault();
          options.onViewChange('traceability');
          break;
        case 't':
        case 'T':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            toggleTheme();
          }
          break;
        case 'r':
        case 'R':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            options.onRefresh();
          }
          break;
        case 'f':
        case 'F':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            options.onToggleSidebar();
          }
          break;
        case 'o':
        case 'O':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            options.onLoadFile();
          }
          break;
        case '?':
          e.preventDefault();
          setShowHelp((prev) => !prev);
          break;
      }
    },
    [options, toggleTheme]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}

export const SHORTCUT_HELP = [
  { key: '1', description: 'Timeline view' },
  { key: '2', description: 'Dashboard view' },
  { key: '3', description: 'Heatmap view' },
  { key: '4', description: 'Traceability view' },
  { key: 'T', description: 'Toggle theme' },
  { key: 'R', description: 'Refresh / re-read file' },
  { key: 'F', description: 'Toggle filter sidebar' },
  { key: 'Ctrl+O', description: 'Open file' },
  { key: 'Escape', description: 'Close detail panel' },
  { key: '?', description: 'Show keyboard shortcuts' },
];
