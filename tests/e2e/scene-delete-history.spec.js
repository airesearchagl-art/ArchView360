// Coverage for U6 (docs/UndoRedo_Expansion_Implementation_Plan.md U6:
// シーン削除) — the scene-delete half of the fifth Undo/Redo対象拡張
// implementation unit (scene reorder is covered separately in
// scene-reorder-history.spec.js). Scene delete is the first "3.3型"
// (生成・削除・参照整合型) group actually implemented: unlike U1-U3/U9's
// single-entity mutations, deleting a scene also removes any marker that
// referenced it, and can shift which scene is "current" -- both must
// come back consistently on undo, and a scene's own id must never change
// across a delete/restore round trip so an existing saved compare set
// referencing it becomes resolvable again the moment it's restored.
//
// Same shape as the other U1/U2/U3/U9/U6-reorder history specs otherwise:
// drives the app's own historyManager instance via
// window.__historyManagerForTests for undo/redo, not through any button.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');
const FLOORPLAN_FIXTURE = path.join(FIXTURES, 'lifecycle-scene-a.png');
const LS_KEY = 'archview360.compareSets';
const MARKER_POS = { x: 50, y: 50 };

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

function sceneNames(page) {
  return page.locator('#scene-list .scene-item .scene-name').allTextContents();
}

// The FloorMap marker list (#floormap-mk-list-ul .floormap-mk-list-scene)
// shows one row per existing marker, labelled by its scene's name -- a
// direct, id-free readout of which scenes currently have a marker. Same
// approach as marker-order-swap-history.spec.js's sceneOrderList().
function markerSceneNames(page) {
  return page.locator('#floormap-mk-list-ul .floormap-mk-list-scene').allTextContents();
}

async function localStorageSets(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), LS_KEY);
}

function sceneItem(page, name) {
  return page.locator('#scene-list .scene-item').filter({ has: page.locator('.scene-name', { hasText: name }) });
}

async function deleteSceneByName(page, name) {
  await sceneItem(page, name).locator('.scene-delete-btn').click();
}

async function loadScenes(page, fixtures) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles(fixtures);
  await expect(sceneNames(page)).resolves.toEqual(
    fixtures.map(f => path.basename(f, path.extname(f)))
  );
}

