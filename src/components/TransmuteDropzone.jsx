import { useRef, useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, FileSpreadsheet, Cpu, CheckCircle2, Presentation } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';

export const TransmuteDropzone = memo(function TransmuteDropzone({
  status,
  processingPhase,
  onFilesSelected,
  activeFileName,
  showRenderPulse = false,
  batchCount = 0,
  activeMode = 'image',
}) {
  const { t } = useLanguage();
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
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
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

  const modeConfig = {
    image: {
      headline: t('dropHeadlineImage'),
      accept: '.png,.jpg,.jpeg,.webp,.avif,.heic,.svg,image/png,image/jpeg,image/webp,image/avif,image/svg+xml',
      extensions: ['PNG', 'JPG', 'WEBP', 'AVIF', 'SVG'],
      subtitle: t('dropSubtitleImage'),
      Icon: UploadCloud,
    },
    pdf: {
      headline: t('dropHeadlinePdf'),
      accept: '.pdf,application/pdf',
      extensions: [t('dropMultiPdfBadge')],
      subtitle: t('dropSubtitlePdf'),
      Icon: FileText,
    },
    data: {
      headline: t('dropHeadlineData'),
      accept: '.json,.csv,application/json,text/csv',
      extensions: ['JSON', 'CSV'],
      subtitle: t('dropSubtitleData'),
      Icon: FileSpreadsheet,
    },
    presentation: {
      headline: t('dropHeadlinePresentation') || 'Drop PowerPoint presentations to convert, or',
      accept: '.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint',
      extensions: ['PPTX', 'PPT'],
      subtitle: t('dropSubtitlePresentation') || 'Client-side Presentation Parser • Zero cloud egress',
      Icon: Presentation,
    },
  };

  const currentMode = modeConfig[activeMode] || modeConfig.image;
  const ModeIcon = currentMode.Icon;

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
        accept={currentMode.accept}
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
          'group relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 sm:p-10 text-center transition-all outline-none select-none',
          'bg-zinc-50/90 dark:bg-zinc-900/40 shadow-xs',
          isDragOver
            ? 'border-[#FF5A1F] bg-[#FF5A1F]/[0.08] scale-[1.01]'
            : 'border-zinc-300 dark:border-zinc-700/80 hover:border-[#FF5A1F] hover:bg-zinc-100/90 dark:hover:bg-zinc-900/70',
          isFocused && 'ring-2 ring-[#FF5A1F]/40 border-[#FF5A1F]',
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
              <Cpu className="h-9 w-9 text-[#FF5A1F] animate-pulse" strokeWidth={1.5} />

              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#FF5A1F] animate-ping" />
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                    {processingPhase || 'WORKER_POOL_PARALLEL'}
                  </p>
                </div>
                <p className="max-w-xs truncate font-mono text-[11px] text-[var(--text-muted)]">
                  {batchCount > 1 ? t('parallelBatch', { count: batchCount }) : activeFileName}
                </p>
              </div>

              {/* Progress Track Micro-Line */}
              <div className="h-1 w-56 overflow-hidden rounded-full bg-[var(--border-color)]">
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
              className="flex flex-col items-center gap-3"
            >
              <CheckCircle2 className="h-9 w-9 text-emerald-500 dark:text-emerald-400" strokeWidth={1.5} />

              <div className="space-y-1">
                <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                  {t('cycleComplete')}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {batchCount > 1 ? t('filesProcessed', { count: batchCount }) : t('readySingle', { name: activeFileName })}
                </p>
              </div>

              <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] group-hover:text-[#FF5A1F] transition-colors">
                <span>{t('dropMoreOrClick')}</span>
              </span>
            </motion.div>
          ) : (
            /* STATE 3: Idle - Highly visible interactive dropzone with clear cues */
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 max-w-md"
            >
              <ModeIcon
                className="h-10 w-10 text-[#FF5A1F] transition-transform group-hover:scale-110"
                strokeWidth={1.5}
              />

              <div className="space-y-1">
                <p className="text-sm sm:text-base font-semibold tracking-tight text-[var(--text-primary)]">
                  {currentMode.headline}{' '}
                  <span className="text-[#FF5A1F] hover:underline underline-offset-4 font-bold">
                    {t('browseFiles')}
                  </span>
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {currentMode.subtitle}
                </p>
              </div>

              <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                {currentMode.extensions.map((ext) => (
                  <span
                    key={ext}
                    className="rounded border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-800/80 px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-600 dark:text-zinc-400 shadow-2xs"
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
