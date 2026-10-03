import { useEffect, useCallback } from 'react';

/**
 * Power-User Keyboard & System Clipboard Hook
 * Handles Cmd/Ctrl+V paste, Cmd/Ctrl+S / Enter download, and Esc reset.
 *
 * @param {Object} options
 * @param {(files: File[]) => void} [options.onFilesPasted]
 * @param {() => void} [options.onDownload]
 * @param {() => void} [options.onReset]
 * @param {boolean} [options.canDownload]
 */
export function useGlobalShortcuts({
  onFilesPasted,
  onDownload,
  onReset,
  canDownload = false,
}) {
  // Global System Clipboard Paste Listener
  const handlePaste = useCallback(
    (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (!e.clipboardData) return;

      const files = [];

      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        for (let i = 0; i < e.clipboardData.files.length; i++) {
          files.push(e.clipboardData.files[i]);
        }
      } else if (e.clipboardData.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        onFilesPasted?.(files);
      }
    },
    [onFilesPasted]
  );

  // Keyboard Shortcuts Listener
  const handleKeyDown = useCallback(
    (e) => {
      const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape') {
        e.preventDefault();
        onReset?.();
        return;
      }

      if (modKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (canDownload) {
          onDownload?.();
        }
        return;
      }

      const target = e.target;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA');
      if (e.key === 'Enter' && !isInput && canDownload) {
        e.preventDefault();
        onDownload?.();
      }
    },
    [canDownload, onDownload, onReset]
  );

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePaste, handleKeyDown]);
}
