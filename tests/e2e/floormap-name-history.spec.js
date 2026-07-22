// Coverage for the third real editing operation wired into HistoryManager
// (see script.js's applyFloorMapName()): renaming a FloorMap (floorplan).
// Mirrors scene-rename-history.spec.js's approach — driving the app's own
// historyManager instance via window.__historyManagerForTests (there is
// still no Undo/Redo history-list UI) rather than through any button.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');

function floorplanNameEl(page) {
  return page.locator('.floorplan-name').first();
}

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

// A scene must exist before the FloorMap toolbar (and #add-floorplan-btn)
// is even visible; the floorplan itself is named from its file, just like
// scenes are, so this yields one floorplan named "fixture-b".
async function loadSceneAndFloorplan(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles(FIXTURE_A);
  await page.locator('#add-floorplan-btn').click();
  await page.locator('#floorplan-input').setInputFiles(FIXTURE_B);
  await expect(floorplanNameEl(page)).toHaveText('fixture-b');
}

async function renameFloorplan(page, newName) {
  const nameEl = floorplanNameEl(page);
  await nameEl.dblclick();
  await page.keyboard.type(newName);
  await page.keyboard.press('Enter');
}

test.describe('FloorMap (floorplan) rename history (undo/redo)', () => {
  test('a real rename pushes one history entry, marks dirty, and updates the sidebar', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page);
    await expect(dirtyIndicator(page)).toBeVisible(); // adding the floorplan itself already dirtied the project
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await renameFloorplan(page, 'Renamed Floor');

    await expect(floorplanNameEl(page)).toHaveText('Renamed Floor');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('undo restores the old name and stays dirty; redo restores the new name and stays dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page);
    await renameFloorplan(page, 'Renamed Floor');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    await expect(floorplanNameEl(page)).toHaveText('fixture-b');
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });

    await page.evaluate(() => window.__historyManagerForTests.redo());
    await expect(floorplanNameEl(page)).toHaveText('Renamed Floor');
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('re-entering the same name does not push a history entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    // Enter edit mode and blur without changing the text.
    const nameEl = floorplanNameEl(page);
    await nameEl.dblclick();
    await page.keyboard.press('Enter');

    await expect(floorplanNameEl(page)).toHaveText('fixture-b');
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('a new rename after undo clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page);

    await renameFloorplan(page, 'First Name');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });

    await renameFloorplan(page, 'Second Name');
    await expect(floorplanNameEl(page)).toHaveText('Second Name');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 }); // redo branch invalidated

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(false);
    await expect(floorplanNameEl(page)).toHaveText('Second Name'); // unchanged by the no-op redo

    expectNoErrors(errors);
  });

  test('Viewer mode: FloorMap rename cannot be started and never touches history', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneAndFloorplan(page);

    // Editor -> Viewer while dirty (the floorplan add above) shows the
    // unsaved-changes confirmation; continue without saving to switch.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);

    const nameEl = floorplanNameEl(page);
    await nameEl.dblclick();
    await expect(nameEl).not.toHaveAttribute('contenteditable', 'true');
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(floorplanNameEl(page)).toHaveText('fixture-b'); // unchanged

    expectNoErrors(errors);
  });
});
