// Regression coverage for the panorama-drag rotation bug: rotate()
// (script.js) updates the current scene's marker.rotation live while the
// user drags the panorama, and that value IS persisted (it round-trips
// through _buildProjectData()'s `markers: [...{...m}]`), yet the drag
// neither marked the project dirty nor pushed a HistoryManager entry.
// A user could therefore rotate a panorama, see the FloorMap cone follow,
// export a JSON carrying the new heading — with no unsaved indicator ever
// appearing and no way to undo it.
//
// Same shape as marker-attrs-history.spec.js (U1): drives the app's own
// historyManager through window.__historyManagerForTests, and reads the
// marker's heading from #floormap-info-dir, which _updateInfoPanel()
// already renders as `(mk.rotation || 0) + '°'` — no new production test
// hook is introduced here.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoApp, expectNoErrors, dirtyIndicator, enterEditor } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');
const MARKER_POS = { x: 50, y: 50 };

function infoDir(page) { return page.locator('#floormap-info-dir'); }

async function historyCounts(page) {
  return page.evaluate(() => ({
    undoCount: window.__historyManagerForTests.undoCount,
    redoCount: window.__historyManagerForTests.redoCount,
  }));
}

// Reads the selected marker's heading as an integer, from the same
// #floormap-info-dir cell the app already renders ("123°" -> 123).
async function rotationDeg(page) {
  const text = await infoDir(page).textContent();
  return parseInt(String(text).replace('°', ''), 10);
}

// Loads one scene + one floorplan and places a marker for that scene, then
// leaves placement mode — the state panorama rotation actually writes to
// (rotate() only touches a marker matching activeFloorplanId + current
// scene). Mirrors marker-attrs-history.spec.js's setup of the same name.
//
// The JSON export at the end is not incidental: placing the marker leaves
// the project dirty, and every test below needs a CLEAN starting point to
// prove the drag itself is what dirties it. Export is this app's only
// markProjectClean() path, so it doubles as the reset. history is cleared
// afterward so each test starts from {undoCount:0, redoCount:0}.
async function loadSceneFloorplanAndMarker(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles(FIXTURE_A);
  await page.locator('#add-floorplan-btn').click();
  await page.locator('#floorplan-input').setInputFiles(FIXTURE_B);
  await page.locator('#floormap-place-btn').click();
  await page.locator('#floormap-canvas').click({ position: MARKER_POS });
  await expect(page.locator('#floormap-info-panel')).toBeVisible();
  await page.locator('#floormap-place-btn').click(); // exit placement mode
  await exportJsonToClean(page);
  await page.evaluate(() => window.__historyManagerForTests.clear());
  await expect(dirtyIndicator(page)).toBeHidden();
}

// Triggers a JSON export purely for its markProjectClean() side effect and
// returns the exported project object, so tests can assert on what a real
// save would actually contain.
async function exportJsonToClean(page) {
  const fs = require('fs');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#export-json-btn', { force: true }),
  ]);
  const p = await download.path();
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  await download.delete();
  return data;
}

// Drags the single-view panorama canvas. `steps` controls how many
// intermediate mousemove events the gesture emits — the multi-move test
// below relies on this to prove one gesture never becomes many entries.
async function dragPanorama(page, dx, dy, steps = 10) {
  const box = await page.locator('#viewer-canvas').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps });
  await page.mouse.up();
}

