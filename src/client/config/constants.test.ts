/**
 * Tests for CANONICAL_PHASE_ORDER and sortPhases.
 * REQ-002-VER-002: Phase columns appear in canonical order.
 */

import { describe, it, expect } from 'vitest';
import { CANONICAL_PHASE_ORDER, sortPhases } from './constants';

describe('CANONICAL_PHASE_ORDER', () => {
  it('TC-005: has exactly 9 phases', () => {
    expect(CANONICAL_PHASE_ORDER).toHaveLength(9);
  });

  it('contains all expected workflow phases', () => {
    expect(CANONICAL_PHASE_ORDER).toEqual([
      'requirements',
      'architecture',
      'design',
      'planning',
      'implementation',
      'review',
      'testing',
      'documentation',
      'deployment',
    ]);
  });
});

describe('sortPhases', () => {
  it('TC-001: returns known phases in canonical order', () => {
    const input = ['testing', 'design', 'requirements', 'implementation', 'review'];
    const result = sortPhases(input);
    expect(result).toEqual([
      'requirements',
      'design',
      'implementation',
      'review',
      'testing',
    ]);
  });

  it('TC-002: places unknown phases after known phases, sorted alphabetically', () => {
    const input = ['custom-phase', 'implementation', 'alpha-phase', 'design'];
    const result = sortPhases(input);
    expect(result).toEqual([
      'design',
      'implementation',
      'alpha-phase',
      'custom-phase',
    ]);
  });

  it('TC-003: handles empty array', () => {
    expect(sortPhases([])).toEqual([]);
  });

  it('TC-004: handles array with only unknown phases', () => {
    const input = ['zebra', 'alpha', 'middle'];
    const result = sortPhases(input);
    expect(result).toEqual(['alpha', 'middle', 'zebra']);
  });

  it('does not mutate the input array', () => {
    const input = ['testing', 'design'];
    const copy = [...input];
    sortPhases(input);
    expect(input).toEqual(copy);
  });

  it('handles all 9 canonical phases in random order', () => {
    const shuffled = [
      'deployment',
      'testing',
      'architecture',
      'implementation',
      'documentation',
      'planning',
      'requirements',
      'review',
      'design',
    ];
    const result = sortPhases(shuffled);
    expect(result).toEqual([...CANONICAL_PHASE_ORDER]);
  });
});
