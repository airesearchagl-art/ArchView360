// Coverage for U3 (docs/UndoRedo_Expansion_Implementation_Plan.md U3:
// マーカー番号swap) — the third Undo/Redo対象拡張 implementation unit:
// swapping two markers' order via the FloorMap right-click context menu's
// "↑ 番号を前へ" / "↓ 番号を後ろへ" items. Distinct from U4 (マーカー番号
// 一括変更, still unimplemented): this covers only the 2-marker swap, not
// the direct-edit / drag-reorder / "番号を整理" paths that re-sequence an
// entire floorplan's markers.
//
// Same shape as marker-attrs-history.spec.js (U1) / floormap-orientation-
// history.spec.js (U2): drives the app's own historyManager instance via
// window.__historyManagerForTests rather than through undo/redo buttons.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');
const FLOORPLAN_FIXTURE = path.join(FIXTURES, 'lifecycle-scene-a.png');

// Well-separated positions on the 340x255 #floormap-canvas (index.html) so
// each click/right-click unambiguously targets one marker; _findMarkerAt()'s
// hit radius (12 canvas px) is nowhere close to spanning the gaps below.
const POS_A = { x: 70,  y: 50  };
const POS_B = { x: 170, y: 130 };
const POS_C = { x: 270, y: 210 };

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

// renderFloormapCanvas() draws each marker's order-number label and
// direction indicator directly on the canvas bitmap, so a swapped order is
// visible here — same canvasFingerprint() approach as U1/U2 (no production
// test hook; renderFloormapCanvas() is a synchronous, deterministic 2D
// draw, so two reads of the same logical state are always byte-identical).
async function canvasFingerprint(page) {
  return page.evaluate(() => document.getElementById('floormap-canvas').toDataURL());
}

// The marker list (#floormap-mk-list-ul) is always sorted by marker.order
// ascending (script.js renderMarkerList()), and each row shows its scene's
// name in .floormap-mk-list-scene. Reading that column top-to-bottom is
// therefore a direct, id-free readout of the current order across every
// marker on the floorplan -- exactly what a swap (or its absence of a
// side effect on an untouched third marker) needs to prove.
function sceneOrderList(page) {
  return page.locator('#floormap-mk-list-ul .floormap-mk-list-scene').allTextContents();
}

// Loads two scenes (fixture-a, fixture-b), adds a floorplan, and places one
// marker per scene at well-separated canvas positions: fixture-a's marker
// first (order 1, per _nextMarkerOrder()), then switches to fixture-b and
// places its marker (order 2). Leaves placement mode and returns with
// fixture-a still selected... actually leaves whichever scene was last
// switched to (fixture-b) as current; callers that care about current
// scene should not assume otherwise.
async function loadTwoMarkers(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
  await expect(page.locator('#scene-list .scene-item')).toHaveCount(2);
  await page.locator('#add-floorplan-btn').click();
  await page.locator('#floorplan-input').setInputFiles(FLOORPLAN_FIXTURE);
  await page.locator('#floormap-place-btn').click();

  await page.locator('#floormap-canvas').click({ position: POS_A });
  await expect(page.locator('#floormap-info-panel')).toBeVisible();

  await page.locator('#scene-list .scene-item').nth(1).click();
  await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');
  await page.locator('#floormap-canvas').click({ position: POS_B });

  await page.locator('#floormap-place-btn').click(); // exit placement mode
  await expect(sceneOrderList(page)).resolves.toEqual(['fixture-a', 'fixture-b']);
}

// Same as loadTwoMarkers(), plus a third scene/marker (fixture-c, order 3)
// untouched by any swap in the test that uses this -- proof that a swap
// between two markers never has a side effect on others.
async function loadThreeMarkers(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
  await expect(page.locator('#scene-list .scene-item')).toHaveCount(3);
  await page.locator('#add-floorplan-btn').click();
  await page.locator('#floorplan-input').setInputFiles(FLOORPLAN_FIXTURE);
  await page.locator('#floormap-place-btn').click();

  await page.locator('#floormap-canvas').click({ position: POS_A });
  await expect(page.locator('#floormap-info-panel')).toBeVisible();

  await page.locator('#scene-list .scene-item').nth(1).click();
  await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');
  await page.locator('#floormap-canvas').click({ position: POS_B });

  await page.locator('#scene-list .scene-item').nth(2).click();
  await expect(page.locator('#current-scene-name')).toHaveText('fixture-c');
  await page.locator('#floormap-canvas').click({ position: POS_C });

  await page.locator('#floormap-place-btn').click(); // exit placement mode
  await expect(sceneOrderList(page)).resolves.toEqual(['fixture-a', 'fixture-b', 'fixture-c']);
}

async function rightClickCtxItem(page, pos, labelSubstring) {
  await page.locator('#floormap-canvas').click({ position: pos, button: 'right' });
  await page.locator('.mk-ctx-item', { hasText: labelSubstring }).click();
}

