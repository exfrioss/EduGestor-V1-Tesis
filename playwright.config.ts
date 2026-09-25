import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/hito1-real.spec.ts', '**/curriculum-real.spec.ts'],
  use: { baseURL: 'http://localhost:4174', channel: 'chrome', trace: 'on-first-retry' },
});
