// B4 coverage for sceneLink Viewer navigation
// (docs/SceneLink_TourGraph_Investigation.md section 9). B2 stored the graph,
// B3 gave Editor the means to build it; B4 turns it into an actual way to move
// between scenes, in Viewer mode and in the distributable viewer.html as well
// as in Editor. Navigation is a viewing action, never a mutation: it must not
// dirty the project or push history, and the Viewer surface exposes no way to
// change a link. Panorama hotspots, FloorMap link drawing and the VR Scene
// Ring (B5) all remain out of scope.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { gotoApp, gotoViewerHtml, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');

function sceneItems(page)  { return page.locator('#scene-list .scene-item'); }
function navSection(page)  { return page.locator('#scene-link-nav-section'); }
function navItems(page)    { return page.locator('#scene-link-nav-list .scene-link-nav-btn'); }
function currentScene(page){ return page.locator('#current-scene-name'); }

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

async function links(page) {
  return page.evaluate(() => window.__sceneLinkTestHooks.list());
}

async function loadThreeScenes(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
  await expect(sceneItems(page)).toHaveCount(3);
  await page.evaluate(() => window.__historyManagerForTests.clear());
  await expect(dirtyIndicator(page)).toBeHidden();
}

// Creates a link through the B2 commit point (B3's UI is covered by its own
// spec; here the graph is just setup for navigation).
async function makeLink(page, fromIdx, toIdx, { heading = 0, label = '', enabled = true } = {}) {
  return page.evaluate(
    ([f, t, h, l, en]) => {
      const ids = window.__sceneLinkTestHooks.sceneIds();
      const id = window.__sceneLinkTestHooks.create({
        sourceSceneId: ids[f], targetSceneId: ids[t], heading: h, label: l,
      });
      if (id && !en) window.__sceneLinkTestHooks.setEnabled(id, false);
      return id;
    },
    [fromIdx, toIdx, heading, label, enabled]
  );
}

// Returns to a clean baseline after setup so navigation assertions about
// dirty/history start from zero.
async function settle(page) {
  await page.evaluate(() => window.__historyManagerForTests.clear());
}

test.describe('sceneLink Viewer navigation: what is listed', () => {
  test('enabled outgoing links of the current scene are listed', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: '北の部屋へ' });
    await makeLink(page, 0, 2, { label: '南の部屋へ' });

    await expect(navSection(page)).toBeVisible();
    await expect(navItems(page)).toHaveCount(2);

    expectNoErrors(errors);
  });

  test('disabled links are not listed', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: 'shown' });
    await makeLink(page, 0, 2, { label: 'hidden', enabled: false });

    await expect(navItems(page)).toHaveCount(1);
    await expect(navItems(page).first()).toContainText('shown');
    await expect(navItems(page).first()).not.toContainText('hidden');

    expectNoErrors(errors);
  });

  test('a link with a label shows the label and its target scene name', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: '北の部屋へ' });

    await expect(navItems(page).first().locator('.scene-link-nav-label')).toHaveText('北の部屋へ');
    await expect(navItems(page).first().locator('.scene-link-nav-target')).toHaveText('fixture-b');

    expectNoErrors(errors);
  });

  test('a link with no label falls back to the target scene name', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: '' });

    await expect(navItems(page).first().locator('.scene-link-nav-label')).toHaveText('fixture-b');
    // No separate secondary line when the primary line already is the name.
    await expect(navItems(page).first().locator('.scene-link-nav-target')).toHaveCount(0);

    expectNoErrors(errors);
  });

  test('a scene with no enabled outgoing links shows no navigation section', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    // toBeHidden() alone also passes for an element that does not exist, so
    // assert the section is really in the DOM and really not shown.
    await expect(navSection(page)).toHaveCount(1);
    await expect(navSection(page)).toBeHidden();

    // A disabled-only scene is still an empty graph for navigation.
    await makeLink(page, 0, 1, { enabled: false });
    await expect(navSection(page)).toHaveCount(1);
    await expect(navSection(page)).toBeHidden();
    await expect(navItems(page)).toHaveCount(0);

    expectNoErrors(errors);
  });

  test('a link whose target scene no longer exists is not listed', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    // Import a link pointing at a ghost id straight past the validating
    // import path, so the renderer itself has to skip it.
    await page.evaluate(() => {
      const ids = window.__sceneLinkTestHooks.sceneIds();
      window.__sceneLinkTestHooks.forceLinkForTests({
        id: 'lk-dangling', sourceSceneId: ids[0], targetSceneId: 'ghost-scene',
        heading: 0, label: 'nowhere', order: 1, enabled: true,
      });
      window.__sceneLinkUiTestHooks.refresh();
    });

    expect((await links(page)).some(l => l.id === 'lk-dangling')).toBe(true);
    await expect(navItems(page)).toHaveCount(0);
    await expect(navSection(page)).toBeHidden();

    expectNoErrors(errors);
  });

  test('links are listed in order', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 2, { label: 'first-made' });
    await makeLink(page, 0, 1, { label: 'second-made' });

    await expect(navItems(page).nth(0).locator('.scene-link-nav-label')).toHaveText('first-made');
    await expect(navItems(page).nth(1).locator('.scene-link-nav-label')).toHaveText('second-made');

    expectNoErrors(errors);
  });
});

