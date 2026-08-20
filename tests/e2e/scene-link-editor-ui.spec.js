// B3 coverage for the sceneLink Editor UI
// (docs/SceneLink_TourGraph_Investigation.md). B2 shipped the data model,
// persistence, history and cascade with no UI at all; B3 adds the minimal
// Editor surface that drives those same production commit points. These
// tests therefore go through real DOM interaction — clicks, selects, typed
// values — rather than window.__sceneLinkTestHooks, which stays in place for
// the B2 data-layer spec. Viewer navigation (B4) and the VR Scene Ring (B5)
// are still out of scope.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');

function sceneItems(page)   { return page.locator('#scene-list .scene-item'); }
function linkSection(page)  { return page.locator('#scene-link-section'); }
function linkItems(page)    { return page.locator('#scene-link-list .scene-link-item'); }
function targetSelect(page) { return page.locator('#scene-link-target-select'); }

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

async function links(page) {
  return page.evaluate(() => window.__sceneLinkTestHooks.list());
}

// Loads three scenes into an empty project (a load, not an edit — stays
// clean) and clears history so each test starts from a known baseline.
async function loadThreeScenes(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
  await expect(sceneItems(page)).toHaveCount(3);
  await page.evaluate(() => window.__historyManagerForTests.clear());
  await expect(dirtyIndicator(page)).toBeHidden();
}

// Opens the create form, fills it and commits. Returns once the list has
// settled to the expected row count.
async function createLinkViaUi(page, { targetName, heading, label } = {}) {
  await page.click('#scene-link-add-btn', { force: true });
  await expect(page.locator('#scene-link-form')).toBeVisible();
  if (targetName !== undefined) await targetSelect(page).selectOption({ label: targetName });
  if (heading !== undefined) await page.locator('#scene-link-heading-input').fill(String(heading));
  if (label !== undefined) await page.locator('#scene-link-label-input').fill(label);
  await page.click('#scene-link-create-btn', { force: true });
}

test.describe('sceneLink Editor UI: visibility and mode', () => {
  test('the sceneLink panel is present in Editor', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    await expect(linkSection(page)).toBeVisible();
    await expect(page.locator('#scene-link-add-btn')).toBeVisible();
    // Nothing linked yet, so the empty hint shows instead of a list.
    await expect(page.locator('#scene-link-empty')).toBeVisible();
    await expect(linkItems(page)).toHaveCount(0);

    expectNoErrors(errors);
  });

  test('the sceneLink panel is hidden in Viewer', async ({ page }) => {
    const errors = await gotoApp(page);
    // Load without entering Editor: a fresh page starts in Viewer and
    // opening images into an empty project is a load, not an edit.
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
    await expect(sceneItems(page)).toHaveCount(3);

    // toBeHidden() alone also passes for an element that does not exist, so
    // assert the panel is really in the DOM and really not shown.
    await expect(linkSection(page)).toHaveCount(1);
    await expect(linkSection(page)).toBeHidden();
    await expect(page.locator('#scene-link-add-btn')).toBeHidden();

    expectNoErrors(errors);
  });

  test('the target picker never offers the current scene itself', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    await page.click('#scene-link-add-btn', { force: true });
    await expect(page.locator('#scene-link-form')).toBeVisible();

    const current = await page.locator('#current-scene-name').textContent();
    const options = await targetSelect(page).locator('option').allTextContents();
    expect(options).toHaveLength(2);           // 3 scenes minus the current one
    expect(options).not.toContain(current.trim());

    expectNoErrors(errors);
  });
});

