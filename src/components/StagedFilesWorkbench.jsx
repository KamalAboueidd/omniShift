import { memo, useMemo, useState, useEffect } from 'react';
import { 
  FileImage, 
  FileText, 
  FileSpreadsheet, 
  X, 
  Plus, 
  ArrowRight, 
  Cpu, 
  RotateCcw,
  CheckCircle2,
  Trash2,
  Download,
  Archive,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  Check,
  RefreshCw,
  Presentation,
  AlertTriangle,
} from 'lucide-react';
import { formatBytes, formatSizeDelta, triggerDownload, cn } from '../lib/utils';
import { ConversionControls } from './ConversionControls';
import { VisualDiffViewer } from './VisualDiffViewer';
import { memoryManager } from '../lib/memoryManager';
import { useLanguage } from '../context/LanguageContext';

export const StagedFilesWorkbench = memo(function StagedFilesWorkbench({
  files = [],
  conversionState = 'staged', // 'staged' | 'converting' | 'completed'
  onRemoveFile,
  onAddMoreFiles,
  onClearAll,
  onStartConversion,
  onCancelConversion,
  targetMimeType,
  onTargetMimeChange,
  activeFileType,
  isProcessing = false,
  processingStep = 0,
  processingProgress = 0,
  onTriggerPdfMerge,
  pdfCount = 0,
  onDownloadIndividual,
  onDownloadAllZip,
  onReconvertAnotherFormat,
  autoDownload = false,
  onToggleAutoDownload,
  wasAutoDownloaded = false,
}) {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const [showTelemetryDetails, setShowTelemetryDetails] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const isCompleted = conversionState === 'completed';

  // Manage in-memory Object URL for original image preview
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState(null);

  const firstFile = files[0];
  const isFirstImage = firstFile && (
    firstFile.type?.startsWith('image/') ||
    firstFile.name?.toLowerCase().match(/\.(png|jpe?g|webp|avif|gif)$/i)
  );

  // Create & manage preview URL for original image
  useEffect(() => {
    if (isFirstImage && firstFile?.file) {
      const url = memoryManager.create(firstFile.file, 'preview-original');
      setOriginalPreviewUrl(url);

      return () => {
        memoryManager.revoke(url);
      };
    } else {
      setOriginalPreviewUrl(null);
    }
  }, [firstFile?.file, isFirstImage]);

  const totalOriginalBytes = useMemo(() => {
    return files.reduce((acc, f) => acc + (f.originalBytes || f.size || 0), 0);
  }, [files]);

  const totalTransmutedBytes = useMemo(() => {
    if (!isCompleted) return 0;
    return files.reduce((acc, f) => {
      const bytes = f.blob?.size || f.telemetry?.transmutedBytes || f.size || 0;
      return acc + bytes;
    }, 0);
  }, [files, isCompleted]);

  const targetFormatLabel = useMemo(() => {
    if (targetMimeType.includes('webp')) return 'WEBP';
    if (targetMimeType.includes('png')) return 'PNG';
    if (targetMimeType.includes('jpeg')) return 'JPEG';
    if (targetMimeType.includes('avif')) return 'AVIF';
    if (targetMimeType.includes('word') || targetMimeType.includes('docx')) return 'DOCX';
    if (targetMimeType.includes('presentation') || targetMimeType.includes('powerpoint') || targetMimeType.includes('presentationml')) return 'PPTX';
    if (targetMimeType.includes('plain') || targetMimeType.includes('txt')) return 'TXT';
    if (targetMimeType.includes('pdf')) return 'PDF';
    if (targetMimeType.includes('zip')) return 'ZIP';
    if (targetMimeType.includes('json')) return 'JSON';
    if (targetMimeType.includes('csv')) return 'CSV';
    if (targetMimeType.includes('svg')) return 'SVG';
    return 'FILE';
  }, [targetMimeType]);

  const convertAnotherLabel = useMemo(() => {
    if (activeFileType === 'combine') {
      return t('convertAnotherCombine') || t('convertAnother');
    }
    if (activeFileType === 'presentation') {
      return t('convertAnotherPresentation') || 'Convert another presentation';
    }
    if (activeFileType === 'image' || isFirstImage) {
      return t('convertAnotherImage');
    }
    if (activeFileType === 'pdf' || activeFileType === 'multiple-pdf') {
      return t('convertAnotherPdf');
    }
    if (activeFileType === 'data') {
      return t('convertAnotherData');
    }
    if (activeFileType === 'svg') {
      return t('convertAnotherSvg');
    }
    return t('convertAnother');
  }, [activeFileType, isFirstImage, t]);

  const getFileIcon = (file, isSuccess = false, isFailed = false) => {
    if (isFailed) {
      return (
        <div className="relative">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
        </div>
      );
    }
    const name = (file.name || file.fileName || '').toLowerCase();
    if (name.endsWith('.pptx') || name.endsWith('.ppt') || file.type?.includes('presentation') || file.type?.includes('powerpoint')) {
      return (
        <div className="relative">
          <Presentation className="h-5 w-5 text-[#FF5A1F] shrink-0" />
          {isSuccess && (
            <CheckCircle2 className="h-3 w-3 text-emerald-500 absolute -bottom-1 -right-1 bg-[var(--bg-surface-1)] rounded-full" />
          )}
        </div>
      );
    }
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      return (
        <div className="relative">
          <FileText className="h-5 w-5 text-[#FF5A1F] shrink-0" />
          {isSuccess && (
            <CheckCircle2 className="h-3 w-3 text-emerald-500 absolute -bottom-1 -right-1 bg-[var(--bg-surface-1)] rounded-full" />
          )}
        </div>
      );
    }
    if (name.endsWith('.json') || name.endsWith('.csv') || file.type?.includes('json') || file.type?.includes('csv')) {
      return (
        <div className="relative">
          <FileSpreadsheet className="h-5 w-5 text-[#FF5A1F] shrink-0" />
          {isSuccess && (
            <CheckCircle2 className="h-3 w-3 text-emerald-500 absolute -bottom-1 -right-1 bg-[var(--bg-surface-1)] rounded-full" />
          )}
        </div>
      );
    }
    return (
      <div className="relative">
        <FileImage className="h-5 w-5 text-[#FF5A1F] shrink-0" />
        {isSuccess && (
          <CheckCircle2 className="h-3 w-3 text-emerald-500 absolute -bottom-1 -right-1 bg-[var(--bg-surface-1)] rounded-full" />
        )}
      </div>
    );
  };

  const processingPhases = [
    t('readingBuffer'),
    t('transmutingWorkers'),
    t('validatingStream'),
    t('finalizingOutput')
  ];

  const handleZipDownloadClick = async () => {
    if (onDownloadAllZip) {
      try {
        setIsZipping(true);
        await onDownloadAllZip();
      } finally {
        setIsZipping(false);
      }
    }
  };

  const handlePrimaryDownloadClick = () => {
    if (files.length === 1) {
      const first = files[0];
      if (onDownloadIndividual) {
        onDownloadIndividual(first.id || 0);
      } else {
        triggerDownload(first);
      }
    } else {
      handleZipDownloadClick();
    }
  };

  const handleStartFresh = () => {
    onClearAll?.();
    setTimeout(() => {
      onAddMoreFiles?.();
    }, 60);
  };

  return (
    <div className="w-full mt-6 space-y-4">
      {/* Top Bar: Title & Primary Actions */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span 
            className={`flex h-2 w-2 rounded-full ${
              isCompleted 
                ? 'bg-[#FF5A1F]' 
                : isProcessing 
                ? 'bg-[#FF5A1F] animate-pulse' 
                : 'bg-[#FF5A1F]'
            }`} 
          />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isCompleted 
              ? t('conversionComplete')
              : t('stagedFilesTitle', { count: files.length })}
          </h3>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            • {formatBytes(totalOriginalBytes)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Feature 1: Subtle Auto-Download Toggle */}
          <label className="group inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[#FF5A1F] transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoDownload}
              onChange={(e) => onToggleAutoDownload && onToggleAutoDownload(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[var(--border-color)] bg-[var(--bg-surface-2)] text-[#FF5A1F] accent-[#FF5A1F] cursor-pointer"
            />
            <span className="text-[11px] font-mono hidden sm:inline text-[var(--text-muted)] group-hover:text-[#FF5A1F] transition-colors">
              {t('autoDownload')}
            </span>
          </label>

          {!isCompleted && !isProcessing && (
            <button
              type="button"
              onClick={onAddMoreFiles}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-3)] hover:text-[#FF5A1F] transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{activeFileType === 'combine' ? t('addMoreFiles') : t('addMore')}</span>
            </button>
          )}

          {isCompleted && (
            <button
              type="button"
              onClick={handleStartFresh}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[#FF5A1F] transition-colors cursor-pointer select-none py-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{convertAnotherLabel}</span>
            </button>
          )}

          {!isCompleted && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClearAll}
              className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('clearAll')}</span>
            </button>
          )}
        </div>
      </div>

      {/* When 1 Image is converted: Interactive Visual Diff Viewer */}
      {isCompleted && files.length === 1 && isFirstImage && originalPreviewUrl && (
        <VisualDiffViewer
          originalUrl={originalPreviewUrl}
          transmutedUrl={firstFile.downloadUrl}
          originalBytes={firstFile.originalBytes || firstFile.file?.size || 0}
          transmutedBytes={firstFile.blob?.size || firstFile.telemetry?.transmutedBytes || 0}
          targetFormat={targetFormatLabel}
          isRecomputing={false}
        />
      )}

      {/* File Cards Grid (Always visible with direct download action per file) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
          {files.map((item, idx) => {
            const itemOriginalBytes = item.originalBytes || item.size || 0;
            const itemTransmutedBytes = item.blob?.size || item.telemetry?.transmutedBytes;
            const displayName = isCompleted && item.outputFileName ? item.outputFileName : (item.name || item.fileName);
            const isItemFailed = item.status === 'FAILED';
            const isItemReady = (item.status === 'READY' || (isCompleted && Boolean(item.blob))) && !isItemFailed;

            return (
              <div
                key={item.id || `${item.name}_${idx}`}
                className={cn(
                  'group relative flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors',
                  isItemFailed
                    ? 'border-red-500/40 bg-red-500/5'
                    : 'border-[var(--border-color)] bg-[var(--bg-surface-1)] hover:border-zinc-400 dark:hover:border-zinc-600'
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="shrink-0">
                    {getFileIcon(item, isItemReady, isItemFailed)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[170px] sm:max-w-[190px]">
                      {displayName}
                    </p>
                    
                    {/* Status & Size Metric */}
                    {isItemFailed ? (
                      <p className="text-[11px] font-mono text-red-500 font-medium truncate max-w-[190px]" title={item.error || item.phase}>
                        {item.error || item.phase || t('failedBadge')}
                      </p>
                    ) : isItemReady && itemTransmutedBytes !== undefined ? (
                      <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                        {formatSizeDelta(itemOriginalBytes, itemTransmutedBytes, isArabic)}
                      </p>
                    ) : isProcessing ? (
                      <p className="text-[11px] font-mono text-[#FF5A1F] flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                        <span>{t('converting')}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-[var(--text-muted)] font-mono">
                        {formatBytes(itemOriginalBytes)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Action Button: Show download only in multi-file batch if ready */}
                {isCompleted && files.length > 1 && isItemReady ? (
                  <button
                    type="button"
                    onClick={() => onDownloadIndividual && onDownloadIndividual(item.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-[#FF5A1F] px-2.5 py-1 text-xs font-semibold text-black hover:bg-[#ff6f3b] transition-colors cursor-pointer shrink-0 shadow-2xs"
                    aria-label={`Download ${displayName}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t('download')}</span>
                  </button>
                ) : !isCompleted && !isProcessing ? (
                  <button
                    type="button"
                    onClick={() => onRemoveFile && onRemoveFile(idx)}
                    className="p-1 text-[var(--text-muted)] hover:text-[#FF5A1F] transition-colors cursor-pointer"
                    aria-label={`Remove ${item.name || item.fileName}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

      {/* Controls & Action Box */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-1)] p-4 sm:p-5 shadow-xs">
        {/* If Staged: Format Controls */}
        {!isCompleted && (
          <ConversionControls
            activeFileType={activeFileType}
            targetMimeType={targetMimeType}
            onTargetMimeChange={onTargetMimeChange}
            onTriggerPdfMerge={onTriggerPdfMerge}
            disabled={isProcessing}
            pdfCount={pdfCount}
            files={files}
          />
        )}

        {/* State: Processing Progress */}
        {isProcessing && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-[#FF5A1F]">
                <Cpu className="h-4 w-4 animate-spin" />
                <span className="font-semibold">
                  {processingPhases[processingStep] || t('transmutingWorkers')}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-[var(--text-primary)]">{processingProgress}%</span>
                {onCancelConversion && (
                  <button
                    type="button"
                    onClick={onCancelConversion}
                    className="px-2 py-0.5 rounded text-[11px] font-mono text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 border border-[var(--border-subtle)] transition-colors cursor-pointer"
                  >
                    {t('cancelConversion')}
                  </button>
                )}
              </div>
            </div>

            {/* Smooth Progress Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface-2)] border border-[var(--border-subtle)]">
              <div
                className="h-full bg-[#FF5A1F] transition-all duration-300 ease-out rounded-full"
                style={{ width: `${processingProgress}%` }}
              />
            </div>
            
            <p className="text-center text-[11px] text-[var(--text-muted)] font-mono">
              {t('zeroBytesUploadedNotice')}
            </p>
          </div>
        )}

        {/* State: Staged Ready to Convert */}
        {!isCompleted && !isProcessing && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[var(--text-muted)] font-mono">
              {activeFileType === 'combine'
                ? t('readyToCombine', { count: files.length })
                : t('readyToTransmute', { 
                    count: files.length, 
                    plural: files.length > 1 ? 's' : '' 
                  })}
            </span>

            {/* Clean, Standard-height Action Button */}
            <button
              type="button"
              onClick={onStartConversion}
              className="w-full sm:w-auto h-10 sm:h-11 px-5 rounded-lg bg-[#FF5A1F] text-xs sm:text-sm font-semibold text-black hover:bg-[#ff6f3b] transition-colors cursor-pointer shadow-xs inline-flex items-center justify-center gap-2"
            >
              <span>
                {activeFileType === 'combine' || (targetMimeType === 'application/pdf' && files.length > 1)
                  ? (files.every((f) => (f.name || f.fileName || '').toLowerCase().endsWith('.pdf') || (f.type || f.file?.type) === 'application/pdf')
                      ? t('combinePdfButton', { count: files.length })
                      : files.every((f) => (f.type || f.file?.type)?.startsWith('image/') || /\.(png|jpe?g|webp|avif|heic|bmp|svg)$/i.test(f.name || f.fileName || ''))
                      ? t('combineImagesButton', { count: files.length })
                      : t('combineMixedButton', { count: files.length }))
                  : files.length > 1
                  ? t('transmuteTo', { count: files.length, format: targetFormatLabel })
                  : t('convertTo', { format: targetFormatLabel })}
              </span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        )}

        {/* State: Completed -> Instant Download */}
        {isCompleted && (
          <div className="space-y-4">

            {/* Batch Aggregate Metric if multiple files */}
            {files.length > 1 && totalTransmutedBytes > 0 && (
              <div className="p-3 rounded-lg bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <span className="text-[var(--text-muted)]">
                  {t('filesProcessed', { count: files.length })}
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatSizeDelta(totalOriginalBytes, totalTransmutedBytes, isArabic)}
                </span>
              </div>
            )}

            {/* Main Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-[var(--border-subtle)]">
              {/* Reset RAM cleanly to stage new files / return to home */}
              <button
                type="button"
                onClick={handleStartFresh}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[#FF5A1F] transition-colors cursor-pointer py-1.5 select-none"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{convertAnotherLabel}</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap">
                {wasAutoDownloaded && (
                  <span className="text-[11px] font-mono text-emerald-500 flex items-center gap-1 whitespace-nowrap shrink-0">
                    <Check className="h-3.5 w-3.5" />
                    <span>{t('autoDownloadedNotification')}</span>
                  </span>
                )}

                {/* Primary CTA Button: Download [Format], Download All (.ZIP), or Download Again */}
                <button
                  type="button"
                  onClick={handlePrimaryDownloadClick}
                  disabled={isZipping}
                  className="w-full sm:w-auto h-8 sm:h-9 px-3.5 sm:px-4 rounded-lg bg-[#FF5A1F] text-[11px] sm:text-xs font-bold text-black hover:bg-[#ff6f3b] transition-colors cursor-pointer shadow-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  {isZipping ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      <span className="whitespace-nowrap">Packing .ZIP in RAM...</span>
                    </>
                  ) : wasAutoDownloaded ? (
                    <>
                      <Download className="h-3.5 w-3.5 shrink-0" />
                      <span className="whitespace-nowrap">{t('downloadAgain')}</span>
                    </>
                  ) : files.length > 1 ? (
                    <>
                      <Archive className="h-3.5 w-3.5 shrink-0" />
                      <span className="whitespace-nowrap">{t('downloadAllZip')}</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5 shrink-0" />
                      <span className="whitespace-nowrap">{t('downloadFormat', { format: targetFormatLabel })}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Subtle In-Memory Privacy & Telemetry Row */}
            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Zap className="h-3 w-3" />
                <span>{t('zeroBytesUploadedNotice')}</span>
              </span>

              {files[0]?.telemetry?.latencyMs && (
                <button
                  type="button"
                  onClick={() => setShowTelemetryDetails(!showTelemetryDetails)}
                  className="hover:text-[var(--text-primary)] transition-colors cursor-pointer inline-flex items-center gap-1 opacity-80"
                >
                  <span>{files[0].telemetry.latencyMs}ms</span>
                  {showTelemetryDetails ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>

            {/* Optional Collapsible Telemetry Details */}
            {showTelemetryDetails && files[0]?.telemetry && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] font-mono">
                <div className="rounded bg-[var(--bg-surface-2)] p-2 border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] block text-[10px]">{t('latency')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{files[0].telemetry.latencyMs} ms</span>
                </div>
                <div className="rounded bg-[var(--bg-surface-2)] p-2 border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] block text-[10px]">{t('throughput')}</span>
                  <span className="font-bold text-emerald-500">{files[0].telemetry.throughputMbps} MB/s</span>
                </div>
                <div className="rounded bg-[var(--bg-surface-2)] p-2 border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] block text-[10px]">Worker Thread</span>
                  <span className="font-bold text-[#FF5A1F]">{files[0].telemetry.workerCoreId || 'Worker 0'}</span>
                </div>
                <div className="rounded bg-[var(--bg-surface-2)] p-2 border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] block text-[10px]">{t('reduction')}</span>
                  <span className="font-bold text-[#FF5A1F]">
                    {files[0].telemetry.reductionPercentage > 0
                      ? `+${files[0].telemetry.reductionPercentage}%`
                      : `${files[0].telemetry.reductionPercentage}%`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
