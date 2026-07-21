// Regression coverage for the save/load lifecycle: JSON export, ZIP export,
// JSON/ZIP Open+Import (both funnel into the same _doImportWithFiles()), and
// the 'replace-project' unsaved-changes confirmation. Freezes current
// behavior; does not change production code.
//
// Fixtures are tiny, self-generated, fictional PNGs/JSON (tests/fixtures/) —
// no real project data. fixture-a/b.png are reused from smoke.spec.js's set
// (generic "add a local scene" filler); fixture-c.png and lifecycle-*.png/
// json are new, used specifically for import/merge scenarios so the merged
// content is visibly distinct from whatever was already loaded.
//
// KNOWN PRODUCTION BUG (not fixed here — see PR body): importing a JSON file
// into an already-loaded (non-empty) project silently restores nothing —
// scenes/floorplans/markers/compareSets all stay at 0 — while still showing
// a "復元完了" success toast. Root cause: importImagesInput's change handler
// calls the async _doImportWithFiles(importImagesInput.files) and then
// immediately resets importImagesInput.value = ''; when the project is
// non-empty, _doImportWithFiles awaits confirmUnsavedChanges() before ever
// reading that fileList parameter, and the value reset empties the same
// live FileList object out from under it. zipImportInput's handler resets
// .value before calling its (differently-shaped) import path, so ZIP import
// is unaffected. Two scenarios that would exercise the broken JSON path are
// intentionally NOT covered below (freezing a known malfunction as a "pass"
// would misrepresent it as correct): merging into a non-empty CLEAN project,
// and completing (not cancelling) the unsaved-changes confirmation for a
// non-empty DIRTY project. Only the cancel path is covered for the DIRTY
// case, since cancelling returns before the buggy code ever runs.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor, buildZipFixtureBuffer } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const LIFECYCLE_JSON    = path.join(FIXTURES, 'lifecycle-project.json');
const LIFECYCLE_SCENE_A = path.join(FIXTURES, 'lifecycle-scene-a.png');
const LIFECYCLE_SCENE_B = path.join(FIXTURES, 'lifecycle-scene-b.png');

function sceneNames(page) {
  return page.locator('.scene-name').allTextContents();
}

test.describe('JSON save', () => {
  test('editing marks dirty; export clears it and produces a download', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);

    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(FIXTURE_A); // empty -> clean
    await expect(dirtyIndicator(page)).toBeHidden();
    await fileInput.setInputFiles(FIXTURE_B); // additive -> dirty
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await page.title()).toMatch(/^\*/);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#export-json-btn', { force: true }),
    ]);
    expect(download.suggestedFilename()).toBe('archview360-project.json');
    await expect(dirtyIndicator(page)).toBeHidden();
    expect(await page.title()).not.toMatch(/^\*/);

    const savedPath = await download.path();
    const data = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
    expect(data.appVersion).toBe('2.22.0');
    expect(data.scenes).toHaveLength(2);
    await download.delete();

    expectNoErrors(errors);
  });
});

test.describe('ZIP save', () => {
  test('export produces a well-formed archive and clears dirty', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);

    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(FIXTURE_A);
    await fileInput.setInputFiles(FIXTURE_B);
    await expect(dirtyIndicator(page)).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#export-package-btn', { force: true }),
    ]);
    expect(download.suggestedFilename()).toMatch(/^ArchView360_Project_\d{8}_\d{4}\.zip$/);
    await expect(dirtyIndicator(page)).toBeHidden();

    const zipPath = await download.path();
    const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining([
      'project.json', 'README.txt', 'panoramas/fixture-a.png', 'panoramas/fixture-b.png',
    ]));
    const projectJson = JSON.parse(await zip.file('project.json').async('string'));
    expect(projectJson.scenes).toHaveLength(2);
    await download.delete();

    expectNoErrors(errors);
  });

  test('a save failure leaves the project dirty and reports an error (no silent data loss)', async ({ page }) => {
    // JSZip's generateAsync({type:'blob'}) defaults to a Blob whose .type is
    // 'application/zip' (vendor/jszip.min.js's own default), distinct from
    // the JSON export's 'application/json' blob and any scene image File's
    // 'image/*' type — used here as a deterministic, ZIP-export-only failure
    // trigger that doesn't touch any other createObjectURL() call.
    await page.addInitScript(() => {
      const orig = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        if (blob && blob.type === 'application/zip') throw new Error('Simulated export failure (test-only)');
        return orig(blob);
      };
    });
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(dirtyIndicator(page)).toBeHidden(); // single file into an empty project -> clean
    // Force dirty via a second, additive file so the failure path below has
    // something at stake to preserve.
    await page.locator('#file-input').setInputFiles(FIXTURE_B);
    await expect(dirtyIndicator(page)).toBeVisible();

    await page.click('#export-package-btn', { force: true });
    await expect(page.locator('#global-error')).toBeVisible();
    await expect(page.locator('#global-error')).toContainText('パッケージの書き出しに失敗しました');
    await expect(dirtyIndicator(page)).toBeVisible(); // still dirty — failure did not clear it

    expectNoErrors(errors); // caught internally by exportProjectPackage's own try/catch
  });
});

