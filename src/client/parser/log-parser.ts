/**
 * JSON Lines log file parser with validation.
 * FR-LFM-002: Parse each line independently as JSON.
 * FR-LFM-003: Skip malformed lines, increment counter.
 */

import { LogEntry, REQUIRED_FIELDS, ParseResult } from '../types/log-entry';

export function parseLine(line: string): LogEntry | null {
  if (!line.trim()) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in parsed) || parsed[field] === undefined || parsed[field] === null) {
      return null;
    }
  }

  const entry: LogEntry = {
    log_seq: parsed.log_seq as number,
    work_seq: String(parsed.work_seq ?? ''),
    timestamp: String(parsed.timestamp ?? ''),
    agent: String(parsed.agent ?? ''),
    action: String(parsed.action ?? '') as LogEntry['action'],
    phase: String(parsed.phase ?? ''),
    parent_log_seq: (parsed.parent_log_seq as number | null) ?? null,
    requirements: Array.isArray(parsed.requirements)
      ? (parsed.requirements as string[])
      : [],
    task_id: (parsed.task_id as string | null) ?? null,
    details: String(parsed.details ?? ''),
    files_created: Array.isArray(parsed.files_created)
      ? (parsed.files_created as string[])
      : [],
    files_modified: Array.isArray(parsed.files_modified)
      ? (parsed.files_modified as string[])
      : [],
    decisions: Array.isArray(parsed.decisions)
      ? (parsed.decisions as string[])
      : [],
    errors: Array.isArray(parsed.errors) ? (parsed.errors as string[]) : [],
    duration_ms: (parsed.duration_ms as number | null) ?? null,
  };

  return entry;
}

export function parseLogContent(content: string): ParseResult {
  const startTime = performance.now();
  const lines = content.split('\n');
  const entries: LogEntry[] = [];
  let skippedLines = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const entry = parseLine(line);
    if (entry) {
      entries.push(entry);
    } else {
      skippedLines++;
    }
  }

  const parseTimeMs = performance.now() - startTime;

  return { entries, skippedLines, parseTimeMs };
}

/**
 * Parse only new content appended since the last read.
 * FR-LT-002: Incremental update, not full re-parse.
 */
export function parseIncrementalContent(
  content: string,
  lastLogSeq: number
): ParseResult {
  const startTime = performance.now();
  const lines = content.split('\n');
  const entries: LogEntry[] = [];
  let skippedLines = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const entry = parseLine(line);
    if (entry) {
      if (entry.log_seq > lastLogSeq) {
        entries.push(entry);
      }
    } else {
      skippedLines++;
    }
  }

  const parseTimeMs = performance.now() - startTime;
  return { entries, skippedLines, parseTimeMs };
}

/**
 * Expand requirement range expressions.
 * FR-RTM-002: "REQ-CORE-FN-001 through REQ-CORE-FN-051" -> individual IDs.
 */
export function expandRequirementRange(rangeStr: string): string[] {
  const rangePattern = /^(.+-?)(\d+)\s+through\s+\1(\d+)$/i;
  const match = rangeStr.match(rangePattern);

  if (!match) {
    return [rangeStr];
  }

  const prefix = match[1]!;
  const start = parseInt(match[2]!, 10);
  const end = parseInt(match[3]!, 10);
  const padLength = match[2]!.length;

  if (start > end) return [rangeStr];

  const results: string[] = [];
  for (let i = start; i <= end; i++) {
    results.push(`${prefix}${String(i).padStart(padLength, '0')}`);
  }
  return results;
}

/**
 * Expand all requirement references in an array, handling ranges.
 */
export function expandAllRequirements(requirements: string[]): string[] {
  const expanded: string[] = [];
  for (const req of requirements) {
    expanded.push(...expandRequirementRange(req));
  }
  return expanded;
}
