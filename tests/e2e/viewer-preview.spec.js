// Coverage for Viewer Preview (Phase 1): lets Editor temporarily see the
// project through the real, unmodified Viewer mode (same appMode value,
// same assertEditorMode()/canMutateProject() guards, same editor-only CSS)
// without going through the normal Editor<->Viewer toggle's
// confirmUnsavedChanges('switch-to-viewer') dialog. previewActive is a
// separate session-local flag layered on top of appMode — there is no
// third appMode value (see script.js's startViewerPreview()/
// exitViewerPreview()/enterEditorMode()).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');

function previewStartBtn(page) { return page.locator('#viewer-preview-btn'); }
function previewExitBtn(page)  { return page.locator('#viewer-preview-exit-btn'); }
function toggleBtn(page)       { return page.locator('#app-mode-toggle-btn'); }

async function loadOneScene(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles(FIXTURE_A); // empty -> clean, 1 scene
}

async function loadTwoScenes(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
}

test.describe('Viewer Preview (Phase 1)', () => {
  test('1/2. Editor can start Preview, and editor-only UI is hidden while previewing', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(page.locator('#add-scene-btn')).toBeVisible(); // editor-only, sanity check

    await previewStartBtn(page).click();

    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await expect(page.locator('body')).toHaveClass(/preview-active/);
    await expect(page.locator('#add-scene-btn')).toBeHidden(); // editor-only, hidden like real Viewer
    await expect(toggleBtn(page)).toBeHidden(); // the normal toggle must not be usable during Preview
    await expect(previewExitBtn(page)).toBeVisible();

    expectNoErrors(errors);
  });

  test('3. Editing operations cannot run during Preview', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await previewStartBtn(page).click();

    const nameEl = page.locator('.scene-name').first();
    await nameEl.dblclick();
    await expect(nameEl).not.toHaveAttribute('contenteditable', 'true'); // canMutateProject() blocks it, same as real Viewer
    await expect(nameEl).toHaveText('fixture-a');

    expectNoErrors(errors);
  });

  test('4. Undo/Redo cannot run during Preview', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);

    // Create one history entry in Editor first, then preview.
    const nameEl = page.locator('.scene-name').first();
    await nameEl.dblclick();
    await page.keyboard.type('Renamed');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.__historyManagerForTests.undoCount)).toBe(1);

    await previewStartBtn(page).click();

    await expect(page.locator('#undo-btn')).toBeHidden(); // editor-only
    await expect(page.locator('#redo-btn')).toBeHidden();
    await page.keyboard.down('Control');
    await page.keyboard.press('z');
    await page.keyboard.up('Control');
    expect(await page.evaluate(() => window.__historyManagerForTests.undoCount)).toBe(1); // unchanged — the shortcut must not run

    expectNoErrors(errors);
  });

  test('5. Export cannot run during Preview', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await previewStartBtn(page).click();

    await expect(page.locator('#export-json-btn')).toBeHidden(); // editor-only
    await expect(page.locator('#export-package-btn')).toBeHidden();

    expectNoErrors(errors);
  });

  test('6. Exiting Preview returns to the Editor UI', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await previewStartBtn(page).click();
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);

    await previewExitBtn(page).click();

    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(page.locator('body')).not.toHaveClass(/preview-active/);
    await expect(page.locator('#add-scene-btn')).toBeVisible();
    await expect(toggleBtn(page)).toBeVisible();
    await expect(previewExitBtn(page)).toBeHidden();

    expectNoErrors(errors);
  });

  test('7. Preview start/exit does not change a clean Dirty State', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await expect(dirtyIndicator(page)).toBeHidden();

    await previewStartBtn(page).click();
    await expect(dirtyIndicator(page)).toBeHidden();
    await previewExitBtn(page).click();
    await expect(dirtyIndicator(page)).toBeHidden();

    expectNoErrors(errors);
  });

  test('8. Preview start/exit works with no confirmation dialog while dirty, and stays dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);

    const nameEl = page.locator('.scene-name').first();
    await nameEl.dblclick();
    await page.keyboard.type('Renamed');
    await page.keyboard.press('Enter');
    await expect(dirtyIndicator(page)).toBeVisible();

    await previewStartBtn(page).click();
    await expect(page.locator('#dirty-confirm-modal')).toBeHidden(); // no confirm dialog on Preview entry
    await expect(dirtyIndicator(page)).toBeVisible();

    await previewExitBtn(page).click();
    await expect(page.locator('#dirty-confirm-modal')).toBeHidden(); // no confirm dialog on Preview exit
    await expect(dirtyIndicator(page)).toBeVisible(); // still dirty — Preview never touches Dirty State

    expectNoErrors(errors);
  });

  test('9. Current scene and camera zoom are preserved across a Preview round-trip', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenes(page); // currentIdx = 0 -> "fixture-a"
    await page.locator('.scene-item').nth(1).click(); // switch to "fixture-b"
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');

    await page.locator('#viewer-canvas').hover();
    await page.mouse.wheel(0, 300); // zoom, changes camera.fov
    const fovBeforePreview = await page.evaluate(() => window.__viewerPreviewTestHooks.getCameraFov());

    await previewStartBtn(page).click();
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b'); // unchanged while previewing
    await previewExitBtn(page).click();

    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');
    const fovAfterPreview = await page.evaluate(() => window.__viewerPreviewTestHooks.getCameraFov());
    expect(fovAfterPreview).toBe(fovBeforePreview);

    expectNoErrors(errors);
  });

  test('10. Compare mode and slider position are preserved across a Preview round-trip', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenes(page);
    await page.locator('#split-compare-btn').click();
    await page.locator('#picker-btn-a').click();
    await page.locator('.picker-item').filter({ hasText: 'fixture-a' }).click();
    await page.locator('#picker-btn-b').click();
    await page.locator('.picker-item').filter({ hasText: 'fixture-b' }).click();

    await previewStartBtn(page).click();
    await previewExitBtn(page).click();

    // Split compare mode and its A/B assignment survive the round-trip.
    await expect(page.locator('#flip-a-btn')).toBeVisible();
    await expect(page.locator('#flip-b-btn')).toBeVisible();

    // Slider position: switch to slider mode (already in compare mode, so
    // this uses the compare toolbar's own switch button, not
    // #slider-compare-btn which only lives in the normal toolbar), then
    // round-trip Preview.
    await page.locator('#switch-to-slider-btn').click();
    const sliderBefore = await page.locator('#slider-divider').evaluate((el) => el.style.left);

    await previewStartBtn(page).click();
    await previewExitBtn(page).click();

    const sliderAfter = await page.locator('#slider-divider').evaluate((el) => el.style.left);
    expect(sliderAfter).toBe(sliderBefore);

    expectNoErrors(errors);
  });

  test('11. Normal Viewer Mode toggle behavior is unchanged by Preview', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);

    // A real Editor -> Viewer switch (not Preview) still shows the normal
    // toggle label/flow and is unaffected by previewActive ever having
    // existed as a concept.
    await toggleBtn(page).click();
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await expect(page.locator('body')).not.toHaveClass(/preview-active/);
    await expect(previewExitBtn(page)).toBeHidden();

    await toggleBtn(page).click();
    await expect(page.locator('body')).toHaveClass(/mode-editor/);

    expectNoErrors(errors);
  });

  test('12. Starting Preview is rejected while a VR session is active', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await page.evaluate(() => window.__viewerPreviewTestHooks.setInVrSession(true));

    await previewStartBtn(page).click();

    // previewActive/inVrSession are observable through the DOM already
    // (see the body/vr-btn classes renderModeUi()/updateVrBtn() maintain),
    // so no dedicated JS getters are exposed for them — kept the test hook
    // to only what has no DOM equivalent (see script.js's own comment).
    await expect(page.locator('body')).not.toHaveClass(/preview-active/);
    await expect(page.locator('body')).toHaveClass(/mode-editor/); // never switched

    await page.evaluate(() => window.__viewerPreviewTestHooks.setInVrSession(false)); // reset

    expectNoErrors(errors);
  });

  test('13. Starting VR is rejected while Preview is active', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await previewStartBtn(page).click();
    await expect(page.locator('body')).toHaveClass(/preview-active/);

    // Real WebXR sessions cannot be created in this headless environment
    // (see the test hook's own comment in script.js), so vr-btn stays
    // disabled regardless of Preview. Force it enabled and call the real
    // enterVr() directly to exercise the previewActive guard itself.
    await page.evaluate(() => { document.getElementById('vr-btn').disabled = false; });
    await page.evaluate(() => window.__viewerPreviewTestHooks.enterVr());

    await expect(page.locator('#vr-btn')).not.toHaveClass(/active/); // inVrSession stayed false

    expectNoErrors(errors);
  });

  test('14. previewActive clears no matter which path returns to Editor', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);
    await previewStartBtn(page).click();
    await expect(page.locator('body')).toHaveClass(/preview-active/);

    // The normal toggle button is display:none during Preview (see test 1)
    // — Playwright can't click a display:none element even with
    // force:true, so this exercises the same "hidden DOM element,
    // programmatic call" bypass pattern PR #13 used for its own mutation
    // -guard regression tests. enterEditorMode() itself — not just
    // exitViewerPreview() — must clear previewActive unconditionally, so
    // even this bypass must leave no stale Preview state behind.
    await page.evaluate(() => document.getElementById('app-mode-toggle-btn').click());

    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    await expect(page.locator('body')).not.toHaveClass(/preview-active/);
    await expect(previewExitBtn(page)).toBeHidden();
    await expect(toggleBtn(page)).toBeVisible();

    expectNoErrors(errors);
  });

  test('15. Exiting Preview never shows an unsaved-changes or access confirmation', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadOneScene(page);

    // Dirty first, so a "real" Editor<->Viewer switch would normally need
    // confirmUnsavedChanges('switch-to-viewer') — Preview exit must still
    // skip it entirely, since exitViewerPreview() calls enterEditorMode()
    // directly rather than requestEditorAccess() (see script.js).
    const nameEl = page.locator('.scene-name').first();
    await nameEl.dblclick();
    await page.keyboard.type('Renamed');
    await page.keyboard.press('Enter');
    await expect(dirtyIndicator(page)).toBeVisible();

    await previewStartBtn(page).click();
    await previewExitBtn(page).click();

    await expect(page.locator('body')).toHaveClass(/mode-editor/); // returned unconditionally
    await expect(page.locator('#dirty-confirm-modal')).toBeHidden();

    expectNoErrors(errors);
  });
});
