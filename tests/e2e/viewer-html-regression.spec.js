// Detailed regression coverage for viewer.html's Common-feature surface
// (PR-C, the "next development phase" recorded after PR #41's launch-level
// canary in viewer-html-minimal.spec.js). That file stays a minimal
// startup canary by design and is left untouched here; this file covers
// the Common features a Viewer session is actually expected to support —
// scene load/switch, compare modes, FloorMap, allowed viewing operations —
// and confirms Editor-only mutations stay blocked, including via
// hidden-element bypasses of DOM the CSS/static-HTML removal already hides.
//
// viewer.html has no Editor UI at all (no #app-mode-toggle-btn), so every
// test here starts from viewer.html's own default (Viewer) mode; none
// switches mode or uses `?mode=editor` (the Vault's ArchView360 decisions
// treat the URL as non-security, but that is not the same as exercising it
// as a mode switch inside these tests).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoViewerHtml, gotoApp, expectNoErrors, dirtyIndicator } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');

function sceneItems(page) {
  return page.locator('#scene-list .scene-item');
}

async function loadTwoScenes(page) {
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
  await expect(sceneItems(page)).toHaveCount(2);
}

test.describe('viewer.html: A. launch / basic state', () => {
  // viewer-html-minimal.spec.js already covers init()-completes-without-
  // throwing, starts-in-Viewer-mode, and the confirmed-49 absence check;
  // this adds the two Viewer-Preview ids, which are Common-classified DOM
  // (not part of the confirmed-49 set) but must still never be reachable
  // from viewer.html since there is no app-mode-toggle-btn to arm Preview.
  test('has no reachable Viewer-Preview affordance: viewer-preview-btn (confirmed-49) is absent, and viewer-preview-exit-btn (Common DOM, left in place per docs/ViewerEditor_Viewer_Html_Known_Gaps.md) stays hidden since Preview can never be armed without app-mode-toggle-btn', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await expect(page.locator('#viewer-preview-btn')).toHaveCount(0);
    await expect(page.locator('#viewer-preview-exit-btn')).toBeHidden();
    expectNoErrors(errors);
  });

  test('a fresh viewer.html session starts clean: dirty indicator is hidden before any scene is loaded', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });
});

test.describe('viewer.html: B. scene load / switch', () => {
  test('multiple scenes load into an empty project, the list shows all of them, and loading stays clean', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
    await expect(sceneItems(page)).toHaveCount(3);
    await expect(dirtyIndicator(page)).toBeHidden(); // opening into an empty project is a load, not an edit
    expectNoErrors(errors);
  });

  test('clicking a different scene in the list switches the current scene and updates the header name', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');

    await sceneItems(page).nth(1).click();
    await expect(sceneItems(page).nth(1)).toHaveClass(/active/);
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });

  test('ArrowRight/ArrowLeft cycle through scenes in single view', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
    await expect(sceneItems(page)).toHaveCount(3);
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-c');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');

    expectNoErrors(errors);
  });
});

test.describe('viewer.html: C. compare display', () => {
  test('split compare can be entered via the toolbar button (not just the "c" shortcut) and shows both panes', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await page.locator('#split-compare-btn').click();
    await expect(page.locator('#compare-container')).toBeVisible();
    await expect(page.locator('#compare-pane-a')).toBeVisible();
    await expect(page.locator('#compare-pane-b')).toBeVisible();
    await expect(page.locator('#compare-name-a')).toHaveText('fixture-a');
    await expect(page.locator('#compare-name-b')).toHaveText('fixture-b');
    expectNoErrors(errors);
  });

  test('sync-views ("l") toggles the sync button state in split mode', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await page.keyboard.press('c');
    await expect(page.locator('#compare-container')).toBeVisible();
    await expect(page.locator('#sync-btn')).toHaveClass(/active/); // syncViews defaults true on entry

    await page.keyboard.press('l');
    await expect(page.locator('#sync-btn')).not.toHaveClass(/active/);
    await page.keyboard.press('l');
    await expect(page.locator('#sync-btn')).toHaveClass(/active/);
    expectNoErrors(errors);
  });

  test('switching from split to slider compare keeps the A/B pair and updates the container mode class', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await page.locator('#split-compare-btn').click();
    await expect(page.locator('#compare-container')).not.toHaveClass(/slider-mode/);

    await page.locator('#switch-to-slider-btn').click();
    await expect(page.locator('#compare-container')).toHaveClass(/slider-mode/);
    await expect(page.locator('#compare-name-a')).toHaveText('fixture-a');
    await expect(page.locator('#compare-name-b')).toHaveText('fixture-b');
    expectNoErrors(errors);
  });

  test('dragging the slider handle moves the divider position', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await page.keyboard.press('s'); // slider compare shortcut
    await expect(page.locator('#compare-container')).toHaveClass(/slider-mode/);

    const before = await page.locator('#slider-divider').evaluate((el) => el.style.left);
    const box = await page.locator('#slider-divider').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + box.height / 2);
    await page.mouse.up();
    const after = await page.locator('#slider-divider').evaluate((el) => el.style.left);
    expect(after).not.toBe(before);

    expectNoErrors(errors);
  });

  test('exiting compare mode (Escape) returns to single view without dirtying the project', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await page.keyboard.press('c');
    await expect(page.locator('#compare-container')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#compare-container')).toBeHidden();
    await expect(page.locator('#viewer-canvas')).toBeVisible();
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });
});

