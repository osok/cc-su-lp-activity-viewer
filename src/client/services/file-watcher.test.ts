/**
 * Unit tests for file watcher service.
 * Tests polling, error recovery, and disable behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileWatcher } from './file-watcher';

describe('FileWatcher', () => {
  let watcher: FileWatcher;

  beforeEach(() => {
    vi.useFakeTimers();
    watcher = new FileWatcher();
  });

  afterEach(() => {
    watcher.stop();
    vi.useRealTimers();
  });

  it('should start and stop', () => {
    const reRead = vi.fn().mockResolvedValue('content');
    const callbacks = {
      onNewContent: vi.fn(),
      onError: vi.fn(),
      onDisabled: vi.fn(),
    };

    watcher.start(reRead, callbacks, 1000);
    expect(watcher.isActive).toBe(true);

    watcher.stop();
    expect(watcher.isActive).toBe(false);
  });

  it('should poll at interval', async () => {
    const reRead = vi.fn().mockResolvedValue('{"log_seq":1}');
    const callbacks = {
      onNewContent: vi.fn(),
      onError: vi.fn(),
      onDisabled: vi.fn(),
    };

    watcher.start(reRead, callbacks, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    expect(reRead).toHaveBeenCalledTimes(1);
    expect(callbacks.onNewContent).toHaveBeenCalledWith('{"log_seq":1}');

    await vi.advanceTimersByTimeAsync(1000);
    expect(reRead).toHaveBeenCalledTimes(2);
  });

  it('should handle errors and count failures', async () => {
    const reRead = vi.fn().mockResolvedValue(null);
    const callbacks = {
      onNewContent: vi.fn(),
      onError: vi.fn(),
      onDisabled: vi.fn(),
    };

    watcher.start(reRead, callbacks, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it('should disable after 3 consecutive failures', async () => {
    const reRead = vi.fn().mockResolvedValue(null);
    const callbacks = {
      onNewContent: vi.fn(),
      onError: vi.fn(),
      onDisabled: vi.fn(),
    };

    watcher.start(reRead, callbacks, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(callbacks.onDisabled).toHaveBeenCalledTimes(1);
    expect(watcher.isActive).toBe(false);
  });

  it('should reset failure count on success', async () => {
    let callCount = 0;
    const reRead = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) return null;
      return 'content';
    });
    const callbacks = {
      onNewContent: vi.fn(),
      onError: vi.fn(),
      onDisabled: vi.fn(),
    };

    watcher.start(reRead, callbacks, 1000);

    await vi.advanceTimersByTimeAsync(1000); // fail 1
    await vi.advanceTimersByTimeAsync(1000); // fail 2
    await vi.advanceTimersByTimeAsync(1000); // success

    expect(callbacks.onError).toHaveBeenCalledTimes(2);
    expect(callbacks.onNewContent).toHaveBeenCalledTimes(1);
    expect(callbacks.onDisabled).not.toHaveBeenCalled();
    expect(watcher.isActive).toBe(true);
  });

  it('should support manual poll', async () => {
    const reRead = vi.fn().mockResolvedValue('content');
    const callbacks = {
      onNewContent: vi.fn(),
      onError: vi.fn(),
      onDisabled: vi.fn(),
    };

    watcher.start(reRead, callbacks, 60000);
    await watcher.pollNow();

    expect(reRead).toHaveBeenCalledTimes(1);
    expect(callbacks.onNewContent).toHaveBeenCalledWith('content');
  });
});
