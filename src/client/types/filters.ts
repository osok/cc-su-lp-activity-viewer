/**
 * Filter state types for the Activity Log Viewer.
 */

export interface FilterState {
  agents: Set<string>;
  actions: Set<string>;
  phases: Set<string>;
  workSeqs: Set<string>;
  fileFilter: string | null;
  requirementFilter: string | null;
}

export type FilterDimension = 'agents' | 'actions' | 'phases' | 'workSeqs';

export type FilterAction =
  | { type: 'SET_FILTER'; dimension: FilterDimension; values: Set<string> }
  | { type: 'TOGGLE_FILTER_VALUE'; dimension: FilterDimension; value: string }
  | { type: 'CLEAR_FILTER'; dimension: FilterDimension }
  | { type: 'SET_FILE_FILTER'; file: string | null }
  | { type: 'SET_REQUIREMENT_FILTER'; requirement: string | null }
  | { type: 'CLEAR_ALL' };

export function createEmptyFilterState(): FilterState {
  return {
    agents: new Set(),
    actions: new Set(),
    phases: new Set(),
    workSeqs: new Set(),
    fileFilter: null,
    requirementFilter: null,
  };
}

export function isFilterActive(state: FilterState): boolean {
  return (
    state.agents.size > 0 ||
    state.actions.size > 0 ||
    state.phases.size > 0 ||
    state.workSeqs.size > 0 ||
    state.fileFilter !== null ||
    state.requirementFilter !== null
  );
}
