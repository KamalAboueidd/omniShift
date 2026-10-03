/**
 * Dynamic Multi-threaded Worker Pool
 * Orchestrates concurrent media transmutation across hardware worker threads.
 * Prevents UI starvation by capping pool size to hardwareConcurrency - 1.
 */

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
      try {
        const workerInstance = new Worker(
          new URL('../workers/transmute.worker.js', import.meta.url),
          { type: 'module' }
        );

        this.workers.push({
          id: `core-#${i + 1}`,
          worker: workerInstance,
          isBusy: false,
          currentTaskId: null,
        });
      } catch (err) {
        console.error(`Failed to initialize worker thread #${i}:`, err);
      }
    }
  }

  /**
   * Dispatches a single transmutation task to the worker pool.
   * @param {Object} task
   * @param {string} task.id
   * @param {File} task.file
   * @param {string} task.targetMimeType
   * @param {number} [task.quality]
   * @param {(phase: string) => void} [task.onProgress]
   * @returns {Promise<Object>}
   */
  dispatchTask({ id, file, targetMimeType, quality = 0.85, onProgress }) {
    this.init();

    return new Promise((resolve, reject) => {
      this.taskQueue.push({
        id,
        file,
        targetMimeType,
        quality,
        onProgress,
        resolve,
        reject,
      });

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

    try {
      const messageHandler = (e) => {
        const msg = e.data;
        if (!msg || msg.id !== task.id) return;

        if (msg.type === 'TRANSMUTE_PROGRESS') {
          task.onProgress?.(msg.phase);
        } else if (msg.type === 'TRANSMUTE_SUCCESS') {
          idleSlot.worker.removeEventListener('message', messageHandler);
          idleSlot.isBusy = false;
          idleSlot.currentTaskId = null;
          this.activeTaskCount -= 1;
          this.completedCount += 1;

          this._notifyChange();
          this._processNext();

          task.resolve({
            ...msg,
            workerCoreId: idleSlot.id,
          });
        } else if (msg.type === 'TRANSMUTE_ERROR') {
          idleSlot.worker.removeEventListener('message', messageHandler);
          idleSlot.isBusy = false;
          idleSlot.currentTaskId = null;
          this.activeTaskCount -= 1;

          this._notifyChange();
          this._processNext();

          task.reject(new Error(msg.error));
        }
      };

      idleSlot.worker.addEventListener('message', messageHandler);

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
        const sourceMime = task.file.type || 'image/png';

        const payload = {
          type: 'TRANSMUTE_TASK',
          id: task.id,
          fileName: task.file.name,
          fileBuffer,
          sourceMimeType: sourceMime,
          targetMimeType: task.targetMimeType,
          quality: task.quality,
        };

        // ZERO-COPY: Transfer buffer ownership to Worker
        idleSlot.worker.postMessage(payload, [fileBuffer]);
      }
    } catch (err) {
      idleSlot.isBusy = false;
      idleSlot.currentTaskId = null;
      this.activeTaskCount -= 1;
      this._notifyChange();
      this._processNext();
      task.reject(err);
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
      task.reject(new Error('Task cancelled by queue reset.'));
    }
    this._notifyChange();
  }

  /**
   * Terminates all pool worker threads.
   */
  terminate() {
    this.clearQueue();
    for (const slot of this.workers) {
      slot.worker.terminate();
    }
    this.workers = [];
    this.isInitialized = false;
    this.activeTaskCount = 0;
    this.completedCount = 0;
    this._notifyChange();
  }
}

export const workerPool = new WorkerPool();
