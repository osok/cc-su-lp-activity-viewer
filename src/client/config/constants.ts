/**
 * Application constants and configuration.
 * MA-003: Configurable values externalized, not hardcoded.
 */

export const DEFAULT_PORT = 3000;
export const LIVE_TAIL_INTERVAL_MS = 30000;
export const LIVE_TAIL_MAX_FAILURES = 3;
export const TOOLTIP_DETAILS_MAX_LENGTH = 120;

export const ACTION_COLORS: Record<string, { light: string; dark: string; label: string }> = {
  START:       { light: '#3b82f6', dark: '#60a5fa', label: 'Start' },
  COMPLETE:    { light: '#22c55e', dark: '#4ade80', label: 'Complete' },
  DECISION:    { light: '#a855f7', dark: '#c084fc', label: 'Decision' },
  REVIEW_PASS: { light: '#16a34a', dark: '#86efac', label: 'Review Pass' },
  REVIEW_FAIL: { light: '#ef4444', dark: '#f87171', label: 'Review Fail' },
  TEST_PASS:   { light: '#15803d', dark: '#a7f3d0', label: 'Test Pass' },
  TEST_FAIL:   { light: '#f97316', dark: '#fb923c', label: 'Test Fail' },
  ERROR:       { light: '#dc2626', dark: '#fca5a5', label: 'Error' },
  FILE_CREATE: { light: '#0891b2', dark: '#67e8f9', label: 'File Create' },
  FILE_MODIFY: { light: '#0d9488', dark: '#5eead4', label: 'File Modify' },
  BLOCKED:     { light: '#d97706', dark: '#fcd34d', label: 'Blocked' },
  UNBLOCKED:   { light: '#2563eb', dark: '#93bbfd', label: 'Unblocked' },
};

/**
 * Bar colors for Gantt chart duration bars.
 * REQ-003-FN-003: Green for success terminals, red for failure terminals.
 */
export const BAR_COLORS = {
  success: { light: '#22c55e', dark: '#4ade80' },
  failure: { light: '#ef4444', dark: '#f87171' },
  orphan:  { light: '#3b82f6', dark: '#60a5fa' },
} as const;

/**
 * Canonical workflow phase order.
 * REQ-002-FN-009: Defined once, used everywhere.
 */
export const CANONICAL_PHASE_ORDER: readonly string[] = [
  'requirements',
  'architecture',
  'design',
  'planning',
  'implementation',
  'review',
  'testing',
  'documentation',
  'deployment',
] as const;

/**
 * Sort phases by canonical workflow order.
 * REQ-002-FN-010: Unknown phases appear after known phases, sorted alphabetically.
 */
export function sortPhases(phases: string[]): string[] {
  return [...phases].sort((a, b) => {
    const ai = CANONICAL_PHASE_ORDER.indexOf(a);
    const bi = CANONICAL_PHASE_ORDER.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
}

export const VIEW_KEYS = {
  TIMELINE: '1',
  DASHBOARD: '2',
  HEATMAP: '3',
  TRACEABILITY: '4',
} as const;

export type ViewId = 'timeline' | 'dashboard' | 'heatmap' | 'traceability';

export const VIEWS: { id: ViewId; label: string; shortcut: string }[] = [
  { id: 'timeline', label: 'Timeline', shortcut: '1' },
  { id: 'dashboard', label: 'Dashboard', shortcut: '2' },
  { id: 'heatmap', label: 'Heatmap', shortcut: '3' },
  { id: 'traceability', label: 'Traceability', shortcut: '4' },
];
