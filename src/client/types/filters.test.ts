/**
 * Unit tests for filter types and utilities.
 * TS-004 partial: Filter state creation and query.
 */

import { describe, it, expect } from 'vitest';
import { createEmptyFilterState, isFilterActive } from './filters';

describe('createEmptyFilterState', () => {
  it('should create state with empty sets', () => {
    const state = createEmptyFilterState();
    expect(state.agents.size).toBe(0);
    expect(state.actions.size).toBe(0);
    expect(state.phases.size).toBe(0);
    expect(state.workSeqs.size).toBe(0);
    expect(state.fileFilter).toBeNull();
    expect(state.requirementFilter).toBeNull();
  });
});

describe('isFilterActive', () => {
  it('TS-004-05: should return false for empty filters', () => {
    expect(isFilterActive(createEmptyFilterState())).toBe(false);
  });

  it('should return true when agents filter is set', () => {
    const state = createEmptyFilterState();
    state.agents.add('developer');
    expect(isFilterActive(state)).toBe(true);
  });

  it('should return true when file filter is set', () => {
    const state = createEmptyFilterState();
    state.fileFilter = 'src/app.ts';
    expect(isFilterActive(state)).toBe(true);
  });
});
