# Activity Log Viewer

A web application for visualizing and monitoring activity logs produced by Claude Code sub-agent workflows.

## Features

- **Agent Timeline (Gantt Chart)** - True Gantt chart with duration bars spanning from START to COMPLETE for each work unit, color-coded green for success and red for failures. Bars are labeled by task ID or requirements (toggle), grouped by work sequence with visible headers, and support mouse wheel zoom, click-drag pan, +/- zoom buttons, and a Fit All reset. Agent labels stay pinned on horizontal scroll. Orphan STARTs show as striped indicators. Parent-child connection lines link bar edges with hover highlighting and toggle control
- **Phase Dashboard** - Phase progress overview with accurate work-unit-based completion statistics (grouped by agent+task, percentage never exceeds 100%), active agents, and decision log. Phases displayed in canonical workflow order
- **File Heatmap** - File modification frequency visualization with directory grouping and churn detection
- **Requirements Traceability** - Matrix showing requirement coverage across phases displayed in canonical workflow order (requirements, architecture, design, planning, implementation, review, testing, documentation, deployment)
- **Live Tail** - Automatic polling for new log entries with configurable interval
- **Filtering** - Multi-dimensional filtering by agent, action, phase, and work sequence
- **Themes** - Light and dark theme support with persistence
- **Export** - PNG screenshot export of any view
- **Keyboard Shortcuts** - Power-user keyboard navigation

## Prerequisites

- Node.js 18+
- Chrome 100+ or Edge 100+ (required for File System Access API)

## Quick Start

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Production build
npm run build

# Serve production build
npm start
```

The application will be available at `http://localhost:5173` (development) or `http://localhost:3000` (production).

## Usage

1. Open the application in Chrome or Edge
2. Click **Open** or press `Ctrl+O` to select an `activity.log` file
3. Navigate between views using the tabs or keyboard shortcuts `1-4`
4. Toggle the filter sidebar with `F` to narrow down entries
5. Click any entry to see full details in the slide-out panel
6. Enable **Live Tail** to automatically detect new entries

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Timeline view |
| `2` | Dashboard view |
| `3` | Heatmap view |
| `4` | Traceability view |
| `T` | Toggle theme |
| `R` | Refresh / re-read file |
| `F` | Toggle filter sidebar |
| `Ctrl+O` | Open file |
| `Escape` | Close detail panel |
| `?` | Show shortcut help |

## Log File Format

The application reads JSON Lines (`.log` or `.jsonl`) files where each line is a JSON object with fields including `log_seq`, `work_seq`, `timestamp`, `agent`, `action`, and `phase`. See the [requirements document](requirement-docs/001-requirements-activity-log-viewer.md) Appendix A for the full schema.

## Technology Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Visualization:** D3.js
- **Backend:** Node.js + Express (static file serving only)
- **Testing:** Vitest + React Testing Library

## Development

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint
```

## Project Structure

```
src/
  client/
    types/          # TypeScript interfaces
    parser/         # JSON Lines parser
    indexer/        # Derived data structure builder
    store/          # React Context providers (Log, Filter, Theme)
    hooks/          # Custom hooks (file picker, shortcuts, export)
    services/       # File watcher service
    components/
      shared/       # Reusable components (ActionBadge, ErrorBoundary)
      shell/        # App shell (NavBar, FilterSidebar, DetailPanel)
      views/        # View components (Timeline, Dashboard, Heatmap, Traceability)
    config/         # Constants and configuration
    styles/         # Global CSS and theme variables
  server/
    server.ts       # Express server
```

## License

Private - All rights reserved.
