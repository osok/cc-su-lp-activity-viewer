/**
 * Type declarations for the File System Access API.
 * Required because TypeScript's lib.dom.d.ts does not include these types.
 */

interface FileSystemFileHandle {
  getFile(): Promise<File>;
  kind: 'file';
  name: string;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  types?: FilePickerAcceptType[];
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
}

interface Window {
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
}
