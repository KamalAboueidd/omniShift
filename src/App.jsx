import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { TransmuteDropzone } from './components/TransmuteDropzone';
import { SamplePresets } from './components/SamplePresets';
import { StagedFilesWorkbench } from './components/StagedFilesWorkbench';
import { GlobalDropOverlay } from './components/GlobalDropOverlay';
import { GuidePage } from './components/GuidePage';
import { Footer } from './components/Footer';
import { useBatchTransmute } from './hooks/useBatchTransmute';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useLanguage } from './context/LanguageContext';
import { memoryManager } from './lib/memoryManager';
import { triggerDownload } from './lib/utils';
import { createWorkerInterval } from './lib/workerTimer';

const ACCEPT_ATTRIBUTE = '.png,.jpg,.jpeg,.webp,.avif,.heic,.pdf,.svg,.json,.csv,.pptx,.ppt,image/png,image/jpeg,image/webp,image/avif,application/pdf,image/svg+xml,application/json,text/csv,application/vnd.openxmlformats-officedocument.presentationml.presentation';

export const App = () => {
  const { t } = useLanguage();
  const [currentView, setCurrentView] = useState('studio'); // 'studio' | 'guide'
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

  // Handle files selected via dropzone, picker, presets, clipboard paste, or global viewport drop
  const handleFilesSelected = useCallback(
    (incomingFiles) => {
      if (!incomingFiles || incomingFiles.length === 0) return;

      const newFiles = Array.from(incomingFiles);
      setWasAutoDownloaded(false);

      let effectiveFiles = newFiles;
      let nextMime = 'image/webp';

      const hasPdf = newFiles.some((f) => (f.name || '').toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
      const hasImage = newFiles.some((f) => f.type?.startsWith('image/') || /\.(png|jpe?g|webp|avif|heic|bmp|gif|svg|ico)$/i.test(f.name || ''));

      // If user dropped BOTH PDFs and Images together, or is in combine mode:
      if (mode === 'combine' || (hasPdf && hasImage)) {
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
          setValidationNotice(null);
        }

        if (valid.length === 0) {
          setValidationNotice(t('combineNoValidFiles'));
          return;
        }

        effectiveFiles = valid;
      } else if (hasPdf) {
        setMode('pdf');
        nextMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        setValidationNotice(null);
      } else {
        setMode('image');
        const first = newFiles[0];
        const lower = (first.name || '').toLowerCase();
        nextMime = lower.endsWith('.svg') ? 'image/png' : 'image/webp';
        setValidationNotice(null);
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

      // If tab is in background, stage immediately without waiting
      if (typeof document !== 'undefined' && document.hidden) {
        setWorkbenchFiles((prev) => [...prev, ...mappedItems]);
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
        setWorkbenchFiles((prev) => [...prev, ...mappedItems]);
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
    []
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
  const handleDownloadAllZip = useCallback(async () => {
    const readyItems = workbenchFiles.filter((f) => f.status === 'READY' || f.blob);
    if (readyItems.length === 0) return;

    try {
      const JSZipModule = await import('jszip');
      const JSZip = JSZipModule.default || JSZipModule;
      const zip = new JSZip();

      for (const item of readyItems) {
        if (item.blob) {
          const name = item.outputFileName || item.fileName || item.name;
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

  // Execute conversion flow with smooth pacing and complete background-tab resilience
  const handleStartConversion = useCallback(async () => {
    if (workbenchFiles.length === 0) return;

    setIsProcessing(true);
    setConversionState('converting');
    setProcessingStep(0);
    setProcessingProgress(1);
    setWasAutoDownloaded(false);

    let stopTimer = null;
    let cleanupVisibility = null;

    try {
      const rawFiles = workbenchFiles.map((f) => f.file).filter(Boolean);
      const isMultiPdf = rawFiles.length >= 2 && rawFiles.every(
        (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
      );

      // Fast, snappy pacing (~600ms) with background worker resilience
      const targetDuration = 600;
      const startTime = Date.now();

      // 1. Kick off actual client-side transmutation task in Web Workers with optimal compression quality
      let conversionPromise;
      if (mode === 'combine') {
        conversionPromise = combineFiles(rawFiles);
      } else {
        conversionPromise = enqueueFiles(rawFiles, targetMimeType, 0.85);
      }

      // 2. Animate progress steadily at ~600ms pacing, continuing smoothly across background tabs
      const animationPromise = new Promise((resolve) => {
        let isDone = false;
        let conversionResolved = false;

        const updateStep = (pct) => {
          if (pct >= 89) setProcessingStep(3);
          else if (pct >= 66) setProcessingStep(2);
          else if (pct >= 26) setProcessingStep(1);
          else setProcessingStep(0);
        };

        const tick = () => {
          if (isDone) return;

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
          if (isDone) return;
          tick();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        cleanupVisibility = () => {
          document.removeEventListener('visibilitychange', onVisibilityChange);
        };
      });

      // Wait for both conversion computation and the smooth visual pacing
      const [results] = await Promise.all([conversionPromise, animationPromise]);

      setProcessingProgress(100);
      setProcessingStep(3);

      const isHidden = typeof document !== 'undefined' && document.hidden;
      if (!isHidden) {
        await new Promise((r) => setTimeout(r, 80)); // Brief micro-pause at 100%
      }

      const validResults = (results || []).filter(Boolean);
      if (validResults.length > 0) {
        setWorkbenchFiles(validResults);
        setConversionState('completed');

        // Auto-Download trigger when enabled
        if (autoDownload) {
          const runDownload = () => {
            if (validResults.length === 1 && (validResults[0].blob || validResults[0].downloadUrl)) {
              triggerDownload(
                validResults[0].blob || validResults[0].downloadUrl,
                validResults[0].outputFileName || validResults[0].fileName || validResults[0].name
              );
              setWasAutoDownloaded(true);
            } else if (validResults.length > 1) {
              handleDownloadAllZip();
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
        setConversionState('staged');
      }
    } catch (err) {
      console.error('Conversion failed:', err);
      setConversionState('staged');
    } finally {
      if (stopTimer) stopTimer();
      if (cleanupVisibility) cleanupVisibility();
      setIsProcessing(false);
    }
  }, [workbenchFiles, targetMimeType, autoDownload, enqueueFiles, combineFiles, handleDownloadAllZip, mode]);

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
        onNavigate={(view) => setCurrentView(view)}
      />

      {/* Main Breathing Canvas */}
      <main className="flex-1 w-full flex flex-col justify-center">
        {currentView === 'guide' ? (
          /* Guide Landing View */
          <GuidePage onBackToApp={() => setCurrentView('studio')} />
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
