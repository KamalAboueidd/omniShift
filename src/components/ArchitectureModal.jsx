import { useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, Cpu, Layers, HardDrive, Zap } from 'lucide-react';

export const ArchitectureModal = memo(function ArchitectureModal({ isOpen, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="arch-title"
            initial={{ opacity: 0, scale: 0.96, transform: 'translateY(8px)' }}
            animate={{ opacity: 1, scale: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0, scale: 0.96, transform: 'translateY(8px)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-2xl rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-1)] p-5 sm:p-6 shadow-2xl text-[var(--text-primary)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
              <div className="flex items-center gap-2.5">
                <Cpu className="h-5 w-5 text-[#FF5A1F]" strokeWidth={1.5} />
                <div>
                  <h2 id="arch-title" className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                    System Architecture &amp; Security Blueprint
                  </h2>
                  <p className="text-[11px] font-mono text-[var(--text-muted)]">
                    Strict In-Memory Pipeline • Isolated Threading Model
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Zero-Egress Verification Banner */}
            <div className="mt-4 flex items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-xs">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
              <div className="font-mono text-[11px] leading-relaxed text-[var(--text-primary)]">
                <strong className="text-emerald-500 dark:text-emerald-400">Zero Cloud Bytes Verification:</strong> Open your browser&apos;s DevTools Network Tab during any single or 50+ file batch transmutation. Exactly <span className="text-[#FF5A1F] font-bold">0 outbound network requests</span> will be dispatched.
              </div>
            </div>

            {/* Monospaced ASCII Pipeline Diagram */}
            <div className="mt-5 rounded border border-[var(--border-color)] bg-[var(--bg-surface-2)] p-4 font-mono text-[11px] overflow-x-auto leading-loose text-[var(--text-muted)]">
              <div className="text-[#FF5A1F] font-semibold mb-2">
                === CONCURRENT DATA STREAM PIPELINE ===
              </div>
              <div className="text-[var(--text-primary)] whitespace-pre font-mono text-[10px] sm:text-[11px]">
{`[ File Ingest ] ──► [ ArrayBuffer Slice ] ──► (Zero-Copy Transfer)
                                                    │
┌───────────────────────────────────────────────────▼─────────────┐
│ Web Worker Pool (Dynamic Cores: N = Hardware Concurrency - 1)   │
│                                                                 │
│  Thread #1: OffscreenCanvas ──► Hardware WebP/AVIF Quantizer    │
│  Thread #2: PDF Engine (pdf-lib) ──► Object Stream Compress     │
│  Thread #K: Bit-Exact Rasterizer ──► Transferable ArrayBuffer   │
└───────────────────────────────────────────────────┬─────────────┘
                                                    │
[ Safe Blob Minting ] ◄── (Transferable Object) ────┘
         │
[ MemoryManager Lifecycle ] ──► Instant Revocation (Zero Leak GC)`}
              </div>
            </div>

            {/* 3 Pillars of Performance */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
              <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-2.5">
                <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold text-[11px]">
                  <HardDrive className="h-3.5 w-3.5 text-[#FF5A1F]" />
                  <span>Transferable Objects</span>
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-muted)] leading-normal font-sans">
                  Zero memory duplication between threads via native byte buffer ownership transfer.
                </p>
              </div>

              <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-2.5">
                <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold text-[11px]">
                  <Zap className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
                  <span>60 FPS Main Thread</span>
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-muted)] leading-normal font-sans">
                  Heavy image decoding and PDF serialization execute entirely in isolated worker scopes.
                </p>
              </div>

              <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-2.5">
                <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold text-[11px]">
                  <Layers className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>Dynamic Concurrency</span>
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-muted)] leading-normal font-sans">
                  Scales across physical CPU cores without exceeding hardware limits to prevent OS contention.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between border-t border-[var(--border-color)] pt-3 text-[11px] font-mono text-[var(--text-muted)]">
              <span>OmniShift Engine v0.1.0-alpha</span>
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-[var(--border-color)] bg-[var(--bg-surface-2)] px-3 py-1 text-xs text-[var(--text-primary)] hover:border-[#FF5A1F]/40 transition-colors"
              >
                Close Blueprint
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
