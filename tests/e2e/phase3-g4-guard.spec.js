// Phase 3 group G4 (docs/ViewerEditor_Phase3_Implementation_Plan.md 5節):
// null-guard coverage for #project-info-btn and #add-floorplan-btn. Both
// buttons already have click-behavior regression coverage in
// history-controls.spec.js and floormap-name-history.spec.js; this file
// adds the one condition Phase 3's guard actually targets -- init() must
// not throw when these two Editor-only elements are absent, as they would
// be from a hypothetical reduced Viewer-only HTML (docs/
// ViewerEditor_DOM_Responsibility_Investigation.md 6.3節).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, enterEditor } = require('./helpers');

const FIXTURE_A = path.join(__dirname, '..', 'fixtures', 'fixture-a.png');

// Simulates a reduced HTML that omits these two elements without touching
// the real index.html: overrides document.getElementById before any page
// script runs, so every $(id) lookup for these two ids sees the same
// "not found" result a stripped-down page would produce.
async function hideProjectInfoAndFloorplanButtons(page) {
  await page.addInitScript(() => {
    const orig = document.getElementById.bind(document);
    document.getElementById = (id) => {
      if (id === 'project-info-btn' || id === 'add-floorplan-btn') return null;
      return orig(id);
    };
  });
}

test.describe('Phase 3 G4: project-info-btn / add-floorplan-btn null-guard', () => {
  test('init() completes without throwing when both elements are absent (Editor mode)', async ({ page }) => {
    await hideProjectInfoAndFloorplanButtons(page);
    const errors = await gotoApp(page);
    await enterEditor(page);
    // The toolbar (and export-json-btn within it) only becomes visible
    // once a project is loaded (see smoke.spec.js), so load one scene
    // before checking it.
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    // A thrown exception inside init() would have aborted every
    // addEventListener() call registered after the guarded lines; confirm
    // a later-registered Editor-only control still wired up correctly.
    await expect(page.locator('#export-json-btn')).toBeVisible();
    expectNoErrors(errors);
  });

  test('init() completes without throwing when both elements are absent (Viewer mode)', async ({ page }) => {
    await hideProjectInfoAndFloorplanButtons(page);
    const errors = await gotoApp(page);
    // Fresh page always starts in Viewer mode (see helpers.js enterEditor
    // comment); app-mode-toggle-btn is registered near the end of init(),
    // so its presence confirms init() ran to completion.
    await expect(page.locator('#app-mode-toggle-btn')).toBeVisible();
    expectNoErrors(errors);
  });
});
