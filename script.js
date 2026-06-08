'use strict';

/* ============================================================
 * ArchView360 v1.2 — 360° Panorama Viewer with Scene Management
 * and Side-by-side Comparison Mode
 * Three.js r128 CDN
 * ============================================================ */

// ---- Three.js 読み込み確認 ----
if (typeof THREE === 'undefined') {
  document.getElementById('threejs-error').classList.remove('hidden');
  document.getElementById('upload-section').classList.add('hidden');
  throw new Error('Three.js の読み込みに失敗しました。');
}

// ---- DOM ----
const uploadSection      = document.getElementById('upload-section');
const viewerLayout       = document.getElementById('viewer-layout');
const dropZone           = document.getElementById('drop-zone');
const fileInput          = document.getElementById('file-input');
const viewerCanvas       = document.getElementById('viewer-canvas');
const viewerContainer    = document.getElementById('viewer-container');
const loadingOverlay     = document.getElementById('loading-overlay');
const loadingMessage     = document.getElementById('loading-message');
const errorOverlay       = document.getElementById('error-overlay');
const errorMessage       = document.getElementById('error-message');
const errorBackBtn       = document.getElementById('error-back-btn');
const resetBtn           = document.getElementById('reset-btn');
const backBtn            = document.getElementById('back-btn');
const autorotateBtn      = document.getElementById('autorotate-btn');
const fullscreenBtn      = document.getElementById('fullscreen-btn');
const fullscreenIcon     = document.getElementById('fullscreen-icon');
const statusFov          = document.getElementById('status-fov');
const currentSceneNameEl = document.getElementById('current-scene-name');
const sceneListEl        = document.getElementById('scene-list');
const sceneCounter       = document.getElementById('scene-counter');
const addSceneBtn        = document.getElementById('add-scene-btn');
const clearAllBtn        = document.getElementById('clear-all-btn');
const globalError        = document.getElementById('global-error');
const toast              = document.getElementById('toast');
const compareModeBtn     = document.getElementById('compare-mode-btn');

// Compare DOM
const compareControls    = document.getElementById('compare-controls');
const compareContainer   = document.getElementById('compare-container');
const compareSelectA     = document.getElementById('compare-select-a');
const compareSelectB     = document.getElementById('compare-select-b');
const compareAutorotBtn  = document.getElementById('compare-autorotate-btn');
const compareResetBtn    = document.getElementById('compare-reset-btn');
const compareLayoutBtn   = document.getElementById('compare-layout-btn');
const compareFullscreenBtn = document.getElementById('compare-fullscreen-btn');
const exitCompareBtn     = document.getElementById('exit-compare-btn');
const canvasA            = document.getElementById('canvas-a');
const canvasB            = document.getElementById('canvas-b');
const loadingA           = document.getElementById('loading-a');
const loadingB           = document.getElementById('loading-b');
const compareNameA       = document.getElementById('compare-name-a');
const compareNameB       = document.getElementById('compare-name-b');

// ---- Three.js (single mode) ----
let renderer, threeScene, camera, sphere;
let animFrameId = null;

// ---- Three.js (compare mode) ----
let rendererA, rendererB, sceneA, sceneB, cameraA, cameraB, sphereA, sphereB;

// ---- Camera state (shared) ----
const DEFAULT_FOV   = 75;
const MIN_FOV       = 30;
const MAX_FOV       = 100;
const DEFAULT_PHI   = Math.PI / 2;
const DEFAULT_THETA = 0;
let phi   = DEFAULT_PHI;
let theta = DEFAULT_THETA;
let fov   = DEFAULT_FOV;

// ---- Auto-rotate ----
let autoRotate = false;
const AUTO_ROTATE_SPEED = 0.0015;

// ---- Drag / touch ----
let isDragging    = false;
let lastX         = 0;
let lastY         = 0;
let lastTouches   = null;
let lastPinchDist = null;

// ---- Toast ----
let toastTimer = null;

// ---- View mode ----
let viewMode      = 'single';   // 'single' | 'compare'
let compareLayout = 'side';     // 'side' | 'stack'
let compareIdxA   = 0;
let compareIdxB   = 1;

