import { memo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { cn } from "../lib/utils";

export const SamplePresets = memo(function SamplePresets({ 
  onSelectSample, 
  disabled = false, 
  activeMode = 'image' 
}) {
  const { t } = useLanguage();
  const [generatingPreset, setGeneratingPreset] = useState(null);

  // Preset 1: 4K Procedural High-Res Texture
  const handle4kImage = async () => {
    if (disabled || generatingPreset) return;
    setGeneratingPreset('image');
    try {
      const width = 3840;
      const height = 2160;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#020617');
        grad.addColorStop(0.3, '#1E293B');
        grad.addColorStop(0.6, '#FF5A1F');
        grad.addColorStop(1, '#0A0A0A');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        for (let x = 0; x < width; x += 60) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += 60) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        ctx.font = 'bold 72px monospace';
        ctx.fillStyle = '#EDEDED';
        ctx.fillText('OMNISHIFT_SPECIMEN_4K', 100, 200);
        ctx.font = '36px monospace';
        ctx.fillStyle = '#888888';
        ctx.fillText(`Dimensions: ${width}x${height} • In-Memory Buffer`, 100, 260);
      }

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        const file = new File([blob], 'specimen_4k.png', { type: 'image/png' });
        onSelectSample(file);
      }
    } finally {
      setGeneratingPreset(null);
    }
  };

  // Preset 2: Multi-Page PDF
  const handleMultiPagePdf = async () => {
    if (disabled || generatingPreset) return;
    setGeneratingPreset('pdf');
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const sections = [
        'Client-Side Architecture & Zero Egress Proof',
        'Hardware Concurrency & Dedicated Worker Threads',
        'In-Memory Object Streams & Linearization',
      ];

      for (let i = 0; i < sections.length; i++) {
        const page = pdfDoc.addPage([595.28, 841.89]);
        page.drawText(`OMNISHIFT SPECIFICATION — CHAPTER ${i + 1}`, {
          x: 50,
          y: 780,
          size: 16,
          font: boldFont,
          color: rgb(1, 0.35, 0.12),
        });
        page.drawText(sections[i], {
          x: 50,
          y: 750,
          size: 12,
          font: boldFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        for (let line = 0; line < 12; line++) {
          page.drawText(
            `Data packet stream line #${line + 1}: High-performance in-memory processing.`,
            {
              x: 50,
              y: 700 - line * 24,
              size: 10,
              font: regularFont,
              color: rgb(0.3, 0.3, 0.3),
            }
          );
        }
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const file = new File([blob], 'engineering_specimen.pdf', {
        type: 'application/pdf',
      });
      onSelectSample(file);
    } finally {
      setGeneratingPreset(null);
    }
  };

  // Preset 3: 2 Sample PDFs for Combine/Merge Test
  const handleSampleCombine = async () => {
    if (disabled || generatingPreset) return;
    setGeneratingPreset('combine');
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

      // Doc 1
      const doc1 = await PDFDocument.create();
      const font1 = await doc1.embedFont(StandardFonts.HelveticaBold);
      const page1 = doc1.addPage([595.28, 841.89]);
      page1.drawText('OMNISHIFT DOCUMENT PART 1', { x: 50, y: 750, size: 20, font: font1, color: rgb(1, 0.35, 0.12) });
      page1.drawText('This is the first document stream prepared for in-memory merging.', { x: 50, y: 710, size: 12, color: rgb(0.2, 0.2, 0.2) });
      const bytes1 = await doc1.save();
      const file1 = new File([bytes1], 'sample_part1.pdf', { type: 'application/pdf' });

      // Doc 2
      const doc2 = await PDFDocument.create();
      const font2 = await doc2.embedFont(StandardFonts.HelveticaBold);
      const page2 = doc2.addPage([595.28, 841.89]);
      page2.drawText('OMNISHIFT DOCUMENT PART 2', { x: 50, y: 750, size: 20, font: font2, color: rgb(0.1, 0.6, 0.3) });
      page2.drawText('This is the second document stream to be appended in volatile memory.', { x: 50, y: 710, size: 12, color: rgb(0.2, 0.2, 0.2) });
      const bytes2 = await doc2.save();
      const file2 = new File([bytes2], 'sample_part2.pdf', { type: 'application/pdf' });

      onSelectSample([file1, file2]);
    } finally {
      setGeneratingPreset(null);
    }
  };

  // Preset: Multiple Images to Single PDF Combine Test
  const handleImagesCombine = async () => {
    if (disabled || generatingPreset) return;
    setGeneratingPreset('imagesCombine');
    try {
      const colors = [
        { bg: '#0F172A', text: '#FF5A1F', label: 'Image Page 1' },
        { bg: '#1E293B', text: '#38BDF8', label: 'Image Page 2' },
        { bg: '#0A0A0A', text: '#10B981', label: 'Image Page 3' },
      ];

      const files = [];
      for (let i = 0; i < colors.length; i++) {
        const { bg, text, label } = colors[i];
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, 1200, 800);
          ctx.fillStyle = text;
          ctx.font = 'bold 52px sans-serif';
          ctx.fillText(`OMNISHIFT • ${label}`, 80, 240);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '30px monospace';
          ctx.fillText(`Multi-page Image Ingest Stream • Specimen #${i + 1}`, 80, 320);
        }
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        files.push(new File([blob], `sample_photo_${i + 1}.png`, { type: 'image/png' }));
      }

      onSelectSample(files);
    } finally {
      setGeneratingPreset(null);
    }
  };

  // Preset: Mixed PDF + PNG Image for Mixed Combine Test
  const handleMixedCombine = async () => {
    if (disabled || generatingPreset) return;
    setGeneratingPreset('mixed');
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

      // Sample PDF
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const page = doc.addPage([595.28, 841.89]);
      page.drawText('OMNISHIFT DOCUMENT STREAM', { x: 50, y: 750, size: 20, font, color: rgb(1, 0.35, 0.12) });
      page.drawText('Page 1 of combined PDF document.', { x: 50, y: 710, size: 12, color: rgb(0.2, 0.2, 0.2) });
      const pdfBytes = await doc.save();
      const pdfFile = new File([pdfBytes], 'report_part1.pdf', { type: 'application/pdf' });

      // Sample Image
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 1200, 800);
        ctx.fillStyle = '#FF5A1F';
        ctx.font = 'bold 44px sans-serif';
        ctx.fillText('OMNISHIFT GRAPHIC SPECIMEN', 80, 250);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '28px monospace';
        ctx.fillText('Embedded image page in unified PDF stream', 80, 320);
      }
      const imgBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const imgFile = new File([imgBlob], 'chart_specimen.png', { type: 'image/png' });

      onSelectSample([pdfFile, imgFile]);
    } finally {
      setGeneratingPreset(null);
    }
  };

  return (
    <div className={cn('mt-4', 'flex', 'flex-wrap', 'items-center', 'justify-center', 'gap-2', 'text-xs', 'text-[var(--text-muted)]', 'select-none')}>
      <span>{t('needTestFile')}</span>
      {activeMode === 'image' && (
        <button
          type="button"
          disabled={disabled || Boolean(generatingPreset)}
          onClick={handle4kImage}
          className={cn('text-[#FF5A1F]', 'hover:underline', 'underline-offset-4', 'font-medium', 'transition-colors', 'disabled:opacity-50', 'inline-flex', 'items-center', 'gap-1', 'cursor-pointer')}
        >
          {generatingPreset === 'image' && <Loader2 className={cn('h-3', 'w-3', 'animate-spin', 'text-[#FF5A1F]')} />}
          <span>{t('trySampleImage')}</span>
        </button>
      )}

      {activeMode === 'pdf' && (
        <button
          type="button"
          disabled={disabled || Boolean(generatingPreset)}
          onClick={handleMultiPagePdf}
          className={cn('text-[#FF5A1F]', 'hover:underline', 'underline-offset-4', 'font-medium', 'transition-colors', 'disabled:opacity-50', 'inline-flex', 'items-center', 'gap-1', 'cursor-pointer')}
        >
          {generatingPreset === 'pdf' && <Loader2 className={cn('h-3', 'w-3', 'animate-spin', 'text-[#FF5A1F]')} />}
          <span>{t('trySamplePdf')}</span>
        </button>
      )}

      {activeMode === 'combine' && (
        <>
          <button
            type="button"
            disabled={disabled || Boolean(generatingPreset)}
            onClick={handleSampleCombine}
            className={cn('text-[#FF5A1F]', 'hover:underline', 'underline-offset-4', 'font-medium', 'transition-colors', 'disabled:opacity-50', 'inline-flex', 'items-center', 'gap-1', 'cursor-pointer')}
          >
            {generatingPreset === 'combine' && <Loader2 className={cn('h-3', 'w-3', 'animate-spin', 'text-[#FF5A1F]')} />}
            <span>{t('trySampleCombine')}</span>
          </button>
          <span className="text-[var(--border-subtle)]">•</span>
          <button
            type="button"
            disabled={disabled || Boolean(generatingPreset)}
            onClick={handleImagesCombine}
            className={cn('text-[#FF5A1F]', 'hover:underline', 'underline-offset-4', 'font-medium', 'transition-colors', 'disabled:opacity-50', 'inline-flex', 'items-center', 'gap-1', 'cursor-pointer')}
          >
            {generatingPreset === 'imagesCombine' && <Loader2 className={cn('h-3', 'w-3', 'animate-spin', 'text-[#FF5A1F]')} />}
            <span>{t('trySampleCombineImages')}</span>
          </button>
          <span className="text-[var(--border-subtle)]">•</span>
          <button
            type="button"
            disabled={disabled || Boolean(generatingPreset)}
            onClick={handleMixedCombine}
            className={cn('text-[#FF5A1F]', 'hover:underline', 'underline-offset-4', 'font-medium', 'transition-colors', 'disabled:opacity-50', 'inline-flex', 'items-center', 'gap-1', 'cursor-pointer')}
          >
            {generatingPreset === 'mixed' && <Loader2 className={cn('h-3', 'w-3', 'animate-spin', 'text-[#FF5A1F]')} />}
            <span>{t('trySampleMixedCombine')}</span>
          </button>
        </>
      )}
    </div>
  );
});
