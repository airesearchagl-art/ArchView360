// Coverage for U9 (docs/UndoRedo_Expansion_Implementation_Plan.md U9:
// 比較セット) — the fourth Undo/Redo対象拡張 implementation unit: saving,
// deleting, and renaming a compare set (#save-set-btn, each set's rename/
// delete buttons in the FloorMap... no — the compare-sets sidebar list,
// #compare-sets-list). Unlike U1-U3 (a single in-memory entity's
// property), compare sets are a "HistoryManager外ストレージ整合型"
// (docs/UndoRedo_Expansion_Implementation_Plan.md 3.4節): the only
// persistent state is localStorage (LS_COMPARE_SETS = 'archview360.
// compareSets') — there is no separate in-memory array to fall out of
// sync, since every read goes through _loadCompareSets(). Every assertion
// below therefore checks both the raw localStorage content and the
// rendered sidebar list, not just one or the other.
//
// Same shape as marker-attrs-history.spec.js / floormap-orientation-
// history.spec.js / marker-order-swap-history.spec.js: drives the app's
// own historyManager instance via window.__historyManagerForTests rather
// than through the Undo/Redo buttons themselves.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const LS_KEY = 'archview360.compareSets';
const DEFAULT_NAME = 'fixture-a vs fixture-b';

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

// Test-only reset of just the history stacks (HistoryManager.clear()) --
// does not touch compareSets/localStorage/UI state at all, only lets a
// test start counting push()es from zero after some unrelated setup step
// (e.g. an initial save used only to have something to delete/rename).
async function clearHistory(page) {
  await page.evaluate(() => window.__historyManagerForTests.clear());
}

function csetNames(page) {
  return page.locator('#compare-sets-list .cset-name').allTextContents();
}

async function localStorageSets(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), LS_KEY);
}

// Asserts the rendered sidebar list and the raw localStorage content agree
// on exactly which set names exist, in order -- the core "3.4節" integrity
// requirement (メモリ上の比較セット状態 / localStorage / 一覧UI, collapsed
// here to localStorage+UI since there is no separate in-memory array).
async function expectSetsConsistent(page, expectedNames) {
  await expect(csetNames(page)).resolves.toEqual(expectedNames);
  const stored = await localStorageSets(page);
  expect(stored.map(s => s.name)).toEqual(expectedNames);
}

async function loadTwoScenesInSplit(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
  await page.locator('#split-compare-btn').click();
  await page.locator('#picker-btn-a').click();
  await page.locator('.picker-item').filter({ hasText: 'fixture-a' }).click();
  await page.locator('#picker-btn-b').click();
  await page.locator('.picker-item').filter({ hasText: 'fixture-b' }).click();
}

async function saveCompareSet(page, name) {
  await page.locator('#save-set-btn').click();
  await expect(page.locator('#set-name-modal')).toBeVisible();
  if (name !== undefined) {
    await page.locator('#set-name-input').fill(name);
  }
  await page.locator('#set-name-ok-btn').click();
  await expect(page.locator('#set-name-modal')).toBeHidden();
}

function csetItem(page, name) {
  return page.locator('#compare-sets-list .compare-set-item').filter({ hasText: name });
}

async function renameCsetTo(page, currentName, newName) {
  await csetItem(page, currentName).locator('button', { hasText: '✏' }).click();
  await expect(page.locator('#set-name-modal')).toBeVisible();
  await page.locator('#set-name-input').fill(newName);
  await page.locator('#set-name-ok-btn').click();
  await expect(page.locator('#set-name-modal')).toBeHidden();
}

async function deleteCset(page, name) {
  await csetItem(page, name).locator('.cset-btn-del').click();
}

// compareState.activeSetId (required fix, Review Agent #4889199582 on
// PR #48): no DOM-observable proxy exists that can distinguish "correctly
// cleared to null" from "still dangling on a since-removed id" at every
// point in an undo/redo cycle -- immediately after an undo that removes
// the set activeSetId pointed at, the .active CSS class has nothing to
// attach to in the rendered list either way, whether or not the reference
// itself was actually restored/cleared correctly. window.
// __activeCompareSetIdForTests() is the getter added for exactly this
// (never read by production code, same rule as
// window.__historyManagerForTests).
async function activeSetIdRaw(page) {
  return page.evaluate(() => window.__activeCompareSetIdForTests());
}

