// Coverage for the first real editing operation wired into HistoryManager
// (see script.js's applySceneName()): renaming a scene. There is no Undo/Redo
// UI or keyboard shortcut in this app yet, so these tests drive the app's
// own historyManager instance directly via window.__historyManagerForTests
// (a test-only hook, distinct from the window.HistoryManager class exposed
// in an earlier commit) rather than through any button/shortcut.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');

function sceneNameEl(page) {
  return page.locator('.scene-name').first();
}

function currentSceneNameEl(page) {
  return page.locator('#current-scene-name');
}

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

async function renameActiveScene(page, newName) {
  const nameEl = sceneNameEl(page);
  await nameEl.dblclick();
  await page.keyboard.type(newName);
  await page.keyboard.press('Enter');
}

test.describe('scene rename history (undo/redo)', () => {
  test('a real rename pushes one history entry, marks dirty, and updates the DOM', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A); // empty -> clean, 1 scene named "fixture-a"
    await expect(dirtyIndicator(page)).toBeHidden();
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await renameActiveScene(page, 'Renamed Scene');

    await expect(sceneNameEl(page)).toHaveText('Renamed Scene');
    await expect(currentSceneNameEl(page)).toHaveText('Renamed Scene');
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('undo restores the old name and stays dirty; redo restores the new name and stays dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await renameActiveScene(page, 'Renamed Scene');
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    await expect(sceneNameEl(page)).toHaveText('fixture-a');
    await expect(currentSceneNameEl(page)).toHaveText('fixture-a');
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });

    await page.evaluate(() => window.__historyManagerForTests.redo());
    await expect(sceneNameEl(page)).toHaveText('Renamed Scene');
    await expect(currentSceneNameEl(page)).toHaveText('Renamed Scene');
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('re-entering the same name does not push a history entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(dirtyIndicator(page)).toBeHidden();

    // Enter edit mode and blur without changing the text.
    const nameEl = sceneNameEl(page);
    await nameEl.dblclick();
    await page.keyboard.press('Enter');

    await expect(sceneNameEl(page)).toHaveText('fixture-a');
    await expect(dirtyIndicator(page)).toBeHidden(); // no real change -> still clean
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('a new rename after undo clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);

    await renameActiveScene(page, 'First Name');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });

    await renameActiveScene(page, 'Second Name');
    await expect(sceneNameEl(page)).toHaveText('Second Name');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 }); // redo branch invalidated

    // The invalidated redo entry must actually be gone, not just uncounted.
    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(false);
    await expect(sceneNameEl(page)).toHaveText('Second Name'); // unchanged by the no-op redo

    expectNoErrors(errors);
  });
});
