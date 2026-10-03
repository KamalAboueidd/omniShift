export const TARGET_FORMATS = [
  { id: 'webp', label: 'WebP', mime: 'image/webp', lossy: true, defaultQuality: 0.85 },
  { id: 'avif', label: 'AVIF', mime: 'image/avif', lossy: true, defaultQuality: 0.80 },
  { id: 'png', label: 'PNG', mime: 'image/png', lossy: false, defaultQuality: 1.0 },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', lossy: true, defaultQuality: 0.85 },
];

export const WORKER_MESSAGE_TYPES = {
  TASK: 'TRANSMUTE_TASK',
  PROGRESS: 'TRANSMUTE_PROGRESS',
  SUCCESS: 'TRANSMUTE_SUCCESS',
  ERROR: 'TRANSMUTE_ERROR',
};
