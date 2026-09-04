import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetRoot = path.resolve(__dirname, '../figapp/packages/stake-widget');

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Use widget source in dev so rebuild/cache of dist cannot serve stale API-key checks
    alias: {
      '@fig/stake-widget/styles.css': path.join(widgetRoot, 'src/styles.css'),
      '@fig/stake-widget': path.join(widgetRoot, 'src/index.js'),
    },
  },
  server: {
    port: 5175,
    proxy: {
      // Same-origin /api/figment → local Express BFF (npm run dev:api)
      '/api/figment': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@fig/stake-widget'],
  },
});
