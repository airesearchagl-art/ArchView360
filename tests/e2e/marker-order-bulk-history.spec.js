// Coverage for U4 (docs/UndoRedo_Expansion_Implementation_Plan.md U4:
// マーカー番号一括変更) — the sixth Undo/Redo対象拡張 implementation unit:
// bulk marker order changes across three independent entry points, each of
// which can renumber more than one marker on the active floor plan in a
// single user gesture:
//   1. the marker list's order-chip inline direct edit (setMarkerOrder(),
//      which also runs _resolveOrderConflicts() and can bump other
//      markers out of the way of a collision);
//   2. the marker list's own HTML5 drag-and-drop reorder (re-sequences
//      every marker on the floor plan to 1,2,3... in the new order);
//   3. the "番号を整理" resequence button (resequenceMarkers() — same
//      1,2,3... re-sequencing, triggered explicitly rather than by a
//      reorder gesture).
// All three now funnel through a single applyMarkerOrders(orders) apply
// function operating on a full {id, order}[] snapshot of every marker on
// the affected floor plan (_snapshotMarkerOrders()), so one user operation
// always pushes exactly one history entry regardless of how many markers
// it actually renumbers. Distinct from U3 (マーカー番号swap, already
// implemented): that unit covers only the 2-marker context-menu swap, not
// these three bulk paths.
//
// Same shape as marker-order-swap-history.spec.js (U3) / scene-reorder-
// history.spec.js (U6): drives the app's own historyManager instance via
// window.__historyManagerForTests (not through any Undo/Redo button), and
// reproduces the marker list's exact drag math via dispatched DragEvents
// (no native DnD simulation in Playwright).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');
const FLOORPLAN_1 = path.join(FIXTURES, 'lifecycle-scene-a.png');
const FLOORPLAN_2 = path.join(FIXTURES, 'lifecycle-scene-b.png');

// Well-separated positions on the 340x255 #floormap-canvas (index.html) so
// each click unambiguously targets one marker; _findMarkerAt()'s hit
// radius (12 canvas px) is nowhere close to spanning the gaps below.
const POS_A = { x: 70,  y: 50  };
const POS_B = { x: 170, y: 130 };
const POS_C = { x: 270, y: 210 };

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

// Reads the marker list top-to-bottom (always sorted by marker.order
// ascending, per renderMarkerList()) as "scene:order" pairs -- a full,
// id-free readout of every marker's identity and order on the active floor
// plan at once. Only valid while no order-chip <input> is open (its parent
// .floormap-mk-list-num briefly has no text node while editing).
function markerRows(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('#floormap-mk-list-ul .floormap-mk-list-item')).map(li =>
    `${li.querySelector('.floormap-mk-list-scene').textContent}:${li.querySelector('.floormap-mk-list-num').textContent}`
  ));
}

// renderFloormapCanvas() draws each marker's order-number label directly on
// the canvas bitmap, so an order change is visible here too -- same
// canvasFingerprint() approach as U1/U2/U3 (no production test hook;
// renderFloormapCanvas() is a synchronous, deterministic 2D draw).
async function canvasFingerprint(page) {
  return page.evaluate(() => document.getElementById('floormap-canvas').toDataURL());
}

async function loadThreeMarkers(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
  await expect(page.locator('#scene-list .scene-item')).toHaveCount(3);
  await page.locator('#add-floorplan-btn').click();
  await page.locator('#floorplan-input').setInputFiles(FLOORPLAN_1);
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
  await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2', 'fixture-c:3']);
  // Since U5, placing these three setup markers itself pushes three
  // history entries — clear() resets the stack afterward so every test
  // below still starts from the {undoCount:0, redoCount:0} baseline it
  // was written against (U4 predates U5; this spec's own assertions were
  // never meant to count marker-placement history).
  await page.evaluate(() => window.__historyManagerForTests.clear());
}

// Clicks a marker-list row's order-number chip, types a new value, and
// commits via Enter (same as the #floormap-info-order editor: blur also
// commits, but Enter is the deterministic path — it removes the blur
// listener before running commit()).
async function editOrderChip(page, listIdx, value) {
  const numEl = page.locator('#floormap-mk-list-ul .floormap-mk-list-item').nth(listIdx).locator('.floormap-mk-list-num');
  await numEl.click();
  const input = numEl.locator('input');
  await input.fill(String(value));
  await input.press('Enter');
}