// Two scenes, one floorplan, and a marker for EACH scene — the state a
// mid-gesture scene change needs, so the "wrong marker" the gesture could
// wrongly commit to actually exists rather than merely being absent.
// Leaves scene 1 current, so a gesture starts on scene 1's marker.
async function loadTwoScenesFloorplanAndMarkers(page) {
  await enterEditor(page);
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
  await expect(sceneItems(page)).toHaveCount(2);
  await page.locator('#add-floorplan-btn').click();
  await page.locator('#floorplan-input').setInputFiles(FIXTURE_C);

  // The 1x1 fixture floorplan is letterboxed to a square centred in the
  // canvas, so only positions near the centre land inside the drawn image —
  // _canvasToImage() returns null (and places nothing) outside it.
  const fmBox = await page.locator('#floormap-canvas').boundingBox();
  const midX = Math.round(fmBox.width / 2);
  const midY = Math.round(fmBox.height / 2);

  await page.locator('#floormap-place-btn').click();
  await page.locator('#floormap-canvas').click({ position: { x: midX - 20, y: midY - 20 } });
  await page.locator('#floormap-place-btn').click();

  await sceneItems(page).nth(1).click();
  await page.locator('#floormap-place-btn').click();
  await page.locator('#floormap-canvas').click({ position: { x: midX + 20, y: midY + 20 } });
  await page.locator('#floormap-place-btn').click();

  await sceneItems(page).nth(0).click();
  await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');
}

function sceneItems(page) { return page.locator('#scene-list .scene-item'); }

// Dispatches a real TouchEvent on the panorama canvas. Playwright's own
// touchscreen API is single-tap only, and the pinch transition under test is
// specifically about a SECOND touch arriving mid-gesture, so the events are
// constructed directly with the standard Touch/TouchEvent constructors
// (Chromium) — no production test hook is involved. Offsets are relative to
// the canvas centre.
async function dispatchTouch(page, type, offsets) {
  await page.evaluate(({ type, offsets }) => {
    const el = document.getElementById('viewer-canvas');
    const r = el.getBoundingClientRect();
    const touches = offsets.map((o, i) => new Touch({
      identifier: i,
      target: el,
      clientX: r.left + r.width / 2 + o.dx,
      clientY: r.top + r.height / 2 + o.dy,
    }));
    el.dispatchEvent(new TouchEvent(type, {
      bubbles: true, cancelable: true,
      touches, targetTouches: touches, changedTouches: touches,
    }));
  }, { type, offsets });
}

test.describe('panorama rotation gesture lifecycle (cancel / identity)', () => {
  // Required Fix (review #4957197858) A: a second finger turns the gesture
  // into a pinch. The pending single-pointer rotation snapshot must be
  // cancelled — not committed on the eventual touchend — and the heading
  // written by the single-touch part of the gesture must not survive.
  test('a single-touch drag that becomes a pinch commits nothing and leaves the heading unchanged', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    const before = await rotationDeg(page);

    await dispatchTouch(page, 'touchstart', [{ dx: 0, dy: 0 }]);
    await dispatchTouch(page, 'touchmove', [{ dx: 120, dy: 0 }]);
    // Second finger lands: from here the gesture is a pinch, not a rotation.
    await dispatchTouch(page, 'touchstart', [{ dx: 120, dy: 0 }, { dx: -60, dy: 40 }]);
    await dispatchTouch(page, 'touchmove', [{ dx: 150, dy: 0 }, { dx: -90, dy: 60 }]);
    await dispatchTouch(page, 'touchend', [{ dx: 150, dy: 0 }]);

    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeHidden();

    const data = await exportJsonToClean(page);
    expect(data.markers[0].rotation).toBe(before);

    expectNoErrors(errors);
  });

  // Required Fix (review #4957197858) B: the live writes in rotate() are
  // keyed to whatever scene/floorplan is current now, while the snapshot is
  // keyed to the marker current at gesture start. If the scene changes
  // mid-gesture the two describe different markers, and neither may end up
  // with a history entry or a half-applied heading.
  test('a scene change mid-gesture commits nothing and leaves both markers unchanged', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadTwoScenesFloorplanAndMarkers(page);
    const baseline = await exportJsonToClean(page);
    await page.evaluate(() => window.__historyManagerForTests.clear());
    expect(baseline.markers).toHaveLength(2);
    const beforeById = Object.fromEntries(baseline.markers.map(m => [m.id, m.rotation]));

    const box = await page.locator('#viewer-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy, { steps: 10 }); // rotates scene 1's marker
    await page.keyboard.press('ArrowRight');            // scene changes mid-gesture
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');
    await page.mouse.move(cx + 200, cy, { steps: 10 }); // must not touch scene 2's marker
    await page.mouse.up();

    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeHidden();

    const after = await exportJsonToClean(page);
    for (const m of after.markers) {
      expect(m.rotation).toBe(beforeById[m.id]);
    }

    expectNoErrors(errors);
  });
});

