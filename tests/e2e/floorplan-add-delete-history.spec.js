// Coverage for U8 (docs/UndoRedo_Expansion_Implementation_Plan.md U8:
// FloorMap追加・削除) — the eighth Undo/Redo対象拡張 implementation unit:
// adding a floor plan (one <input multiple> file-selection batch = one
// undo unit, covering however many floor plans that batch added) and
// deleting one (which cascades: markers on that floor plan are removed
// too, and any scene's scene.floorplanId pointing at it is cleared).
//
// Image-binary retention mirrors the pattern already established for
// scenes (handleFiles()/applySceneRemoval(), U6): the floorplan object
// keeps its original `file` permanently; blobUrl/imgEl are only ever a
// disposable *view* of that File, regenerated via
// URL.createObjectURL(fp.file) + new Image() every time the floor plan
// becomes present again and revoked every time it becomes absent. No new
// production test hook is needed to observe image content: the FloorMap
// canvas's own toDataURL() is a byte-for-byte proxy of what image was
// actually drawn, since renderFloormapCanvas() is a synchronous,
// deterministic 2D draw once the image has loaded.
//
// Same shape as scene-delete-history.spec.js (U6) / marker-place-delete-
// history.spec.js (U5): drives the app's own historyManager instance via
// window.__historyManagerForTests, id-scoped apply functions never
// rebuild the whole floorplans/markers array from a snapshot alone.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FLOORPLAN_1 = path.join(FIXTURES, 'lifecycle-scene-a.png');
const FLOORPLAN_2 = path.join(FIXTURES, 'lifecycle-scene-b.png');

// Well-separated positions on the 340x255 #floormap-canvas (index.html) so
// each click unambiguously targets one marker; _findMarkerAt()'s hit
// radius (12 canvas px) is nowhere close to spanning the gap below.
const POS_A = { x: 70,  y: 50  };
const POS_B = { x: 170, y: 130 };

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

function floorplanNames(page) {
  return page.locator('#floorplan-list-el .floorplan-item .floorplan-name').allTextContents();
}

function activeFloorplanName(page) {
  return page.locator('#floorplan-list-el .floorplan-item.active .floorplan-name').textContent();
}

// Reads the marker list top-to-bottom as "scene:order" pairs, same helper
// shape as marker-order-bulk-history.spec.js / marker-place-delete-
// history.spec.js -- a full, id-free readout of every marker's identity
// and order on the active floor plan.
function markerRows(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('#floormap-mk-list-ul .floormap-mk-list-item')).map(li =>
    `${li.querySelector('.floormap-mk-list-scene').textContent}:${li.querySelector('.floormap-mk-list-num').textContent}`
  ));
}

async function canvasFingerprint(page) {
  return page.evaluate(() => document.getElementById('floormap-canvas').toDataURL());
}

async function addFloorplan(page, fixturePath) {
  await page.locator('#floorplan-input').setInputFiles(fixturePath);
}

async function deleteFloorplanByName(page, name) {
  const item = page.locator('#floorplan-list-el .floorplan-item').filter({ hasText: name });
  await item.locator('.floorplan-del-btn').click();
}

function sceneFloorBadge(page, sceneIdx) {
  return page.locator('#scene-list .scene-item').nth(sceneIdx).locator('.scene-floor-badge');
}

function infoPanel(page) { return page.locator('#floormap-info-panel'); }