test.describe('sceneLink Viewer navigation: moving between scenes', () => {
  test('activating a link switches to its target scene', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: 'to-b' });
    await expect(currentScene(page)).toHaveText('fixture-a');

    await navItems(page).first().click({ force: true });

    await expect(currentScene(page)).toHaveText('fixture-b');

    expectNoErrors(errors);
  });

  test('after navigating, the list shows the new scene outgoing links', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: 'a-to-b' });
    await makeLink(page, 1, 2, { label: 'b-to-c' });

    await expect(navItems(page)).toHaveCount(1);
    await expect(navItems(page).first()).toContainText('a-to-b');

    await navItems(page).first().click({ force: true });
    await expect(currentScene(page)).toHaveText('fixture-b');
    await expect(navItems(page)).toHaveCount(1);
    await expect(navItems(page).first()).toContainText('b-to-c');

    // Walk on to C, which has nothing outgoing.
    await navItems(page).first().click({ force: true });
    await expect(currentScene(page)).toHaveText('fixture-c');
    await expect(navSection(page)).toBeHidden();

    // Back to A by another route — its own list is restored.
    await sceneItems(page).nth(0).click({ force: true });
    await expect(currentScene(page)).toHaveText('fixture-a');
    await expect(navItems(page)).toHaveCount(1);
    await expect(navItems(page).first()).toContainText('a-to-b');

    expectNoErrors(errors);
  });

  test('navigating never dirties the project or pushes history', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: 'to-b' });
    await makeLink(page, 1, 0, { label: 'back-to-a' });
    // Export leaves the project clean, so any dirtying below is navigation's.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#export-json-btn', { force: true }),
    ]);
    await download.delete();
    await settle(page);
    await expect(dirtyIndicator(page)).toBeHidden();
    const before = await links(page);

    await navItems(page).first().click({ force: true });
    await expect(currentScene(page)).toHaveText('fixture-b');
    await navItems(page).first().click({ force: true });
    await expect(currentScene(page)).toHaveText('fixture-a');

    await expect(dirtyIndicator(page)).toBeHidden();
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    expect(await links(page)).toEqual(before);

    expectNoErrors(errors);
  });

  test('a link can be activated from the keyboard', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: 'to-b' });

    const btn = navItems(page).first();
    // A real button: focusable and activated by Enter, with the visible text
    // as its accessible name.
    await btn.focus();
    await expect(btn).toBeFocused();
    expect(await btn.evaluate(el => el.tagName)).toBe('BUTTON');
    await page.keyboard.press('Enter');

    await expect(currentScene(page)).toHaveText('fixture-b');

    expectNoErrors(errors);
  });
});

