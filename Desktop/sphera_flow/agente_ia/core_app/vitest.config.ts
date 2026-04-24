import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['./tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/node_modules_broken_*/**', '**/dist/**'],
    setupFiles: ['./tests/helpers/setupEnv.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
