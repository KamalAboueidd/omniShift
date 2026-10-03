import { memo, useState } from 'react';
import { FileImage, FileText, Database, Loader2, Play } from 'lucide-react';

export const SamplePresets = memo(function SamplePresets({ onSelectSample, disabled = false }) {
  const [generatingPreset, setGeneratingPreset] = useState(null);

  // Preset 1: 4K Procedural High-Res Texture
  const handle4kImage = async () => {
    if (disabled || generatingPreset) return;
    setGeneratingPreset('4k');
    try {
      const width = 3840;
      const height = 2160;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Complex gradient & high-frequency spatial vectors
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#020617');
        grad.addColorStop(0.3, '#1E293B');
        grad.addColorStop(0.6, '#FF5A1F');
        grad.addColorStop(1, '#0A0A0A');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Grid lines to stress quantization
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
        ctx.fillText('OMNISHIFT_4K_STRESS_SPECIMEN', 100, 200);
        ctx.font = '36px monospace';
        ctx.fillStyle = '#888888';
        ctx.fillText(`Dimensions: ${width}x${height} • In-Memory Buffer`, 100, 260);
      }

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        const file = new File([blob], 'procedural_specimen_4k.png', { type: 'image/png' });
        onSelectSample(file);
      }
    } finally {
      setGeneratingPreset(null);
    }
  };

  // Preset 2: Multi-Page PDF Engineering Specimen
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
        'Memory Lifecycle Management & GC Safety',
      ];

      for (let i = 0; i < sections.length; i++) {
        const page = pdfDoc.addPage([595.28, 841.89]); // A4
        // Section Header
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

        // Body text simulation
        for (let line = 0; line < 18; line++) {
          page.drawText(
            `Data packet stream line #${line + 1}: High-performance off-thread pipeline processing Transferable ArrayBuffer memory block 0x${(
              100000 +
              line * 4096
            ).toString(16)}.`,
            {
              x: 50,
              y: 700 - line * 24,
              size: 10,
              font: regularFont,
              color: rgb(0.3, 0.3, 0.3),
            }
          );
        }

        page.drawText(`Page ${i + 1} of ${sections.length} • Generated locally in browser RAM`, {
          x: 50,
          y: 50,
          size: 9,
          font: regularFont,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const file = new File([blob], 'engineering_report_multipage.pdf', {
        type: 'application/pdf',
      });
      onSelectSample(file);
    } finally {
      setGeneratingPreset(null);
    }
  };

  // Preset 3: 10,000-Row Dense Structured JSON Dataset
  const handleDenseJson = () => {
    if (disabled || generatingPreset) return;
    setGeneratingPreset('json');
    try {
      const rowCount = 10000;
      const records = [];
      const departments = ['Kernel', 'WebAssembly', 'OffscreenCanvas', 'Security', 'Hardware acceleration'];
      const statuses = ['PROCESSED', 'TRANSFERRED', 'QUANTIZED', 'CACHED'];

      for (let i = 1; i <= rowCount; i++) {
        records.push({
          transaction_id: `TXN-${100000 + i}`,
          sequence: i,
          department: departments[i % departments.length],
          status: statuses[i % statuses.length],
          latency_micros: 420 + (i % 240),
          memory_footprint_kb: (12.4 + (i % 50) * 0.4).toFixed(2),
          zero_egress_verified: true,
          timestamp: 1711900000000 + i * 1000,
        });
      }

      const jsonStr = JSON.stringify(records, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], `dense_telemetry_${rowCount}_rows.json`, {
        type: 'application/json',
      });
      onSelectSample(file);
    } finally {
      setGeneratingPreset(null);
    }
  };

  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2 text-xs text-[var(--text-muted)]">
      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
        <span className="flex items-center gap-1 text-[var(--text-muted)]">
          <Play className="h-2.5 w-2.5 text-[#FF5A1F]" fill="currentColor" />
          <span>Presets:</span>
        </span>

        {/* Preset 1: 4K Raw Image */}
        <button
          type="button"
          disabled={disabled || Boolean(generatingPreset)}
          onClick={handle4kImage}
          className="inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-surface-1)] px-2 py-0.5 text-[var(--text-primary)] hover:border-[#FF5A1F]/40 hover:bg-[var(--bg-surface-2)] transition-colors disabled:opacity-50"
        >
          {generatingPreset === '4k' ? (
            <Loader2 className="h-3 w-3 animate-spin text-[#FF5A1F]" />
          ) : (
            <FileImage className="h-3 w-3 text-[#FF5A1F]" strokeWidth={1.25} />
          )}
          <span>Try 4K Raw Image</span>
        </button>

        {/* Preset 2: Multi-Page PDF */}
        <button
          type="button"
          disabled={disabled || Boolean(generatingPreset)}
          onClick={handleMultiPagePdf}
          className="inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-surface-1)] px-2 py-0.5 text-[var(--text-primary)] hover:border-[#FF5A1F]/40 hover:bg-[var(--bg-surface-2)] transition-colors disabled:opacity-50"
        >
          {generatingPreset === 'pdf' ? (
            <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
          ) : (
            <FileText className="h-3 w-3 text-cyan-400" strokeWidth={1.25} />
          )}
          <span>Try Multi-Page PDF</span>
        </button>

        {/* Preset 3: 10,000-Row JSON */}
        <button
          type="button"
          disabled={disabled || Boolean(generatingPreset)}
          onClick={handleDenseJson}
          className="inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-surface-1)] px-2 py-0.5 text-[var(--text-primary)] hover:border-[#FF5A1F]/40 hover:bg-[var(--bg-surface-2)] transition-colors disabled:opacity-50"
        >
          {generatingPreset === 'json' ? (
            <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
          ) : (
            <Database className="h-3 w-3 text-emerald-400" strokeWidth={1.25} />
          )}
          <span>Try 10,000-Row JSON</span>
        </button>
      </div>

      <span className="font-mono text-[10px] text-[var(--text-muted)] hidden sm:inline">
        Zero Network Calls • In-Memory Synthesis
      </span>
    </div>
  );
});
