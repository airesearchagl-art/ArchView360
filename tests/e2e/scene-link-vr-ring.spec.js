// B5-1 coverage for the sceneLink -> VR Scene Ring mapping
// (docs/SceneLink_TourGraph_Investigation.md sections 6.2.1 and 10).
//
// The Scene Ring was suspended in v2.20.2 because its evenly-spaced synthetic
// layout did not correspond to where the linked scenes actually are, which
// read as disorienting in a headset. B5-1 fixes the maths that has to replace
// that layout, and the choice of which links belong on the ring, as pure
// side-effect-free logic — testable without a headset. It deliberately does
// NOT re-enable the ring: VR_SCENE_RING_ENABLED stays false, no controller
// binding moves, and nothing about the current VR UX changes. Turning the
// ring on is B5-2 and is gated on Quest 3 verification.
//
// The direction contract these tests pin (section 6.2.1):
//   sign  = source scene flipH ? 1 : -1
//   theta = normalize(sign * heading)      <- world direction, recovered
//   a     = normalize(theta + 90)
//   x     = sin(a) * R,  z = -cos(a) * R
// The naive a = heading + 90 is what these tests exist to rule out: it agrees
// for the scene whose sign is +1 and mirrors by 180 degrees for the other.
// v2.24: the sign was inverted along with the panorama texture default (see
// buildSphere()), so the discriminating case is now flipH=FALSE — sign -1
// there, +1 when the user has mirrored the scene.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');

function sceneItems(page) { return page.locator('#scene-list .scene-item'); }

async function loadThreeScenes(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
  await expect(sceneItems(page)).toHaveCount(3);
  await page.evaluate(() => window.__historyManagerForTests.clear());
  await expect(dirtyIndicator(page)).toBeHidden();
}

async function ringRadius(page) {
  return page.evaluate(() => window.__sceneLinkRingTestHooks.radius());
}

// Drives the pure helper with a synthetic link/scene pair, so every flipH and
// heading combination can be checked without building a flipped project.
async function ringPos(page, heading, flipH) {
  return page.evaluate(
    ([h, f]) => window.__sceneLinkRingTestHooks.position(
      { heading: h }, { flipH: f }
    ),
    [heading, flipH]
  );
}

async function ringLayout(page) {
  return page.evaluate(() => window.__sceneLinkRingTestHooks.layout());
}

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

test.describe('sceneLink VR ring: direction mapping', () => {
  test('flipH=false maps the four cardinal headings onto the ring', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    const R = await ringRadius(page);
    expect(R).toBeGreaterThan(0);

    // sign -1 for an unmirrored scene.
    // heading 0 -> theta 0 -> a 90 -> +X
    let p = await ringPos(page, 0, false);
    expect(p.x).toBeCloseTo(R, 6);
    expect(p.z).toBeCloseTo(0, 6);

    // heading 90 -> theta 270 -> a 0 -> -Z.
    // The naive a = heading + 90 = 180 would give +Z: exactly 180 degrees
    // wrong, which is the disorientation that suspended the ring.
    p = await ringPos(page, 90, false);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(-R, 6);

    // heading 180 -> theta 180 -> a 270 -> -X
    p = await ringPos(page, 180, false);
    expect(p.x).toBeCloseTo(-R, 6);
    expect(p.z).toBeCloseTo(0, 6);

    // heading 270 -> theta 90 -> a 180 -> +Z
    p = await ringPos(page, 270, false);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(R, 6);

    expectNoErrors(errors);
  });

  test('flipH=true recovers theta with the opposite sign from an unmirrored scene', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    const R = await ringRadius(page);

    // heading 90, sign +1 -> theta 90 -> a 180 -> +Z. The mirror image of
    // the flipH=false case above: the same stored heading must land on the
    // opposite side, which is what makes the recovery step load-bearing.
    let p = await ringPos(page, 90, true);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(R, 6);

    // heading 270, sign +1 -> theta 270 -> a 0 -> -Z
    p = await ringPos(page, 270, true);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(-R, 6);

    // The two flipH states must genuinely disagree for a non-fixed-point
    // heading — a sign that did nothing would make these identical.
    const unmirrored = await ringPos(page, 90, false);
    expect(unmirrored.z).toBeCloseTo(-R, 6);

    expectNoErrors(errors);
  });

  test('heading 0 and 180 are the flipH fixed points', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    // normalize(-0) === 0 and normalize(-180) === 180, so these two headings
    // land in the same place either way — a useful negative control: a test
    // that only used them could not tell the two formulas apart.
    for (const heading of [0, 180]) {
      const a = await ringPos(page, heading, false);
      const b = await ringPos(page, heading, true);
      expect(b.x).toBeCloseTo(a.x, 6);
      expect(b.z).toBeCloseTo(a.z, 6);
    }

    expectNoErrors(errors);
  });

  test('out-of-range and fractional headings are normalized before mapping', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    const R = await ringRadius(page);

    for (const heading of [450, -270, 90.4]) {
      const p = await ringPos(page, heading, false); // all normalize to 90
      expect(p.x).toBeCloseTo(0, 6);
      expect(p.z).toBeCloseTo(-R, 6);
    }

    // A missing/unusable heading falls back to 0 rather than producing NaN.
    const p = await page.evaluate(() => window.__sceneLinkRingTestHooks.position({}, { flipH: false }));
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.z)).toBe(true);
    expect(p.x).toBeCloseTo(R, 6);
    expect(p.z).toBeCloseTo(0, 6);

    expectNoErrors(errors);
  });

  test('every mapped position sits on the ring circle', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    const R = await ringRadius(page);

    for (const flipH of [false, true]) {
      for (let heading = 0; heading < 360; heading += 30) {
        const p = await ringPos(page, heading, flipH);
        expect(Math.hypot(p.x, p.z)).toBeCloseTo(R, 6);
      }
    }

    expectNoErrors(errors);
  });

  test('the sign comes from the real source scene flipH', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    const R = await ringRadius(page);
    await makeLink(page, 0, 1, { heading: 90, label: 'to-b' });

    let layout = await ringLayout(page);
    expect(layout).toHaveLength(1);
    expect(layout[0].x).toBeCloseTo(0, 6);
    expect(layout[0].z).toBeCloseTo(-R, 6);  // flipH=false, sign -1 -> -Z

    // Flipping the source scene re-encodes the stored heading (B2 migration)
    // so the WORLD direction is preserved: the ring position must not move.
    await page.click('#flip-btn', { force: true });
    await expect.poll(async () => (await ringLayout(page))[0].z).toBeCloseTo(-R, 6);
    layout = await ringLayout(page);
    expect(layout[0].x).toBeCloseTo(0, 6);
    expect(layout[0].heading).toBe(270);     // stored value did change

    expectNoErrors(errors);
  });
});

