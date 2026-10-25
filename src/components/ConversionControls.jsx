import { memo, useMemo, useEffect } from 'react';
import { Combine, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';

const ALL_IMAGE_FORMATS = [
  { id: 'webp', label: 'WebP', mime: 'image/webp', ext: ['webp'] },
  { id: 'avif', label: 'AVIF', mime: 'image/avif', ext: ['avif'] },
  { id: 'png', label: 'PNG', mime: 'image/png', ext: ['png'] },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: ['jpg', 'jpeg'] },
  { id: 'pdf', label: 'PDF Document', mime: 'application/pdf', ext: ['pdf'] },
  { id: 'bmp', label: 'BMP', mime: 'image/bmp', ext: ['bmp'] },
  { id: 'ico', label: 'ICO', mime: 'image/x-icon', ext: ['ico'] },
];

const ALL_PDF_FORMATS = [
  { id: 'docx', label: 'Word (.docx)', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: ['docx'] },
  { id: 'txt', label: 'Plain Text (.txt)', mime: 'text/plain', ext: ['txt'] },
  { id: 'png_pages', label: 'Pages as PNG', mime: 'image/png', ext: ['png'] },
];

const ALL_COMBINE_FORMATS = [
  { id: 'pdf', label: 'Single PDF Document (.pdf)', mime: 'application/pdf', ext: ['pdf'] },
];

const ALL_SVG_FORMATS = [
  { id: 'png', label: 'High-Res PNG', mime: 'image/png' },
  { id: 'webp', label: 'WebP', mime: 'image/webp' },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg' },
];

export const ConversionControls = memo(function ConversionControls({
  activeFileType = 'image',
  targetMimeType,
  onTargetMimeChange,
  disabled = false,
  files = [],
}) {
  const { t } = useLanguage();

  const isCombine = activeFileType === 'combine';
  const isSvg = activeFileType === 'svg';
  const isPdf = activeFileType === 'pdf' || activeFileType === 'multiple-pdf';

  // Check if multiple PDF files are in combine mode
  const areAllPdfs = useMemo(() => {
    return files.length > 0 && files.every((f) => {
      const name = (f.name || f.fileName || '').toLowerCase();
      const type = (f.type || f.file?.type || '').toLowerCase();
      return name.endsWith('.pdf') || type === 'application/pdf';
    });
  }, [files]);

  // Check if all files are images
  const areAllImages = useMemo(() => {
    return files.length > 0 && files.every((f) => {
      const name = (f.name || f.fileName || '').toLowerCase();
      const type = (f.type || f.file?.type || '').toLowerCase();
      return type.startsWith('image/') || /\.(png|jpe?g|webp|avif|heic|bmp|svg)$/i.test(name);
    });
  }, [files]);

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

  // Dynamically determine available target formats
  const currentFormats = useMemo(() => {
    if (isCombine) {
      return ALL_COMBINE_FORMATS;
    }

    if (isPdf) {
      return ALL_PDF_FORMATS;
    }

    if (isSvg) {
      return ALL_SVG_FORMATS;
    }

    // Default: Image formats filtering (exclude current source format unless PDF)
    return ALL_IMAGE_FORMATS.filter((fmt) => {
      if (fmt.id === 'pdf') return true; // Always allow exporting images to PDF
      if (sourceExt && fmt.ext.includes(sourceExt)) return false;
      if (sourceMime && fmt.mime === sourceMime) return false;
      return true;
    });
  }, [isCombine, isPdf, isSvg, sourceExt, sourceMime]);

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
      {isCombine ? (
        /* Dedicated Combine Mode Controls Bar */
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Combine className="h-4 w-4 text-[#FF5A1F] shrink-0" strokeWidth={1.5} />
            <span className="text-xs font-mono text-[var(--text-primary)]">
              {areAllPdfs
                ? t('pdfMergeQueued', { count: files.length })
                : areAllImages
                ? t('combineImagesQueued', { count: files.length })
                : t('combineMixedQueued', { count: files.length })}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              {t('targetLabel')}
            </span>
            <div className="inline-flex items-center rounded-md bg-[var(--bg-surface-2)] p-0.5 border border-[var(--border-subtle)]">
              <span className="px-3 py-1 text-xs font-mono font-semibold rounded bg-[#FF5A1F] text-black shadow-xs">
                Unified PDF (.pdf)
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Standard Conversion Controls */
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 max-w-full">
            <div className="flex items-center text-xs text-[var(--text-muted)] shrink-0">
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {isPdf ? t('formatLabel') : isSvg ? t('modeLabel') : t('targetLabel')}
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
            {isPdf
              ? (files.length > 1 ? t('batchPdfTransmute') : t('pdfOptimizedStream'))
              : isSvg
              ? t('vectorMinification')
              : t('bitExactLossless')}
          </span>
        </div>
      )}
    </div>
  );
});
