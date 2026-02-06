/**
 * Tests for pairEntries utility.
 * REQ-003-VER-001: START/COMPLETE pairs produce duration bars.
 * REQ-003-VER-002: Orphan START entries produce small indicator bars.
 * REQ-003-VER-003: Label toggle (tested via getBarLabel integration).
 * REQ-003-VER-004: Work sequence grouping (entries grouped by work_seq).
 */

import { describe, it, expect } from 'vitest';
import {
  pairEntries,
  TERMINAL_ACTIONS,
  SUCCESS_TERMINALS,
  FAILURE_TERMINALS,
  MARKER_ACTIONS,
} from './pairEntries';
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

describe('pairEntries', () => {
  it('TC-001: pairs START+COMPLETE for same agent and task_id', () => {
    const entries: LogEntry[] = [
      makeEntry({ log_seq: 1, agent: 'developer', action: 'START', task_id: 'T001', timestamp: '2026-01-01T00:00:00Z' }),
      makeEntry({ log_seq: 2, agent: 'developer', action: 'COMPLETE', task_id: 'T001', timestamp: '2026-01-01T00:10:00Z' }),
    ];

    const result = pairEntries(entries);

    expect(result.bars).toHaveLength(1);
    expect(result.bars[0]!.startEntry.log_seq).toBe(1);
    expect(result.bars[0]!.endEntry.log_seq).toBe(2);
    expect(result.bars[0]!.outcome).toBe('success');
    expect(result.orphans).toHaveLength(0);
  });

  it('TC-002: pairs START+COMPLETE by agent+phase+parent_log_seq when task_id absent', () => {
    const entries: LogEntry[] = [
      makeEntry({ log_seq: 1, agent: 'architect', action: 'START', task_id: null, phase: 'architecture', parent_log_seq: 10, timestamp: '2026-01-01T00:00:00Z' }),
      makeEntry({ log_seq: 2, agent: 'architect', action: 'COMPLETE', task_id: null, phase: 'architecture', parent_log_seq: 10, timestamp: '2026-01-01T00:05:00Z' }),
    ];

    const result = pairEntries(entries);

    expect(result.bars).toHaveLength(1);
    expect(result.bars[0]!.startEntry.log_seq).toBe(1);
    expect(result.bars[0]!.endEntry.log_seq).toBe(2);
  });

  it('TC-003: does not cross-match across different agents', () => {
    const entries: LogEntry[] = [
      makeEntry({ log_seq: 1, agent: 'developer', action: 'START', task_id: 'T001', timestamp: '2026-01-01T00:00:00Z' }),
      makeEntry({ log_seq: 2, agent: 'test-coder', action: 'COMPLETE', task_id: 'T001', timestamp: '2026-01-01T00:10:00Z' }),
    ];

    const result = pairEntries(entries);

    expect(result.bars).toHaveLength(0);
    expect(result.orphans).toHaveLength(1);
    expect(result.orphans[0]!.entry.log_seq).toBe(1);
  });

  it('TC-004: classifies COMPLETE/REVIEW_PASS/TEST_PASS as success outcome', () => {
    const successActions = ['COMPLETE', 'REVIEW_PASS', 'TEST_PASS'] as const;

    for (const action of successActions) {
      const entries: LogEntry[] = [
        makeEntry({ log_seq: 1, agent: 'dev', action: 'START', phase: 'impl', parent_log_seq: 0, timestamp: '2026-01-01T00:00:00Z' }),
        makeEntry({ log_seq: 2, agent: 'dev', action, phase: 'impl', parent_log_seq: 0, timestamp: '2026-01-01T00:10:00Z' }),
      ];

      const result = pairEntries(entries);
      expect(result.bars).toHaveLength(1);
      expect(result.bars[0]!.outcome).toBe('success');
    }
  });

  it('TC-005: classifies REVIEW_FAIL/TEST_FAIL/ERROR as failure outcome', () => {
    const failActions = ['REVIEW_FAIL', 'TEST_FAIL', 'ERROR'] as const;

    for (const action of failActions) {
      const entries: LogEntry[] = [
        makeEntry({ log_seq: 1, agent: 'dev', action: 'START', phase: 'impl', parent_log_seq: 0, timestamp: '2026-01-01T00:00:00Z' }),
        makeEntry({ log_seq: 2, agent: 'dev', action, phase: 'impl', parent_log_seq: 0, timestamp: '2026-01-01T00:10:00Z' }),
      ];

      const result = pairEntries(entries);
      expect(result.bars).toHaveLength(1);
      expect(result.bars[0]!.outcome).toBe('failure');
    }
  });

  it('TC-006: orphan START (no matching terminal) produces OrphanStart', () => {
    const entries: LogEntry[] = [
      makeEntry({ log_seq: 1, agent: 'developer', action: 'START', task_id: 'T001', timestamp: '2026-01-01T00:00:00Z' }),
    ];

    const result = pairEntries(entries);

    expect(result.bars).toHaveLength(0);
    expect(result.orphans).toHaveLength(1);
    expect(result.orphans[0]!.entry.log_seq).toBe(1);
  });

  it('TC-007: DECISION/FILE_CREATE entries classified as markers', () => {
    const entries: LogEntry[] = [
      makeEntry({ log_seq: 1, agent: 'developer', action: 'DECISION', timestamp: '2026-01-01T00:05:00Z' }),
      makeEntry({ log_seq: 2, agent: 'developer', action: 'FILE_CREATE', timestamp: '2026-01-01T00:06:00Z' }),
      makeEntry({ log_seq: 3, agent: 'developer', action: 'FILE_MODIFY', timestamp: '2026-01-01T00:07:00Z' }),
      makeEntry({ log_seq: 4, agent: 'developer', action: 'BLOCKED', timestamp: '2026-01-01T00:08:00Z' }),
      makeEntry({ log_seq: 5, agent: 'developer', action: 'UNBLOCKED', timestamp: '2026-01-01T00:09:00Z' }),
    ];

    const result = pairEntries(entries);

    expect(result.bars).toHaveLength(0);
    expect(result.orphans).toHaveLength(0);
    expect(result.markers).toHaveLength(5);
  });

  it('TC-008: marker within a bar time range gets parentBar reference', () => {
    const entries: LogEntry[] = [
      makeEntry({ log_seq: 1, agent: 'developer', action: 'START', task_id: 'T001', timestamp: '2026-01-01T00:00:00Z' }),
      makeEntry({ log_seq: 2, agent: 'developer', action: 'FILE_CREATE', timestamp: '2026-01-01T00:05:00Z' }),
      makeEntry({ log_seq: 3, agent: 'developer', action: 'COMPLETE', task_id: 'T001', timestamp: '2026-01-01T00:10:00Z' }),
    ];

    const result = pairEntries(entries);

    expect(result.bars).toHaveLength(1);
    expect(result.markers).toHaveLength(1);
    expect(result.markers[0]!.parentBar).not.toBeNull();
    expect(result.markers[0]!.parentBar!.startEntry.log_seq).toBe(1);
  });

  it('TC-009: standalone marker (no parent bar) has null parentBar', () => {
    const entries: LogEntry[] = [
      makeEntry({ log_seq: 1, agent: 'developer', action: 'DECISION', timestamp: '2026-01-01T00:05:00Z' }),
    ];

    const result = pairEntries(entries);

    expect(result.markers).toHaveLength(1);
    expect(result.markers[0]!.parentBar).toBeNull();
  });

  it('TC-010: terminal can only be consumed once (first matching START gets it)', () => {
    const entries: LogEntry[] = [
      makeEntry({ log_seq: 1, agent: 'developer', action: 'START', phase: 'impl', parent_log_seq: 0, timestamp: '2026-01-01T00:00:00Z' }),
      makeEntry({ log_seq: 2, agent: 'developer', action: 'START', phase: 'impl', parent_log_seq: 0, timestamp: '2026-01-01T00:01:00Z' }),
      makeEntry({ log_seq: 3, agent: 'developer', action: 'COMPLETE', phase: 'impl', parent_log_seq: 0, timestamp: '2026-01-01T00:10:00Z' }),
    ];

    const result = pairEntries(entries);

    // First START should consume the COMPLETE, second START becomes orphan
    expect(result.bars).toHaveLength(1);
    expect(result.bars[0]!.startEntry.log_seq).toBe(1);
    expect(result.orphans).toHaveLength(1);
    expect(result.orphans[0]!.entry.log_seq).toBe(2);
  });

  it('TC-011: multiple START/COMPLETE pairs for same agent produce multiple bars', () => {
    const entries: LogEntry[] = [
      makeEntry({ log_seq: 1, agent: 'developer', action: 'START', task_id: 'T001', timestamp: '2026-01-01T00:00:00Z' }),
      makeEntry({ log_seq: 2, agent: 'developer', action: 'COMPLETE', task_id: 'T001', timestamp: '2026-01-01T00:05:00Z' }),
      makeEntry({ log_seq: 3, agent: 'developer', action: 'START', task_id: 'T002', timestamp: '2026-01-01T00:10:00Z' }),
      makeEntry({ log_seq: 4, agent: 'developer', action: 'COMPLETE', task_id: 'T002', timestamp: '2026-01-01T00:15:00Z' }),
    ];

    const result = pairEntries(entries);

    expect(result.bars).toHaveLength(2);
    expect(result.bars[0]!.startEntry.task_id).toBe('T001');
    expect(result.bars[1]!.startEntry.task_id).toBe('T002');
    expect(result.orphans).toHaveLength(0);
  });

  it('TC-012: performance - 500 entries pair within 50ms', () => {
    const entries: LogEntry[] = [];
    for (let i = 0; i < 250; i++) {
      const startSeq = i * 2 + 1;
      const endSeq = i * 2 + 2;
      const startTime = new Date(2026, 0, 1, 0, i).toISOString();
      const endTime = new Date(2026, 0, 1, 0, i, 30).toISOString();
      entries.push(
        makeEntry({ log_seq: startSeq, agent: `agent-${i % 10}`, action: 'START', task_id: `T${i}`, timestamp: startTime }),
        makeEntry({ log_seq: endSeq, agent: `agent-${i % 10}`, action: 'COMPLETE', task_id: `T${i}`, timestamp: endTime }),
      );
    }

    const start = performance.now();
    const result = pairEntries(entries);
    const elapsed = performance.now() - start;

    expect(result.bars).toHaveLength(250);
    expect(result.orphans).toHaveLength(0);
    expect(elapsed).toBeLessThan(50);
  });
});

describe('Action type sets', () => {
  it('TERMINAL_ACTIONS contains exactly 6 terminal types', () => {
    expect(TERMINAL_ACTIONS.size).toBe(6);
    expect(TERMINAL_ACTIONS.has('COMPLETE')).toBe(true);
    expect(TERMINAL_ACTIONS.has('ERROR')).toBe(true);
  });

  it('SUCCESS_TERMINALS and FAILURE_TERMINALS partition TERMINAL_ACTIONS', () => {
    const combined = new Set([...SUCCESS_TERMINALS, ...FAILURE_TERMINALS]);
    expect(combined.size).toBe(TERMINAL_ACTIONS.size);
    for (const action of TERMINAL_ACTIONS) {
      expect(combined.has(action)).toBe(true);
    }
  });

  it('MARKER_ACTIONS contains non-terminal non-START actions', () => {
    expect(MARKER_ACTIONS.size).toBe(5);
    expect(MARKER_ACTIONS.has('DECISION')).toBe(true);
    expect(MARKER_ACTIONS.has('FILE_CREATE')).toBe(true);
    expect(MARKER_ACTIONS.has('START')).toBe(false);
  });
});
