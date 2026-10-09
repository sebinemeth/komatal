import { defineConfig } from '@playwright/test'

// Browser: CI installs Playwright's Chromium; the Claude cloud env ships one at /opt/pw-browsers/chromium
// (set CHROMIUM_PATH to override). Never run `playwright install` in the cloud env.
const executablePath = process.env.CHROMIUM_PATH || (process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : undefined)

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    launchOptions: { executablePath, args: ['--no-sandbox'] },
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    env: { VITE_USE_EMULATORS: 'true' },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
