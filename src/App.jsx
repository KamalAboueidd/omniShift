import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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

const ACCEPT_ATTRIBUTE = '.png,.jpg,.jpeg,.webp,.avif,.heic,.pdf,.svg,.json,.csv,image/png,image/jpeg,image/webp,image/avif,application/pdf,image/svg+xml,application/json,text/csv';

export const App = () => {
  const { t } = useLanguage();
  const [currentView, setCurrentView] = useState('studio'); // 'studio' | 'guide'
  const [mode, setMode] = useState('image'); // 'image' | 'pdf' | 'data'
  const [targetMimeType, setTargetMimeType] = useState('image/webp');

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
    mergePdfFiles,
    retransmuteItem,
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
    const rawFiles = workbenchFiles.map((f) => f.file).filter(Boolean);
    const pdfFiles = rawFiles.filter((f) => f.name?.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (pdfFiles.length >= 2) return 'multiple-pdf';

    if (rawFiles.length > 0) {
      const first = rawFiles[0];
      const lower = first.name?.toLowerCase() || '';
      if (lower.endsWith('.json') || lower.endsWith('.csv') || first.type?.includes('json') || first.type?.includes('csv')) {
        return 'data';
      }
      if (lower.endsWith('.svg') || first.type?.includes('svg')) {
        return 'svg';
      }
      if (lower.endsWith('.pdf') || first.type === 'application/pdf') {
        return 'pdf';
      }
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

      // Adjust default target MIME and active mode automatically based on file type
      const first = newFiles[0];
      const lower = first.name?.toLowerCase() || '';
      let nextMime = targetMimeType;

      if (lower.endsWith('.json')) {
        nextMime = 'text/csv';
        setMode('data');
      } else if (lower.endsWith('.csv')) {
        nextMime = 'application/json';
        setMode('data');
      } else if (lower.endsWith('.svg')) {
        nextMime = 'image/svg+xml';
        setMode('image');
      } else if (lower.endsWith('.pdf') || first.type === 'application/pdf') {
        nextMime = 'application/pdf';
        setMode('pdf');
      } else {
        nextMime = 'image/webp';
        setMode('image');
      }

      setTargetMimeType(nextMime);

      // Simulate realistic upload / buffer reading into client memory
      setIsIngestingFiles(true);
      setIngestionProgress(25);

      const t1 = setTimeout(() => {
        setIngestionProgress(75);
      }, 150);

      const t2 = setTimeout(() => {
        setIngestionProgress(100);

        const mappedItems = newFiles.map((file) => ({
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'staged',
        }));

        setWorkbenchFiles((prev) => [...prev, ...mappedItems]);
        setConversionState('staged');
        setIsIngestingFiles(false);
      }, 350);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    },
    [targetMimeType]
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
    clearQueue();
  }, [clearQueue]);

  // Convert with another format without re-selecting files
  const handleReconvertAnotherFormat = useCallback(() => {
    setWorkbenchFiles((prev) =>
      prev.map((item) => ({
        id: item.id || `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file: item.file,
        name: item.file?.name || item.name || item.fileName,
        size: item.file?.size || item.size || item.originalBytes,
        type: item.file?.type || item.type,
        status: 'staged',
      }))
    );
    setConversionState('staged');
    setWasAutoDownloaded(false);
  }, []);

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

  // Execute standard 3-step conversion flow with smooth 12-15s pacing from 1% to 100%
  const handleStartConversion = useCallback(async () => {
    if (workbenchFiles.length === 0) return;

    setIsProcessing(true);
    setConversionState('converting');
    setProcessingStep(0);
    setProcessingProgress(1);
    setWasAutoDownloaded(false);

    let progressTimer = null;

    try {
      const rawFiles = workbenchFiles.map((f) => f.file).filter(Boolean);
      const isMultiPdf = rawFiles.length >= 2 && rawFiles.every(
        (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
      );

      // 1. Kick off actual client-side transmutation task
      const conversionPromise = (isMultiPdf && targetMimeType === 'application/pdf')
        ? mergePdfFiles(rawFiles)
        : enqueueFiles(rawFiles, targetMimeType, 1.0);

      // 2. Smoothly animate progress from 1% to 100% over ~13.5 seconds (135ms per 1%)
      const animationPromise = new Promise((resolve) => {
        let current = 1;
        progressTimer = setInterval(() => {
          current += 1;
          setProcessingProgress(current);

          if (current >= 89) {
            setProcessingStep(3);
          } else if (current >= 66) {
            setProcessingStep(2);
          } else if (current >= 26) {
            setProcessingStep(1);
          } else {
            setProcessingStep(0);
          }

          if (current >= 100) {
            clearInterval(progressTimer);
            resolve();
          }
        }, 135);
      });

      // Wait for both conversion computation and the smooth visual pacing
      const [results] = await Promise.all([conversionPromise, animationPromise]);

      setProcessingProgress(100);
      setProcessingStep(3);
      await new Promise((r) => setTimeout(r, 280)); // Brief pause at 100%

      const validResults = (results || []).filter(Boolean);
      if (validResults.length > 0) {
        setWorkbenchFiles(validResults);
        setConversionState('completed');

        // Auto-Download trigger when enabled
        if (autoDownload) {
          setTimeout(() => {
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
          }, 180);
        }
      } else {
        setConversionState('staged');
      }
    } catch (err) {
      console.error('Conversion failed:', err);
      setConversionState('staged');
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setIsProcessing(false);
    }
  }, [workbenchFiles, targetMimeType, autoDownload, enqueueFiles, mergePdfFiles, handleDownloadAllZip]);

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
              {/* Step 1: Mode Switcher & Dropzone (when no files staged and not ingesting) */}
              {!hasFiles && !isIngestingFiles && (
                <>
                  <div className="flex items-center justify-center gap-1 sm:gap-2 mb-4 select-none flex-nowrap overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('image');
                        setTargetMimeType('image/webp');
                      }}
                      className={`px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        mode === 'image'
                          ? 'bg-[#FF5A1F] text-black shadow-2xs font-bold'
                          : 'text-[var(--text-muted)] hover:text-[#FF5A1F] bg-transparent'
                      }`}
                    >
                      {t('modeImages')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('pdf');
                        setTargetMimeType('application/pdf');
                      }}
                      className={`px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        mode === 'pdf'
                          ? 'bg-[#FF5A1F] text-black shadow-2xs font-bold'
                          : 'text-[var(--text-muted)] hover:text-[#FF5A1F] bg-transparent'
                      }`}
                    >
                      {t('modePdf')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('data');
                        setTargetMimeType('text/csv');
                      }}
                      className={`px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        mode === 'data'
                          ? 'bg-[#FF5A1F] text-black shadow-2xs font-bold'
                          : 'text-[var(--text-muted)] hover:text-[#FF5A1F] bg-transparent'
                      }`}
                    >
                      {t('modeData')}
                    </button>
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
                    onSelectSample={(sampleFile) => handleFilesSelected([sampleFile])}
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
                  onReconvertAnotherFormat={handleReconvertAnotherFormat}
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
