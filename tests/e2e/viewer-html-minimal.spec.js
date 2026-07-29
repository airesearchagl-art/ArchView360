// Launch + regression tests for the viewer.html static Viewer-only entry
// point (docs/ViewerEditor_DOM_Separation_Design_Comparison.md 案2).
//
// viewer.html is a static copy of index.html with the full confirmed-49-id
// removal set taken out (docs/ViewerEditor_Phase2_Section13_Audit.md 9.1節:
// CSS-based Editor-only 27 + function-gated Editor-only 22), plus the
// id-less `floormap-info-actions` container and -- as an additional design
// decision beyond the confirmed 49 (design comparison doc 4.3節) --
// `app-mode-toggle-btn`, so viewer.html has no normal-UI path into Editor.
//
// A follow-up fail-first pass (this file's history) found that 24 of the
// confirmed-49 ids (project-info-modal group x10, set-name-modal group x8,
// group-picker group x4, flip-a-btn, flip-b-btn) were referenced
// unconditionally from script.js code paths *outside* the gated
// open-function the earlier audits examined -- not only the outside-click
// handlers first identified, but also each modal's own
// close/cancel/save/ok button wiring and the set-name-modal keydown
// listener. All of these unconditional references now have a minimal
// null-guard in script.js (see docs/ViewerEditor_Viewer_Html_Known_Gaps.md
// for the full list of guarded call sites), so all 24 ids are now removed
// from viewer.html along with the rest of the confirmed-49 set.
//
// script.js and style.css are shared byte-for-byte with index.html (same
// `?v=` query strings); index.html's own behavior is unchanged because
// every added guard only skips work for an element that index.html always
// has present.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');

// The full confirmed-49 Editor-only id set (CSS-based 27 + function-gated
// 22), per docs/ViewerEditor_Phase2_Section13_Audit.md 7節/9.1節. None of
// these should exist anywhere in viewer.html.
const CONFIRMED_EDITOR_ONLY_49 = [
  // CSS-based (27)
  'add-floorplan-btn', 'add-img-btn', 'add-scene-btn', 'export-json-btn',
  'export-package-btn', 'flip-a-btn', 'flip-b-btn', 'flip-btn',
  'floormap-del-mk', 'floormap-orient-bar', 'floormap-orient-l',
  'floormap-orient-preset', 'floormap-orient-r', 'floormap-orient-val',
  'floormap-place-btn', 'floormap-rename-btn', 'floormap-reseq-btn',
  'floormap-rot-l', 'floormap-rot-r', 'import-json-btn', 'import-package-btn',
  'project-info-btn', 'redo-btn', 'save-set-btn', 'undo-btn',
  'update-scene-btn', 'viewer-preview-btn',
  // Function-gated (22)
  'project-info-modal', 'pi-modal-title', 'pi-close-btn', 'pi-name',
  'pi-client', 'pi-author', 'pi-date', 'pi-notes', 'pi-cancel-btn',
  'pi-save-btn',
  'set-name-modal', 'set-name-modal-title', 'set-name-close-btn',
  'set-name-modal-info', 'set-name-input', 'set-name-modal-note',
  'set-name-cancel-btn', 'set-name-ok-btn',
  'group-picker', 'group-picker-list', 'group-picker-input',
  'group-picker-add-btn',
];

async function gotoViewerHtml(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await page.goto('/viewer.html');
  await page.waitForFunction(() => window.THREE !== undefined, { timeout: 15000 }).catch(() => {});
  return { pageErrors, consoleErrors };
}

test.describe('viewer.html: launch + main-display', () => {
  test('viewer.html is reachable directly and init() completes without throwing', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    // A thrown exception inside init() would abort before later
    // addEventListener() calls run; the upload screen showing at all (its
    // drop-zone label) confirms init() reached the end of its DOM-refs +
    // listener-registration work without an unhandled TypeError.
    await expect(page.locator('#drop-zone')).toBeVisible();
    expectNoErrors(errors);
  });

  test('starts in Viewer mode by default (no query string), and a representative Common feature works', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);

    // Loading a scene through the ordinary "open" flow (Common: allowed
    // into an empty project from Viewer) is the main Common UI surface
    // viewer.html exists to serve.
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('#viewer-layout')).toBeVisible();
    await expect(page.locator('#viewer-canvas')).toBeVisible();
    await expect(page.locator('#scene-list li')).toHaveCount(1);

    expectNoErrors(errors);
  });

  test('entering split compare mode does not throw (updateCompareSelects() reach, now that flip-a-btn/flip-b-btn are removed and null-guarded)', async ({ page }) => {
    // Regression test for the fail-first discovery: with flip-a-btn/
    // flip-b-btn removed, updateCompareSelects() -- called from
    // enterSplitMode()/enterSliderMode() -- used to throw on
    // `flipABtn.classList.toggle(...)`. It must not throw now that
    // script.js null-guards both references.
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
    await expect(page.locator('#scene-list li')).toHaveCount(2);
    await page.keyboard.press('c'); // split compare mode shortcut, Common
    await expect(page.locator('#compare-container')).toBeVisible();
    expectNoErrors(errors);
  });

  test('entering slider compare mode does not throw', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
    await expect(page.locator('#scene-list li')).toHaveCount(2);
    await page.keyboard.press('s'); // slider compare mode shortcut, Common
    await expect(page.locator('#compare-container')).toBeVisible();
    expectNoErrors(errors);
  });

  test('keyboard shortcuts work with set-name-modal removed (global handler no longer references a null element unconditionally)', async ({ page }) => {
    // Regression test for the other major fail-first discovery: the global
    // keydown handler used to read `setNameModal.style.display` on every
    // keystroke unconditionally. With set-name-modal removed, this must not
    // throw, and ordinary Common shortcuts (autorotate, reset view) must
    // keep working.
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('#viewer-canvas')).toBeVisible();
    await page.keyboard.press('a'); // toggle auto-rotate, Common
    await page.keyboard.press('r'); // reset view, Common
    await page.keyboard.press('f'); // fullscreen, Common
    expectNoErrors(errors);
  });

  test('has no normal-UI path into Editor: app-mode-toggle-btn does not exist', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await expect(page.locator('#app-mode-toggle-btn')).toHaveCount(0);
    expectNoErrors(errors);
  });

  test('no confirmed Editor-only id (49) exists anywhere in viewer.html', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    for (const id of CONFIRMED_EDITOR_ONLY_49) {
      await expect(page.locator(`#${id}`)).toHaveCount(0);
    }
    // The id-less container that wrapped 4 of the CSS-based ids should be
    // gone too; its class name is unique enough not to collide with
    // anything else in viewer.html.
    await expect(page.locator('.floormap-info-actions')).toHaveCount(0);
    expectNoErrors(errors);
  });

  test('index.html is unaffected: it still has app-mode-toggle-btn and the full Editor-only set', async ({ page }) => {
    const errors = await gotoApp(page);
    await expect(page.locator('#app-mode-toggle-btn')).toHaveCount(1);
    await expect(page.locator('#project-info-modal')).toHaveCount(1);
    await expect(page.locator('#set-name-modal')).toHaveCount(1);
    await expect(page.locator('#group-picker')).toHaveCount(1);
    await expect(page.locator('#flip-a-btn')).toHaveCount(1);
    await expect(page.locator('#flip-b-btn')).toHaveCount(1);
    await expect(page.locator('#add-scene-btn')).toHaveCount(1);
    expectNoErrors(errors);
  });
});
