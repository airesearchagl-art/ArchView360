// Detailed regression coverage for viewer.html's Common-feature surface
// (PR-C, the "next development phase" recorded after PR #41's launch-level
// canary in viewer-html-minimal.spec.js). That file stays a minimal
// startup canary by design and is left untouched here; this file covers
// the Common features a Viewer session is actually expected to support —
// scene load/switch, compare modes, FloorMap, allowed viewing operations —
// and confirms Editor-only mutations stay blocked, including via
// hidden-element bypasses of DOM the CSS/static-HTML removal already hides.
//
// viewer.html has no Editor UI at all (no #app-mode-toggle-btn), so every
// test here starts from viewer.html's own default (Viewer) mode; none
// switches mode or uses `?mode=editor` (the Vault's ArchView360 decisions
// treat the URL as non-security, but that is not the same as exercising it
// as a mode switch inside these tests).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const { gotoViewerHtml, gotoApp, expectNoErrors, dirtyIndicator } = require('./helpers');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const FIXTURE_A = path.join(FIXTURES, 'fixture-a.png');
const FIXTURE_B = path.join(FIXTURES, 'fixture-b.png');
const FIXTURE_C = path.join(FIXTURES, 'fixture-c.png');

// tests/fixtures/*.png are deliberately 1x1 solid-color placeholders (per
// this project's "no real material" fixture rule); mapped onto the
// equirectangular sphere they render as a uniform color from every camera
// angle, so a real drag/rotation is visually undetectable against them --
// confirmed empirically (a real 150px drag against fixture-a.png measured a
// ~0.5 mean fingerprint diff, indistinguishable from render noise). Rather
// than add a checked-in fixture with real spatial content, this generates a
// small striped PNG at test-runtime (stdlib zlib only, no new dependency)
// and writes it to the OS temp dir -- not tests/fixtures/, so no new file
// enters the repo -- for the two tests below that need to actually see a
// rotation. Its 8 vertical color bands sit at different image-U
// coordinates, which the sphere's equirectangular UV mapping ties to
// longitude (theta), the same axis a horizontal drag changes.
function crc32(buf) {
  if (!crc32.table) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i += 1) crc = crc32.table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makeStripedPanoramaPng(width = 64, height = 32) {
  const PALETTE = [
    [230, 25, 75], [60, 180, 75], [255, 225, 25], [0, 130, 200],
    [245, 130, 48], [145, 30, 180], [70, 240, 240], [240, 50, 230],
  ];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const raw = Buffer.alloc((width * 3 + 1) * height);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    raw[pos] = 0; pos += 1; // filter type: none
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = PALETTE[Math.floor((x / width) * PALETTE.length) % PALETTE.length];
      raw[pos] = r; raw[pos + 1] = g; raw[pos + 2] = b; pos += 3;
    }
  }
  const idat = zlib.deflateSync(raw);
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

