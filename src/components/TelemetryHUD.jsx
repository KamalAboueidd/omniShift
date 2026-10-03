import { memo } from 'react';
import { motion } from 'framer-motion';
import { Download, RotateCcw, Clock, ArrowRight, Gauge, ShieldCheck, Zap, FileText, Activity } from 'lucide-react';
import { formatBytes } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';

export const TelemetryHUD = memo(function TelemetryHUD({
  telemetry,
  downloadUrl,
  outputFileName,
  onReset,
  onDownload,
}) {
  const { t } = useLanguage();
  if (!telemetry) return null;

  const isPdf = telemetry.targetFormat === 'PDF' || telemetry.extraMeta?.originalPages !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, transform: 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transform: 'translateY(6px)' }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
      }}
      className="w-full mt-5 pt-4 border-t border-[var(--border-subtle)] transition-colors select-none"
    >
      {/* Top Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF5A1F]" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-primary)]">
            Telemetry
          </span>
          <span className="text-[var(--border-subtle)]">•</span>
          <span className="font-mono text-[11px] text-[var(--text-muted)] truncate max-w-[200px] sm:max-w-xs">
            {telemetry.fileName}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)]">
          {isPdf && telemetry.extraMeta?.originalPages ? (
            <span className="flex items-center gap-1 text-cyan-500 dark:text-cyan-400">
              <FileText className="h-3 w-3" strokeWidth={1.25} />
              {telemetry.extraMeta.originalPages} Pages
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-[#FF5A1F]" strokeWidth={1.25} />
              {telemetry.workerCoreId}
            </span>
          )}
          <span className="text-[var(--border-subtle)]">•</span>
          <span className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400">
            <Zap className="h-3 w-3" strokeWidth={1.25} />
            <span className="tabular-nums">{telemetry.throughputMbps}</span> MB/s
          </span>
        </div>
      </div>

      {/* 3 Metrics in a flat grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
        {/* Metric 1: Latency */}
        <div className="flex flex-col justify-between rounded bg-[var(--bg-surface-2)] p-3 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="font-mono text-[10px] uppercase tracking-wider">{t('latency')}</span>
            <Clock className="h-3 w-3 text-[var(--text-muted)]" strokeWidth={1} />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
              {telemetry.latencyMs}
            </span>
            <span className="font-mono text-xs text-[var(--text-muted)]">ms</span>
          </div>
          <span className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)] opacity-70">
            {isPdf ? 'pdf-lib in-memory' : 'OffscreenCanvas'}
          </span>
        </div>

        {/* Metric 2: Reduction */}
        <div className="flex flex-col justify-between rounded bg-[var(--bg-surface-2)] p-3 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="font-mono text-[10px] uppercase tracking-wider">{t('reduction')}</span>
            <Gauge className="h-3 w-3 text-[#FF5A1F]" strokeWidth={1} />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold tracking-tight text-[#FF5A1F] tabular-nums">
              {telemetry.reductionPercentage > 0
                ? `+${telemetry.reductionPercentage}%`
                : `${telemetry.reductionPercentage}%`}
            </span>
          </div>
          <span className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)] opacity-70">
            {t('memoryDelta')}
          </span>
        </div>

        {/* Metric 3: Size Delta */}
        <div className="flex flex-col justify-between rounded bg-[var(--bg-surface-2)] p-3 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="font-mono text-[10px] uppercase tracking-wider">{t('sizeDelta')}</span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              {telemetry.sourceFormat} → {telemetry.targetFormat}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-xs font-semibold text-[var(--text-primary)] tabular-nums">
            <span className="text-[var(--text-muted)]">{formatBytes(telemetry.originalBytes)}</span>
            <ArrowRight className="h-3 w-3 opacity-60 rtl:rotate-180" strokeWidth={1.25} />
            <span className="text-[var(--text-primary)]">{formatBytes(telemetry.transmutedBytes)}</span>
          </div>
          <span className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)] opacity-70">
            Δ: {formatBytes(Math.abs(telemetry.originalBytes - telemetry.transmutedBytes))}
          </span>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" strokeWidth={1.25} />
          <span className="font-mono text-[11px] truncate max-w-xs">
            {outputFileName ? `Ready: ${outputFileName}` : t('integrityVerified')}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-1.5 text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={1.25} />
            <span>{t('reset')}</span>
          </button>

          <button
            type="button"
            disabled={!downloadUrl}
            onClick={onDownload}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-sm bg-[#FF5A1F] px-4 py-1.5 text-xs font-mono font-bold text-black hover:bg-[#ff6f3b] active:scale-[0.98] transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5 text-black" strokeWidth={1.5} />
            <span>{t('downloadTransmuted')}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
});
