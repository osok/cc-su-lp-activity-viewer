/**
 * Requirements traceability matrix view.
 * FR-RTM-001: Extract requirement identifiers.
 * FR-RTM-003: Matrix display with rows=reqs, cols=phases.
 * FR-RTM-004: Coverage summary.
 * FR-RTM-005: Click to filter.
 * FR-RTM-006: Gap highlighting.
 */

import React, { useMemo } from 'react';
import { useLog } from '../../../store/LogContext';
import { useFilters } from '../../../store/FilterContext';
import { RequirementTrace } from '../../../types/log-entry';
import { ActionBadge } from '../../shared/ActionBadge';
import { sortPhases } from '../../../config/constants';

interface ReqPhaseStatus {
  hasEntry: boolean;
  actions: string[];
  hasFail: boolean;
  hasPass: boolean;
}

export const TraceabilityView: React.FC = () => {
  const { state } = useLog();
  const { setRequirementFilter } = useFilters();

  /* REQ-002-FN-008: Canonical workflow phase ordering */
  const allPhases = useMemo(
    () => sortPhases(Array.from(state.indices.phaseIndex.keys())),
    [state.indices.phaseIndex]
  );

  const reqGroups = useMemo(() => {
    const reqIndex = state.indices.requirementIndex;
    const groups = new Map<string, Map<string, { reqId: string; phases: Map<string, ReqPhaseStatus> }>>();

    for (const [reqId, traces] of reqIndex) {
      const prefix = reqId.replace(/-\d+$/, '');
      if (!groups.has(prefix)) {
        groups.set(prefix, new Map());
      }

      const phaseMap = new Map<string, ReqPhaseStatus>();
      for (const phase of allPhases) {
        const phaseTraces = traces.filter((t: RequirementTrace) => t.phase === phase);
        phaseMap.set(phase, {
          hasEntry: phaseTraces.length > 0,
          actions: phaseTraces.map((t: RequirementTrace) => t.action),
          hasFail: phaseTraces.some((t: RequirementTrace) =>
            t.action === 'REVIEW_FAIL' || t.action === 'TEST_FAIL' || t.action === 'ERROR'
          ),
          hasPass: phaseTraces.some((t: RequirementTrace) =>
            t.action === 'COMPLETE' || t.action === 'REVIEW_PASS' || t.action === 'TEST_PASS'
          ),
        });
      }

      groups.get(prefix)!.set(reqId, { reqId, phases: phaseMap });
    }

    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [state.indices.requirementIndex, allPhases]);

  const coverageStats = useMemo(() => {
    const reqIndex = state.indices.requirementIndex;
    const total = reqIndex.size;
    let withImpl = 0;
    let withReview = 0;
    let withTest = 0;

    for (const [, traces] of reqIndex) {
      if (traces.some((t: RequirementTrace) => t.phase === 'implementation')) withImpl++;
      if (traces.some((t: RequirementTrace) => t.phase === 'review')) withReview++;
      if (traces.some((t: RequirementTrace) => t.phase === 'testing')) withTest++;
    }

    return {
      total,
      withImpl,
      withReview,
      withTest,
      coveragePercent: total > 0 ? Math.round(((withImpl + withReview + withTest) / (total * 3)) * 100) : 0,
    };
  }, [state.indices.requirementIndex]);

  if (reqGroups.length === 0) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
        No requirement references found in the log entries.
      </div>
    );
  }

  const cellStyle = (status: ReqPhaseStatus): React.CSSProperties => ({
    padding: 'var(--space-2)',
    textAlign: 'center',
    backgroundColor: status.hasFail
      ? 'var(--error-bg)'
      : status.hasPass
      ? 'var(--success-bg)'
      : status.hasEntry
      ? 'var(--warning-bg)'
      : 'transparent',
    borderBottom: '1px solid var(--border-primary)',
  });

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
        Requirements Traceability Matrix
      </h2>

      {/* Coverage Summary (FR-RTM-004) */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-4)',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{coverageStats.total}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Requirements</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{coverageStats.withImpl}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Implementation</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{coverageStats.withReview}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Review</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{coverageStats.withTest}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Testing</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{coverageStats.coveragePercent}%</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Coverage</div>
        </div>
      </div>

      {/* Matrix (FR-RTM-003) */}
      {reqGroups.map(([prefix, reqs]) => (
        <div key={prefix} style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
            {prefix} ({reqs.size} requirements)
          </h3>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', borderBottom: '1px solid var(--border-primary)' }}>
                  Requirement
                </th>
                {allPhases.map((phase) => (
                  <th
                    key={phase}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      textAlign: 'center',
                      textTransform: 'capitalize',
                      borderBottom: '1px solid var(--border-primary)',
                    }}
                  >
                    {phase}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(reqs.values())
                .sort((a, b) => a.reqId.localeCompare(b.reqId))
                .map(({ reqId, phases }) => {
                  const hasGap =
                    phases.get('implementation')?.hasEntry &&
                    (!phases.get('review')?.hasEntry || !phases.get('testing')?.hasEntry);

                  return (
                    <tr
                      key={reqId}
                      style={{
                        backgroundColor: hasGap ? 'var(--warning-bg)' : undefined,
                      }}
                    >
                      <td
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          fontFamily: 'var(--font-mono)',
                          cursor: 'pointer',
                          color: 'var(--accent-primary)',
                          borderBottom: '1px solid var(--border-primary)',
                        }}
                        onClick={() => setRequirementFilter(reqId)}
                        title="Click to filter by this requirement"
                      >
                        {reqId}
                        {hasGap && (
                          <span style={{ fontSize: '10px', color: 'var(--warning-text)', marginLeft: '4px' }}>
                            GAP
                          </span>
                        )}
                      </td>
                      {allPhases.map((phase) => {
                        const status = phases.get(phase) ?? { hasEntry: false, actions: [], hasFail: false, hasPass: false };
                        return (
                          <td key={phase} style={cellStyle(status)}>
                            {status.actions.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'center' }}>
                                {Array.from(new Set(status.actions)).map((action) => (
                                  <ActionBadge key={action} action={action} size="sm" />
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};
