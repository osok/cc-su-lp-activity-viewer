/**
 * PNG export hook using html2canvas.
 * FR-EXP-001: Capture currently visible view as PNG.
 * FR-EXP-004: Save to downloads via browser dialog.
 * FR-THM-005: Renders with current theme.
 */

import { useCallback } from 'react';

export function useExport(elementRef: React.RefObject<HTMLElement | null>) {
  const exportPng = useCallback(
    async (filename?: string) => {
      if (!elementRef.current) return;

      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(elementRef.current, {
          backgroundColor: null,
          useCORS: true,
        });

        const link = document.createElement('a');
        link.download = filename ?? `alv-export-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error('PNG export failed:', err);
      }
    },
    [elementRef]
  );

  return { exportPng };
}
