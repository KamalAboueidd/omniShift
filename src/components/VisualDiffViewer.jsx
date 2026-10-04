import { useState, useRef, useCallback, memo } from 'react';
import { formatBytes } from '../lib/utils';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const VisualDiffViewer = memo(function VisualDiffViewer({
  originalUrl,
  transmutedUrl,
  originalBytes = 0,
  transmutedBytes = 0,
  targetFormat = 'WEBP',
  isRecomputing = false,
}) {
  const { t } = useLanguage();
  
  // Slider position from 0 to 1 (default 0.5 = 50% split)
  const [sliderPos, setSliderPos] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const deltaPercentage = originalBytes > 0 && transmutedBytes > 0
    ? (((transmutedBytes - originalBytes) / originalBytes) * 100).toFixed(1)
    : 0;

  const handlePointerMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const clampedRatio = Math.max(0.02, Math.min(0.98, x / rect.width));
    setSliderPos(clampedRatio);
  }, []);

  const onPointerDown = useCallback((e) => {
    setIsDragging(true);
    handlePointerMove(e.clientX);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [handlePointerMove]);

  const onPointerMove = useCallback((e) => {
    if (!isDragging) return;
    handlePointerMove(e.clientX);
  }, [isDragging, handlePointerMove]);

  const onPointerUp = useCallback((e) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignored if pointer wasn't captured
    }
  }, []);

  // Keyboard navigation for accessibility (Left/Right arrows)
  const onKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft') {
      setSliderPos((prev) => Math.max(0.05, prev - 0.05));
    } else if (e.key === 'ArrowRight') {
      setSliderPos((prev) => Math.min(0.95, prev + 0.05));
    }
  }, []);

  return (
    <div className="w-full space-y-2 select-none">
      {/* Visual Header / Subtitle */}
      <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)] px-1">
        <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-semibold text-[var(--text-primary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF5A1F]" />
          {t('inspectQuality')}
        </span>
        <span className="text-[10px] opacity-70 hidden sm:inline">
          {t('dragToCompare')}
        </span>
      </div>

      {/* Main Comparison Canvas */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="slider"
        aria-valuenow={Math.round(sliderPos * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Before and after image comparison slider"
        className="relative w-full h-[280px] sm:h-[340px] rounded-lg border border-[var(--border-color)] bg-[#0A0A0A] overflow-hidden cursor-ew-resize touch-none focus:outline-hidden focus:border-[#FF5A1F]"
      >
        {/* Transparency Checkered Grid Pattern (Figma/Photoshop Style) */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(45deg, #1c1c1c 25%, transparent 25%), linear-gradient(-45deg, #1c1c1c 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1c1c1c 75%), linear-gradient(-45deg, transparent 75%, #1c1c1c 75%)`,
            backgroundSize: `16px 16px`,
            backgroundPosition: `0 0, 0 8px, 8px -8px, -8px 0px`
          }}
        />

        {/* Layer 1: Transmuted / Output Image (Right / Bottom Base) */}
        <div className="absolute inset-0 flex items-center justify-center p-2">
          {transmutedUrl ? (
            <img
              src={transmutedUrl}
              alt="Transmuted output"
              className="max-h-full max-w-full object-contain pointer-events-none select-none"
            />
          ) : (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono">
              <Loader2 className="h-4 w-4 animate-spin text-[#FF5A1F]" />
              <span>{t('recomputing')}</span>
            </div>
          )}
        </div>

        {/* Layer 2: Original Image (Left / Clipped Overlay) */}
        <div
          className="absolute inset-0 flex items-center justify-center p-2 pointer-events-none"
          style={{
            clipPath: `inset(0 ${(1 - sliderPos) * 100}% 0 0)`,
            WebkitClipPath: `inset(0 ${(1 - sliderPos) * 100}% 0 0)`,
          }}
        >
          {originalUrl && (
            <img
              src={originalUrl}
              alt="Original preview"
              className="max-h-full max-w-full object-contain pointer-events-none select-none"
            />
          )}
        </div>

        {/* Vertical Hairline Divider */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-20 flex items-center justify-center"
          style={{
            left: `${sliderPos * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          {/* Hairline 1px bar */}
          <div className="w-[1.5px] h-full bg-[#FF5A1F] shadow-[0_0_8px_rgba(255,90,31,0.5)]" />

          {/* Center Draggable Handle */}
          <div className="absolute top-1/2 -translate-y-1/2 w-6 h-7 rounded bg-[#FF5A1F] text-black shadow-md flex items-center justify-center pointer-events-auto cursor-ew-resize active:scale-95 transition-transform">
            <svg
              className="w-3.5 h-3.5 fill-current"
              viewBox="0 0 24 24"
            >
              <path d="M8.5 7l-5 5 5 5V7zm7 0v10l5-5-5-5z" />
            </svg>
          </div>
        </div>

        {/* Corner Badge Left: Original • Exact Size */}
        <div className="absolute bottom-2.5 left-2.5 z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/85 backdrop-blur-xs px-2.5 py-1 rounded border border-white/10 text-[10px] font-mono font-medium text-white/90 shadow-sm">
            <span className="uppercase tracking-wider">{t('original')}</span>
            <span className="opacity-40">•</span>
            <span className="tabular-nums text-zinc-300">{formatBytes(originalBytes)}</span>
          </div>
        </div>

        {/* Corner Badge Right: Transmuted • Exact Size • Delta % */}
        <div className="absolute bottom-2.5 right-2.5 z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/85 backdrop-blur-xs px-2.5 py-1 rounded border border-[#FF5A1F]/30 text-[10px] font-mono font-medium shadow-sm">
            {isRecomputing ? (
              <span className="flex items-center gap-1 text-[#FF5A1F]">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{t('recomputing')}</span>
              </span>
            ) : (
              <>
                <span className="text-[#FF5A1F] font-bold uppercase tracking-wider">{targetFormat}</span>
                <span className="opacity-40 text-white/50">•</span>
                <span className="tabular-nums text-zinc-200">{formatBytes(transmutedBytes)}</span>
                <span className="opacity-40 text-white/50">•</span>
                <span className={Number(deltaPercentage) <= 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {Number(deltaPercentage) > 0 ? `+${deltaPercentage}%` : `${deltaPercentage}%`}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
