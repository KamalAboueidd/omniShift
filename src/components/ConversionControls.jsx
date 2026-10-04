import { memo, useMemo, useEffect } from 'react';
import { Combine } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';

const ALL_IMAGE_FORMATS = [
  { id: 'webp', label: 'WebP', mime: 'image/webp', ext: ['webp'] },
  { id: 'avif', label: 'AVIF', mime: 'image/avif', ext: ['avif'] },
  { id: 'png', label: 'PNG', mime: 'image/png', ext: ['png'] },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: ['jpg', 'jpeg'] },
  { id: 'bmp', label: 'BMP', mime: 'image/bmp', ext: ['bmp'] },
  { id: 'ico', label: 'ICO', mime: 'image/x-icon', ext: ['ico'] },
];

const ALL_DATA_FORMATS = [
  { id: 'csv', label: 'CSV', mime: 'text/csv', ext: ['csv'] },
  { id: 'json', label: 'JSON', mime: 'application/json', ext: ['json'] },
  { id: 'xlsx', label: 'Excel (.xlsx)', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: ['xlsx'] },
];

const ALL_SVG_FORMATS = [
  { id: 'png', label: 'High-Res PNG', mime: 'image/png' },
  { id: 'webp', label: 'WebP', mime: 'image/webp' },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg' },
];

const ALL_PDF_SINGLE_FORMATS = [
  { id: 'docx', label: 'Word (.docx)', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: ['docx'] },
  { id: 'pptx', label: 'PowerPoint (.pptx)', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: ['pptx'] },
  { id: 'txt', label: 'Plain Text (.txt)', mime: 'text/plain', ext: ['txt'] },
  { id: 'png_pages', label: 'Pages as PNG', mime: 'image/png', ext: ['png'] },
];

const ALL_PDF_MULTI_FORMATS = [
  { id: 'merge', label: 'Merge PDFs', mime: 'application/pdf', ext: ['pdf'] },
  { id: 'docx', label: 'Word (.docx)', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: ['docx'] },
  { id: 'pptx', label: 'PowerPoint (.pptx)', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: ['pptx'] },
  { id: 'txt', label: 'Plain Text (.txt)', mime: 'text/plain', ext: ['txt'] },
];

const ALL_PRESENTATION_FORMATS = [
  { id: 'docx', label: 'Word (.docx)', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: ['docx'] },
  { id: 'pdf', label: 'PDF Document', mime: 'application/pdf', ext: ['pdf'] },
  { id: 'extract_images', label: 'Extract Images (.zip)', mime: 'application/zip', ext: ['zip'] },
  { id: 'txt', label: 'Plain Text (.txt)', mime: 'text/plain', ext: ['txt'] },
];

export const ConversionControls = memo(function ConversionControls({
  activeFileType = 'image',
  targetMimeType,
  onTargetMimeChange,
  onTriggerPdfMerge,
  disabled = false,
  pdfCount = 0,
  files = [],
}) {
  const { t } = useLanguage();

  const isPresentation = activeFileType === 'presentation';
  const isData = activeFileType === 'data';
  const isSvg = activeFileType === 'svg';
  const isPdf = activeFileType === 'pdf';
  const isMultiplePdf = activeFileType === 'multiple-pdf';

  // Extract source file extension and MIME for intelligent exclusion
  const sourceExt = useMemo(() => {
    const f = files[0];
    if (!f) return '';
    const name = (f.name || f.fileName || '').toLowerCase();
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop() : '';
  }, [files]);

  const sourceMime = useMemo(() => {
    const f = files[0];
    return (f?.file?.type || f?.type || '').toLowerCase();
  }, [files]);

  // Dynamically filter out the current source format
  const currentFormats = useMemo(() => {
    if (isPresentation || sourceExt === 'pptx' || sourceExt === 'ppt') {
      return ALL_PRESENTATION_FORMATS;
    }

    if (isMultiplePdf) {
      return ALL_PDF_MULTI_FORMATS;
    }

    if (isPdf) {
      return ALL_PDF_SINGLE_FORMATS;
    }

    if (isSvg) {
      return ALL_SVG_FORMATS;
    }

    if (isData) {
      return ALL_DATA_FORMATS.filter((fmt) => {
        if (sourceExt && fmt.ext.includes(sourceExt)) return false;
        if (sourceMime && fmt.mime === sourceMime) return false;
        return true;
      });
    }

    // Default: Image formats filtering
    return ALL_IMAGE_FORMATS.filter((fmt) => {
      if (sourceExt && fmt.ext.includes(sourceExt)) return false;
      if (sourceMime && fmt.mime === sourceMime) return false;
      return true;
    });
  }, [isPresentation, isMultiplePdf, isPdf, isSvg, isData, sourceExt, sourceMime]);

  // Automatically adjust target format if current selection is excluded or invalid
  useEffect(() => {
    if (currentFormats.length > 0) {
      const isCurrentValid = currentFormats.some((fmt) => fmt.mime === targetMimeType);
      if (!isCurrentValid) {
        onTargetMimeChange(currentFormats[0].mime);
      }
    }
  }, [currentFormats, targetMimeType, onTargetMimeChange]);

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

          <div className="flex items-center gap-2">
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

            {targetMimeType === 'application/pdf' && (
              <button
                type="button"
                disabled={disabled}
                onClick={onTriggerPdfMerge}
                className="inline-flex items-center gap-2 rounded bg-[#FF5A1F] px-4 py-1.5 text-xs font-mono font-bold text-black hover:bg-[#ff6f3b] transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Combine className="h-3.5 w-3.5 text-black" strokeWidth={1.5} />
                <span>{t('mergeDocuments')}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Target Formats Pill Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 max-w-full">
              <div className="flex items-center text-xs text-[var(--text-muted)] shrink-0">
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {isData || isPresentation || isPdf ? t('formatLabel') : isSvg ? t('modeLabel') : t('targetLabel')}
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
              {isPresentation
                ? (t('presentationSlides') || 'Slide layout serialization')
                : isData
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
