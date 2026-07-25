// Phase 3 group G2 (docs/ViewerEditor_Phase3_Implementation_Plan.md 5節):
// null-guard coverage for #export-json-btn, #import-json-btn.
// export-json-btn's normal-DOM click behavior is already covered by
// project-lifecycle.spec.js and smoke.spec.js; import-json-btn's own click
// handler (as opposed to #json-import-input, which other specs drive
// directly) had no prior coverage, so this file adds it here. It also adds
// the reduced-DOM condition Phase 3's guard actually targets -- init() must
// not throw when these two Editor-only elements are absent, mirroring
// tests/e2e/phase3-g4-guard.spec.js and tests/e2e/phase3-g3-guard.spec.js.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const LIFECYCLE_JSON = path.join(FIXTURES, 'lifecycle-project.json');

test.describe('Phase 3 G2: normal DOM condition', () => {
  test('export-json-btn and import-json-btn both work via their own click handlers', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    // The toolbar (and both buttons within it) only becomes visible once a
    // project is loaded (see smoke.spec.js).
    await page.locator('#file-input').setInputFiles(FIXTURE_A);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#export-json-btn', { force: true }),
    ]);
    expect(download.suggestedFilename()).toBe('archview360-project.json');
    await download.delete();

    // import-json-btn's click handler is openImportJSON(), which just
    // clicks the hidden #json-import-input -- confirm that wiring still
    // works end to end through the modal it triggers.
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#import-json-btn', { force: true }),
    ]);
    await chooser.setFiles(LIFECYCLE_JSON);
    await expect(page.locator('#import-modal')).toBeVisible();

    expectNoErrors(errors);
  });
});

// Simulates a reduced HTML that omits these two elements without touching
// the real index.html: overrides document.getElementById before any page
// script runs, so every $(id) lookup for these two ids sees the same
// "not found" result a stripped-down page would produce.
async function hideExportImportJsonButtons(page) {
  await page.addInitScript(() => {
    const orig = document.getElementById.bind(document);
    document.getElementById = (id) => {
      if (id === 'export-json-btn' || id === 'import-json-btn') return null;
      return orig(id);
    };
  });
}

test.describe('Phase 3 G2: export-json-btn / import-json-btn null-guard', () => {
  test('init() completes without throwing when both elements are absent (Editor mode)', async ({ page }) => {
    await hideExportImportJsonButtons(page);
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    // A thrown exception inside init() would have aborted every
    // addEventListener() call registered after the guarded lines; confirm
    // a later-registered Editor-only control still wired up correctly.
    await expect(page.locator('#export-package-btn')).toBeVisible();
    expectNoErrors(errors);
  });

  test('init() completes without throwing when both elements are absent (Viewer mode)', async ({ page }) => {
    await hideExportImportJsonButtons(page);
    const errors = await gotoApp(page);
    // Fresh page always starts in Viewer mode (see helpers.js enterEditor
    // comment); app-mode-toggle-btn is registered near the end of init(),
    // so its presence confirms init() ran to completion.
    await expect(page.locator('#app-mode-toggle-btn')).toBeVisible();
    expectNoErrors(errors);
  });
});
