import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { fileURLToPath } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  worker: {
    format: 'es',
  },
  resolve: {
    alias: [
      {
        find: /^pako$/,
        replacement: fileURLToPath(new URL('./src/lib/pakoShim.js', import.meta.url)),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['pako'],
  },
  server: {},
  preview: {},
});
