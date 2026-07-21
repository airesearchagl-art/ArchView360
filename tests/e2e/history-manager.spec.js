// Unit-style coverage for HistoryManager (script.js), the undo/redo stack
// foundation added for the Roadmap history feature. Nothing in the app
// wires an editing operation into this yet, so these tests exercise the
// class directly via page.evaluate() against window.HistoryManager rather
// than through any UI — there is no UI for it in this commit. This repo
// has no separate unit-test runner, so "unit test" here means running in
// the real browser environment script.js executes in, without touching the
// DOM.
const { test, expect } = require('@playwright/test');
const { gotoApp, expectNoErrors } = require('./helpers');

test.describe('HistoryManager (undo/redo foundation)', () => {
  test('push/undo/redo call the right closures in the right order', async ({ page }) => {
    const errors = await gotoApp(page);

    const result = await page.evaluate(() => {
      const hm = new window.HistoryManager();
      const log = [];
      hm.push({ label: 'a', undo: () => log.push('undo-a'), redo: () => log.push('redo-a') });
      hm.push({ label: 'b', undo: () => log.push('undo-b'), redo: () => log.push('redo-b') });

      const out = { initialCanUndo: hm.canUndo(), initialCanRedo: hm.canRedo(), initialUndoCount: hm.undoCount };

      hm.undo(); // undoes b
      out.afterFirstUndo = [...log];
      out.canRedoAfterUndo = hm.canRedo();

      hm.undo(); // undoes a
      out.afterSecondUndo = [...log];
      out.canUndoAfterBothUndone = hm.canUndo();

      hm.redo(); // redoes a
      out.afterFirstRedo = [...log];

      out.finalUndoCount = hm.undoCount;
      out.finalRedoCount = hm.redoCount;
      return out;
    });

    expect(result.initialCanUndo).toBe(true);
    expect(result.initialCanRedo).toBe(false);
    expect(result.initialUndoCount).toBe(2);
    expect(result.afterFirstUndo).toEqual(['undo-b']);
    expect(result.canRedoAfterUndo).toBe(true);
    expect(result.afterSecondUndo).toEqual(['undo-b', 'undo-a']);
    expect(result.canUndoAfterBothUndone).toBe(false);
    expect(result.afterFirstRedo).toEqual(['undo-b', 'undo-a', 'redo-a']);
    expect(result.finalUndoCount).toBe(1);
    expect(result.finalRedoCount).toBe(1);

    expectNoErrors(errors);
  });

  test('pushing a new action clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);

    const result = await page.evaluate(() => {
      const hm = new window.HistoryManager();
      hm.push({ undo() {}, redo() {} });
      hm.push({ undo() {}, redo() {} });
      hm.undo();
      const canRedoBefore = hm.canRedo();
      hm.push({ undo() {}, redo() {} }); // new action invalidates the redone-away branch
      return { canRedoBefore, canRedoAfter: hm.canRedo(), undoCountAfter: hm.undoCount };
    });

    expect(result.canRedoBefore).toBe(true);
    expect(result.canRedoAfter).toBe(false);
    expect(result.undoCountAfter).toBe(2);

    expectNoErrors(errors);
  });

  test('undo()/redo() are no-ops returning false on an empty stack', async ({ page }) => {
    const errors = await gotoApp(page);

    const result = await page.evaluate(() => {
      const hm = new window.HistoryManager();
      return { undoResult: hm.undo(), redoResult: hm.redo(), canUndo: hm.canUndo(), canRedo: hm.canRedo() };
    });

    expect(result.undoResult).toBe(false);
    expect(result.redoResult).toBe(false);
    expect(result.canUndo).toBe(false);
    expect(result.canRedo).toBe(false);

    expectNoErrors(errors);
  });

  test('the undo stack is capped at maxSize, dropping the oldest entry', async ({ page }) => {
    const errors = await gotoApp(page);

    const result = await page.evaluate(() => {
      const hm = new window.HistoryManager({ maxSize: 3 });
      const log = [];
      for (let i = 0; i < 5; i++) {
        hm.push({ label: `entry-${i}`, undo: () => log.push(`undo-${i}`), redo: () => log.push(`redo-${i}`) });
      }
      const undoCountAfterPushes = hm.undoCount;
      // Undo everything that's left; the two oldest (0 and 1) must be gone,
      // so only entries 2, 3, 4 should ever be undoable.
      while (hm.canUndo()) hm.undo();
      return { undoCountAfterPushes, undoOrder: log };
    });

    expect(result.undoCountAfterPushes).toBe(3);
    expect(result.undoOrder).toEqual(['undo-4', 'undo-3', 'undo-2']);

    expectNoErrors(errors);
  });

  test('clear() empties both stacks', async ({ page }) => {
    const errors = await gotoApp(page);

    const result = await page.evaluate(() => {
      const hm = new window.HistoryManager();
      hm.push({ undo() {}, redo() {} });
      hm.push({ undo() {}, redo() {} });
      hm.undo();
      hm.clear();
      return { canUndo: hm.canUndo(), canRedo: hm.canRedo(), undoCount: hm.undoCount, redoCount: hm.redoCount };
    });

    expect(result.canUndo).toBe(false);
    expect(result.canRedo).toBe(false);
    expect(result.undoCount).toBe(0);
    expect(result.redoCount).toBe(0);

    expectNoErrors(errors);
  });

  test('push() rejects entries missing undo/redo functions', async ({ page }) => {
    const errors = await gotoApp(page);

    const result = await page.evaluate(() => {
      const hm = new window.HistoryManager();
      const attempts = [
        () => hm.push(),
        () => hm.push({}),
        () => hm.push({ undo: () => {} }), // missing redo
        () => hm.push({ redo: () => {} }), // missing undo
      ];
      return attempts.map((fn) => {
        try { fn(); return 'no-throw'; } catch (e) { return e instanceof TypeError ? 'TypeError' : 'other-error'; }
      });
    });

    expect(result).toEqual(['TypeError', 'TypeError', 'TypeError', 'TypeError']);

    expectNoErrors(errors);
  });
});
