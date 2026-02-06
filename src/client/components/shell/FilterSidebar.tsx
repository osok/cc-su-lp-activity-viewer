/**
 * Collapsible filter sidebar.
 * FR-FLT-001: Accessible from any view.
 * FR-FLT-002-005: Filter by agent, action, phase, work_seq.
 * FR-FLT-008: Active filter summary chips.
 * FR-FLT-009: Clear all filters.
 */

import React from 'react';
import { useLog } from '../../store/LogContext';
import { useFilters } from '../../store/FilterContext';
import { FilterChip } from '../shared/FilterChip';
import { FilterDimension } from '../../types/filters';

interface FilterSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface FilterSectionProps {
  title: string;
  dimension: FilterDimension;
  allValues: string[];
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, dimension, allValues }) => {
  const { filters, toggleFilterValue, setFilter, clearFilter } = useFilters();
  const selected = filters[dimension];

  const handleSelectAll = () => {
    setFilter(dimension, new Set(allValues));
  };

  const handleSelectNone = () => {
    clearFilter(dimension);
  };

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <h4 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {title}
        </h4>
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          <button
            onClick={handleSelectAll}
            style={{ fontSize: '11px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent-primary)' }}
          >
            All
          </button>
          <button
            onClick={handleSelectNone}
            style={{ fontSize: '11px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent-primary)' }}
          >
            None
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {allValues.map((value) => (
          <label
            key={value}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '13px', cursor: 'pointer', padding: '2px 0' }}
          >
            <input
              type="checkbox"
              checked={selected.size === 0 || selected.has(value)}
              onChange={() => toggleFilterValue(dimension, value)}
            />
            {value}
          </label>
        ))}
      </div>
    </div>
  );
};

export const FilterSidebar: React.FC<FilterSidebarProps> = ({ isOpen, onToggle }) => {
  const { state } = useLog();
  const { filters, isActive, clearAll, clearFilter, setFileFilter, setRequirementFilter } = useFilters();

  const allAgents = Array.from(state.indices.agentIndex.keys()).sort();
  const allActions = Array.from(new Set(state.entries.map((e) => e.action))).sort();
  const allPhases = Array.from(state.indices.phaseIndex.keys()).sort();
  const allWorkSeqs = Array.from(state.indices.workSeqIndex.keys()).sort();

  const sidebarStyles: React.CSSProperties = {
    width: isOpen ? 'var(--sidebar-width)' : '0',
    overflow: 'hidden',
    borderRight: isOpen ? '1px solid var(--border-primary)' : 'none',
    backgroundColor: 'var(--bg-secondary)',
    transition: 'width 0.2s ease',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  };

  const contentStyles: React.CSSProperties = {
    width: 'var(--sidebar-width)',
    padding: 'var(--space-4)',
    overflowY: 'auto',
    flex: 1,
  };

  return (
    <>
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          left: isOpen ? 'calc(var(--sidebar-width) - 1px)' : '0',
          top: 'calc(var(--nav-height) + var(--space-2))',
          zIndex: 10,
          padding: '4px 8px',
          border: '1px solid var(--border-primary)',
          borderLeft: 'none',
          borderRadius: '0 var(--radius-md) var(--radius-md) 0',
          backgroundColor: 'var(--bg-secondary)',
          cursor: 'pointer',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          transition: 'left 0.2s ease',
        }}
        title="Toggle filters (F)"
      >
        {isOpen ? '<' : 'Filters'}
      </button>
      <aside style={sidebarStyles}>
        <div style={contentStyles}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Filters</h3>
            {isActive && (
              <button
                onClick={clearAll}
                style={{ fontSize: '12px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent-primary)' }}
              >
                Clear All
              </button>
            )}
          </div>

          {isActive && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginBottom: 'var(--space-4)' }}>
              {Array.from(filters.agents).map((v) => (
                <FilterChip key={`agent-${v}`} label="Agent" value={v} onRemove={() => clearFilter('agents')} />
              ))}
              {Array.from(filters.actions).map((v) => (
                <FilterChip key={`action-${v}`} label="Action" value={v} onRemove={() => clearFilter('actions')} />
              ))}
              {Array.from(filters.phases).map((v) => (
                <FilterChip key={`phase-${v}`} label="Phase" value={v} onRemove={() => clearFilter('phases')} />
              ))}
              {Array.from(filters.workSeqs).map((v) => (
                <FilterChip key={`ws-${v}`} label="Work Seq" value={v} onRemove={() => clearFilter('workSeqs')} />
              ))}
              {filters.fileFilter && (
                <FilterChip label="File" value={filters.fileFilter} onRemove={() => setFileFilter(null)} />
              )}
              {filters.requirementFilter && (
                <FilterChip label="Req" value={filters.requirementFilter} onRemove={() => setRequirementFilter(null)} />
              )}
            </div>
          )}

          {allAgents.length > 0 && (
            <FilterSection title="Agents" dimension="agents" allValues={allAgents} />
          )}
          {allActions.length > 0 && (
            <FilterSection title="Actions" dimension="actions" allValues={allActions} />
          )}
          {allPhases.length > 0 && (
            <FilterSection title="Phases" dimension="phases" allValues={allPhases} />
          )}
          {allWorkSeqs.length > 0 && (
            <FilterSection title="Work Sequences" dimension="workSeqs" allValues={allWorkSeqs} />
          )}
        </div>
      </aside>
    </>
  );
};
