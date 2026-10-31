import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'dieta.spec.ts', timeout: 30000,
  workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5181', locale: 'ko-KR', screenshot: 'only-on-failure' },
  outputDir: '/tmp/pbb-dieta-playwright-results',
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --config vite.dieta-review.config.ts --host 127.0.0.1 --port 5181 --strictPort', url: 'http://127.0.0.1:5181', reuseExistingServer: true },
});
