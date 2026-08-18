// B2 coverage for the sceneLink / tour-graph data model
// (docs/SceneLink_TourGraph_Investigation.md). B2 adds the data model,
// persistence, Undo/Redo and cascade contracts only — there is deliberately
// no UI yet (that is B3), so these tests drive the same production commit
// functions B3 will later wire to buttons, through the documented
// window.__sceneLinkTestHooks seam. Same "test-only, never read by
// production code" rule as the existing window.__historyManagerForTests /
// window.__viewerPreviewTestHooks / window.__activeCompareSetIdForTests.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');

function sceneItems(page) { return page.locator('#scene-list .scene-item'); }

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

async function links(page) {
  return page.evaluate(() => window.__sceneLinkTestHooks.list());
}

async function sceneIds(page) {
  return page.evaluate(() => window.__sceneLinkTestHooks.sceneIds());
}

// Creates a link through the production commit point and returns its id
// (null when the commit was rejected/no-op).
async function createLink(page, sourceSceneId, targetSceneId, heading, label) {
  return page.evaluate(
    ([s, t, h, l]) => window.__sceneLinkTestHooks.create({
      sourceSceneId: s, targetSceneId: t, heading: h, label: l,
    }),
    [sourceSceneId, targetSceneId, heading, label ?? '']
  );
}

// Loads three scenes into an empty project (a load, not an edit — stays
// clean) and clears history so each test starts from a known baseline.
async function loadThreeScenes(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
  await expect(sceneItems(page)).toHaveCount(3);
  await page.evaluate(() => window.__historyManagerForTests.clear());
  await expect(dirtyIndicator(page)).toBeHidden();
  return sceneIds(page);
}

// Exports a real project JSON (also the app's only markProjectClean() path)
// and returns the parsed object.
async function exportJson(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#export-json-btn', { force: true }),
  ]);
  const p = await download.path();
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  await download.delete();
  return data;
}

test.describe('sceneLink: data model, persistence and validation', () => {
  test('a project with no links exports an empty sceneLinks array and stays backward compatible', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    const data = await exportJson(page);
    expect(Array.isArray(data.sceneLinks)).toBe(true);
    expect(data.sceneLinks).toHaveLength(0);

    expectNoErrors(errors);
  });

  test('created links survive a JSON export/import round trip with every field intact', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b] = await loadThreeScenes(page);
    const id = await createLink(page, a, b, 90, '北の部屋へ');
    expect(id).toBeTruthy();

    const data = await exportJson(page);
    expect(data.sceneLinks).toHaveLength(1);
    expect(data.sceneLinks[0]).toMatchObject({
      id, sourceSceneId: a, targetSceneId: b, heading: 90, label: '北の部屋へ', enabled: true,
    });

    expectNoErrors(errors);
  });

  test('import drops links whose source or target scene is missing, and keeps valid ones', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    // Import a JSON that references one present scene pair and one ghost id.
    const imported = await page.evaluate(() => {
      const ids = window.__sceneLinkTestHooks.sceneIds();
      return window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: 'lk-ok', sourceSceneId: ids[0], targetSceneId: ids[1], heading: 10, enabled: true },
          { id: 'lk-ghost-src', sourceSceneId: 'nope', targetSceneId: ids[1], heading: 20, enabled: true },
          { id: 'lk-ghost-tgt', sourceSceneId: ids[0], targetSceneId: 'nope', heading: 30, enabled: true },
          { id: 'lk-self', sourceSceneId: ids[0], targetSceneId: ids[0], heading: 40, enabled: true },
        ],
      });
    });
    expect(imported.map(l => l.id)).toEqual(['lk-ok']);

    expectNoErrors(errors);
  });

  test('a project JSON with no sceneLinks key imports cleanly as an empty graph', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    const imported = await page.evaluate(() => window.__sceneLinkTestHooks.importForTests({}));
    expect(imported).toEqual([]);
    expect(await links(page)).toEqual([]);

    expectNoErrors(errors);
  });

  test('a second enabled link for the same source->target pair is rejected as a no-op', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b] = await loadThreeScenes(page);
    const first = await createLink(page, a, b, 90);
    expect(first).toBeTruthy();
    const countsAfterFirst = await historyCounts(page);

    const second = await createLink(page, a, b, 180);
    expect(second).toBeNull();
    expect(await links(page)).toHaveLength(1);
    // No mutation means no extra history entry.
    expect(await historyCounts(page)).toEqual(countsAfterFirst);

    expectNoErrors(errors);
  });

  test('a link to a nonexistent scene, or from a scene to itself, is rejected', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a] = await loadThreeScenes(page);

    expect(await createLink(page, a, 'ghost', 0)).toBeNull();
    expect(await createLink(page, a, a, 0)).toBeNull();
    expect(await links(page)).toHaveLength(0);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('heading is normalized into 0..359 on create', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b, c] = await loadThreeScenes(page);
    await createLink(page, a, b, 450);
    await createLink(page, a, c, -90);

    const all = await links(page);
    expect(all.map(l => l.heading).sort((x, y) => x - y)).toEqual([90, 270]);

    expectNoErrors(errors);
  });
});