function activeCsetNames(page) {
  return page.locator('#compare-sets-list .compare-set-item.active .cset-name').allTextContents();
}

// Cross-checks the in-memory activeSetId reference against both the
// rendered "active" indicator and the actual id stored for `expectedName`
// in localStorage -- the 3-way (memory/localStorage/UI) consistency the
// required fix asks for. Pass null for "nothing is active" -- strictly
// requiring activeSetId === null, not merely "points at something absent
// from storage", so this fails against the pre-fix dangling-reference bug
// instead of silently tolerating it.
async function expectActiveSet(page, expectedName) {
  const rawId = await activeSetIdRaw(page);
  if (expectedName === null) {
    expect(rawId).toBeNull();
    await expect(activeCsetNames(page)).resolves.toEqual([]);
  } else {
    const stored = await localStorageSets(page);
    const expected = stored.find(s => s.name === expectedName);
    expect(expected).toBeTruthy();
    expect(rawId).toBe(expected.id);
    await expect(activeCsetNames(page)).resolves.toEqual([expectedName]);
  }
}

test.describe('Compare set history (undo/redo)', () => {
  test('saving a new compare set pushes one history entry, marks dirty, and is consistent in localStorage and the UI', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenesInSplit(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeHidden(); // entering split/picking scenes never dirties

    await saveCompareSet(page); // uses the default name

    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeVisible();
    await expectSetsConsistent(page, [DEFAULT_NAME]);

    expectNoErrors(errors);
  });

  test('undo removes the newly saved set (localStorage + UI both empty) and redo restores it exactly', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenesInSplit(page);
    await saveCompareSet(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    const afterSave = await localStorageSets(page);
    expect(afterSave).toHaveLength(1);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expect(dirtyIndicator(page)).toBeVisible(); // undo never auto-cleans
    await expectSetsConsistent(page, []);
    await expect(page.locator('#compare-sets-empty')).toBeVisible();

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expectSetsConsistent(page, [DEFAULT_NAME]);
    // The redo-restored set is byte-identical to what save originally
    // produced (same id/createdAt/scene refs), not just same-named.
    const afterRedo = await localStorageSets(page);
    expect(afterRedo).toEqual(afterSave);

    expectNoErrors(errors);
  });

  // Required fix (Review Agent #4889199582 on PR #48), failure scenario 1:
  // "新規set保存 → activeSetId=newSet.id → Undo → setは消えるがactiveSetId
  // が存在しないsetを指す". saveCurrentCompareSet() sets
  // compareState.activeSetId = newSet.id as part of the live save; that
  // in-memory reference must travel with the array snapshot through
  // undo/redo or it dangles once undo removes the set it points at.
  test('undo after a new save does not leave activeSetId pointing at the removed set, and redo restores the correct active set', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenesInSplit(page);
    await expectActiveSet(page, null); // nothing saved yet

    await saveCompareSet(page);
    await expectActiveSet(page, DEFAULT_NAME);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expectSetsConsistent(page, []);
    await expectActiveSet(page, null); // not just null-or-dangling -- strictly null

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    await expectSetsConsistent(page, [DEFAULT_NAME]);
    await expectActiveSet(page, DEFAULT_NAME);

    expectNoErrors(errors);
  });

  test('deleting a compare set pushes one history entry; undo restores it exactly and redo re-deletes it', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenesInSplit(page);
    await saveCompareSet(page);
    await clearHistory(page); // only the delete below should be counted
    const beforeDelete = await localStorageSets(page);

    await deleteCset(page, DEFAULT_NAME);

    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expectSetsConsistent(page, []);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expectSetsConsistent(page, [DEFAULT_NAME]);
    expect(await localStorageSets(page)).toEqual(beforeDelete); // same id/name/config restored

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expectSetsConsistent(page, []);

    expectNoErrors(errors);
  });

  // Required fix (Review Agent #4889199582 on PR #48), failure scenario 2:
  // "active set削除 → activeSetId=null → Undo → setは復元されるがactive
  // 状態が復元されない". deleteCompareSet() clears
  // compareState.activeSetId to null when the deleted set was the active
  // one; that clearing (and its previous value) must travel with the
  // array snapshot through undo/redo, or undo restores the set's data but
  // not its active identity.
  test('undo after deleting the active set restores both the set and its active indicator; redo re-deletes it and clears active again', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenesInSplit(page);
    await saveCompareSet(page); // the just-saved set is active (DEFAULT_NAME)
    await clearHistory(page);
    await expectActiveSet(page, DEFAULT_NAME);

    await deleteCset(page, DEFAULT_NAME);
    await expectSetsConsistent(page, []);
    await expectActiveSet(page, null);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    await expectSetsConsistent(page, [DEFAULT_NAME]);
    await expectActiveSet(page, DEFAULT_NAME); // both the set AND its active identity return

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    await expectSetsConsistent(page, []);
    await expectActiveSet(page, null); // re-deleted, and active clears consistently again

    expectNoErrors(errors);
  });

  test('renaming a compare set pushes one history entry; undo restores the old name and redo re-applies the new one', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenesInSplit(page);
    await saveCompareSet(page);
    await clearHistory(page);

    await renameCsetTo(page, DEFAULT_NAME, 'リフォーム前後比較');

    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expectSetsConsistent(page, ['リフォーム前後比較']);

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expectSetsConsistent(page, [DEFAULT_NAME]);

    const redoResult = await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(redoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expectSetsConsistent(page, ['リフォーム前後比較']);

    expectNoErrors(errors);
  });

  test('renaming to the same name does not push a history entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenesInSplit(page);
    await saveCompareSet(page);
    await clearHistory(page);
    const dirtyBeforeRename = await dirtyIndicator(page).isVisible();

    await renameCsetTo(page, DEFAULT_NAME, DEFAULT_NAME);

    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    expect(await dirtyIndicator(page).isVisible()).toBe(dirtyBeforeRename); // no further change
    await expectSetsConsistent(page, [DEFAULT_NAME]);

    expectNoErrors(errors);
  });

  test('a new save after undo clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenesInSplit(page);
    await saveCompareSet(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    const undoResult = await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(undoResult).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });
    await expectSetsConsistent(page, []);

    await saveCompareSet(page, '別の比較セット');
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });
    await expectSetsConsistent(page, ['別の比較セット']);

    expectNoErrors(errors);
  });

  test('Viewer mode: rename/delete controls are hidden and the underlying functions stay blocked; the saved set is untouched', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenesInSplit(page);
    await saveCompareSet(page);
    const savedSets = await localStorageSets(page);

    // Editor -> Viewer while dirty (the save above) shows the unsaved-
    // changes confirmation; continue without saving to switch.
    await page.locator('#app-mode-toggle-btn').click({ force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    const historyBeforeBypass = await historyCounts(page);

    // rename (✏) / delete (×) are `.editor-only` (CSS-hidden in Viewer)
    await expect(csetItem(page, DEFAULT_NAME).locator('button', { hasText: '✏' })).toBeHidden();
    await expect(csetItem(page, DEFAULT_NAME).locator('.cset-btn-del')).toBeHidden();

    // Hidden-element bypass: dispatchEvent fires the button's own click
    // handler directly (display:none rules out a real/forced Playwright
    // click, same pattern as U1/U2's F-category bypass tests) --
    // assertEditorMode() inside deleteCompareSet()/renameCompareSet() must
    // still block the mutation even when the CSS gate is defeated.
    await csetItem(page, DEFAULT_NAME).locator('.cset-btn-del').dispatchEvent('click');
    expect(await historyCounts(page)).toEqual(historyBeforeBypass);
    await expectSetsConsistent(page, [DEFAULT_NAME]);
    expect(await localStorageSets(page)).toEqual(savedSets);

    expectNoErrors(errors);
  });
});
