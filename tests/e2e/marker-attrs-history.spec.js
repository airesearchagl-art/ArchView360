// Coverage for U1 (docs/UndoRedo_Expansion_Implementation_Plan.md U1: マー
// カー単純属性) — the first Undo/Redo対象拡張 implementation unit: marker
// move (drag), marker rotation (rotate-left/right buttons), and marker
// name change. Same shape as scene-rename-history.spec.js /
// floormap-name-history.spec.js: drives the app's own historyManager
// instance via window.__historyManagerForTests (there is still no
// Undo/Redo history-list UI) rather than through any button/shortcut.
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

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

// Required-fix follow-up (PR #45 review 4873109669): the marker-move
// undo/redo tests below previously verified only HistoryManager stack
// transitions and the absence of page errors, which a no-op
// applyMarkerPosition() would still satisfy. This reads the FloorMap
// canvas's own rendered bitmap via canvas.toDataURL() — no production
// test hook needed, since renderFloormapCanvas() (script.js) is a
// synchronous, deterministic 2D-context draw with no animation, so two
// reads of the same logical state always produce byte-identical PNG data
// URLs. Used to prove the marker's rendered position actually moves on
// drag and is actually restored by undo/redo, not just the history
// stack's bookkeeping.
async function canvasFingerprint(page) {
  return page.evaluate(() => document.getElementById('floormap-canvas').toDataURL());
}

// Loads one scene, adds a floorplan (auto-activated), enters placement
// mode, places one marker for the current scene, then exits placement
// mode again — the prerequisite state shared by every U1 operation (they
// all operate on the selected marker). Mirrors phase3-g6-guard.spec.js's
// loadSceneFloorplanAndMarker(), plus the placement-mode exit: while
// isPlacementMode stays true, the canvas mousedown handler's own
// `if (isPlacementMode) return;` guard (pre-existing, unrelated to U1)
// blocks marker drag from ever starting, which only matters for this
// spec's drag coverage (rotate/rename are unaffected by placement mode).
// Since U5, placing this setup marker itself pushes one history entry
// (it didn't before U5 existed) — clear() resets the stack afterward so
// every test below still starts from the {undoCount:0, redoCount:0}
// baseline it was written against, with only the operation actually under
// test contributing to the counts asserted later in each test.
async function loadSceneFloorplanAndMarker(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles(FIXTURE_A);
  await page.locator('#add-floorplan-btn').click();
  await page.locator('#floorplan-input').setInputFiles(FIXTURE_B);
  await page.locator('#floormap-place-btn').click();
  await page.locator('#floormap-canvas').click({ position: MARKER_POS });
  await expect(infoPanel(page)).toBeVisible();
  await page.locator('#floormap-place-btn').click(); // exit placement mode
  await page.evaluate(() => window.__historyManagerForTests.clear());
}

async function dragMarker(page, fromX, fromY, toX, toY) {
  const canvasBox = await page.locator('#floormap-canvas').boundingBox();
  await page.mouse.move(canvasBox.x + fromX, canvasBox.y + fromY);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + toX, canvasBox.y + toY, { steps: 10 });
  await page.mouse.up();
}

test.describe('marker move history (undo/redo)', () => {
  test('dragging a marker pushes one history entry and marks dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    const before = await historyCounts(page);
    expect(before).toEqual({ undoCount: 0, redoCount: 0 });

    await dragMarker(page, MARKER_POS.x, MARKER_POS.y, MARKER_POS.x + 20, MARKER_POS.y + 10);

    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  // Verifies the marker's actual rendered position, not just the history
  // stack's bookkeeping: a canvasFingerprint() before the drag, after the
  // drag, after undo, and after redo must show before ≈ undo (position
  // restored), after-drag ≈ redo (position re-applied), and before ≠
  // after-drag (the drag actually moved something). A no-op or broken
  // applyMarkerPosition() would still pass the old
  // HistoryManager-stack-only assertions but would fail this one, since
  // the canvas bitmap would never change and "before" would equal
  // "after-drag" instead of differing.
  test('undo restores and redo re-applies the marker\'s actual rendered position', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    const before = await canvasFingerprint(page);

    await dragMarker(page, MARKER_POS.x, MARKER_POS.y, MARKER_POS.x + 20, MARKER_POS.y + 10);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    const afterDrag = await canvasFingerprint(page);
    expect(afterDrag).not.toBe(before); // the drag actually moved the rendered marker

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    expect(await canvasFingerprint(page)).toBe(before); // rendered position actually restored

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    expect(await canvasFingerprint(page)).toBe(afterDrag); // rendered position actually re-applied

    expectNoErrors(errors);
  });

  test('a barely-moved drag (click-to-navigate) does not push a history entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);

    // dist < 5 counts as a click, not a drag (script.js mouseup handler)
    await dragMarker(page, MARKER_POS.x, MARKER_POS.y, MARKER_POS.x + 1, MARKER_POS.y + 1);

    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });
});

