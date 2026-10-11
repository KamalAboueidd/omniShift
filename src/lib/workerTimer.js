/**
 * Background-safe Worker Timer
 * 
 * Standard window.setInterval is aggressively throttled (clamped to 1000ms+ or paused)
 * by browsers in inactive / background tabs. Dedicated Web Workers are exempt from
 * this timer throttling, allowing background progress updates to execute uninterrupted.
 */

export function createWorkerInterval(callback, intervalMs = 40) {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    const id = setInterval(callback, intervalMs);
    return () => clearInterval(id);
  }

  try {
    const workerScript = `
      let timerId = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          timerId = setInterval(function() {
            self.postMessage('tick');
          }, ${intervalMs});
        } else if (e.data === 'stop') {
          if (timerId) clearInterval(timerId);
        }
      };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = () => {
      callback();
    };

    worker.postMessage('start');

    return () => {
      try {
        worker.postMessage('stop');
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      } catch {
        // Safe cleanup fallback
      }
    };
  } catch (err) {
    // Graceful fallback to standard interval if Worker fails (e.g. sandbox restrictions)
    const id = setInterval(callback, intervalMs);
    return () => clearInterval(id);
  }
}