test.describe('sceneLink: lifecycle history (undo/redo)', () => {
  test('creating a link pushes exactly one entry, marks dirty, and undo/redo round-trips it', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b] = await loadThreeScenes(page);

    const id = await createLink(page, a, b, 90, 'to B');
    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(await links(page)).toHaveLength(0);

    await page.evaluate(() => window.__historyManagerForTests.redo());
    const restored = await links(page);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ id, sourceSceneId: a, targetSceneId: b, heading: 90, label: 'to B' });

    expectNoErrors(errors);
  });

  test('deleting a link pushes one entry and undo restores the same link object', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b] = await loadThreeScenes(page);
    const id = await createLink(page, a, b, 90, 'to B');
    await page.evaluate(() => window.__historyManagerForTests.clear());

    await page.evaluate((lid) => window.__sceneLinkTestHooks.remove(lid), id);
    expect(await links(page)).toHaveLength(0);
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    const back = await links(page);
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ id, heading: 90, label: 'to B' });

    expectNoErrors(errors);
  });

  test('heading / target / label edits each push one entry and undo/redo round-trip', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b, c] = await loadThreeScenes(page);
    const id = await createLink(page, a, b, 90, 'old');
    await page.evaluate(() => window.__historyManagerForTests.clear());

    await page.evaluate((lid) => window.__sceneLinkTestHooks.setHeading(lid, 200), id);
    await page.evaluate(([lid, t]) => window.__sceneLinkTestHooks.setTarget(lid, t), [id, c]);
    await page.evaluate((lid) => window.__sceneLinkTestHooks.setLabel(lid, 'new'), id);
    expect(await historyCounts(page)).toEqual({ undoCount: 3, redoCount: 0 });
    expect((await links(page))[0]).toMatchObject({ heading: 200, targetSceneId: c, label: 'new' });

    await page.evaluate(() => {
      window.__historyManagerForTests.undo();
      window.__historyManagerForTests.undo();
      window.__historyManagerForTests.undo();
    });
    expect((await links(page))[0]).toMatchObject({ heading: 90, targetSceneId: b, label: 'old' });

    await page.evaluate(() => {
      window.__historyManagerForTests.redo();
      window.__historyManagerForTests.redo();
      window.__historyManagerForTests.redo();
    });
    expect((await links(page))[0]).toMatchObject({ heading: 200, targetSceneId: c, label: 'new' });

    expectNoErrors(errors);
  });

  test('re-applying the same heading or label is a no-op and pushes nothing', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b] = await loadThreeScenes(page);
    const id = await createLink(page, a, b, 90, 'same');
    await page.evaluate(() => window.__historyManagerForTests.clear());

    await page.evaluate((lid) => window.__sceneLinkTestHooks.setHeading(lid, 90), id);
    await page.evaluate((lid) => window.__sceneLinkTestHooks.setLabel(lid, 'same'), id);

    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('Viewer mode: creating, deleting and editing links is blocked and never touches state', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b] = await loadThreeScenes(page);
    const id = await createLink(page, a, b, 90, 'kept');
    await exportJson(page); // back to clean so a stray dirty is detectable
    await page.evaluate(() => window.__historyManagerForTests.clear());

    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);

    expect(await createLink(page, b, a, 10)).toBeNull();
    await page.evaluate((lid) => window.__sceneLinkTestHooks.remove(lid), id);
    await page.evaluate((lid) => window.__sceneLinkTestHooks.setHeading(lid, 250), id);
    await page.evaluate((lid) => window.__sceneLinkTestHooks.setLabel(lid, 'hacked'), id);

    const after = await links(page);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id, heading: 90, label: 'kept' });
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeHidden();

    expectNoErrors(errors);
  });
});

