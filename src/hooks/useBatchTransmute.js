import { useState, useRef, useEffect, useCallback } from 'react';
import { workerPool } from '../lib/workerPool';
import { memoryManager } from '../lib/memoryManager';

export function useBatchTransmute(options = {}) {
  const { onLog } = options;
  const [queue, setQueue] = useState([]);
  const [poolStats, setPoolStats] = useState(workerPool.getStats());
  const [isProcessing, setIsProcessing] = useState(false);
  const onLogRef = useRef(onLog);

  useEffect(() => {
    onLogRef.current = onLog;
  }, [onLog]);

  // Subscribe to pool stats changes
  useEffect(() => {
    const unsubscribe = workerPool.subscribe((stats) => {
      setPoolStats(stats);
      if (stats.activeWorkers === 0 && stats.queuedCount === 0) {
        setIsProcessing(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workerPool.clearQueue();
      memoryManager.revokeAll('batch-result');
    };
  }, []);

  const clearQueue = useCallback(() => {
    workerPool.clearQueue();
    for (const item of queue) {
      if (item.downloadUrl) {
        memoryManager.revoke(item.downloadUrl);
      }
    }
    setQueue([]);
    setIsProcessing(false);
    onLogRef.current?.('INFO', 'Batch queue flushed and memory buffers released.');
  }, [queue]);

  const downloadIndividual = useCallback((id) => {
    setQueue((currentQueue) => {
      const item = currentQueue.find((i) => i.id === id);
      if (item && item.downloadUrl) {
        const a = document.createElement('a');
        a.href = item.downloadUrl;
        a.download = item.outputFileName || item.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        onLogRef.current?.('INFO', `Downloaded batch item: ${a.download}`);
      }
      return currentQueue;
    });
  }, []);

  // PDF Merge Function
  const mergePdfFiles = useCallback(async (pdfFiles) => {
    if (!pdfFiles || pdfFiles.length < 2) return;

    setIsProcessing(true);
    const taskId = `merge_${Date.now()}`;
    const totalOriginalBytes = pdfFiles.reduce((acc, f) => acc + f.size, 0);

    const mergeItem = {
      id: taskId,
      file: null,
      fileName: `merged_${pdfFiles.length}_documents.pdf`,
      originalBytes: totalOriginalBytes,
      status: 'COMPUTING',
      phase: `MERGING_${pdfFiles.length}_PDFS`,
      telemetry: null,
      downloadUrl: null,
      outputFileName: `merged_${pdfFiles.length}_documents.pdf`,
      blob: null,
    };

    setQueue([mergeItem]);
    onLogRef.current?.('KERNEL', `Initiating client-side merge for ${pdfFiles.length} PDF documents in Worker...`);

    try {
      const pdfBuffers = await Promise.all(pdfFiles.map((f) => f.arrayBuffer()));

      // Dispatch to worker pool
      const result = await workerPool.dispatchTask({
        id: taskId,
        file: new File([], 'merged.pdf'),
        targetMimeType: 'application/pdf',
        pdfBuffers,
        isMerge: true,
        type: 'TRANSMUTE_PDF_MERGE',
      });

      const { outputBuffer, outputMimeType, latencyMs, transmutedBytes, extraMeta, workerCoreId } = result;
      const blob = new Blob([outputBuffer], { type: outputMimeType });
      const url = memoryManager.create(blob, 'batch-result');

      const reductionPercentage = parseFloat(
        (((transmutedBytes - totalOriginalBytes) / totalOriginalBytes) * 100).toFixed(1)
      );

      const throughputMbps = parseFloat(
        ((totalOriginalBytes / (1024 * 1024)) / (Math.max(1, latencyMs) / 1000)).toFixed(2)
      );

      const telemetry = {
        id: taskId,
        fileName: mergeItem.fileName,
        sourceFormat: 'MULTI-PDF',
        targetFormat: 'PDF',
        originalBytes: totalOriginalBytes,
        transmutedBytes,
        reductionPercentage,
        latencyMs,
        throughputMbps,
        workerCoreId,
        timestamp: Date.now(),
        extraMeta,
      };

      setQueue([
        {
          ...mergeItem,
          status: 'READY',
          phase: 'READY',
          telemetry,
          downloadUrl: url,
          blob,
        },
      ]);

      setIsProcessing(false);
      onLogRef.current?.('INFO', `Successfully merged ${pdfFiles.length} PDFs (${extraMeta?.totalPages || 0} total pages) in ${latencyMs}ms.`);
    } catch (err) {
      setIsProcessing(false);
      setQueue([
        {
          ...mergeItem,
          status: 'FAILED',
          phase: err.message,
        },
      ]);
      onLogRef.current?.('KERNEL', `PDF merge failed: ${err.message}`);
    }
  }, []);

  const enqueueFiles = useCallback(async (files, targetMimeType = 'image/webp', quality = 0.85) => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const newItems = files.map((file) => {
      const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        id,
        file,
        fileName: file.name,
        originalBytes: file.size,
        status: 'QUEUED',
        phase: 'QUEUED',
        telemetry: null,
        downloadUrl: null,
        outputFileName: null,
        blob: null,
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
    onLogRef.current?.(
      'KERNEL',
      `Queued batch of ${files.length} file(s) into Worker Pool (${workerPool.poolSize} concurrent threads).`
    );

    // Resolve file target extension
    const resolveOutputExt = (fileName, targetMime) => {
      const lowerName = fileName.toLowerCase();
      if (lowerName.endsWith('.json') || lowerName.endsWith('.csv')) {
        if (targetMime.includes('csv')) return 'csv';
        if (targetMime.includes('spreadsheet') || targetMime.includes('xlsx')) return 'xlsx';
        return 'json';
      }
      if (lowerName.endsWith('.svg')) {
        if (targetMime.includes('png')) return 'png';
        return 'min.svg';
      }
      if (lowerName.endsWith('.pdf')) {
        return 'pdf';
      }
      const extMap = {
        'image/webp': 'webp',
        'image/avif': 'avif',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'application/pdf': 'pdf',
      };
      return extMap[targetMime] || 'webp';
    };

    // Dispatch each task concurrently to the workerPool
    for (const item of newItems) {
      const targetExt = resolveOutputExt(item.fileName, targetMimeType);
      const rawName = item.fileName.substring(0, item.fileName.lastIndexOf('.')) || item.fileName;
      const outName = `${rawName}.transmuted.${targetExt}`;

      workerPool.dispatchTask({
        id: item.id,
        file: item.file,
        targetMimeType,
        quality,
        onProgress: (phase) => {
          setQueue((prevQueue) =>
            prevQueue.map((q) =>
              q.id === item.id ? { ...q, status: 'COMPUTING', phase } : q
            )
          );
        },
      })
      .then((msg) => {
        const { outputBuffer, outputMimeType, latencyMs, originalBytes, transmutedBytes, extraMeta, workerCoreId } = msg;
        const blob = new Blob([outputBuffer], { type: outputMimeType });
        const url = memoryManager.create(blob, 'batch-result');

        const reductionPercentage = parseFloat(
          (((transmutedBytes - originalBytes) / Math.max(1, originalBytes)) * 100).toFixed(1)
        );

        const throughputMbps = parseFloat(
          ((originalBytes / (1024 * 1024)) / (Math.max(1, latencyMs) / 1000)).toFixed(2)
        );

        const formatFromMime = (mime) => {
          if (!mime) return 'RAW';
          if (mime.includes('spreadsheet') || mime.includes('xlsx')) return 'XLSX';
          if (mime.includes('csv')) return 'CSV';
          if (mime.includes('json')) return 'JSON';
          if (mime.includes('svg')) return 'SVG';
          if (mime.includes('pdf')) return 'PDF';
          return mime.split('/')[1]?.toUpperCase() || 'RAW';
        };

        const telemetry = {
          id: item.id,
          fileName: item.fileName,
          sourceFormat: formatFromMime(item.file.type),
          targetFormat: formatFromMime(outputMimeType),
          originalBytes,
          transmutedBytes,
          reductionPercentage,
          latencyMs,
          throughputMbps,
          workerCoreId,
          timestamp: Date.now(),
          extraMeta,
        };

        setQueue((prevQueue) =>
          prevQueue.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'READY',
                  phase: 'READY',
                  telemetry,
                  downloadUrl: url,
                  outputFileName: outName,
                  blob,
                }
              : q
          )
        );

        onLogRef.current?.(
          'INFO',
          `[${workerCoreId}] Transmuted "${item.fileName}" -> ${telemetry.targetFormat} in ${latencyMs}ms (${reductionPercentage}%).`
        );
      })
      .catch((err) => {
        setQueue((prevQueue) =>
          prevQueue.map((q) =>
            q.id === item.id ? { ...q, status: 'FAILED', phase: err.message } : q
          )
        );
        onLogRef.current?.('KERNEL', `Batch item "${item.fileName}" failed: ${err.message}`);
      });
    }
  }, []);

  return {
    queue,
    poolStats,
    isProcessing,
    enqueueFiles,
    clearQueue,
    downloadIndividual,
    mergePdfFiles,
  };
}
