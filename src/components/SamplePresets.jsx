import { memo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

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

  // Preset 3: JSON Dataset
  const handleDenseJson = () => {
    if (disabled || generatingPreset) return;
    setGeneratingPreset('json');
    try {
      const rowCount = 200;
      const records = [];
      const departments = ['Core Graphics', 'WebAssembly', 'Engine Runtime', 'Data Processing'];
      const statuses = ['PROCESSED', 'TRANSFERRED', 'QUANTIZED'];

      for (let i = 1; i <= rowCount; i++) {
        records.push({
          id: `REC-${1000 + i}`,
          department: departments[i % departments.length],
          status: statuses[i % statuses.length],
          latency_ms: 12 + (i % 18),
          memory_kb: (8.4 + (i % 20) * 0.2).toFixed(1),
          timestamp: Date.now() + i * 1000,
        });
      }

      const jsonStr = JSON.stringify(records, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], 'telemetry_dataset.json', {
        type: 'application/json',
      });
      onSelectSample(file);
    } finally {
      setGeneratingPreset(null);
    }
  };

  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)] select-none">
      <span>{t('needTestFile')}</span>
      {activeMode === 'image' && (
        <button
          type="button"
          disabled={disabled || Boolean(generatingPreset)}
          onClick={handle4kImage}
          className="text-[#FF5A1F] hover:underline underline-offset-4 font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
        >
          {generatingPreset === 'image' && <Loader2 className="h-3 w-3 animate-spin text-[#FF5A1F]" />}
          <span>{t('trySampleImage')}</span>
        </button>
      )}

      {activeMode === 'pdf' && (
        <button
          type="button"
          disabled={disabled || Boolean(generatingPreset)}
          onClick={handleMultiPagePdf}
          className="text-[#FF5A1F] hover:underline underline-offset-4 font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
        >
          {generatingPreset === 'pdf' && <Loader2 className="h-3 w-3 animate-spin text-[#FF5A1F]" />}
          <span>{t('trySamplePdf')}</span>
        </button>
      )}

      {activeMode === 'data' && (
        <button
          type="button"
          disabled={disabled || Boolean(generatingPreset)}
          onClick={handleDenseJson}
          className="text-[#FF5A1F] hover:underline underline-offset-4 font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
        >
          {generatingPreset === 'json' && <Loader2 className="h-3 w-3 animate-spin text-[#FF5A1F]" />}
          <span>{t('trySampleData')}</span>
        </button>
      )}
    </div>
  );
});