test.describe('sceneLink: scene-delete cascade (execution-scoped)', () => {
  // Deleting a scene must remove links in BOTH directions, and undo must
  // bring back exactly what that execution removed.
  test('deleting a scene removes inbound and outbound links, and undo restores them', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b, c] = await loadThreeScenes(page);
    const outbound = await createLink(page, b, c, 10); // B -> C
    const inbound  = await createLink(page, a, b, 20); // A -> B
    const unrelated = await createLink(page, a, c, 30); // A -> C
    await page.evaluate(() => window.__historyManagerForTests.clear());

    await page.evaluate((sid) => window.__sceneLinkTestHooks.deleteSceneForTests(sid), b);

    const afterDelete = await links(page);
    expect(afterDelete.map(l => l.id)).toEqual([unrelated]);

    await page.evaluate(() => window.__historyManagerForTests.undo());
    const afterUndo = await links(page);
    expect(afterUndo.map(l => l.id).sort()).toEqual([inbound, outbound, unrelated].sort());

    expectNoErrors(errors);
  });

  // The execution-scoped contract: a redo must re-scan rather than replay a
  // stale capture, so a link created during the undo window is removed too.
  test('a link created during the undo window is removed by the next redo and restored by its undo', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b, c] = await loadThreeScenes(page);
    const inbound = await createLink(page, a, b, 20);
    const unrelated = await createLink(page, a, c, 30);
    await page.evaluate(() => window.__historyManagerForTests.clear());

    await page.evaluate((sid) => window.__sceneLinkTestHooks.deleteSceneForTests(sid), b);
    // Capture the delete entry's own closures now, while it is still on the
    // undo stack: creating a link below pushes a new entry, which truncates
    // the redo stack the entry would otherwise be sitting on. Same
    // stale-closure technique the U7/U8 specs use to reach an entry whose
    // stack slot a later push has taken away.
    await page.evaluate(() => {
      window.__sceneDeleteEntry =
        window.__historyManagerForTests._undoStack.find(e => e.label === 'Delete scene');
    });
    await page.evaluate(() => window.__sceneDeleteEntry.undo());

    // Inside the undo window: a NEW link that also touches the deleted scene.
    const during = await createLink(page, c, b, 40); // C -> B
    expect(during).toBeTruthy();

    await page.evaluate(() => window.__sceneDeleteEntry.redo());

    expect((await links(page)).map(l => l.id)).toEqual([unrelated]);

    await page.evaluate(() => window.__sceneDeleteEntry.undo());
    expect((await links(page)).map(l => l.id).sort()).toEqual([during, inbound, unrelated].sort());

    expectNoErrors(errors);
  });

  // The other half of the contract: a link deleted by hand during the undo
  // window must not be resurrected by a later undo (the U8 failure class).
  test('a link deleted during the undo window is not resurrected by the next undo', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b, c] = await loadThreeScenes(page);
    const inbound = await createLink(page, a, b, 20);
    const outbound = await createLink(page, b, c, 10);
    await page.evaluate(() => window.__historyManagerForTests.clear());

    await page.evaluate((sid) => window.__sceneLinkTestHooks.deleteSceneForTests(sid), b);
    // Captured before the undo window, for the same reason as the test above:
    // deleting a link inside the window pushes an entry that truncates the
    // redo stack.
    await page.evaluate(() => {
      window.__sceneDeleteEntry =
        window.__historyManagerForTests._undoStack.find(e => e.label === 'Delete scene');
    });
    await page.evaluate(() => window.__sceneDeleteEntry.undo());

    // Inside the undo window: remove one of the restored links for good.
    await page.evaluate((lid) => window.__sceneLinkTestHooks.remove(lid), inbound);

    await page.evaluate(() => window.__sceneDeleteEntry.redo());
    await page.evaluate(() => window.__sceneDeleteEntry.undo());

    // Only the link that actually existed at redo time comes back.
    expect((await links(page)).map(l => l.id)).toEqual([outbound]);

    expectNoErrors(errors);
  });

  test('undoing a scene add also removes links that were attached to it afterwards', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b] = await loadThreeScenes(page);
    await page.evaluate(() => window.__historyManagerForTests.clear());

    // A tracked scene add (the project is non-empty, so this pushes history).
    await page.locator('#file-input').setInputFiles(FIXTURE_C);
    await expect(sceneItems(page)).toHaveCount(4);
    const allIds = await sceneIds(page);
    const added = allIds[3];

    const toAdded = await createLink(page, a, added, 15);
    const unrelated = await createLink(page, a, b, 25);
    expect(toAdded).toBeTruthy();

    // Undo the scene add via its own captured closure (the link creates are
    // stacked on top of it).
    await page.evaluate(() => {
      const st = window.__historyManagerForTests._undoStack;
      window.__addEntry = st.find(e => e.label === 'Add scene');
    });
    await page.evaluate(() => window.__addEntry.undo());

    expect((await links(page)).map(l => l.id)).toEqual([unrelated]);

    await page.evaluate(() => window.__addEntry.redo());
    expect((await links(page)).map(l => l.id).sort()).toEqual([toAdded, unrelated].sort());

    expectNoErrors(errors);
  });
});

