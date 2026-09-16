import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': resolve(__dirname, 'src/shared') }
  },
  test: {
    // A single shared jsdom environment: main-process tests never touch DOM
    // globals so they are unaffected, and renderer component tests need it.
    // (Vitest 5 dropped the old single-config `environmentMatchGlobs` option
    // in favor of multi-project configs; one shared environment is simpler
    // here since nothing in the main-process suite depends on Node-only globals.)
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
});