test.describe('JSON Open / Import', () => {
  test('Open into an empty project (Viewer) restores it clean', async ({ page }) => {
    const errors = await gotoApp(page);
    // Stays in Viewer for this whole test — opening into empty is allowed.
    await page.locator('#json-import-input').setInputFiles(LIFECYCLE_JSON);
    await expect(page.locator('#import-modal')).toBeVisible();
    await expect(page.locator('#import-modal-body')).toContainText('シーン 2');

    await page.locator('#import-images-input').setInputFiles([LIFECYCLE_SCENE_A, LIFECYCLE_SCENE_B]);
    await expect(page.locator('#import-modal')).toBeHidden();
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await expect.poll(() => sceneNames(page)).toHaveLength(2);
    await expect(dirtyIndicator(page)).toBeHidden();

    expectNoErrors(errors);
  });

  test('Import is blocked in Viewer once a project is already loaded', async ({ page }) => {
    const errors = await gotoApp(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A); // empty -> clean, stays Viewer

    await page.locator('#json-import-input').setInputFiles(LIFECYCLE_JSON);
    await expect(page.locator('#import-modal')).toBeVisible(); // preview itself isn't gated

    await page.locator('#import-images-input').setInputFiles([LIFECYCLE_SCENE_A, LIFECYCLE_SCENE_B]);
    // assertEditorMode() blocks the actual merge and shows a toast; nothing changes.
    await expect(page.locator('#toast')).toContainText('Viewerモードのため実行できません');
    await expect.poll(() => sceneNames(page)).toHaveLength(1);
    await expect(dirtyIndicator(page)).toBeHidden();

    expectNoErrors(errors);
  });

  test('Import into a DIRTY project shows the unsaved-changes confirmation — cancel keeps current data', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(FIXTURE_A);
    await fileInput.setInputFiles(FIXTURE_B); // additive -> dirty, 2 scenes
    await expect(dirtyIndicator(page)).toBeVisible();

    await page.locator('#json-import-input').setInputFiles(LIFECYCLE_JSON);
    await page.locator('#import-images-input').setInputFiles([LIFECYCLE_SCENE_A, LIFECYCLE_SCENE_B]);
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();

    await page.click('#dirty-confirm-cancel-btn', { force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeHidden();
    await expect.poll(() => sceneNames(page)).toHaveLength(2); // unchanged — nothing merged
    await expect(dirtyIndicator(page)).toBeVisible(); // still dirty, from the original edit

    expectNoErrors(errors);
  });
});

test.describe('ZIP Open / Import', () => {
  test('export then re-import into a fresh empty project round-trips clean', async ({ page, context }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(FIXTURE_A);
    await fileInput.setInputFiles(FIXTURE_B);
    await expect(dirtyIndicator(page)).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#export-package-btn', { force: true }),
    ]);
    const zipBuffer = fs.readFileSync(await download.path());
    await download.delete();

    const page2 = await context.newPage();
    const errors2 = await gotoApp(page2);
    await page2.locator('#zip-import-input').setInputFiles({
      name: 'exported.zip', mimeType: 'application/zip', buffer: zipBuffer,
    });
    await expect.poll(() => sceneNames(page2)).toHaveLength(2);
    await expect(dirtyIndicator(page2)).toBeHidden(); // opened into empty -> clean
    await page2.close();

    expectNoErrors(errors);
    expectNoErrors(errors2);
  });

  test('import into a DIRTY project shows the confirmation; cancel then continue', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(FIXTURE_A);
    await fileInput.setInputFiles(FIXTURE_B);
    await expect(dirtyIndicator(page)).toBeVisible();

    const zipBuffer = await buildZipFixtureBuffer();
    const zipFile = { name: 'merge-fixture.zip', mimeType: 'application/zip', buffer: zipBuffer };

    // ZIP import has no intermediate summary modal (images already live
    // inside the archive) — the confirm dialog appears directly.
    await page.locator('#zip-import-input').setInputFiles(zipFile);
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-cancel-btn', { force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeHidden();
    await expect.poll(() => sceneNames(page)).toHaveLength(2); // unchanged

    await page.locator('#zip-import-input').setInputFiles(zipFile);
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeHidden();
    await expect.poll(() => sceneNames(page)).toHaveLength(3); // 2 existing + 1 merged
    await expect(dirtyIndicator(page)).toBeVisible();

    expectNoErrors(errors);
  });
});
