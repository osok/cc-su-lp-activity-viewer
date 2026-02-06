/**
 * Phase progress dashboard view.
 * FR-PPD-001: Phase pipeline visualization.
 * FR-PPD-002: Per-phase statistics.
 * FR-PPD-003: Per-work-sequence breakdown.
 * FR-PPD-004: Active agent summary.
 * FR-PPD-005: Error badge count.
 * FR-PPD-006: Decision log.
 */

import React, { useMemo, useState } from 'react';
import { useLog } from '../../../store/LogContext';
import { useFilters } from '../../../store/FilterContext';
import { ActionBadge } from '../../shared/ActionBadge';
import { LogEntry } from '../../../types/log-entry';
import { sortPhases } from '../../../config/constants';

export interface PhaseStats {
  name: string;
  total: number;
  completed: number;
  inProgress: number;
  failures: number;
  errors: number;
  percentage: number;
}

const TERMINAL_ACTIONS = new Set(['COMPLETE', 'REVIEW_PASS', 'TEST_PASS']);
const FAILURE_ACTIONS = new Set(['REVIEW_FAIL', 'TEST_FAIL', 'ERROR']);

/**
 * Compute phase statistics using unique work-unit grouping.
 * REQ-002-FN-011: percentage = done / total unique work units * 100
 * REQ-002-FN-012: percentage clamped to 100
 * REQ-002-FN-013: total = unique work units with START
 * REQ-002-FN-014: done = unique work units whose latest action is terminal
 * REQ-002-FN-015: failed = unique work units whose latest action is failure/error
 * REQ-002-FN-016: active = total - done - failed
 * REQ-002-FN-017: phases in canonical order
 */
export function computePhaseStats(entries: LogEntry[]): PhaseStats[] {
  const phaseMap = new Map<string, LogEntry[]>();

  for (const entry of entries) {
    if (!entry.phase) continue;
    if (!phaseMap.has(entry.phase)) {
      phaseMap.set(entry.phase, []);
    }
    phaseMap.get(entry.phase)!.push(entry);
  }

  /* REQ-002-FN-017: canonical phase ordering */
  const sortedPhaseNames = sortPhases(Array.from(phaseMap.keys()));

  return sortedPhaseNames.map((name) => {
    const phaseEntries = phaseMap.get(name) ?? [];

    /* Group by unique work unit: agent|task_id (or agent|log_seq for entries without task_id) */
    const workUnits = new Map<string, LogEntry[]>();
    for (const e of phaseEntries) {
      const key = `${e.agent}|${e.task_id ?? e.log_seq}`;
      if (!workUnits.has(key)) {
        workUnits.set(key, []);
      }
      workUnits.get(key)!.push(e);
    }

    /* REQ-002-FN-013: total = work units that have at least one START */
    let total = 0;
    let completed = 0;
    let failures = 0;

    for (const [, unitEntries] of workUnits) {
      const hasStart = unitEntries.some((e) => e.action === 'START');
      if (!hasStart) continue;
      total++;

      /* Find latest action by log_seq (monotonically increasing) */
      const latest = unitEntries.reduce((prev, curr) =>
        curr.log_seq > prev.log_seq ? curr : prev
      );

      /* REQ-002-FN-014: done if latest action is terminal */
      if (TERMINAL_ACTIONS.has(latest.action)) {
        completed++;
      } else if (FAILURE_ACTIONS.has(latest.action)) {
        /* REQ-002-FN-015: failed if latest action is failure/error */
        failures++;
      }
    }

    /* REQ-002-FN-016: active = total - done - failed */
    const inProgress = Math.max(0, total - completed - failures);

    return {
      name,
      total,
      completed,
      inProgress,
      failures,
      errors: 0,
      /* REQ-002-FN-012: clamp to 100 */
      percentage: total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0,
    };
  });
}

function findActiveAgents(entries: LogEntry[]): string[] {
  const starts = new Map<string, LogEntry>();

  for (const entry of entries) {
    if (entry.action === 'START') {
      starts.set(`${entry.agent}-${entry.task_id ?? entry.log_seq}`, entry);
    } else if (
      entry.action === 'COMPLETE' ||
      entry.action === 'REVIEW_PASS' ||
      entry.action === 'REVIEW_FAIL' ||
      entry.action === 'ERROR'
    ) {
      starts.delete(`${entry.agent}-${entry.task_id ?? entry.parent_log_seq ?? entry.log_seq}`);
    }
  }

  return Array.from(new Set(Array.from(starts.values()).map((e) => e.agent)));
}

