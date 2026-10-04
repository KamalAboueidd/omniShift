export const TARGET_FORMATS = [
  { id: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp', lossy: true, defaultQuality: 0.85 },
  { id: 'avif', label: 'AVIF', mime: 'image/avif', ext: 'avif', lossy: true, defaultQuality: 0.80 },
  { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png', lossy: false, defaultQuality: 1.0 },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg', lossy: true, defaultQuality: 0.85 },
  { id: 'bmp', label: 'BMP', mime: 'image/bmp', ext: 'bmp', lossy: false, defaultQuality: 1.0 },
  { id: 'ico', label: 'ICO', mime: 'image/x-icon', ext: 'ico', lossy: false, defaultQuality: 1.0 },
];

export const WORKER_MESSAGE_TYPES = {
  TASK: 'TRANSMUTE_TASK',
  PROGRESS: 'TRANSMUTE_PROGRESS',
  SUCCESS: 'TRANSMUTE_SUCCESS',
  ERROR: 'TRANSMUTE_ERROR',
};
