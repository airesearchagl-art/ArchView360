// Phase 3 group G5 (docs/ViewerEditor_Phase3_G5_Investigation.md,
// docs/ViewerEditor_Phase3_Implementation_Plan.md 5節): null-guard coverage
// for the FloorMap orientation controls (#floormap-orient-bar/-l/-r/-val/
// -preset, 5 elements / 11 references). None of these had any prior spec
// coverage.
//
// Unlike G2/G3/G4, this group has references beyond the addEventListener
// registrations: renderFloormapTabs() unconditionally touches
// floormapOrientBar/-Val/-Preset whenever a floorplan is added, deleted,
// switched, or a project is imported -- reachable via the ordinary "add a
// floorplan" flow, not just by clicking the orientation controls themselves
// (see the investigation doc's 4節, the same kind of broader reach G1 found
// for flip-btn's _doSwitchToScene() reference).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');

function orientBar(page)    { return page.locator('#floormap-orient-bar'); }
function orientVal(page)    { return page.locator('#floormap-orient-val'); }
function orientPreset(page) { return page.locator('#floormap-orient-preset'); }

// Mirrors floormap-name-history.spec.js's loadSceneAndFloorplan(): a scene
// must exist before #add-floorplan-btn (and the FloorMap toolbar) is even
// visible; adding one floorplan auto-activates it, which is what triggers
// renderFloormapTabs() to show the orientation bar.
async function loadSceneAndFloorplan(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles(FIXTURE_A);
  await page.locator('#add-floorplan-btn').click();
  await page.locator('#floorplan-input').setInputFiles(FIXTURE_B);
  await expect(orientBar(page)).toBeVisible();
}

test.describe('Phase 3 G5: normal DOM condition', () => {
  test('orientation bar appears on floorplan add, and left/right/preset controls all work', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page);

    await expect(orientVal(page)).toHaveText('0°');
    await expect(orientPreset(page)).toHaveValue('0');

    // The preset <select> only has 0/90/180/270 options (index.html), so a
    // +-15 step leaves it with no matching option (empty value) -- only
    // #floormap-orient-val reflects arbitrary 15-degree increments.
    await page.locator('#floormap-orient-r').click(); // +15
    await expect(orientVal(page)).toHaveText('15°');
    await expect(dirtyIndicator(page)).toBeVisible();

    await page.locator('#floormap-orient-l').click(); // -15, back to 0
    await expect(orientVal(page)).toHaveText('0°');
    await expect(orientPreset(page)).toHaveValue('0');

    await orientPreset(page).selectOption('90');
    await expect(orientVal(page)).toHaveText('90°');

    expectNoErrors(errors);
  });
});

// Simulates a reduced HTML that omits all 5 elements without touching the
// real index.html: overrides document.getElementById before any page
// script runs, so every $(id) lookup for these 5 ids sees the same
// "not found" result a stripped-down page would produce.
async function hideOrientationControls(page) {
  await page.addInitScript(() => {
    const ids = new Set([
      'floormap-orient-bar', 'floormap-orient-l', 'floormap-orient-r',
      'floormap-orient-val', 'floormap-orient-preset',
    ]);
    const orig = document.getElementById.bind(document);
    document.getElementById = (id) => (ids.has(id) ? null : orig(id));
  });
}

test.describe('Phase 3 G5: floormap-orient-* null-guard', () => {
  test('init() completes without throwing when all five elements are absent (Editor mode)', async ({ page }) => {
    await hideOrientationControls(page);
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    // A thrown exception inside init() would have aborted every
    // addEventListener() call registered after the guarded lines; confirm
    // a later-registered Editor-only control still wired up correctly.
    await expect(page.locator('#export-json-btn')).toBeVisible();
    expectNoErrors(errors);
  });

  test('init() completes without throwing when all five elements are absent (Viewer mode)', async ({ page }) => {
    await hideOrientationControls(page);
    const errors = await gotoApp(page);
    // Fresh page always starts in Viewer mode (see helpers.js enterEditor
    // comment); app-mode-toggle-btn is registered near the end of init(),
    // so its presence confirms init() ran to completion.
    await expect(page.locator('#app-mode-toggle-btn')).toBeVisible();
    expectNoErrors(errors);
  });

  test('adding a floorplan does not throw when all five elements are absent (renderFloormapTabs() reach)', async ({ page }) => {
    await hideOrientationControls(page);
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    // This is the reach the investigation doc's 4節 flagged: adding a
    // floorplan calls renderFloormapTabs() unconditionally, without the
    // orientation controls themselves ever being clicked.
    await page.locator('#add-floorplan-btn').click();
    await page.locator('#floorplan-input').setInputFiles(FIXTURE_B);
    // The floorplan itself must still be added correctly -- guarding the
    // orientation UI must not break unrelated floorplan-list rendering.
    await expect(page.locator('.floorplan-name').first()).toHaveText('fixture-b');
    expectNoErrors(errors);
  });
});
