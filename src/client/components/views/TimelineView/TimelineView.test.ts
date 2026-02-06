/**
 * Tests for buildConnectionPaths (updated for task-per-row Y positions).
 * REQ-004-FN-023..024: Connection lines use yScale(logSeq) for task-per-row layout.
 */

import { describe, it, expect } from 'vitest';
import { buildConnectionPaths } from './TimelineView';
import { LogEntry } from '../../../types/log-entry';

function makeEntry(overrides: Partial<LogEntry>): LogEntry {
  return {
    log_seq: 1,
    work_seq: '001',
    timestamp: '2026-01-01T00:00:00Z',
    agent: 'developer',
    action: 'START',
    phase: 'implementation',
    parent_log_seq: null,
    requirements: [],
    task_id: null,
    details: '',
    files_created: [],
    files_modified: [],
    decisions: [],
    errors: [],
    duration_ms: null,
    ...overrides,
  };
}

/** Simple xScale: maps dates to pixel positions. */
function makeXScale(): (d: Date) => number {
  const start = new Date('2026-01-01T00:00:00Z').getTime();
  const end = new Date('2026-01-01T01:00:00Z').getTime();
  return (d: Date) => {
    const t = d.getTime();
    return 0 + ((t - start) / (end - start)) * 620;
  };
}

/** Simple yScale: maps logSeq -> y position (task-per-row). */
function makeYScale(logSeqToY: Record<number, number>): (logSeq: number) => number | undefined {
  return (logSeq: number) => logSeqToY[logSeq];
}

