// Phase 2 DOM investigation document 13節 audit follow-up
// (docs/ViewerEditor_Phase2_Section13_Audit.md): confirms one of the
// audit's findings empirically rather than by static code reading alone.
//
// The marker right-click context menu (`.mk-ctx-menu`) is built entirely
// with document.createElement() (script.js, around the floormap-canvas
// 'contextmenu' handler) and carries no static id in index.html, so it is
// outside the 184-unique-id count the DOM investigation document's
// arithmetic is based on. It is gated by `if (!canMutateProject()) return;`
// *before* any menu DOM is created, which is the same "function-level
// gate, no CSS class" pattern as the three already-known modal groups
// (project-info-modal / set-name-modal / group-picker) -- just with zero
// static-id footprint instead of some. This test proves the gate actually
// holds at runtime: in Viewer mode, right-clicking a placed marker must
// not create any `.mk-ctx-menu` element at all.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const MARKER_POS = { x: 50, y: 50 };

test.describe('Phase 2 §13 audit: marker context menu is function-gated, not CSS-gated', () => {
  test('Viewer mode: right-clicking a placed marker does not create .mk-ctx-menu', async ({ page }) => {
    const errors = await gotoApp(page);

    // Place a marker in Editor first (placing requires Editor; this is the
    // normal, guarded path -- not the thing under test).
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await page.locator('#add-floorplan-btn').click();
    await page.locator('#floorplan-input').setInputFiles(FIXTURE_B);
    await page.locator('#floormap-place-btn').click();
    await page.locator('#floormap-canvas').click({ position: MARKER_POS });
    await expect(page.locator('#floormap-info-panel')).toBeVisible();

    // Switch back to Viewer. Placing the marker left the project dirty, so
    // the toggle raises the existing dirty-confirm-modal (unrelated to this
    // test's subject) -- confirm through it same as a real user would.
    await page.locator('#app-mode-toggle-btn').click();
    await page.locator('#dirty-confirm-discard-btn').click();
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);

    // The subject of this test: right-click the same marker position while
    // in Viewer. If the gate in the 'contextmenu' handler were missing (or
    // ever regressed), a `.mk-ctx-menu` would be created here.
    await page.locator('#floormap-canvas').click({ position: MARKER_POS, button: 'right' });
    await expect(page.locator('.mk-ctx-menu')).toHaveCount(0);

    expectNoErrors(errors);
  });
});