test.describe('panorama rotation history (undo/redo)', () => {
  test('dragging the panorama marks the project dirty and pushes exactly one history entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });

    await dragPanorama(page, 120, 0);

    await expect(dirtyIndicator(page)).toBeVisible();
    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('a single gesture with many intermediate moves still pushes only one entry', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);

    // 40 discrete mousemove events inside one mousedown..mouseup.
    await dragPanorama(page, 160, 0, 40);

    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  test('undo restores the pre-drag heading and redo re-applies the post-drag heading', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    const before = await rotationDeg(page);

    await dragPanorama(page, 120, 0);
    const after = await rotationDeg(page);
    expect(after).not.toBe(before);

    await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(await rotationDeg(page)).toBe(before);

    await page.evaluate(() => window.__historyManagerForTests.redo());
    expect(await rotationDeg(page)).toBe(after);

    expectNoErrors(errors);
  });

  test('a no-op drag (press and release without moving) pushes nothing and stays clean', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    const before = await rotationDeg(page);

    const box = await page.locator('#viewer-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();

    expect(await rotationDeg(page)).toBe(before);
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeHidden();

    expectNoErrors(errors);
  });

  test('a new drag after undo clears the redo stack', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);

    await dragPanorama(page, 120, 0);
    await page.evaluate(() => window.__historyManagerForTests.undo());
    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 1 });

    await dragPanorama(page, -100, 0);

    expect(await historyCounts(page)).toEqual({ undoCount: 1, redoCount: 0 });

    expectNoErrors(errors);
  });

  // Deliberately verifies the heading through a real JSON export rather than
  // #floormap-info-dir: that cell is only repainted by _updateInfoPanel(), so
  // a Viewer-mode drag that silently mutated marker.rotation would leave the
  // cell showing the stale pre-drag value and make a DOM-only assertion pass
  // for the wrong reason. Export is Editor-only, so the check returns to
  // Editor first (Viewer -> Editor never prompts; only the reverse can).
  test('Viewer mode: dragging the panorama never changes the persisted heading or history', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    const before = await rotationDeg(page);

    // Leaving Editor with unsaved work is gated by the shared dirty dialog;
    // the project is clean here (setup exported), so the switch is direct.
    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-viewer/);
    await page.evaluate(() => window.__historyManagerForTests.clear());

    await dragPanorama(page, 120, 0);

    expect(await historyCounts(page)).toEqual({ undoCount: 0, redoCount: 0 });
    await expect(dirtyIndicator(page)).toBeHidden();

    await page.click('#app-mode-toggle-btn', { force: true });
    await expect(page.locator('body')).toHaveClass(/mode-editor/);
    const data = await exportJsonToClean(page);
    expect(data.markers[0].rotation).toBe(before);

    expectNoErrors(errors);
  });

  test('an exported project JSON carries the heading the drag ended on', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);

    await dragPanorama(page, 120, 0);
    const after = await rotationDeg(page);

    const data = await exportJsonToClean(page);
    expect(data.markers).toHaveLength(1);
    expect(data.markers[0].rotation).toBe(after);

    expectNoErrors(errors);
  });

  test('undoing the drag before saving exports the original heading', async ({ page }) => {
    const errors = await gotoApp(page);
    await loadSceneFloorplanAndMarker(page);
    const before = await rotationDeg(page);

    await dragPanorama(page, 120, 0);
    await page.evaluate(() => window.__historyManagerForTests.undo());

    const data = await exportJsonToClean(page);
    expect(data.markers[0].rotation).toBe(before);

    expectNoErrors(errors);
  });
});
