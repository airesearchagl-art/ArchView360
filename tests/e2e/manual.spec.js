// Smoke coverage for the in-app user manual (docs/*.html).
//
// Deliberately shallow: checks that key topics exist and are reachable
// from the app, not full-text snapshots of the manual's wording (which
// would make every future manual edit fail this test for no functional
// reason).
const { test, expect } = require('@playwright/test');

test.describe('in-app manual', () => {
  test('manual link is reachable from the app and covers Viewer/Editor and unsaved changes', async ({ page, context }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto('/');
    await page.waitForFunction(() => window.THREE !== undefined, { timeout: 15000 }).catch(() => {});

    const manualLink = page.locator('#manual-link-btn');
    await expect(manualLink).toBeVisible();
    const href = await manualLink.getAttribute('href');
    expect(href).toBe('/docs/index.html');

    // The link opens in a new tab (target="_blank"); follow it directly
    // rather than asserting on window.open plumbing.
    const manualErrors = [];
    const manualPage = await context.newPage();
    manualPage.on('pageerror', (e) => manualErrors.push(String(e)));
    await manualPage.goto(href);

    await expect(manualPage.locator('h1')).toHaveText('ArchView360 ユーザーマニュアル');
    await expect(manualPage.locator('.m-card-grid')).toBeVisible();
    // Viewer/Editor mode is covered on the manual's top page (callout) and
    // in detail on the getting-started page.
    await expect(manualPage.getByText('Viewer', { exact: false }).first()).toBeVisible();

    await manualPage.goto('/docs/getting-started.html');
    await expect(manualPage.locator('h2:has-text("Viewerモード / Editorモード")')).toBeVisible();
    await expect(manualPage.locator('h3:has-text("Viewerモード")')).toBeVisible();
    await expect(manualPage.locator('h3:has-text("Editorモード")')).toBeVisible();
    await expect(manualPage.locator('h2:has-text("未保存変更について")')).toBeVisible();

    await manualPage.goto('/docs/version-history.html');
    await expect(manualPage.locator('h2:has-text("Version 2.22.0")')).toBeVisible();
    await expect(manualPage.locator('h2:has-text("Version 2.21.0")')).toBeVisible();

    // The manual's shared header links back to the running app.
    const backLink = manualPage.locator('.m-header-back');
    await expect(backLink).toHaveAttribute('href', '/');
    await manualPage.close();

    expect(manualErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
