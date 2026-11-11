import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Until the first feature is complete there are no tests yet; don't fail the run.
    passWithNoTests: true,
  },
});