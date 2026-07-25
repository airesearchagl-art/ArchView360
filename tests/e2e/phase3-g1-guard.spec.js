// Phase 3 group G1 (docs/ViewerEditor_Phase3_Implementation_Plan.md 5節):
// null-guard coverage for #add-scene-btn, #add-img-btn, #update-scene-btn,
// #flip-btn. flip-btn's normal-DOM click behavior is already covered by
// compare-flip-history.spec.js and scene-flip-history.spec.js; the other
// three had no prior click coverage (add-scene-btn only had a visibility
// check in viewer-preview.spec.js), so this file adds them here. It also
// adds the reduced-DOM condition Phase 3's guard actually targets --
// init() must not throw when these four Editor-only elements are absent,
// mirroring tests/e2e/phase3-g2-guard.spec.js, phase3-g3-guard.spec.js,
// and phase3-g4-guard.spec.js.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');

function sceneNames(page) {
  return page.locator('.scene-name');
}

test.describe('Phase 3 G1: normal DOM condition', () => {
  test('add-scene-btn, add-img-btn, and update-scene-btn all work via their own click handlers', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    // The toolbar (and these buttons within it) only becomes visible once a
    // project is loaded (see smoke.spec.js).
    await page.locator('#file-input').setInputFiles(FIXTURE_A);

    // add-scene-btn's click handler is () => fileInput.click() -- waiting
    // for the filechooser event (rather than setting #file-input directly)
    // confirms the button's own addEventListener actually fired.
    const [chooser1] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#add-scene-btn', { force: true }),
    ]);
    await chooser1.setFiles(FIXTURE_B);
    await expect(sceneNames(page)).toHaveCount(2);

    // add-img-btn's click handler is also () => fileInput.click().
    const [chooser2] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#add-img-btn', { force: true }),
    ]);
    await chooser2.setFiles(FIXTURE_C);
    await expect(sceneNames(page)).toHaveCount(3);

    // update-scene-btn's click handler is openReplaceScenePicker(), which
    // clicks the hidden #replace-scene-input to swap the current scene's
    // image (scene count stays the same; only the image data changes).
    const [chooser3] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#update-scene-btn', { force: true }),
    ]);
    await chooser3.setFiles(FIXTURE_A);
    await expect(sceneNames(page)).toHaveCount(3);
    await expect(dirtyIndicator(page)).toBeVisible();

    expectNoErrors(errors);
  });
});

// Simulates a reduced HTML that omits these four elements without touching
// the real index.html: overrides document.getElementById before any page
// script runs, so every $(id) lookup for these four ids sees the same
// "not found" result a stripped-down page would produce.
async function hideSceneAndFlipButtons(page) {
  await page.addInitScript(() => {
    const orig = document.getElementById.bind(document);
    document.getElementById = (id) => {
      if (id === 'add-scene-btn' || id === 'add-img-btn' || id === 'update-scene-btn' || id === 'flip-btn') return null;
      return orig(id);
    };
  });
}

test.describe('Phase 3 G1: add-scene-btn / add-img-btn / update-scene-btn / flip-btn null-guard', () => {
  test('init() completes without throwing when all four elements are absent (Editor mode)', async ({ page }) => {
    await hideSceneAndFlipButtons(page);
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    // A thrown exception inside init() would have aborted every
    // addEventListener() call registered after the guarded lines; confirm
    // a later-registered Editor-only control still wired up correctly.
    await expect(page.locator('#export-json-btn')).toBeVisible();
    expectNoErrors(errors);
  });

  test('init() completes without throwing when all four elements are absent (Viewer mode)', async ({ page }) => {
    await hideSceneAndFlipButtons(page);
    const errors = await gotoApp(page);
    // Fresh page always starts in Viewer mode (see helpers.js enterEditor
    // comment); app-mode-toggle-btn is registered near the end of init(),
    // so its presence confirms init() ran to completion.
    await expect(page.locator('#app-mode-toggle-btn')).toBeVisible();
    expectNoErrors(errors);
  });
});
