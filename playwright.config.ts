import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4174', channel: 'chrome', trace: 'on-first-retry' },
});
