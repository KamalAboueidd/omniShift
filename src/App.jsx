import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { TransmuteDropzone } from './components/TransmuteDropzone';
import { SamplePresets } from './components/SamplePresets';
import { StagedFilesWorkbench } from './components/StagedFilesWorkbench';
import { GlobalDropOverlay } from './components/GlobalDropOverlay';
import { GuidePage } from './components/GuidePage';
import { NotFoundPage } from './components/NotFoundPage';
import { Footer } from './components/Footer';
import { useBatchTransmute } from './hooks/useBatchTransmute';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useLanguage } from './context/LanguageContext';
import { memoryManager } from './lib/memoryManager';
import { triggerDownload } from './lib/utils';
import { createWorkerInterval } from './lib/workerTimer';

const ACCEPT_ATTRIBUTE = '.png,.jpg,.jpeg,.webp,.avif,.heic,.pdf,.svg,.json,.csv,.pptx,.ppt,image/png,image/jpeg,image/webp,image/avif,application/pdf,image/svg+xml,application/json,text/csv,application/vnd.openxmlformats-officedocument.presentationml.presentation';

// Robust browser memory protection limits
const MAX_BATCH_FILES = 20;
const MAX_BATCH_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB safe ceiling

const resolveViewFromLocation = () => {
  try {
    const path = (window.location.pathname || '').replace(/^\/+|\/+$/g, '').toLowerCase();
    const hash = (window.location.hash || '').replace(/^#\/?|\/+$/g, '').toLowerCase();
    const target = path || hash;
    if (!target || target === 'studio') return 'studio';
    if (target === 'guide' || target === 'docs') return 'guide';
    return 'notfound';
  } catch {
    return 'studio';
  }
};

export const App = () => {
  const { t } = useLanguage();
  const [currentView, setCurrentView] = useState(resolveViewFromLocation); // 'studio' | 'guide' | 'notfound'

  // Sync routing on browser Back / Forward buttons
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentView(resolveViewFromLocation());
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleNavigate = useCallback((view) => {
    setCurrentView(view);
    try {
      const targetPath = view === 'studio' ? '/' : `/${view}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view }, '', targetPath);
      }
    } catch {
      // ignore history errors
    }
  }, []);

  const [mode, setMode] = useState('image'); // 'image' | 'pdf' | 'data'
  const [targetMimeType, setTargetMimeType] = useState('image/webp');
  const [validationNotice, setValidationNotice] = useState(null);

  // Auto-Download setting (persisted in localStorage)
  const [autoDownload, setAutoDownload] = useState(() => {
    try {
      return localStorage.getItem('omnishift_auto_download') === 'true';
    } catch {
      return false;
    }
  });
  const [wasAutoDownloaded, setWasAutoDownloaded] = useState(false);

  // Staging upload ingestion state
  const [isIngestingFiles, setIsIngestingFiles] = useState(false);
  const [ingestionProgress, setIngestionProgress] = useState(0);

  // Single unified files array maintaining context across the 3 steps
  const [workbenchFiles, setWorkbenchFiles] = useState([]);
  const [conversionState, setConversionState] = useState('staged'); // 'staged' | 'converting' | 'completed'
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);

  const addMoreInputRef = useRef(null);

  const {
    enqueueFiles,
    clearQueue,
    cancelProcessing,
    downloadIndividual,
    combineFiles,
  } = useBatchTransmute();

  const handleToggleAutoDownload = useCallback((enabled) => {
    setAutoDownload(enabled);
    try {
      localStorage.setItem('omnishift_auto_download', enabled ? 'true' : 'false');
    } catch {
      // Ignored
    }
  }, []);

  // Track latest files and conversion state for atomic limit checks
  const workbenchFilesRef = useRef(workbenchFiles);
  useEffect(() => {
    workbenchFilesRef.current = workbenchFiles;
  }, [workbenchFiles]);

  const conversionStateRef = useRef(conversionState);
  useEffect(() => {
    conversionStateRef.current = conversionState;
  }, [conversionState]);

  // Classify active input context dynamically
  const activeFileType = useMemo(() => {
    if (mode === 'combine') return 'combine';

    const rawFiles = workbenchFiles.map((f) => f.file).filter(Boolean);
    if (rawFiles.length > 0) {
      const first = rawFiles[0];
      const lower = first.name?.toLowerCase() || '';
      if (lower.endsWith('.svg') || first.type?.includes('svg')) {
        return 'svg';
      }
      if (lower.endsWith('.pdf') || first.type === 'application/pdf') {
        return 'pdf';
      }
      return 'image';
    }
    return mode;
  }, [workbenchFiles, mode]);

  const pdfCount = useMemo(() => {
    const rawFiles = workbenchFiles.map((f) => f.file).filter(Boolean);
    return rawFiles.filter((f) => f.name?.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf').length;
  }, [workbenchFiles]);

  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Handle files selected via dropzone, picker, presets, clipboard paste, or global viewport drop
  const handleFilesSelected = useCallback(
    (incomingFiles) => {
      if (!incomingFiles || incomingFiles.length === 0) return;

      let newFiles = Array.from(incomingFiles);
      setWasAutoDownloaded(false);

      // 1. Filter out empty (0-byte) files
      const zeroByteFiles = newFiles.filter((f) => !f.size || f.size === 0);
      newFiles = newFiles.filter((f) => f.size && f.size > 0);
      let zeroAlert = null;
      if (zeroByteFiles.length > 0) {
        zeroAlert = t('emptyFilesNotice', {
          names: zeroByteFiles.map((f) => f.name || 'file').join(', '),
        });
      }
      if (newFiles.length === 0) {
        if (zeroAlert) setValidationNotice(zeroAlert);
        return;
      }

      // 2. Accumulative batch safety limits (existing + incoming)
      const isCompletedCycle = conversionStateRef.current === 'completed';
      const existingFiles = isCompletedCycle
        ? []
        : workbenchFilesRef.current.map((w) => w.file).filter(Boolean);
      const existingBytes = existingFiles.reduce((acc, f) => acc + (f.size || 0), 0);

      const availableSlots = Math.max(0, MAX_BATCH_FILES - existingFiles.length);
      if (availableSlots <= 0) {
        setValidationNotice(t('batchLimitReachedNotice', { max: MAX_BATCH_FILES }));
        return;
      }

      let limitAlert = zeroAlert;
      if (newFiles.length > availableSlots) {
        limitAlert = t('batchLimitNotice', { max: MAX_BATCH_FILES });
        newFiles = newFiles.slice(0, availableSlots);
      }

      // Check cumulative byte size
      const acceptedFiles = [];
      let currentTotalBytes = existingBytes;
      let sizeExceeded = false;

      for (const f of newFiles) {
        if (currentTotalBytes + (f.size || 0) <= MAX_BATCH_SIZE_BYTES) {
          acceptedFiles.push(f);
          currentTotalBytes += (f.size || 0);
        } else {
          sizeExceeded = true;
        }
      }

      if (sizeExceeded) {
        limitAlert = t('batchSizeNotice', { max: 100 });
      }

      if (acceptedFiles.length === 0) {
        setValidationNotice(t('batchSizeNotice', { max: 100 }));
        return;
      }

      newFiles = acceptedFiles;

      // 3. Evaluate combined roster for intelligent mode routing
      const allFiles = [...existingFiles, ...newFiles];
      const hasPdf = allFiles.some(
        (f) => (f.name || '').toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
      );
      const hasImage = allFiles.some(
        (f) => f.type?.startsWith('image/') || /\.(png|jpe?g|webp|avif|heic|bmp|gif|svg|ico)$/i.test(f.name || '')
      );
      const areMultiplePdfs =
        allFiles.length >= 2 &&
        allFiles.every(
          (f) => (f.name || '').toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
        );

      const currentMode = modeRef.current;
      let effectiveFiles = newFiles;
      let nextMime = 'image/webp';

      // If currently in Combine mode, OR user now has BOTH PDFs and Images, OR dropped multiple PDFs outside PDF mode:
      if (currentMode === 'combine' || (hasPdf && hasImage) || (currentMode !== 'pdf' && areMultiplePdfs)) {
        setMode('combine');
        nextMime = 'application/pdf';

        // Filter out any non-PDF, non-image files (e.g. video, audio, exe, archives)
        const valid = [];
        const invalidNames = [];
        for (const f of newFiles) {
          const name = (f.name || '').toLowerCase();
          const isP = name.endsWith('.pdf') || f.type === 'application/pdf';
          const isI = f.type?.startsWith('image/') || /\.(png|jpe?g|webp|avif|heic|bmp|gif|svg|ico)$/i.test(name);
          if (isP || isI) {
            valid.push(f);
          } else {
            invalidNames.push(f.name || 'file');
          }
        }

        if (invalidNames.length > 0) {
          setValidationNotice(t('combineUnsupportedNotice', { names: invalidNames.join(', ') }));
        } else {
          setValidationNotice(limitAlert);
        }

        if (valid.length === 0) {
          if (existingFiles.length === 0) {
            setValidationNotice(t('combineNoValidFiles'));
          }
          return;
        }

        effectiveFiles = valid;
      } else if (hasPdf) {
        setMode('pdf');
        // If 2+ PDFs dropped in Documents mode, default to Merge into 1 PDF (.pdf)
        nextMime = areMultiplePdfs
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        setValidationNotice(limitAlert);
      } else {
        setMode('image');
        const first = allFiles[0] || newFiles[0];
        const lower = (first?.name || '').toLowerCase();
        nextMime = lower.endsWith('.svg') ? 'image/png' : 'image/webp';
        setValidationNotice(limitAlert);
      }

      setTargetMimeType(nextMime);

      // Ingestion into client memory
      const mappedItems = effectiveFiles.map((file) => ({
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'staged',
      }));

      if (isCompletedCycle) {
        memoryManager.revokeAll();
      }

      // If tab is in background, stage immediately without waiting
      if (typeof document !== 'undefined' && document.hidden) {
        setWorkbenchFiles((prev) => (isCompletedCycle ? mappedItems : [...prev, ...mappedItems]));
        setConversionState('staged');
        setIsIngestingFiles(false);
        return;
      }

      setIsIngestingFiles(true);
      setIngestionProgress(35);

      let t1 = null;
      let t2 = null;

      const finishIngestion = () => {
        if (t1) clearTimeout(t1);
        if (t2) clearTimeout(t2);
        setWorkbenchFiles((prev) => (isCompletedCycle ? mappedItems : [...prev, ...mappedItems]));
        setConversionState('staged');
        setIsIngestingFiles(false);
      };

      t1 = setTimeout(() => {
        setIngestionProgress(80);
      }, 100);

      t2 = setTimeout(() => {
        finishIngestion();
      }, 220);

      const onVisibility = () => {
        if (document.hidden) {
          finishIngestion();
        }
      };
      document.addEventListener('visibilitychange', onVisibility, { once: true });

      return () => {
        if (t1) clearTimeout(t1);
        if (t2) clearTimeout(t2);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    },
    [t]
  );

  const handleRemoveStagedFile = useCallback((indexToRemove) => {
    setWorkbenchFiles((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToRemove);
      if (next.length === 0) {
        setConversionState('staged');
      }
      return next;
    });
  }, []);

  // Strict Memory Disposal: Cleanly revokes all ObjectURLs and resets queue state
  const handleClearAll = useCallback(() => {
    memoryManager.revokeAll();
    setWorkbenchFiles([]);
    setConversionState('staged');
    setWasAutoDownloaded(false);
    setValidationNotice(null);
    clearQueue();
  }, [clearQueue]);

  // Individual file direct download handler
  const handleDownloadIndividual = useCallback((id) => {
    const item = workbenchFiles.find((f) => f.id === id);
    if (item && (item.blob || item.downloadUrl)) {
      triggerDownload(item.blob || item.downloadUrl, item.outputFileName || item.fileName || item.name);
    } else {
      downloadIndividual(id);
    }
  }, [workbenchFiles, downloadIndividual]);

  // Multi-file ZIP Archive Downloader (using client-side JSZip in RAM)
  const handleDownloadAllZip = useCallback(async (customItems) => {
    const sourceItems = Array.isArray(customItems) && customItems.length > 0 ? customItems : workbenchFiles;
    const readyItems = sourceItems.filter((f) => f.status === 'READY' || f.blob);
    if (readyItems.length === 0) return;

    try {
      const JSZipModule = await import('jszip');
      const JSZip = JSZipModule.default || JSZipModule;
      const zip = new JSZip();

      const usedNames = new Set();
      for (const item of readyItems) {
        if (item.blob) {
          let name = item.outputFileName || item.fileName || item.name || 'file';
          if (usedNames.has(name)) {
            const dotIdx = name.lastIndexOf('.');
            const base = dotIdx !== -1 ? name.substring(0, dotIdx) : name;
            const ext = dotIdx !== -1 ? name.substring(dotIdx) : '';
            let counter = 1;
            while (usedNames.has(`${base}_${counter}${ext}`)) {
              counter++;
            }
            name = `${base}_${counter}${ext}`;
          }
          usedNames.add(name);
          zip.file(name, item.blob);
        }
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      triggerDownload(zipBlob, `omnishift_batch_${Date.now()}.zip`);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
    }
  }, [workbenchFiles]);

  const isCancelledRef = useRef(false);

  const handleCancelConversion = useCallback(() => {
    isCancelledRef.current = true;
    cancelProcessing();
    setIsProcessing(false);
    setConversionState('staged');
    setValidationNotice(t('conversionCancelled'));
  }, [cancelProcessing, t]);

  // Execute conversion flow with smooth pacing and complete background-tab resilience
  const handleStartConversion = useCallback(async () => {
    if (workbenchFiles.length === 0) return;

    isCancelledRef.current = false;
    setIsProcessing(true);
    setConversionState('converting');
    setProcessingStep(0);
    setProcessingProgress(1);
    setWasAutoDownloaded(false);

    let stopTimer = null;
    let cleanupVisibility = null;

    try {
      const rawFiles = workbenchFiles.map((f) => f.file).filter(Boolean);

      // Accurate, human-scale pacing (between 5 and 10 seconds based on batch size and byte weight)
      // Guarantees at least ~5 to 6 seconds for single files, and up to 8-10 seconds for larger batches
      const totalBatchBytes = rawFiles.reduce((acc, f) => acc + (f.size || 0), 0);
      const fileCountFactor = Math.min(2400, Math.max(0, rawFiles.length - 1) * 350);
      const byteSizeFactor = Math.min(2200, Math.round((totalBatchBytes / (1024 * 1024)) * 140));
      const targetDuration = Math.min(9800, 5200 + fileCountFactor + byteSizeFactor);
      const startTime = Date.now();

      // 1. Kick off actual client-side transmutation task in Web Workers with optimal compression quality
      let conversionPromise;
      if (mode === 'combine' || (targetMimeType === 'application/pdf' && rawFiles.length > 1)) {
        conversionPromise = combineFiles(rawFiles);
      } else {
        conversionPromise = enqueueFiles(rawFiles, targetMimeType, 0.85);
      }

      // 2. Animate progress steadily across the 5-10s duration, continuing smoothly across background tabs
      const animationPromise = new Promise((resolve) => {
        let isDone = false;
        let conversionResolved = false;

        const updateStep = (pct) => {
          if (pct >= 88) setProcessingStep(3); // preparing download
          else if (pct >= 62) setProcessingStep(2); // validating stream
          else if (pct >= 22) setProcessingStep(1); // multi-threaded worker encoding
          else setProcessingStep(0); // reading buffer
        };

        const tick = () => {
          if (isDone || isCancelledRef.current) return;

          const elapsed = Date.now() - startTime;
          // While conversion is running, cap at 92%. Once conversion completes, allow full progression to 100%
          const progressCap = conversionResolved ? 100 : 92;
          const current = Math.min(progressCap, Math.max(1, Math.floor((elapsed / targetDuration) * 100)));

          setProcessingProgress(current);
          updateStep(current);

          // Only finish when target duration has elapsed AND conversion is ready
          if (current >= 100 && conversionResolved) {
            isDone = true;
            resolve();
          }
        };

        conversionPromise.then(() => {
          conversionResolved = true;
          tick();
        }).catch(() => {
          conversionResolved = true;
          tick();
        });

        // Background-safe worker timer continues ticking in inactive/background tabs
        stopTimer = createWorkerInterval(tick, 35);

        // When returning to tab, sync progress to current timestamp immediately
        const onVisibilityChange = () => {
          if (isDone || isCancelledRef.current) return;
          tick();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        cleanupVisibility = () => {
          document.removeEventListener('visibilitychange', onVisibilityChange);
        };
      });

      // Wait for both conversion computation and the smooth visual pacing
      const [results] = await Promise.all([conversionPromise, animationPromise]);

      if (isCancelledRef.current) return;

      setProcessingProgress(100);
      setProcessingStep(3);

      const isHidden = typeof document !== 'undefined' && document.hidden;
      if (!isHidden) {
        await new Promise((r) => setTimeout(r, 80)); // Brief micro-pause at 100%
      }

      if (isCancelledRef.current) return;

      const allResults = (results || []).filter(Boolean);
      const readyResults = allResults.filter((r) => r.status === 'READY' || r.blob);
      const failedResults = allResults.filter((r) => r.status === 'FAILED');

      if (readyResults.length > 0) {
        setWorkbenchFiles(allResults);
        setConversionState('completed');

        // Alert user if any specific file in the batch failed
        if (failedResults.length > 0) {
          const names = failedResults.map((f) => f.fileName || f.name).join(', ');
          const firstErr = failedResults[0]?.error || failedResults[0]?.phase || '';
          setValidationNotice(t('partialConversionNotice', { names, error: firstErr }));
        }

        // Auto-Download trigger when enabled
        if (autoDownload) {
          const runDownload = () => {
            if (readyResults.length === 1 && (readyResults[0].blob || readyResults[0].downloadUrl)) {
              triggerDownload(
                readyResults[0].blob || readyResults[0].downloadUrl,
                readyResults[0].outputFileName || readyResults[0].fileName || readyResults[0].name
              );
              setWasAutoDownloaded(true);
            } else if (readyResults.length > 1) {
              handleDownloadAllZip(readyResults);
              setWasAutoDownloaded(true);
            }
          };

          if (isHidden) {
            runDownload();
          } else {
            setTimeout(runDownload, 80);
          }
        }
      } else {
        // All items failed or error occurred
        setWorkbenchFiles(allResults.length > 0 ? allResults : workbenchFiles);
        setConversionState(allResults.length > 0 ? 'completed' : 'staged');
        const firstErr = failedResults[0]?.error || failedResults[0]?.phase || 'Unknown error';
        setValidationNotice(t('allConversionFailedNotice', { error: firstErr }));
      }
    } catch (err) {
      if (!isCancelledRef.current) {
        console.error('Conversion failed:', err);
        setConversionState('staged');
        setValidationNotice(t('allConversionFailedNotice', { error: err.message || String(err) }));
      }
    } finally {
      if (stopTimer) stopTimer();
      if (cleanupVisibility) cleanupVisibility();
      setIsProcessing(false);
    }
  }, [workbenchFiles, targetMimeType, autoDownload, enqueueFiles, combineFiles, handleDownloadAllZip, mode, t]);

  const handleTriggerPdfMerge = useCallback(() => {
    if (workbenchFiles.length >= 2) {
      handleStartConversion();
    }
  }, [workbenchFiles, handleStartConversion]);

  const handleFormatChange = useCallback((newMime) => {
    setTargetMimeType(newMime);
  }, []);

  // Keyboard shortcut download (Cmd+D / Ctrl+S)
  const handleShortcutDownload = useCallback(() => {
    if (conversionState === 'completed' && workbenchFiles.length > 0) {
      if (workbenchFiles.length === 1) {
        handleDownloadIndividual(workbenchFiles[0].id);
      } else {
        handleDownloadAllZip();
      }
    }
  }, [conversionState, workbenchFiles, handleDownloadIndividual, handleDownloadAllZip]);

  // If autoDownload was enabled and conversion completed while in background,
  // ensure file download triggers immediately upon user returning to the tab
  useEffect(() => {
    const handleVisibilitySync = () => {
      if (!document.hidden && conversionState === 'completed' && autoDownload && !wasAutoDownloaded) {
        if (workbenchFiles.length === 1 && (workbenchFiles[0].blob || workbenchFiles[0].downloadUrl)) {
          triggerDownload(
            workbenchFiles[0].blob || workbenchFiles[0].downloadUrl,
            workbenchFiles[0].outputFileName || workbenchFiles[0].fileName || workbenchFiles[0].name
          );
          setWasAutoDownloaded(true);
        } else if (workbenchFiles.length > 1) {
          handleDownloadAllZip();
          setWasAutoDownloaded(true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilitySync);
    return () => document.removeEventListener('visibilitychange', handleVisibilitySync);
  }, [conversionState, autoDownload, wasAutoDownloaded, workbenchFiles, handleDownloadAllZip]);

  useGlobalShortcuts({
    onFilesPasted: (files) => {
      handleFilesSelected(files);
    },
    onDownload: handleShortcutDownload,
    onReset: handleClearAll,
    canDownload: conversionState === 'completed' && workbenchFiles.length > 0,
  });

  const hasFiles = workbenchFiles.length > 0;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-[#FF5A1F]/30 selection:text-[var(--text-primary)] transition-colors">
      {/* Global Viewport Drag & Drop Overlay */}
      <GlobalDropOverlay onFilesDropped={handleFilesSelected} />

      {/* Hidden Multi-file Input for "Add More" */}
      <input
        ref={addMoreInputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesSelected(Array.from(e.target.files));
            e.target.value = '';
          }
        }}
        className="sr-only"
        aria-hidden="true"
      />

      {/* 1. Header with Studio & Guide Navigation */}
      <Header 
        currentView={currentView}
        onNavigate={handleNavigate}
      />

      {/* Main Breathing Canvas */}
      <main className={`flex-1 w-full flex flex-col ${currentView === 'studio' ? 'justify-center' : 'justify-start'}`}>
        {currentView === 'guide' ? (
          /* Guide Landing View */
          <GuidePage onBackToApp={() => handleNavigate('studio')} />
        ) : currentView === 'notfound' ? (
          /* 404 Page Not Found View */
          <NotFoundPage onReturnToStudio={() => handleNavigate('studio')} />
        ) : (
          /* Studio View */
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
            {/* 2. Hero Section */}
            <Hero />

            {/* 3. Primary Workspace Area */}
            <div className="mt-2">
              {/* Validation & Unsupported File Notice */}
              {validationNotice && (
                <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>{validationNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValidationNotice(null)}
                    className="p-1 hover:bg-amber-500/20 rounded-md transition-colors text-amber-200 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Step 1: Mode Switcher & Dropzone (when no files staged and not ingesting) */}
              {!hasFiles && !isIngestingFiles && (
                <>
                  <div className="flex justify-center mb-4 px-2">
                    <div className="inline-flex items-center p-1 rounded-xl bg-[var(--bg-surface-1)] border border-[var(--border-subtle)] gap-1 max-w-full overflow-x-auto no-scrollbar">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('image');
                          setTargetMimeType('image/webp');
                        }}
                        className={`px-3 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          mode === 'image'
                            ? 'bg-[#FF5A1F] text-black shadow-xs font-semibold'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] font-medium'
                        }`}
                      >
                        {t('modeImages')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('pdf');
                          setTargetMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                        }}
                        className={`px-3 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          mode === 'pdf'
                            ? 'bg-[#FF5A1F] text-black shadow-xs font-semibold'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] font-medium'
                        }`}
                      >
                        {t('modePdf')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('combine');
                          setTargetMimeType('application/pdf');
                        }}
                        className={`px-3 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          mode === 'combine'
                            ? 'bg-[#FF5A1F] text-black shadow-xs font-semibold'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] font-medium'
                        }`}
                      >
                        {t('modeCombine')}
                      </button>
                    </div>
                  </div>

                  <TransmuteDropzone
                    status="idle"
                    processingPhase=""
                    activeFileName=""
                    onFilesSelected={handleFilesSelected}
                    batchCount={0}
                    activeMode={mode}
                  />

                  {/* Sample Presets to quickly test */}
                  <SamplePresets
                    disabled={isProcessing}
                    activeMode={mode}
                    onSelectSample={(sampleFiles) => handleFilesSelected(Array.isArray(sampleFiles) ? sampleFiles : [sampleFiles])}
                  />
                </>
              )}

              {/* Realistic Staging Ingestion Loading Meter */}
              {isIngestingFiles && (
                <div className="w-full mt-6 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-1)] p-6 text-center space-y-3 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#FF5A1F] font-semibold">{t('ingestingFiles')}</span>
                    <span className="font-bold text-[var(--text-primary)]">{ingestionProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface-2)] border border-[var(--border-subtle)]">
                    <div
                      className="h-full bg-[#FF5A1F] transition-all duration-200 ease-out rounded-full"
                      style={{ width: `${ingestionProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono">
                    {t('zeroBytesUploadedNotice')}
                  </p>
                </div>
              )}

              {/* Step 2 & 3: Staged Files Review, Live Conversion & Instant Download */}
              {hasFiles && !isIngestingFiles && (
                <StagedFilesWorkbench
                  files={workbenchFiles}
                  conversionState={conversionState}
                  onRemoveFile={handleRemoveStagedFile}
                  onAddMoreFiles={() => addMoreInputRef.current?.click()}
                  onClearAll={handleClearAll}
                  onStartConversion={handleStartConversion}
                  onCancelConversion={handleCancelConversion}
                  targetMimeType={targetMimeType}
                  onTargetMimeChange={handleFormatChange}
                  activeFileType={activeFileType}
                  isProcessing={isProcessing}
                  processingStep={processingStep}
                  processingProgress={processingProgress}
                  onTriggerPdfMerge={handleTriggerPdfMerge}
                  pdfCount={pdfCount}
                  onDownloadIndividual={handleDownloadIndividual}
                  onDownloadAllZip={handleDownloadAllZip}
                  autoDownload={autoDownload}
                  onToggleAutoDownload={handleToggleAutoDownload}
                  wasAutoDownloaded={wasAutoDownloaded}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* 5. Minimalist Modern Footer (with Language & Light/Dark/System Theme Controls) */}
      <Footer />
    </div>
  );
};

export default App;
