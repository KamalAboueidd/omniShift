import { useState, useCallback, memo, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { TransmuteDropzone } from './components/TransmuteDropzone';
import { SamplePresets } from './components/SamplePresets';
import { ConversionControls } from './components/ConversionControls';
import { BatchQueueHUD } from './components/BatchQueueHUD';
import { TelemetryHUD } from './components/TelemetryHUD';
import { RuntimeMonitor } from './components/RuntimeMonitor';
import { ArchitectureModal } from './components/ArchitectureModal';
import { useBatchTransmute } from './hooks/useBatchTransmute';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { Terminal, Cpu, Database, Network, Activity, Command, FileSpreadsheet, Layers, Combine, ChevronDown, ChevronUp } from 'lucide-react';
import appIcon from './assets/icon.png';

// Isolated Log Console with Mobile Accordion Collapse
const EngineLogConsole = memo(function EngineLogConsole({ logs }) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  return (
    <section
      style={{ contain: 'content' }}
      className="mt-10 sm:mt-14 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-1)] p-3 sm:p-4 transition-colors"
    >
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-[#FF5A1F]" strokeWidth={1.25} />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
            Local Engine Activity
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)]">
          <span className="hidden sm:flex items-center gap-1">
            <Cpu className="h-3 w-3 text-emerald-500 dark:text-emerald-400" strokeWidth={1} />
            Dedicated Worker Pool
          </span>
          <span className="hidden sm:inline text-[var(--border-color)]">•</span>
          <span className="flex items-center gap-1">
            <Database className="h-3 w-3 text-[#FF5A1F]" strokeWidth={1} />
            0 Bytes Network
          </span>

          {/* Mobile Accordion Toggle */}
          <button
            type="button"
            onClick={() => setIsOpenMobile((v) => !v)}
            className="md:hidden inline-flex items-center gap-1 text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ml-2"
          >
            <span>{isOpenMobile ? 'Hide Log' : 'View Log'}</span>
            {isOpenMobile ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Log list: always visible on desktop (md), expandable on mobile */}
      <div
        className={`mt-3 space-y-1.5 font-mono text-[11px] max-h-48 overflow-y-auto ${
          isOpenMobile ? 'block' : 'hidden md:block'
        }`}
      >
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
            <span className="text-[var(--text-muted)] opacity-50 shrink-0">{log.time}</span>
            <span
              className={
                log.level === 'KERNEL'
                  ? 'text-[#FF5A1F] font-medium shrink-0'
                  : log.level === 'WORKER'
                  ? 'text-cyan-500 dark:text-cyan-400 font-medium shrink-0'
                  : 'text-[var(--text-muted)] font-medium shrink-0'
              }
            >
              [{log.level}]
            </span>
            <span className="text-[var(--text-muted)] break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
});

