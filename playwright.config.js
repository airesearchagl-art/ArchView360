const { defineConfig } = require('@playwright/test');

const PORT = 4173;

// This repo pins its own @playwright/test version, which may not exactly
// match whatever browser revision a shared/global Playwright install has
// cached. PLAYWRIGHT_EXECUTABLE_PATH lets CI or a shared dev environment
// point at an already-installed Chromium instead of re-downloading one;
// unset, Playwright falls back to its own managed browser.
module.exports = defineConfig({
  testDir: './tests/e2e',
  // Serial, single-worker execution is not required for correctness — each
  // test already gets an isolated browser context automatically — but with
  // only a handful of tests in this first baseline, the predictability of
  // one worker outweighs the marginal time saved by parallelizing, and it
  // avoids several Chromium instances competing for CPU in a constrained
  // dev/CI container. Revisit once the suite grows enough for that
  // trade-off to flip.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // 'list' for readable console output everywhere; 'html' so CI has a
  // report to attach as a failure artifact (never opened automatically —
  // playwright-report/ and test-results/ are both gitignored, generated
  // fresh on every run, and never committed).
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 900 },
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tests/server.js',
    port: PORT,
    // Never reuse an already-running process on this port, in CI or
    // locally — a stale/unrelated server already bound to 4173 must cause
    // a loud startup failure, not a silent connection to the wrong app.
    reuseExistingServer: false,
    timeout: 10_000,
  },
});
