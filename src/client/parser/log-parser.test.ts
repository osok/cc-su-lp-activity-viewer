/**
 * Unit tests for the log parser.
 * TS-001: Log Parser Unit Tests
 * TS-003: Requirement Range Expansion
 */

import { describe, it, expect } from 'vitest';
import {
  parseLine,
  parseLogContent,
  parseIncrementalContent,
  expandRequirementRange,
  expandAllRequirements,
} from './log-parser';

const validEntry = JSON.stringify({
  log_seq: 1,
  work_seq: '001',
  timestamp: '2026-02-05T00:00:00Z',
  agent: 'task-manager',
  action: 'START',
  phase: 'implementation',
  parent_log_seq: null,
  requirements: [],
  task_id: null,
  details: 'Test entry',
  files_created: [],
  files_modified: [],
  decisions: [],
  errors: [],
  duration_ms: null,
});

const minimalEntry = JSON.stringify({
  log_seq: 2,
  timestamp: '2026-02-05T00:01:00Z',
  agent: 'developer',
  action: 'COMPLETE',
});

describe('parseLine', () => {
  it('TS-001-01: should parse valid JSON with all fields', () => {
    const result = parseLine(validEntry);
    expect(result).not.toBeNull();
    expect(result!.log_seq).toBe(1);
    expect(result!.agent).toBe('task-manager');
    expect(result!.action).toBe('START');
    expect(result!.phase).toBe('implementation');
    expect(result!.requirements).toEqual([]);
  });

  it('TS-001-02: should parse entry with only required fields', () => {
    const result = parseLine(minimalEntry);
    expect(result).not.toBeNull();
    expect(result!.log_seq).toBe(2);
    expect(result!.agent).toBe('developer');
    expect(result!.requirements).toEqual([]);
    expect(result!.files_created).toEqual([]);
    expect(result!.duration_ms).toBeNull();
  });

  it('TS-001-03: should return null for malformed JSON', () => {
    expect(parseLine('not valid json')).toBeNull();
    expect(parseLine('{incomplete')).toBeNull();
  });

  it('TS-001-04: should return null when log_seq is missing', () => {
    const entry = JSON.stringify({ timestamp: 'x', agent: 'a', action: 'START' });
    expect(parseLine(entry)).toBeNull();
  });

  it('TS-001-05: should return null when agent is missing', () => {
    const entry = JSON.stringify({ log_seq: 1, timestamp: 'x', action: 'START' });
    expect(parseLine(entry)).toBeNull();
  });

  it('should return null for empty/whitespace lines', () => {
    expect(parseLine('')).toBeNull();
    expect(parseLine('   ')).toBeNull();
  });
});

describe('parseLogContent', () => {
  it('TS-001-06: should parse multiple lines', () => {
    const content = [validEntry, minimalEntry].join('\n');
    const result = parseLogContent(content);
    expect(result.entries).toHaveLength(2);
    expect(result.skippedLines).toBe(0);
  });

  it('TS-001-07: should handle empty file', () => {
    const result = parseLogContent('');
    expect(result.entries).toHaveLength(0);
    expect(result.skippedLines).toBe(0);
  });

  it('TS-001-08: should handle file with only malformed lines', () => {
    const content = 'bad line 1\nbad line 2\nbad line 3';
    const result = parseLogContent(content);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedLines).toBe(3);
  });

  it('TS-001-09: should handle mixed valid and invalid lines', () => {
    const content = [validEntry, 'bad line', minimalEntry].join('\n');
    const result = parseLogContent(content);
    expect(result.entries).toHaveLength(2);
    expect(result.skippedLines).toBe(1);
  });

  it('TS-001-10: should preserve entry order', () => {
    const content = [validEntry, minimalEntry].join('\n');
    const result = parseLogContent(content);
    expect(result.entries[0]!.log_seq).toBe(1);
    expect(result.entries[1]!.log_seq).toBe(2);
  });

  it('should track parse time', () => {
    const result = parseLogContent(validEntry);
    expect(result.parseTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('parseIncrementalContent', () => {
  it('should return only entries after lastLogSeq', () => {
    const entry3 = JSON.stringify({ ...JSON.parse(validEntry), log_seq: 3 });
    const content = [validEntry, minimalEntry, entry3].join('\n');
    const result = parseIncrementalContent(content, 2);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.log_seq).toBe(3);
  });

  it('should return empty array when no new entries', () => {
    const result = parseIncrementalContent(validEntry, 5);
    expect(result.entries).toHaveLength(0);
  });
});

describe('expandRequirementRange', () => {
  it('TS-003-01: should expand simple range', () => {
    const result = expandRequirementRange('REQ-CORE-FN-001 through REQ-CORE-FN-005');
    expect(result).toHaveLength(5);
    expect(result[0]).toBe('REQ-CORE-FN-001');
    expect(result[4]).toBe('REQ-CORE-FN-005');
  });

  it('TS-003-02: should return single ID as-is', () => {
    const result = expandRequirementRange('REQ-CORE-FN-001');
    expect(result).toEqual(['REQ-CORE-FN-001']);
  });

  it('TS-003-03: should expand large range', () => {
    const result = expandRequirementRange('REQ-CORE-FN-001 through REQ-CORE-FN-051');
    expect(result).toHaveLength(51);
  });

  it('should handle non-matching strings', () => {
    const result = expandRequirementRange('some random string');
    expect(result).toEqual(['some random string']);
  });
});

describe('expandAllRequirements', () => {
  it('TS-003-04: should handle mixed singles and ranges', () => {
    const input = ['REQ-CORE-FN-001', 'REQ-CORE-FN-010 through REQ-CORE-FN-012'];
    const result = expandAllRequirements(input);
    expect(result).toHaveLength(4);
    expect(result).toContain('REQ-CORE-FN-001');
    expect(result).toContain('REQ-CORE-FN-010');
    expect(result).toContain('REQ-CORE-FN-011');
    expect(result).toContain('REQ-CORE-FN-012');
  });
});
