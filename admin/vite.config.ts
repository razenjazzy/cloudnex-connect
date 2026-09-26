import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/graphql': 'http://127.0.0.1:8080',
      '/admin': 'http://127.0.0.1:8080',
      '/cloudnex-connect': 'http://127.0.0.1:8080',
      '/healthz': 'http://127.0.0.1:8080',
      '/readyz': 'http://127.0.0.1:8080',
      '/api-docs': 'http://127.0.0.1:8080',
      '/webhook': 'http://127.0.0.1:8080',
    },
  },
});