// ============================================================
// Scene model:  [{id, name, blobUrl}]
// ============================================================
let scenes     = [];
let currentIdx = -1;

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// ============================================================
// Three.js init
// ============================================================
function initThree() {
  if (renderer) return;

  threeScene = new THREE.Scene();
  camera     = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 1000);
  renderer   = new THREE.WebGLRenderer({ canvas: viewerCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  viewerCanvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    stopRender();
    showError('WebGLコンテキストが失われました。ページを再読み込みしてください。');
  });
  viewerCanvas.addEventListener('webglcontextrestored', () => {
    clearAllAndShowUpload();
  });
}

function fitCanvasToContainer() {
  const w = viewerContainer.clientWidth  || window.innerWidth;
  const h = viewerContainer.clientHeight || Math.round(window.innerHeight * 0.75);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ============================================================
// Compare Three.js init / dispose
// ============================================================
function initCompareRenderers() {
  if (!rendererA) {
    sceneA   = new THREE.Scene();
    cameraA  = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 1000);
    rendererA = new THREE.WebGLRenderer({ canvas: canvasA, antialias: true });
    rendererA.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
  if (!rendererB) {
    sceneB   = new THREE.Scene();
    cameraB  = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 1000);
    rendererB = new THREE.WebGLRenderer({ canvas: canvasB, antialias: true });
    rendererB.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}

function fitComparePanes() {
  fitComparePane(canvasA, rendererA, cameraA);
  fitComparePane(canvasB, rendererB, cameraB);
}

function fitComparePane(canvas, rend, cam) {
  if (!rend) return;
  const w = canvas.parentElement.clientWidth  || 100;
  const h = canvas.parentElement.clientHeight || 100;
  rend.setSize(w, h, false);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
}

function disposeSphere(sp, sc) {
  if (sp) {
    sp.geometry.dispose();
    if (sp.material.map) sp.material.map.dispose();
    sp.material.dispose();
    if (sc) sc.remove(sp);
  }
}

function disposeCompareRenderers() {
  disposeSphere(sphereA, sceneA);
  disposeSphere(sphereB, sceneB);
  sphereA = sphereB = null;
  if (rendererA) { rendererA.dispose(); rendererA = null; }
  if (rendererB) { rendererB.dispose(); rendererB = null; }
  sceneA = sceneB = cameraA = cameraB = null;
}

// ============================================================
// Scene management
// ============================================================

function handleFiles(fileList) {
  const allowed  = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const maxBytes = 100 * 1024 * 1024;

  const valid = Array.from(fileList).filter(f =>
    allowed.has(f.type) && f.size <= maxBytes
  );

  if (valid.length === 0) {
    showGlobalError(
      fileList.length > 0
        ? '有効なファイルがありません。JPEG・PNG・WebP（各100MB以下）を選択してください。'
        : ''
    );
    return;
  }

  const skipped = fileList.length - valid.length;
  if (skipped > 0) {
    showGlobalError(`${skipped} 件をスキップしました（対応外の形式または100MB超）。`);
  }

  const wasEmpty = scenes.length === 0;
  const firstNewIdx = scenes.length;

  valid.forEach(f => {
    scenes.push({
      id:      genId(),
      name:    f.name.replace(/\.[^.]+$/, ''),
      blobUrl: URL.createObjectURL(f),
    });
  });

  if (wasEmpty) {
    showViewerLayout();
    initThree();
    fitCanvasToContainer();
    switchToScene(0);
  } else {
    renderSceneList();
    if (viewMode === 'compare') updateCompareSelects();
    showToast(`${valid.length} 件のシーンを追加しました`);
    const items = sceneListEl.querySelectorAll('.scene-item');
    items[firstNewIdx]?.scrollIntoView({ block: 'nearest' });
  }
}

function switchToScene(idx) {
  if (idx < 0 || idx >= scenes.length) return;
  currentIdx = idx;

  const s = scenes[idx];
  currentSceneNameEl.textContent = s.name;
  renderSceneList();
  loadPanorama(s.blobUrl, s.name);
}

function prevScene() {
  if (!scenes.length) return;
  switchToScene((currentIdx - 1 + scenes.length) % scenes.length);
}

function nextScene() {
  if (!scenes.length) return;
  switchToScene((currentIdx + 1) % scenes.length);
}

function deleteScene(idx) {
  if (idx < 0 || idx >= scenes.length) return;

  URL.revokeObjectURL(scenes[idx].blobUrl);

  const wasCurrent = idx === currentIdx;
  if (wasCurrent) stopRender();

  // If in compare mode, exit it before deletion to avoid index confusion
  if (viewMode === 'compare') exitCompareMode();

  scenes.splice(idx, 1);

  if (scenes.length === 0) {
    disposeCurrentSphere();
    clearAllAndShowUpload();
    return;
  }

  let nextIdx = currentIdx;
  if (wasCurrent) {
    nextIdx = Math.min(idx, scenes.length - 1);
  } else if (idx < currentIdx) {
    nextIdx = currentIdx - 1;
  }

  currentIdx = -1;
  switchToScene(nextIdx);
}

function disposeCurrentSphere() {
  if (sphere) {
    sphere.geometry.dispose();
    if (sphere.material.map) sphere.material.map.dispose();
    sphere.material.dispose();
    if (threeScene) threeScene.remove(sphere);
    sphere = null;
  }
}

function clearAllAndShowUpload() {
  if (viewMode === 'compare') exitCompareMode();
  stopRender();
  hideToast();
  disposeCurrentSphere();

  scenes.forEach(s => URL.revokeObjectURL(s.blobUrl));
  scenes     = [];
  currentIdx = -1;

  autoRotate = false;
  autorotateBtn.classList.remove('ctrl-btn-active');
  autorotateBtn.title = '自動回転をON';

  const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
  if ((document.fullscreenElement || document.webkitFullscreenElement) && exitFs) {
    exitFs.call(document).catch(() => {});
  }

  viewerLayout.classList.add('hidden');
  uploadSection.classList.remove('hidden');
}

function renderSceneList() {
  sceneListEl.innerHTML = '';

  scenes.forEach((s, i) => {
    const li = document.createElement('li');
    li.className = 'scene-item' + (i === currentIdx ? ' active' : '');

    const numEl = document.createElement('span');
    numEl.className = 'scene-num';
    numEl.textContent = i + 1;

    const nameEl = document.createElement('span');
    nameEl.className = 'scene-name';
    nameEl.textContent = s.name;
    nameEl.title = s.name;

    nameEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      nameEl.contentEditable = 'true';
      nameEl.classList.add('editing');
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    nameEl.addEventListener('blur', () => {
      nameEl.contentEditable = 'false';
      nameEl.classList.remove('editing');
      const newName = nameEl.textContent.trim();
      s.name = newName || s.name;
      nameEl.textContent = s.name;
      if (i === currentIdx) currentSceneNameEl.textContent = s.name;
      if (viewMode === 'compare') updateCompareSelects();
    });

    nameEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter')  { e.preventDefault(); nameEl.blur(); }
      if (e.key === 'Escape') { nameEl.textContent = s.name; nameEl.blur(); }
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'scene-delete-btn';
    delBtn.title = 'このシーンを削除';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteScene(i);
    });

    li.appendChild(numEl);
    li.appendChild(nameEl);
    li.appendChild(delBtn);

    li.addEventListener('click', () => {
      if (nameEl.contentEditable === 'true') return;
      if (i !== currentIdx) switchToScene(i);
    });

    sceneListEl.appendChild(li);
  });

  sceneCounter.textContent = scenes.length > 0
    ? `${currentIdx + 1} / ${scenes.length}`
    : '0 / 0';

  const activeEl = sceneListEl.querySelector('.scene-item.active');
  activeEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// ============================================================
