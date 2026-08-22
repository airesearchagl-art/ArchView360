// Panorama orientation contract.
//
// ArchView360 built its panorama sphere as SphereGeometry + BackSide with an
// untouched texture. three.js SphereGeometry carries a leading minus on x
// (vertex.x = -r*cos(phi)*sin(theta)), and BackSide only changes which faces
// are culled — it moves no vertex and edits no UV. The canonical three.js
// equirectangular example instead uses geometry.scale(-1,1,1) with the
// default FrontSide, which differs from plain BackSide by exactly one
// horizontal mirror. The result was that the default view was mirrored and
// scene.flipH=true was the upright state: users flipping their scenes were
// cancelling ArchView360's own mirror, not correcting their renderer.
//
// These tests pin the corrected convention as one coordinate system —
// texture mapping, flipH meaning, camera theta -> floor heading, and
// sceneLink heading -> theta all move together, so none of them can be
// "fixed" alone later.
//
// Convention after the fix, sampled texture u at camera theta:
//   flipH=false (upright): u = (0.5 + theta/360) mod 1
//   flipH=true  (mirror):  u = (0.5 - theta/360) mod 1
// theta=0 still shows the image centre, so the initial framing is unchanged.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { gotoApp, expectNoErrors, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');

function sceneItems(page) { return page.locator('#scene-list .scene-item'); }

async function loadScenes(page, files = [FIXTURE_A, FIXTURE_B]) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles(files);
  await expect(sceneItems(page)).toHaveCount(files.length);
}

// Raycasts the REAL sphere the app built, from the eye along the app's own
// forward vector for `thetaDeg` at the equator, and returns the texture u
// actually sampled there — repeat/offset included. This is the effective
// mapping, not a restatement of the formula.
async function sampledU(page, thetaDeg, side) {
  return page.evaluate(
    ([t, s]) => window.__panoramaOrientationTestHooks.sampledUAt(t, s),
    [thetaDeg, side ?? null]
  );
}

async function floorRotation(page, thetaDeg, flipH) {
  return page.evaluate(
    ([t, f]) => window.__panoramaOrientationTestHooks.floorRotationFor(t, f),
    [thetaDeg, flipH]
  );
}

