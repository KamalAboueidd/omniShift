import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

function pdfjsAssetsPlugin() {
  const publicDir = fileURLToPath(new URL('./public', import.meta.url));
  const nodeModulesPdfJs = fileURLToPath(new URL('./node_modules/pdfjs-dist', import.meta.url));

  const copyAssets = () => {
    try {
      const cmapsSrc = path.join(nodeModulesPdfJs, 'cmaps');
      const cmapsDest = path.join(publicDir, 'cmaps');
      const fontsSrc = path.join(nodeModulesPdfJs, 'standard_fonts');
      const fontsDest = path.join(publicDir, 'standard_fonts');

      if (fs.existsSync(cmapsSrc) && !fs.existsSync(cmapsDest)) {
        fs.cpSync(cmapsSrc, cmapsDest, { recursive: true });
      }
      if (fs.existsSync(fontsSrc) && !fs.existsSync(fontsDest)) {
        fs.cpSync(fontsSrc, fontsDest, { recursive: true });
      }
    } catch (err) {
      console.warn('PDF.js assets auto-copy notice:', err);
    }
  };

  copyAssets();

  return {
    name: 'pdfjs-assets-middleware',
    buildStart() {
      copyAssets();
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (url.startsWith('/cmaps/')) {
          const filePath = path.join(nodeModulesPdfJs, 'cmaps', url.replace('/cmaps/', ''));
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', filePath.endsWith('.bcmap') ? 'application/octet-stream' : 'text/plain');
            return fs.createReadStream(filePath).pipe(res);
          }
        }
        if (url.startsWith('/standard_fonts/')) {
          const filePath = path.join(nodeModulesPdfJs, 'standard_fonts', url.replace('/standard_fonts/', ''));
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/octet-stream');
            return fs.createReadStream(filePath).pipe(res);
          }
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pdfjsAssetsPlugin(),
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

