/**
 * Log data store with React Context and useReducer.
 * DR-001: In-memory array indexed by log_seq for O(1) lookup.
 * DR-002: Derived data structures computed and cached.
 * DR-003: State reset on new file load.
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { LogEntry, FileMetadata, ParseStats } from '../types/log-entry';
import { LogIndices, buildIndices, updateIndicesIncremental, computeTimestampRange } from '../indexer/indexer';
import { parseLogContent, parseIncrementalContent } from '../parser/log-parser';

interface LogState {
  entries: LogEntry[];
  indices: LogIndices;
  metadata: FileMetadata;
  parseStats: ParseStats;
  selectedEntry: LogEntry | null;
}

type LogAction =
  | { type: 'LOAD_FILE'; content: string; fileName: string; filePath: string }
  | { type: 'APPEND_ENTRIES'; content: string; lastLogSeq: number }
  | { type: 'SELECT_ENTRY'; entry: LogEntry | null }
  | { type: 'RESET' };

const emptyIndices: LogIndices = {
  entryMap: new Map(),
  agentIndex: new Map(),
  phaseIndex: new Map(),
  workSeqIndex: new Map(),
  fileFrequencyMap: new Map(),
  requirementIndex: new Map(),
  parentChildMap: new Map(),
};

const initialState: LogState = {
  entries: [],
  indices: emptyIndices,
  metadata: {
    fileName: '',
    filePath: '',
    totalEntries: 0,
    skippedLines: 0,
    timestampRange: null,
  },
  parseStats: {
    parseTimeMs: 0,
    lastPollTime: null,
    consecutiveFailures: 0,
  },
  selectedEntry: null,
};

function logReducer(state: LogState, action: LogAction): LogState {
  switch (action.type) {
    case 'LOAD_FILE': {
      const result = parseLogContent(action.content);
      const indices = buildIndices(result.entries);
      const timestampRange = computeTimestampRange(result.entries);

      return {
        entries: result.entries,
        indices,
        metadata: {
          fileName: action.fileName,
          filePath: action.filePath,
          totalEntries: result.entries.length,
          skippedLines: result.skippedLines,
          timestampRange,
        },
        parseStats: {
          parseTimeMs: result.parseTimeMs,
          lastPollTime: null,
          consecutiveFailures: 0,
        },
        selectedEntry: null,
      };
    }

    case 'APPEND_ENTRIES': {
      const result = parseIncrementalContent(action.content, action.lastLogSeq);
      if (result.entries.length === 0) {
        return {
          ...state,
          parseStats: {
            ...state.parseStats,
            lastPollTime: new Date().toISOString(),
          },
        };
      }

      const newEntries = [...state.entries, ...result.entries];
      const newIndices = { ...state.indices };
      updateIndicesIncremental(newIndices, result.entries);
      const timestampRange = computeTimestampRange(newEntries);

      return {
        ...state,
        entries: newEntries,
        indices: newIndices,
        metadata: {
          ...state.metadata,
          totalEntries: newEntries.length,
          skippedLines: state.metadata.skippedLines + result.skippedLines,
          timestampRange,
        },
        parseStats: {
          parseTimeMs: result.parseTimeMs,
          lastPollTime: new Date().toISOString(),
          consecutiveFailures: 0,
        },
      };
    }

    case 'SELECT_ENTRY':
      return { ...state, selectedEntry: action.entry };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

interface LogContextValue {
  state: LogState;
  loadFile: (content: string, fileName: string, filePath: string) => void;
  appendEntries: (content: string) => void;
  selectEntry: (entry: LogEntry | null) => void;
  reset: () => void;
}

const LogContext = createContext<LogContextValue | null>(null);

export function LogProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(logReducer, initialState);

  const loadFile = useCallback(
    (content: string, fileName: string, filePath: string) => {
      dispatch({ type: 'LOAD_FILE', content, fileName, filePath });
    },
    []
  );

  const appendEntries = useCallback(
    (content: string) => {
      const lastEntry = state.entries[state.entries.length - 1];
      const lastLogSeq = lastEntry ? lastEntry.log_seq : 0;
      dispatch({ type: 'APPEND_ENTRIES', content, lastLogSeq });
    },
    [state.entries]
  );

  const selectEntry = useCallback((entry: LogEntry | null) => {
    dispatch({ type: 'SELECT_ENTRY', entry });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return (
    <LogContext.Provider value={{ state, loadFile, appendEntries, selectEntry, reset }}>
      {children}
    </LogContext.Provider>
  );
}

export function useLog(): LogContextValue {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLog must be used within a LogProvider');
  }
  return context;
}
