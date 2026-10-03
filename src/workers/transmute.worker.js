import { executeDataTransmute } from './engines/dataEngine';
import { executeSvgTransmute } from './engines/svgEngine';
import { optimizePdf, mergePdfs, executePdfTransmute } from './engines/pdfEngine';

/**
 * Transmute Universal Web Worker
 * Integrates image transcoding, vector SVG optimization, PDF manipulation,
 * and structured data (JSON/CSV/XLSX) in pure client memory.
 */

self.onmessage = async (event) => {
  const task = event.data;
  if (!task) return;

  const startTime = performance.now();

  const postProgress = (phase) => {
    self.postMessage({
      type: 'TRANSMUTE_PROGRESS',
      id: task.id,
      phase,
    });
  };

  try {
    // 1. PDF Multi-file Merge Operation
    if (task.type === 'TRANSMUTE_PDF_MERGE') {
      postProgress('MERGING_PDF_STREAMS');
      const { id, pdfBuffers, fileName } = task;
      const totalOriginalBytes = pdfBuffers.reduce((sum, b) => sum + b.byteLength, 0);

      const { outputBuffer, outputMimeType, extraMeta } = await mergePdfs(pdfBuffers);
      const endTime = performance.now();
      const latencyMs = Math.max(1, Math.round((endTime - startTime) * 10) / 10);

      const successMsg = {
        type: 'TRANSMUTE_SUCCESS',
        id,
        fileName: fileName || 'merged_document.pdf',
        outputBuffer,
        outputMimeType,
        latencyMs,
        originalBytes: totalOriginalBytes,
        transmutedBytes: outputBuffer.byteLength,
        extraMeta,
      };

      self.postMessage(successMsg, [outputBuffer]);
      return;
    }

    if (task.type !== 'TRANSMUTE_TASK') return;

    const { id, fileName, fileBuffer, sourceMimeType, targetMimeType, quality } = task;
    const originalBytes = fileBuffer ? fileBuffer.byteLength : 0;
    const lowerName = (fileName || '').toLowerCase();

    const isData =
      sourceMimeType.includes('json') ||
      sourceMimeType.includes('csv') ||
      lowerName.endsWith('.json') ||
      lowerName.endsWith('.csv');

    const isSvg =
      sourceMimeType.includes('svg') || lowerName.endsWith('.svg');

    const isPdf =
      sourceMimeType === 'application/pdf' || lowerName.endsWith('.pdf');

    let outputBuffer;
    let outputMimeType;
    let extraMeta = {};

    postProgress('BUFFER_INGEST_CLASSIFIED');

    if (isData) {
      // Structured Data Pipeline: JSON <-> CSV <-> XLSX
      postProgress('PROCESSING_STRUCTURED_DATA_TREE');
      const sourceFormat = lowerName.endsWith('.json') || sourceMimeType.includes('json') ? 'JSON' : 'CSV';
      let targetFormat = 'CSV';

      if (targetMimeType.includes('json') || targetMimeType === 'JSON') targetFormat = 'JSON';
      else if (targetMimeType.includes('spreadsheet') || targetMimeType === 'XLSX') targetFormat = 'XLSX';
      else if (targetMimeType.includes('csv') || targetMimeType === 'CSV') targetFormat = 'CSV';

      postProgress(`SYNTHESIZING_${targetFormat}_REPRESENTATION`);
      const dataResult = await executeDataTransmute(fileBuffer, sourceFormat, targetFormat);
      outputBuffer = dataResult.outputBuffer;
      outputMimeType = dataResult.outputMimeType;
      extraMeta = dataResult.extraMeta;
    } else if (isSvg) {
      // Vector & SVG Pipeline
      postProgress('PARSING_VECTOR_DOM_NODES');
      const targetFormat = targetMimeType.includes('png') || targetMimeType === 'PNG' ? 'PNG' : 'SVG';
      postProgress(`OPTIMIZING_VECTOR_GRAPHICS_${targetFormat}`);
      const svgResult = await executeSvgTransmute(fileBuffer, targetFormat);
      outputBuffer = svgResult.outputBuffer;
      outputMimeType = svgResult.outputMimeType;
      extraMeta = svgResult.extraMeta;
    } else if (isPdf) {
      // PDF Local Engine (Compress, Word DOCX, Plain Text)
      postProgress('PROCESSING_PDF_STREAM');
      const pdfResult = await executePdfTransmute(fileBuffer, targetMimeType);
      outputBuffer = pdfResult.outputBuffer;
      outputMimeType = pdfResult.outputMimeType;
      extraMeta = pdfResult.extraMeta;
    } else {
      // Standard Raster Image Pipeline via OffscreenCanvas
      postProgress('DECODING_IMAGE_BITMAP');
      let imageBitmap;
      try {
        const sourceBlob = new Blob([fileBuffer], { type: sourceMimeType || 'image/jpeg' });
        imageBitmap = await createImageBitmap(sourceBlob);
      } catch (decodeErr) {
        // Fallback: untyped blob lets browser native decoder sniff magic bytes (JFIF, JPEG, PNG, WebP)
        try {
          const untypedBlob = new Blob([fileBuffer]);
          imageBitmap = await createImageBitmap(untypedBlob);
        } catch (finalErr) {
          throw new Error(`Failed to decode image buffer: ${finalErr.message}`);
        }
      }

      const width = imageBitmap.width;
      const height = imageBitmap.height;

      postProgress(`ALLOCATING_OFFSCREEN_CANVAS_${width}x${height}`);
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext('2d', {
        alpha: targetMimeType !== 'image/jpeg',
        willReadFrequently: false,
      });

      if (!ctx) {
        throw new Error('Failed to acquire 2D rendering context on OffscreenCanvas.');
      }

      postProgress('RASTERIZING_IN_MEMORY_PIXELS');
      ctx.drawImage(imageBitmap, 0, 0);
      imageBitmap.close();

      postProgress(`TRANSCODING_STREAM_TO_${(targetMimeType || 'image/webp').toUpperCase()}`);
      let outputBlob;

      try {
        outputBlob = await offscreen.convertToBlob({
          type: targetMimeType || 'image/webp',
          quality: targetMimeType === 'image/png' ? undefined : quality,
        });
      } catch {
        const fallbackMime = targetMimeType === 'image/png' ? 'image/jpeg' : 'image/webp';
        outputBlob = await offscreen.convertToBlob({
          type: fallbackMime,
          quality,
        });
      }

      postProgress('CONVERTING_TO_TRANSFERABLE_ARRAYBUFFER');
      outputBuffer = await outputBlob.arrayBuffer();
      outputMimeType = outputBlob.type || targetMimeType || 'image/webp';
      extraMeta = { width, height };
    }

    const transmutedBytes = outputBuffer.byteLength;
    const endTime = performance.now();
    const latencyMs = Math.max(1, Math.round((endTime - startTime) * 10) / 10);

    const successMsg = {
      type: 'TRANSMUTE_SUCCESS',
      id,
      fileName,
      outputBuffer,
      outputMimeType,
      latencyMs,
      originalBytes,
      transmutedBytes,
      extraMeta,
    };

    // ZERO-COPY: Transfer buffer ownership directly to main thread
    self.postMessage(successMsg, [outputBuffer]);
  } catch (err) {
    self.postMessage({
      type: 'TRANSMUTE_ERROR',
      id: task.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
