/**
 * Builds derived data structures from parsed log entries.
 * DR-002: Agent index, phase index, work_seq index, file frequency, requirement index, parent-child map.
 */

import {
  LogEntry,
  FileStats,
  RequirementTrace,
} from '../types/log-entry';
import { expandAllRequirements } from '../parser/log-parser';

export interface LogIndices {
  entryMap: Map<number, LogEntry>;
  agentIndex: Map<string, LogEntry[]>;
  phaseIndex: Map<string, LogEntry[]>;
  workSeqIndex: Map<string, LogEntry[]>;
  fileFrequencyMap: Map<string, FileStats>;
  requirementIndex: Map<string, RequirementTrace[]>;
  parentChildMap: Map<number, number[]>;
}

export function buildIndices(entries: LogEntry[]): LogIndices {
  const entryMap = new Map<number, LogEntry>();
  const agentIndex = new Map<string, LogEntry[]>();
  const phaseIndex = new Map<string, LogEntry[]>();
  const workSeqIndex = new Map<string, LogEntry[]>();
  const fileFrequencyMap = new Map<string, FileStats>();
  const requirementIndex = new Map<string, RequirementTrace[]>();
  const parentChildMap = new Map<number, number[]>();

  for (const entry of entries) {
    indexEntry(
      entry,
      entryMap,
      agentIndex,
      phaseIndex,
      workSeqIndex,
      fileFrequencyMap,
      requirementIndex,
      parentChildMap
    );
  }

  return {
    entryMap,
    agentIndex,
    phaseIndex,
    workSeqIndex,
    fileFrequencyMap,
    requirementIndex,
    parentChildMap,
  };
}

export function updateIndicesIncremental(
  indices: LogIndices,
  newEntries: LogEntry[]
): void {
  for (const entry of newEntries) {
    indexEntry(
      entry,
      indices.entryMap,
      indices.agentIndex,
      indices.phaseIndex,
      indices.workSeqIndex,
      indices.fileFrequencyMap,
      indices.requirementIndex,
      indices.parentChildMap
    );
  }
}

function indexEntry(
  entry: LogEntry,
  entryMap: Map<number, LogEntry>,
  agentIndex: Map<string, LogEntry[]>,
  phaseIndex: Map<string, LogEntry[]>,
  workSeqIndex: Map<string, LogEntry[]>,
  fileFrequencyMap: Map<string, FileStats>,
  requirementIndex: Map<string, RequirementTrace[]>,
  parentChildMap: Map<number, number[]>
): void {
  entryMap.set(entry.log_seq, entry);

  if (!agentIndex.has(entry.agent)) {
    agentIndex.set(entry.agent, []);
  }
  agentIndex.get(entry.agent)!.push(entry);

  if (entry.phase) {
    if (!phaseIndex.has(entry.phase)) {
      phaseIndex.set(entry.phase, []);
    }
    phaseIndex.get(entry.phase)!.push(entry);
  }

  if (!workSeqIndex.has(entry.work_seq)) {
    workSeqIndex.set(entry.work_seq, []);
  }
  workSeqIndex.get(entry.work_seq)!.push(entry);

  for (const filePath of entry.files_created) {
    updateFileStats(fileFrequencyMap, filePath, entry.agent, 'create');
  }
  for (const filePath of entry.files_modified) {
    updateFileStats(fileFrequencyMap, filePath, entry.agent, 'modify');
  }

  if (entry.requirements.length > 0) {
    const expanded = expandAllRequirements(entry.requirements);
    for (const reqId of expanded) {
      if (!requirementIndex.has(reqId)) {
        requirementIndex.set(reqId, []);
      }
      requirementIndex.get(reqId)!.push({
        entry,
        phase: entry.phase,
        action: entry.action,
      });
    }
  }

  if (entry.parent_log_seq !== null) {
    if (!parentChildMap.has(entry.parent_log_seq)) {
      parentChildMap.set(entry.parent_log_seq, []);
    }
    parentChildMap.get(entry.parent_log_seq)!.push(entry.log_seq);
  }
}

function updateFileStats(
  fileFrequencyMap: Map<string, FileStats>,
  filePath: string,
  agent: string,
  type: 'create' | 'modify'
): void {
  const directory = filePath.substring(0, filePath.lastIndexOf('/')) || '/';

  if (!fileFrequencyMap.has(filePath)) {
    fileFrequencyMap.set(filePath, {
      path: filePath,
      directory,
      createCount: 0,
      modifyCount: 0,
      totalCount: 0,
      agents: new Set(),
      isChurn: false,
    });
  }

  const stats = fileFrequencyMap.get(filePath)!;
  stats.agents.add(agent);

  if (type === 'create') {
    stats.createCount++;
  } else {
    stats.modifyCount++;
  }
  stats.totalCount = stats.createCount + stats.modifyCount;
  stats.isChurn = stats.createCount > 0 && stats.modifyCount > 0;
}

/**
 * Compute timestamp range from entries.
 */
export function computeTimestampRange(
  entries: LogEntry[]
): { earliest: string; latest: string } | null {
  const first = entries[0];
  if (entries.length === 0 || !first) return null;

  let earliest = first.timestamp;
  let latest = first.timestamp;

  for (const entry of entries) {
    if (entry.timestamp < earliest) earliest = entry.timestamp;
    if (entry.timestamp > latest) latest = entry.timestamp;
  }

  return { earliest, latest };
}
