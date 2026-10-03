import { useState, useEffect, memo } from 'react';
import { Sliders, FileSpreadsheet, Combine, Layers } from 'lucide-react';
import { TARGET_FORMATS } from '../lib/constants';
import { cn } from '../lib/utils';

const DATA_FORMATS = [
  { id: 'csv', label: 'CSV', mime: 'text/csv', lossy: false },
  { id: 'json', label: 'JSON', mime: 'application/json', lossy: false },
  { id: 'xlsx', label: 'Excel (.xlsx)', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', lossy: false },
];

const SVG_FORMATS = [
  { id: 'svg', label: 'Minified SVG', mime: 'image/svg+xml', lossy: false },
  { id: 'png', label: 'High-Res PNG', mime: 'image/png', lossy: false },
];

export const ConversionControls = memo(function ConversionControls({
  activeFileType = 'image',
  targetMimeType,
  onTargetMimeChange,
  initialQuality = 0.85,
  onQualityCommit,
  onTriggerPdfMerge,
  disabled = false,
  showRenderPulse = false,
  pdfCount = 0,
}) {
  const [localQuality, setLocalQuality] = useState(initialQuality);
  const [renders, setRenders] = useState(1);

  useEffect(() => {
    if (showRenderPulse) {
      setRenders((r) => r + 1);
    }
  }, [targetMimeType, initialQuality, activeFileType, showRenderPulse]);

  useEffect(() => {
    setLocalQuality(initialQuality);
  }, [initialQuality]);

  const isData = activeFileType === 'data';
  const isSvg = activeFileType === 'svg';
  const isMultiplePdf = activeFileType === 'multiple-pdf';
  const isImage = !isData && !isSvg && !isMultiplePdf;

  const currentFormats = isData ? DATA_FORMATS : isSvg ? SVG_FORMATS : TARGET_FORMATS;
  const currentFormat = currentFormats.find((f) => f.mime === targetMimeType) || currentFormats[0];
  const isLossy = isImage && currentFormat.lossy;

  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    setLocalQuality(val);
  };

  const handleCommit = () => {
    if (onQualityCommit && isLossy) {
      onQualityCommit(localQuality);
    }
  };

  return (
    <div
      style={{ contain: 'layout paint' }}
      className="relative w-full mt-4 min-h-[90px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-1)] p-3 sm:p-4 select-none transition-colors"
    >
      {/* Dev Render Pulse Indicator */}
      {showRenderPulse && (
        <span className="absolute -top-2 right-3 font-mono text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30">
          renders: {renders}
        </span>
      )}

      {/* Mode 1: Multiple PDFs Merge Mode */}
      {isMultiplePdf ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Combine className="h-5 w-5 text-[#FF5A1F] shrink-0" strokeWidth={1.5} />
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)] font-mono uppercase tracking-wider">
                PDF Document Merger Active
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Detected {pdfCount} PDF files. Ready to combine into a single linearized document.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={onTriggerPdfMerge}
            className="inline-flex items-center justify-center gap-2 rounded bg-[#FF5A1F] px-4 py-2 text-xs font-mono font-bold text-black hover:bg-[#ff6f3b] transition-colors disabled:opacity-50"
          >
            <Combine className="h-3.5 w-3.5 text-black" strokeWidth={1.5} />
            <span>Merge {pdfCount} PDFs into Single Document</span>
          </button>
        </div>
      ) : (
        /* Mode 2: Contextual Format Switcher (Image / Data / SVG) */
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Left: Target Format Segmented Pill Tabs */}
          <div className="flex flex-col gap-1.5 max-w-full">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              {isData ? (
                <FileSpreadsheet className="h-3 w-3 text-[#FF5A1F]" strokeWidth={1.25} />
              ) : isSvg ? (
                <Layers className="h-3 w-3 text-[#FF5A1F]" strokeWidth={1.25} />
              ) : (
                <span className="font-mono font-bold text-[#FF5A1F] text-[11px]">//</span>
              )}
              <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                {isData ? 'Structured Data Output' : isSvg ? 'Vector Engine Mode' : 'Target Architecture'}
              </span>
            </div>

            {/* Horizontally scrollable pill container with smooth swipe on mobile */}
            <div className="inline-flex max-w-full overflow-x-auto no-scrollbar rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-2)] p-0.5">
              {currentFormats.map((fmt) => {
                const active = fmt.mime === targetMimeType;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onTargetMimeChange(fmt.mime)}
                    className={cn(
                      'relative whitespace-nowrap px-3 py-1 text-xs font-mono font-medium rounded transition-colors',
                      active
                        ? 'bg-[#FF5A1F] text-black font-semibold shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-1)]',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {fmt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Quality Slider or Mode Details */}
          <div className="flex flex-col gap-1.5 sm:min-w-[220px]">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-1.5">
                <Sliders className="h-3 w-3 text-[var(--text-muted)]" strokeWidth={1.25} />
                <span className="font-mono text-[11px] uppercase tracking-wider">
                  {isLossy ? 'Compression Quality' : 'Pipeline Mode'}
                </span>
              </div>
              <span className="font-mono text-xs font-semibold text-[var(--text-primary)] tabular-nums">
                {isLossy ? `${Math.round(localQuality * 100)}%` : isData ? 'Tabular Transform' : isSvg ? 'Vector DOM' : 'Lossless'}
              </span>
            </div>

            {isLossy ? (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.10"
                  max="1.00"
                  step="0.05"
                  disabled={disabled}
                  value={localQuality}
                  onChange={handleSliderChange}
                  onPointerUp={handleCommit}
                  onKeyUp={handleCommit}
                  className="w-full h-1 bg-[var(--bg-surface-2)] rounded-lg appearance-none cursor-pointer accent-[#FF5A1F] disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Compression quality slider"
                />
              </div>
            ) : (
              <div className="h-6 flex items-center">
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  {isData
                    ? 'In-memory parsing & schema serialization'
                    : isSvg
                    ? 'Strips editor namespaces & dead nodes'
                    : 'Bit-exact reversible pixel preservation'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
