import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/figment': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/solana': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
