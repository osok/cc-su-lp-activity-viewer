/**
 * File impact heatmap view.
 * FR-FIH-001: Aggregate files_created and files_modified.
 * FR-FIH-002: Treemap rendering with color intensity.
 * FR-FIH-003: Directory grouping.
 * FR-FIH-004: Churn indicator.
 * FR-FIH-005: Click to filter.
 * FR-FIH-006: Sort options.
 */

import React, { useMemo, useState } from 'react';
import { useLog } from '../../../store/LogContext';
import { useFilters } from '../../../store/FilterContext';
import { FileStats } from '../../../types/log-entry';

type SortMode = 'count' | 'path' | 'directory' | 'churn';

export const HeatmapView: React.FC = () => {
  const { state } = useLog();
  const { setFileFilter } = useFilters();
  const [sortMode, setSortMode] = useState<SortMode>('count');
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());

  const files = useMemo(() => {
    const allFiles = Array.from(state.indices.fileFrequencyMap.values());

    switch (sortMode) {
      case 'count':
        return allFiles.sort((a, b) => b.totalCount - a.totalCount);
      case 'path':
        return allFiles.sort((a, b) => a.path.localeCompare(b.path));
      case 'directory':
        return allFiles.sort((a, b) => a.directory.localeCompare(b.directory) || b.totalCount - a.totalCount);
      case 'churn':
        return allFiles.sort((a, b) => {
          if (a.isChurn !== b.isChurn) return a.isChurn ? -1 : 1;
          return b.totalCount - a.totalCount;
        });
      default:
        return allFiles;
    }
  }, [state.indices.fileFrequencyMap, sortMode]);

  const directories = useMemo(() => {
    const dirMap = new Map<string, FileStats[]>();
    for (const file of files) {
      const dir = file.directory || '/';
      if (!dirMap.has(dir)) dirMap.set(dir, []);
      dirMap.get(dir)!.push(file);
    }
    return Array.from(dirMap.entries()).sort(
      (a, b) => b[1].reduce((s, f) => s + f.totalCount, 0) - a[1].reduce((s, f) => s + f.totalCount, 0)
    );
  }, [files]);

  const maxCount = useMemo(() => Math.max(1, ...files.map((f) => f.totalCount)), [files]);

  const getHeatColor = (count: number): string => {
    const intensity = count / maxCount;
    if (intensity === 0) return 'var(--bg-tertiary)';
    if (intensity < 0.2) return 'var(--accent-primary)22';
    if (intensity < 0.4) return 'var(--accent-primary)44';
    if (intensity < 0.6) return 'var(--accent-primary)77';
    if (intensity < 0.8) return 'var(--accent-primary)aa';
    return 'var(--accent-primary)';
  };

  const toggleDir = (dir: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) {
        next.delete(dir);
      } else {
        next.add(dir);
      }
      return next;
    });
  };

  if (files.length === 0) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
        No file activity recorded in the log entries.
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>File Impact Heatmap</h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sort:</span>
          {(['count', 'path', 'directory', 'churn'] as SortMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              style={{
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-primary)',
                cursor: 'pointer',
                fontSize: '11px',
                backgroundColor: sortMode === mode ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                color: sortMode === mode ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
        {files.length} files across {directories.length} directories
      </div>

      {directories.map(([dir, dirFiles]) => {
        const isCollapsed = collapsedDirs.has(dir);
        const dirTotal = dirFiles.reduce((s, f) => s + f.totalCount, 0);
        const hasChurn = dirFiles.some((f) => f.isChurn);

        return (
          <div key={dir} style={{ marginBottom: 'var(--space-3)' }}>
            <button
              onClick={() => toggleDir(dir)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                textAlign: 'left',
              }}
            >
              <span>{isCollapsed ? '+' : '-'}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{dir}/</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                ({dirFiles.length} files, {dirTotal} changes)
              </span>
              {hasChurn && (
                <span style={{ fontSize: '10px', color: 'var(--warning-text)', fontWeight: 500 }}>
                  CHURN
                </span>
              )}
            </button>

            {!isCollapsed && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: 'var(--space-2) 0 0 var(--space-6)' }}>
                {dirFiles.map((file) => (
                  <div
                    key={file.path}
                    onClick={() => setFileFilter(file.path)}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: getHeatColor(file.totalCount),
                      border: file.isChurn ? '2px solid var(--warning-text)' : '1px solid var(--border-primary)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      position: 'relative',
                    }}
                    title={`${file.path}\nCreated: ${file.createCount}, Modified: ${file.modifyCount}\nAgents: ${Array.from(file.agents).join(', ')}${file.isChurn ? '\nChurn detected' : ''}`}
                  >
                    <div style={{ color: 'var(--text-primary)' }}>
                      {file.path.split('/').pop()}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {file.totalCount}x ({file.agents.size} agents)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
