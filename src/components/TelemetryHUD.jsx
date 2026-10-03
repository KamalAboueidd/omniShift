import { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { Download, RotateCcw, Clock, ArrowRight, Gauge, Activity, ShieldCheck, Zap, FileText } from 'lucide-react';
import { formatBytes } from '../lib/utils';

export const TelemetryHUD = memo(function TelemetryHUD({
  telemetry,
  downloadUrl,
  outputFileName,
  onReset,
  onDownload,
  showRenderPulse = false,
}) {
  const [renders, setRenders] = useState(1);

  useEffect(() => {
    if (showRenderPulse) {
      setRenders((r) => r + 1);
    }
  }, [telemetry, downloadUrl, showRenderPulse]);

  if (!telemetry) return null;

  const isPdf = telemetry.targetFormat === 'PDF' || telemetry.extraMeta?.originalPages !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, transform: 'translateY(10px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transform: 'translateY(6px)' }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
      }}
      style={{ contain: 'layout paint' }}
      className="relative w-full mt-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-1)] p-4 sm:p-5 transition-colors"
    >
      {/* Dev Render Pulse Indicator */}
      {showRenderPulse && (
        <span className="absolute -top-2 right-3 font-mono text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30">
          renders: {renders}
        </span>
      )}

      {/* Top Diagnostic Stream */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-2 w-2 items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF5A1F]" />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-primary)]">
            TELEMETRY HUD
          </span>
          <span className="text-[var(--border-color)]">•</span>
          <span className="font-mono text-[11px] text-[var(--text-muted)] truncate max-w-[200px] sm:max-w-xs">
            {telemetry.fileName}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)]">
          {isPdf && telemetry.extraMeta?.originalPages ? (
            <span className="flex items-center gap-1 text-cyan-500 dark:text-cyan-400">
              <FileText className="h-3 w-3" strokeWidth={1.25} />
              {telemetry.extraMeta.originalPages} Pages Processed
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-[#FF5A1F]" strokeWidth={1.25} />
              {telemetry.workerCoreId}
            </span>
          )}
          <span className="text-[var(--border-color)]">•</span>
          <span className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400">
            <Zap className="h-3 w-3" strokeWidth={1.25} />
            <span className="tabular-nums">{telemetry.throughputMbps}</span> MB/s
          </span>
        </div>
      </div>

      {/* 3 Primary Engineering Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        {/* Metric 1: Latency */}
        <div className="flex flex-col justify-between rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3.5">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="font-mono text-[11px] uppercase tracking-wider">Latency</span>
            <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1} />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-mono text-2xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
              {telemetry.latencyMs}
            </span>
            <span className="font-mono text-xs text-[var(--text-muted)]">ms</span>
          </div>
          <span className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
            {isPdf ? 'pdf-lib in-memory pass' : 'OffscreenCanvas pipeline'}
          </span>
        </div>

        {/* Metric 2: Reduction */}
        <div className="flex flex-col justify-between rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3.5">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="font-mono text-[11px] uppercase tracking-wider">Reduction</span>
            <Gauge className="h-3.5 w-3.5 text-[#FF5A1F]" strokeWidth={1} />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-mono text-2xl font-bold tracking-tight text-[#FF5A1F] tabular-nums">
              {telemetry.reductionPercentage > 0
                ? `+${telemetry.reductionPercentage}%`
                : `${telemetry.reductionPercentage}%`}
            </span>
          </div>
          <span className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
            Byte footprint delta
          </span>
        </div>

        {/* Metric 3: Size Delta */}
        <div className="flex flex-col justify-between rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3.5">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="font-mono text-[11px] uppercase tracking-wider">Size Delta</span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              {telemetry.sourceFormat} → {telemetry.targetFormat}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 font-mono text-sm font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">
            <span className="text-[var(--text-muted)]">{formatBytes(telemetry.originalBytes)}</span>
            <ArrowRight className="h-3 w-3 opacity-60" strokeWidth={1.25} />
            <span className="text-[var(--text-primary)]">{formatBytes(telemetry.transmutedBytes)}</span>
          </div>
          <span className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
            Delta: {formatBytes(Math.abs(telemetry.originalBytes - telemetry.transmutedBytes))}
          </span>
        </div>
      </div>

      {/* Clean Action Bar */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[var(--border-color)]">
        {/* Verification Guarantee */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" strokeWidth={1.25} />
          <span className="font-mono text-[11px] truncate max-w-xs">
            {outputFileName ? `Ready: ${outputFileName}` : 'Zero cloud roundtrips.'}
          </span>
        </div>

        {/* Actions: Reset & Download */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-sm border border-[var(--border-color)] bg-[var(--bg-surface-2)] px-3.5 py-2 text-xs font-mono font-medium text-[var(--text-primary)] transition-colors hover:border-[#FF5A1F]/40 active:scale-[0.98]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.25} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            disabled={!downloadUrl}
            onClick={onDownload}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-sm bg-[#FF5A1F] px-4 py-2 text-xs font-mono font-bold text-black transition-colors hover:bg-[#ff6f3b] active:scale-[0.98] shadow-xs shadow-[#FF5A1F]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5 text-black" strokeWidth={1.5} />
            <span>Download Transmuted File</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
});
