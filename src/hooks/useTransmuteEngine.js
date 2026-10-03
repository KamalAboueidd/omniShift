import { useState, useRef, useEffect, useCallback } from 'react';
import { memoryManager } from '../lib/memoryManager';

/**
 * Custom React hook for multithreaded client-side media transmutation via Web Workers.
 * Features zero-copy Transferable ArrayBuffers and strict MemoryManager tracking.
 *
 * @param {Object} [options]
 * @param {(level: 'INFO' | 'KERNEL' | 'WORKER', message: string) => void} [options.onLog]
 */
export function useTransmuteEngine(options = {}) {
  const { onLog } = options;
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPhase, setProgressPhase] = useState('');
  const [telemetry, setTelemetry] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [outputFileName, setOutputFileName] = useState('');
  const [error, setError] = useState(null);

  const workerRef = useRef(null);
  const downloadUrlRef = useRef(null);
  const onLogRef = useRef(onLog);

  useEffect(() => {
    onLogRef.current = onLog;
  }, [onLog]);

  // Initialize Worker instance once
  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('../workers/transmute.worker.js', import.meta.url),
        { type: 'module' }
      );
    } catch (err) {
      console.error('Failed to initialize Web Worker:', err);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      // Revoke all tracked URLs on unmount
      memoryManager.revokeAll();
    };
  }, []);

  const reset = useCallback(() => {
    if (downloadUrlRef.current) {
      memoryManager.revoke(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }
    setDownloadUrl(null);
    setTelemetry(null);
    setIsProcessing(false);
    setProgressPhase('');
    setError(null);
    setOutputFileName('');
  }, []);

  const transmuteFile = useCallback(
    async (file, targetMimeType = 'image/webp', quality = 0.85) => {
      if (!workerRef.current) {
        const errMsg = 'Dedicated Worker pipeline is unavailable in this environment.';
        setError(errMsg);
        onLogRef.current?.('KERNEL', `Pipeline error: ${errMsg}`);
        return;
      }

      // Memory cleanup: Revoke prior Blob ObjectURL via MemoryManager
      if (downloadUrlRef.current) {
        memoryManager.revoke(downloadUrlRef.current);
        downloadUrlRef.current = null;
        setDownloadUrl(null);
      }

      setIsProcessing(true);
      setError(null);
      setProgressPhase('INGESTING_FILE_BUFFER');
      onLogRef.current?.('WORKER', 'Phase -> [INGESTING_FILE_BUFFER]');

      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const sourceMime = file.type || 'image/png';
      const isPdf = sourceMime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      try {
        // Read file into ArrayBuffer on main thread
        const fileBuffer = await file.arrayBuffer();

        const extMap = {
          'image/webp': 'webp',
          'image/avif': 'avif',
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'application/pdf': 'pdf',
        };
        const targetExt = isPdf ? 'pdf' : (extMap[targetMimeType] || 'webp');
        const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const outName = `${rawName}.transmuted.${targetExt}`;
        setOutputFileName(outName);

        // Single-task message listener
        const messageHandler = (e) => {
          const msg = e.data;
          if (!msg || msg.id !== taskId) return;

          if (msg.type === 'TRANSMUTE_PROGRESS') {
            setProgressPhase(msg.phase);
            onLogRef.current?.('WORKER', `Phase -> [${msg.phase}]`);
          } else if (msg.type === 'TRANSMUTE_SUCCESS') {
            const { outputBuffer, outputMimeType, latencyMs, originalBytes, transmutedBytes, extraMeta } = msg;

            // Create direct blob & URL managed by MemoryManager
            const blob = new Blob([outputBuffer], { type: outputMimeType });
            const url = memoryManager.create(blob, taskId);
            downloadUrlRef.current = url;
            setDownloadUrl(url);

            const reductionPercentage = parseFloat(
              (((transmutedBytes - originalBytes) / originalBytes) * 100).toFixed(1)
            );

            const throughputMbps = parseFloat(
              ((originalBytes / (1024 * 1024)) / (Math.max(1, latencyMs) / 1000)).toFixed(2)
            );

            const formatFromMime = (mime) => {
              if (mime === 'application/pdf') return 'PDF';
              return mime ? mime.split('/')[1]?.toUpperCase() : 'RAW';
            };

            const computedTelemetry = {
              id: taskId,
              fileName: file.name,
              sourceFormat: formatFromMime(sourceMime),
              targetFormat: formatFromMime(outputMimeType),
              originalBytes,
              transmutedBytes,
              reductionPercentage,
              latencyMs,
              throughputMbps,
              workerCoreId: `worker-core-#${navigator.hardwareConcurrency || 4}`,
              timestamp: Date.now(),
              extraMeta,
            };

            setTelemetry(computedTelemetry);
            setIsProcessing(false);
            setProgressPhase('READY');
            onLogRef.current?.(
              'INFO',
              `Transmute complete in ${latencyMs}ms (${throughputMbps} MB/s). Bytes: ${originalBytes} -> ${transmutedBytes} (${reductionPercentage}%).`
            );
            workerRef.current?.removeEventListener('message', messageHandler);
          } else if (msg.type === 'TRANSMUTE_ERROR') {
            setError(msg.error);
            setIsProcessing(false);
            setProgressPhase('');
            onLogRef.current?.('KERNEL', `Worker error: ${msg.error}`);
            workerRef.current?.removeEventListener('message', messageHandler);
          }
        };

        workerRef.current.addEventListener('message', messageHandler);

        const taskPayload = {
          type: 'TRANSMUTE_TASK',
          id: taskId,
          fileName: file.name,
          fileBuffer,
          sourceMimeType: sourceMime,
          targetMimeType: isPdf ? 'application/pdf' : targetMimeType,
          quality,
        };

        // ZERO-COPY: Transfer buffer ownership to Worker
        workerRef.current.postMessage(taskPayload, [fileBuffer]);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setIsProcessing(false);
        setError(errorMsg);
        onLogRef.current?.('KERNEL', `Pipeline exception: ${errorMsg}`);
      }
    },
    []
  );

  return {
    isProcessing,
    progressPhase,
    telemetry,
    downloadUrl,
    outputFileName,
    error,
    transmuteFile,
    reset,
  };
}
