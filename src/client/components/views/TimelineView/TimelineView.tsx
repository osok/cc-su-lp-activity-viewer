/**
 * Gantt-chart Timeline view with task-per-row duration bars.
 * REQ-004-FN-001..005: Each task gets its own unique Y-axis row, no overlapping bars.
 * REQ-004-FN-006..008: Row labels show "agent: detail" in the left column.
 * REQ-004-FN-009..011: Work sequence grouping with headers and task counts.
 * REQ-004-FN-012..022: Preserved features (colors, orphans, phase markers, zoom, scroll, tooltip, etc.).
 * REQ-004-FN-023..024: Connection paths use task-per-row Y positions.
 */

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useLog } from '../../../store/LogContext';
import { useFilters } from '../../../store/FilterContext';
import { useTheme } from '../../../store/ThemeContext';
import { ACTION_COLORS, BAR_COLORS, TOOLTIP_DETAILS_MAX_LENGTH } from '../../../config/constants';
import { LogEntry } from '../../../types/log-entry';
import { pairEntries, PairingResult } from './pairEntries';

const LANE_HEIGHT = 36;
const LANE_PADDING = 4;
const BAR_HEIGHT = LANE_HEIGHT - LANE_PADDING * 2;
const MIN_BAR_WIDTH = 4;
const ORPHAN_WIDTH = 12;
const MARKER_SIZE = 6;
const GROUP_HEADER_HEIGHT = 24;
const CONNECTION_H_OFFSET = 12;
const MARGIN = { top: 40, right: 20, bottom: 30, left: 0 };
const LABEL_COLUMN_WIDTH = 180;

export type LabelMode = 'taskId' | 'requirements';

/** Connection path data for parent -> child relationship. */
export interface ConnectionPath {
  parentSeq: number;
  childSeq: number;
  path: string;
}

/** A single task row within a work sequence group. REQ-004-FN-001..002 */
interface TaskRow {
  logSeq: number;          // START log_seq (unique key for yScale)
  agent: string;           // agent name for label prefix
  type: 'bar' | 'orphan';
  timestamp: string;       // start timestamp for ordering
}

/** Work sequence group with its task rows and layout info. */
interface WorkSeqGroup {
  workSeq: string;
  taskRows: TaskRow[];     // REQ-004-FN-001: one per DurationBar + OrphanStart
  entries: LogEntry[];
  yOffset: number;
  earliestTimestamp: string;
}

/**
 * Build orthogonal (right-angle) SVG path strings for parent-child connections.
 * REQ-004-FN-023..024: Uses task-per-row Y positions via yScale(logSeq).
 */
export function buildConnectionPaths(
  parentChildMap: Map<number, number[]>,
  entryMap: Map<number, LogEntry>,
  filteredSeqs: Set<number>,
  barLookup: Map<number, { x: number; width: number; y: number }>,
  xScale: (d: Date) => number,
  yScale: (logSeq: number) => number | undefined
): ConnectionPath[] {
  const paths: ConnectionPath[] = [];

  for (const [parentSeq, childSeqs] of parentChildMap) {
    if (!filteredSeqs.has(parentSeq)) continue;
    const parentEntry = entryMap.get(parentSeq);
    if (!parentEntry) continue;

    // Use bar lookup for parent position if available, otherwise use row position
    const parentBarInfo = barLookup.get(parentSeq);
    let parentX: number;
    let parentY: number;
    if (parentBarInfo) {
      parentX = parentBarInfo.x + parentBarInfo.width;
      parentY = parentBarInfo.y + BAR_HEIGHT / 2;
    } else {
      const py = yScale(parentEntry.log_seq);
      if (py === undefined) continue;
      parentX = xScale(new Date(parentEntry.timestamp)) + MIN_BAR_WIDTH;
      parentY = py + LANE_PADDING + BAR_HEIGHT / 2;
    }

    for (const childSeq of childSeqs) {
      if (!filteredSeqs.has(childSeq)) continue;
      const childEntry = entryMap.get(childSeq);
      if (!childEntry) continue;

      const childBarInfo = barLookup.get(childSeq);
      let childX: number;
      let childY: number;
      if (childBarInfo) {
        childX = childBarInfo.x;
        childY = childBarInfo.y + BAR_HEIGHT / 2;
      } else {
        const cy = yScale(childEntry.log_seq);
        if (cy === undefined) continue;
        childX = xScale(new Date(childEntry.timestamp));
        childY = cy + LANE_PADDING + BAR_HEIGHT / 2;
      }

      const midX = parentX + CONNECTION_H_OFFSET;
      const d = `M ${parentX} ${parentY} H ${midX} V ${childY} H ${childX}`;
      paths.push({ parentSeq, childSeq, path: d });
    }
  }

  return paths;
}