test.describe('sceneLink Editor UI: create, edit, delete', () => {
  test('creating a link from the form adds one row and one history entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    const before = await historyCounts(page);

    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 120, label: '北の部屋へ' });

    await expect(linkItems(page)).toHaveCount(1);
    await expect(page.locator('#scene-link-empty')).toBeHidden();
    await expect(linkItems(page).first().locator('.scene-link-item-name')).toHaveText('fixture-b');
    await expect(linkItems(page).first().locator('.scene-link-item-heading')).toHaveValue('120');
    await expect(linkItems(page).first().locator('.scene-link-item-label')).toHaveValue('北の部屋へ');
    await expect(linkItems(page).first().locator('.scene-link-item-enabled')).toBeChecked();
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: before.undoCount + 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('a second enabled link to the same target is refused without mutating anything', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 90 });
    await expect(linkItems(page)).toHaveCount(1);
    const after = await historyCounts(page);

    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 200 });

    await expect(linkItems(page)).toHaveCount(1);
    await expect(linkItems(page).first().locator('.scene-link-item-heading')).toHaveValue('90');
    expect(await historyCounts(page)).toEqual(after);

    expectNoErrors(errors);
  });

  test('the heading field can be filled from the current camera direction', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    await page.click('#scene-link-add-btn', { force: true });
    await page.locator('#scene-link-heading-input').fill('0');
    await page.click('#scene-link-heading-cam-btn', { force: true });

    const shown = Number(await page.locator('#scene-link-heading-input').inputValue());
    const expected = await page.evaluate(() => window.__sceneLinkUiTestHooks.currentCameraHeading());
    expect(shown).toBe(expected);
    expect(Number.isInteger(shown)).toBe(true);
    expect(shown).toBeGreaterThanOrEqual(0);
    expect(shown).toBeLessThanOrEqual(359);

    expectNoErrors(errors);
  });

  test('changing a row target rewrites the link and pushes one entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 90 });
    const before = await historyCounts(page);

    await linkItems(page).first().locator('.scene-link-item-target').selectOption({ label: 'fixture-c' });

    await expect(linkItems(page).first().locator('.scene-link-item-name')).toHaveText('fixture-c');
    expect(await historyCounts(page)).toEqual({ undoCount: before.undoCount + 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('changing a row heading normalizes the value and pushes one entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 90 });
    const before = await historyCounts(page);

    await linkItems(page).first().locator('.scene-link-item-heading').fill('450');
    await linkItems(page).first().locator('.scene-link-item-heading').blur();

    await expect(linkItems(page).first().locator('.scene-link-item-heading')).toHaveValue('90');
    expect((await links(page))[0].heading).toBe(90);
    // 450 normalizes back to the value it already had, so nothing changed
    // and the no-op guard must have suppressed the entry.
    expect(await historyCounts(page)).toEqual(before);

    await linkItems(page).first().locator('.scene-link-item-heading').fill('-90');
    await linkItems(page).first().locator('.scene-link-item-heading').blur();
    await expect(linkItems(page).first().locator('.scene-link-item-heading')).toHaveValue('270');
    expect(await historyCounts(page)).toEqual({ undoCount: before.undoCount + 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('changing a row label pushes one entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 90 });
    const before = await historyCounts(page);

    await linkItems(page).first().locator('.scene-link-item-label').fill('玄関へ');
    await linkItems(page).first().locator('.scene-link-item-label').blur();

    await expect.poll(async () => (await links(page))[0].label).toBe('玄関へ');
    expect(await historyCounts(page)).toEqual({ undoCount: before.undoCount + 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('toggling a row enabled checkbox pushes one entry and round-trips', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 90 });
    const before = await historyCounts(page);

    await linkItems(page).first().locator('.scene-link-item-enabled').uncheck({ force: true });
    await expect.poll(async () => (await links(page))[0].enabled).toBe(false);
    expect(await historyCounts(page)).toEqual({ undoCount: before.undoCount + 1, redoCount: 0 });

    await linkItems(page).first().locator('.scene-link-item-enabled').check({ force: true });
    await expect.poll(async () => (await links(page))[0].enabled).toBe(true);
    expect(await historyCounts(page)).toEqual({ undoCount: before.undoCount + 2, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('deleting a row removes it and pushes one entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 90 });
    const before = await historyCounts(page);

    await linkItems(page).first().locator('.scene-link-item-del').click({ force: true });

    await expect(linkItems(page)).toHaveCount(0);
    await expect(page.locator('#scene-link-empty')).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: before.undoCount + 1, redoCount: 0 });

    expectNoErrors(errors);
  });
});

test.describe('sceneLink Editor UI: undo/redo', () => {
  test('undo/redo of a UI-created link updates the panel both ways', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 90, label: 'L' });
    await expect(linkItems(page)).toHaveCount(1);

    await page.click('#undo-btn', { force: true });
    await expect(linkItems(page)).toHaveCount(0);
    await expect(page.locator('#scene-link-empty')).toBeVisible();

    await page.click('#redo-btn', { force: true });
    await expect(linkItems(page)).toHaveCount(1);
    await expect(linkItems(page).first().locator('.scene-link-item-label')).toHaveValue('L');

    expectNoErrors(errors);
  });

  test('undo/redo of a UI deletion updates the panel both ways', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 90, label: 'L' });
    await linkItems(page).first().locator('.scene-link-item-del').click({ force: true });
    await expect(linkItems(page)).toHaveCount(0);

    await page.click('#undo-btn', { force: true });
    await expect(linkItems(page)).toHaveCount(1);
    await expect(linkItems(page).first().locator('.scene-link-item-label')).toHaveValue('L');

    await page.click('#redo-btn', { force: true });
    await expect(linkItems(page)).toHaveCount(0);

    expectNoErrors(errors);
  });

  test('undo/redo of UI edits round-trips heading, label and enabled', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 90, label: 'before' });

    const heading = linkItems(page).first().locator('.scene-link-item-heading');
    const label   = linkItems(page).first().locator('.scene-link-item-label');
    const enabled = linkItems(page).first().locator('.scene-link-item-enabled');

    await heading.fill('200'); await heading.blur();
    await label.fill('after'); await label.blur();
    await enabled.uncheck({ force: true });
    await expect.poll(async () => (await links(page))[0])
      .toMatchObject({ heading: 200, label: 'after', enabled: false });

    await page.click('#undo-btn', { force: true }); // enabled
    await page.click('#undo-btn', { force: true }); // label
    await page.click('#undo-btn', { force: true }); // heading
    await expect.poll(async () => (await links(page))[0])
      .toMatchObject({ heading: 90, label: 'before', enabled: true });
    await expect(heading).toHaveValue('90');
    await expect(label).toHaveValue('before');
    await expect(enabled).toBeChecked();

    await page.click('#redo-btn', { force: true });
    await page.click('#redo-btn', { force: true });
    await page.click('#redo-btn', { force: true });
    await expect.poll(async () => (await links(page))[0])
      .toMatchObject({ heading: 200, label: 'after', enabled: false });

    expectNoErrors(errors);
  });
});

