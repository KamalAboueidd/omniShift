/**
 * Dynamic Multi-threaded Worker Pool with Main-Thread Fallback
 * Orchestrates concurrent media transmutation across hardware worker threads.
 * Prevents UI starvation by capping pool size to hardwareConcurrency - 1.
 * Seamlessly fails over to pure client-side fallback if threads encounter sandbox restrictions.
 */

import { localFallbackTransmute } from './localFallback';

class WorkerPool {
  constructor() {
    const rawConcurrency = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4;
    // Keep 1 thread free for the main 60 FPS UI thread, min 1, max 6
    this.poolSize = Math.max(1, Math.min(rawConcurrency - 1, 6));
    this.workers = [];
    this.taskQueue = [];
    this.activeTaskCount = 0;
    this.completedCount = 0;
    this.listeners = new Set();
    this.isInitialized = false;
  }

  /**
   * Initializes the pool with dedicated workers.
   */
  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    for (let i = 0; i < this.poolSize; i++) {
      this._spawnWorkerSlot(i + 1);
    }
  }

  _spawnWorkerSlot(coreNum) {
    try {
      const workerInstance = new Worker(
        new URL('../workers/transmute.worker.js', import.meta.url),
        { type: 'module' }
      );

      const slot = {
        id: `core-#${coreNum}`,
        worker: workerInstance,
        isBusy: false,
        currentTaskId: null,
      };

      this.workers.push(slot);
      return slot;
    } catch (err) {
      console.warn(`Failed to initialize worker thread #${coreNum}:`, err);
      return null;
    }
  }

  _replaceWorkerSlot(slot) {
    try {
      slot.worker.terminate();
    } catch {
      // ignore termination error
    }

    try {
      const newInstance = new Worker(
        new URL('../workers/transmute.worker.js', import.meta.url),
        { type: 'module' }
      );
      slot.worker = newInstance;
      slot.isBusy = false;
      slot.currentTaskId = null;
    } catch (err) {
      console.warn(`Worker recycling failed for ${slot.id}:`, err);
      // Remove slot from workers if unable to instantiate
      this.workers = this.workers.filter((w) => w !== slot);
    }
  }

  /**
   * Dispatches a single transmutation task to the worker pool.
   * @param {Object} taskOptions
   * @returns {Promise<Object>}
   */
  dispatchTask(taskOptions) {
    this.init();

    return new Promise((resolve, reject) => {
      const task = {
        quality: 1.0, // Default to highest quality
        ...taskOptions,
        resolve,
        reject,
      };

      // If no workers could be initialized, immediately execute main thread fallback
      if (this.workers.length === 0) {
        localFallbackTransmute(task)
          .then((res) => {
            this.completedCount += 1;
            this._notifyChange();
            resolve(res);
          })
          .catch(reject);
        return;
      }

      this.taskQueue.push(task);
      this._notifyChange();
      this._processNext();
    });
  }

  /**
   * Internal scheduler: Assigns queued tasks to available worker threads.
   */
  async _processNext() {
    if (this.taskQueue.length === 0) return;

    // Find first idle worker
    const idleSlot = this.workers.find((w) => !w.isBusy);
    if (!idleSlot) return; // All cores saturated

    const task = this.taskQueue.shift();
    if (!task) return;

    idleSlot.isBusy = true;
    idleSlot.currentTaskId = task.id;
    this.activeTaskCount += 1;
    this._notifyChange();

    let timeoutId = null;
    let isSettled = false;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      idleSlot.isBusy = false;
      idleSlot.currentTaskId = null;
      this.activeTaskCount -= 1;
      this._notifyChange();
      this._processNext();
    };

    // 6-second timeout watchdog: If worker freezes or drops messages, fail over to main-thread fallback
    timeoutId = setTimeout(async () => {
      if (isSettled) return;
      isSettled = true;
      console.warn(`Worker task [${task.id}] timed out. Failing over to main-thread fallback.`);
      this._replaceWorkerSlot(idleSlot);
      cleanup();

      try {
        const fallbackRes = await localFallbackTransmute(task);
        this.completedCount += 1;
        this._notifyChange();
        task.resolve(fallbackRes);
      } catch (fbErr) {
        task.reject(fbErr);
      }
    }, 6000);

    const messageHandler = (e) => {
      const msg = e.data;
      if (!msg || msg.id !== task.id) return;

      if (msg.type === 'TRANSMUTE_PROGRESS') {
        task.onProgress?.(msg.phase);
      } else if (msg.type === 'TRANSMUTE_SUCCESS') {
        if (isSettled) return;
        isSettled = true;
        idleSlot.worker.removeEventListener('message', messageHandler);
        idleSlot.worker.removeEventListener('error', errorHandler);
        this.completedCount += 1;
        cleanup();

        task.resolve({
          ...msg,
          workerCoreId: idleSlot.id,
        });
      } else if (msg.type === 'TRANSMUTE_ERROR') {
        if (isSettled) return;
        isSettled = true;
        idleSlot.worker.removeEventListener('message', messageHandler);
        idleSlot.worker.removeEventListener('error', errorHandler);
        cleanup();

        // On worker engine error, try fallback before giving up
        localFallbackTransmute(task)
          .then((res) => {
            this.completedCount += 1;
            this._notifyChange();
            task.resolve(res);
          })
          .catch(() => {
            task.reject(new Error(msg.error));
          });
      }
    };

    const errorHandler = (errEvent) => {
      if (isSettled) return;
      isSettled = true;
      idleSlot.worker.removeEventListener('message', messageHandler);
      idleSlot.worker.removeEventListener('error', errorHandler);
      this._replaceWorkerSlot(idleSlot);
      cleanup();

      // Seamless fallback on worker crash
      localFallbackTransmute(task)
        .then((res) => {
          this.completedCount += 1;
          this._notifyChange();
          task.resolve(res);
        })
        .catch((fbErr) => {
          task.reject(new Error(errEvent.message || fbErr.message || 'Worker failure'));
        });
    };

    idleSlot.worker.addEventListener('message', messageHandler);
    idleSlot.worker.addEventListener('error', errorHandler);

    try {
      if (task.type === 'TRANSMUTE_PDF_MERGE') {
        const payload = {
          type: 'TRANSMUTE_PDF_MERGE',
          id: task.id,
          fileName: task.fileName || 'merged_document.pdf',
          pdfBuffers: task.pdfBuffers,
        };
        idleSlot.worker.postMessage(payload, task.pdfBuffers);
      } else {
        const fileBuffer = await task.file.arrayBuffer();
        const resolveSourceMime = (file) => {
          if (file.type && file.type !== 'application/octet-stream') return file.type;
          const name = (file.name || '').toLowerCase();
          if (name.endsWith('.jfif') || name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
          if (name.endsWith('.png')) return 'image/png';
          if (name.endsWith('.webp')) return 'image/webp';
          if (name.endsWith('.avif')) return 'image/avif';
          if (name.endsWith('.gif')) return 'image/gif';
          if (name.endsWith('.svg')) return 'image/svg+xml';
          if (name.endsWith('.pdf')) return 'application/pdf';
          if (name.endsWith('.json')) return 'application/json';
          if (name.endsWith('.csv')) return 'text/csv';
          return 'image/jpeg';
        };
        const sourceMime = resolveSourceMime(task.file);

        const payload = {
          type: 'TRANSMUTE_TASK',
          id: task.id,
          fileName: task.file.name,
          fileBuffer,
          sourceMimeType: sourceMime,
          targetMimeType: task.targetMimeType,
          quality: task.quality ?? 1.0,
        };

        // ZERO-COPY: Transfer buffer ownership to Worker
        idleSlot.worker.postMessage(payload, [fileBuffer]);
      }
    } catch (err) {
      if (!isSettled) {
        isSettled = true;
        idleSlot.worker.removeEventListener('message', messageHandler);
        idleSlot.worker.removeEventListener('error', errorHandler);
        cleanup();

        localFallbackTransmute(task)
          .then((res) => {
            this.completedCount += 1;
            this._notifyChange();
            task.resolve(res);
          })
          .catch((fbErr) => {
            task.reject(err || fbErr);
          });
      }
    }
  }

  /**
   * Subscribes a listener to pool telemetry updates.
   * @param {() => void} listener
   * @returns {() => void} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notifyChange() {
    for (const listener of this.listeners) {
      listener(this.getStats());
    }
  }

  /**
   * Returns current pool performance telemetry.
   */
  getStats() {
    return {
      poolSize: this.poolSize,
      activeWorkers: this.activeTaskCount,
      queuedCount: this.taskQueue.length,
      completedCount: this.completedCount,
    };
  }

  /**
   * Clears pending queue and marks state idle.
   */
  clearQueue() {
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      task.reject?.(new Error('Task cancelled by queue reset.'));
    }
    this._notifyChange();
  }

  /**
   * Terminates all pool worker threads.
   */
  terminate() {
    this.clearQueue();
    for (const slot of this.workers) {
      try {
        slot.worker.terminate();
      } catch {
        // ignore
      }
    }
    this.workers = [];
    this.isInitialized = false;
    this.activeTaskCount = 0;
    this.completedCount = 0;
    this._notifyChange();
  }
}

export const workerPool = new WorkerPool();
