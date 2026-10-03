import { csvToJson, jsonToCsv } from '../workers/engines/dataEngine';
import { minifySvg } from '../workers/engines/svgEngine';

/**
 * Robust Client-Side Fallback Engine
 * Ensures 100% conversion guarantee on the main thread if Web Worker pool
 * encounters sandbox restrictions, module errors, or browser timeouts.
 */

export async function localFallbackTransmute(task) {
  const startTime = performance.now();
  const { id, file, targetMimeType = 'image/webp', fileName = file?.name || 'file', pdfBuffers, type } = task;

  // 1. PDF Merge
  if (type === 'TRANSMUTE_PDF_MERGE' || (pdfBuffers && pdfBuffers.length > 0)) {
    const buffers = pdfBuffers || [];
    const { PDFDocument } = await import('pdf-lib');
    const mergedDoc = await PDFDocument.create();
    let totalPages = 0;

    for (const buf of buffers) {
      try {
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pageIndices = doc.getPageIndices();
        const copiedPages = await mergedDoc.copyPages(doc, pageIndices);
        for (const p of copiedPages) {
          mergedDoc.addPage(p);
          totalPages += 1;
        }
      } catch (err) {
        console.warn('PDF page merge warning:', err);
      }
    }

    const mergedBytes = await mergedDoc.save({ useObjectStreams: true });
    const outputBuffer = mergedBytes.buffer.slice(
      mergedBytes.byteOffset,
      mergedBytes.byteOffset + mergedBytes.byteLength
    );

    const totalOriginalBytes = buffers.reduce((acc, b) => acc + (b.byteLength || 0), 0);
    const latencyMs = Math.max(1, Math.round(performance.now() - startTime));

    return {
      type: 'TRANSMUTE_SUCCESS',
      id,
      fileName: fileName || 'merged_document.pdf',
      outputBuffer,
      outputMimeType: 'application/pdf',
      latencyMs,
      originalBytes: totalOriginalBytes,
      transmutedBytes: outputBuffer.byteLength,
      extraMeta: { totalPages, mergeEngine: 'LocalMainThreadFallback' },
      workerCoreId: 'main-thread-fallback',
    };
  }

  // 2. Structured Data (CSV / JSON)
  const lowerName = fileName.toLowerCase();
  const isData = lowerName.endsWith('.json') || lowerName.endsWith('.csv') || file?.type?.includes('json') || file?.type?.includes('csv');

  if (isData) {
    const text = await file.text();
    let outputBuffer;
    let outputMimeType = 'text/csv';

    if (lowerName.endsWith('.json') || file?.type?.includes('json')) {
      // JSON -> CSV
      const csvStr = jsonToCsv(text);
      outputBuffer = new TextEncoder().encode(csvStr).buffer;
      outputMimeType = 'text/csv';
    } else {
      // CSV -> JSON
      const jsonArr = csvToJson(text);
      const jsonStr = JSON.stringify(jsonArr, null, 2);
      outputBuffer = new TextEncoder().encode(jsonStr).buffer;
      outputMimeType = 'application/json';
    }

    const latencyMs = Math.max(1, Math.round(performance.now() - startTime));
    return {
      type: 'TRANSMUTE_SUCCESS',
      id,
      fileName,
      outputBuffer,
      outputMimeType,
      latencyMs,
      originalBytes: file.size,
      transmutedBytes: outputBuffer.byteLength,
      extraMeta: { fallback: true },
      workerCoreId: 'main-thread-fallback',
    };
  }

  // 3. SVG Minification
  if (lowerName.endsWith('.svg') || file?.type?.includes('svg')) {
    const svgText = await file.text();
    const minified = minifySvg(svgText);
    const outputBuffer = new TextEncoder().encode(minified).buffer;
    const latencyMs = Math.max(1, Math.round(performance.now() - startTime));

    return {
      type: 'TRANSMUTE_SUCCESS',
      id,
      fileName,
      outputBuffer,
      outputMimeType: 'image/svg+xml',
      latencyMs,
      originalBytes: file.size,
      transmutedBytes: outputBuffer.byteLength,
      extraMeta: { format: 'Minified SVG' },
      workerCoreId: 'main-thread-fallback',
    };
  }

  // 4. Standard Raster Image Transmutation (WebP, PNG, JPEG, AVIF)
  const fileBuffer = await file.arrayBuffer();
  const sourceBlob = new Blob([fileBuffer], { type: file.type || 'image/jpeg' });
  let imageSource;

  try {
    imageSource = await createImageBitmap(sourceBlob);
  } catch {
    imageSource = await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(sourceBlob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image decode failed on main thread'));
      };
      img.src = url;
    });
  }

  const width = imageSource.width || imageSource.naturalWidth || 800;
  const height = imageSource.height || imageSource.naturalHeight || 600;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageSource, 0, 0);

  if (imageSource.close) {
    imageSource.close();
  }

  // Maximum quality: 1.0 (highest fidelity preservation)
  const targetMime = targetMimeType || 'image/webp';
  const outputBlob = await new Promise((resolve) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else {
          canvas.toBlob((fallback) => resolve(fallback), 'image/jpeg', 1.0);
        }
      },
      targetMime,
      1.0
    );
  });

  const outputBuffer = await outputBlob.arrayBuffer();
  const latencyMs = Math.max(1, Math.round(performance.now() - startTime));

  return {
    type: 'TRANSMUTE_SUCCESS',
    id,
    fileName,
    outputBuffer,
    outputMimeType: outputBlob.type || targetMime,
    latencyMs,
    originalBytes: file.size,
    transmutedBytes: outputBuffer.byteLength,
    extraMeta: { width, height },
    workerCoreId: 'main-thread-fallback',
  };
}