// Panorama load + sphere build
// ============================================================
function loadPanorama(src, name) {
  showLoading(true, `「${name}」を読み込み中…`);
  hideError();

  new THREE.TextureLoader().load(
    src,
    (texture) => {
      buildSphere(texture);
      showLoading(false);
      startRender();
      showToast('ドラッグで自由に見回せます 🖱️');
    },
    (progress) => {
      if (progress.total > 0) {
        const pct = Math.round(progress.loaded / progress.total * 100);
        showLoading(true, `「${name}」を読み込み中… ${pct}%`);
      }
    },
    () => {
      showLoading(false);
      showError('画像の読み込みに失敗しました。\n正距円筒図法の JPEG / PNG / WebP を選択してください。');
    }
  );
}

function buildSphere(texture) {
  disposeCurrentSphere();
  const geo = new THREE.SphereGeometry(500, 60, 40);
  const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
  sphere = new THREE.Mesh(geo, mat);
  threeScene.add(sphere);
  resetView();
}

function loadCompareSphere(side, idx) {
  if (idx < 0 || idx >= scenes.length) return;
  const s = scenes[idx];
  const loadingEl = side === 'a' ? loadingA : loadingB;
  loadingEl.classList.remove('hidden');

  const canvas = side === 'a' ? canvasA : canvasB;
  const rend   = side === 'a' ? rendererA : rendererB;
  const sc     = side === 'a' ? sceneA : sceneB;
  const cam    = side === 'a' ? cameraA : cameraB;
  const nameEl = side === 'a' ? compareNameA : compareNameB;

  nameEl.textContent = s.name;

  new THREE.TextureLoader().load(
    s.blobUrl,
    (texture) => {
      if (side === 'a') {
        disposeSphere(sphereA, sceneA);
        const geo = new THREE.SphereGeometry(500, 60, 40);
        sphereA = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide }));
        sceneA.add(sphereA);
      } else {
        disposeSphere(sphereB, sceneB);
        const geo = new THREE.SphereGeometry(500, 60, 40);
        sphereB = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide }));
        sceneB.add(sphereB);
      }
      loadingEl.classList.add('hidden');
      fitComparePane(canvas, rend, cam);
    },
    null,
    () => { loadingEl.classList.add('hidden'); }
  );
}

