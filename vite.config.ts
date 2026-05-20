import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1600,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