test.describe('Scene delete history (undo/redo)', () => {
  test('deleting a non-current scene pushes one history entry, marks dirty, and removes it from the list', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page, [FIXTURE_A, FIXTURE_B, FIXTURE_C]);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeHidden();

    await deleteSceneByName(page, 'fixture-b');

    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-c']);
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('undo restores the deleted scene at its original position with the same id; redo re-deletes it', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page, [FIXTURE_A, FIXTURE_B, FIXTURE_C]);

    await deleteSceneByName(page, 'fixture-b');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-c']);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    // Same original position, not just "somewhere in the list".
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-b', 'fixture-c']);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-c']);

    expectNoErrors(errors);
  });

  test('deleting the current scene switches to a neighbor; undo restores it AND makes it current again; redo re-deletes and re-selects the neighbor', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page, [FIXTURE_A, FIXTURE_B]);
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');
    // Switch to fixture-b so it's the current (about to be deleted) scene.
    await page.locator('#scene-list .scene-item').nth(1).click();
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');

    await deleteSceneByName(page, 'fixture-b');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a'); // fell back to the remaining neighbor

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-b']);
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b'); // selection state itself restored, not just the data

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a']);
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');

    expectNoErrors(errors);
  });

  test('deleting a non-current scene keeps the previously-current scene current throughout, tracking identity not position', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page, [FIXTURE_A, FIXTURE_B, FIXTURE_C]);
    await page.locator('#scene-list .scene-item').nth(2).click();
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-c');

    await deleteSceneByName(page, 'fixture-a'); // not current; fixture-c shifts from index 2 to index 1
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-c');

    await page.evaluate(() => window.__historyManagerForTests.undo());
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-c');
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-b', 'fixture-c']);

    await page.evaluate(() => window.__historyManagerForTests.redo());
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-c');
    await expect(sceneNames(page)).resolves.toEqual(['fixture-b', 'fixture-c']);

    expectNoErrors(errors);
  });

  test('a marker referencing the deleted scene is removed and restored consistently across undo/redo, with no duplication', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page, [FIXTURE_A, FIXTURE_B]);
    await page.locator('#add-floorplan-btn').click();
    await page.locator('#floorplan-input').setInputFiles(FLOORPLAN_FIXTURE);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: MARKER_POS }); // marker for fixture-a (current)
    await page.locator('#floormap-place-btn').click(); // exit placement mode
    await expect(markerSceneNames(page)).resolves.toEqual(['fixture-a']);
    await page.evaluate(() => window.__historyManagerForTests.clear()); // only the delete below should be counted

    await deleteSceneByName(page, 'fixture-a');
    await expect(markerSceneNames(page)).resolves.toEqual([]); // marker removed along with its scene
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expect(markerSceneNames(page)).resolves.toEqual(['fixture-a']); // restored, and not duplicated

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    await expect(markerSceneNames(page)).resolves.toEqual([]);

    expectNoErrors(errors);
  });

  test('a saved compare set referencing the deleted scene becomes resolvable again once undo restores the scene', async ({ page }) => {
    const errors = await gotoApp(page);
    // Three scenes, not two: the "開く" button's own click handler has an
    // independent `scenes.length < 2` guard (a generic "need 2+ scenes"
    // toast) that fires before restoreCompareSet()'s own more specific
    // "scene not found" check. With only two scenes, deleting one would
    // trip that generic guard first and mask the very check this test is
    // for. Keeping fixture-c around means scenes.length stays 2 after
    // fixture-b is deleted, so the open attempt actually reaches
    // restoreCompareSet() and its specific not-found toast.
    await loadScenes(page, [FIXTURE_A, FIXTURE_B, FIXTURE_C]);
    await page.locator('#split-compare-btn').click();
    await page.locator('#picker-btn-a').click();
    await page.locator('.picker-item').filter({ hasText: 'fixture-a' }).click();
    await page.locator('#picker-btn-b').click();
    await page.locator('.picker-item').filter({ hasText: 'fixture-b' }).click();
    await page.locator('#save-set-btn').click();
    await expect(page.locator('#set-name-modal')).toBeVisible();
    await page.locator('#set-name-ok-btn').click();
    await expect(page.locator('#set-name-modal')).toBeHidden();
    const setBefore = (await localStorageSets(page))[0];
    expect(setBefore).toBeTruthy();
    await page.evaluate(() => window.__historyManagerForTests.clear());

    await deleteSceneByName(page, 'fixture-b');
    // The saved set's own record is untouched (U6 never touches
    // localStorage) -- it just can no longer be *opened* until the scene
    // it references comes back.
    expect(await localStorageSets(page)).toEqual([setBefore]);
    await page.locator('.compare-set-item .cset-btn-open').click();
    await expect(page.locator('#toast')).toHaveText('シーンが見つかりません（削除済みかもしれません）');
    await expect(page.locator('#compare-container')).toBeHidden(); // did not open

    await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(await localStorageSets(page)).toEqual([setBefore]); // same id/name/config throughout
    await page.locator('.compare-set-item .cset-btn-open').click();
    // fixture-b's id resolves again -- the compare view actually opens
    // this time, proving the reference is valid again (not just inferred
    // from the absence of a toast, which can't distinguish "succeeded"
    // from "the previous failure toast just hasn't timed out yet").
    await expect(page.locator('#compare-container')).toBeVisible();

    expectNoErrors(errors);
  });

  test('a new delete after undo clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page, [FIXTURE_A, FIXTURE_B, FIXTURE_C]);

    await deleteSceneByName(page, 'fixture-b');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-b', 'fixture-c']);

    await deleteSceneByName(page, 'fixture-c'); // a different delete
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-b']);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(false); // the old redo entry is gone, not just uncounted
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-b']); // unchanged

    expectNoErrors(errors);
  });

  // Deleting the LAST remaining scene wipes the whole project (floorplans/
  // markers/groups too, via clearAllAndShowUpload()) -- a full project
  // reset, the same "intentionally out of Undo/Redo scope" category as
  // Import/Export (see HistoryManager's own class comment in script.js).
  // Confirms this pre-existing, deliberately-untracked path is unaffected
  // by U6.
  test('deleting the last remaining scene wipes the project and does not push a history entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page, [FIXTURE_A]);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await deleteSceneByName(page, 'fixture-a');

    await expect(page.locator('#upload-section')).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('Viewer mode: the delete button is hidden and deleteScene itself still blocks a bypassed click', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page, [FIXTURE_A, FIXTURE_B]);

    // Editor -> Viewer while clean (no edit made yet) needs no confirmation.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);

    await expect(sceneItem(page, 'fixture-a').locator('.scene-delete-btn')).toBeHidden();

    // Hidden-element bypass: dispatchEvent fires the button's own click
    // handler directly (display:none rules out a real/forced Playwright
    // click, same pattern as U1-U3's F-category bypass tests) --
    // assertEditorMode() inside deleteScene() must still block the
    // mutation even when the CSS gate is defeated.
    await sceneItem(page, 'fixture-a').locator('.scene-delete-btn').dispatchEvent('click');
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(sceneNames(page)).resolves.toEqual(['fixture-a', 'fixture-b']);

    expectNoErrors(errors);
  });
});
