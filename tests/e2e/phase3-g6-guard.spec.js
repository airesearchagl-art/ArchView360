// Phase 3 group G6 (docs/ViewerEditor_Phase3_Implementation_Plan.md 5節,
// final Phase 3 implementation unit): null-guard coverage for the FloorMap
// marker placement/info-panel controls (#floormap-place-btn,
// #floormap-rename-btn, #floormap-rot-l, #floormap-rot-r,
// #floormap-del-mk). None of these had any prior spec coverage.
//
// Two of the five elements have references beyond their own
// addEventListener registration, discovered while re-auditing script.js
// against the Phase 2/3 classification (the same kind of broader-reach
// check G1 and G5 did):
//  - #floormap-place-btn: togglePlacementMode() also does
//    floormapPlaceBtn.classList.toggle(...), but that function has exactly
//    one caller -- the button's own (now-guarded) click handler -- so it is
//    unreachable by construction once the addEventListener registration is
//    guarded. Guarded defensively anyway for consistency; not independently
//    testable in the all-five-absent scenario (see the "not directly
//    testable" note below, matching G5's 6.3節 precedent for its own
//    defensive guards).
//  - #floormap-rename-btn: the marker right-click context menu's "名称変更"
//    item calls floormapRenameBtn.click() directly (script.js, the
//    context-menu action), independently of the button's own
//    addEventListener registration. This path IS independently reachable
//    and independently guarded/tested below.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const MARKER_POS = { x: 50, y: 50 };

function infoPanel(page) { return page.locator('#floormap-info-panel'); }
function infoName(page)  { return page.locator('#floormap-info-name'); }
function infoDir(page)   { return page.locator('#floormap-info-dir'); }

// Loads one scene, adds a floorplan (auto-activated), enters placement
// mode, and places one marker for the current scene -- the prerequisite
// state for every G6 control (they all operate on the selected marker).
async function loadSceneFloorplanAndMarker(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles(FIXTURE_A);
  await page.locator('#add-floorplan-btn').click();
  await page.locator('#floorplan-input').setInputFiles(FIXTURE_B);
  await page.locator('#floormap-place-btn').click();
  await page.locator('#floormap-canvas').click({ position: MARKER_POS });
  await expect(infoPanel(page)).toBeVisible();
}

test.describe('Phase 3 G6: normal DOM condition', () => {
  test('placing, renaming, rotating, and deleting a marker all work via their own controls', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    await expect(dirtyIndicator(page)).toBeVisible(); // marker placement marks dirty

    // Rename (floormap-rename-btn)
    await page.locator('#floormap-rename-btn').click();
    await expect(infoName(page)).toHaveAttribute('contenteditable', 'true');
    await page.keyboard.press('Control+A');
    await page.keyboard.type('テストマーカー');
    await page.keyboard.press('Enter');
    await expect(infoName(page)).toHaveText('テストマーカー');

    // Rotate right/left (floormap-rot-r / floormap-rot-l) -- read the
    // starting angle rather than assuming a fixed default, since the
    // initial rotation is snapped from the camera's current yaw.
    const startDeg = parseInt(await infoDir(page).textContent(), 10);
    await page.locator('#floormap-rot-r').click();
    await expect(infoDir(page)).toHaveText(`${(startDeg + 15) % 360}°`);
    await page.locator('#floormap-rot-l').click();
    await expect(infoDir(page)).toHaveText(`${startDeg % 360}°`);

    // Delete (floormap-del-mk)
    await page.locator('#floormap-del-mk').click();
    await expect(infoPanel(page)).toBeHidden();

    expectNoErrors(errors);
  });
});

// Simulates a reduced HTML that omits all 5 elements without touching the
// real index.html: overrides document.getElementById before any page
// script runs, so every $(id) lookup for these 5 ids sees the same
// "not found" result a stripped-down page would produce.
async function hideFloormapControls(page) {
  await page.addInitScript(() => {
    const ids = new Set([
      'floormap-place-btn', 'floormap-rename-btn', 'floormap-rot-l',
      'floormap-rot-r', 'floormap-del-mk',
    ]);
    const orig = document.getElementById.bind(document);
    document.getElementById = (id) => (ids.has(id) ? null : orig(id));
  });
}

test.describe('Phase 3 G6: floormap marker controls null-guard', () => {
  test('init() completes without throwing when all five elements are absent (Editor mode)', async ({ page }) => {
    await hideFloormapControls(page);
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
    await hideFloormapControls(page);
    const errors = await gotoApp(page);
    // Fresh page always starts in Viewer mode (see helpers.js enterEditor
    // comment); app-mode-toggle-btn is registered near the end of init(),
    // so its presence confirms init() ran to completion.
    await expect(page.locator('#app-mode-toggle-btn')).toBeVisible();
    expectNoErrors(errors);
  });

  test('renaming a marker via the right-click context menu does not throw when floormap-rename-btn is absent', async ({ page }) => {
    // Isolated to only #floormap-rename-btn (unlike the other two tests
    // above): placing a marker requires #floormap-place-btn's own click
    // handler to actually be registered, so hiding all five at once would
    // make it impossible to reach this scenario through the real UI at
    // all. This mirrors the isolation technique used in G5 to verify
    // renderFloormapTabs()'s guard independently of the addEventListener
    // registration guards.
    await page.addInitScript(() => {
      const orig = document.getElementById.bind(document);
      document.getElementById = (id) => (id === 'floormap-rename-btn' ? null : orig(id));
    });
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);

    // This is the reach flagged above: the context menu's "名称変更" item
    // calls floormapRenameBtn.click() directly, independently of the
    // button's own (now never-registered) click handler.
    await page.locator('#floormap-canvas').click({ position: MARKER_POS, button: 'right' });
    await page.locator('.mk-ctx-item', { hasText: '名称変更' }).click();
    await page.waitForTimeout(150); // the call happens inside a 50ms setTimeout

    expectNoErrors(errors);
  });
});
