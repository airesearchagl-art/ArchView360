// Coverage for URL指定による起動モード分離 (Phase 1, see
// docs/ViewerEditor_Entrypoints_Investigation.md 6.1節/9節/10節). This is a
// startup-only convenience default, never an access-control decision:
// resolveInitialAppMode() (script.js) reads the `mode` query parameter
// exactly once, before appMode's first assignment and before the first
// renderModeUi() call, and the value is never written back to the URL. The
// existing in-page Viewer<->Editor toggle and Viewer Preview are unchanged.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { expectNoErrors, dirtyIndicator } = require('./helpers');

const FIXTURE_A = path.join(__dirname, '..', 'fixtures', 'fixture-a.png');
const FIXTURE_B = path.join(__dirname, '..', 'fixtures', 'fixture-b.png');

async function gotoWithQuery(page, query) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await page.goto(query ? `/?${query}` : '/');
  await page.waitForFunction(() => window.THREE !== undefined, { timeout: 15000 }).catch(() => {});
  return { pageErrors, consoleErrors };
}

test.describe('URL mode startup (Phase 1)', () => {
  test('1. ?mode=viewer starts in Viewer Mode', async ({ page }) => {
    const errors = await gotoWithQuery(page, 'mode=viewer');
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await expect(page.locator('#app-mode-label')).toHaveText('Viewer');
    expectNoErrors(errors);
  });

  test('2. ?mode=editor starts in Editor Mode', async ({ page }) => {
    const errors = await gotoWithQuery(page, 'mode=editor');
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(page.locator('#app-mode-label')).toHaveText('Editor');
    expectNoErrors(errors);
  });

  test('3. No parameter keeps the existing Viewer default (backward compatible)', async ({ page }) => {
    const errors = await gotoWithQuery(page, null);
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await expect(page.locator('#app-mode-label')).toHaveText('Viewer');
    expectNoErrors(errors);
  });

  test('4. An invalid value falls back to Viewer', async ({ page }) => {
    const errors = await gotoWithQuery(page, 'mode=foo');
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    expectNoErrors(errors);
  });

  test('5. An empty value falls back to Viewer', async ({ page }) => {
    const errors = await gotoWithQuery(page, 'mode=');
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    expectNoErrors(errors);
  });

  test('6. A case variant is not accepted as an alias, and falls back to Viewer', async ({ page }) => {
    const errors = await gotoWithQuery(page, 'mode=EDITOR');
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    expectNoErrors(errors);
  });

  test('7. ?mode=viewer actually blocks an editor-only mutation, not just the CSS class', async ({ page }) => {
    const errors = await gotoWithQuery(page, 'mode=viewer');
    // Loading into an empty project is allowed regardless of mode (the
    // "open into empty project" path, see script.js handleFiles()'s
    // `wasEmpty` check) — this is how Viewer gets its first scene at all.
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('.scene-name')).toBeVisible();
    // Adding a second, additive image to a non-empty project requires
    // Editor (assertEditorMode('画像追加')) — this must stay blocked, and
    // the dirty indicator is the reliable signal that the guard did (or
    // didn't) let the mutation through (same pattern as smoke.spec.js's
    // "hidden replace-scene-input backdoor" test).
    await page.locator('#file-input').setInputFiles(FIXTURE_B);
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });

  test('8. ?mode=editor actually allows an editor-only mutation, not just the CSS class', async ({ page }) => {
    const errors = await gotoWithQuery(page, 'mode=editor');
    await page.locator('#file-input').setInputFiles(FIXTURE_A); // empty -> clean
    await expect(dirtyIndicator(page)).toBeHidden();
    await page.locator('#file-input').setInputFiles(FIXTURE_B); // additive -> dirty
    await expect(dirtyIndicator(page)).toBeVisible();
    expectNoErrors(errors);
  });

  test('9. The existing in-page Viewer<->Editor toggle is unaffected by the URL parameter', async ({ page }) => {
    const errors = await gotoWithQuery(page, 'mode=viewer');
    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    expectNoErrors(errors);
  });

  test('10. Viewer Preview still works when starting from ?mode=editor', async ({ page }) => {
    const errors = await gotoWithQuery(page, 'mode=editor');
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await page.locator('#viewer-preview-btn').click();
    await expect(page.locator('body')).toHaveClass(/preview-active/);
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await page.locator('#viewer-preview-exit-btn').click();
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(page.locator('body')).not.toHaveClass(/preview-active/);
    expectNoErrors(errors);
  });
});
