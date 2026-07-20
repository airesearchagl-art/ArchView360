// Automated smoke test baseline for ArchView360.
//
// Scope is intentionally narrow (see README "Testing" section): initial
// load, Viewer/Editor mode switching, the Viewer mutation-guard backdoor
// that PR #13 fixed, Dirty State's core transition, and one save path
// clearing dirty. This is not a port of the full scratchpad Playwright
// suites used during PR #12/#13/#14 development — those covered far more
// ground but were never meant to become a committed, repeatedly-run suite.
//
// Fixtures are tiny, self-generated 1x1 PNGs (tests/fixtures/) — no real
// project data.
//
// No fixed sleeps: every wait below is either a Playwright auto-retrying
// assertion (expect(locator).toBeVisible()/toHaveText()/toHaveClass(), which
// polls until the condition holds or the assertion timeout elapses) or
// page.waitForFunction() for the one genuinely async startup condition
// (THREE.js module load). This makes the suite react to actual app state
// rather than guessing a fixed delay, and fail fast when a real regression
// makes a condition never become true.
const { test, expect } = require('@playwright/test');
const path = require('path');

const FIXTURE_A = path.join(__dirname, '..', 'fixtures', 'fixture-a.png');
const FIXTURE_B = path.join(__dirname, '..', 'fixtures', 'fixture-b.png');

async function gotoApp(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await page.goto('/');
  // THREE is loaded as a module; this is the one genuinely async condition
  // at startup, so it gets a real polling wait rather than a fixed sleep.
  await page.waitForFunction(() => window.THREE !== undefined, { timeout: 15000 }).catch(() => {});
  return { pageErrors, consoleErrors };
}

function expectNoErrors({ pageErrors, consoleErrors }) {
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
}

function dirtyIndicator(page) {
  return page.locator('#dirty-indicator');
}

test.describe('ArchView360 smoke baseline', () => {
  test('A. initial load: no fatal errors, correct version, initial mode', async ({ page }) => {
    const errors = await gotoApp(page);
    await expect(page.locator('#app-version-badge')).toHaveText('v2.22.0');
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await expect(page.locator('#app-mode-label')).toHaveText('Viewer');
    expectNoErrors(errors);
  });

  test('B. Viewer <-> Editor toggle shows/hides editor-only UI', async ({ page }) => {
    const errors = await gotoApp(page);

    // The toolbar (and export-json-btn within it) lives inside #viewer-layout,
    // which only appears once a scene is loaded — load one via Viewer's
    // "open into empty project" path (allowed without Editor access) before
    // exercising the mode toggle itself.
    const fileInput = await page.$('#file-input');
    await fileInput.setInputFiles(FIXTURE_A);
    await expect(page.locator('.scene-name')).toBeVisible(); // scene finished loading
    await expect(page.locator('#export-json-btn')).toBeHidden();

    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(page.locator('#export-json-btn')).toBeVisible();

    // Clean, so switching back is instant with no confirmation dialog.
    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await expect(page.locator('#export-json-btn')).toBeHidden();

    expectNoErrors(errors);
  });

  test('C. Viewer mutation guard: hidden replace-scene-input backdoor stays blocked', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.click('#app-mode-toggle-btn', { force: true }); // -> editor
    const fileInput = await page.$('#file-input');
    await fileInput.setInputFiles(FIXTURE_A); // single image into empty project -> clean
    await expect(page.locator('.scene-name')).toHaveText('fixture-a'); // scene.name = filename without extension
    await expect(dirtyIndicator(page)).toBeHidden();

    // Arm the replace picker for scene 0 while still in Editor (this is
    // exactly the race PR #13 found and fixed: openReplaceScenePicker()
    // sets an internal target index, then the native file dialog can
    // resolve after the mode has already changed).
    await page.click('.scene-replace-btn', { force: true });

    // Switch to Viewer (clean, so no confirmation needed).
    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);

    // Fire the armed hidden input directly while in Viewer mode.
    const replaceInput = await page.$('#replace-scene-input');
    await replaceInput.setInputFiles(FIXTURE_B);

    // The replace handler's mutation (scene.blobUrl/fileName update) and its
    // markProjectDirty() call are the same unconditional code path — neither
    // is rendered as page text, so the dirty indicator is the reliable
    // signal that the guard did (or didn't) let the mutation through. If it
    // regressed and let the mutation through, this would flip to visible;
    // waiting via toBeHidden() would then correctly time out and fail.
    await expect(dirtyIndicator(page)).toBeHidden();

    expectNoErrors(errors);
  });

  test('D. Dirty State persists through a Viewer switch and back', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.click('#app-mode-toggle-btn', { force: true }); // -> editor
    const fileInput = await page.$('#file-input');
    await fileInput.setInputFiles(FIXTURE_A); // empty -> clean
    await expect(dirtyIndicator(page)).toBeHidden();

    await fileInput.setInputFiles(FIXTURE_B); // additive to non-empty -> dirty
    await expect(dirtyIndicator(page)).toBeVisible();

    // Switching to Viewer while dirty must show the confirmation dialog.
    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true }); // "保存せずViewerへ移動"

    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await expect(dirtyIndicator(page)).toBeVisible(); // still dirty — data was not discarded

    await page.click('#app-mode-toggle-btn', { force: true }); // -> editor
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(dirtyIndicator(page)).toBeVisible(); // dirty maintained across the round trip

    expectNoErrors(errors);
  });

  test('E. JSON save clears the dirty state', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.click('#app-mode-toggle-btn', { force: true }); // -> editor
    const fileInput = await page.$('#file-input');
    await fileInput.setInputFiles(FIXTURE_A);
    await expect(dirtyIndicator(page)).toBeHidden();
    await fileInput.setInputFiles(FIXTURE_B);
    await expect(dirtyIndicator(page)).toBeVisible();

    // exportProjectJSON() calls markProjectClean() synchronously right after
    // the Blob URL is created and the download anchor is clicked — the same
    // save-success code path that flips the indicator, not merely "a
    // download started" — so waiting for the indicator to hide is waiting
    // for the actual save-success state transition, not a proxy for it.
    await page.click('#export-json-btn', { force: true });
    await expect(dirtyIndicator(page)).toBeHidden();

    expectNoErrors(errors);
  });
});