test.describe('sceneLink: flipH heading migration', () => {
  // docs section 6.4: flipping the SOURCE scene must preserve the physical
  // (world) direction, so the stored marker-space heading is re-encoded.
  test('flipping the source scene re-encodes heading so the world direction is unchanged', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b] = await loadThreeScenes(page);
    const id = await createLink(page, a, b, 90);

    const thetaBefore = await page.evaluate((lid) => window.__sceneLinkTestHooks.thetaDegOf(lid), id);
    expect(thetaBefore).toBe(90);

    // Scene A is current (index 0) — flip it through the real toolbar path.
    await page.locator('#flip-btn').click();

    const after = (await links(page))[0];
    expect(after.heading).toBe(270); // (360 - 90) % 360
    expect(await page.evaluate((lid) => window.__sceneLinkTestHooks.thetaDegOf(lid), id)).toBe(thetaBefore);

    expectNoErrors(errors);
  });

  test('undoing the flip restores the original heading in the same history entry', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b] = await loadThreeScenes(page);
    const id = await createLink(page, a, b, 90);
    await page.evaluate(() => window.__historyManagerForTests.clear());

    await page.locator('#flip-btn').click();
    expect((await links(page))[0].heading).toBe(270);
    // The flip and the heading migration are one atomic entry, not two.
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    await page.evaluate(() => window.__historyManagerForTests.undo());
    expect((await links(page))[0].heading).toBe(90);

    await page.evaluate(() => window.__historyManagerForTests.redo());
    expect((await links(page))[0].heading).toBe(270);

    expectNoErrors(errors);
  });

  test('flipping a scene only re-encodes links it is the SOURCE of', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b, c] = await loadThreeScenes(page);
    const outbound = await createLink(page, a, b, 90); // A is source
    const inbound  = await createLink(page, c, a, 90); // A is only the target

    await page.locator('#flip-btn').click(); // flips scene A (current)

    const byId = Object.fromEntries((await links(page)).map(l => [l.id, l]));
    expect(byId[outbound].heading).toBe(270);
    expect(byId[inbound].heading).toBe(90);

    expectNoErrors(errors);
  });
});
