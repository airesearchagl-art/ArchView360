// WebGL context loss/restoration and the shared error-overlay "戻る" button
// are, in this codebase, the same single recovery mechanism (see
// initThree()'s webglcontextlost/webglcontextrestored listeners and
// clearAllAndShowUpload() in script.js) — there is no separate generic
// "error recovery" code path, so this one spec covers both instruction
// items. Dispatches the browser events directly on #viewer-canvas rather
// than forcing a real GPU context loss, which would be non-deterministic
// across environments; the handlers only read the event object's
// preventDefault(), so a plain synthetic Event exercises the same code.
//
// Current behavior (verified by reading initThree()/clearAllAndShowUpload()):
// context *restoration* clears all in-memory project data and returns to
// the upload screen — it does NOT keep scenes/floorplans around — but it
// deliberately does NOT clear the dirty flag, since the loss was involuntary,
// not a confirmed discard decision. This test asserts that actual behavior.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');

test.describe('WebGL context loss / restoration', () => {
  test('loss shows the error overlay without losing data; restoration clears data but keeps the dirty flag', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(FIXTURE_A);
    await fileInput.setInputFiles(FIXTURE_B); // additive -> dirty, 2 scenes
    await expect(dirtyIndicator(page)).toBeVisible();

    await page.locator('#viewer-canvas').dispatchEvent('webglcontextlost', { cancelable: true });
    await expect(page.locator('#error-overlay')).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('WebGLコンテキストが失われました');
    // Loss alone must not touch project data.
    await expect(page.locator('#viewer-layout')).toBeVisible();
    await expect(dirtyIndicator(page)).toBeVisible();

    // Dismissing the overlay while scenes still exist is UI-only — it must
    // not itself clear data (clearAllAndShowUpload() only runs here when
    // !scenes.length, which isn't the case yet).
    await page.click('#error-back-btn', { force: true });
    await expect(page.locator('#error-overlay')).toBeHidden();
    await expect(page.locator('#viewer-layout')).toBeVisible();
    await expect(page.locator('.scene-name')).toHaveCount(2);

    await page.locator('#viewer-canvas').dispatchEvent('webglcontextrestored');
    await expect(page.locator('#upload-section')).toBeVisible();
    await expect(page.locator('#viewer-layout')).toBeHidden();
    // Data is gone (current behavior — see file header), but the unsaved
    // flag survives so the user isn't misled into thinking it was saved.
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await page.title()).toMatch(/^\*/);

    expectNoErrors(errors);
  });
});
