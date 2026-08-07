// Coverage for U2 (docs/UndoRedo_Expansion_Implementation_Plan.md U2:
// FloorMap方位補正) — the second Undo/Redo対象拡張 implementation unit:
// FloorMap orientation (rotationOffset) via the left/right ↺/↻ buttons and
// the degree preset <select>. Same shape as marker-attrs-history.spec.js
// (U1): drives the app's own historyManager instance via
// window.__historyManagerForTests rather than through any button/shortcut.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const MARKER_POS = { x: 50, y: 50 };

function orientVal(page)    { return page.locator('#floormap-orient-val'); }
function orientPreset(page) { return page.locator('#floormap-orient-preset'); }

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

// renderFloormapCanvas() (script.js) only rotates a marker's own drawn
// direction indicator by (marker.rotation + fp.rotationOffset) — the
// floorplan image itself is never rotated — so a rotationOffset change is
// only visible on the canvas bitmap when at least one marker is present.
// Same canvasFingerprint() approach as marker-attrs-history.spec.js's
// marker-move test (U1 review #4873109669's required fix): no production
// test hook needed, since renderFloormapCanvas() is a synchronous,
// deterministic 2D-context draw with no animation, so two reads of the
// same logical state always produce byte-identical PNG data URLs.
async function canvasFingerprint(page) {
  return page.evaluate(() => document.getElementById('floormap-canvas').toDataURL());
}

// Loads one scene, adds a floorplan (auto-activated), places one marker
// for the current scene, then exits placement mode. Mirrors
// marker-attrs-history.spec.js's loadSceneFloorplanAndMarker(): a marker
// is required so orientation changes are actually visible on the canvas
// (see canvasFingerprint() above), even though U2 itself never touches
// marker data.
async function loadSceneFloorplanAndMarker(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles(FIXTURE_A);
  await page.locator('#add-floorplan-btn').click();
  await page.locator('#floorplan-input').setInputFiles(FIXTURE_B);
  await page.locator('#floormap-place-btn').click();
  await page.locator('#floormap-canvas').click({ position: MARKER_POS });
  await expect(page.locator('#floormap-info-panel')).toBeVisible();
  await page.locator('#floormap-place-btn').click(); // exit placement mode
}

test.describe('FloorMap orientation history (undo/redo)', () => {
  test('rotate right (↻) pushes one history entry, updates the display, and marks dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await page.locator('#floormap-orient-r').click();

    await expect(orientVal(page)).toHaveText('15°');
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('rotate left (↺) pushes one history entry, updates the display, and marks dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await page.locator('#floormap-orient-l').click();

    await expect(orientVal(page)).toHaveText('345°'); // (0 - 15 + 360) % 360
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('preset change pushes one history entry, updates the display, and marks dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await orientPreset(page).selectOption('90');

    await expect(orientVal(page)).toHaveText('90°');
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  // Verifies actual restoration, not just the history stack's bookkeeping
  // (same rationale as U1's marker-move required fix): the displayed
  // angle, the preset <select>'s value, and the FloorMap canvas's own
  // rendered bitmap must all revert on undo and re-apply on redo. A
  // no-op or broken applyFloorMapOrientation() would still pass a
  // stack-only assertion but would fail these.
  test('undo restores and redo re-applies rotationOffset — display, preset, and rendered canvas all follow', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    const before = await canvasFingerprint(page);

    await orientPreset(page).selectOption('90');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    const afterChange = await canvasFingerprint(page);
    expect(afterChange).not.toBe(before); // the change actually altered the rendered marker

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    await expect(orientVal(page)).toHaveText('0°');
    await expect(orientPreset(page)).toHaveValue('0');
    expect(await canvasFingerprint(page)).toBe(before); // rendered marker actually restored

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeVisible();
    await expect(orientVal(page)).toHaveText('90°');
    await expect(orientPreset(page)).toHaveValue('90');
    expect(await canvasFingerprint(page)).toBe(afterChange); // rendered marker actually re-applied

    // Redo/undo replay must never push a *new* history entry: after the
    // undo->redo round-trip above, the stack must be back to exactly
    // {undoCount: 1, redoCount: 0} (asserted above), not grown.
    expectNoErrors(errors);
  });

  test('selecting the preset already matching the current rotationOffset does not push a history entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    // Placing the marker in setup already dirtied the project (unrelated
    // to U2); captured here only so the no-op preset dispatch below can
    // be checked against "no further change", not asserted as a specific
    // value.
    const dirtyBeforeDispatch = await dirtyIndicator(page).isVisible();

    // A fresh floorplan's rotationOffset is 0, matching the preset's
    // already-selected "0" option. A real <select> user interaction can't
    // choose an option it already has selected (no 'change' event fires),
    // so this dispatches 'change' directly to exercise
    // applyFloorMapOrientation()'s own old-value/new-value guard, not
    // just browser change-event semantics.
    await orientPreset(page).evaluate((el) => {
      el.value = '0';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    expect(await dirtyIndicator(page).isVisible()).toBe(dirtyBeforeDispatch); // no further dirty change

    expectNoErrors(errors);
  });

  test('Viewer mode: orientation controls are hidden and no change or history occurs', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page); // already exits placement mode

    // Editor -> Viewer while dirty (marker placement above) shows the
    // unsaved-changes confirmation; continue without saving to switch.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    // Discarding while switching Editor->Viewer never clears dirty (the
    // marker placement above already dirtied the project, and the
    // existing "continue without saving" path keeps dirty as-is —
    // unrelated to U2, see script.js's Dirty State design). Captured here
    // only so the bypass attempt below can be checked against "no
    // further change", not asserted as a specific value.
    const dirtyBeforeBypass = await dirtyIndicator(page).isVisible();

    // The whole orientation bar (.editor-only, confirmed-49 CSS-based
    // set) is CSS-hidden in Viewer mode — unchanged by U2.
    await expect(page.locator('#floormap-orient-bar')).toBeHidden();
    await expect(page.locator('#floormap-orient-l')).toBeHidden();
    await expect(page.locator('#floormap-orient-r')).toBeHidden();
    await expect(orientPreset(page)).toBeHidden();

    // Hidden-element bypass: dispatchEvent fires the button's own click
    // handler directly (display:none rules out a real/forced Playwright
    // click, same as U1's F-category bypass tests) — assertEditorMode()
    // inside _adjustOrientOffset() must still block the mutation.
    await page.locator('#floormap-orient-r').dispatchEvent('click');
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(orientVal(page)).toHaveText('0°'); // unchanged by the bypass
    expect(await dirtyIndicator(page).isVisible()).toBe(dirtyBeforeBypass); // no further change

    expectNoErrors(errors);
  });
});
