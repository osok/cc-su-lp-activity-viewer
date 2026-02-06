/**
 * Core types for Activity Log Viewer log entries.
 * Mirrors the schema defined in Appendix A of the SRS.
 */

export type ActionType =
  | 'START'
  | 'COMPLETE'
  | 'DECISION'
  | 'REVIEW_PASS'
  | 'REVIEW_FAIL'
  | 'TEST_PASS'
  | 'TEST_FAIL'
  | 'ERROR'
  | 'FILE_CREATE'
  | 'FILE_MODIFY'
  | 'BLOCKED'
  | 'UNBLOCKED';

export interface LogEntry {
  log_seq: number;
  work_seq: string;
  timestamp: string;
  agent: string;
  action: ActionType;
  phase: string;
  parent_log_seq: number | null;
  requirements: string[];
  task_id: string | null;
  details: string;
  files_created: string[];
  files_modified: string[];
  decisions: string[];
  errors: string[];
  duration_ms: number | null;
}

export const REQUIRED_FIELDS: readonly string[] = [
  'log_seq',
  'timestamp',
  'agent',
  'action',
] as const;

export const KNOWN_ACTIONS: readonly string[] = [
  'START',
  'COMPLETE',
  'DECISION',
  'REVIEW_PASS',
  'REVIEW_FAIL',
  'TEST_PASS',
  'TEST_FAIL',
  'ERROR',
  'FILE_CREATE',
  'FILE_MODIFY',
  'BLOCKED',
  'UNBLOCKED',
] as const;

export interface FileStats {
  path: string;
  directory: string;
  createCount: number;
  modifyCount: number;
  totalCount: number;
  agents: Set<string>;
  isChurn: boolean;
}

export interface RequirementTrace {
  entry: LogEntry;
  phase: string;
  action: ActionType;
}

export interface FileMetadata {
  fileName: string;
  filePath: string;
  totalEntries: number;
  skippedLines: number;
  timestampRange: { earliest: string; latest: string } | null;
}

export interface ParseStats {
  parseTimeMs: number;
  lastPollTime: string | null;
  consecutiveFailures: number;
}

export interface ParseResult {
  entries: LogEntry[];
  skippedLines: number;
  parseTimeMs: number;
}

export interface PollResult {
  newEntries: LogEntry[];
  skippedLines: number;
  error: Error | null;
}
