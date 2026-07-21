// Regression coverage for the save/load lifecycle: JSON export, ZIP export,
// JSON/ZIP Open+Import (both funnel into the same _doImportWithFiles()), and
// the 'replace-project' unsaved-changes confirmation.
//
// Fixtures are tiny, self-generated, fictional PNGs/JSON (tests/fixtures/) —
// no real project data. fixture-a/b.png are reused from smoke.spec.js's set
// (generic "add a local scene" filler); fixture-c.png and lifecycle-*.png/
// json are new, used specifically for import/merge scenarios so the merged
// content is visibly distinct from whatever was already loaded.
//
// FIXED PRODUCTION BUG: importing a JSON file into an already-loaded
// (non-empty) project used to silently restore nothing while still showing
// a "復元完了" success toast, because importImagesInput's change handler
// reset its own .value right after handing the live FileList to the async
// _doImportWithFiles(), which suspends at its own await confirmUnsavedChanges()
// for a non-empty project — by the time it resumed, the reset had already
// emptied that same FileList. Fixed by snapshotting the files into a plain
// array before resetting .value (see importImagesInput's change handler in
// script.js). The 'Import into a non-empty CLEAN/DIRTY project ... actually
// merges' and 'the same JSON file ... can be re-selected' tests below
// reproduce and cover this fix. zipImportInput's handler was never affected
// (it resets .value before calling its differently-shaped import path).
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

  test('Import into a non-empty CLEAN project actually merges the new scenes', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A); // empty -> clean, 1 existing scene
    await expect(dirtyIndicator(page)).toBeHidden();
    const existingCount = (await sceneNames(page)).length;
    expect(existingCount).toBe(1);

    await page.locator('#json-import-input').setInputFiles(LIFECYCLE_JSON);
    await page.locator('#import-images-input').setInputFiles([LIFECYCLE_SCENE_A, LIFECYCLE_SCENE_B]);

    await expect(page.locator('#dirty-confirm-modal')).toBeHidden(); // clean -> no confirmation needed
    await expect(page.locator('#toast')).toContainText('復元完了: シーン 2 / 平面図 0 / マーカー 0 / 比較セット 0');
    await expect.poll(() => sceneNames(page)).toHaveLength(3); // 1 existing + 2 merged, not replaced
    const names = await sceneNames(page);
    expect(names).toContain('fixture-a'); // existing scene preserved
    expect(names).toContain('架空シーンA');
    expect(names).toContain('架空シーンB');
    await expect(dirtyIndicator(page)).toBeVisible(); // merging into a loaded project is an edit

    expectNoErrors(errors);
  });

  test('Import into a non-empty DIRTY project — continuing actually merges (not a full replace)', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(FIXTURE_A);
    await fileInput.setInputFiles(FIXTURE_B); // additive -> dirty, 2 existing scenes
    await expect(dirtyIndicator(page)).toBeVisible();
    const existingCount = (await sceneNames(page)).length;
    expect(existingCount).toBe(2);

    await page.locator('#json-import-input').setInputFiles(LIFECYCLE_JSON);
    await page.locator('#import-images-input').setInputFiles([LIFECYCLE_SCENE_A, LIFECYCLE_SCENE_B]);
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();

    await page.click('#dirty-confirm-discard-btn', { force: true }); // "破棄して続行"
    await expect(page.locator('#dirty-confirm-modal')).toBeHidden();
    await expect(page.locator('#import-modal')).toBeHidden();
    await expect(page.locator('#toast')).toContainText('復元完了: シーン 2 / 平面図 0 / マーカー 0 / 比較セット 0');
    // The confirm's "discard" label describes acknowledging the unsaved-changes
    // risk, not an actual wipe: current behavior pushes the imported scenes
    // onto the existing array, so the original 2 scenes survive alongside
    // the 2 newly merged ones.
    await expect.poll(() => sceneNames(page)).toHaveLength(4);
    const names = await sceneNames(page);
    expect(names).toContain('fixture-a');
    expect(names).toContain('fixture-b');
    expect(names).toContain('架空シーンA');
    expect(names).toContain('架空シーンB');
    await expect(dirtyIndicator(page)).toBeVisible();

    expectNoErrors(errors);
  });

  test('the same JSON file and the same image files can be re-selected for a second import', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A); // empty -> clean, 1 existing scene
    await expect(dirtyIndicator(page)).toBeHidden();

    // First import cycle.
    await page.locator('#json-import-input').setInputFiles(LIFECYCLE_JSON);
    await expect(page.locator('#import-modal')).toBeVisible();
    await page.locator('#import-images-input').setInputFiles([LIFECYCLE_SCENE_A, LIFECYCLE_SCENE_B]);
    await expect(page.locator('#import-modal')).toBeHidden();
    await expect.poll(() => sceneNames(page)).toHaveLength(3);

    // Second import cycle re-selecting the exact same JSON and image files —
    // proves the input .value reset (which browsers require to refire
    // 'change' for an identical file) still happens, just moved to after the
    // FileList has been safely snapshotted. The first merge left the project
    // dirty, so this second cycle also exercises the confirm dialog.
    await page.locator('#json-import-input').setInputFiles(LIFECYCLE_JSON);
    await expect(page.locator('#import-modal')).toBeVisible();
    await page.locator('#import-images-input').setInputFiles([LIFECYCLE_SCENE_A, LIFECYCLE_SCENE_B]);
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeHidden();
    await expect(page.locator('#import-modal')).toBeHidden();
    await expect.poll(() => sceneNames(page)).toHaveLength(5); // 3 + 2 more merged

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