// ============================================================
// Render loop
// ============================================================
function startRender() {
  if (animFrameId !== null) return;
  function loop() {
    animFrameId = requestAnimationFrame(loop);
    if (autoRotate && !isDragging) theta += AUTO_ROTATE_SPEED;

    const lx = Math.sin(phi) * Math.cos(theta);
    const ly = Math.cos(phi);
    const lz = Math.sin(phi) * Math.sin(theta);

    if (viewMode === 'compare') {
      if (cameraA && rendererA && sceneA) {
        cameraA.lookAt(lx, ly, lz);
        rendererA.render(sceneA, cameraA);
      }
      if (cameraB && rendererB && sceneB) {
        cameraB.lookAt(lx, ly, lz);
        rendererB.render(sceneB, cameraB);
      }
    } else {
      if (camera && renderer && threeScene) {
        camera.lookAt(lx, ly, lz);
        renderer.render(threeScene, camera);
      }
    }
  }
  loop();
}

function stopRender() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

// ============================================================
// View control
// ============================================================
function resetView() {
  phi   = DEFAULT_PHI;
  theta = DEFAULT_THETA;
  fov   = DEFAULT_FOV;
  applyFov();
}

function applyFov() {
  if (camera)  { camera.fov  = fov; camera.updateProjectionMatrix();  }
  if (cameraA) { cameraA.fov = fov; cameraA.updateProjectionMatrix(); }
  if (cameraB) { cameraB.fov = fov; cameraB.updateProjectionMatrix(); }
  statusFov.textContent = `FOV: ${Math.round(fov)}°`;
}

// ============================================================
// Compare mode
// ============================================================
function enterCompareMode() {
  if (scenes.length < 2) {
    showToast('比較モードには2つ以上のシーンが必要です');
    return;
  }

  viewMode = 'compare';
  compareIdxA = 0;
  compareIdxB = Math.min(1, scenes.length - 1);

  // Show compare UI, hide single viewer
  viewerContainer.classList.add('hidden');
  compareContainer.classList.remove('hidden');
  compareControls.classList.remove('hidden');
  compareModeBtn.classList.add('ctrl-btn-active');

  // Apply layout
  applyCompareLayout();

  stopRender();
  initCompareRenderers();
  updateCompareSelects();
  loadCompareSphere('a', compareIdxA);
  loadCompareSphere('b', compareIdxB);

  // Setup canvas events for compare canvases
  setupCanvasInteraction(canvasA);
  setupCanvasInteraction(canvasB);

  startRender();
}