export const App = () => {
  const [targetMimeType, setTargetMimeType] = useState('image/webp');
  const [quality, setQuality] = useState(0.85);
  const [showRenderPulse, setShowRenderPulse] = useState(false);
  const [isArchModalOpen, setIsArchModalOpen] = useState(false);
  const [lastSelectedFiles, setLastSelectedFiles] = useState([]);

  const [logs, setLogs] = useState([
    {
      id: 'init-1',
      time: '00:00.001',
      level: 'KERNEL',
      message: 'Worker Pool initialized with Raster, Vector SVG, PDF, and Data (JSON/CSV/XLSX) engines.',
    },
    {
      id: 'init-2',
      time: '00:00.003',
      level: 'INFO',
      message: 'All transformations execute strictly in-memory. Zero server roundtrips.',
    },
  ]);

  const addLog = useCallback((level, message) => {
    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}.${String(Math.floor(now.getMilliseconds())).padStart(3, '0')}`;
    setLogs((prev) => [
      ...prev.slice(-8),
      {
        id: Math.random().toString(36).substring(2, 9),
        time: timeStr,
        level,
        message,
      },
    ]);
  }, []);

  const {
    queue,
    poolStats,
    isProcessing,
    enqueueFiles,
    clearQueue,
    downloadIndividual,
    mergePdfFiles,
  } = useBatchTransmute({ onLog: addLog });

  // Classify active input context
  const activeFileType = useMemo(() => {
    const pdfFiles = lastSelectedFiles.filter((f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (pdfFiles.length >= 2) return 'multiple-pdf';

    if (lastSelectedFiles.length > 0) {
      const first = lastSelectedFiles[0];
      const lower = first.name.toLowerCase();
      if (lower.endsWith('.json') || lower.endsWith('.csv') || first.type.includes('json') || first.type.includes('csv')) {
        return 'data';
      }
      if (lower.endsWith('.svg') || first.type.includes('svg')) {
        return 'svg';
      }
      if (lower.endsWith('.pdf') || first.type === 'application/pdf') {
        return 'pdf';
      }
    }
    return 'image';
  }, [lastSelectedFiles]);

  const pdfCount = useMemo(() => {
    return lastSelectedFiles.filter((f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf').length;
  }, [lastSelectedFiles]);

  // Handle files selected via dropzone, picker, presets, or clipboard paste
  const handleFilesSelected = useCallback(
    (files) => {
      if (files && files.length > 0) {
        setLastSelectedFiles(files);

        // Adjust default target MIME if needed
        const first = files[0];
        const lower = first.name.toLowerCase();
        let nextMime = targetMimeType;

        if (lower.endsWith('.json')) {
          nextMime = 'text/csv';
        } else if (lower.endsWith('.csv')) {
          nextMime = 'application/json';
        } else if (lower.endsWith('.svg')) {
          nextMime = 'image/svg+xml';
        }

        if (nextMime !== targetMimeType) {
          setTargetMimeType(nextMime);
        }

        enqueueFiles(files, nextMime, quality);
      }
    },
    [enqueueFiles, targetMimeType, quality]
  );

  const handleFormatChange = useCallback((newMime) => {
    setTargetMimeType(newMime);
  }, []);

  const handleQualityCommit = useCallback((newQuality) => {
    setQuality(newQuality);
  }, []);

  const handleTriggerPdfMerge = useCallback(() => {
    const pdfFiles = lastSelectedFiles.filter((f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (pdfFiles.length >= 2) {
      mergePdfFiles(pdfFiles);
    }
  }, [lastSelectedFiles, mergePdfFiles]);

  const hasReadyFiles = queue.some((i) => i.status === 'READY');

  const handleShortcutDownload = useCallback(() => {
    const readyItems = queue.filter((i) => i.status === 'READY');
    if (readyItems.length === 1) {
      downloadIndividual(readyItems[0].id);
    } else if (readyItems.length > 1) {
      const downloadBtn = document.querySelector('button:has(svg.lucide-archive)');
      if (downloadBtn) {
        downloadBtn.click();
      }
    }
  }, [queue, downloadIndividual]);

  useGlobalShortcuts({
    onFilesPasted: (files) => {
      addLog('KERNEL', `Clipboard: Detected ${files.length} file(s) from paste event.`);
      handleFilesSelected(files);
    },
    onDownload: handleShortcutDownload,
    onReset: clearQueue,
    canDownload: hasReadyFiles,
  });

  // Quick Preset Handlers
  const handleQuickJsonBenchmark = useCallback(() => {
    addLog('KERNEL', 'Generating structured JSON customer dataset for Data Engine...');
    const sampleData = Array.from({ length: 50 }, (_, i) => ({
      id: `USR-${1000 + i}`,
      name: `Engineer ${i + 1}`,
      role: i % 3 === 0 ? 'Systems Architect' : 'Kernel Engineer',
      performance_score: (85 + (i % 15) * 1.1).toFixed(1),
      department: i % 2 === 0 ? 'WebAssembly R&D' : 'Core Graphics',
      active: true,
      last_latency_ms: 18 + (i % 8),
    }));

    const jsonBlob = new Blob([JSON.stringify(sampleData, null, 2)], { type: 'application/json' });
    const file = new File([jsonBlob], 'corporate_telemetry.json', { type: 'application/json' });
    handleFilesSelected([file]);
  }, [handleFilesSelected, addLog]);

  const handleQuickSvgBenchmark = useCallback(() => {
    addLog('KERNEL', 'Generating unoptimized vector SVG with editor metadata and comments...');
    const rawSvg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Vector Suite (Unoptimized Specimen) -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" viewBox="0 0 400 400" width="400" height="400">
  <metadata>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <cc:Work xmlns:cc="http://creativecommons.org/ns#">
        <dc:format xmlns:dc="http://purl.org/dc/elements/1.1/">image/svg+xml</dc:format>
      </cc:Work>
    </rdf:RDF>
  </metadata>
  <sodipodi:namedview id="base" pagecolor="#ffffff" bordercolor="#666666" />
  <rect width="400" height="400" fill="#0A0A0A" />
  <circle cx="200" cy="200" r="140" fill="#FF5A1F" stroke="#EDEDED" stroke-width="4.000000" />
  <polygon points="200,90 230,170 310,170 245,220 270,300 200,250 130,300 155,220 90,170 170,170" fill="#0A0A0A" stroke="#FFFFFF" stroke-width="2.50000" />
  <text x="200" y="360" text-anchor="middle" fill="#EDEDED" font-family="monospace" font-size="16.00000">OMNISHIFT VECTOR CORE</text>
</svg>`;

    const svgBlob = new Blob([rawSvg], { type: 'image/svg+xml' });
    const file = new File([svgBlob], 'unoptimized_vector_asset.svg', { type: 'image/svg+xml' });
    handleFilesSelected([file]);
  }, [handleFilesSelected, addLog]);

  const handleQuickPdfMergeBenchmark = useCallback(async () => {
    addLog('KERNEL', 'Synthesizing 3 separate PDF chapters to demonstrate in-worker PDF Merge...');
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdfFiles = [];

    const chapters = ['Executive Summary', 'Worker Pool Architecture', 'Hardware Benchmarks'];
    for (let i = 0; i < chapters.length; i++) {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const page = doc.addPage([500, 300]);
      page.drawText(`DOCUMENT SECTION ${i + 1}: ${chapters[i]}`, {
        x: 40,
        y: 220,
        size: 14,
        font,
        color: rgb(1, 0.35, 0.12),
      });
      page.drawText(`Generated on-the-fly in browser RAM. Ready to be merged.`, {
        x: 40,
        y: 190,
        size: 10,
        color: rgb(0.3, 0.3, 0.3),
      });
      const bytes = await doc.save();
      pdfFiles.push(
        new File([new Blob([bytes], { type: 'application/pdf' })], `section_${i + 1}_${chapters[i].toLowerCase().replace(/\s+/g, '_')}.pdf`, {
          type: 'application/pdf',
        })
      );
    }

    setLastSelectedFiles(pdfFiles);
    mergePdfFiles(pdfFiles);
  }, [mergePdfFiles, addLog]);

  const handleQuickBatchBenchmark = useCallback(async (count = 8) => {
    addLog('KERNEL', `Synthesizing ${count} mixed buffers for parallel pool stress test...`);
    const files = [];

    for (let i = 1; i <= count; i++) {
      const w = 1200 + i * 200;
      const h = 800 + i * 150;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#0F172A');
        grad.addColorStop(0.5, i % 2 === 0 ? '#FF5A1F' : '#0284C7');
        grad.addColorStop(1, '#000000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.font = 'bold 40px monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`BATCH_SPECIMEN_#${i} (${w}x${h})`, 50, 100);
      }

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        files.push(new File([blob], `batch_render_${i}_specimen.png`, { type: 'image/png' }));
      }
    }

    handleFilesSelected(files);
  }, [handleFilesSelected, addLog]);

  const dropzoneStatus = isProcessing
    ? 'transmuting'
    : queue.length > 0 && queue.every((i) => i.status === 'READY')
    ? 'completed'
    : 'idle';

  const singleTelemetryItem = queue.length === 1 && queue[0].status === 'READY' ? queue[0] : null;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-[#FF5A1F]/30 selection:text-[var(--text-primary)] transition-colors">
      {/* 1. Header with Architecture Trigger & Clean Ghost Controls */}
      <Header
        onOpenArchitecture={() => setIsArchModalOpen(true)}
      />

      {/* Main Layout Container */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col justify-between">
        <div className="w-full">
          {/* 2. Hero Section */}
          <Hero />

          {/* Profiler Badges Toggle - Clean text link, no box/border */}
          <div className="flex justify-end mb-1.5">
            <button
              type="button"
              onClick={() => setShowRenderPulse((v) => !v)}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-0.5"
            >
              <Activity className="h-3 w-3 text-[#FF5A1F]" />
              <span>Profiler Badges: {showRenderPulse ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* 3. Primary Interaction Loop: Dropzone */}
          <div>
            <TransmuteDropzone
              status={dropzoneStatus}
              processingPhase={isProcessing ? `CONCURRENT POOL (${poolStats.activeWorkers} CORES)` : ''}
              activeFileName={queue.length > 0 ? `${queue.length} Files in Queue` : ''}
              onFilesSelected={handleFilesSelected}
              showRenderPulse={showRenderPulse}
              batchCount={queue.length}
            />

            {/* Instant Sample Presets Row */}
            <SamplePresets
              disabled={isProcessing}
              onSelectSample={(sampleFile) => handleFilesSelected([sampleFile])}
            />

            {/* Contextual Format & Quality Controls */}
            <ConversionControls
              activeFileType={activeFileType}
              targetMimeType={targetMimeType}
              onTargetMimeChange={handleFormatChange}
              initialQuality={quality}
              onQualityCommit={handleQualityCommit}
              onTriggerPdfMerge={handleTriggerPdfMerge}
              disabled={isProcessing}
              showRenderPulse={showRenderPulse}
              pdfCount={pdfCount}
            />

            {/* Additional Engine Testing Actions Bar */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--text-muted)]">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="text-[var(--text-muted)] opacity-70">Synthesizers:</span>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleQuickJsonBenchmark}
                  className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet className="inline h-3 w-3 mr-1" />
                  JSON ➔ CSV / XLSX
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleQuickSvgBenchmark}
                  className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-cyan-500 dark:text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
                >
                  <Layers className="inline h-3 w-3 mr-1" />
                  SVG Minify / PNG
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleQuickPdfMergeBenchmark}
                  className="rounded border border-[#FF5A1F]/30 bg-[#FF5A1F]/10 px-2 py-0.5 text-[#FF5A1F] hover:bg-[#FF5A1F]/20 transition-colors disabled:opacity-50"
                >
                  <Combine className="inline h-3 w-3 mr-1" />
                  Merge 3 PDFs
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleQuickBatchBenchmark(8)}
                  className="rounded border border-[var(--border-color)] bg-[var(--bg-surface-1)] px-2 py-0.5 text-[var(--text-primary)] hover:border-[#FF5A1F]/40 hover:bg-[var(--bg-surface-2)] transition-colors disabled:opacity-50"
                >
                  8x Concurrent Batch
                </button>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--text-muted)]">
                <Network className="h-3 w-3 opacity-60" strokeWidth={1} />
                <span>Zero Cloud Roundtrips</span>
              </div>
            </div>

            {/* 4. Batch Processing Queue HUD */}
            <AnimatePresence>
              {queue.length > 0 && (
                <BatchQueueHUD
                  queue={queue}
                  poolStats={poolStats}
                  onClearQueue={clearQueue}
                  onDownloadIndividual={downloadIndividual}
                />
              )}
            </AnimatePresence>

            {/* Single File Detailed HUD */}
            <AnimatePresence>
              {singleTelemetryItem && (
                <TelemetryHUD
                  telemetry={singleTelemetryItem.telemetry}
                  downloadUrl={singleTelemetryItem.downloadUrl}
                  outputFileName={singleTelemetryItem.outputFileName}
                  onReset={clearQueue}
                  onDownload={() => downloadIndividual(singleTelemetryItem.id)}
                  showRenderPulse={showRenderPulse}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 5. Deep-Tech Diagnostics & Kernel Console */}
        <EngineLogConsole logs={logs} />
      </main>

      {/* Floating Keyboard Shortcuts Pill - Hidden on touch/mobile devices */}
      <aside aria-label="Keyboard Shortcuts" className="sticky bottom-10 z-40 mx-auto max-w-fit px-4 pointer-events-none hidden md:flex">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface-1)]/95 px-4 py-1.5 text-[11px] font-mono text-[var(--text-muted)] backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-1">
            <Command className="h-3 w-3 text-[#FF5A1F]" />
            <span className="text-[var(--text-primary)]">Hotkeys:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[var(--bg-surface-2)] px-1.5 py-0.5 border border-[var(--border-color)] text-[var(--text-primary)]">
              ⌘V
            </span>
            <span>Paste</span>
          </div>
          <span className="text-[var(--border-color)]">•</span>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[var(--bg-surface-2)] px-1.5 py-0.5 border border-[var(--border-color)] text-[var(--text-primary)]">
              ⌘S
            </span>
            <span>Download</span>
          </div>
          <span className="text-[var(--border-color)]">•</span>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[var(--bg-surface-2)] px-1.5 py-0.5 border border-[var(--border-color)] text-[var(--text-primary)]">
              ESC
            </span>
            <span>Clear</span>
          </div>
        </div>
      </aside>

      {/* Hardware & Runtime Diagnostics Bar */}
      <RuntimeMonitor poolStats={poolStats} />

      {/* Minimalist Footer with OmniShift Brand Icon */}
      <footer className="w-full border-t border-[var(--border-color)] bg-[var(--bg-canvas)] py-3.5 text-center transition-colors">
        <div className="mx-auto flex max-w-5xl flex-col sm:flex-row items-center justify-between gap-2 px-4 sm:px-6 text-[11px] font-mono text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <img src={appIcon} alt="OmniShift" className="h-4 w-4 object-contain" />
            <span>OmniShift Engine • Multithreaded Local Compute Platform</span>
          </div>
          <span className="text-[var(--text-muted)] opacity-60">
            Transferable ArrayBuffers • In-RAM .ZIP Packaging
          </span>
        </div>
      </footer>

      {/* Interactive System Architecture Modal */}
      <ArchitectureModal
        isOpen={isArchModalOpen}
        onClose={() => setIsArchModalOpen(false)}
      />
    </div>
  );
};

export default App;
