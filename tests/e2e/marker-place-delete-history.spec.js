// Coverage for U5 (docs/UndoRedo_Expansion_Implementation_Plan.md U5:
// マーカー配置・削除) — the seventh Undo/Redo対象拡張 implementation unit:
// marker creation (the FloorMap canvas's placement-mode click, when no
// marker yet exists for the clicked scene on the active floor plan) and
// marker deletion (the info panel's × button / the marker context menu's
// "× 削除" item, both routing through deleteSelectedMarker()). Both now
// funnel through a single applyMarkerLifecycle(marker, isPresent) apply
// function operating purely by the marker's own id, so one user operation
// always pushes exactly one history entry.
//
// Explicitly out of scope, confirmed by reading the pre-U5 code: clicking
// placement mode a second time on a scene that ALREADY has a marker on
// the active floor plan does not create anything — it repositions the
// existing marker (a move, not a create/delete), which is left untouched
// here (a separate, pre-existing gap; U1's applyMarkerPosition covers only
// the drag-based move path). Also confirmed: deleting a marker never
// renumbers or shifts any other marker's order — the deleted marker's
// order value becomes a permanent gap (until "番号を整理", U4) — so undo
// of a delete must restore the exact original order value, not a
// re-sequenced one.
//
// Same shape as marker-attrs-history.spec.js (U1) / scene-delete-
// history.spec.js (U6): drives the app's own historyManager instance via
// window.__historyManagerForTests, and reads the FloorMap canvas's own
// rendered bitmap (no production test hook) to prove actual rendered
// state, not just history-stack bookkeeping.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');
const FLOORPLAN_1 = path.join(FIXTURES, 'lifecycle-scene-a.png');

// Well-separated positions on the 340x255 #floormap-canvas (index.html) so
// each click unambiguously targets one marker; _findMarkerAt()'s hit
// radius (12 canvas px) is nowhere close to spanning the gaps below.
const POS_A = { x: 70,  y: 50  };
const POS_B = { x: 170, y: 130 };
const POS_C = { x: 270, y: 210 };

function infoPanel(page) { return page.locator('#floormap-info-panel'); }
function infoName(page)  { return page.locator('#floormap-info-name'); }
function delBtn(page)    { return page.locator('#floormap-del-mk'); }

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

// Reads the marker list top-to-bottom as "scene:order" pairs -- a full,
// id-free readout of every marker's identity and order on the active
// floor plan, same helper shape as marker-order-bulk-history.spec.js.
function markerRows(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('#floormap-mk-list-ul .floormap-mk-list-item')).map(li =>
    `${li.querySelector('.floormap-mk-list-scene').textContent}:${li.querySelector('.floormap-mk-list-num').textContent}`
  ));
}

async function canvasFingerprint(page) {
  return page.evaluate(() => document.getElementById('floormap-canvas').toDataURL());
}

async function loadSceneAndFloorplan(page, fixtures) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles(fixtures);
  await expect(page.locator('#scene-list .scene-item')).toHaveCount(fixtures.length);
  await page.locator('#add-floorplan-btn').click();
  await page.locator('#floorplan-input').setInputFiles(FLOORPLAN_1);
}

