import { useState, useEffect, memo } from 'react';
import { Cpu, HardDrive, Check } from 'lucide-react';
import { memoryManager } from '../lib/memoryManager';
import { formatBytes } from '../lib/utils';

export const RuntimeMonitor = memo(function RuntimeMonitor({ poolStats }) {
  const [memoryUsage, setMemoryUsage] = useState({ heapBytes: 0, trackedBuffers: 0 });

  // Feature detection
  const hasOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  const hasTransferable = typeof MessageChannel !== 'undefined';
  
  // Safe synchronous SIMD check
  const [hasSimd, setHasSimd] = useState(false);

  useEffect(() => {
    try {
      if (typeof WebAssembly !== 'undefined' && typeof WebAssembly.validate === 'function') {
        // Minimal WASM module using SIMD (v128.const)
        const simdBytes = new Uint8Array([
          0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 26, 11
        ]);
        setHasSimd(WebAssembly.validate(simdBytes));
      }
    } catch {
      setHasSimd(false);
    }
  }, []);

  useEffect(() => {
    const updateMemory = () => {
      const perfMemory = window.performance && window.performance.memory ? window.performance.memory.usedJSHeapSize : null;
      const footprint = memoryManager.getFootprint();

      setMemoryUsage({
        heapBytes: perfMemory || footprint.totalBytes,
        isNativeHeap: Boolean(perfMemory),
        bufferCount: footprint.count,
        bufferBytes: footprint.totalBytes,
      });
    };

    updateMemory();
    const interval = setInterval(updateMemory, 1800);
    return () => clearInterval(interval);
  }, []);

  const totalCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const activeThreads = poolStats?.activeWorkers || 0;
  const poolCapacity = poolStats?.poolSize || 3;

  return (
    <aside
      aria-label="Hardware & Runtime Diagnostics"
      style={{ contain: 'content' }}
      className="w-full border-t border-[var(--border-color)] bg-[var(--bg-surface-1)] px-4 py-2 font-mono text-[11px] text-[var(--text-muted)] transition-colors"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        {/* Left: Memory Footprint */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[var(--text-primary)]">
            <HardDrive className="h-3 w-3 text-[#FF5A1F]" strokeWidth={1.25} />
            <span>Memory Footprint:</span>
            <span className="font-semibold text-emerald-500 dark:text-emerald-400 tabular-nums">
              {formatBytes(memoryUsage.heapBytes)}
            </span>
            {memoryUsage.isNativeHeap && (
              <span className="text-[var(--text-muted)] text-[10px] hidden sm:inline">(Heap)</span>
            )}
          </div>

          {memoryUsage.bufferCount > 0 && (
            <>
              <span className="text-[var(--border-color)]">•</span>
              <span className="text-[var(--text-muted)] hidden sm:inline">
                {memoryUsage.bufferCount} Buffers ({formatBytes(memoryUsage.bufferBytes)})
              </span>
            </>
          )}
        </div>

        {/* Center: Thread Engagement */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3 w-3 text-cyan-500 dark:text-cyan-400" strokeWidth={1.25} />
            <span>Worker Threads:</span>
            <span className="font-semibold text-[var(--text-primary)] tabular-nums">
              {activeThreads} / {poolCapacity} Engaged
            </span>
            <span className="text-[var(--text-muted)] text-[10px] hidden sm:inline">({totalCores} Host Cores)</span>
          </div>
        </div>

        {/* Right: Runtime Capabilities Badges */}
        <div className="flex items-center gap-1 text-[10px]">
          <span
            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 border ${
              hasSimd
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
            }`}
          >
            <Check className="h-2.5 w-2.5" />
            <span>SIMD</span>
          </span>

          <span
            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 border ${
              hasOffscreenCanvas
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
            }`}
          >
            <Check className="h-2.5 w-2.5" />
            <span>OffscreenCanvas</span>
          </span>

          <span
            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 border ${
              hasTransferable
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
            }`}
          >
            <Check className="h-2.5 w-2.5" />
            <span>TransferableObjects</span>
          </span>
        </div>
      </div>
    </aside>
  );
});
