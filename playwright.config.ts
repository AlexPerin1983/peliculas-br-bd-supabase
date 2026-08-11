import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const externalBaseUrl = process.env.E2E_BASE_URL?.trim();
const baseURL = externalBaseUrl || 'http://127.0.0.1:3001';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: 'test-results/playwright',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : 2,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL,
    colorScheme: 'light',
    locale: 'pt-BR',
    timezoneId: 'America/Fortaleza',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'iphone-15-pro-max',
      use: {
        ...devices['iPhone 15 Pro Max'],
      },
    },
    {
      name: 'iphone-11-pro-max',
      use: {
        ...devices['iPhone 11 Pro Max'],
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 3001 --strictPort',
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
});
