import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'FigStakeWidget',
      formats: ['es'],
      fileName: () => 'stake-widget.js',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@solana/web3.js',
        '@solana/wallet-adapter-react',
        '@solana/wallet-adapter-react-ui',
      ],
      output: {
        assetFileNames: 'stake-widget.[ext]',
      },
    },
    cssCodeSplit: false,
    emptyOutDir: true,
  },
});
