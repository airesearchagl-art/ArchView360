// Coverage for the second real editing operation wired into HistoryManager
// (see script.js's applySceneFlip()): toggling the single-view left-right
// flip. Mirrors scene-rename-history.spec.js's approach — driving the app's
// own historyManager instance via window.__historyManagerForTests (there is
// still no Undo/Redo history-list UI), but exercising the actual flip
// button/state since one already exists. The compare-mode flip
// (toggleFlipCompare(), #flip-a-btn/#flip-b-btn) is a separate, still-
// unconnected operation and is not touched by this spec.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');

function flipBtn(page) {
  return page.locator('#flip-btn');
}

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

async function loadOneScene(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles(FIXTURE_A); // empty -> clean, 1 scene
}

test.describe('scene flip history (undo/redo)', () => {
  test('flipping the current scene pushes one history entry, marks dirty, and toggles the flip button', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await expect(dirtyIndicator(page)).toBeHidden();
    await expect(flipBtn(page)).not.toHaveClass(/active/);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await flipBtn(page).click();

    await expect(flipBtn(page)).toHaveClass(/active/);
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('undo restores the pre-flip state and stays dirty; redo re-flips and stays dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await flipBtn(page).click();
    await expect(flipBtn(page)).toHaveClass(/active/);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    await expect(flipBtn(page)).not.toHaveClass(/active/);
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });

    await page.evaluate(() => window.__historyManagerForTests.redo());
    await expect(flipBtn(page)).toHaveClass(/active/);
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('Viewer mode: flip is inert via both the button and the M shortcut, and never touches history', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await expect(dirtyIndicator(page)).toBeHidden(); // nothing done yet -> switching needs no confirmation

    await page.locator('#app-mode-toggle-btn').click({ force: true }); // -> Viewer
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await expect(flipBtn(page)).toBeHidden(); // editor-only

    await page.keyboard.press('m'); // pre-existing shortcut; toggleFlipSingle() internally blocks non-Editor mode
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeHidden();

    await page.locator('#app-mode-toggle-btn').click({ force: true }); // -> Editor (never dirty-gated)
    await expect(flipBtn(page)).not.toHaveClass(/active/); // state was never touched while in Viewer

    expectNoErrors(errors);
  });

  test('a new flip after undo clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);

    await flipBtn(page).click(); // flip on
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo()); // back to off
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });

    await flipBtn(page).click(); // flip on again -> a fresh push, not a redo
    await expect(flipBtn(page)).toHaveClass(/active/);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 }); // redo branch invalidated

    // The invalidated redo entry must actually be gone, not just uncounted.
    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(false);
    await expect(flipBtn(page)).toHaveClass(/active/); // unchanged by the no-op redo

    expectNoErrors(errors);
  });
});
