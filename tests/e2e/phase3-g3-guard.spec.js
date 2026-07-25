// Phase 3 group G3 (docs/ViewerEditor_Phase3_Implementation_Plan.md 5節):
// null-guard coverage for #save-set-btn, #flip-a-btn, #flip-b-btn.
// flip-a-btn/flip-b-btn's normal-DOM click behavior is already covered by
// compare-flip-history.spec.js and viewer-preview.spec.js; save-set-btn had
// no prior coverage, so this file adds it here. It also adds the
// reduced-DOM condition Phase 3's guard actually targets -- init() must not
// throw when these three Editor-only elements are absent, mirroring
// tests/e2e/phase3-g4-guard.spec.js's approach for project-info-btn/
// add-floorplan-btn.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');

async function loadTwoScenes(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
}

async function enterSplit(page) {
  await page.locator('#split-compare-btn').click();
}

// Mirrors compare-flip-history.spec.js's helper: assigns a specific scene
// (by its fixture-derived name) to a compare slot via the real picker
// dropdown.
async function pickCompareScene(page, side, sceneName) {
  await page.locator(`#picker-btn-${side}`).click();
  await page.locator('.picker-item').filter({ hasText: sceneName }).click();
}

test.describe('Phase 3 G3: normal DOM condition', () => {
  test('saving a compare set works end-to-end (save-set-btn had no prior spec coverage)', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenes(page);
    await enterSplit(page);
    await pickCompareScene(page, 'a', 'fixture-a');
    await pickCompareScene(page, 'b', 'fixture-b');
    await expect(dirtyIndicator(page)).toBeHidden();

    await page.locator('#save-set-btn').click();
    await expect(page.locator('#set-name-modal')).toBeVisible();
    await page.locator('#set-name-ok-btn').click();

    await expect(page.locator('#set-name-modal')).toBeHidden();
    await expect(dirtyIndicator(page)).toBeVisible(); // saveCurrentCompareSet() -> markProjectDirty('比較セット保存')

    expectNoErrors(errors);
  });
});

// Simulates a reduced HTML that omits these three elements without touching
// the real index.html: overrides document.getElementById before any page
// script runs, so every $(id) lookup for these three ids sees the same
// "not found" result a stripped-down page would produce.
async function hideCompareSaveAndFlipButtons(page) {
  await page.addInitScript(() => {
    const orig = document.getElementById.bind(document);
    document.getElementById = (id) => {
      if (id === 'save-set-btn' || id === 'flip-a-btn' || id === 'flip-b-btn') return null;
      return orig(id);
    };
  });
}

test.describe('Phase 3 G3: save-set-btn / flip-a-btn / flip-b-btn null-guard', () => {
  test('init() completes without throwing when all three elements are absent (Editor mode)', async ({ page }) => {
    await hideCompareSaveAndFlipButtons(page);
    const errors = await gotoApp(page);
    await enterEditor(page);
    // The toolbar (and export-json-btn within it) only becomes visible
    // once a project is loaded (see smoke.spec.js).
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    // A thrown exception inside init() would have aborted every
    // addEventListener() call registered after the guarded lines; confirm
    // a later-registered Editor-only control still wired up correctly.
    await expect(page.locator('#export-json-btn')).toBeVisible();
    expectNoErrors(errors);
  });

  test('init() completes without throwing when all three elements are absent (Viewer mode)', async ({ page }) => {
    await hideCompareSaveAndFlipButtons(page);
    const errors = await gotoApp(page);
    // Fresh page always starts in Viewer mode (see helpers.js enterEditor
    // comment); app-mode-toggle-btn is registered near the end of init(),
    // so its presence confirms init() ran to completion.
    await expect(page.locator('#app-mode-toggle-btn')).toBeVisible();
    expectNoErrors(errors);
  });
});
