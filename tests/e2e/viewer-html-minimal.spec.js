// Minimal launch + main-display regression for the new viewer.html static
// entry point (docs/ViewerEditor_DOM_Separation_Design_Comparison.md 案2,
// 6節 PR-B). This is the "最低限の起動・主要表示テスト" bundled with the
// viewer.html addition itself; the "詳細回帰テスト" (Common機能全般・
// Editor切替導線が無いことの確認・Viewer Preview関連UIが無いことの確認)
// is left for a separate follow-up PR (6節 PR-C), per the design doc.
//
// viewer.html is a static copy of index.html with the *verified-safe*
// subset of the confirmed 49-id removal set taken out
// (docs/ViewerEditor_Phase2_Section13_Audit.md 9.1節), plus the id-less
// `floormap-info-actions` container and -- as an additional design
// decision beyond the confirmed 49 (design comparison doc 4.3節) --
// `app-mode-toggle-btn`, so viewer.html has no normal-UI path into Editor.
//
// IMPORTANT: fail-first testing during this PR found that 3 of the 22
// function-gated ids' groups (project-info-modal, set-name-modal,
// group-picker) and 2 of the 27 CSS-based ids (flip-a-btn, flip-b-btn)
// are referenced unconditionally from script.js code paths *outside* the
// gated open-function the earlier audits examined (an outside-click-close
// handler, a global keyboard-shortcut guard, "add group" button/input
// wiring, and updateCompareSelects() -- called every time Common
// split/slider compare mode is entered). None of these can be physically
// removed from viewer.html without an accompanying script.js null-guard,
// which is out of scope for this PR (script.js is not touched here). See
// docs/ViewerEditor_Viewer_Html_Known_Gaps.md for the full writeup; those
// 18 + 2 = 20 ids are intentionally still present in viewer.html.
//
// script.js and style.css are shared byte-for-byte with index.html (same
// `?v=` query strings); this file changes no code, only markup.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');

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

test.describe('viewer.html: minimal launch + main-display', () => {
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

  test('entering split compare mode does not throw (updateCompareSelects() reach, flip-a-btn/flip-b-btn kept)', async ({ page }) => {
    // This is a direct regression test for the fail-first discovery: with
    // flip-a-btn/flip-b-btn removed, updateCompareSelects() -- called from
    // enterSplitMode()/enterSliderMode() -- threw on
    // `flipABtn.classList.toggle(...)`. It must not throw now that both
    // buttons are intentionally kept (docs/ViewerEditor_Viewer_Html_Known_Gaps.md).
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
    await expect(page.locator('#scene-list li')).toHaveCount(2);
    await page.keyboard.press('c'); // split compare mode shortcut, Common
    await expect(page.locator('#compare-container')).toBeVisible();
    expectNoErrors(errors);
  });

  test('has no normal-UI path into Editor: app-mode-toggle-btn does not exist', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await expect(page.locator('#app-mode-toggle-btn')).toHaveCount(0);
    expectNoErrors(errors);
  });

  test('representative Editor-only ids that are verified safe to remove are absent', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    const removedIds = [
      // CSS-based, direct
      'add-scene-btn',
      'export-json-btn',
      'undo-btn',
      'redo-btn',
      // CSS-based, inherited from a removed .editor-only container
      'floormap-orient-bar',
      'floormap-rename-btn',
    ];
    for (const id of removedIds) {
      await expect(page.locator(`#${id}`)).toHaveCount(0);
    }
    // The id-less container that wrapped 4 of the inherited ids should be
    // gone too; its class name is unique enough not to collide with
    // anything else in viewer.html.
    await expect(page.locator('.floormap-info-actions')).toHaveCount(0);
    expectNoErrors(errors);
  });

  test('known-gap ids are intentionally still present (not a regression -- see docs/ViewerEditor_Viewer_Html_Known_Gaps.md)', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    const keptIds = [
      'project-info-modal', 'set-name-modal', 'group-picker', 'flip-a-btn', 'flip-b-btn',
    ];
    for (const id of keptIds) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    expectNoErrors(errors);
  });

  test('index.html is unaffected: it still has app-mode-toggle-btn and the full Editor-only set', async ({ page }) => {
    const errors = await gotoApp(page);
    await expect(page.locator('#app-mode-toggle-btn')).toHaveCount(1);
    await expect(page.locator('#project-info-modal')).toHaveCount(1);
    await expect(page.locator('#add-scene-btn')).toHaveCount(1);
    expectNoErrors(errors);
  });
});
