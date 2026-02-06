/**
 * Unit tests for the indexer.
 * TS-002: Indexer Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { buildIndices, updateIndicesIncremental, computeTimestampRange } from './indexer';
import { LogEntry } from '../types/log-entry';

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    log_seq: 1,
    work_seq: '001',
    timestamp: '2026-02-05T00:00:00Z',
    agent: 'task-manager',
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

describe('buildIndices', () => {
  it('TS-002-01: should build agent index', () => {
    const entries = [
      makeEntry({ log_seq: 1, agent: 'task-manager' }),
      makeEntry({ log_seq: 2, agent: 'developer' }),
      makeEntry({ log_seq: 3, agent: 'developer' }),
      makeEntry({ log_seq: 4, agent: 'tester' }),
    ];
    const indices = buildIndices(entries);
    expect(indices.agentIndex.size).toBe(3);
    expect(indices.agentIndex.get('developer')).toHaveLength(2);
  });

  it('TS-002-02: should build phase index', () => {
    const entries = [
      makeEntry({ log_seq: 1, phase: 'implementation' }),
      makeEntry({ log_seq: 2, phase: 'review' }),
      makeEntry({ log_seq: 3, phase: 'implementation' }),
    ];
    const indices = buildIndices(entries);
    expect(indices.phaseIndex.size).toBe(2);
    expect(indices.phaseIndex.get('implementation')).toHaveLength(2);
  });

  it('TS-002-03: should build work_seq index', () => {
    const entries = [
      makeEntry({ log_seq: 1, work_seq: '001' }),
      makeEntry({ log_seq: 2, work_seq: '002' }),
    ];
    const indices = buildIndices(entries);
    expect(indices.workSeqIndex.size).toBe(2);
  });

  it('TS-002-04: should build file frequency map', () => {
    const entries = [
      makeEntry({ log_seq: 1, agent: 'dev1', files_created: ['src/a.ts'], files_modified: [] }),
      makeEntry({ log_seq: 2, agent: 'dev2', files_modified: ['src/a.ts'] }),
    ];
    const indices = buildIndices(entries);
    const stats = indices.fileFrequencyMap.get('src/a.ts');
    expect(stats).toBeDefined();
    expect(stats!.createCount).toBe(1);
    expect(stats!.modifyCount).toBe(1);
    expect(stats!.totalCount).toBe(2);
  });

  it('TS-002-05: should detect churn files', () => {
    const entries = [
      makeEntry({ log_seq: 1, files_created: ['src/a.ts'] }),
      makeEntry({ log_seq: 2, files_modified: ['src/a.ts'] }),
    ];
    const indices = buildIndices(entries);
    expect(indices.fileFrequencyMap.get('src/a.ts')!.isChurn).toBe(true);
  });

  it('TS-002-06: should build requirement index', () => {
    const entries = [
      makeEntry({ log_seq: 1, requirements: ['REQ-001-FN-001'], phase: 'implementation', action: 'COMPLETE' }),
    ];
    const indices = buildIndices(entries);
    expect(indices.requirementIndex.has('REQ-001-FN-001')).toBe(true);
    expect(indices.requirementIndex.get('REQ-001-FN-001')).toHaveLength(1);
  });

  it('TS-002-07: should build parent-child map', () => {
    const entries = [
      makeEntry({ log_seq: 1 }),
      makeEntry({ log_seq: 2, parent_log_seq: 1 }),
      makeEntry({ log_seq: 3, parent_log_seq: 1 }),
    ];
    const indices = buildIndices(entries);
    expect(indices.parentChildMap.get(1)).toEqual([2, 3]);
  });

  it('TS-002-08: should build entry map for O(1) lookup', () => {
    const entries = [
      makeEntry({ log_seq: 42 }),
    ];
    const indices = buildIndices(entries);
    expect(indices.entryMap.get(42)).toBeDefined();
    expect(indices.entryMap.get(42)!.log_seq).toBe(42);
  });

  it('TS-002-10: should handle empty entries', () => {
    const indices = buildIndices([]);
    expect(indices.agentIndex.size).toBe(0);
    expect(indices.phaseIndex.size).toBe(0);
    expect(indices.entryMap.size).toBe(0);
  });
});

describe('updateIndicesIncremental', () => {
  it('TS-002-09: should update indices without rebuilding', () => {
    const entries = [makeEntry({ log_seq: 1, agent: 'dev' })];
    const indices = buildIndices(entries);
    expect(indices.agentIndex.get('dev')).toHaveLength(1);

    const newEntries = [makeEntry({ log_seq: 2, agent: 'dev' })];
    updateIndicesIncremental(indices, newEntries);
    expect(indices.agentIndex.get('dev')).toHaveLength(2);
    expect(indices.entryMap.get(2)).toBeDefined();
  });
});

describe('computeTimestampRange', () => {
  it('should return null for empty entries', () => {
    expect(computeTimestampRange([])).toBeNull();
  });

  it('should compute min/max timestamps', () => {
    const entries = [
      makeEntry({ timestamp: '2026-02-05T00:00:00Z' }),
      makeEntry({ timestamp: '2026-02-05T12:00:00Z' }),
      makeEntry({ timestamp: '2026-02-05T06:00:00Z' }),
    ];
    const range = computeTimestampRange(entries);
    expect(range!.earliest).toBe('2026-02-05T00:00:00Z');
    expect(range!.latest).toBe('2026-02-05T12:00:00Z');
  });
});
