// Coverage for U6 (docs/UndoRedo_Expansion_Implementation_Plan.md U6:
// シーン並び替え) — the scene-reorder half of the fifth Undo/Redo対象拡張
// implementation unit (scene delete is covered separately in
// scene-delete-history.spec.js). Reordering only has one entry point: the
// scene list's own HTML5 drag-and-drop (script.js's per-<li> dragstart/
// dragover/drop handlers) — there is no button/shortcut alternative, so
// these tests drive that real drag gesture via dispatched DragEvents
// (constructible DataTransfer, supported in this Chromium build) rather
// than adding a new production test hook for reorderScene() itself.
//
// Same shape as the other U1/U2/U3/U9 history specs otherwise: drives the
// app's own historyManager instance via window.__historyManagerForTests
// for undo/redo, not through any Undo/Redo button.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');
const FIXTURE_D = path.join(FIXTURES, 'lifecycle-scene-a.png');

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

function sceneNames(page) {
  return page.locator('#scene-list .scene-item .scene-name').allTextContents();
}

async function loadThreeScenes(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
  await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-b', 'fixture-c']);
}

// Reproduces script.js's exact dragover math (insertBefore = clientY <
// rect.top + rect.height/2, dragOverIdx = i or i+1) and the drop handler's
// insertAt-- adjustment, so `fromIdx`/`toIdx` here mean exactly what
// reorderScene(fromIdx, toIdx) would be called with for a real user drag
// of the item currently at `fromIdx` to end up at final position `toIdx`.
// Dispatches events directly (no draggable-attribute gating, no real OS
// drag) so it also works to prove/disprove Viewer-mode's guard, same
// rationale as U1-U3's hidden-element dispatchEvent('click') bypasses.
async function dragReorderScene(page, fromIdx, toIdx) {
  await page.evaluate(({ fromIdx, toIdx }) => {
    const items = document.querySelectorAll('#scene-list .scene-item');
    const src = items[fromIdx];
    const target = items[toIdx];
    const dt = new DataTransfer();
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    const rect = target.getBoundingClientRect();
    // Moving down: hover the target's bottom half (insertBefore=false ->
    // dragOverIdx=toIdx+1 -> insertAt-- -> toIdx). Moving up: hover the
    // target's top half (insertBefore=true -> dragOverIdx=toIdx ->
    // insertAt stays toIdx, since toIdx < fromIdx so no decrement).
    const clientY = toIdx > fromIdx ? rect.bottom - 1 : rect.top + 1;
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, clientY }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt, clientY }));
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  }, { fromIdx, toIdx });
}

