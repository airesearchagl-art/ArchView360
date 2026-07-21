// Coverage for the minimal Undo/Redo UI (toolbar buttons) and keyboard
// shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) added on top of the
// HistoryManager foundation and the scene-rename wiring (see
// scene-rename-history.spec.js). Scene renaming is still the only
// operation registered on the history stack, so these tests drive it
// through the real buttons/shortcuts instead of window.__historyManagerForTests
// directly (that hook remains for lower-level HistoryManager coverage).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');

function sceneNameEl(page) {
  return page.locator('.scene-name').first();
}

function undoBtn(page) {
  return page.locator('#undo-btn');
}

function redoBtn(page) {
  return page.locator('#redo-btn');
}

async function loadOneScene(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles(FIXTURE_A); // 1 scene named "fixture-a"
}

async function renameActiveScene(page, newName) {
  const nameEl = sceneNameEl(page);
  await nameEl.dblclick();
  await page.keyboard.type(newName);
  await page.keyboard.press('Enter');
}

// modifier: 'control' or 'meta', matching Playwright's Keyboard.down() names.
async function pressUndoShortcut(page, modifier) {
  await page.keyboard.down(modifier);
  await page.keyboard.press('z');
  await page.keyboard.up(modifier);
}

async function pressRedoShortcut(page, modifier) {
  await page.keyboard.down(modifier);
  await page.keyboard.down('Shift');
  await page.keyboard.press('z');
  await page.keyboard.up('Shift');
  await page.keyboard.up(modifier);
}