function exitCompareMode() {
  viewMode = 'single';

  compareContainer.classList.add('hidden');
  compareControls.classList.add('hidden');
  viewerContainer.classList.remove('hidden');
  compareModeBtn.classList.remove('ctrl-btn-active');

  stopRender();
  disposeCompareRenderers();

  if (scenes.length > 0) {
    fitCanvasToContainer();
    startRender();
  }
}

function applyCompareLayout() {
  if (compareLayout === 'stack') {
    compareContainer.classList.add('stack');
    compareLayoutBtn.title = '左右表示に切替';
    compareLayoutBtn.textContent = '⊟';
  } else {
    compareContainer.classList.remove('stack');
    compareLayoutBtn.title = '上下表示に切替';
    compareLayoutBtn.textContent = '⊞';
  }
  requestAnimationFrame(() => fitComparePanes());
}

function updateCompareSelects() {
  [compareSelectA, compareSelectB].forEach((sel, si) => {
    const cur = si === 0 ? compareIdxA : compareIdxB;
    sel.innerHTML = '';
    scenes.forEach((s, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${i + 1}. ${s.name}`;
      if (i === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

compareSelectA.addEventListener('change', () => {
  compareIdxA = parseInt(compareSelectA.value, 10);
  loadCompareSphere('a', compareIdxA);
});

compareSelectB.addEventListener('change', () => {
  compareIdxB = parseInt(compareSelectB.value, 10);
  loadCompareSphere('b', compareIdxB);
});

compareResetBtn.addEventListener('click', resetView);

compareAutorotBtn.addEventListener('click', () => {
  autoRotate = !autoRotate;
  compareAutorotBtn.classList.toggle('icon-btn-active', autoRotate);
  compareAutorotBtn.title = autoRotate ? '自動回転をOFF' : '自動回転をON';
});

compareLayoutBtn.addEventListener('click', () => {
  compareLayout = compareLayout === 'side' ? 'stack' : 'side';
  applyCompareLayout();
});

compareFullscreenBtn.addEventListener('click', () => {
  const target = compareContainer;
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (!isFs) {
    const req = target.requestFullscreen || target.webkitRequestFullscreen;
    if (req) req.call(target).catch(err =>
      showGlobalError(`全画面表示に失敗しました: ${err.message}`)
    );
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document).catch(() => {});
  }
});

exitCompareBtn.addEventListener('click', exitCompareMode);
compareModeBtn.addEventListener('click', () => {
  if (viewMode === 'compare') exitCompareMode();
  else enterCompareMode();
});

// ============================================================
// UI helpers
// ============================================================
function showViewerLayout() {
  uploadSection.classList.add('hidden');
  viewerLayout.classList.remove('hidden');
}

function showLoading(visible, msg) {
  loadingOverlay.classList.toggle('hidden', !visible);
  if (msg) loadingMessage.textContent = msg;
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorOverlay.classList.remove('hidden');
}

function hideError() {
  errorOverlay.classList.add('hidden');
}

function showGlobalError(msg) {
  if (!msg) return;
  globalError.textContent = msg;
  globalError.classList.remove('hidden');
  setTimeout(() => globalError.classList.add('hidden'), 6000);
}

function showToast(msg, duration = 3000) {
  hideToast();
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('toast-show');
  toastTimer = setTimeout(hideToast, duration);
}

function hideToast() {
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  toast.classList.remove('toast-show');
  toast.classList.add('hidden');
}

// ============================================================
// Drag & Drop (upload zone)
// ============================================================
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});

dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) handleFiles(fileInput.files);
  fileInput.value = '';
});

// ============================================================
// Mouse / Touch interaction (shared, handles all canvases)
// ============================================================
const SENSITIVITY = 0.3;

function setupCanvasInteraction(canvas) {
  canvas.style.cursor = 'grab';

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    fov = Math.min(MAX_FOV, Math.max(MIN_FOV, fov + (e.deltaY > 0 ? 3 : -3)));
    applyFov();
  }, { passive: false });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      lastPinchDist = null;
    } else if (e.touches.length === 2) {
      lastPinchDist = pinchDist(e.touches);
    }
    lastTouches = e.touches;
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && lastTouches?.length === 1) {
      rotate(e.touches[0].clientX - lastX, e.touches[0].clientY - lastY);
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const d = pinchDist(e.touches);
      if (lastPinchDist !== null) {
        fov = Math.min(MAX_FOV, Math.max(MIN_FOV, fov + (lastPinchDist - d) * 0.15));
        applyFov();
      }
      lastPinchDist = d;
    }
    lastTouches = e.touches;
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    lastTouches   = null;
    lastPinchDist = null;
  });
}

// Setup single viewer canvas
setupCanvasInteraction(viewerCanvas);

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  rotate(e.clientX - lastX, e.clientY - lastY);
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  // Reset cursor on whichever canvas is active
  [viewerCanvas, canvasA, canvasB].forEach(c => { c.style.cursor = 'grab'; });
});

function pinchDist(t) {
  return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
}

function rotate(dx, dy) {
  const r = Math.PI / 180;
  theta -= dx * SENSITIVITY * r;
  phi   -= dy * SENSITIVITY * r;
  phi    = Math.max(0.05, Math.min(Math.PI - 0.05, phi));
}

// ============================================================
// Keyboard shortcuts
// ============================================================
document.addEventListener('keydown', (e) => {
  if (document.activeElement?.contentEditable === 'true') return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (viewerLayout.classList.contains('hidden')) return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      if (viewMode === 'single') prevScene();
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (viewMode === 'single') nextScene();
      break;
    case 'r':
    case 'R':
      resetView();
      break;
    case 'a':
    case 'A':
      autoRotate = !autoRotate;
      autorotateBtn.classList.toggle('ctrl-btn-active', autoRotate);
      autorotateBtn.title = autoRotate ? '自動回転をOFF' : '自動回転をON';
      compareAutorotBtn.classList.toggle('icon-btn-active', autoRotate);
      if (autoRotate) showToast('自動回転 ON');
      break;
    case 'f':
    case 'F':
      if (supportsFullscreen) fullscreenBtn.click();
      break;
    case 'c':
    case 'C':
      if (viewMode === 'compare') exitCompareMode();
      else enterCompareMode();
      break;
    case 'v':
    case 'V':
      if (viewMode === 'compare') compareLayoutBtn.click();
      break;
  }
});

// ============================================================
// Control buttons
// ============================================================
resetBtn.addEventListener('click', resetView);
backBtn.addEventListener('click', clearAllAndShowUpload);

errorBackBtn.addEventListener('click', () => {
  hideError();
  if (scenes.length === 0) clearAllAndShowUpload();
});

autorotateBtn.addEventListener('click', () => {
  autoRotate = !autoRotate;
  autorotateBtn.classList.toggle('ctrl-btn-active', autoRotate);
  autorotateBtn.title = autoRotate ? '自動回転をOFF' : '自動回転をON';
  if (autoRotate) showToast('自動回転 ON');
});

addSceneBtn.addEventListener('click', () => fileInput.click());
clearAllBtn.addEventListener('click', clearAllAndShowUpload);

// ============================================================
// Fullscreen (Safari webkit prefix)
// ============================================================
const supportsFullscreen = !!(
  viewerContainer.requestFullscreen || viewerContainer.webkitRequestFullscreen
);

if (!supportsFullscreen) {
  fullscreenBtn.classList.add('hidden');
  compareFullscreenBtn.classList.add('hidden');
}

fullscreenBtn.addEventListener('click', () => {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (!isFs) {
    const req = viewerContainer.requestFullscreen || viewerContainer.webkitRequestFullscreen;
    if (req) req.call(viewerContainer).catch(err =>
      showGlobalError(`全画面表示に失敗しました: ${err.message}`)
    );
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document).catch(() => {});
  }
});

function onFsChange() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  fullscreenIcon.textContent = isFs ? '✕' : '⛶';
  fullscreenBtn.title = isFs ? '全画面を終了' : '全画面表示';
  if (renderer && viewMode === 'single') requestAnimationFrame(() => fitCanvasToContainer());
  if (viewMode === 'compare') requestAnimationFrame(() => fitComparePanes());
}
document.addEventListener('fullscreenchange', onFsChange);
document.addEventListener('webkitfullscreenchange', onFsChange);

// ============================================================
// Resize
// ============================================================
window.addEventListener('resize', () => {
  if (viewerLayout.classList.contains('hidden')) return;
  if (viewMode === 'single' && renderer) fitCanvasToContainer();
  if (viewMode === 'compare') fitComparePanes();
});
