import { memo } from 'react';
import { Download, CheckCircle2, Clock, AlertCircle, Cpu } from 'lucide-react';
import { formatBytes } from '../lib/utils';

export const BatchItemRow = memo(function BatchItemRow({ item, onDownloadIndividual }) {
  const { id, fileName, originalBytes, status, telemetry, downloadUrl, phase } = item;

  const isQueued = status === 'QUEUED';
  const isComputing = status === 'COMPUTING';
  const isReady = status === 'READY';
  const isFailed = status === 'FAILED';

  const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] py-2.5 px-3 hover:bg-[var(--bg-surface-2)]/60 transition-colors font-mono text-xs">
      {/* File Identifier & Format Pill */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="rounded border border-[var(--border-color)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] shrink-0 font-medium">
          {ext}
        </span>
        <span className="text-[var(--text-primary)] truncate font-sans text-xs max-w-[180px] sm:max-w-xs" title={fileName}>
          {fileName}
        </span>
        <span className="text-[var(--text-muted)] text-[11px] shrink-0">
          ({formatBytes(originalBytes)})
        </span>
      </div>

      {/* Real-time Status Badge */}
      <div className="flex items-center gap-3 shrink-0">
        {isQueued && (
          <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-color)]" />
            QUEUED
          </span>
        )}

        {isComputing && (
          <span className="inline-flex items-center gap-1.5 text-[10px] text-[#FF5A1F] uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF5A1F] animate-ping" />
            <Cpu className="h-3 w-3 animate-pulse" />
            <span className="hidden sm:inline">{phase || 'COMPUTING'}</span>
          </span>
        )}

        {isReady && telemetry && (
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[11px] text-[var(--text-muted)] tabular-nums">
              <Clock className="inline h-3 w-3 mr-1 text-[var(--text-muted)]" />
              {telemetry.latencyMs}ms
            </span>
            <span className="font-bold text-[#FF5A1F] tabular-nums text-xs">
              {telemetry.reductionPercentage > 0
                ? `+${telemetry.reductionPercentage}%`
                : `${telemetry.reductionPercentage}%`}
            </span>
            <span className="text-[var(--text-muted)] text-[11px] tabular-nums hidden sm:inline">
              {formatBytes(telemetry.transmutedBytes)}
            </span>
            <span className="inline-flex items-center text-emerald-500 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          </div>
        )}

        {isFailed && (
          <span className="inline-flex items-center gap-1 text-[11px] text-rose-500 dark:text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            FAILED
          </span>
        )}

        {/* Action: Single File Download */}
        {isReady && downloadUrl && (
          <button
            type="button"
            onClick={() => onDownloadIndividual(id)}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors rounded hover:bg-[var(--bg-surface-2)]"
            title="Download individual file"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
});