test.describe('sceneLink Viewer navigation: Viewer surfaces', () => {
  test('navigation works in index.html Viewer mode and exposes no editing', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: 'to-b' });

    // Leave Editor. The link edit above made the project dirty, so the
    // switch asks for acknowledgement first.
    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible();
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('#app-mode-label')).toHaveText('Viewer');

    // The read-only navigation stays; the B3 editing panel does not.
    await expect(navSection(page)).toBeVisible();
    await expect(navItems(page)).toHaveCount(1);
    await expect(page.locator('#scene-link-section')).toBeHidden();

    const before = await links(page);
    await settle(page);
    await navItems(page).first().click({ force: true });
    await expect(currentScene(page)).toHaveText('fixture-b');

    // Navigation is a viewing action: state untouched.
    expect(await links(page)).toEqual(before);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('the navigation surface offers no control that can change a link', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: 'to-b' });
    await page.click('#app-mode-toggle-btn', { force: true });
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('#app-mode-label')).toHaveText('Viewer');
    await settle(page);
    const before = await links(page);

    // No inputs/selects/checkboxes live inside the navigation section at all,
    // and firing events at what is there cannot mutate the graph.
    expect(await navSection(page).locator('input, select, textarea').count()).toBe(0);
    await page.evaluate(() => {
      const sec = document.getElementById('scene-link-nav-section');
      sec.querySelectorAll('*').forEach((el) => {
        ['change', 'input', 'dblclick'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
      });
    });

    expect(await links(page)).toEqual(before);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('navigation works in viewer.html after importing a project with links', async ({ page }) => {
    // Build a donor project with links in the Editor entry point and export it.
    const errors1 = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: 'to-b' });
    await makeLink(page, 1, 2, { label: 'to-c' });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#export-json-btn', { force: true }),
    ]);
    const projectJson = await download.path();
    expectNoErrors(errors1);

    // viewer.html is Viewer-only, but opening a file into an EMPTY project is
    // a load, not an edit, so the import is allowed there.
    const errors2 = await gotoViewerHtml(page);
    await page.locator('#json-import-input').setInputFiles(projectJson);
    await page.locator('#import-images-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
    await expect(sceneItems(page)).toHaveCount(3);

    await expect(navSection(page)).toBeVisible();
    await expect(navItems(page)).toHaveCount(1);
    await expect(navItems(page).first()).toContainText('to-b');

    await navItems(page).first().click({ force: true });
    await expect(currentScene(page)).toHaveText('fixture-b');
    await expect(navItems(page).first()).toContainText('to-c');

    // The distributable entry point carries no link editing surface.
    await expect(page.locator('#scene-link-section')).toHaveCount(0);

    expectNoErrors(errors2);
  });
});

test.describe('sceneLink Viewer navigation: staying in sync', () => {
  test('imported links are navigable without any further action', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    await page.evaluate(() => {
      const ids = window.__sceneLinkTestHooks.sceneIds();
      window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: 'lk-imported', sourceSceneId: ids[0], targetSceneId: ids[2], heading: 42, label: 'imported', enabled: true },
        ],
      });
      window.__sceneLinkUiTestHooks.refresh();
    });

    await expect(navItems(page)).toHaveCount(1);
    await navItems(page).first().click({ force: true });
    await expect(currentScene(page)).toHaveText('fixture-c');

    expectNoErrors(errors);
  });

  test('enabling or disabling a link in the Editor updates the navigation list', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: 'toggle-me' });
    await expect(navItems(page)).toHaveCount(1);

    // Drive the real B3 row checkbox, not the data layer.
    const row = page.locator('#scene-link-list .scene-link-item').first();
    await row.locator('.scene-link-item-enabled').uncheck({ force: true });
    await expect(navItems(page)).toHaveCount(0);
    await expect(navSection(page)).toBeHidden();

    await row.locator('.scene-link-item-enabled').check({ force: true });
    await expect(navItems(page)).toHaveCount(1);
    await expect(navSection(page)).toBeVisible();

    // A label edit reaches the navigation list too.
    await row.locator('.scene-link-item-label').fill('renamed');
    await row.locator('.scene-link-item-label').blur();
    await expect(navItems(page).first().locator('.scene-link-nav-label')).toHaveText('renamed');

    expectNoErrors(errors);
  });

  test('undoing a link creation removes it from the navigation list', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: 'to-b' });
    await expect(navItems(page)).toHaveCount(1);

    await page.click('#undo-btn', { force: true });
    await expect(navItems(page)).toHaveCount(0);

    await page.click('#redo-btn', { force: true });
    await expect(navItems(page)).toHaveCount(1);

    expectNoErrors(errors);
  });
});

test.describe('sceneLink Viewer navigation: compare mode', () => {
  test('navigating during compare follows switchToScene and leaves compare state alone', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { label: 'to-b' });

    await page.locator('#split-compare-btn').click();
    await expect(page.locator('#toolbar-compare')).toBeVisible();
    const compareSnapshot = () => page.evaluate(() => window.__compareStateForTests());
    const before = await compareSnapshot();
    expect(before.mode).toBe('split');

    await navItems(page).first().click({ force: true });

    // Same semantics as clicking a scene in the list during compare: the
    // single-view scene follows, the comparison itself is untouched.
    await expect(page.locator('#toolbar-compare')).toBeVisible();
    expect(await compareSnapshot()).toEqual(before);
    await expect(currentScene(page)).toHaveText('fixture-b');

    expectNoErrors(errors);
  });
});
