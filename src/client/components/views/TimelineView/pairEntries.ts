/**
 * Entry pairing utility for Gantt chart duration bars.
 * REQ-003-FN-001: Pair START entries with terminal entries.
 * REQ-003-FN-003: Classify outcomes as success or failure.
 * REQ-003-FN-004: Identify orphan STARTs with no matching terminal.
 * REQ-003-FN-005: Classify non-START non-terminal entries as markers.
 */

import { LogEntry, ActionType } from '../../../types/log-entry';

/** Terminal action types that end a START. */
export const TERMINAL_ACTIONS: ReadonlySet<ActionType> = new Set([
  'COMPLETE', 'REVIEW_PASS', 'TEST_PASS',
  'REVIEW_FAIL', 'TEST_FAIL', 'ERROR',
]);

/** Success terminal actions (green bars). */
export const SUCCESS_TERMINALS: ReadonlySet<ActionType> = new Set([
  'COMPLETE', 'REVIEW_PASS', 'TEST_PASS',
]);

/** Failure terminal actions (red bars). */
export const FAILURE_TERMINALS: ReadonlySet<ActionType> = new Set([
  'REVIEW_FAIL', 'TEST_FAIL', 'ERROR',
]);

/** Non-START entries that are never terminals — rendered as small markers. */
export const MARKER_ACTIONS: ReadonlySet<ActionType> = new Set([
  'DECISION', 'FILE_CREATE', 'FILE_MODIFY',
  'BLOCKED', 'UNBLOCKED',
]);

/** A paired START->terminal duration bar. */
export interface DurationBar {
  startEntry: LogEntry;
  endEntry: LogEntry;
  outcome: 'success' | 'failure';
}

/** A START entry with no matching terminal. */
export interface OrphanStart {
  entry: LogEntry;
}

/** A non-START, non-terminal event (marker dot within or outside a bar). */
export interface MarkerEvent {
  entry: LogEntry;
  parentBar: DurationBar | null;
}

/** Complete result of pairing all entries. */
export interface PairingResult {
  bars: DurationBar[];
  orphans: OrphanStart[];
  markers: MarkerEvent[];
}

/**
 * Pair START entries with their matching terminal entries to produce duration bars.
 *
 * Algorithm:
 * 1. Separate entries into STARTs, terminals, and markers by action type.
 * 2. Group terminals by agent for efficient lookup.
 * 3. For each START, find the best matching terminal:
 *    - Primary: same agent + same task_id (when task_id is present on both)
 *    - Secondary: same agent + same phase + same parent_log_seq (when task_id absent)
 * 4. Unmatched STARTs become orphans.
 * 5. Non-START non-terminal entries become markers, linked to a parent bar if
 *    their timestamp falls within a bar's time span for the same agent.
 */
export function pairEntries(entries: LogEntry[]): PairingResult {
  const bars: DurationBar[] = [];
  const orphans: OrphanStart[] = [];
  const markers: MarkerEvent[] = [];

  const starts: LogEntry[] = [];
  const terminals: LogEntry[] = [];
  const markerEntries: LogEntry[] = [];

  // Step 1: Classify entries
  for (const entry of entries) {
    if (entry.action === 'START') {
      starts.push(entry);
    } else if (TERMINAL_ACTIONS.has(entry.action)) {
      terminals.push(entry);
    } else if (MARKER_ACTIONS.has(entry.action)) {
      markerEntries.push(entry);
    }
  }

  // Step 2: Group terminals by agent for efficient lookup
  const terminalsByAgent = new Map<string, LogEntry[]>();
  for (const t of terminals) {
    const list = terminalsByAgent.get(t.agent);
    if (list) {
      list.push(t);
    } else {
      terminalsByAgent.set(t.agent, [t]);
    }
  }

  // Track which terminal log_seqs have been consumed (one terminal per START)
  const consumedTerminals = new Set<number>();

  // Step 3: For each START, find matching terminal
  for (const start of starts) {
    const agentTerminals = terminalsByAgent.get(start.agent);
    if (!agentTerminals) {
      orphans.push({ entry: start });
      continue;
    }

    let matched: LogEntry | null = null;

    if (start.task_id) {
      // Primary match: same agent + same task_id, first by log_seq after START
      for (const t of agentTerminals) {
        if (consumedTerminals.has(t.log_seq)) continue;
        if (t.task_id === start.task_id && t.log_seq > start.log_seq) {
          matched = t;
          break;
        }
      }
    }

    if (!matched) {
      // Secondary match: same agent + same phase + same parent_log_seq
      for (const t of agentTerminals) {
        if (consumedTerminals.has(t.log_seq)) continue;
        if (
          t.phase === start.phase &&
          t.parent_log_seq === start.parent_log_seq &&
          t.log_seq > start.log_seq
        ) {
          matched = t;
          break;
        }
      }
    }

    if (matched) {
      consumedTerminals.add(matched.log_seq);
      const outcome = SUCCESS_TERMINALS.has(matched.action) ? 'success' : 'failure';
      bars.push({ startEntry: start, endEntry: matched, outcome });
    } else {
      orphans.push({ entry: start });
    }
  }

  // Step 4: Classify markers — link to parent bar if within bar's time range
  for (const m of markerEntries) {
    const mTime = new Date(m.timestamp).getTime();
    let parentBar: DurationBar | null = null;

    for (const bar of bars) {
      if (bar.startEntry.agent !== m.agent) continue;
      const barStart = new Date(bar.startEntry.timestamp).getTime();
      const barEnd = new Date(bar.endEntry.timestamp).getTime();
      if (mTime >= barStart && mTime <= barEnd) {
        parentBar = bar;
        break;
      }
    }

    markers.push({ entry: m, parentBar });
  }

  return { bars, orphans, markers };
}
