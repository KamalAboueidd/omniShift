import { executeDataTransmute } from './engines/dataEngine';
import { executeSvgTransmute } from './engines/svgEngine';
import { mergePdfs, executePdfTransmute } from './engines/pdfEngine';
import { executeImageTransmute } from './engines/imageEngine';
import { executePresentationTransmute } from './engines/presentationEngine';

/**
 * Transmute Universal Web Worker
 * Integrates image transcoding, vector SVG optimization, PDF manipulation,
 * structured data (JSON/CSV/XLSX), and presentation (PPTX) processing in pure client memory.
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

    const isPresentation =
      sourceMimeType.includes('presentation') ||
      sourceMimeType.includes('powerpoint') ||
      lowerName.endsWith('.pptx') ||
      lowerName.endsWith('.ppt');

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

    if (isPresentation) {
      // Presentation Pipeline: PPTX -> DOCX / PDF / ZIP / TXT
      postProgress('UNPACKING_PRESENTATION_ARCHIVE');
      const presResult = await executePresentationTransmute(fileBuffer, targetMimeType, fileName);
      outputBuffer = presResult.outputBuffer;
      outputMimeType = presResult.outputMimeType;
      extraMeta = presResult.extraMeta;
    } else if (isData) {
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
      // Standard / Extended Raster Image Pipeline via imageEngine
      postProgress('DECODING_IMAGE_BITMAP');
      const imageResult = await executeImageTransmute(fileBuffer, sourceMimeType, targetMimeType, quality);
      outputBuffer = imageResult.outputBuffer;
      outputMimeType = imageResult.outputMimeType;
      extraMeta = imageResult.extraMeta;
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
