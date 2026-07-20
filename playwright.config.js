const { defineConfig } = require('@playwright/test');

const PORT = 4173;

// This repo pins its own @playwright/test version, which may not exactly
// match whatever browser revision a shared/global Playwright install has
// cached. PLAYWRIGHT_EXECUTABLE_PATH lets CI or a shared dev environment
// point at an already-installed Chromium instead of re-downloading one;
// unset, Playwright falls back to its own managed browser.
module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 900 },
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: 'node tests/server.js',
    port: PORT,
    reuseExistingServer: false,
    timeout: 10_000,
  },
});
