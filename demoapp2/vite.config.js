import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
});