test.describe('Scene reorder history (undo/redo)', () => {
  test('reordering a scene pushes one history entry, marks dirty, and updates the DOM order', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeHidden();

    await dragReorderScene(page, 0, 2); // move fixture-a to the end

    await expect(sceneNames(page)).resolves.toEqual(['fixture-b', 'fixture-c', 'fixture-a']);
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('undo restores the original order and redo re-applies it — and both keep tracking the same scene as current, not just a position', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    // fixture-a (index 0) is current after load; move it -- undo/redo must
    // keep #current-scene-name on "fixture-a" throughout, following the
    // scene's identity, not whatever ends up sitting at index 0.
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');

    await dragReorderScene(page, 0, 2);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(sceneNames(page)).resolves.toEqual(['fixture-b', 'fixture-c', 'fixture-a']);
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-b', 'fixture-c']);
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(sceneNames(page)).resolves.toEqual(['fixture-b', 'fixture-c', 'fixture-a']);
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');

    expectNoErrors(errors);
  });

  // Required fix (Review Agent #4890280247 on PR #49): applySceneOrder()
  // must not silently drop a scene that was added *after* a reorder's
  // history entry was recorded -- U7 (scene add/image update) isn't
  // implemented yet, so adding a scene is currently an untracked
  // mutation, and naively rebuilding the whole `scenes` array from only
  // the snapshot's ids would erase anything outside that snapshot.
  // Reorder must only ever touch the relative order of the scenes it
  // actually snapshotted; anything else present in `scenes` (by id and
  // object identity) must survive both undo and redo untouched.
  test('a scene added after a reorder survives that reorder\'s undo and redo, unchanged and with the same id', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    await dragReorderScene(page, 0, 2); // A/B/C -> B/C/A
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(sceneNames(page)).resolves.toEqual(['fixture-b', 'fixture-c', 'fixture-a']);

    // U7 (scene add/image update) now tracks scene add, so capture the
    // reorder entry's own undo/redo closures directly off
    // window.__historyManagerForTests's already-exposed internal stack
    // (historyManager itself, not a wrapper) before D is added below --
    // D's own add is tracked too and would push its own entry on top of
    // this one, so a real sequential undo()/redo() would hit D's entry
    // first rather than the reorder being tested here.
    await page.evaluate(() => {
      const hm = window.__historyManagerForTests;
      const entry = hm._undoStack[hm._undoStack.length - 1];
      window.__staleReorderUndo = entry.undo;
      window.__staleReorderRedo = entry.redo;
    });

    // #add-img-btn just forwards to #file-input's own click(); feeding
    // the file input directly is the same pattern loadThreeScenes()
    // above already uses.
    await page.locator('#file-input').setInputFiles(FIXTURE_D);
    await expect(sceneNames(page)).resolves.toEqual(['fixture-b', 'fixture-c', 'fixture-a', 'lifecycle-scene-a']);
    // No scene-id test hook exists in this codebase (or is needed here):
    // the fix leaves an untracked scene's array slot completely untouched
    // (same object reference), so its name -- unique within this test and
    // never reassigned -- is a sufficient, already-established proxy for
    // "same id, same content", matching how this same spec file already
    // verifies scene identity elsewhere via #current-scene-name text
    // rather than a raw id.

    await page.evaluate(() => window.__staleReorderUndo());
    // D must still be present, unchanged, while only A/B/C's relative
    // order reverts to pre-reorder (A/B/C). D's own position relative to
    // the group is not specified by the fix (only "exists, same id/
    // content, and A/B/C's relative order is what's restored") -- assert
    // the set of names is exactly {A,B,C,D} and A/B/C's relative order
    // (ignoring D) is back to A,B,C.
    let names = await sceneNames(page);
    expect(names).toContain('lifecycle-scene-a');
    expect(names.filter(n => n !== 'lifecycle-scene-a')).toEqual(['fixture-a', 'fixture-b', 'fixture-c']);
    expect(names).toHaveLength(4);

    await page.evaluate(() => window.__staleReorderRedo());
    names = await sceneNames(page);
    expect(names).toContain('lifecycle-scene-a');
    expect(names.filter(n => n !== 'lifecycle-scene-a')).toEqual(['fixture-b', 'fixture-c', 'fixture-a']);
    expect(names).toHaveLength(4);

    expectNoErrors(errors);
  });

  test('a no-op reorder (dropping an item back where it already is) does not push a history entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    const dirtyBefore = await dirtyIndicator(page).isVisible();

    // Drag item 1 (fixture-b) and drop it on item 2's (fixture-c) top
    // half -- "insert fixture-b immediately before fixture-c", which is
    // exactly where it already is. This is a real drag gesture reaching
    // reorderScene(1, 1) via the drop handler's own insertAt-- math, not
    // an artificial fromIdx===toIdx call.
    await page.evaluate(() => {
      const items = document.querySelectorAll('#scene-list .scene-item');
      const src = items[1];
      const target = items[2];
      const dt = new DataTransfer();
      src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      const rect = target.getBoundingClientRect();
      // top half -> insertBefore -> dragOverIdx=2 -> insertAt-- (2>1) -> 1 -> reorderScene(1, 1), a real no-op
      const clientY = rect.top + 1;
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, clientY }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt, clientY }));
    });

    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-b', 'fixture-c']);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    expect(await dirtyIndicator(page).isVisible()).toBe(dirtyBefore); // no further change

    expectNoErrors(errors);
  });

  test('a new reorder after undo clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    await dragReorderScene(page, 0, 2);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-b', 'fixture-c']);

    await dragReorderScene(page, 2, 0); // a different reorder
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(sceneNames(page)).resolves.toEqual(['fixture-c', 'fixture-a', 'fixture-b']);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(false); // the old redo entry is gone, not just uncounted
    await expect(sceneNames(page)).resolves.toEqual(['fixture-c', 'fixture-a', 'fixture-b']); // unchanged

    expectNoErrors(errors);
  });

  test('Viewer mode: reorderScene blocks a drag gesture via its own assertEditorMode() guard', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    // Editor -> Viewer while clean (no edit made yet) needs no confirmation.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);

    // Note: li.draggable is only set at renderSceneList() time
    // (`li.draggable = canMutateProject()`), and switching Editor->Viewer
    // does not re-render the already-built scene list -- so the
    // *attribute* itself can still read true here (a pre-existing gap,
    // unrelated to U6 and out of this task's scope to fix). The actual,
    // reliable safety net -- same "function-gated, not attribute/CSS-
    // gated" shape already established for the marker context menu in
    // phase2-section13-audit.spec.js -- is reorderScene()'s own
    // assertEditorMode() check, which this test verifies directly via a
    // dispatched drag gesture that bypasses any DOM-level gate entirely.
    await dragReorderScene(page, 0, 2);

    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-b', 'fixture-c']);

    expectNoErrors(errors);
  });
});