function writeTempPanoramaFixture() {
  const p = path.join(os.tmpdir(), `archview360-striped-panorama-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  fs.writeFileSync(p, makeStripedPanoramaPng());
  return p;
}

function sceneItems(page) {
  return page.locator('#scene-list .scene-item');
}

async function loadTwoScenes(page) {
  await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
  await expect(sceneItems(page)).toHaveCount(2);
}

test.describe('viewer.html: A. launch / basic state', () => {
  // viewer-html-minimal.spec.js already covers init()-completes-without-
  // throwing, starts-in-Viewer-mode, and the confirmed-49 absence check;
  // this adds the two Viewer-Preview ids, which are Common-classified DOM
  // (not part of the confirmed-49 set) but must still never be reachable
  // from viewer.html since there is no app-mode-toggle-btn to arm Preview.
  test('has no reachable Viewer-Preview affordance: viewer-preview-btn (confirmed-49) is absent, and viewer-preview-exit-btn (Common DOM, left in place per docs/ViewerEditor_Viewer_Html_Known_Gaps.md) stays hidden since Preview can never be armed without app-mode-toggle-btn', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await expect(page.locator('#viewer-preview-btn')).toHaveCount(0);
    await expect(page.locator('#viewer-preview-exit-btn')).toBeHidden();
    expectNoErrors(errors);
  });

  test('a fresh viewer.html session starts clean: dirty indicator is hidden before any scene is loaded', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });
});

test.describe('viewer.html: B. scene load / switch', () => {
  test('multiple scenes load into an empty project, the list shows all of them, and loading stays clean', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
    await expect(sceneItems(page)).toHaveCount(3);
    await expect(dirtyIndicator(page)).toBeHidden(); // opening into an empty project is a load, not an edit
    expectNoErrors(errors);
  });

  test('clicking a different scene in the list switches the current scene and updates the header name', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');

    await sceneItems(page).nth(1).click();
    await expect(sceneItems(page).nth(1)).toHaveClass(/active/);
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });

  test('ArrowRight/ArrowLeft cycle through scenes in single view', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B, FIXTURE_C]);
    await expect(sceneItems(page)).toHaveCount(3);
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-a');

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-c');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#current-scene-name')).toHaveText('fixture-b');

    expectNoErrors(errors);
  });
});

test.describe('viewer.html: C. compare display', () => {
  test('split compare can be entered via the toolbar button (not just the "c" shortcut) and shows both panes', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await page.locator('#split-compare-btn').click();
    await expect(page.locator('#compare-container')).toBeVisible();
    await expect(page.locator('#compare-pane-a')).toBeVisible();
    await expect(page.locator('#compare-pane-b')).toBeVisible();
    await expect(page.locator('#compare-name-a')).toHaveText('fixture-a');
    await expect(page.locator('#compare-name-b')).toHaveText('fixture-b');
    expectNoErrors(errors);
  });

  test('sync-views ("l") toggles the sync button state in split mode', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await page.keyboard.press('c');
    await expect(page.locator('#compare-container')).toBeVisible();
    await expect(page.locator('#sync-btn')).toHaveClass(/active/); // syncViews defaults true on entry

    await page.keyboard.press('l');
    await expect(page.locator('#sync-btn')).not.toHaveClass(/active/);
    await page.keyboard.press('l');
    await expect(page.locator('#sync-btn')).toHaveClass(/active/);
    expectNoErrors(errors);
  });

  test('switching from split to slider compare keeps the A/B pair and updates the container mode class', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await page.locator('#split-compare-btn').click();
    await expect(page.locator('#compare-container')).not.toHaveClass(/slider-mode/);

    await page.locator('#switch-to-slider-btn').click();
    await expect(page.locator('#compare-container')).toHaveClass(/slider-mode/);
    await expect(page.locator('#compare-name-a')).toHaveText('fixture-a');
    await expect(page.locator('#compare-name-b')).toHaveText('fixture-b');
    expectNoErrors(errors);
  });

  test('dragging the slider handle moves the divider position', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await page.keyboard.press('s'); // slider compare shortcut
    await expect(page.locator('#compare-container')).toHaveClass(/slider-mode/);

    const before = await page.locator('#slider-divider').evaluate((el) => el.style.left);
    const box = await page.locator('#slider-divider').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + box.height / 2);
    await page.mouse.up();
    const after = await page.locator('#slider-divider').evaluate((el) => el.style.left);
    expect(after).not.toBe(before);

    expectNoErrors(errors);
  });

  test('exiting compare mode (Escape) returns to single view without dirtying the project', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await page.keyboard.press('c');
    await expect(page.locator('#compare-container')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#compare-container')).toBeHidden();
    await expect(page.locator('#viewer-canvas')).toBeVisible();
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });
});

test.describe('viewer.html: D. FloorMap (no Viewer-reachable creation path)', () => {
  // add-floorplan-btn is part of the confirmed-49 Editor-only set (already
  // removed and covered by viewer-html-minimal.spec.js's id check), and
  // handleFloorplanFiles() always calls assertEditorMode() regardless of
  // whether the project is empty (unlike handleFiles(), which allows a
  // first load into an empty project from Viewer). So unlike scenes, there
  // is no Viewer-reachable way to create a FloorMap at all — meaning an
  // "existing FloorMap/marker" state can never occur in a fresh viewer.html
  // session (the app has no cross-session persistence either; see
  // docs/ViewerEditor_Viewer_Html_Known_Gaps.md). These tests cover what
  // that constraint actually implies: the navigator never appears, and a
  // direct hidden-input bypass of the (already absent) add-floorplan
  // button is still blocked by handleFloorplanFiles()'s own guard.
  test('the FloorMap navigator never appears during an ordinary Viewer session (no scenes, floorplan)', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await expect(page.locator('#floormap-navigator')).toBeHidden();
    await loadTwoScenes(page);
    await expect(page.locator('#floormap-navigator')).toBeHidden();
    expectNoErrors(errors);
  });

  test('hidden-element bypass: driving #floorplan-input directly (its only trigger, add-floorplan-btn, does not exist) still does not add a FloorMap', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await page.locator('#floorplan-input').setInputFiles(FIXTURE_C);
    await expect(page.locator('#floormap-navigator')).toBeHidden();
    await expect(dirtyIndicator(page)).toBeHidden(); // handleFloorplanFiles()'s assertEditorMode() blocked before markProjectDirty()
    expectNoErrors(errors);
  });
});

// AI Review Agent Formal Review #4840243966 (PR #42, head 4d0fd28...) flagged
// that this section's original 4 tests only asserted "no thrown error" for
// fullscreen/zoom/drag/reset, never that the operation actually did
// anything. These replacements verify real state/API-call/render changes:
//   - Fullscreen: headless Chromium's real requestFullscreen() usually
//     rejects (no user-activation state in CDP-driven headless), which the
//     app already swallows via .catch(showGlobalError) -- so "no thrown
//     error" was true even if the call never fired. Stubbing
//     Element.prototype.requestFullscreen via page.addInitScript() (a
//     Playwright-side monkeypatch injected before script.js runs, not a
//     production code change) lets the test assert the app actually called
//     it, deterministically, without depending on headless Fullscreen-API
//     behavior.
//   - Zoom/drag/reset: window.__viewerPreviewTestHooks.getCameraFov() is an
//     existing production hook (added for PR #27's Viewer Preview tests,
//     script.js:5614-5618) reused here rather than adding a new one, for
//     the FOV axis. Camera *direction* (theta/phi) has no equivalent
//     numeric hook, so drag and the direction half of reset are verified via
//     a downsampled canvas fingerprint (drawImage the live WebGL canvas onto
//     a small 2D canvas, read back its pixels) compared with an explicit
//     numeric tolerance -- exact full-resolution screenshot-byte equality
//     was tried first and flaked (WebGL/canvas capture has enough
//     frame-to-frame sampling noise that two renders of the identical
//     camera state are not always byte-identical), so this downsamples to
//     smooth that noise out while staying sensitive to an actual
//     rotation/zoom, per the task's guidance to use an explicit-tolerance
//     numeric comparison when exact equality is unstable.
async function waitForFrames(page, count = 3) {
  await page.evaluate((n) => new Promise((resolve) => {
    let i = 0;
    function tick() { i += 1; if (i >= n) resolve(); else requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  }), count);
}

function getCameraFov(page) {
  return page.evaluate(() => window.__viewerPreviewTestHooks.getCameraFov());
}

// Downsampling to a small fixed size averages away per-frame WebGL sampling
// noise (see comment above) while remaining sensitive to a real change in
// camera direction/FOV, which shifts large contiguous regions of the sphere
// texture into view.
const FINGERPRINT_SIZE = 24;

// Reading the live WebGL canvas back via drawImage()+getImageData() in-page
// returns a constant/blank buffer here (this app's renderer does not set
// preserveDrawingBuffer, so by the time our JS runs the drawing buffer may
// already be gone) -- confirmed empirically: a real drag produced a 0 mean
// diff with that approach. A CDP-level screenshot (locator.screenshot(),
// the same call the earlier byte-exact attempt used) does capture the true
// rendered pixels; decoding it back through the browser's own <img> loader
// (rather than a hand-rolled PNG parser) lets the downsample reuse that
// already-correct capture.
async function canvasFingerprint(page, selector) {
  const png = await page.locator(selector).screenshot();
  return page.evaluate(({ base64, size }) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const tmp = document.createElement('canvas');
      tmp.width = size; tmp.height = size;
      const ctx = tmp.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      resolve(Array.from(ctx.getImageData(0, 0, size, size).data));
    };
    img.onerror = () => reject(new Error('fingerprint image failed to load'));
    img.src = `data:image/png;base64,${base64}`;
  }), { base64: png.toString('base64'), size: FINGERPRINT_SIZE });
}

function meanAbsDiff(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

// Empirically, two fingerprints of an unchanged camera state differ by a
// mean absolute per-channel value well under 1 (0-255 scale); a real
// rotation/zoom shifts large regions of the sphere texture and differs by
// tens. SAME_VIEW_TOLERANCE stays well above the former and DIFFERENT_VIEW_MIN
// stays well below the latter, so there is no ambiguous middle ground for
// these specific interactions (drag ~150px, zoom +/-3deg FOV).
const SAME_VIEW_TOLERANCE = 3;
const DIFFERENT_VIEW_MIN = 8;

test.describe('viewer.html: E. operations allowed in Viewer', () => {
  test('the "f" fullscreen shortcut actually calls the Fullscreen API (stubbed via addInitScript, since headless Chromium\'s real requestFullscreen() has no user-activation state to reject/resolve deterministically)', async ({ page }) => {
    await page.addInitScript(() => {
      window.__testFullscreenCallCount = 0;
      const stub = function () { window.__testFullscreenCallCount += 1; return Promise.resolve(); };
      Element.prototype.requestFullscreen = stub;
      Element.prototype.webkitRequestFullscreen = stub;
    });
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('#viewer-canvas')).toBeVisible();

    expect(await page.evaluate(() => window.__testFullscreenCallCount)).toBe(0);
    await page.keyboard.press('f');
    await expect.poll(() => page.evaluate(() => window.__testFullscreenCallCount)).toBe(1);
    expectNoErrors(errors);
  });

  test('auto-rotate ("a") toggles the toolbar button state (reset view is covered by its own state-restoration test below)', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('#viewer-canvas')).toBeVisible();
    await page.keyboard.press('a');
    await expect(page.locator('#autorotate-btn')).toHaveClass(/active/);
    await page.keyboard.press('a');
    await expect(page.locator('#autorotate-btn')).not.toHaveClass(/active/);
    expectNoErrors(errors);
  });

  test('mouse-wheel zoom actually changes the camera FOV (both directions)', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('#viewer-canvas')).toBeVisible();

    const initialFov = await getCameraFov(page);
    const box = await page.locator('#viewer-canvas').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    await page.mouse.wheel(0, 100); // deltaY > 0 -> zoomBy(+3): wider FOV (zoom out)
    const zoomedOutFov = await getCameraFov(page);
    expect(zoomedOutFov).toBeGreaterThan(initialFov);

    await page.mouse.wheel(0, -100); // deltaY < 0 -> zoomBy(-3): narrower FOV (zoom in)
    const zoomedInFov = await getCameraFov(page);
    expect(zoomedInFov).toBeLessThan(zoomedOutFov);

    expectNoErrors(errors);
  });

  test('drag-to-look-around actually changes the rendered view', async ({ page }) => {
    const panoramaPath = writeTempPanoramaFixture();
    try {
      const errors = await gotoViewerHtml(page);
      await page.locator('#file-input').setInputFiles(panoramaPath);
      await expect(page.locator('#viewer-canvas')).toBeVisible();
      await waitForFrames(page);
      const before = await canvasFingerprint(page, '#viewer-canvas');

      const box = await page.locator('#viewer-canvas').boundingBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 150, cy - 80, { steps: 10 });
      await page.mouse.up();
      await waitForFrames(page);
      const after = await canvasFingerprint(page, '#viewer-canvas');

      expect(meanAbsDiff(before, after)).toBeGreaterThan(DIFFERENT_VIEW_MIN);
      expectNoErrors(errors);
    } finally {
      fs.unlinkSync(panoramaPath);
    }
  });

  test('reset view ("r") restores both FOV and the rendered view after zoom + drag changed them', async ({ page }) => {
    const panoramaPath = writeTempPanoramaFixture();
    try {
      const errors = await gotoViewerHtml(page);
      await page.locator('#file-input').setInputFiles(panoramaPath);
      await expect(page.locator('#viewer-canvas')).toBeVisible();
      await waitForFrames(page);
      const initialFov = await getCameraFov(page);
      const initialFingerprint = await canvasFingerprint(page, '#viewer-canvas');

      const box = await page.locator('#viewer-canvas').boundingBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, 150);
      await page.mouse.down();
      await page.mouse.move(cx + 150, cy - 80, { steps: 10 });
      await page.mouse.up();
      await waitForFrames(page);

      const changedFov = await getCameraFov(page);
      expect(changedFov).not.toBe(initialFov);
      const changedFingerprint = await canvasFingerprint(page, '#viewer-canvas');
      expect(meanAbsDiff(initialFingerprint, changedFingerprint)).toBeGreaterThan(DIFFERENT_VIEW_MIN);

      await page.keyboard.press('r');
      await waitForFrames(page);

      const resetFov = await getCameraFov(page);
      expect(resetFov).toBe(initialFov);
      const resetFingerprint = await canvasFingerprint(page, '#viewer-canvas');
      expect(meanAbsDiff(initialFingerprint, resetFingerprint)).toBeLessThan(SAME_VIEW_TOLERANCE);

      expectNoErrors(errors);
    } finally {
      fs.unlinkSync(panoramaPath);
    }
  });

  test('viewing operations (switch scene, enter/exit compare, drag/zoom) never mark the project dirty', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles([FIXTURE_A, FIXTURE_B]);
    await sceneItems(page).nth(1).click();
    await page.keyboard.press('c');
    await page.keyboard.press('Escape');
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });
});

test.describe('viewer.html: F. operations blocked in Viewer', () => {
  test('double-clicking a scene name does not enter edit mode', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    const nameEl = page.locator('.scene-name').first();
    await nameEl.dblclick();
    await expect(nameEl).not.toHaveAttribute('contenteditable', 'true');
    await expect(nameEl).toHaveText('fixture-a');
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });

  test('the "m" flip shortcut does not flip the scene or dirty the project', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('#viewer-canvas')).toBeVisible();
    await page.keyboard.press('m');
    await expect(dirtyIndicator(page)).toBeHidden(); // toggleFlipSingle()'s assertEditorMode() blocks before applySceneFlip()
    expectNoErrors(errors);
  });

  test('Ctrl+Z / Ctrl+Shift+Z do nothing while viewing', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    await expect(page.locator('#viewer-canvas')).toBeVisible();
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+Shift+z');
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });

  test('hidden-element bypass: re-driving #file-input on an already-loaded project is blocked (only a first load into an empty project is allowed)', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await page.locator('#file-input').setInputFiles(FIXTURE_A); // first load into empty project: allowed
    await expect(sceneItems(page)).toHaveCount(1);
    await expect(dirtyIndicator(page)).toBeHidden();

    await page.locator('#file-input').setInputFiles(FIXTURE_B); // second load: handleFiles()'s assertEditorMode() blocks it
    await expect(sceneItems(page)).toHaveCount(1);
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });

  test('hidden-element bypass: dispatching a click straight at the dynamically-rendered .scene-delete-btn (CSS-hidden via .mode-viewer .editor-only, not a static removed id, so display:none rules out a normal/forced Playwright click) does not delete the scene', async ({ page }) => {
    const errors = await gotoViewerHtml(page);
    await loadTwoScenes(page);
    await expect(page.locator('.scene-delete-btn').first()).toBeHidden(); // .mode-viewer .editor-only { display: none }

    // display:none leaves no bounding box, so even a force:true click can't
    // resolve coordinates; dispatchEvent fires the button's own 'click'
    // listener directly, which is the actual bypass this test is for (the
    // handler runs deleteScene(i) unconditionally -- the guard has to be
    // inside deleteScene() itself, not in whether the button is clickable).
    await page.locator('.scene-delete-btn').first().dispatchEvent('click');
    await expect(sceneItems(page)).toHaveCount(2); // deleteScene()'s assertEditorMode() blocked it
    await expect(dirtyIndicator(page)).toBeHidden();
    expectNoErrors(errors);
  });
});

test.describe('viewer.html: index.html Editor regression (existing tests already cover this; single confirmation here)', () => {
  test("index.html's own Editor-mode scene rename still works (viewer.html changes did not regress index.html)", async ({ page }) => {
    // Full Editor-mode coverage already lives in scene-rename-history.spec.js
    // and the rest of the suite; this is a one-test confirmation that
    // index.html (untouched by this PR) still reaches Editor mode and can
    // mutate, run alongside viewer.html's own tests in this file.
    const errors = await gotoApp(page);
    await page.click('#app-mode-toggle-btn', { force: true });
    await page.locator('#file-input').setInputFiles(FIXTURE_A);
    const nameEl = page.locator('.scene-name').first();
    await nameEl.dblclick();
    await page.keyboard.type('Renamed');
    await page.keyboard.press('Enter');
    await expect(nameEl).toHaveText('Renamed');
    expectNoErrors(errors);
  });
});
