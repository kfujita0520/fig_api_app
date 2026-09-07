import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/figment-api': {
        target: 'https://api.figment.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/figment-api/, ''),
      },
    },
  },
});