describe('buildConnectionPaths', () => {
  it('TC-013: connection from parent bar right edge to child bar left edge', () => {
    const parent = makeEntry({ log_seq: 1, agent: 'task-manager', timestamp: '2026-01-01T00:10:00Z', work_seq: '001' });
    const child = makeEntry({ log_seq: 2, agent: 'task-manager', timestamp: '2026-01-01T00:20:00Z', parent_log_seq: 1, work_seq: '001' });

    const entryMap = new Map<number, LogEntry>([[1, parent], [2, child]]);
    const parentChildMap = new Map<number, number[]>([[1, [2]]]);
    const filteredSeqs = new Set([1, 2]);
    const xScale = makeXScale();
    const yScale = makeYScale({ 1: 64, 2: 100 });

    // barLookup: parent bar from x=100, width=50; child bar at x=200
    const barLookup = new Map<number, { x: number; width: number; y: number }>([
      [1, { x: 100, width: 50, y: 68 }],
      [2, { x: 200, width: 40, y: 104 }],
    ]);

    const paths = buildConnectionPaths(parentChildMap, entryMap, filteredSeqs, barLookup, xScale, yScale);

    expect(paths).toHaveLength(1);
    expect(paths[0]!.parentSeq).toBe(1);
    expect(paths[0]!.childSeq).toBe(2);

    // Parent right edge: 100 + 50 = 150; child left edge: 200
    // Path should start at M 150 ... and end H 200
    const pathStr = paths[0]!.path;
    expect(pathStr).toContain('M 150');
    expect(pathStr).toContain('H 200');
  });

  it('TC-014: cross-row connection produces different Y coordinates', () => {
    const parent = makeEntry({ log_seq: 1, agent: 'task-manager', timestamp: '2026-01-01T00:10:00Z', work_seq: '001' });
    const child = makeEntry({ log_seq: 2, agent: 'developer', timestamp: '2026-01-01T00:20:00Z', parent_log_seq: 1, work_seq: '001' });

    const entryMap = new Map<number, LogEntry>([[1, parent], [2, child]]);
    const parentChildMap = new Map<number, number[]>([[1, [2]]]);
    const filteredSeqs = new Set([1, 2]);
    const xScale = makeXScale();
    const yScale = makeYScale({ 1: 100, 2: 64 });

    const barLookup = new Map<number, { x: number; width: number; y: number }>([
      [1, { x: 100, width: 50, y: 104 }], // row 1
      [2, { x: 200, width: 40, y: 68 }],  // row 0
    ]);

    const paths = buildConnectionPaths(parentChildMap, entryMap, filteredSeqs, barLookup, xScale, yScale);

    expect(paths).toHaveLength(1);

    // Parse Y values from path: M parentX parentY H midX V childY H childX
    const pathStr = paths[0]!.path;
    const numbers = pathStr.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const parentY = numbers[1]; // Second number
    const childY = numbers[4];  // Fifth number (after V)
    expect(parentY).not.toBe(childY);
  });

  it('TC-015: returns empty for entries with no parent-child relationships', () => {
    const entry = makeEntry({ log_seq: 1, agent: 'developer', work_seq: '001' });

    const entryMap = new Map<number, LogEntry>([[1, entry]]);
    const parentChildMap = new Map<number, number[]>();
    const filteredSeqs = new Set([1]);
    const xScale = makeXScale();
    const yScale = makeYScale({ 1: 64 });
    const barLookup = new Map<number, { x: number; width: number; y: number }>();

    const paths = buildConnectionPaths(parentChildMap, entryMap, filteredSeqs, barLookup, xScale, yScale);
    expect(paths).toEqual([]);
  });

  it('TC-016: orthogonal path uses M, H, V, H commands only', () => {
    const parent = makeEntry({ log_seq: 1, agent: 'task-manager', timestamp: '2026-01-01T00:05:00Z', work_seq: '001' });
    const child = makeEntry({ log_seq: 2, agent: 'developer', timestamp: '2026-01-01T00:15:00Z', parent_log_seq: 1, work_seq: '001' });

    const entryMap = new Map<number, LogEntry>([[1, parent], [2, child]]);
    const parentChildMap = new Map<number, number[]>([[1, [2]]]);
    const filteredSeqs = new Set([1, 2]);
    const xScale = makeXScale();
    const yScale = makeYScale({ 1: 100, 2: 64 });

    const barLookup = new Map<number, { x: number; width: number; y: number }>([
      [1, { x: 80, width: 60, y: 104 }],
      [2, { x: 180, width: 40, y: 68 }],
    ]);

    const paths = buildConnectionPaths(parentChildMap, entryMap, filteredSeqs, barLookup, xScale, yScale);
    const pathStr = paths[0]!.path;

    expect(pathStr).toMatch(/^M\s/);
    expect(pathStr).not.toMatch(/[LCQA]/);
    expect(pathStr.match(/H/g)).toHaveLength(2);
    expect(pathStr.match(/V/g)).toHaveLength(1);
  });

  it('TC-017: skips connections where parent is not in filtered set', () => {
    const parent = makeEntry({ log_seq: 1, agent: 'task-manager', timestamp: '2026-01-01T00:05:00Z', work_seq: '001' });
    const child = makeEntry({ log_seq: 2, agent: 'developer', timestamp: '2026-01-01T00:15:00Z', parent_log_seq: 1, work_seq: '001' });

    const entryMap = new Map<number, LogEntry>([[1, parent], [2, child]]);
    const parentChildMap = new Map<number, number[]>([[1, [2]]]);
    const filteredSeqs = new Set([2]); // parent filtered out
    const xScale = makeXScale();
    const yScale = makeYScale({ 1: 64, 2: 100 });
    const barLookup = new Map<number, { x: number; width: number; y: number }>();

    const paths = buildConnectionPaths(parentChildMap, entryMap, filteredSeqs, barLookup, xScale, yScale);
    expect(paths).toEqual([]);
  });

  it('TC-018: parent with multiple children produces multiple paths', () => {
    const parent = makeEntry({ log_seq: 1, agent: 'task-manager', timestamp: '2026-01-01T00:05:00Z', work_seq: '001' });
    const child1 = makeEntry({ log_seq: 2, agent: 'developer', timestamp: '2026-01-01T00:10:00Z', parent_log_seq: 1, work_seq: '001' });
    const child2 = makeEntry({ log_seq: 3, agent: 'test-coder', timestamp: '2026-01-01T00:15:00Z', parent_log_seq: 1, work_seq: '001' });

    const entryMap = new Map<number, LogEntry>([[1, parent], [2, child1], [3, child2]]);
    const parentChildMap = new Map<number, number[]>([[1, [2, 3]]]);
    const filteredSeqs = new Set([1, 2, 3]);
    const xScale = makeXScale();
    const yScale = makeYScale({ 1: 100, 2: 64, 3: 136 });

    const barLookup = new Map<number, { x: number; width: number; y: number }>([
      [1, { x: 80, width: 60, y: 104 }],
      [2, { x: 150, width: 40, y: 68 }],
      [3, { x: 200, width: 30, y: 140 }],
    ]);

    const paths = buildConnectionPaths(parentChildMap, entryMap, filteredSeqs, barLookup, xScale, yScale);
    expect(paths).toHaveLength(2);
    expect(paths[0]!.parentSeq).toBe(1);
    expect(paths[0]!.childSeq).toBe(2);
    expect(paths[1]!.parentSeq).toBe(1);
    expect(paths[1]!.childSeq).toBe(3);
  });
});
