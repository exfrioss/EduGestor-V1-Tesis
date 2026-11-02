import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/hito1-real.spec.ts', '**/curriculum-real.spec.ts', '**/students-real.spec.ts', '**/activities-real.spec.ts', '**/grading-real.spec.ts'],
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    channel: 'chrome',
    trace: 'on-first-retry',
  },
});