/**
 * Get the display label for a bar based on the current label mode.
 * REQ-004-FN-007: After agent prefix, show task_id or requirements.
 */
function getBarLabel(entry: LogEntry, mode: LabelMode): string {
  if (mode === 'taskId') {
    if (entry.task_id) return entry.task_id;
  } else {
    if (entry.requirements.length > 0) return entry.requirements.join(', ');
  }
  // Fallback: agent name + action
  return `${entry.agent} ${entry.action}`;
}

/**
 * Get the row label for the left label column.
 * REQ-004-FN-006: "agent: detail"
 */
function getRowLabel(entry: LogEntry, mode: LabelMode): string {
  const prefix = entry.agent;
  let detail: string;
  if (mode === 'taskId') {
    detail = entry.task_id || entry.action;
  } else {
    detail = entry.requirements.length > 0
      ? entry.requirements.join(', ')
      : entry.task_id || entry.action;
  }
  return `${prefix}: ${detail}`;
}

export const TimelineView: React.FC = () => {
  const { state, selectEntry } = useLog();
  const { applyFilters } = useFilters();
  const { theme } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const labelSvgRef = useRef<SVGSVGElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const [tooltipEntry, setTooltipEntry] = useState<LogEntry | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showConnections, setShowConnections] = useState(true);
  const [labelMode, setLabelMode] = useState<LabelMode>('taskId');

  const filteredEntries = useMemo(
    () => applyFilters(state.entries),
    [applyFilters, state.entries]
  );

  const filteredSeqs = useMemo(
    () => new Set(filteredEntries.map((e) => e.log_seq)),
    [filteredEntries]
  );

  // Pair entries into duration bars, orphans, and markers
  const pairing: PairingResult = useMemo(
    () => pairEntries(filteredEntries),
    [filteredEntries]
  );

  // Build work sequence groups with task-per-row layout (REQ-004-FN-001..005, REQ-004-FN-009..011)
  const workSeqGroups: WorkSeqGroup[] = useMemo(() => {
    const groupMap = new Map<string, LogEntry[]>();
    for (const entry of filteredEntries) {
      const list = groupMap.get(entry.work_seq);
      if (list) {
        list.push(entry);
      } else {
        groupMap.set(entry.work_seq, [entry]);
      }
    }

    // Index bars and orphans by work_seq for building task rows
    const barsByWorkSeq = new Map<string, TaskRow[]>();
    for (const bar of pairing.bars) {
      const ws = bar.startEntry.work_seq;
      const row: TaskRow = {
        logSeq: bar.startEntry.log_seq,
        agent: bar.startEntry.agent,
        type: 'bar',
        timestamp: bar.startEntry.timestamp,
      };
      const list = barsByWorkSeq.get(ws);
      if (list) {
        list.push(row);
      } else {
        barsByWorkSeq.set(ws, [row]);
      }
    }
    for (const orphan of pairing.orphans) {
      const ws = orphan.entry.work_seq;
      const row: TaskRow = {
        logSeq: orphan.entry.log_seq,
        agent: orphan.entry.agent,
        type: 'orphan',
        timestamp: orphan.entry.timestamp,
      };
      const list = barsByWorkSeq.get(ws);
      if (list) {
        list.push(row);
      } else {
        barsByWorkSeq.set(ws, [row]);
      }
    }

    const groups: WorkSeqGroup[] = [];
    let yOffset = MARGIN.top;

    // Sort groups by earliest timestamp (REQ-004-FN-010)
    const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => {
      const aEntries = groupMap.get(a);
      const bEntries = groupMap.get(b);
      if (!aEntries || !bEntries || aEntries.length === 0 || bEntries.length === 0) return 0;
      return aEntries[0]!.timestamp.localeCompare(bEntries[0]!.timestamp);
    });

    for (const workSeq of sortedKeys) {
      const entries = groupMap.get(workSeq)!;
      const taskRows = barsByWorkSeq.get(workSeq) || [];

      // REQ-004-FN-005: Sort rows by start timestamp (earliest first)
      taskRows.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      const earliestTimestamp = entries[0]!.timestamp;

      groups.push({ workSeq, taskRows, entries, yOffset, earliestTimestamp });
      yOffset += GROUP_HEADER_HEIGHT + taskRows.length * LANE_HEIGHT;
    }

    return groups;
  }, [filteredEntries, pairing]);

  // Total content height
  const totalHeight = useMemo(() => {
    if (workSeqGroups.length === 0) return 200;
    const lastGroup = workSeqGroups[workSeqGroups.length - 1];
    if (!lastGroup) return 200;
    return lastGroup.yOffset + GROUP_HEADER_HEIGHT + lastGroup.taskRows.length * LANE_HEIGHT + MARGIN.bottom;
  }, [workSeqGroups]);

  const renderTimeline = useCallback(() => {
    if (!svgRef.current || !chartContainerRef.current || filteredEntries.length === 0) return;

    const container = chartContainerRef.current;
    const width = container.clientWidth;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', Math.max(totalHeight, 200));

    // Also render label column
    if (labelSvgRef.current) {
      const labelSvg = d3.select(labelSvgRef.current);
      labelSvg.selectAll('*').remove();
      labelSvg.attr('width', LABEL_COLUMN_WIDTH).attr('height', Math.max(totalHeight, 200));

      const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
      const headerBg = theme === 'dark' ? '#1e293b' : '#e2e8f0';

      // Build entry map for row labels
      const entryByLogSeq = new Map<number, LogEntry>();
      for (const entry of filteredEntries) {
        entryByLogSeq.set(entry.log_seq, entry);
      }

      for (const group of workSeqGroups) {
        // Group header in label column (REQ-004-FN-011)
        labelSvg.append('rect')
          .attr('x', 0)
          .attr('y', group.yOffset)
          .attr('width', LABEL_COLUMN_WIDTH)
          .attr('height', GROUP_HEADER_HEIGHT)
          .attr('fill', headerBg);

        labelSvg.append('text')
          .attr('x', 12)
          .attr('y', group.yOffset + GROUP_HEADER_HEIGHT / 2)
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '12px')
          .attr('font-weight', '600')
          .attr('fill', textColor)
          .text(group.workSeq ? `Seq ${group.workSeq} (${group.taskRows.length} tasks)` : 'Unknown');

        // Task row labels (REQ-004-FN-006..008)
        const laneTop = group.yOffset + GROUP_HEADER_HEIGHT;
        for (let i = 0; i < group.taskRows.length; i++) {
          const taskRow = group.taskRows[i];
          if (!taskRow) continue;
          const laneY = laneTop + i * LANE_HEIGHT;

          const entry = entryByLogSeq.get(taskRow.logSeq);
          const label = entry
            ? getRowLabel(entry, labelMode)
            : `${taskRow.agent}: ${taskRow.logSeq}`;

          // REQ-004-FN-008: Truncate with ellipsis
          const maxLabelWidth = LABEL_COLUMN_WIDTH - 16;

          labelSvg.append('text')
            .attr('x', LABEL_COLUMN_WIDTH - 8)
            .attr('y', laneY + LANE_HEIGHT / 2)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '11px')
            .attr('fill', textColor)
            .each(function () {
              const textEl = d3.select(this);
              textEl.text(label);
              // Truncate if too wide
              const node = this as SVGTextElement;
              if (node.getComputedTextLength && node.getComputedTextLength() > maxLabelWidth) {
                let truncated = label;
                while (truncated.length > 0 && node.getComputedTextLength() > maxLabelWidth) {
                  truncated = truncated.slice(0, -1);
                  textEl.text(truncated + '...');
                }
              }
            });
        }
      }
    }

    // Time scale across all entries
    const timestamps = filteredEntries.map((e) => new Date(e.timestamp));
    const timeExtent = d3.extent(timestamps) as [Date, Date];

    const xScale = d3
      .scaleTime()
      .domain(timeExtent)
      .range([0, width - MARGIN.right]);

    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
    const lineColor = theme === 'dark' ? '#334155' : '#e2e8f0';
    const connectionColor = theme === 'dark' ? '#64748b' : '#94a3b8';
    const headerBg = theme === 'dark' ? '#1e293b' : '#e2e8f0';

    const g = svg.append('g');

    // Build yScale function that maps logSeq -> y position (REQ-004-FN-024)
    const yLookup = new Map<number, number>();
    for (const group of workSeqGroups) {
      const laneTop = group.yOffset + GROUP_HEADER_HEIGHT;
      for (let i = 0; i < group.taskRows.length; i++) {
        const taskRow = group.taskRows[i];
        if (!taskRow) continue;
        yLookup.set(taskRow.logSeq, laneTop + i * LANE_HEIGHT);
      }
    }
    const yScale = (logSeq: number): number | undefined => {
      return yLookup.get(logSeq);
    };

    // Render group backgrounds and headers
    for (const group of workSeqGroups) {
      // Group header background
      g.append('rect')
        .attr('x', 0)
        .attr('y', group.yOffset)
        .attr('width', width)
        .attr('height', GROUP_HEADER_HEIGHT)
        .attr('fill', headerBg);

      g.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', group.yOffset + GROUP_HEADER_HEIGHT)
        .attr('y2', group.yOffset + GROUP_HEADER_HEIGHT)
        .attr('stroke', lineColor)
        .attr('stroke-width', 1);

      // Lane backgrounds (REQ-004-FN-001: one per task row)
      const laneTop = group.yOffset + GROUP_HEADER_HEIGHT;
      for (let i = 0; i < group.taskRows.length; i++) {
        const laneY = laneTop + i * LANE_HEIGHT;
        g.append('rect')
          .attr('class', 'lane-bg')
          .attr('x', 0)
          .attr('y', laneY)
          .attr('width', width)
          .attr('height', LANE_HEIGHT)
          .attr('fill',
            i % 2 === 0
              ? theme === 'dark' ? '#1e293b' : '#f8fafc'
              : theme === 'dark' ? '#0f172a' : '#ffffff'
          );
      }
    }

    // Phase transition markers (REQ-004-FN-014)
    const phases = new Map<string, Date>();
    for (const entry of filteredEntries) {
      if (!phases.has(entry.phase)) {
        phases.set(entry.phase, new Date(entry.timestamp));
      }
    }
    const phaseTransitions = Array.from(phases.entries()).slice(1);

    g.selectAll('.phase-marker')
      .data(phaseTransitions)
      .join('line')
      .attr('class', 'phase-marker')
      .attr('x1', (d) => xScale(d[1]))
      .attr('x2', (d) => xScale(d[1]))
      .attr('y1', MARGIN.top)
      .attr('y2', totalHeight - MARGIN.bottom)
      .attr('stroke', theme === 'dark' ? '#475569' : '#94a3b8')
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-width', 1);

    g.selectAll('.phase-label')
      .data(phaseTransitions)
      .join('text')
      .attr('class', 'phase-label')
      .attr('x', (d) => xScale(d[1]) + 4)
      .attr('y', MARGIN.top - 8)
      .attr('font-size', '10px')
      .attr('fill', theme === 'dark' ? '#64748b' : '#94a3b8')
      .text((d) => d[0]);

    // Striped pattern for orphan bars (REQ-004-FN-013)
    const defs = svg.append('defs');
    const patternId = 'orphan-stripes';
    const pattern = defs.append('pattern')
      .attr('id', patternId)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 6)
      .attr('height', 6)
      .attr('patternTransform', 'rotate(45)');
    pattern.append('rect')
      .attr('width', 6)
      .attr('height', 6)
      .attr('fill', theme === 'dark' ? BAR_COLORS.orphan.dark : BAR_COLORS.orphan.light);
    pattern.append('line')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', 0).attr('y2', 6)
      .attr('stroke', theme === 'dark' ? '#1e293b' : '#ffffff')
      .attr('stroke-width', 2);

    // Build bar position lookup for connection paths
    const barLookup = new Map<number, { x: number; width: number; y: number }>();

    // Connection lines layer (REQ-004-FN-015, REQ-004-FN-016)
    const connectionsGroup = g.append('g')
      .attr('class', 'connections')
      .style('display', showConnections ? 'block' : 'none');

    // Render duration bars (REQ-004-FN-001, REQ-004-FN-012)
    const barsGroup = g.append('g').attr('class', 'bars');

    for (const bar of pairing.bars) {
      const laneY = yScale(bar.startEntry.log_seq);
      if (laneY === undefined) continue;

      const x1 = xScale(new Date(bar.startEntry.timestamp));
      const x2 = xScale(new Date(bar.endEntry.timestamp));
      const barWidth = Math.max(MIN_BAR_WIDTH, x2 - x1);
      const barY = laneY + LANE_PADDING;

      const fillColor = bar.outcome === 'success'
        ? (theme === 'dark' ? BAR_COLORS.success.dark : BAR_COLORS.success.light)
        : (theme === 'dark' ? BAR_COLORS.failure.dark : BAR_COLORS.failure.light);

      // Store position for connections
      barLookup.set(bar.startEntry.log_seq, { x: x1, width: barWidth, y: barY });

      const barG = barsGroup.append('g')
        .attr('class', 'bar-group')
        .attr('cursor', 'pointer')
        .attr('data-log-seq', bar.startEntry.log_seq);

      // Bar rectangle (REQ-004-FN-022)
      barG.append('rect')
        .attr('class', 'duration-bar')
        .attr('x', x1)
        .attr('y', barY)
        .attr('width', barWidth)
        .attr('height', BAR_HEIGHT)
        .attr('rx', 3)
        .attr('ry', 3)
        .attr('fill', fillColor)
        .attr('opacity', 0.85);

      // Bar label
      const label = getBarLabel(bar.startEntry, labelMode);
      if (barWidth > 20) {
        const clipId = `clip-${bar.startEntry.log_seq}`;
        defs.append('clipPath')
          .attr('id', clipId)
          .append('rect')
          .attr('x', x1 + 4)
          .attr('y', barY)
          .attr('width', barWidth - 8)
          .attr('height', BAR_HEIGHT);

        barG.append('text')
          .attr('class', 'bar-label')
          .attr('x', x1 + 4)
          .attr('y', barY + BAR_HEIGHT / 2)
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '10px')
          .attr('fill', theme === 'dark' ? '#0f172a' : '#ffffff')
          .attr('clip-path', `url(#${clipId})`)
          .text(label);
      }

      // Event handlers
      barG
        .on('mouseenter', function (event: MouseEvent) {
          d3.select(this).select('.duration-bar').attr('opacity', 0.65);
          setTooltipEntry(bar.startEntry);
          setTooltipPos({ x: event.clientX, y: event.clientY });

          // Highlight connections (REQ-004-FN-015)
          connectionsGroup.selectAll<SVGPathElement, ConnectionPath>('.connection')
            .each(function (connData) {
              if (connData.parentSeq === bar.startEntry.log_seq || connData.childSeq === bar.startEntry.log_seq) {
                d3.select(this)
                  .attr('stroke-opacity', 0.9)
                  .attr('stroke-width', 2);
              }
            });
        })
        .on('mousemove', function (event: MouseEvent) {
          setTooltipPos({ x: event.clientX, y: event.clientY });
        })
        .on('mouseleave', function () {
          d3.select(this).select('.duration-bar').attr('opacity', 0.85);
          setTooltipEntry(null);

          connectionsGroup.selectAll<SVGPathElement, ConnectionPath>('.connection')
            .attr('stroke-opacity', 0.25)
            .attr('stroke-width', 1.5);
        })
        .on('click', function () {
          selectEntry(bar.startEntry);
        });
    }

    // Render orphan STARTs (REQ-004-FN-002, REQ-004-FN-013)
    for (const orphan of pairing.orphans) {
      const laneY = yScale(orphan.entry.log_seq);
      if (laneY === undefined) continue;

      const x = xScale(new Date(orphan.entry.timestamp));
      const barY = laneY + LANE_PADDING;

      barLookup.set(orphan.entry.log_seq, { x, width: ORPHAN_WIDTH, y: barY });

      const orphanG = barsGroup.append('g')
        .attr('class', 'orphan-group')
        .attr('cursor', 'pointer')
        .attr('data-log-seq', orphan.entry.log_seq);

      orphanG.append('rect')
        .attr('class', 'orphan-bar')
        .attr('x', x)
        .attr('y', barY)
        .attr('width', ORPHAN_WIDTH)
        .attr('height', BAR_HEIGHT)
        .attr('rx', 3)
        .attr('ry', 3)
        .attr('fill', `url(#${patternId})`);

      orphanG
        .on('mouseenter', function (event: MouseEvent) {
          setTooltipEntry(orphan.entry);
          setTooltipPos({ x: event.clientX, y: event.clientY });
        })
        .on('mousemove', function (event: MouseEvent) {
          setTooltipPos({ x: event.clientX, y: event.clientY });
        })
        .on('mouseleave', function () {
          setTooltipEntry(null);
        })
        .on('click', function () {
          selectEntry(orphan.entry);
        });
    }

    // Render markers (REQ-004-FN-004)
    for (const marker of pairing.markers) {
      // REQ-004-FN-004: Markers render within their parent bar's row
      let markerLaneY: number | undefined;
      if (marker.parentBar) {
        markerLaneY = yScale(marker.parentBar.startEntry.log_seq);
      }
      // If no parent bar or parent not in view, skip
      if (markerLaneY === undefined) continue;

      const x = xScale(new Date(marker.entry.timestamp));
      const markerY = markerLaneY + LANE_PADDING + BAR_HEIGHT / 2;

      const colors = ACTION_COLORS[marker.entry.action];
      const markerColor = colors
        ? (theme === 'dark' ? colors.dark : colors.light)
        : '#6b7280';

      const markerG = barsGroup.append('g')
        .attr('class', 'marker-group')
        .attr('cursor', 'pointer')
        .attr('data-log-seq', marker.entry.log_seq);

      markerG.append('circle')
        .attr('class', 'marker-dot')
        .attr('cx', x)
        .attr('cy', markerY)
        .attr('r', MARKER_SIZE / 2)
        .attr('fill', markerColor);

      markerG
        .on('mouseenter', function (event: MouseEvent) {
          d3.select(this).select('.marker-dot').attr('r', MARKER_SIZE / 2 + 1);
          setTooltipEntry(marker.entry);
          setTooltipPos({ x: event.clientX, y: event.clientY });
        })
        .on('mousemove', function (event: MouseEvent) {
          setTooltipPos({ x: event.clientX, y: event.clientY });
        })
        .on('mouseleave', function () {
          d3.select(this).select('.marker-dot').attr('r', MARKER_SIZE / 2);
          setTooltipEntry(null);
        })
        .on('click', function () {
          selectEntry(marker.entry);
        });
    }

    // Now render connection paths (after barLookup is populated)
    const connectionPaths = buildConnectionPaths(
      state.indices.parentChildMap,
      state.indices.entryMap,
      filteredSeqs,
      barLookup,
      (d: Date) => xScale(d),
      yScale
    );

    connectionsGroup.selectAll<SVGPathElement, ConnectionPath>('.connection')
      .data(connectionPaths, (d: ConnectionPath) => `${d.parentSeq}-${d.childSeq}`)
      .join('path')
      .attr('class', 'connection')
      .attr('d', (d) => d.path)
      .attr('fill', 'none')
      .attr('stroke', connectionColor)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.25)
      .attr('data-parent', (d) => d.parentSeq)
      .attr('data-child', (d) => d.childSeq);

    // X axis
    const formatTime = (d: d3.AxisDomain) => d3.timeFormat('%H:%M')(d as Date);
    const xAxis = d3.axisBottom(xScale).ticks(8).tickFormat(formatTime);

    svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${totalHeight - MARGIN.bottom})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', textColor)
      .attr('font-size', '10px');

    svg.selectAll('.domain, .tick line').attr('stroke', lineColor);

    // Zoom behavior (REQ-004-FN-018)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .translateExtent([[0, 0], [width, totalHeight]])
      .on('zoom', (event) => {
        const newXScale = event.transform.rescaleX(xScale);

        // Update bars
        barsGroup.selectAll<SVGGElement, unknown>('.bar-group').each(function () {
          const gEl = d3.select(this);
          const logSeq = parseInt(gEl.attr('data-log-seq'), 10);
          const bar = pairing.bars.find((b) => b.startEntry.log_seq === logSeq);
          if (!bar) return;

          const newX1 = newXScale(new Date(bar.startEntry.timestamp));
          const newX2 = newXScale(new Date(bar.endEntry.timestamp));
          const newWidth = Math.max(MIN_BAR_WIDTH, newX2 - newX1);

          gEl.select('.duration-bar')
            .attr('x', newX1)
            .attr('width', newWidth);

          gEl.select('.bar-label')
            .attr('x', newX1 + 4);

          // Update clip path
          const clipId = `clip-${logSeq}`;
          svg.select(`#${clipId} rect`)
            .attr('x', newX1 + 4)
            .attr('width', Math.max(0, newWidth - 8));

          // Update barLookup for connections
          const laneY = yScale(bar.startEntry.log_seq);
          if (laneY !== undefined) {
            barLookup.set(logSeq, { x: newX1, width: newWidth, y: laneY + LANE_PADDING });
          }
        });

        // Update orphans
        barsGroup.selectAll<SVGGElement, unknown>('.orphan-group').each(function () {
          const gEl = d3.select(this);
          const logSeq = parseInt(gEl.attr('data-log-seq'), 10);
          const orphan = pairing.orphans.find((o) => o.entry.log_seq === logSeq);
          if (!orphan) return;

          const newX = newXScale(new Date(orphan.entry.timestamp));
          gEl.select('.orphan-bar').attr('x', newX);

          const laneY = yScale(orphan.entry.log_seq);
          if (laneY !== undefined) {
            barLookup.set(logSeq, { x: newX, width: ORPHAN_WIDTH, y: laneY + LANE_PADDING });
          }
        });

        // Update markers
        barsGroup.selectAll<SVGGElement, unknown>('.marker-group').each(function () {
          const gEl = d3.select(this);
          const logSeq = parseInt(gEl.attr('data-log-seq'), 10);
          const marker = pairing.markers.find((m) => m.entry.log_seq === logSeq);
          if (!marker) return;

          const newX = newXScale(new Date(marker.entry.timestamp));
          gEl.select('.marker-dot').attr('cx', newX);
        });

        // Update phase markers
        g.selectAll<SVGLineElement, [string, Date]>('.phase-marker')
          .attr('x1', (d) => newXScale(d[1]))
          .attr('x2', (d) => newXScale(d[1]));
        g.selectAll<SVGTextElement, [string, Date]>('.phase-label')
          .attr('x', (d) => newXScale(d[1]) + 4);

        // Update connection lines
        const updatedPaths = buildConnectionPaths(
          state.indices.parentChildMap,
          state.indices.entryMap,
          filteredSeqs,
          barLookup,
          (d: Date) => newXScale(d),
          yScale
        );
        connectionsGroup.selectAll<SVGPathElement, ConnectionPath>('.connection')
          .data(updatedPaths, (d: ConnectionPath) => `${d.parentSeq}-${d.childSeq}`)
          .attr('d', (d) => d.path);

        // Update axis
        const newAxis = d3.axisBottom(newXScale).ticks(8).tickFormat(formatTime);
        svg.select<SVGGElement>('.x-axis').call(newAxis as never);
        svg.selectAll('.domain, .tick line').attr('stroke', lineColor);
        svg.selectAll('.tick text').attr('fill', textColor);
      });

    svg.call(zoom);

    // Store zoom on the SVG element for programmatic control (REQ-004-FN-018)
    (svgRef.current as any).__zoom_behavior = zoom;
    (svgRef.current as any).__zoom_width = width;
    (svgRef.current as any).__zoom_height = totalHeight;

  }, [filteredEntries, workSeqGroups, totalHeight, theme, selectEntry, showConnections, labelMode, filteredSeqs, state.indices.parentChildMap, state.indices.entryMap, pairing]);

  useEffect(() => {
    renderTimeline();
  }, [renderTimeline]);

  useEffect(() => {
    const handleResize = () => renderTimeline();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderTimeline]);

  // Programmatic zoom controls (REQ-004-FN-018)
  const handleZoomIn = useCallback(() => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current as any;
    const zoom = svgEl.__zoom_behavior;
    if (!zoom) return;
    d3.select(svgRef.current).transition().duration(300).call(zoom.scaleBy, 1.5);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current as any;
    const zoom = svgEl.__zoom_behavior;
    if (!zoom) return;
    d3.select(svgRef.current).transition().duration(300).call(zoom.scaleBy, 1 / 1.5);
  }, []);

  const handleFitAll = useCallback(() => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current as any;
    const zoom = svgEl.__zoom_behavior;
    if (!zoom) return;
    d3.select(svgRef.current).transition().duration(300).call(zoom.transform, d3.zoomIdentity);
  }, []);

  if (filteredEntries.length === 0) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
        No entries match current filters.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar: controls above the chart */}
      <div style={{
        padding: '4px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        borderBottom: '1px solid var(--border-primary)',
        flexShrink: 0,
      }}>
        {/* REQ-004-FN-016: Connection toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showConnections}
            onChange={(e) => setShowConnections(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Show Connections
        </label>

        {/* REQ-004-FN-017: Label mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <span style={{ marginRight: '4px' }}>Labels:</span>
          <button
            onClick={() => setLabelMode('taskId')}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              border: '1px solid var(--border-primary)',
              borderRadius: '3px 0 0 3px',
              backgroundColor: labelMode === 'taskId' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: labelMode === 'taskId' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Task ID
          </button>
          <button
            onClick={() => setLabelMode('requirements')}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              border: '1px solid var(--border-primary)',
              borderLeft: 'none',
              borderRadius: '0 3px 3px 0',
              backgroundColor: labelMode === 'requirements' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: labelMode === 'requirements' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Requirements
          </button>
        </div>

        {/* REQ-004-FN-018: Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
          <button
            onClick={handleZoomOut}
            style={{
              padding: '2px 8px',
              fontSize: '14px',
              border: '1px solid var(--border-primary)',
              borderRadius: '3px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              lineHeight: 1,
            }}
            title="Zoom Out"
          >
            -
          </button>
          <button
            onClick={handleZoomIn}
            style={{
              padding: '2px 8px',
              fontSize: '14px',
              border: '1px solid var(--border-primary)',
              borderRadius: '3px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              lineHeight: 1,
            }}
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleFitAll}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              border: '1px solid var(--border-primary)',
              borderRadius: '3px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="Fit All"
          >
            Fit All
          </button>
        </div>
      </div>

      {/* REQ-004-FN-019: Two-column layout with sticky labels */}
      <div
        ref={outerContainerRef}
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Label column - sticky left */}
        <div style={{
          width: LABEL_COLUMN_WIDTH,
          flexShrink: 0,
          overflowY: 'hidden',
          borderRight: '1px solid var(--border-primary)',
        }}>
          <svg ref={labelSvgRef} />
        </div>

        {/* Chart area - scrollable (REQ-004-FN-019) */}
        <div
          ref={chartContainerRef}
          style={{
            flex: 1,
            overflow: 'auto',
          }}
          onScroll={(e) => {
            // Sync label column vertical scroll with chart scroll
            const target = e.currentTarget;
            if (labelSvgRef.current && labelSvgRef.current.parentElement) {
              labelSvgRef.current.parentElement.scrollTop = target.scrollTop;
            }
          }}
        >
          <svg ref={svgRef} />
        </div>
      </div>

      {/* Tooltip (REQ-004-FN-020) */}
      {tooltipEntry && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x + 12,
            top: tooltipPos.y + 12,
            zIndex: 1000,
            padding: '8px 12px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: '12px',
            maxWidth: '320px',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '2px' }}>
            {tooltipEntry.agent} - {tooltipEntry.action}
          </div>
          {tooltipEntry.task_id && (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              {tooltipEntry.task_id}
            </div>
          )}
          {tooltipEntry.details && (
            <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
              {tooltipEntry.details.length > TOOLTIP_DETAILS_MAX_LENGTH
                ? tooltipEntry.details.substring(0, TOOLTIP_DETAILS_MAX_LENGTH) + '...'
                : tooltipEntry.details}
            </div>
          )}
          <div style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '11px' }}>
            {new Date(tooltipEntry.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};
