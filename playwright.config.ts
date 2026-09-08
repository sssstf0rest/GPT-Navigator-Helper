import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 30_000, expect: { timeout: 10_000 },
  fullyParallel: false, workers: 1, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  webServer: { command: 'npm run fixture', url: 'http://127.0.0.1:4173/health', reuseExistingServer: !process.env.CI, timeout: 10_000 },
});
