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
const { test, expect } = require('@playwright/test');
const path = require('path');

const FIXTURE_A = path.join(__dirname, '..', 'fixtures', 'fixture-a.png');
const FIXTURE_B = path.join(__dirname, '..', 'fixtures', 'fixture-b.png');

async function gotoApp(page) {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto('/');
  // THREE is loaded as a module; give it a moment before interacting.
  await page.waitForFunction(() => window.THREE !== undefined, { timeout: 15000 }).catch(() => {});
  return pageErrors;
}

function isDirty(page) {
  return page.evaluate(() => document.getElementById('dirty-indicator').style.display !== 'none');
}

test.describe('ArchView360 smoke baseline', () => {
  test('A. initial load: no fatal errors, correct version, initial mode', async ({ page }) => {
    const pageErrors = await gotoApp(page);
    await expect(page.locator('#app-version-badge')).toHaveText('v2.22.0');
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await expect(page.locator('#app-mode-label')).toHaveText('Viewer');
    expect(pageErrors).toEqual([]);
  });

  test('B. Viewer <-> Editor toggle shows/hides editor-only UI', async ({ page }) => {
    const pageErrors = await gotoApp(page);

    // The toolbar (and export-json-btn within it) lives inside #viewer-layout,
    // which only appears once a scene is loaded — load one via Viewer's
    // "open into empty project" path (allowed without Editor access) before
    // exercising the mode toggle itself.
    const fileInput = await page.$('#file-input');
    await fileInput.setInputFiles(FIXTURE_A);
    await page.waitForTimeout(300);
    await expect(page.locator('#export-json-btn')).toBeHidden();

    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(page.locator('#export-json-btn')).toBeVisible();

    // Clean, so switching back is instant with no confirmation dialog.
    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await expect(page.locator('#export-json-btn')).toBeHidden();

    expect(pageErrors).toEqual([]);
  });

  test('C. Viewer mutation guard: hidden replace-scene-input backdoor stays blocked', async ({ page }) => {
    const pageErrors = await gotoApp(page);

    await page.click('#app-mode-toggle-btn', { force: true }); // -> editor
    const fileInput = await page.$('#file-input');
    await fileInput.setInputFiles(FIXTURE_A); // single image into empty project -> clean
    await page.waitForTimeout(300);
    await expect(page.locator('.scene-name')).toHaveText('fixture-a'); // scene.name = filename without extension

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
    await page.waitForTimeout(300);

    // The replace handler's mutation (scene.blobUrl/fileName update) and its
    // markProjectDirty() call are the same unconditional code path — neither
    // is rendered as page text, so the dirty flag is the reliable signal
    // that the guard did (or didn't) let the mutation through.
    expect(await isDirty(page)).toBe(false);

    expect(pageErrors).toEqual([]);
  });

  test('D. Dirty State persists through a Viewer switch and back', async ({ page }) => {
    const pageErrors = await gotoApp(page);

    await page.click('#app-mode-toggle-btn', { force: true }); // -> editor
    const fileInput = await page.$('#file-input');
    await fileInput.setInputFiles(FIXTURE_A); // empty -> clean
    await page.waitForTimeout(200);
    expect(await isDirty(page)).toBe(false);

    await fileInput.setInputFiles(FIXTURE_B); // additive to non-empty -> dirty
    await page.waitForTimeout(200);
    expect(await isDirty(page)).toBe(true);

    // Switching to Viewer while dirty must show the confirmation dialog.
    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true }); // "保存せずViewerへ移動"
    await page.waitForTimeout(200);

    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    expect(await isDirty(page)).toBe(true); // still dirty — data was not discarded

    await page.click('#app-mode-toggle-btn', { force: true }); // -> editor
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    expect(await isDirty(page)).toBe(true); // dirty maintained across the round trip

    expect(pageErrors).toEqual([]);
  });

  test('E. JSON save clears the dirty state', async ({ page }) => {
    const pageErrors = await gotoApp(page);

    await page.click('#app-mode-toggle-btn', { force: true }); // -> editor
    const fileInput = await page.$('#file-input');
    await fileInput.setInputFiles(FIXTURE_A);
    await page.waitForTimeout(200);
    await fileInput.setInputFiles(FIXTURE_B);
    await page.waitForTimeout(200);
    expect(await isDirty(page)).toBe(true);

    await page.click('#export-json-btn', { force: true });
    await page.waitForTimeout(300);
    expect(await isDirty(page)).toBe(false);

    expect(pageErrors).toEqual([]);
  });
});