test.describe('Marker place/delete history (undo/redo)', () => {
  test('placing a marker on an empty scene pushes one history entry, marks dirty, and adds it to the list', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page, [FIXTURE_A]);
    await expect(dirtyIndicator(page)).toBeVisible(); // floorplan add already dirtied it
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual([]);

    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });

    await expect(infoPanel(page)).toBeVisible();
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('undo removes the placed marker entirely and redo restores it — list and canvas both follow', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page, [FIXTURE_A]);
    const before = await canvasFingerprint(page);

    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']);
    const afterPlace = await canvasFingerprint(page);
    expect(afterPlace).not.toBe(before);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    await expect(markerRows(page)).resolves.toEqual([]);
    expect(await canvasFingerprint(page)).toBe(before);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']);
    expect(await canvasFingerprint(page)).toBe(afterPlace);

    expectNoErrors(errors);
  });

  // Required Fix (review #4891276690 on PR #51): re-placing on a scene
  // that already has a marker moves it (position + rotation, atomically,
  // as one click) -- this used to be untracked, which let an older
  // still-tracked create entry for the same marker resurrect a stale
  // position on redo after the untracked move. Now routed through the
  // same U1 applyMarkerPosition()/applyMarkerRotation() apply functions
  // the drag-based move and rotate-button paths already use, pushing
  // exactly one additional history entry (distinct from the create's own
  // entry) per reposition click.
  test('re-placing on a scene that already has a marker moves it and pushes its own history entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page, [FIXTURE_A]);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']);
    const afterCreate = await canvasFingerprint(page);

    await page.locator('#floormap-canvas').click({ position: POS_B }); // still same scene -> moves the existing marker

    expect(await historyCounts(page)).toEqual({ undoCount: 2, redoCount: 0 }); // create + reposition
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']); // still exactly one marker, same order
    const afterReposition = await canvasFingerprint(page);
    expect(afterReposition).not.toBe(afterCreate);

    // Undoing just the reposition restores the marker to its post-create
    // (P1) position, not absence.
    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 1 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']);
    expect(await canvasFingerprint(page)).toBe(afterCreate);

    expectNoErrors(errors);
  });

  // Clicking at the exact same position/orientation the marker is already
  // at is a genuine no-op and must not push a redundant entry.
  test('re-placing at the exact same spot is a no-op and pushes nothing', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page, [FIXTURE_A]);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    const afterCreate = await canvasFingerprint(page);

    await page.locator('#floormap-canvas').click({ position: POS_A }); // identical click -> identical x/y/rotation

    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 }); // unchanged
    expect(await canvasFingerprint(page)).toBe(afterCreate);

    expectNoErrors(errors);
  });

  // The exact regression scenario from review #4891276690: a tracked
  // create followed by an (until this fix) untracked reposition let undo
  // replay the create's stale snapshot and redo silently lose the later
  // position. Walks the full create -> reposition -> undo -> undo -> redo
  // -> redo cycle and confirms the final position (P2) is never lost, a
  // bystander marker on another scene is never touched, and id/order stay
  // stable throughout.
  test('create then reposition survives a full undo-undo-redo-redo cycle without losing the final position', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page, [FIXTURE_A, FIXTURE_B]);

    // Bystander marker on a different scene, untouched by anything below.
    await page.locator('#floormap-place-btn').click();
    await page.locator('#scene-list .scene-item').nth(1).click();
    await page.locator('#floormap-canvas').click({ position: POS_C });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1']);

    // Create the subject marker at P1 (scene fixture-a, POS_A).
    await page.locator('#scene-list .scene-item').nth(0).click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    expect(await historyCounts(page)).toEqual({ undoCount: 2, redoCount: 0 }); // bystander create + this create
    // Bystander (fixture-b) was created first, so it holds order 1; the
    // subject marker (fixture-a) was created second and holds order 2 --
    // markerRows() is sorted by order ascending, so it lists fixture-b
    // first throughout this test.
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1', 'fixture-a:2']);
    const atP1 = await canvasFingerprint(page);

    // Reposition it to P2 (POS_B), still the same scene/marker.
    await page.locator('#floormap-canvas').click({ position: POS_B });
    await page.locator('#floormap-place-btn').click(); // exit placement mode
    expect(await historyCounts(page)).toEqual({ undoCount: 3, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1', 'fixture-a:2']);
    const atP2 = await canvasFingerprint(page);
    expect(atP2).not.toBe(atP1);

    // Undo #1: reposition -> back to P1, marker still present.
    let r = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(r).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 2, redoCount: 1 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1', 'fixture-a:2']);
    expect(await canvasFingerprint(page)).toBe(atP1);

    // Undo #2: create -> marker absent entirely; bystander untouched.
    r = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(r).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 2 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1']);

    // Redo #1: create -> back at P1.
    r = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(r).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 2, redoCount: 1 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1', 'fixture-a:2']);
    expect(await canvasFingerprint(page)).toBe(atP1);

    // Redo #2: reposition -> back at P2. This is the exact assertion the
    // review's reported bug would have failed: the pre-fix code had no
    // second history entry at all, so this redo() would have returned
    // false and the marker would have stayed stuck at P1.
    r = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(r).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 3, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1', 'fixture-a:2']); // id/order preserved throughout
    expect(await canvasFingerprint(page)).toBe(atP2); // P2 is not lost

    expectNoErrors(errors);
  });

  test('deleting a marker pushes one history entry and marks dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page, [FIXTURE_A]);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    await page.locator('#floormap-place-btn').click(); // exit placement mode
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await delBtn(page).click();

    await expect(markerRows(page)).resolves.toEqual([]);
    await expect(infoPanel(page)).toBeHidden();
    expect(await historyCounts(page)).toEqual({ undoCount: 2, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('undo restores the deleted marker with its exact original order (a gap, not re-sequenced), and redo re-deletes it', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page, [FIXTURE_A, FIXTURE_B]);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    await page.locator('#scene-list .scene-item').nth(1).click();
    await page.locator('#floormap-canvas').click({ position: POS_B });
    await page.locator('#floormap-place-btn').click();
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2']);

    // Select fixture-a via the marker list row first, and wait for its
    // switchToScene() fade to fully settle, BEFORE capturing the "before"
    // fingerprint -- applyMarkerLifecycle() never touches currentIdx, so
    // whichever scene is current at the moment of deletion stays current
    // straight through undo/redo; capturing the fingerprint any earlier
    // (while fixture-b was still current from the placement clicks above)
    // would make it mismatch after undo for a reason unrelated to U5.
    await page.locator('#floormap-mk-list-ul .floormap-mk-list-item').nth(0).click();
    await expect(infoName(page)).toHaveText('fixture-a');
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');
    const beforeDelete = await canvasFingerprint(page);

    await delBtn(page).click();
    expect(await historyCounts(page)).toEqual({ undoCount: 3, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:2']); // order 1 is now a gap, not re-sequenced
    const afterDelete = await canvasFingerprint(page);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 2, redoCount: 1 });
    // Exact original order (1) restored, not renumbered to fill the gap.
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2']);
    expect(await canvasFingerprint(page)).toBe(beforeDelete);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 3, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:2']);
    expect(await canvasFingerprint(page)).toBe(afterDelete);

    expectNoErrors(errors);
  });

  // Proves applyMarkerLifecycle() operates purely by marker id: a marker
  // created after an earlier create/delete history entry was pushed must
  // survive that earlier entry's undo AND redo completely unchanged --
  // same shape of regression the U6 required fix guarded against for
  // scene reorder (there, a whole-array rebuild from a partial snapshot
  // silently dropped a scene added afterward; here, no such rebuild ever
  // happens, since every apply call touches only its own marker id).
  test('a marker placed/deleted after an earlier entry survives that entry\'s undo and redo, unchanged and with the same order', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page, [FIXTURE_A, FIXTURE_B, FIXTURE_C]);
    await page.locator('#floormap-place-btn').click();

    // Place A (scene fixture-a), then delete it (order 1 becomes a gap).
    await page.locator('#floormap-canvas').click({ position: POS_A });
    const deleteEntryUndoCountBefore = (await historyCounts(page)).undoCount;
    await page.locator('#floormap-mk-list-ul .floormap-mk-list-item').nth(0).click();
    await delBtn(page).click();
    expect((await historyCounts(page)).undoCount).toBe(deleteEntryUndoCountBefore + 1);
    await expect(markerRows(page)).resolves.toEqual([]);

    // Now place B (scene fixture-b) AFTER that delete's history entry —
    // B's order (1) happens to reuse the gap left by A, by design of
    // _nextMarkerOrder(); this is pre-existing behavior, not introduced by
    // U5. B's own creation entry is what this test's undo/redo targets.
    await page.locator('#scene-list .scene-item').nth(1).click();
    await page.locator('#floormap-canvas').click({ position: POS_B });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1']);
    const afterBCreate = await canvasFingerprint(page);

    // Undo B's own creation (the most recent entry) -- must remove only B,
    // leaving the earlier (already-applied) delete-of-A state untouched.
    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expect(markerRows(page)).resolves.toEqual([]);

    // Redo B's creation back.
    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1']);
    expect(await canvasFingerprint(page)).toBe(afterBCreate);

    // Finally, undo all the way back past B's creation to A's delete, then
    // undo A's delete too -- A must come back with its original order (1),
    // and B must simply not exist yet at that point (its own creation is
    // still further ahead on the undo stack from where we started this
    // walk-back, i.e. already undone above).
    await page.evaluate(() => window.__historyManagerForTests.undo()); // undo B's creation again
    const undoADeleteResult = await page.evaluate(() => window.__historyManagerForTests.undo()); // undo A's delete
    expect(undoADeleteResult).toBe(true);
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']);

    expectNoErrors(errors);
  });

  test('a new place/delete after undo clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page, [FIXTURE_A, FIXTURE_B]);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(markerRows(page)).resolves.toEqual([]);

    // A fresh placement (different scene) while a redo entry exists must
    // discard that redo entry rather than leaving it stale.
    await page.locator('#scene-list .scene-item').nth(1).click();
    await page.locator('#floormap-canvas').click({ position: POS_B });
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1']);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(false);
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1']); // unchanged by the no-op redo

    expectNoErrors(errors);
  });

  test('Viewer mode: placement and delete stay blocked at the function level, and history/state stay untouched', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page, [FIXTURE_A]);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    await page.locator('#floormap-place-btn').click();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    // Editor -> Viewer while dirty shows the unsaved-changes confirmation;
    // continue without saving to switch.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    // 1) Placement: #floormap-place-btn is .editor-only (CSS-hidden), but
    // its click listener (togglePlacementMode()) is still attached;
    // dispatching a click bypasses the CSS gate and proves
    // togglePlacementMode()'s own assertEditorMode() guard independently
    // -- isPlacementMode can only ever flip true through that function, so
    // if the guard holds, the canvas click handler's own creation branch
    // is unreachable regardless of what happens next.
    await expect(page.locator('#floormap-place-btn')).toBeHidden();
    await page.locator('#floormap-place-btn').dispatchEvent('click');
    await page.locator('#floormap-canvas').click({ position: POS_B });
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    // 2) Delete: #floormap-del-mk's own class list has no .editor-only,
    // but it sits inside a parent <div class="floormap-info-actions
    // editor-only"> (index.html), so it IS CSS-hidden in Viewer mode via
    // that ancestor -- same as the placement button, just one level up.
    // Selecting/viewing a marker is itself a Common (non-mutating)
    // operation, so the list-row click works normally even in Viewer
    // mode; dispatching the delete click bypasses the CSS-hidden ancestor
    // and proves deleteSelectedMarker()'s own assertEditorMode() guard
    // independently.
    await page.locator('#floormap-mk-list-ul .floormap-mk-list-item').nth(0).click();
    await expect(infoPanel(page)).toBeVisible();
    await expect(delBtn(page)).toBeHidden();
    await delBtn(page).dispatchEvent('click');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    // Single switch back to Editor (Viewer -> Editor never needs the
    // unsaved-changes confirmation) to read the marker list DOM and
    // confirm nothing changed by either attempted bypass above.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']); // still present

    expectNoErrors(errors);
  });

  // Review #4891276690 recommendation: verify what happens to selection
  // when undoing a create while a DIFFERENT marker was selected
  // beforehand. Creating a marker has always stolen selection (the live
  // commit point sets selectedMarkerId = the new marker's id, matching
  // pre-U5 behavior) -- undoing that create clears selection entirely
  // rather than restoring the marker that was selected before the create,
  // since selectedMarkerId is not part of any apply function's snapshot
  // (consistent with every other U1/U3/U4/U6/U9 apply function: none of
  // them restore "whatever was selected before", only the entity being
  // directly acted on). This is intentional, pre-existing non-history UI
  // state, not a data-loss regression: no error, no stale/wrong marker
  // shown, just no selection -- so it is documented here rather than
  // "fixed".
  test('undoing a create clears selection rather than restoring a previously-selected different marker (documented, not a regression)', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page, [FIXTURE_A, FIXTURE_B]);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A }); // first marker, on fixture-a
    await page.locator('#floormap-place-btn').click();
    await expect(infoName(page)).toHaveText('fixture-a'); // selected after its own creation

    await page.locator('#floormap-place-btn').click();
    await page.locator('#scene-list .scene-item').nth(1).click();
    await page.locator('#floormap-canvas').click({ position: POS_B });
    await page.locator('#floormap-place-btn').click();
    await expect(infoName(page)).toHaveText('fixture-b'); // creating the 2nd marker steals selection (pre-existing behavior)

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']); // fixture-b's marker is gone
    await expect(infoPanel(page)).toBeHidden(); // selection cleared, NOT restored to fixture-a's marker

    expectNoErrors(errors);
  });
});
