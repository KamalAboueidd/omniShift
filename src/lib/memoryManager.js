/**
 * Memory Lifecycle Manager
 * Tracks, manages, and safely revokes in-browser Blob URLs to prevent memory bloat
 * during heavy client-side transmutation operations.
 */
class MemoryManager {
  constructor() {
    /** @type {Map<string, { url: string, size: number, createdAt: number, tag?: string }>} */
    this.activeUrls = new Map();
  }

  /**
   * Registers a newly minted ObjectURL and automatically tracks it.
   * @param {Blob} blob - The blob to create a URL for.
   * @param {string} [tag] - Optional diagnostic tag (e.g. 'transmute-result').
   * @returns {string} The created Object URL.
   */
  create(blob, tag = 'anonymous') {
    const url = URL.createObjectURL(blob);
    this.activeUrls.set(url, {
      url,
      size: blob.size,
      createdAt: performance.now(),
      tag,
    });
    return url;
  }

  /**
   * Revokes a specific ObjectURL and removes it from the tracking registry.
   * @param {string|null|undefined} url - The URL to revoke.
   */
  revoke(url) {
    if (!url || typeof url !== 'string') return;
    if (this.activeUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.activeUrls.delete(url);
    } else if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Revokes all previously created URLs matching a tag or all active URLs.
   * @param {string} [tag] - Optional tag filter.
   */
  revokeAll(tag) {
    for (const [url, entry] of this.activeUrls.entries()) {
      if (!tag || entry.tag === tag) {
        URL.revokeObjectURL(url);
        this.activeUrls.delete(url);
      }
    }
  }

  /**
   * Returns active memory footprint currently held by tracked ObjectURLs.
   * @returns {{ count: number, totalBytes: number }}
   */
  getFootprint() {
    let totalBytes = 0;
    for (const entry of this.activeUrls.values()) {
      totalBytes += entry.size;
    }
    return {
      count: this.activeUrls.size,
      totalBytes,
    };
  }
}

export const memoryManager = new MemoryManager();
