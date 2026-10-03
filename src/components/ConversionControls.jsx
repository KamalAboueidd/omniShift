import { memo } from 'react';
import { Combine } from 'lucide-react';
import { TARGET_FORMATS } from '../lib/constants';
import { cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';

const DATA_FORMATS = [
  { id: 'csv', label: 'CSV', mime: 'text/csv', lossy: false },
  { id: 'json', label: 'JSON', mime: 'application/json', lossy: false },
  { id: 'xlsx', label: 'Excel (.xlsx)', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', lossy: false },
];

const SVG_FORMATS = [
  { id: 'svg', label: 'Minified SVG', mime: 'image/svg+xml', lossy: false },
  { id: 'png', label: 'High-Res PNG', mime: 'image/png', lossy: false },
];

const PDF_FORMATS = [
  { id: 'pdf_compress', label: 'Compress PDF', mime: 'application/pdf', lossy: false },
  { id: 'docx', label: 'Word (.docx)', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', lossy: false },
  { id: 'txt', label: 'Plain Text (.txt)', mime: 'text/plain', lossy: false },
];

export const ConversionControls = memo(function ConversionControls({
  activeFileType = 'image',
  targetMimeType,
  onTargetMimeChange,
  onTriggerPdfMerge,
  disabled = false,
  pdfCount = 0,
}) {
  const { t } = useLanguage();

  const isData = activeFileType === 'data';
  const isSvg = activeFileType === 'svg';
  const isPdf = activeFileType === 'pdf';
  const isMultiplePdf = activeFileType === 'multiple-pdf';

  const currentFormats = isData 
    ? DATA_FORMATS 
    : isSvg 
    ? SVG_FORMATS 
    : isPdf
    ? PDF_FORMATS
    : TARGET_FORMATS;

  return (
    <div className="w-full mt-4 pt-3.5 border-t border-[var(--border-subtle)] select-none transition-colors">
      {isMultiplePdf ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Combine className="h-4 w-4 text-[#FF5A1F]" strokeWidth={1.5} />
            <span className="text-xs font-mono text-[var(--text-primary)]">
              {t('pdfMergeQueued', { count: pdfCount })}
            </span>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={onTriggerPdfMerge}
            className="inline-flex items-center gap-2 rounded bg-[#FF5A1F] px-4 py-2 text-xs font-mono font-bold text-black hover:bg-[#ff6f3b] transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Combine className="h-3.5 w-3.5 text-black" strokeWidth={1.5} />
            <span>{t('mergeDocuments')}</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Target Formats Pill Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 max-w-full">
              <div className="flex items-center text-xs text-[var(--text-muted)] shrink-0">
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {isData ? t('formatLabel') : isSvg ? t('modeLabel') : isPdf ? t('formatLabel') : t('targetLabel')}
                </span>
              </div>

              <div className="inline-flex max-w-full overflow-x-auto no-scrollbar rounded-md bg-[var(--bg-surface-2)] p-0.5 border border-[var(--border-subtle)]">
                {currentFormats.map((fmt) => {
                  const active = fmt.mime === targetMimeType;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onTargetMimeChange(fmt.mime)}
                      className={cn(
                        'whitespace-nowrap px-3 py-1 text-xs font-mono font-medium rounded transition-colors cursor-pointer',
                        active
                          ? 'bg-[#FF5A1F] text-black font-semibold shadow-xs'
                          : 'text-[var(--text-muted)] hover:text-[#FF5A1F] bg-transparent',
                        disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {fmt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <span className="font-mono text-[11px] text-[var(--text-muted)] opacity-70">
              {isData
                ? t('tabularSerialization')
                : isSvg
                ? t('vectorMinification')
                : isPdf
                ? t('pdfOptimizedStream')
                : t('bitExactLossless')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
