import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetRoot = path.resolve(__dirname, '../widget/packages/stake-widget');

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Use widget source in dev so rebuild/cache of dist cannot serve stale code
    alias: {
      '@fig/stake-widget/styles.css': path.join(widgetRoot, 'src/styles.css'),
      '@fig/stake-widget': path.join(widgetRoot, 'src/index.js'),
    },
  },
  server: {
    port: 5175,
    proxy: {
      // Same-origin BFF → local Express (npm run dev:api)
      '/api/figment': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api/solana': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@fig/stake-widget'],
  },
});
