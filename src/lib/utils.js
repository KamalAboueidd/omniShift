import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines conditional class names and resolves conflicting Tailwind utility classes.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Formats byte size into human readable string with fixed precision.
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Returns plain-English size delta comparison:
 * e.g. "Original: 1.2 MB → New: 420 KB (-65% saved)"
 */
export function formatSizeDelta(originalBytes, newBytes, isArabic = false) {
  if (!originalBytes || !newBytes) return '';
  const origStr = formatBytes(originalBytes);
  const newStr = formatBytes(newBytes);

  if (newBytes < originalBytes) {
    const savedBytes = originalBytes - newBytes;
    const percent = Math.round((savedBytes / originalBytes) * 100);
    return isArabic
      ? `الحجم الأصلي: ${origStr} ← الجديد: ${newStr} (توفير ${percent}%)`
      : `Original: ${origStr} → New: ${newStr} (-${percent}% saved)`;
  } else if (newBytes > originalBytes) {
    const extraBytes = newBytes - originalBytes;
    const percent = Math.round((extraBytes / originalBytes) * 100);
    return isArabic
      ? `الحجم الأصلي: ${origStr} ← الجديد: ${newStr} (+${percent}%)`
      : `Original: ${origStr} → New: ${newStr} (+${percent}%)`;
  } else {
    return isArabic
      ? `الحجم الأصلي: ${origStr} ← الجديد: ${newStr} (مطابق)`
      : `Original: ${origStr} → New: ${newStr} (0% delta)`;
  }
}

/**
 * Safely triggers an in-browser file download from a Blob, item, or URL.
 * Converts to a self-contained Data URL for files < 25MB to completely bypass
 * Chromium's network service and COEP restrictions (which cause the misleading
 * "Check internet connection" or "Network Error" message on blob: URLs).
 * For larger files, uses Blob ObjectURL with an extended 60-second retention window.
 */
export async function triggerDownload(source, filename = 'download') {
  if (!source) return;

  let blob = null;
  let url = null;
  let shouldRevoke = false;

  if (source instanceof Blob) {
    blob = source;
  } else if (source.blob instanceof Blob) {
    blob = source.blob;
  } else if (typeof source === 'string') {
    url = source;
  } else if (source.downloadUrl && typeof source.downloadUrl === 'string') {
    url = source.downloadUrl;
  }

  const resolvedFilename =
    (typeof filename === 'string' && filename !== 'download' ? filename : '') ||
    source.outputFileName ||
    source.fileName ||
    source.name ||
    filename ||
    'download';

  // If we have a blob and it's reasonably sized (< 25MB),
  // convert it to a Data URL (base64). Data URLs bypass Chromium's network stack entirely,
  // preventing "Check internet connection" / ERR_BLOCKED_BY_RESPONSE failures.
  if (blob && blob.size < 25 * 1024 * 1024) {
    try {
      url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      url = URL.createObjectURL(blob);
      shouldRevoke = true;
    }
  } else if (blob) {
    url = URL.createObjectURL(blob);
    shouldRevoke = true;
  } else if (url && url.startsWith('blob:')) {
    // If we only have a blob URL, attempt to read it back into a data URL for safety
    try {
      const resp = await fetch(url);
      const fetchedBlob = await resp.blob();
      if (fetchedBlob.size < 25 * 1024 * 1024) {
        url = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(fetchedBlob);
        });
      }
    } catch {
      // Keep original url
    }
  }

  if (!url) return;

  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = resolvedFilename;
  document.body.appendChild(a);

  // Trigger download click
  a.click();

  // Safely defer DOM removal and URL disposal
  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
    if (shouldRevoke && url.startsWith('blob:')) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }, 60000);
    }
  }, 1000);
}

