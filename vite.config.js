import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Setting the project root to the current directory
  root: './', 
  
  // Statically serve files from the 'public' directory
  publicDir: 'public', 
  
  server: {
    host: true,
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  },
  
  build: {
    // Specify the output directory for the build
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      // The input is now relative to the project root
      input: resolve(__dirname, 'index.html'), 
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});