test.describe('FloorMap (floorplan) add/delete history (undo/redo)', () => {
  test('adding a floor plan pushes one history entry, marks dirty, and adds it to the list', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(dirtyIndicator(page)).toBeHidden();
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await addFloorplan(page, FLOORPLAN_1);

    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a']);
    await expect(activeFloorplanName(page)).resolves.toBe('lifecycle-scene-a');
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  // "Same id" isn't independently observable without a new production
  // hook, but applyFloorplanAdd()'s isPresent=true branch always re-adds
  // the SAME captured object (by reference, from the historyManager
  // closure) -- never a rebuilt copy -- so proving name + full rendered
  // image content match before/after undo/redo is a sufficient identity
  // proxy given that design, same reasoning U6's required fix relied on
  // for scene identity.
  test('undo removes the added floor plan entirely, and redo restores it with the same rendered image', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);

    await addFloorplan(page, FLOORPLAN_1);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a']);
    await expect(page.locator('#floormap-canvas')).toBeVisible();
    const afterAdd = await canvasFingerprint(page);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    await expect(floorplanNames(page)).resolves.toEqual([]);
    await expect(page.locator('#floormap-navigator')).toBeHidden();

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a']);
    await expect(page.locator('#floormap-canvas')).toBeVisible();
    expect(await canvasFingerprint(page)).toBe(afterAdd);

    expectNoErrors(errors);
  });

  test('deleting a floor plan pushes one history entry and marks dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await addFloorplan(page, FLOORPLAN_1);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await deleteFloorplanByName(page, 'lifecycle-scene-a');

    await expect(floorplanNames(page)).resolves.toEqual([]);
    expect(await historyCounts(page)).toEqual({ undoCount: 2, redoCount: 0 });
    expectNoErrors(errors);
  });

  test('undo restores the deleted floor plan at its original position with the same rendered image, and redo re-deletes it', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await addFloorplan(page, FLOORPLAN_1);
    await addFloorplan(page, FLOORPLAN_2);
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a', 'lifecycle-scene-b']);

    // Switch to FP1 to capture its rendered image before deleting it.
    await page.locator('.floorplan-item').filter({ hasText: 'lifecycle-scene-a' }).click();
    await expect(activeFloorplanName(page)).resolves.toBe('lifecycle-scene-a');
    const fp1Canvas = await canvasFingerprint(page);

    await deleteFloorplanByName(page, 'lifecycle-scene-a');
    expect(await historyCounts(page)).toEqual({ undoCount: 3, redoCount: 0 });
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-b']);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 2, redoCount: 1 });
    // Original position (index 0, before fixture-b) restored, not appended.
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a', 'lifecycle-scene-b']);
    await page.locator('.floorplan-item').filter({ hasText: 'lifecycle-scene-a' }).click();
    expect(await canvasFingerprint(page)).toBe(fp1Canvas);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 3, redoCount: 0 });
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-b']);

    expectNoErrors(errors);
  });

  test('undo restores cascade-deleted markers exactly (identity, order, and rendered position)', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
    await addFloorplan(page, FLOORPLAN_1);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    await page.locator('#scene-list .scene-item').nth(1).click();
    await page.locator('#floormap-canvas').click({ position: POS_B });
    await page.locator('#floormap-place-btn').click();
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2']);
    // Deselect before fingerprinting: placement leaves the just-placed
    // marker selected (a selection-ring highlight in the canvas draw),
    // and selectedMarkerId is documented, established (non-)restore-on-
    // undo UI state (U5 precedent) rather than part of what undo brings
    // back — comparing fingerprints across a delete/undo cycle must not
    // be confounded by that transient highlight. Click empty canvas
    // space, far from either marker's hit radius, to deselect.
    await page.locator('#floormap-canvas').click({ position: { x: 300, y: 230 } });
    const beforeDelete = await canvasFingerprint(page);

    await deleteFloorplanByName(page, 'lifecycle-scene-a');
    // Floor plan itself is gone, so nothing to filter the marker list by.
    await expect(page.locator('#floormap-navigator')).toBeHidden();

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a']);
    await expect(activeFloorplanName(page)).resolves.toBe('lifecycle-scene-a');
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1', 'fixture-b:2']);
    // The restored floor plan's image is a freshly created blob URL +
    // Image() (applyFloorplanRemoval's isPresent=true branch), so loading
    // is genuinely async; renderFloormapCanvas() self-retries via its own
    // onload handler once decode completes. Poll rather than assume the
    // redraw has already landed by the time undo() resolves.
    await expect.poll(() => canvasFingerprint(page)).toBe(beforeDelete);

    expectNoErrors(errors);
  });

  test('undo restores scene.floorplanId (the scene list\'s FloorMap badge reappears with the correct name)', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await addFloorplan(page, FLOORPLAN_1);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    await page.locator('#floormap-place-btn').click();
    await expect(sceneFloorBadge(page, 0)).toHaveText('lifecycle-scene-a');

    await deleteFloorplanByName(page, 'lifecycle-scene-a');
    await expect(sceneFloorBadge(page, 0)).toHaveCount(0);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expect(sceneFloorBadge(page, 0)).toHaveText('lifecycle-scene-a');

    expectNoErrors(errors);
  });

  test('undo restores activeFloorplanId to its exact pre-delete value, whether or not the deleted floor plan was the active one', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await addFloorplan(page, FLOORPLAN_1);
    await addFloorplan(page, FLOORPLAN_2); // FP1 stays active (auto-activate only fires when nothing was active)
    await expect(activeFloorplanName(page)).resolves.toBe('lifecycle-scene-a');

    // Case 1: delete the floor plan that IS active -> active switches to
    // the remaining one; undo must restore it to the deleted one again.
    await deleteFloorplanByName(page, 'lifecycle-scene-a');
    await expect(activeFloorplanName(page)).resolves.toBe('lifecycle-scene-b');
    let undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expect(activeFloorplanName(page)).resolves.toBe('lifecycle-scene-a');

    // Case 2: delete the floor plan that is NOT active -> active must stay
    // exactly as it was throughout, both live and after undo.
    await deleteFloorplanByName(page, 'lifecycle-scene-b');
    await expect(activeFloorplanName(page)).resolves.toBe('lifecycle-scene-a');
    undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expect(activeFloorplanName(page)).resolves.toBe('lifecycle-scene-a');
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a', 'lifecycle-scene-b']);

    expectNoErrors(errors);
  });

  // selectedMarkerId is not part of any apply function's snapshot, same
  // "not restored to a stale reference" rule already established for
  // marker create/delete (U5): no error results, no stale/wrong marker is
  // shown, just no selection after undo.
  //
  // A second floor plan (FP2) stays present throughout so activeFloorplanId
  // remains non-null after FP1 is deleted -- renderMarkerList() itself
  // early-returns whenever activeFloorplanId is null, so with only one
  // floor plan the marker list DOM would simply stop being re-rendered at
  // all after the delete (stale leftover content, not a real read of
  // current state) rather than actually reflecting the cascade-delete.
  test('selectedMarkerId is cleared when its marker is cascade-deleted, and is not restored to a stale reference after undo', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await addFloorplan(page, FLOORPLAN_1);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    await page.locator('#floormap-place-btn').click();
    await expect(infoPanel(page)).toBeVisible(); // selected right after placement
    await addFloorplan(page, FLOORPLAN_2); // FP1 stays active (something was already active)

    await deleteFloorplanByName(page, 'lifecycle-scene-a');
    // FP2 remains active, so the marker list genuinely re-renders (not
    // stale DOM): the cascade-deleted marker and its selection are both
    // actually gone, live, before any undo/redo is involved.
    await expect(activeFloorplanName(page)).resolves.toBe('lifecycle-scene-b');
    await expect(markerRows(page)).resolves.toEqual([]);
    await expect(infoPanel(page)).toBeHidden();

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expect(activeFloorplanName(page)).resolves.toBe('lifecycle-scene-a'); // FP1 was active pre-delete, restored
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']); // marker itself IS restored
    await expect(infoPanel(page)).toBeHidden(); // but selection is not

    expectNoErrors(errors);
  });

  test('redo re-deletes the floor plan and its markers, leaving no dangling floorplanId', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await addFloorplan(page, FLOORPLAN_1);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    await page.locator('#floormap-place-btn').click();

    await deleteFloorplanByName(page, 'lifecycle-scene-a');
    await page.evaluate(() => window.__historyManagerForTests.undo());
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a']);
    await expect(sceneFloorBadge(page, 0)).toHaveText('lifecycle-scene-a');

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    await expect(floorplanNames(page)).resolves.toEqual([]);
    await expect(sceneFloorBadge(page, 0)).toHaveCount(0); // no dangling floorplanId
    await expect(page.locator('#floormap-navigator')).toBeHidden();

    expectNoErrors(errors);
  });

  test('a new floor-plan operation after undo clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await addFloorplan(page, FLOORPLAN_1);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(floorplanNames(page)).resolves.toEqual([]);

    await addFloorplan(page, FLOORPLAN_2);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-b']);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(false);
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-b']); // unchanged by the no-op redo

    expectNoErrors(errors);
  });

  test('Viewer mode: floor plan add/delete stay blocked at the function level, and history/state stay untouched', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await addFloorplan(page, FLOORPLAN_1);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    // Editor -> Viewer while dirty shows the unsaved-changes confirmation;
    // continue without saving to switch.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    // 1) Add: #floorplan-input is always visually-hidden (not mode-gated
    // by CSS), so driving it directly proves handleFloorplanFiles()'s own
    // assertEditorMode() guard at the function level.
    await addFloorplan(page, FLOORPLAN_2);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a']); // unchanged

    // 2) Delete: .floorplan-del-btn carries .editor-only directly (CSS-
    // hidden in Viewer mode), but its click listener (deleteFloorplan())
    // is still attached; dispatching a click bypasses the CSS gate and
    // proves the function-level guard independently.
    const delBtn = page.locator('#floorplan-list-el .floorplan-item').filter({ hasText: 'lifecycle-scene-a' }).locator('.floorplan-del-btn');
    await expect(delBtn).toBeHidden();
    await delBtn.dispatchEvent('click');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a']); // still present

    expectNoErrors(errors);
  });

  // Proves applyFloorplanAdd()/applyFloorplanRemoval() are id-scoped: a
  // floor plan added after an earlier entry was pushed must survive that
  // earlier entry's undo AND redo completely unchanged -- same shape of
  // regression the U6 required fix guarded against for scene reorder
  // (there, a whole-array rebuild from a partial snapshot silently
  // dropped a scene added afterward; here, no such rebuild ever happens).
  test('a floor plan added after an earlier entry survives that entry\'s undo and redo, unchanged', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await addFloorplan(page, FLOORPLAN_1); // entry #1

    await deleteFloorplanByName(page, 'lifecycle-scene-a'); // entry #2
    await expect(floorplanNames(page)).resolves.toEqual([]);

    await addFloorplan(page, FLOORPLAN_2); // entry #3, added AFTER entry #2 was pushed
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-b']);
    const fp2Canvas = await canvasFingerprint(page);

    // Undo entry #3 (FP2's own creation) -> must remove only FP2.
    let r = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(r).toBe(true);
    await expect(floorplanNames(page)).resolves.toEqual([]);

    // Redo entry #3 -> FP2 back, unchanged.
    r = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(r).toBe(true);
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-b']);
    expect(await canvasFingerprint(page)).toBe(fp2Canvas);

    expectNoErrors(errors);
  });

  test('a marker added after an earlier floor-plan-delete entry survives that entry\'s undo and redo, unchanged', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
    await addFloorplan(page, FLOORPLAN_1); // entry #1
    await addFloorplan(page, FLOORPLAN_2); // entry #2 (FP1 stays active)

    await deleteFloorplanByName(page, 'lifecycle-scene-b'); // entry #3, deletes FP2 (not active, no markers on it)
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a']);

    // Place a marker on FP1 AFTER entry #3 was pushed.
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A }); // entry #4
    await page.locator('#floormap-place-btn').click();
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']);
    const withMarker = await canvasFingerprint(page);

    // Undo entry #4 (the marker's own creation) -> must remove only that
    // marker, leaving FP1/FP2's delete state exactly as entry #3 left it.
    let r = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(r).toBe(true);
    await expect(markerRows(page)).resolves.toEqual([]);
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a']);

    // Redo entry #4 -> marker back, unchanged.
    r = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(r).toBe(true);
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']);
    expect(await canvasFingerprint(page)).toBe(withMarker);

    expectNoErrors(errors);
  });

  // ============================================================
  // PR #52 Required Fix regression (review #4893987323)
  // ============================================================
  // Both tests below capture a history entry's own undo/redo closure
  // directly off window.__historyManagerForTests's already-exposed
  // internal stack (historyManager itself, not a wrapper -- _undoStack/
  // _redoStack are plain properties on it, not a new production test
  // hook) rather than relying on the app's own sequential undo()/redo().
  // That's necessary because the buggy replay state isn't reachable
  // through strictly-LIFO sequential undo()/redo() calls: any marker
  // placed after a floor plan operation sits *above* that operation's
  // entry on the stack, so undoing back to that entry would always undo
  // the marker's own placement first -- which would remove the marker
  // through its own dedicated undo and mask whichever cascade bug is
  // under test. Capturing the closure and invoking it directly exercises
  // applyFloorplanRemoval()/applyFloorplanAdd()'s cascade logic exactly
  // as a same-slot replay would, independent of stack ordering.

  test('Required Fix: redo-replaying a delete removes markers added to the restored floor plan afterward, never touching unrelated data', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
    await addFloorplan(page, FLOORPLAN_1);
    await addFloorplan(page, FLOORPLAN_2); // FP1 stays active

    // An unrelated marker on FP2 -- must survive untouched throughout.
    await page.locator('.floorplan-item').filter({ hasText: 'lifecycle-scene-b' }).click();
    await page.locator('#scene-list .scene-item').nth(1).click(); // fixture-b scene
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    await page.locator('#floormap-place-btn').click();
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1']);

    // Switch back to FP1 (still marker-free) and delete it.
    await page.locator('.floorplan-item').filter({ hasText: 'lifecycle-scene-a' }).click();
    await deleteFloorplanByName(page, 'lifecycle-scene-a');
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-b']);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-a', 'lifecycle-scene-b']);

    // Capture the original delete entry's redo closure before the
    // upcoming marker placement truncates the real redo stack.
    await page.evaluate(() => {
      const hm = window.__historyManagerForTests;
      window.__staleRedoEntry = hm._redoStack[hm._redoStack.length - 1];
    });

    // Place a NEW marker on the just-restored FP1 -- the original delete
    // snapshot (captured before this marker existed) never saw it.
    await page.locator('.floorplan-item').filter({ hasText: 'lifecycle-scene-a' }).click();
    await page.locator('#scene-list .scene-item').nth(0).click(); // fixture-a scene
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_B });
    await page.locator('#floormap-place-btn').click();
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']);

    // Confirm the real redo stack really was truncated by that push, so
    // this genuinely is a state the app's own redo() can no longer reach.
    expect(await historyCounts(page)).toEqual({ undoCount: 4, redoCount: 0 });

    // Invoke the stale closure directly -- what a same-slot redo would
    // have run pre-fix.
    await page.evaluate(() => window.__staleRedoEntry.redo());

    // FP1 is gone again, and the marker placed on it after the undo must
    // be gone too -- not dangling. FP2's unrelated marker survives.
    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-b']);
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1']);

    // #project-dashboard's marker count is project-wide (unfiltered by
    // active floor plan) -- the only DOM-observable proxy for "nothing
    // left dangling in projectState.markers" without a new test hook.
    const markerCountText = await page.locator('#project-dashboard .dashboard-cell').nth(2).locator('.dashboard-val').textContent();
    expect(markerCountText).toBe('1');

    expectNoErrors(errors);
  });

  test('Required Fix: undoing a floor-plan add cascades to markers and scene.floorplanId placed on it afterward, never touching unrelated data', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);

    await addFloorplan(page, FLOORPLAN_1);
    // Capture the "Add floor plan" entry's own undo closure right after
    // it's pushed (top of the real stack at this point).
    await page.evaluate(() => {
      const hm = window.__historyManagerForTests;
      window.__staleAddUndoEntry = hm._undoStack[hm._undoStack.length - 1];
    });

    // Place a marker on FP1 -- this also sets fixture-a's scene.floorplanId.
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_A });
    await page.locator('#floormap-place-btn').click();
    await expect(markerRows(page)).resolves.toEqual(['fixture-a:1']);
    await expect(sceneFloorBadge(page, 0)).toHaveText('lifecycle-scene-a');

    // Unrelated control: FP2 with its own marker + scene association,
    // which must survive completely untouched.
    await addFloorplan(page, FLOORPLAN_2);
    await page.locator('.floorplan-item').filter({ hasText: 'lifecycle-scene-b' }).click();
    await page.locator('#scene-list .scene-item').nth(1).click(); // fixture-b scene
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: POS_B });
    await page.locator('#floormap-place-btn').click();
    await expect(sceneFloorBadge(page, 1)).toHaveText('lifecycle-scene-b');

    // Directly invoke the captured, now-stale "Add FP1" undo closure --
    // applyFloorplanAdd([fp1], false) must cascade entirely on its own.
    await page.evaluate(() => window.__staleAddUndoEntry.undo());

    await expect(floorplanNames(page)).resolves.toEqual(['lifecycle-scene-b']);
    await expect(sceneFloorBadge(page, 0)).toHaveCount(0); // no dangling floorplanId
    await expect(markerRows(page)).resolves.toEqual(['fixture-b:1']); // FP1's marker gone, FP2's survives
    await expect(sceneFloorBadge(page, 1)).toHaveText('lifecycle-scene-b'); // unrelated, untouched

    const markerCountText = await page.locator('#project-dashboard .dashboard-cell').nth(2).locator('.dashboard-val').textContent();
    expect(markerCountText).toBe('1'); // no dangling marker left in projectState.markers

    expectNoErrors(errors);
  });
});
