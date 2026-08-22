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
const os = require('os');
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

// Same export, but keeps the file on disk so it can be fed straight back
// through the real #json-import-input path.
async function exportDownloadPath(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#export-json-btn', { force: true }),
  ]);
  return download.path();
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

// createSceneLink() enforces the docs §5.1 invariants at the UI commit point,
// but a project JSON is hand-editable and can also come from an older build,
// so the import path has to re-derive them rather than trust the payload.
// These pin the import side of the same contract.
test.describe('sceneLink: import invariants', () => {
  test('import keeps only the first of two enabled links for the same source->target pair', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    const imported = await page.evaluate(() => {
      const ids = window.__sceneLinkTestHooks.sceneIds();
      return window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: 'lk-first',  sourceSceneId: ids[0], targetSceneId: ids[1], heading: 10, enabled: true },
          { id: 'lk-second', sourceSceneId: ids[0], targetSceneId: ids[1], heading: 20, enabled: true },
        ],
      });
    });
    expect(imported.map(l => l.id)).toEqual(['lk-first']);
    expect(await links(page)).toHaveLength(1);

    expectNoErrors(errors);
  });

  test('import rejects an enabled link duplicating a pair the project already has', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b] = await loadThreeScenes(page);
    const existing = await createLink(page, a, b, 90, 'existing');
    expect(existing).toBeTruthy();

    const imported = await page.evaluate(() => {
      const ids = window.__sceneLinkTestHooks.sceneIds();
      return window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: 'lk-clash', sourceSceneId: ids[0], targetSceneId: ids[1], heading: 200, enabled: true },
        ],
      });
    });
    expect(imported).toEqual([]);
    const all = await links(page);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: existing, heading: 90, label: 'existing' });

    expectNoErrors(errors);
  });

  test('import allows several DISABLED links for a pair that already has an enabled one', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    const imported = await page.evaluate(() => {
      const ids = window.__sceneLinkTestHooks.sceneIds();
      return window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: 'lk-on',  sourceSceneId: ids[0], targetSceneId: ids[1], heading: 10, enabled: true },
          { id: 'lk-off', sourceSceneId: ids[0], targetSceneId: ids[1], heading: 20, enabled: false },
          { id: 'lk-off2', sourceSceneId: ids[0], targetSceneId: ids[1], heading: 30, enabled: false },
        ],
      });
    });
    // §5.1 constrains the ENABLED edge set only — disabled duplicates are data,
    // not a second edge, so they survive.
    expect(imported.map(l => l.id)).toEqual(['lk-on', 'lk-off', 'lk-off2']);

    expectNoErrors(errors);
  });

  test('import rejects a link id repeated inside the same payload', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    const imported = await page.evaluate(() => {
      const ids = window.__sceneLinkTestHooks.sceneIds();
      return window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: 'dup', sourceSceneId: ids[0], targetSceneId: ids[1], heading: 10, enabled: true },
          { id: 'dup', sourceSceneId: ids[0], targetSceneId: ids[2], heading: 20, enabled: true },
        ],
      });
    });
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ id: 'dup', heading: 10 });

    expectNoErrors(errors);
  });

  test('import normalizes headings from hand-edited or legacy JSON', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    const imported = await page.evaluate(() => {
      const ids = window.__sceneLinkTestHooks.sceneIds();
      return window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: 'lk-over',  sourceSceneId: ids[0], targetSceneId: ids[1], heading: 450,   enabled: true },
          { id: 'lk-under', sourceSceneId: ids[0], targetSceneId: ids[2], heading: -90,   enabled: true },
          { id: 'lk-frac',  sourceSceneId: ids[1], targetSceneId: ids[2], heading: 12.6,  enabled: true },
        ],
      });
    });
    expect(imported.map(l => l.heading)).toEqual([90, 270, 13]);

    expectNoErrors(errors);
  });

  // Merge semantics: the import path appends scenes (scenes.push(...newScenes))
  // and merges markers with replace-by-id, so sceneLinks follow the marker
  // rule — an imported link replaces the existing link with the same id, and
  // links the payload never mentions are kept, because their endpoint scenes
  // are still present after the merge.
  test('an imported link replaces the existing link that shares its id', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b, c] = await loadThreeScenes(page);
    const id = await createLink(page, a, b, 90, 'before');
    expect(id).toBeTruthy();

    const imported = await page.evaluate(
      ([linkId, src, tgt]) => window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: linkId, sourceSceneId: src, targetSceneId: tgt, heading: 5, label: 'after', enabled: true },
        ],
      }),
      [id, a, c]
    );
    expect(imported).toHaveLength(1);

    const all = await links(page);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id, sourceSceneId: a, targetSceneId: c, heading: 5, label: 'after' });

    expectNoErrors(errors);
  });

  test('links the imported payload does not mention are kept', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b, c] = await loadThreeScenes(page);
    const kept = await createLink(page, a, b, 90, 'kept');
    expect(kept).toBeTruthy();

    await page.evaluate(
      ([src, tgt]) => window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: 'lk-new', sourceSceneId: src, targetSceneId: tgt, heading: 45, enabled: true },
        ],
      }),
      [c, a]
    );

    const all = await links(page);
    expect(all.map(l => l.id).sort()).toEqual([kept, 'lk-new'].sort());

    expectNoErrors(errors);
  });

  test('a real project import merges its links alongside the ones already loaded', async ({ page }) => {
    // Session 1 — build and export a donor project that carries its own link.
    const errors1 = await gotoApp(page);
    const [d1, d2] = await loadThreeScenes(page);
    const donorLink = await createLink(page, d1, d2, 120, 'donor');
    expect(donorLink).toBeTruthy();
    const donorJson = await exportDownloadPath(page);
    expectNoErrors(errors1);

    // Session 2 — a different project, with a link of its own between two
    // scenes that the import will NOT touch.
    const errors2 = await gotoApp(page);
    const [h1, h2] = await loadThreeScenes(page);
    const hostLink = await createLink(page, h1, h2, 30, 'host');
    expect(hostLink).toBeTruthy();

    await page.locator('#json-import-input').setInputFiles(donorJson);
    await page.locator('#import-images-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
    await expect(page.locator('#dirty-confirm-modal')).toBeVisible(); // the host link made it dirty
    await page.click('#dirty-confirm-discard-btn', { force: true });
    await expect(page.locator('#import-modal')).toBeHidden();
    await expect.poll(() => sceneItems(page).count()).toBe(6); // 3 host + 3 donor, appended

    // The host link's endpoints both survived the merge, so dropping it would
    // be silent data loss; the donor link arrives alongside it.
    await expect.poll(async () => (await links(page)).map(l => l.label).sort())
      .toEqual(['donor', 'host']);

    expectNoErrors(errors2);
  });

  // Replacement has to be transactional per id: the existing link is only
  // given up once its replacement has cleared every invariant. Removing it up
  // front and validating afterwards loses it whenever the candidate is
  // rejected late — the incoming row is discarded AND the row it was meant to
  // replace is already gone.
  test('a replacement rejected by the enabled-pair rule leaves the existing link untouched', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b, c] = await loadThreeScenes(page);
    const x = await createLink(page, a, b, 90, 'X');  // X: a -> b
    const y = await createLink(page, b, c, 45, 'Y');  // Y: b -> c
    expect(x).toBeTruthy();
    expect(y).toBeTruthy();

    // Incoming X wants to become b -> c, which Y already owns as an enabled
    // edge, so the replacement must be refused outright.
    const imported = await page.evaluate(
      ([linkId, src, tgt]) => window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: linkId, sourceSceneId: src, targetSceneId: tgt, heading: 200, label: 'X2', enabled: true },
        ],
      }),
      [x, b, c]
    );
    expect(imported).toEqual([]);

    const all = await links(page);
    expect(all).toHaveLength(2);
    expect(all.find(l => l.id === x)).toMatchObject({
      sourceSceneId: a, targetSceneId: b, heading: 90, label: 'X',
    });
    expect(all.find(l => l.id === y)).toMatchObject({
      sourceSceneId: b, targetSceneId: c, heading: 45, label: 'Y',
    });

    expectNoErrors(errors);
  });

  test('a replacement onto the pair the existing link already owns is still accepted', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b] = await loadThreeScenes(page);
    const x = await createLink(page, a, b, 90, 'before');
    expect(x).toBeTruthy();

    // Same edge, same id — the only enabled a->b link is the one being
    // replaced, so it must not be treated as its own collision.
    const imported = await page.evaluate(
      ([linkId, src, tgt]) => window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: linkId, sourceSceneId: src, targetSceneId: tgt, heading: 7, label: 'after', enabled: true },
        ],
      }),
      [x, a, b]
    );
    expect(imported).toHaveLength(1);

    const all = await links(page);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: x, sourceSceneId: a, targetSceneId: b, heading: 7, label: 'after' });

    expectNoErrors(errors);
  });

  test('a rejected replacement arriving through the real import path also keeps the existing link', async ({ page }) => {
    const errors = await gotoApp(page);
    const [a, b, c] = await loadThreeScenes(page);
    const x = await createLink(page, a, b, 90, 'X');
    const y = await createLink(page, b, c, 45, 'Y');
    expect(x).toBeTruthy();
    expect(y).toBeTruthy();

    // Export to learn the real ids (and to leave the project clean, so the
    // import below needs no unsaved-changes confirmation), then hand-edit the
    // payload the way a user could: X repointed onto the edge Y owns. Scenes
    // are left out so the import only carries the link change.
    const exported = await exportJson(page);
    const incomingX = { ...exported.sceneLinks.find(l => l.id === x), sourceSceneId: b, targetSceneId: c };
    const payload = path.join(os.tmpdir(), `scene-link-rejected-${Date.now()}.json`);
    fs.writeFileSync(payload, JSON.stringify({
      projectName: exported.projectName,
      scenes: [], floorplans: [], markers: [],
      sceneLinks: [incomingX],
    }));

    await expect(dirtyIndicator(page)).toBeHidden();
    await page.locator('#json-import-input').setInputFiles(payload);
    await page.locator('#import-images-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
    await expect(page.locator('#import-modal')).toBeHidden();

    await expect.poll(async () => {
      const all = await links(page);
      return all.map(l => `${l.label}:${l.sourceSceneId === a ? 'a' : 'b'}->${l.targetSceneId === b ? 'b' : 'c'}`).sort();
    }).toEqual(['X:a->b', 'Y:b->c']);

    fs.unlinkSync(payload);
    expectNoErrors(errors);
  });

  test('a non-finite heading in hand-edited JSON does not become NaN', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    const imported = await page.evaluate(() => {
      const ids = window.__sceneLinkTestHooks.sceneIds();
      return window.__sceneLinkTestHooks.importForTests({
        sceneLinks: [
          { id: 'lk-inf', sourceSceneId: ids[0], targetSceneId: ids[1], heading: Infinity, enabled: true },
          { id: 'lk-str', sourceSceneId: ids[0], targetSceneId: ids[2], heading: 'north',  enabled: true },
          { id: 'lk-num', sourceSceneId: ids[1], targetSceneId: ids[2], heading: '135',    enabled: true },
        ],
      });
    });
    // Unusable degrees fall back to 0, the same as a missing heading; a
    // numeric string is still a number and is kept.
    expect(imported.map(l => l.heading)).toEqual([0, 0, 135]);

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
    // sign = flipH ? 1 : -1 (v2.24 orientation fix), so an unflipped scene
    // recovers theta = normalize(-90) = 270. The value that matters below is
    // that this does not move when the scene is flipped.
    expect(thetaBefore).toBe(270);

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
