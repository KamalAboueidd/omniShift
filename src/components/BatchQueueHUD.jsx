import { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Archive, Trash2, Cpu, CheckCircle2, Loader2 } from 'lucide-react';
import { BatchItemRow } from './BatchItemRow';
import { formatBytes } from '../lib/utils';

export const BatchQueueHUD = memo(function BatchQueueHUD({
  queue,
  poolStats,
  onClearQueue,
  onDownloadIndividual,
}) {
  const [isZipping, setIsZipping] = useState(false);

  // Compute aggregate statistics
  const { totalItems, completedItems, computingItems, totalOriginalBytes, totalTransmutedBytes, totalSavedBytes, overallReduction } = useMemo(() => {
    const totalItems = queue.length;
    let completedItems = 0;
    let computingItems = 0;
    let totalOriginalBytes = 0;
    let totalTransmutedBytes = 0;

    for (const item of queue) {
      totalOriginalBytes += item.originalBytes || 0;
      if (item.status === 'READY' && item.telemetry) {
        completedItems += 1;
        totalTransmutedBytes += item.telemetry.transmutedBytes || 0;
      } else if (item.status === 'COMPUTING') {
        computingItems += 1;
      }
    }

    const totalSavedBytes = Math.max(0, totalOriginalBytes - totalTransmutedBytes);
    const overallReduction = totalOriginalBytes > 0 && completedItems > 0
      ? parseFloat((((totalTransmutedBytes - totalOriginalBytes) / totalOriginalBytes) * 100).toFixed(1))
      : 0;

    return {
      totalItems,
      completedItems,
      computingItems,
      totalOriginalBytes,
      totalTransmutedBytes,
      totalSavedBytes,
      overallReduction,
    };
  }, [queue]);

  const percentComplete = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const allComplete = totalItems > 0 && completedItems === totalItems;
  const isBusy = computingItems > 0 || completedItems < totalItems;

  // 1-Click Client-Side Zip Generation (Lazy-loaded JSZip)
  const handleDownloadAllZip = async () => {
    if (completedItems === 0 || isZipping) return;

    try {
      setIsZipping(true);
      const JSZipModule = await import('jszip');
      const JSZip = JSZipModule.default || JSZipModule;
      const zip = new JSZip();

      // Collect all ready file blobs
      for (const item of queue) {
        if (item.status === 'READY' && item.blob) {
          const name = item.outputFileName || item.fileName;
          zip.file(name, item.blob);
        }
      }

      // Generate in browser memory
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `omnishift_batch_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(zipUrl), 4000);
    } catch (err) {
      console.error('Failed to create ZIP archive:', err);
    } finally {
      setIsZipping(false);
    }
  };

  if (queue.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, transform: 'translateY(12px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transform: 'translateY(8px)' }}
      style={{ contain: 'layout paint' }}
      className="w-full mt-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-1)] overflow-hidden transition-colors"
    >
      {/* Top Header: Progress & Hardware Pool Spec */}
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-surface-2)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#FF5A1F] animate-ping" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              BATCH PROCESSING QUEUE
            </span>
            <span className="text-[var(--border-color)]">•</span>
            <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
              {completedItems} of {totalItems} Complete ({percentComplete}%)
            </span>
          </div>

          {/* Parallelized Hardware Threads Badge */}
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-surface-1)] px-2 py-0.5 text-cyan-500 dark:text-cyan-400">
              <Cpu className="h-3 w-3" strokeWidth={1.25} />
              {poolStats.poolSize} Worker Threads Active
            </span>
            {poolStats.activeWorkers > 0 && (
              <span className="text-[#FF5A1F] tabular-nums">
                ({poolStats.activeWorkers} Cores In Use)
              </span>
            )}
          </div>
        </div>

        {/* Master Progress Bar (Monospaced Meter) */}
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-1)] border border-[var(--border-subtle)]">
            <motion.div
              className="h-full bg-[#FF5A1F]"
              initial={{ width: 0 }}
              animate={{ width: `${percentComplete}%` }}
              transition={{ ease: 'easeOut', duration: 0.3 }}
            />
          </div>
        </div>

        {/* Global Batch Telemetry Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span>Original: <strong className="text-[var(--text-primary)]">{formatBytes(totalOriginalBytes)}</strong></span>
            <span className="text-[var(--border-color)]">•</span>
            <span>Output: <strong className="text-[var(--text-primary)]">{formatBytes(totalTransmutedBytes)}</strong></span>
            {totalSavedBytes > 0 && (
              <>
                <span className="text-[var(--border-color)]">•</span>
                <span className="text-[#FF5A1F]">
                  Saved: -{formatBytes(totalSavedBytes)} ({overallReduction}%)
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            <span>Parallelized In-Memory Stream</span>
          </div>
        </div>
      </div>

      {/* High-density Industrial List (Max 8 rows visible, then smooth scroll) */}
      <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-subtle)]">
        {queue.map((item) => (
          <BatchItemRow
            key={item.id}
            item={item}
            onDownloadIndividual={onDownloadIndividual}
          />
        ))}
      </div>

      {/* Bottom Action Bar */}
      <div className="border-t border-[var(--border-color)] bg-[var(--bg-surface-2)] p-3 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClearQueue}
          disabled={isBusy}
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-sm border border-[var(--border-color)] bg-[var(--bg-surface-1)] px-3 py-1.5 text-xs font-mono text-[var(--text-muted)] hover:text-rose-500 hover:border-rose-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Clear Batch Queue</span>
        </button>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleDownloadAllZip}
            disabled={completedItems === 0 || isZipping}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-sm bg-[#FF5A1F] px-4 py-2 text-xs font-mono font-bold text-black transition-colors hover:bg-[#ff6f3b] active:scale-[0.98] shadow-xs shadow-[#FF5A1F]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isZipping ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Generating .ZIP in RAM...</span>
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" />
                <span>
                  {allComplete
                    ? `Download All (${completedItems} Files .zip)`
                    : `Download Ready (${completedItems}/${totalItems} .zip)`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
});
