import { useRef, useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Cpu, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

const SUPPORTED_EXTENSIONS = ['PNG', 'JPG', 'WEBP', 'AVIF', 'PDF', 'SVG', 'JSON', 'CSV'];
const ACCEPT_ATTRIBUTE = '.png,.jpg,.jpeg,.webp,.avif,.heic,.pdf,.svg,.json,.csv,image/png,image/jpeg,image/webp,image/avif,application/pdf,image/svg+xml,application/json,text/csv';

export const TransmuteDropzone = memo(function TransmuteDropzone({
  status,
  processingPhase,
  onFilesSelected,
  activeFileName,
  showRenderPulse = false,
  batchCount = 0,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef(null);
  const [renders, setRenders] = useState(1);

  useEffect(() => {
    if (showRenderPulse) {
      setRenders((r) => r + 1);
    }
  }, [status, processingPhase, activeFileName, batchCount, showRenderPulse]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onFilesSelected(files);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
      e.target.value = '';
    }
  };

  const triggerFileDialog = () => {
    if (status !== 'transmuting') {
      fileInputRef.current?.click();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerFileDialog();
    }
  };

  const isBusy = status === 'analyzing' || status === 'transmuting';

  return (
    <div
      style={{ contain: 'layout paint' }}
      className="relative w-full min-h-[220px]"
    >
      {/* Dev Render Pulse Indicator */}
      {showRenderPulse && (
        <span className="absolute -top-2 right-3 font-mono text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30 z-10">
          renders: {renders}
        </span>
      )}

      {/* Hidden Multi-file Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        onChange={handleInputChange}
        className="sr-only"
        aria-label="Upload files for batch client-side transmutation"
        disabled={isBusy}
      />

      {/* Drop Surface with GPU transform physics */}
      <motion.div
        role="button"
        tabIndex={0}
        onClick={triggerFileDialog}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        animate={{
          scale: isDragOver ? 1.006 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
        }}
        className={cn(
          'group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 sm:p-10 text-center transition-colors outline-none select-none',
          'bg-[var(--bg-surface-1)]',
          isDragOver
            ? 'border-[#FF5A1F] bg-[#FF5A1F]/[0.05]'
            : 'border-[var(--border-color)] hover:border-[#FF5A1F]/40 hover:bg-[var(--bg-surface-2)]',
          isFocused && 'ring-1 ring-[#FF5A1F]/50 border-[#FF5A1F]',
          isBusy && 'cursor-wait pointer-events-none'
        )}
      >
        <AnimatePresence mode="wait">
          {/* STATE 1: Transmuting in Web Worker Pool */}
          {isBusy ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0, transform: 'translateY(6px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              exit={{ opacity: 0, transform: 'translateY(-6px)' }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center gap-3.5"
            >
              <Cpu className="h-8 w-8 text-[#FF5A1F] animate-pulse" strokeWidth={1.25} />

              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF5A1F] animate-ping" />
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                    {processingPhase || 'WORKER_POOL_PARALLEL'}
                  </p>
                </div>
                <p className="max-w-xs truncate font-mono text-[11px] text-[var(--text-muted)]">
                  {batchCount > 1 ? `Parallel Batch (${batchCount} Files)` : activeFileName}
                </p>
              </div>

              {/* Progress Track Micro-Line */}
              <div className="h-[2px] w-48 overflow-hidden rounded-full bg-[var(--border-color)]">
                <motion.div
                  className="h-full bg-[#FF5A1F]"
                  initial={{ transform: 'translateX(-100%)' }}
                  animate={{ transform: 'translateX(100%)' }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.9,
                    ease: 'easeInOut',
                  }}
                />
              </div>
            </motion.div>
          ) : status === 'completed' ? (
            /* STATE 2: Completed */
            <motion.div
              key="completed"
              initial={{ opacity: 0, transform: 'scale(0.98)' }}
              animate={{ opacity: 1, transform: 'scale(1)' }}
              exit={{ opacity: 0, transform: 'scale(0.98)' }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center gap-2.5"
            >
              <CheckCircle2 className="h-8 w-8 text-emerald-500 dark:text-emerald-400" strokeWidth={1.25} />

              <div className="space-y-1">
                <p className="text-sm font-medium tracking-tight text-[var(--text-primary)]">
                  Transmutation Cycle Complete
                </p>
                <p className="font-mono text-xs text-[var(--text-muted)]">
                  {batchCount > 1 ? `${batchCount} Files Processed in Parallel` : `${activeFileName} Ready`}
                </p>
              </div>

              <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
                <span>Drop additional files or click to add batch</span>
              </span>
            </motion.div>
          ) : (
            /* STATE 3: Idle - Clean upload icon with NO box/border/background */
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2.5"
            >
              <UploadCloud
                className="h-9 w-9 text-[var(--text-muted)] group-hover:text-[#FF5A1F] transition-colors"
                strokeWidth={1.2}
              />

              <div className="space-y-1">
                <p className="text-sm font-medium tracking-tight text-[var(--text-primary)]">
                  Drop 1 to 50+ files to transmute or{' '}
                  <span className="text-[#FF5A1F] underline underline-offset-4 decoration-[var(--border-color)] group-hover:decoration-[#FF5A1F]/40 transition-colors">
                    browse local drive
                  </span>
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Multi-threaded Worker Pool • Zero bytes uploaded to cloud
                </p>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                {SUPPORTED_EXTENSIONS.map((ext) => (
                  <span
                    key={ext}
                    className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)] transition-colors group-hover:border-[var(--border-color)]"
                  >
                    {ext}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
});