test.describe('sceneLink VR ring: which links go on the ring', () => {
  test('only enabled outgoing links of the current scene are included', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { heading: 10, label: 'a-to-b' });
    await makeLink(page, 0, 2, { heading: 20, label: 'a-to-c-disabled', enabled: false });
    await makeLink(page, 1, 2, { heading: 30, label: 'b-to-c' });   // different source

    const layout = await ringLayout(page);
    expect(layout).toHaveLength(1);
    expect(layout[0].heading).toBe(10);

    expectNoErrors(errors);
  });

  test('a link whose target scene does not exist is excluded', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { heading: 10, label: 'ok' });
    await page.evaluate(() => {
      const ids = window.__sceneLinkTestHooks.sceneIds();
      window.__sceneLinkTestHooks.forceLinkForTests({
        id: 'lk-dangling', sourceSceneId: ids[0], targetSceneId: 'ghost-scene',
        heading: 200, label: 'nowhere', order: 99, enabled: true,
      });
    });

    expect((await page.evaluate(() => window.__sceneLinkTestHooks.list()))).toHaveLength(2);
    const layout = await ringLayout(page);
    expect(layout).toHaveLength(1);
    expect(layout[0].heading).toBe(10);

    expectNoErrors(errors);
  });

  test('the layout follows order', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 2, { heading: 10, label: 'first-made' });
    await makeLink(page, 0, 1, { heading: 20, label: 'second-made' });

    const layout = await ringLayout(page);
    expect(layout.map(r => r.heading)).toEqual([10, 20]);

    expectNoErrors(errors);
  });

  test('a scene with no outgoing links yields an empty layout', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    expect(await ringLayout(page)).toEqual([]);

    // Disabled-only is still empty.
    await makeLink(page, 0, 1, { heading: 10, enabled: false });
    expect(await ringLayout(page)).toEqual([]);

    expectNoErrors(errors);
  });

  test('the layout follows the current scene', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 1, { heading: 10, label: 'from-a' });
    await makeLink(page, 1, 2, { heading: 20, label: 'from-b' });

    expect((await ringLayout(page)).map(r => r.heading)).toEqual([10]);

    await sceneItems(page).nth(1).click({ force: true });
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');
    await expect.poll(async () => (await ringLayout(page)).map(r => r.heading)).toEqual([20]);

    expectNoErrors(errors);
  });

  test('each entry carries the identity B5-2 needs to re-resolve its target', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    const id = await makeLink(page, 0, 1, { heading: 45, label: 'to-b' });

    const layout = await ringLayout(page);
    expect(layout).toHaveLength(1);
    const entry = layout[0];
    expect(entry.linkId).toBe(id);
    expect(entry.heading).toBe(45);
    expect(typeof entry.targetSceneId).toBe('string');
    expect(entry.targetSceneId.length).toBeGreaterThan(0);
    // A scene index would be a stale identity the moment scenes are
    // reordered or deleted, so the entry must not carry one.
    expect(entry).not.toHaveProperty('sceneIdx');
    // targetSceneId really is scene 2's id.
    const ids = await page.evaluate(() => window.__sceneLinkTestHooks.sceneIds());
    expect(entry.targetSceneId).toBe(ids[1]);

    expectNoErrors(errors);
  });

  test('the ring set is the same set B4 navigation lists', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);
    await makeLink(page, 0, 2, { heading: 10, label: 'first' });
    await makeLink(page, 0, 1, { heading: 20, label: 'second' });
    await makeLink(page, 0, 1, { heading: 30, label: 'dup-disabled', enabled: false });

    // Both surfaces must derive from one definition, not two: the B4
    // navigation list and the ring layout are the same links in the same
    // order, so a future change cannot drift them apart silently.
    const navIds = await page.evaluate(() =>
      [...document.querySelectorAll('#scene-link-nav-list .scene-link-nav-btn')].map(b => b.dataset.linkId));
    const ringIds = (await ringLayout(page)).map(r => r.linkId);
    expect(ringIds).toEqual(navIds);
    expect(ringIds).toHaveLength(2);

    expectNoErrors(errors);
  });
});

test.describe('sceneLink VR ring: nothing about VR changes yet', () => {
  test('the Scene Ring feature flag is still off', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadThreeScenes(page);

    // B5-1 fixes the maths only. Re-enabling is B5-2, gated on Quest 3.
    expect(await page.evaluate(() => window.__sceneLinkRingTestHooks.featureEnabled())).toBe(false);

    expectNoErrors(errors);
  });
});