export const DashboardView: React.FC = () => {
  const { state, selectEntry } = useLog();
  const { applyFilters } = useFilters();
  const [showDecisions, setShowDecisions] = useState(true);

  const filteredEntries = useMemo(
    () => applyFilters(state.entries),
    [applyFilters, state.entries]
  );

  const phaseStats = useMemo(() => computePhaseStats(filteredEntries), [filteredEntries]);
  const activeAgents = useMemo(() => findActiveAgents(filteredEntries), [filteredEntries]);
  const decisions = useMemo(
    () =>
      filteredEntries
        .filter((e) => e.action === 'DECISION')
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [filteredEntries]
  );

  const workSeqs = useMemo(
    () => Array.from(state.indices.workSeqIndex.keys()).sort(),
    [state.indices.workSeqIndex]
  );

  const cardStyles: React.CSSProperties = {
    padding: 'var(--space-4)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-primary)',
  };

  const statStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
        Phase Progress Dashboard
      </h2>

      {/* Phase Pipeline (FR-PPD-001) */}
      <div style={{ ...cardStyles, marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
          Phase Pipeline
        </h3>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {phaseStats.map((phase) => (
            <div
              key={phase.name}
              style={{
                flex: 1,
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: phase.percentage === 100
                  ? 'var(--success-bg)'
                  : phase.percentage > 0
                  ? 'var(--warning-bg)'
                  : 'var(--bg-tertiary)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', textTransform: 'capitalize' }}>
                {phase.name}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{phase.percentage}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {phase.completed}/{phase.total} tasks
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Phase Statistics (FR-PPD-002) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        {phaseStats.map((phase) => (
          <div key={phase.name} style={cardStyles}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: 'var(--space-3)', textTransform: 'capitalize' }}>
              {phase.name}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div style={statStyles}>
                <span style={{ fontSize: '20px', fontWeight: 700 }}>{phase.total}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total</span>
              </div>
              <div style={statStyles}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success-text)' }}>{phase.completed}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Done</span>
              </div>
              <div style={statStyles}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--warning-text)' }}>{phase.inProgress}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active</span>
              </div>
              <div style={statStyles}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--error-text)' }}>{phase.failures + phase.errors}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Failed</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Per-Work-Sequence Breakdown (FR-PPD-003) */}
      {workSeqs.length > 1 && (
        <div style={{ ...cardStyles, marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
            Work Sequences
          </h3>
          {workSeqs.map((ws) => {
            const wsEntries = state.indices.workSeqIndex.get(ws) ?? [];
            const wsStats = computePhaseStats(wsEntries);
            return (
              <div key={ws} style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-tertiary)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Seq {ws}</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {wsStats.map((p) => (
                    <span key={p.name} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {p.name}: {p.percentage}%
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Agents (FR-PPD-004) */}
      <div style={{ ...cardStyles, marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
          Active Agents
        </h3>
        {activeAgents.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No agents currently active</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {activeAgents.map((agent) => (
              <span
                key={agent}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                {agent}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Decision Log (FR-PPD-006) */}
      <div style={cardStyles}>
        <button
          onClick={() => setShowDecisions(!showDecisions)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            fontWeight: 600,
            padding: 0,
          }}
        >
          <span>Decisions ({decisions.length})</span>
          <span>{showDecisions ? '-' : '+'}</span>
        </button>
        {showDecisions && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            {decisions.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No decisions recorded</div>
            ) : (
              decisions.map((entry) => (
                <div
                  key={entry.log_seq}
                  style={{
                    padding: 'var(--space-3)',
                    borderBottom: '1px solid var(--border-primary)',
                    cursor: 'pointer',
                  }}
                  onClick={() => selectEntry(entry)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
                    <ActionBadge action="DECISION" size="sm" />
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{entry.agent}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {entry.details.substring(0, 200)}
                  </div>
                  {entry.decisions.length > 0 && (
                    <ul style={{ margin: '4px 0 0 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {entry.decisions.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
