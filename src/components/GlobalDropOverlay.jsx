import { useState, useEffect, memo } from 'react';
import { UploadCloud } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const GlobalDropOverlay = memo(function GlobalDropOverlay({ onFilesDropped }) {
  const { t } = useLanguage();
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e) => {
      e.preventDefault();
      // Only react if files are being dragged
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
        dragCounter++;
        if (dragCounter === 1) {
          setIsDragActive(true);
        }
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsDragActive(false);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragActive(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFilesDropped(Array.from(e.dataTransfer.files));
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onFilesDropped]);

  if (!isDragActive) return null;

  return (
    <div 
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-6 bg-[#0A0A0A]/85 backdrop-blur-xs select-none transition-all duration-150 animate-in fade-in"
    >
      <div className="w-full max-w-2xl h-72 rounded-xl border-2 border-dashed border-[#FF5A1F] bg-[#121212]/90 flex flex-col items-center justify-center gap-3 p-6 text-center shadow-2xl shadow-[#FF5A1F]/10">
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
