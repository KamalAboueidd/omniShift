import { useState, useEffect, memo, useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const GlobalDropOverlay = memo(function GlobalDropOverlay({ onFilesDropped }) {
  const { t } = useLanguage();
  const [isDragActive, setIsDragActive] = useState(false);

  const resetDrag = useCallback(() => {
    setIsDragActive(false);
  }, []);

  useEffect(() => {
    let dragCounter = 0;

    const handleWindowDragEnter = (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
        dragCounter++;
        setIsDragActive(true);
      }
    };

    const handleWindowDragLeave = (e) => {
      e.preventDefault();
      dragCounter--;
      // Dismiss if cursor leaves window boundaries
      if (
        dragCounter <= 0 ||
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight ||
        !e.relatedTarget
      ) {
        dragCounter = 0;
        setIsDragActive(false);
      }
    };

    const handleWindowDragOver = (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleWindowDrop = (e) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragActive(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFilesDropped(Array.from(e.dataTransfer.files));
      }
    };

    const handleEscapeOrBlur = () => {
      dragCounter = 0;
      setIsDragActive(false);
    };

    // Use capture phase so listeners intercept even if child elements attempt to cancel bubbling
    window.addEventListener('dragenter', handleWindowDragEnter, true);
    window.addEventListener('dragleave', handleWindowDragLeave, true);
    window.addEventListener('dragover', handleWindowDragOver, true);
    window.addEventListener('drop', handleWindowDrop, true);
    window.addEventListener('dragend', handleEscapeOrBlur, true);
    window.addEventListener('blur', handleEscapeOrBlur);
    window.addEventListener('mouseup', handleEscapeOrBlur);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter, true);
      window.removeEventListener('dragleave', handleWindowDragLeave, true);
      window.removeEventListener('dragover', handleWindowDragOver, true);
      window.removeEventListener('drop', handleWindowDrop, true);
      window.removeEventListener('dragend', handleEscapeOrBlur, true);
      window.removeEventListener('blur', handleEscapeOrBlur);
      window.removeEventListener('mouseup', handleEscapeOrBlur);
    };
  }, [onFilesDropped]);

  if (!isDragActive) return null;

  return (
    <div 
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDragLeave={(e) => {
        if (e.target === e.currentTarget) {
          resetDrag();
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        resetDrag();

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onFilesDropped(Array.from(e.dataTransfer.files));
        }
      }}
      className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center p-6 bg-[#0A0A0A]/85 backdrop-blur-xs select-none transition-all duration-150 animate-in fade-in cursor-copy"
    >
      <div className="w-full max-w-2xl h-72 rounded-xl border-2 border-dashed border-[#FF5A1F] bg-[#121212]/90 flex flex-col items-center justify-center gap-3 p-6 text-center shadow-2xl shadow-[#FF5A1F]/10 pointer-events-none">
        <UploadCloud className="h-10 w-10 text-[#FF5A1F] animate-bounce" strokeWidth={1.5} />
        
        <div className="space-y-1">
          <p className="text-base font-bold text-[var(--text-primary)]">
            {t('dropAnywhere')}
          </p>
          <p className="text-xs text-[var(--text-muted)] font-mono">
            {t('dropIdleZeroUpload')}
          </p>
        </div>
      </div>
    </div>
  );
});
