/**
 * File System Access API wrapper hook.
 * SI-001: Use window.showOpenFilePicker() for file selection.
 * FR-LFM-004: Retain file handle for live tail re-reads.
 */

import { useState, useCallback, useRef } from 'react';

interface FilePickerResult {
  content: string;
  fileName: string;
  filePath: string;
}

interface UseFilePickerReturn {
  pickFile: () => Promise<FilePickerResult | null>;
  reReadFile: () => Promise<string | null>;
  hasFileHandle: boolean;
  fileName: string | null;
}

export function useFilePicker(): UseFilePickerReturn {
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const pickFile = useCallback(async (): Promise<FilePickerResult | null> => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Log Files',
            accept: {
              'text/plain': ['.log', '.jsonl'],
            },
          },
        ],
        multiple: false,
      });

      if (!handle) return null;
      fileHandleRef.current = handle;
      const file = await handle.getFile();
      const content = await file.text();
      const name = file.name;
      setFileName(name);

      return {
        content,
        fileName: name,
        filePath: name,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }, []);

  const reReadFile = useCallback(async (): Promise<string | null> => {
    if (!fileHandleRef.current) return null;

    try {
      const file = await fileHandleRef.current.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }, []);

  return {
    pickFile,
    reReadFile,
    hasFileHandle: fileHandleRef.current !== null,
    fileName,
  };
}
