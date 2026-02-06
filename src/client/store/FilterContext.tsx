/**
 * Filter state management with React Context.
 * FR-FLT-006: AND across dimensions, OR within dimensions.
 * FR-FLT-007: Filters persist across view switches.
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { LogEntry } from '../types/log-entry';
import {
  FilterState,
  FilterAction,
  FilterDimension,
  createEmptyFilterState,
  isFilterActive,
} from '../types/filters';

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_FILTER':
      return { ...state, [action.dimension]: new Set(action.values) };

    case 'TOGGLE_FILTER_VALUE': {
      const current = new Set(state[action.dimension]);
      if (current.has(action.value)) {
        current.delete(action.value);
      } else {
        current.add(action.value);
      }
      return { ...state, [action.dimension]: current };
    }

    case 'CLEAR_FILTER':
      return { ...state, [action.dimension]: new Set<string>() };

    case 'SET_FILE_FILTER':
      return { ...state, fileFilter: action.file };

    case 'SET_REQUIREMENT_FILTER':
      return { ...state, requirementFilter: action.requirement };

    case 'CLEAR_ALL':
      return createEmptyFilterState();

    default:
      return state;
  }
}

function matchesFilter(entry: LogEntry, filters: FilterState): boolean {
  if (filters.agents.size > 0 && !filters.agents.has(entry.agent)) {
    return false;
  }
  if (filters.actions.size > 0 && !filters.actions.has(entry.action)) {
    return false;
  }
  if (filters.phases.size > 0 && !filters.phases.has(entry.phase)) {
    return false;
  }
  if (filters.workSeqs.size > 0 && !filters.workSeqs.has(entry.work_seq)) {
    return false;
  }
  if (filters.fileFilter) {
    const file = filters.fileFilter;
    const hasFile =
      entry.files_created.includes(file) ||
      entry.files_modified.includes(file);
    if (!hasFile) return false;
  }
  if (filters.requirementFilter) {
    const req = filters.requirementFilter;
    if (!entry.requirements.includes(req)) return false;
  }
  return true;
}

interface FilterContextValue {
  filters: FilterState;
  isActive: boolean;
  setFilter: (dimension: FilterDimension, values: Set<string>) => void;
  toggleFilterValue: (dimension: FilterDimension, value: string) => void;
  clearFilter: (dimension: FilterDimension) => void;
  setFileFilter: (file: string | null) => void;
  setRequirementFilter: (requirement: string | null) => void;
  clearAll: () => void;
  applyFilters: (entries: LogEntry[]) => LogEntry[];
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, dispatch] = useReducer(filterReducer, createEmptyFilterState());

  const isActive = useMemo(() => isFilterActive(filters), [filters]);

  const setFilter = useCallback(
    (dimension: FilterDimension, values: Set<string>) => {
      dispatch({ type: 'SET_FILTER', dimension, values });
    },
    []
  );

  const toggleFilterValue = useCallback(
    (dimension: FilterDimension, value: string) => {
      dispatch({ type: 'TOGGLE_FILTER_VALUE', dimension, value });
    },
    []
  );

  const clearFilter = useCallback((dimension: FilterDimension) => {
    dispatch({ type: 'CLEAR_FILTER', dimension });
  }, []);

  const setFileFilter = useCallback((file: string | null) => {
    dispatch({ type: 'SET_FILE_FILTER', file });
  }, []);

  const setRequirementFilter = useCallback((requirement: string | null) => {
    dispatch({ type: 'SET_REQUIREMENT_FILTER', requirement });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const applyFilters = useCallback(
    (entries: LogEntry[]) => {
      if (!isFilterActive(filters)) return entries;
      return entries.filter((entry) => matchesFilter(entry, filters));
    },
    [filters]
  );

  return (
    <FilterContext.Provider
      value={{
        filters,
        isActive,
        setFilter,
        toggleFilterValue,
        clearFilter,
        setFileFilter,
        setRequirementFilter,
        clearAll,
        applyFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