test.describe('sceneLink Editor UI: scene context and import', () => {
  test('switching scenes shows that scene own outgoing links', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    // Scene 1 (fixture-a) -> fixture-b
    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 10, label: 'from-a' });
    await expect(linkItems(page)).toHaveCount(1);

    // Switch to fixture-b: it has no outgoing links of its own.
    await sceneItems(page).nth(1).click({ force: true });
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');
    await expect(linkItems(page)).toHaveCount(0);
    await expect(page.locator('#scene-link-empty')).toBeVisible();

    // Its own link is separate from scene 1's.
    await createLinkViaUi(page, { targetName: 'fixture-c', heading: 20, label: 'from-b' });
    await expect(linkItems(page)).toHaveCount(1);
    await expect(linkItems(page).first().locator('.scene-link-item-label')).toHaveValue('from-b');

    // Back to scene 1 — still exactly its own one link.
    await sceneItems(page).nth(0).click({ force: true });
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');
    await expect(linkItems(page)).toHaveCount(1);
    await expect(linkItems(page).first().locator('.scene-link-item-label')).toHaveValue('from-a');

    expectNoErrors(errors);
  });

  test('links arriving through import show up in the panel', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    // Same production import-validation path the B2 spec drives; the panel
    // must reflect it without any further user action.
    await page.evaluate(() => {
      const ids = window.__sceneLinkTestHooks.sceneIds();
      window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: 'lk-imported', sourceSceneId: ids[0], targetSceneId: ids[2], heading: 42, label: 'imported', enabled: true },
        ],
      });
      window.__sceneLinkUiTestHooks.refresh();
    });

    await expect(linkItems(page)).toHaveCount(1);
    await expect(linkItems(page).first().locator('.scene-link-item-name')).toHaveText('fixture-c');
    await expect(linkItems(page).first().locator('.scene-link-item-heading')).toHaveValue('42');
    await expect(linkItems(page).first().locator('.scene-link-item-label')).toHaveValue('imported');

    expectNoErrors(errors);
  });
});

test.describe('sceneLink Editor UI: Viewer mutation guard', () => {
  test('driving the panel controls from Viewer never mutates state', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await createLinkViaUi(page, { targetName: 'fixture-b', heading: 90, label: 'kept' });
    const snapshot = await links(page);
    expect(snapshot).toHaveLength(1);

    // Back to Viewer. The link edit left the project dirty, so the switch
    // asks for acknowledgement first (it never discards data — Viewer keeps
    // browsing the same in-memory state).
    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('#app-mode-label')).toHaveText('Viewer');

    // The panel is CSS-hidden now, but hidden is not a boundary — dispatch
    // straight at the elements, as PR #13 taught.
    await expect(linkSection(page)).toBeHidden();
    await page.evaluate(() => window.__historyManagerForTests.clear());

    await page.evaluate(() => {
      const fire = (el, type) => el && el.dispatchEvent(new Event(type, { bubbles: true }));
      const row = document.querySelector('#scene-link-list .scene-link-item');
      if (row) {
        const t = row.querySelector('.scene-link-item-target');
        if (t && t.options.length) { t.selectedIndex = t.options.length - 1; fire(t, 'change'); }
        const h = row.querySelector('.scene-link-item-heading');
        if (h) { h.value = '321'; fire(h, 'change'); }
        const l = row.querySelector('.scene-link-item-label');
        if (l) { l.value = 'hacked'; fire(l, 'change'); }
        const e = row.querySelector('.scene-link-item-enabled');
        if (e) { e.checked = false; fire(e, 'change'); }
        const d = row.querySelector('.scene-link-item-del');
        if (d) d.click();
      }
      const add = document.getElementById('scene-link-add-btn');
      if (add) add.click();
      const create = document.getElementById('scene-link-create-btn');
      if (create) create.click();
    });

    expect(await links(page)).toEqual(snapshot);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeVisible(); // dirty from the Editor edit, unchanged

    expectNoErrors(errors);
  });
});
