/**
 * Live tail file watcher service.
 * FR-LT-001: Polling at 30-60 second intervals.
 * FR-LT-002: Incremental update, detect new entries.
 * FR-LT-005: Error recovery with retry and disable after 3 failures.
 */

import { LIVE_TAIL_INTERVAL_MS, LIVE_TAIL_MAX_FAILURES } from '../config/constants';

export interface FileWatcherCallbacks {
  onNewContent: (content: string) => void;
  onError: (error: Error, consecutiveFailures: number) => void;
  onDisabled: () => void;
}

export class FileWatcher {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private reReadFn: (() => Promise<string | null>) | null = null;
  private callbacks: FileWatcherCallbacks | null = null;
  private consecutiveFailures = 0;
  private _isActive = false;

  get isActive(): boolean {
    return this._isActive;
  }

  start(
    reReadFn: () => Promise<string | null>,
    callbacks: FileWatcherCallbacks,
    intervalMs: number = LIVE_TAIL_INTERVAL_MS
  ): void {
    this.stop();
    this.reReadFn = reReadFn;
    this.callbacks = callbacks;
    this.consecutiveFailures = 0;
    this._isActive = true;

    this.intervalId = setInterval(() => {
      void this.poll();
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._isActive = false;
  }

  async pollNow(): Promise<void> {
    await this.poll();
  }

  private async poll(): Promise<void> {
    if (!this.reReadFn || !this.callbacks) return;

    try {
      const content = await this.reReadFn();
      if (content === null) {
        throw new Error('File handle returned null');
      }
      this.consecutiveFailures = 0;
      this.callbacks.onNewContent(content);
    } catch (err) {
      this.consecutiveFailures++;
      const error = err instanceof Error ? err : new Error(String(err));
      this.callbacks.onError(error, this.consecutiveFailures);

      if (this.consecutiveFailures >= LIVE_TAIL_MAX_FAILURES) {
        this.stop();
        this.callbacks.onDisabled();
      }
    }
  }
}