test.describe('Marker order swap history (undo/redo)', () => {
  test('"↓ 番号を後ろへ" on the front marker swaps both markers\' order, pushes one history entry, and marks dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoMarkers(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await rightClickCtxItem(page, POS_A, '番号を後ろへ');

    await expect(sceneOrderList(page)).resolves.toEqual(['fixture-b', 'fixture-a']);
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('"↑ 番号を前へ" on the back marker produces the same swap, pushes one history entry, and marks dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoMarkers(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await rightClickCtxItem(page, POS_B, '番号を前へ');

    await expect(sceneOrderList(page)).resolves.toEqual(['fixture-b', 'fixture-a']);
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  // Verifies actual restoration for BOTH markers, not just the history
  // stack's bookkeeping (same rationale as U1/U2's required-fix pattern):
  // the list order and the rendered FloorMap canvas bitmap must both
  // revert on undo and re-apply on redo.
  test('undo restores both markers\' original order and redo re-applies the swap — list order and rendered canvas both follow', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoMarkers(page);

    // Right-clicking a marker also fires the canvas's own mousedown/mouseup
    // handlers -- pre-existing behavior, unrelated to U3 -- which (a)
    // select the marker under the cursor regardless of button, and (b)
    // treat a no-drag mouseup as a click-to-navigate, switching the
    // current scene to that marker's scene via switchToScene()'s 150ms
    // fade transition. Open and immediately close the context menu once
    // first, and wait out the fade (#current-scene-name settles to
    // fixture-a), so both side effects are already stable *before* the
    // "before" snapshot -- otherwise the fade's pending setTimeout can
    // land in the middle of the test and flip which marker renders as
    // "current" (with the FOV cone) between snapshots, independently of
    // anything U3 actually changes.
    await page.locator('#floormap-canvas').click({ position: POS_A, button: 'right' });
    await page.keyboard.press('Escape');
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');
    const before = await canvasFingerprint(page);

    await rightClickCtxItem(page, POS_A, '番号を後ろへ');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    const afterChange = await canvasFingerprint(page);
    expect(afterChange).not.toBe(before);
    await expect(sceneOrderList(page)).resolves.toEqual(['fixture-b', 'fixture-a']);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    await expect(sceneOrderList(page)).resolves.toEqual(['fixture-a', 'fixture-b']);
    expect(await canvasFingerprint(page)).toBe(before);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeVisible();
    await expect(sceneOrderList(page)).resolves.toEqual(['fixture-b', 'fixture-a']);
    expect(await canvasFingerprint(page)).toBe(afterChange);

    expectNoErrors(errors);
  });

  test('a swap between two markers has no side effect on a third marker\'s order', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeMarkers(page);

    await rightClickCtxItem(page, POS_A, '番号を後ろへ');

    // fixture-a (swapped from 1->2) and fixture-b (swapped from 2->1) swap
    // places; fixture-c (untouched, order 3) stays exactly where it was.
    await expect(sceneOrderList(page)).resolves.toEqual(['fixture-b', 'fixture-a', 'fixture-c']);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('a new swap after undo clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoMarkers(page);

    await rightClickCtxItem(page, POS_A, '番号を後ろへ');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(sceneOrderList(page)).resolves.toEqual(['fixture-a', 'fixture-b']);

    // A fresh swap (same pair, same direction) while a redo entry exists
    // must discard that redo entry rather than leaving it stale.
    await rightClickCtxItem(page, POS_A, '番号を後ろへ');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(sceneOrderList(page)).resolves.toEqual(['fixture-b', 'fixture-a']);

    expectNoErrors(errors);
  });

  test('Viewer mode: the marker context menu never opens, so a swap cannot be started and history/order stay untouched', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoMarkers(page); // already exits placement mode

    // Editor -> Viewer while dirty (marker placement above) shows the
    // unsaved-changes confirmation; continue without saving to switch.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    // The context menu itself is gated by canMutateProject() *before* any
    // menu DOM is created (same function-level gate already proven for
    // Viewer mode by phase2-section13-audit.spec.js) -- so there is no
    // persistent "↓ 番号を後ろへ" element to bypass via dispatchEvent the
    // way U1/U2's CSS-hidden buttons are; the gate itself is the surface
    // under test here.
    await page.locator('#floormap-canvas').click({ position: POS_A, button: 'right' });
    await expect(page.locator('.mk-ctx-menu')).toHaveCount(0);

    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    // FloorMap navigator itself is hidden in Viewer mode, so read the
    // scene order back from the underlying data via the same read-only
    // hook other Viewer-mode tests use for post-mutation assertions
    // (window.__historyManagerForTests undo()/redo() already establishes
    // this is safe test-only access, not a new production hook: the
    // marker list DOM is simply not rendered while .editor-only is hidden,
    // so scene order can only be re-observed after switching back).
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(sceneOrderList(page)).resolves.toEqual(['fixture-a', 'fixture-b']);

    expectNoErrors(errors);
  });
});
