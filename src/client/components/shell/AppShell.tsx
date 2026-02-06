/**
 * Main application shell layout.
 * UI-001: Navigation bar, main content area, collapsible filter sidebar.
 * UI-003: Single active view, filter state preserved across switches.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useLog } from '../../store/LogContext';
import { useFilePicker } from '../../hooks/useFilePicker';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { FileWatcher } from '../../services/file-watcher';
import { ViewId } from '../../config/constants';
import { NavBar } from './NavBar';
import { FilterSidebar } from './FilterSidebar';
import { DetailPanel } from './DetailPanel';
import { EmptyState } from './EmptyState';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { TimelineView } from '../views/TimelineView/TimelineView';
import { DashboardView } from '../views/DashboardView/DashboardView';
import { HeatmapView } from '../views/HeatmapView/HeatmapView';
import { TraceabilityView } from '../views/TraceabilityView/TraceabilityView';

export const AppShell: React.FC = () => {
  const { state, loadFile, appendEntries } = useLog();
  const { pickFile, reReadFile } = useFilePicker();
  const [activeView, setActiveView] = useState<ViewId>('timeline');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liveTailActive, setLiveTailActive] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<string | null>(null);
  const fileWatcherRef = useRef(new FileWatcher());
  const mainContentRef = useRef<HTMLDivElement>(null);

  const handleLoadFile = useCallback(async () => {
    const result = await pickFile();
    if (result) {
      loadFile(result.content, result.fileName, result.filePath);
    }
  }, [pickFile, loadFile]);

  const handleToggleLiveTail = useCallback(() => {
    if (liveTailActive) {
      fileWatcherRef.current.stop();
      setLiveTailActive(false);
    } else {
      fileWatcherRef.current.start(reReadFile, {
        onNewContent: (content: string) => {
          appendEntries(content);
          setLastPollTime(new Date().toLocaleTimeString());
        },
        onError: (error: Error, failures: number) => {
          console.warn(`Live tail error (${failures}):`, error.message);
        },
        onDisabled: () => {
          setLiveTailActive(false);
        },
      });
      setLiveTailActive(true);
    }
  }, [liveTailActive, reReadFile, appendEntries]);

  const handleManualRefresh = useCallback(async () => {
    if (fileWatcherRef.current.isActive) {
      await fileWatcherRef.current.pollNow();
    } else {
      const content = await reReadFile();
      if (content) {
        appendEntries(content);
      }
    }
  }, [reReadFile, appendEntries]);

  const handleExport = useCallback(async () => {
    if (!mainContentRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(mainContentRef.current);
      const link = document.createElement('a');
      link.download = `alv-${activeView}-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [activeView]);

  // Expose loadFile for E2E testing (dev only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__loadActivityLog = loadFile;
    }
    return () => {
      if (import.meta.env.DEV) {
        delete (window as any).__loadActivityLog;
      }
    };
  }, [loadFile]);

  useKeyboardShortcuts({
    onViewChange: setActiveView,
    onToggleTheme: () => {},
    onToggleSidebar: () => setSidebarOpen((prev) => !prev),
    onLoadFile: handleLoadFile,
    onRefresh: handleManualRefresh,
  });

  const renderView = () => {
    if (!state.metadata.fileName) {
      return <EmptyState onLoadFile={handleLoadFile} />;
    }

    switch (activeView) {
      case 'timeline':
        return <TimelineView />;
      case 'dashboard':
        return <DashboardView />;
      case 'heatmap':
        return <HeatmapView />;
      case 'traceability':
        return <TraceabilityView />;
      default:
        return <TimelineView />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <NavBar
        activeView={activeView}
        onViewChange={setActiveView}
        onLoadFile={handleLoadFile}
        liveTailActive={liveTailActive}
        onToggleLiveTail={handleToggleLiveTail}
        onExport={handleExport}
        lastPollTime={lastPollTime}
      />
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        <FilterSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main
          ref={mainContentRef}
          style={{
            flex: 1,
            overflow: 'auto',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <ErrorBoundary>
            {renderView()}
          </ErrorBoundary>
        </main>
        <DetailPanel />
      </div>
    </div>
  );
};