test.describe('Undo/Redo controls (buttons + shortcuts)', () => {
  test('1. initial state: both Undo and Redo are disabled', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);

    await expect(undoBtn(page)).toBeDisabled();
    await expect(redoBtn(page)).toBeDisabled();

    expectNoErrors(errors);
  });

  test('2/4/16. Undo enables after a rename; Redo enables after Undo; a fresh rename disables Redo again', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);

    await renameActiveScene(page, 'Renamed Scene');
    await expect(undoBtn(page)).toBeEnabled(); // #2
    await expect(redoBtn(page)).toBeDisabled();

    await undoBtn(page).click();
    await expect(redoBtn(page)).toBeEnabled(); // #4
    await expect(sceneNameEl(page)).toHaveText('fixture-a');

    await renameActiveScene(page, 'Second Name'); // fresh rename after undo
    await expect(redoBtn(page)).toBeDisabled(); // #16
    await expect(undoBtn(page)).toBeEnabled();

    expectNoErrors(errors);
  });

  test('3/5. clicking Undo restores the old name; clicking Redo restores the new name', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await renameActiveScene(page, 'Renamed Scene');

    await undoBtn(page).click();
    await expect(sceneNameEl(page)).toHaveText('fixture-a'); // #3

    await redoBtn(page).click();
    await expect(sceneNameEl(page)).toHaveText('Renamed Scene'); // #5

    expectNoErrors(errors);
  });

  test('6/7. Ctrl+Z and a meta-key equivalent both undo', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);

    await renameActiveScene(page, 'Renamed Scene');
    await pressUndoShortcut(page, 'Control'); // #6
    await expect(sceneNameEl(page)).toHaveText('fixture-a');
    await expect(undoBtn(page)).toBeDisabled();

    await renameActiveScene(page, 'Second Name');
    await pressUndoShortcut(page, 'Meta'); // #7 (macOS Cmd equivalent)
    await expect(sceneNameEl(page)).toHaveText('fixture-a');

    expectNoErrors(errors);
  });

  test('8/9. Ctrl+Shift+Z and a meta-key equivalent both redo', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);

    await renameActiveScene(page, 'Renamed Scene');
    await pressUndoShortcut(page, 'Control');
    await pressRedoShortcut(page, 'Control'); // #8
    await expect(sceneNameEl(page)).toHaveText('Renamed Scene');
    await expect(redoBtn(page)).toBeDisabled();

    await pressUndoShortcut(page, 'Control');
    await pressRedoShortcut(page, 'Meta'); // #9 (macOS Cmd equivalent)
    await expect(sceneNameEl(page)).toHaveText('Renamed Scene');

    expectNoErrors(errors);
  });

  test('10. Ctrl+Z while a text input is focused does not undo', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await renameActiveScene(page, 'Renamed Scene');

    await page.locator('#project-info-btn').click();
    await page.locator('#pi-client').focus();
    await pressUndoShortcut(page, 'Control');
    await expect(sceneNameEl(page)).toHaveText('Renamed Scene'); // unchanged
    await expect(undoBtn(page)).toBeEnabled(); // history untouched

    expectNoErrors(errors);
  });

  test('11. Ctrl+Z while a textarea is focused does not undo', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await renameActiveScene(page, 'Renamed Scene');

    await page.locator('#project-info-btn').click();
    await page.locator('#pi-notes').focus();
    await pressUndoShortcut(page, 'Control');
    await expect(sceneNameEl(page)).toHaveText('Renamed Scene'); // unchanged
    await expect(undoBtn(page)).toBeEnabled();

    expectNoErrors(errors);
  });

  test('12. Ctrl+Z while renaming (contentEditable) does not hijack the field', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await renameActiveScene(page, 'Renamed Scene');

    // Re-enter rename edit mode (contentEditable) without committing.
    const nameEl = sceneNameEl(page);
    await nameEl.dblclick();
    await page.keyboard.type('mid-edit text');
    await pressUndoShortcut(page, 'Control'); // must not undo the earlier rename
    await expect(undoBtn(page)).toBeEnabled(); // history entry from the earlier rename is untouched
    await page.keyboard.press('Escape'); // revert this in-progress edit, don't commit it

    await expect(sceneNameEl(page)).toHaveText('Renamed Scene');

    expectNoErrors(errors);
  });

  test('13. Viewer mode: Undo/Redo buttons are hidden and the shortcut does not run', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await renameActiveScene(page, 'Renamed Scene');

    // Editor -> Viewer while dirty (the rename above) shows the unsaved-
    // changes confirmation; continue without saving to actually switch.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);

    await expect(undoBtn(page)).toBeHidden();
    await expect(redoBtn(page)).toBeHidden();

    await pressUndoShortcut(page, 'Control');
    await expect(sceneNameEl(page)).toHaveText('Renamed Scene'); // unchanged

    await page.locator('#app-mode-toggle-btn').click({ force: true }); // -> Editor (never dirty-gated)
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(undoBtn(page)).toBeEnabled(); // history was never touched while hidden

    expectNoErrors(errors);
  });

  test('14. Ctrl+Z with an empty history does not preventDefault (no console/page errors either)', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);

    await expect(undoBtn(page)).toBeDisabled();
    await pressUndoShortcut(page, 'Control'); // empty stack: must be a true no-op
    await expect(sceneNameEl(page)).toHaveText('fixture-a');
    await expect(undoBtn(page)).toBeDisabled();

    expectNoErrors(errors);
  });

  test('15. a repeated (held-key) Ctrl+Z event does not run twice', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await renameActiveScene(page, 'First');
    await renameActiveScene(page, 'Second');
    await renameActiveScene(page, 'Third');

    const undoCount = () => page.evaluate(() => window.__historyManagerForTests.undoCount);
    expect(await undoCount()).toBe(3);

    // Simulate the browser's key-repeat: dispatch a synthetic keydown with
    // repeat: true directly, since Playwright's keyboard API doesn't hold
    // keys long enough to trigger real OS-level auto-repeat.
    await page.evaluate(() => {
      const ev = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, repeat: true, bubbles: true, cancelable: true });
      document.dispatchEvent(ev);
    });
    expect(await undoCount()).toBe(3); // unchanged — the repeat event must be ignored

    // A real (non-repeat) Ctrl+Z afterward still works normally.
    await pressUndoShortcut(page, 'Control');
    expect(await undoCount()).toBe(2);
    await expect(sceneNameEl(page)).toHaveText('Second');

    expectNoErrors(errors);
  });

  test('17. Dirty State stays dirty after both a button Undo and a button Redo', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await renameActiveScene(page, 'Renamed Scene');
    await expect(dirtyIndicator(page)).toBeVisible();

    await undoBtn(page).click();
    await expect(dirtyIndicator(page)).toBeVisible();

    await redoBtn(page).click();
    await expect(dirtyIndicator(page)).toBeVisible();

    expectNoErrors(errors);
  });

  test('18/19. no pageerrors or console errors across a full undo/redo/shortcut cycle', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await renameActiveScene(page, 'Renamed Scene');
    await undoBtn(page).click();
    await redoBtn(page).click();
    await pressUndoShortcut(page, 'Control');
    await pressRedoShortcut(page, 'Control');

    expectNoErrors(errors); // asserts both pageErrors and consoleErrors are []
  });
});