// Writes a project JSON to a temp file and returns its path.
function writeJson(obj, tag) {
  const p = path.join(os.tmpdir(), `orientation-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
}

// A project exactly as builds before this fix wrote them: no
// panoramaOrientationVersion field at all.
function legacyProject({ flipped }) {
  return {
    appVersion: '2.23.0',
    exportedAt: new Date().toISOString(),
    projectName: '架空レガシー案件',
    projectInfo: { client: '', author: '', date: '', notes: '' },
    scenes: [
      { id: 'sc-a', name: 'fixture-a', fileName: 'fixture-a.png', flipped, floorplanId: 'fp-1', groupId: null },
      { id: 'sc-b', name: 'fixture-b', fileName: 'fixture-b.png', flipped: false, floorplanId: 'fp-1', groupId: null },
    ],
    groups: [],
    floorplans: [{ id: 'fp-1', name: '1F', fileName: 'fixture-c.png', rotationOffset: 0 }],
    markers: [
      { id: 'mk-1', sceneId: 'sc-a', floorplanId: 'fp-1', x: 0.5, y: 0.5, rotation: 123, order: 1, name: 'fixture-a' },
    ],
    sceneLinks: [
      { id: 'lk-1', sourceSceneId: 'sc-a', targetSceneId: 'sc-b', heading: 45, label: 'to-b', order: 1, enabled: true },
    ],
    compareSets: [],
  };
}

async function importProject(page, jsonPath) {
  await page.locator('#json-import-input').setInputFiles(jsonPath);
  await page.locator('#import-images-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
  await expect(sceneItems(page)).toHaveCount(2);
}

async function exportJson(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#export-json-btn', { force: true }),
  ]);
  const p = await download.path();
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  return data;
}

test.describe('panorama orientation: default texture mapping', () => {
  test('theta=0 shows the centre of the image', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page);

    expect(await sampledU(page, 0)).toBeCloseTo(0.5, 4);

    expectNoErrors(errors);
  });

  test('theta=90 shows the RIGHT half of the image', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page);

    // Turning right must walk towards the right of the source image.
    // Before the fix this sampled 0.25 — the left half — which is the
    // mirror this whole change exists to remove.
    expect(await sampledU(page, 90)).toBeCloseTo(0.75, 4);

    expectNoErrors(errors);
  });

  test('theta=270 shows the LEFT half of the image', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page);

    expect(await sampledU(page, 270)).toBeCloseTo(0.25, 4);

    expectNoErrors(errors);
  });

  test('u advances monotonically with theta all the way round', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page);

    for (const theta of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const expected = (((0.5 + theta / 360) % 1) + 1) % 1;
      expect(await sampledU(page, theta)).toBeCloseTo(expected, 4);
    }

    expectNoErrors(errors);
  });

  test('flipH=true mirrors the mapping', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page);
    await page.click('#flip-btn', { force: true });
    await expect(page.locator('#flip-btn')).toHaveClass(/active/);

    // The user-requested mirror: theta=90 now samples the left half.
    expect(await sampledU(page, 90)).toBeCloseTo(0.25, 4);
    expect(await sampledU(page, 0)).toBeCloseTo(0.5, 4);   // centre either way

    expectNoErrors(errors);
  });
});

test.describe('panorama orientation: compare spheres match', () => {
  test('compare A and B use the same mapping as the single view', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page);
    await page.locator('#split-compare-btn').click();
    await expect(page.locator('#toolbar-compare')).toBeVisible();
    await expect.poll(() => sampledU(page, 90, 'a')).not.toBeNull();
    await expect.poll(() => sampledU(page, 90, 'b')).not.toBeNull();

    expect(await sampledU(page, 0,  'a')).toBeCloseTo(0.5,  4);
    expect(await sampledU(page, 90, 'a')).toBeCloseTo(0.75, 4);
    expect(await sampledU(page, 0,  'b')).toBeCloseTo(0.5,  4);
    expect(await sampledU(page, 90, 'b')).toBeCloseTo(0.75, 4);

    expectNoErrors(errors);
  });
});

test.describe('panorama orientation: heading sign convention', () => {
  test('thetaToFloorRotation uses the new sign for an upright scene', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page);

    // sign = flipH ? +1 : -1 (inverted together with the texture default,
    // so marker.rotation stays the same function of real-world azimuth).
    expect(await floorRotation(page, 90,  false)).toBe(270);
    expect(await floorRotation(page, 270, false)).toBe(90);
    expect(await floorRotation(page, 0,   false)).toBe(0);
    expect(await floorRotation(page, 180, false)).toBe(180);

    expectNoErrors(errors);
  });

  test('thetaToFloorRotation uses the new sign for a mirrored scene', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page);

    expect(await floorRotation(page, 90,  true)).toBe(90);
    expect(await floorRotation(page, 270, true)).toBe(270);

    expectNoErrors(errors);
  });

  test('a captured sceneLink heading recovers the camera theta it was taken at', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page);

    for (const flip of [false, true]) {
      if (flip) {
        await page.click('#flip-btn', { force: true });
        await expect(page.locator('#flip-btn')).toHaveClass(/active/);
      }
      for (const theta of [0, 30, 90, 200, 315]) {
        const recovered = await page.evaluate((t) => {
          const h = window.__panoramaOrientationTestHooks;
          h.setThetaDegForTests(t);
          const ids = window.__sceneLinkTestHooks.sceneIds();
          const heading = window.__sceneLinkUiTestHooks.currentCameraHeading();
          // Round-trip through the stored form: capture -> store -> recover.
          return h.thetaFromHeadingForTests(heading, ids[0]);
        }, theta);
        expect(recovered).toBe(theta);
      }
    }

    expectNoErrors(errors);
  });
});

test.describe('panorama orientation: legacy project migration', () => {
  test('a legacy project keeps looking exactly as it did (flipped=true stays upright)', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    // Legacy flipped=true rendered upright under the old mirrored default.
    await importProject(page, writeJson(legacyProject({ flipped: true }), 'flipped-true'));

    // The flag is inverted so the appearance survives the convention change.
    const data = await exportJson(page);
    expect(data.scenes.find(s => s.id === 'sc-a').flipped).toBe(false);
    expect(await sampledU(page, 90)).toBeCloseTo(0.75, 4); // upright, as before

    expectNoErrors(errors);
  });

  test('a legacy flipped=false scene also keeps its old appearance (mirrored)', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    await importProject(page, writeJson(legacyProject({ flipped: false }), 'flipped-false'));

    // It looked mirrored before, so it still looks mirrored — the user can
    // now un-flip it, which is what the flag finally means.
    const data = await exportJson(page);
    expect(data.scenes.find(s => s.id === 'sc-a').flipped).toBe(true);
    expect(await sampledU(page, 90)).toBeCloseTo(0.25, 4);

    expectNoErrors(errors);
  });

  test('migration leaves marker.rotation and sceneLink.heading untouched', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    const legacy = legacyProject({ flipped: true });
    await importProject(page, writeJson(legacy, 'values'));

    const data = await exportJson(page);
    // The stored numbers encode real-world azimuth in a form that is
    // convention-independent; inverting the sign AND the flag together is
    // exactly what keeps them valid, so migration must not rewrite them.
    expect(data.markers.find(m => m.id === 'mk-1').rotation).toBe(123);
    expect(data.sceneLinks.find(l => l.id === 'lk-1').heading).toBe(45);

    expectNoErrors(errors);
  });

  test('a new-format project is not migrated again', async ({ page }) => {
    const errors = await gotoApp(page);
    await enterEditor(page);
    const modern = { ...legacyProject({ flipped: true }), panoramaOrientationVersion: 2 };
    await importProject(page, writeJson(modern, 'modern'));

    const data = await exportJson(page);
    expect(data.panoramaOrientationVersion).toBe(2);
    expect(data.scenes.find(s => s.id === 'sc-a').flipped).toBe(true); // unchanged

    expectNoErrors(errors);
  });

  test('legacy import -> export -> re-import migrates exactly once', async ({ page }) => {
    const errors1 = await gotoApp(page);
    await enterEditor(page);
    await importProject(page, writeJson(legacyProject({ flipped: true }), 'once'));
    const once = await exportJson(page);
    expect(once.panoramaOrientationVersion).toBe(2);
    expect(once.scenes.find(s => s.id === 'sc-a').flipped).toBe(false);
    expectNoErrors(errors1);

    // Feed the exported (already-migrated) project back into a fresh session.
    const errors2 = await gotoApp(page);
    await enterEditor(page);
    await importProject(page, writeJson(once, 'twice'));
    const twice = await exportJson(page);

    expect(twice.scenes.find(s => s.id === 'sc-a').flipped).toBe(false); // not re-inverted
    expect(twice.markers.find(m => m.id === 'mk-1').rotation).toBe(123);
    expect(twice.sceneLinks.find(l => l.id === 'lk-1').heading).toBe(45);
    expect(await sampledU(page, 90)).toBeCloseTo(0.75, 4);

    expectNoErrors(errors2);
  });

  test('a fresh project exports the new orientation version', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadScenes(page);

    const data = await exportJson(page);
    expect(data.panoramaOrientationVersion).toBe(2);
    expect(data.scenes[0].flipped).toBe(false);

    expectNoErrors(errors);
  });
});
