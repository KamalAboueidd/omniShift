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

  // 1. Universal Combine / Merge to PDF Fallback (PDFs, Images, and Mixed files)
  if (
    type === 'TRANSMUTE_COMBINE_FILES' ||
    type === 'TRANSMUTE_PDF_MERGE' ||
    type === 'TRANSMUTE_IMAGES_COMBINE_PDF' ||
    (task.items && task.items.length > 0)
  ) {
    const { combineMixedFilesToPdf } = await import('../workers/engines/pdfEngine');
    let items = task.items;
    if (!items) {
      const bufs = task.pdfBuffers || task.imageBuffers || [];
      items = bufs.map((b) => ({ buffer: b }));
    }
    const { outputBuffer, outputMimeType, extraMeta } = await combineMixedFilesToPdf(items);
    const totalOriginalBytes = items.reduce(
      (acc, item) => acc + (item.buffer?.byteLength || item.byteLength || 0),
      0
    );
    const latencyMs = Math.max(1, Math.round(performance.now() - startTime));

    return {
      type: 'TRANSMUTE_SUCCESS',
      id,
      fileName: fileName || 'combined_document.pdf',
      outputBuffer,
      outputMimeType,
      latencyMs,
      originalBytes: totalOriginalBytes,
      transmutedBytes: outputBuffer.byteLength,
      extraMeta: { ...extraMeta, engine: 'LocalMainThreadFallback' },
      workerCoreId: 'main-thread-fallback',
    };
  }

  // 2. PowerPoint Presentation (.pptx)
  const lowerName = fileName.toLowerCase();
  const isPresentation =
    lowerName.endsWith('.pptx') ||
    lowerName.endsWith('.ppt') ||
    file?.type?.includes('presentation') ||
    file?.type?.includes('powerpoint');

  if (isPresentation) {
    const { executePresentationTransmute } = await import('../workers/engines/presentationEngine');
    const fileBuffer = await file.arrayBuffer();
    const presResult = await executePresentationTransmute(fileBuffer, targetMimeType, fileName);
    const latencyMs = Math.max(1, Math.round(performance.now() - startTime));

    return {
      type: 'TRANSMUTE_SUCCESS',
      id,
      fileName,
      outputBuffer: presResult.outputBuffer,
      outputMimeType: presResult.outputMimeType,
      latencyMs,
      originalBytes: file.size,
      transmutedBytes: presResult.outputBuffer.byteLength,
      extraMeta: presResult.extraMeta,
      workerCoreId: 'main-thread-fallback',
    };
  }

  // 3. Structured Data (CSV / JSON)
  const isData = lowerName.endsWith('.json') || lowerName.endsWith('.csv') || file?.type?.includes('json') || file?.type?.includes('csv');

  if (isData) {
    const text = await file.text();
    let outputBuffer;
    let outputMimeType;

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

  // 4. Single PDF Transmutation (Compress, Word DOCX, Plain Text)
  if (lowerName.endsWith('.pdf') || file?.type === 'application/pdf') {
    const { executePdfTransmute } = await import('../workers/engines/pdfEngine');
    const fileBuffer = await file.arrayBuffer();
    const pdfResult = await executePdfTransmute(fileBuffer, targetMimeType);
    const latencyMs = Math.max(1, Math.round(performance.now() - startTime));

    return {
      type: 'TRANSMUTE_SUCCESS',
      id,
      fileName,
      outputBuffer: pdfResult.outputBuffer,
      outputMimeType: pdfResult.outputMimeType,
      latencyMs,
      originalBytes: file.size,
      transmutedBytes: pdfResult.outputBuffer.byteLength,
      extraMeta: pdfResult.extraMeta,
      workerCoreId: 'main-thread-fallback',
    };
  }

  // 5. Standard / Extended Raster Image Transmutation (WebP, PNG, JPEG, AVIF, BMP, ICO)
  const { executeImageTransmute } = await import('../workers/engines/imageEngine');
  const fileBuffer = await file.arrayBuffer();
  const imageResult = await executeImageTransmute(fileBuffer, file.type, targetMimeType);
  const latencyMs = Math.max(1, Math.round(performance.now() - startTime));

  return {
    type: 'TRANSMUTE_SUCCESS',
    id,
    fileName,
    outputBuffer: imageResult.outputBuffer,
    outputMimeType: imageResult.outputMimeType,
    latencyMs,
    originalBytes: file.size,
    transmutedBytes: imageResult.outputBuffer.byteLength,
    extraMeta: imageResult.extraMeta,
    workerCoreId: 'main-thread-fallback',
  };
}