test.describe('viewer.html: D. FloorMap (no Viewer-reachable creation path)', () => {
  // add-floorplan-btn is part of the confirmed-49 Editor-only set (already
  // removed and covered by viewer-html-minimal.spec.js's id check), and
  // handleFloorplanFiles() always calls assertEditorMode() regardless of
  // whether the project is empty (unlike handleFiles(), which allows a
  // first load into an empty project from Viewer). So unlike scenes, there
  // is no Viewer-reachable way to create a FloorMap at all — meaning an
  // "existing FloorMap/marker" state can never occur in a fresh viewer.html
  // session (the app has no cross-session persistence either; see
  // docs/ViewerEditor_Viewer_Html_Known_Gaps.md). These tests cover what
  // that constraint actually implies: the navigator never appears, and a
  // direct hidden-input bypass of the (already absent) add-floorplan
  // button is still blocked by handleFloorplanFiles()'s own guard.
  test('the FloorMap navigator never appears during an ordinary Viewer session (no scenes, floorplan)', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await expect(page.locator('#floormap-navigator')).toBeHidden();
    await loadTwoScenes(page);
    await expect(page.locator('#floormap-navigator')).toBeHidden();
    expectNoErrors(errors);
  });

  test('hidden-element bypass: driving #floorplan-input directly (its only trigger, add-floorplan-btn, does not exist) still does not add a FloorMap', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await page.locator('#floorplan-input').setInputFiles(FIXTURE_C);
    await expect(page.locator('#floormap-navigator')).toBeHidden();
    await expect(dirtyIndicator(page)).toBeHidden(); // handleFloorplanFiles()'s assertEditorMode() blocked before markProjectDirty()
    expectNoErrors(errors);
  });
});

test.describe('viewer.html: E. operations allowed in Viewer', () => {
  test('reset view, auto-rotate and fullscreen shortcuts run without throwing on a loaded scene', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('#viewer-canvas')).toBeVisible();
    await page.keyboard.press('a');
    await expect(page.locator('#autorotate-btn')).toHaveClass(/active/);
    await page.keyboard.press('a');
    await expect(page.locator('#autorotate-btn')).not.toHaveClass(/active/);
    await page.keyboard.press('r');
    expectNoErrors(errors);
  });

  test('mouse-wheel zoom on the main canvas does not throw', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('#viewer-canvas')).toBeVisible();
    const box = await page.locator('#viewer-canvas').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 100);
    await page.mouse.wheel(0, -100);
    expectNoErrors(errors);
  });

  test('drag-to-look-around on the main canvas does not throw', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('#viewer-canvas')).toBeVisible();
    const box = await page.locator('#viewer-canvas').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy - 40, { steps: 5 });
    await page.mouse.up();
    expectNoErrors(errors);
  });

  test('viewing operations (switch scene, enter/exit compare, drag/zoom) never mark the project dirty', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
    await sceneItems(page).nth(1).click();
    await page.keyboard.press('c');
    await page.keyboard.press('Escape');
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });
});

test.describe('viewer.html: F. operations blocked in Viewer', () => {
  test('double-clicking a scene name does not enter edit mode', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    const nameEl = page.locator('.scene-name').first();
    await nameEl.dblclick();
    await expect(nameEl).not.toHaveAttribute('contenteditable', 'true');
    await expect(nameEl).toHaveText('fixture-a');
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });

  test('the "m" flip shortcut does not flip the scene or dirty the project', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('#viewer-canvas')).toBeVisible();
    await page.keyboard.press('m');
    await expect(dirtyIndicator(page)).toBeHidden(); // toggleFlipSingle()'s assertEditorMode() blocks before applySceneFlip()
    expectNoErrors(errors);
  });

  test('Ctrl+Z / Ctrl+Shift+Z do nothing while viewing', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('#viewer-canvas')).toBeVisible();
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+Shift+z');
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });

  test('hidden-element bypass: re-driving #file-input on an already-loaded project is blocked (only a first load into an empty project is allowed)', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A); // first load into empty project: allowed
    await expect(sceneItems(page)).toHaveCount(1);
    await expect(dirtyIndicator(page)).toBeHidden();

    await page.locator('#file-input').setInputFiles(FIXTURE_B); // second load: handleFiles()'s assertEditorMode() blocks it
    await expect(sceneItems(page)).toHaveCount(1);
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });

  test('hidden-element bypass: dispatching a click straight at the dynamically-rendered .scene-delete-btn (CSS-hidden via .mode-viewer .editor-only, not a static removed id, so display:none rules out a normal/forced Playwright click) does not delete the scene', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await expect(page.locator('.scene-delete-btn').first()).toBeHidden(); // .mode-viewer .editor-only { display: none }

    // display:none leaves no bounding box, so even a force:true click can't
    // resolve coordinates; dispatchEvent fires the button's own 'click'
    // listener directly, which is the actual bypass this test is for (the
    // handler runs deleteScene(i) unconditionally -- the guard has to be
    // inside deleteScene() itself, not in whether the button is clickable).
    await page.locator('.scene-delete-btn').first().dispatchEvent('click');
    await expect(sceneItems(page)).toHaveCount(2); // deleteScene()'s assertEditorMode() blocked it
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });
});

test.describe('viewer.html: index.html Editor regression (existing tests already cover this; single confirmation here)', () => {
  test("index.html's own Editor-mode scene rename still works (viewer.html changes did not regress index.html)", async ({ page }) => {
    // Full Editor-mode coverage already lives in scene-rename-history.spec.js
    // and the rest of the suite; this is a one-test confirmation that
    // index.html (untouched by this PR) still reaches Editor mode and can
    // mutate, run alongside viewer.html's own tests in this file.
    const errors = await gotoApp(page);
    await page.click('#app-mode-toggle-btn', { force: true });
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    const nameEl = page.locator('.scene-name').first();
    await nameEl.dblclick();
    await page.keyboard.type('Renamed');
    await page.keyboard.press('Enter');
    await expect(nameEl).toHaveText('Renamed');
    expectNoErrors(errors);
  });
});
