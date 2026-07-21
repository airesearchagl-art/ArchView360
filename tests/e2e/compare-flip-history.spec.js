// Coverage for compare-mode left-right flip (toggleFlipCompare(), the
// #flip-a-btn/#flip-b-btn buttons) wired into the same HistoryManager
// stack as the single-view flip (see scene-flip-history.spec.js) and
// scene renaming. flipH lives on the scene itself (scenes[i].flipH), not
// on the compare slot, so the history target is always a sceneId — this
// spec exercises that model directly, including a scene shown in both
// compare slots at once and returning to single view afterward.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');

function flipBtn(page)  { return page.locator('#flip-btn'); }
function flipABtn(page) { return page.locator('#flip-a-btn'); }
function flipBBtn(page) { return page.locator('#flip-b-btn'); }

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

// Loading both fixtures into an empty project in one go always leaves
// currentIdx at 0 ("fixture-a") — see handleFiles()'s wasEmpty branch.
async function loadTwoScenes(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
}

async function enterSplit(page) {
  await page.locator('#split-compare-btn').click();
}

// Assigns a specific scene (by its fixture-derived name) to a compare
// slot via the real picker dropdown, so tests never depend on
// enterSplitMode()'s default index guesses.
async function pickCompareScene(page, side, sceneName) {
  await page.locator(`#picker-btn-${side}`).click();
  await page.locator('.picker-item').filter({ hasText: sceneName }).click();
}

test.describe('compare-mode flip history (undo/redo)', () => {
  test('flipping compare slot A pushes one history entry, marks dirty, and toggles only the A button', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenes(page);
    await enterSplit(page);
    await pickCompareScene(page, 'a', 'fixture-a');
    await pickCompareScene(page, 'b', 'fixture-b');
    await expect(dirtyIndicator(page)).toBeHidden();
    await expect(flipABtn(page)).not.toHaveClass(/active/);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await flipABtn(page).click();

    await expect(flipABtn(page)).toHaveClass(/active/);
    await expect(flipBBtn(page)).not.toHaveClass(/active/); // slot B untouched
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('flipping compare slot B pushes one history entry, marks dirty, and toggles only the B button', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenes(page);
    await enterSplit(page);
    await pickCompareScene(page, 'a', 'fixture-a');
    await pickCompareScene(page, 'b', 'fixture-b');

    await flipBBtn(page).click();

    await expect(flipBBtn(page)).toHaveClass(/active/);
    await expect(flipABtn(page)).not.toHaveClass(/active/); // slot A untouched
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('undo restores the pre-flip compare state and stays dirty; redo re-flips and stays dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenes(page);
    await enterSplit(page);
    await pickCompareScene(page, 'a', 'fixture-a');
    await pickCompareScene(page, 'b', 'fixture-b');
    await flipABtn(page).click();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    await expect(flipABtn(page)).not.toHaveClass(/active/);
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });

    await page.evaluate(() => window.__historyManagerForTests.redo());
    await expect(flipABtn(page)).toHaveClass(/active/);
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('the same scene shown in both compare slots stays in sync no matter which flip button is used', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenes(page);
    await enterSplit(page);
    await pickCompareScene(page, 'a', 'fixture-a');
    await pickCompareScene(page, 'b', 'fixture-a'); // same scene in both slots

    await expect(flipABtn(page)).not.toHaveClass(/active/);
    await expect(flipBBtn(page)).not.toHaveClass(/active/);

    await flipABtn(page).click(); // toggles the one shared scene's flipH
    await expect(flipABtn(page)).toHaveClass(/active/);
    await expect(flipBBtn(page)).toHaveClass(/active/); // both reflect the same scene
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    await expect(flipABtn(page)).not.toHaveClass(/active/);
    await expect(flipBBtn(page)).not.toHaveClass(/active/); // both revert together

    expectNoErrors(errors);
  });

  test('returning to single view reflects a flip toggled while in compare mode', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenes(page); // currentIdx = 0 -> "fixture-a"
    await expect(flipBtn(page)).not.toHaveClass(/active/);

    await enterSplit(page);
    await pickCompareScene(page, 'a', 'fixture-a'); // same scene as the single view's currentIdx
    await pickCompareScene(page, 'b', 'fixture-b');
    await flipABtn(page).click();

    await page.locator('#exit-compare-btn').click();
    await expect(flipBtn(page)).toHaveClass(/active/); // single view now reflects it

    expectNoErrors(errors);
  });

  test('Viewer mode: compare flip buttons are hidden and inert', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenes(page);
    await enterSplit(page);
    await pickCompareScene(page, 'a', 'fixture-a');
    await pickCompareScene(page, 'b', 'fixture-b');
    await expect(dirtyIndicator(page)).toBeHidden(); // nothing done yet -> switching needs no confirmation

    await page.locator('#app-mode-toggle-btn').click({ force: true }); // -> Viewer
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await expect(flipABtn(page)).toBeHidden();
    await expect(flipBBtn(page)).toBeHidden();

    await page.locator('#app-mode-toggle-btn').click({ force: true }); // -> Editor
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('a new compare flip after undo clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenes(page);
    await enterSplit(page);
    await pickCompareScene(page, 'a', 'fixture-a');
    await pickCompareScene(page, 'b', 'fixture-b');

    await flipABtn(page).click();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });

    await flipBBtn(page).click(); // a fresh compare flip, not a redo
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 }); // redo branch invalidated

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(false);
    await expect(flipABtn(page)).not.toHaveClass(/active/); // unchanged by the no-op redo

    expectNoErrors(errors);
  });
});