test.describe('marker rotation history (undo/redo)', () => {
  test('rotate right pushes one history entry, marks dirty, updates the info panel', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    const startDeg = parseInt(await infoDir(page).textContent(), 10);
    await page.locator('#floormap-rot-r').click();

    await expect(infoDir(page)).toHaveText(`${(startDeg + 15) % 360}°`);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('undo restores the old rotation and stays dirty; redo restores the new rotation and stays dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    const startDeg = parseInt(await infoDir(page).textContent(), 10);

    await page.locator('#floormap-rot-r').click();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    await expect(infoDir(page)).toHaveText(`${startDeg % 360}°`);
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });

    await page.evaluate(() => window.__historyManagerForTests.redo());
    await expect(infoDir(page)).toHaveText(`${(startDeg + 15) % 360}°`);
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });
});

test.describe('marker name history (undo/redo)', () => {
  test('renaming via the info panel pushes one history entry and marks dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await page.locator('#floormap-rename-btn').click();
    await expect(infoName(page)).toHaveAttribute('contenteditable', 'true');
    await page.keyboard.press('Control+A');
    await page.keyboard.type('テストマーカー');
    await page.keyboard.press('Enter');

    await expect(infoName(page)).toHaveText('テストマーカー');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('undo restores the old name and stays dirty; redo restores the new name and stays dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    const oldName = await infoName(page).textContent();

    await page.locator('#floormap-rename-btn').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('テストマーカー');
    await page.keyboard.press('Enter');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    await expect(infoName(page)).toHaveText(oldName);
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });

    await page.evaluate(() => window.__historyManagerForTests.redo());
    await expect(infoName(page)).toHaveText('テストマーカー');
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('re-entering the same name does not push a history entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await page.locator('#floormap-rename-btn').click();
    await page.keyboard.press('Enter'); // blur without changing text

    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });
});

test.describe('U1 Viewer mode: marker attribute operations never touch history', () => {
  // #floormap-rot-l/-r and #floormap-rename-btn live inside
  // .floormap-info-actions (editor-only, CSS-hidden in Viewer mode —
  // Phase 3 G6), so this test switches to Viewer mode and confirms the
  // pre-existing guards (unchanged by U1: canMutateProject() in the drag
  // mousemove handler and the name dblclick/blur handlers) still hold —
  // none of U1's three new history-pushing paths are reachable.
  test('rotate/rename controls are hidden and marker drag does not push history', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page); // already exits placement mode

    // Editor -> Viewer while dirty (marker placement above) shows the
    // unsaved-changes confirmation; continue without saving to switch.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    // Rotate/rename controls are CSS-hidden (editor-only container)
    await expect(page.locator('#floormap-rot-r')).toBeHidden();
    await expect(page.locator('#floormap-rename-btn')).toBeHidden();

    // Name field's own dblclick guard (canMutateProject(), pre-existing,
    // unchanged by U1) still blocks entering edit mode.
    await infoName(page).dblclick();
    await expect(infoName(page)).not.toHaveAttribute('contenteditable', 'true');

    // Dragging the marker in Viewer mode must not move it or push history
    // (applyMarkerPosition's caller already gates on canMutateProject()).
    await dragMarker(page, MARKER_POS.x, MARKER_POS.y, MARKER_POS.x + 20, MARKER_POS.y + 10);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });
});