// Reproduces script.js's exact dragover math (mid = rect.top+height/2,
// isBefore = clientY < mid, insertAt = listIdx or listIdx+1, then
// insertAt-- if _mkDragSrcIdx < insertAt) so fromIdx/toIdx here mean
// exactly what the real drop handler would compute for a user drag of the
// row currently at fromIdx to end up at final list position toIdx.
// Dispatches events directly (bypasses the draggable attribute, no real OS
// drag) so it also works to prove/disprove Viewer-mode's guard, same
// rationale as U6's dragReorderScene().
async function dragReorderMarker(page, fromIdx, toIdx) {
  await page.evaluate(({ fromIdx, toIdx }) => {
    const items = document.querySelectorAll('#floormap-mk-list-ul .floormap-mk-list-item');
    const src = items[fromIdx];
    const target = items[toIdx];
    const dt = new DataTransfer();
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    const rect = target.getBoundingClientRect();
    const clientY = toIdx > fromIdx ? rect.bottom - 1 : rect.top + 1;
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, clientY }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt, clientY }));
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  }, { fromIdx, toIdx });
}

test.describe('Bulk marker order history (undo/redo)', () => {
  test('direct order-chip edit pushes one history entry, resolves conflicts on other markers, and marks dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeMarkers(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    // Not asserting dirtyIndicator here: loadThreeMarkers() itself places
    // markers (a real mutation, markProjectDirty('マーカー配置')), so the
    // project is already dirty before this test's own edit — only the
    // history-stack count distinguishes "not yet touched by this test".

    // fixture-a: 1 -> 3, colliding with fixture-c's existing 3.
    // _resolveOrderConflicts bumps fixture-c (the collision) to 4 and
    // leaves fixture-b (no collision) at 2.
    await editOrderChip(page, 0, 3);

    await expect(markerRows(page)).resolves.toEqual(['fixture-b:2', 'fixture-a:3', 'fixture-c:4']);
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('undo restores every marker\'s order (not just the edited one) and redo re-applies — list and canvas both follow', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeMarkers(page);
    const before = await canvasFingerprint(page);

    await editOrderChip(page, 0, 3);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:2', 'fixture-a:3', 'fixture-c:4']);
    const afterChange = await canvasFingerprint(page);
    expect(afterChange).not.toBe(before);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2', 'fixture-c:3']);
    expect(await canvasFingerprint(page)).toBe(before);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:2', 'fixture-a:3', 'fixture-c:4']);
    expect(await canvasFingerprint(page)).toBe(afterChange);

    expectNoErrors(errors);
  });

  test('re-entering a marker\'s current order value is a no-op and pushes nothing', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeMarkers(page);

    await editOrderChip(page, 0, 1); // fixture-a already has order 1

    // Not asserting dirtyIndicator: loadThreeMarkers() already dirtied the
    // project via marker placement, so a no-op edit's own non-effect on
    // dirty state isn't independently observable here (markProjectDirty()
    // is itself a no-op once already dirty) — the history stack is the
    // authoritative no-op signal.
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2', 'fixture-c:3']);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('dragging a marker to a new position pushes one history entry and re-sequences everyone to 1,2,3...', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeMarkers(page);

    await dragReorderMarker(page, 0, 2); // move fixture-a to the end

    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1', 'fixture-c:2', 'fixture-a:3']);
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('drag-reorder undo restores the original order and redo re-applies it', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeMarkers(page);
    const before = await canvasFingerprint(page);

    await dragReorderMarker(page, 0, 2);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1', 'fixture-c:2', 'fixture-a:3']);
    const afterChange = await canvasFingerprint(page);
    expect(afterChange).not.toBe(before);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2', 'fixture-c:3']);
    expect(await canvasFingerprint(page)).toBe(before);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1', 'fixture-c:2', 'fixture-a:3']);
    expect(await canvasFingerprint(page)).toBe(afterChange);

    expectNoErrors(errors);
  });

  // A genuine no-op drag: dropping row 1 (fixture-b) "after" row 0
  // (fixture-a) computes insertAt=1 === the source index (1) once the drop
  // handler's insertAt-- adjustment runs, landing fixture-b back in its own
  // slot -- even though the visually-targeted row (0) is not the source
  // row itself, so the earlier `_mkDragSrcIdx === listIdx` early-return
  // does not catch it. Reproduces the same shape of bug the U6 required
  // fix guarded against for scene reorder.
  test('a drop that resolves to the same final position is a genuine no-op and pushes nothing', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeMarkers(page);

    await page.evaluate(() => {
      const items = document.querySelectorAll('#floormap-mk-list-ul .floormap-mk-list-item');
      const src = items[1];
      const target = items[0];
      const dt = new DataTransfer();
      src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      const rect = target.getBoundingClientRect();
      const clientY = rect.bottom - 1; // drop on target's bottom half -> "after"
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, clientY }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt, clientY }));
      src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    });

    // Not asserting dirtyIndicator: see the "re-entering current order
    // value" test above for why (loadThreeMarkers() already dirtied the
    // project via marker placement).
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2', 'fixture-c:3']);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('"番号を整理" pushes one history entry and re-sequences to 1,2,3... in current order', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeMarkers(page);

    // Create a gap first (fixture-a: 1 -> 10, no collisions) so the list is
    // no longer 1,2,3... — resequence must not be a no-op here.
    await editOrderChip(page, 0, 10);
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:2', 'fixture-c:3', 'fixture-a:10']);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.locator('#floormap-reseq-btn').click();

    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1', 'fixture-c:2', 'fixture-a:3']);
    expect(await historyCounts(page)).toEqual({ undoCount: 2, redoCount: 0 });

    // Undo the resequence alone restores the pre-resequence (gapped) state.
    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 1 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:2', 'fixture-c:3', 'fixture-a:10']);

    expectNoErrors(errors);
  });

  test('"番号を整理" on an already-sequential list is a no-op and pushes nothing', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeMarkers(page); // already 1,2,3

    await page.locator('#floormap-reseq-btn').click();

    // Not asserting dirtyIndicator: see the "re-entering current order
    // value" test above for why (loadThreeMarkers() already dirtied the
    // project via marker placement).
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2', 'fixture-c:3']);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('a new order change after undo clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeMarkers(page);

    await editOrderChip(page, 0, 3);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2', 'fixture-c:3']);

    // A fresh, different change while a redo entry exists must discard it
    // rather than leaving it stale.
    await dragReorderMarker(page, 0, 2);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1', 'fixture-c:2', 'fixture-a:3']);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(false);
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1', 'fixture-c:2', 'fixture-a:3']); // unchanged by the no-op redo

    expectNoErrors(errors);
  });

  test('Viewer mode: all three bulk-reorder entry points stay blocked at the function level, and history/order stay untouched', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeMarkers(page);

    // Editor -> Viewer while dirty (marker placement above) shows the
    // unsaved-changes confirmation; continue without saving to switch.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    // 1) Direct edit: the order chip's own click handler gates on
    // canMutateProject() before creating the <input>, same as U3's context
    // menu never opening in Viewer mode — there is no persistent element to
    // bypass via dispatchEvent the way U1/U2's CSS-hidden buttons are; the
    // gate itself is the surface under test here.
    const numEl = page.locator('#floormap-mk-list-ul .floormap-mk-list-item').nth(0).locator('.floormap-mk-list-num');
    await numEl.dispatchEvent('click');
    await expect(numEl.locator('input')).toHaveCount(0);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    // 2) Drag reorder: the <li> drop handler itself is still attached
    // regardless of mode (same as U6's scene-list rows) and gates via
    // assertEditorMode() — dispatching the real drag sequence proves the
    // guard is function-level, not just attribute/CSS-level.
    await dragReorderMarker(page, 0, 2);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    // 3) "番号を整理": the button itself is .editor-only (CSS-hidden in
    // Viewer mode) but the listener is still attached; dispatching a click
    // on the hidden element bypasses the CSS gate and proves
    // resequenceMarkers()'s own assertEditorMode() guard independently.
    await expect(page.locator('#floormap-reseq-btn')).toBeHidden();
    await page.locator('#floormap-reseq-btn').dispatchEvent('click');
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    // Switch back to Editor to read the marker list DOM (hidden, not
    // removed, in Viewer mode) and confirm nothing actually changed.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2', 'fixture-c:3']);

    expectNoErrors(errors);
  });

  // Proves _snapshotMarkerOrders()/applyMarkerOrders() are scoped to the
  // floor plan they're called for: a bulk order change on one floor plan
  // must never read or write markers belonging to a different floor plan,
  // even though both live in the same flat projectState.markers array.
  test('a bulk order change on one floor plan has no side effect on another floor plan\'s markers', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
    await expect(page.locator('#scene-list .scene-item')).toHaveCount(2);

    // Floor plan 1: one marker, order edited to a distinctive value (7).
    await page.locator('#add-floorplan-btn').click();
    await page.locator('#floorplan-input').setInputFiles(FLOORPLAN_1);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    await page.locator('#floormap-place-btn').click();
    // Since U5, placing this marker itself pushes a history entry; clear()
    // isolates the order edit below as this test's actual subject.
    await page.evaluate(() => window.__historyManagerForTests.clear());
    await editOrderChip(page, 0, 7);
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:7']);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    // Floor plan 2: two markers of its own (independent 1,2 numbering —
    // _nextMarkerOrder() is scoped per floor plan), then a drag reorder.
    await page.locator('#add-floorplan-btn').click();
    await page.locator('#floorplan-input').setInputFiles(FLOORPLAN_2);
    await page.locator('.floorplan-item').nth(1).click();
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    await page.locator('#scene-list .scene-item').nth(1).click();
    await page.locator('#floormap-canvas').click({ position: POS_B });
    await page.locator('#floormap-place-btn').click();
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2']);
    // Same reasoning: isolate the drag reorder below from these two
    // setup placements' own history entries.
    await page.evaluate(() => window.__historyManagerForTests.clear());

    await dragReorderMarker(page, 0, 1); // swap the two floor-plan-2 markers
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1', 'fixture-a:2']);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    // Back to floor plan 1: its marker's order (7) must be exactly as left.
    await page.locator('.floorplan-item').nth(0).click();
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:7']);

    expectNoErrors(errors);
  });
});
