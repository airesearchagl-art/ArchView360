'use strict';

/* ============================================================
 * ArchView360 v1.1 — 360° Panorama Viewer with Scene Management
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

// ---- Three.js ----
let renderer, threeScene, camera, sphere;
let animFrameId = null;

// ---- Camera state ----
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
// Scene management
// ============================================================

/** Validate files, create scenes, start viewer */
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
    showToast(`${valid.length} 件のシーンを追加しました`);
    // scroll the newly added item into view
    const items = sceneListEl.querySelectorAll('.scene-item');
    items[firstNewIdx]?.scrollIntoView({ block: 'nearest' });
  }
}

/** Switch the active panorama */
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

/** Delete one scene by index */
function deleteScene(idx) {
  if (idx < 0 || idx >= scenes.length) return;

  URL.revokeObjectURL(scenes[idx].blobUrl);

  const wasCurrent = idx === currentIdx;
  if (wasCurrent) stopRender();

  scenes.splice(idx, 1);

  if (scenes.length === 0) {
    disposeCurrentSphere();
    clearAllAndShowUpload();
    return;
  }

  // Determine which scene to show next
  let nextIdx = currentIdx;
  if (wasCurrent) {
    nextIdx = Math.min(idx, scenes.length - 1);
  } else if (idx < currentIdx) {
    nextIdx = currentIdx - 1;
  }

  currentIdx = -1;          // force re-load
  switchToScene(nextIdx);
}

/** Dispose GPU sphere + textures */
function disposeCurrentSphere() {
  if (sphere) {
    sphere.geometry.dispose();
    if (sphere.material.map) sphere.material.map.dispose();
    sphere.material.dispose();
    if (threeScene) threeScene.remove(sphere);
    sphere = null;
  }
}

/** Clear everything and return to upload screen */
function clearAllAndShowUpload() {
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

/** Rebuild the scene list DOM */
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

    // Double-click → edit inline
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
    });

    nameEl.addEventListener('keydown', (e) => {
      e.stopPropagation();               // prevent global keyboard shortcuts while editing
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

  // Update counter
  sceneCounter.textContent = scenes.length > 0
    ? `${currentIdx + 1} / ${scenes.length}`
    : '0 / 0';

  // Scroll active item into view
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

// ============================================================
// Render loop
// ============================================================
function startRender() {
  if (animFrameId !== null) return;
  function loop() {
    animFrameId = requestAnimationFrame(loop);
    if (autoRotate && !isDragging) theta += AUTO_ROTATE_SPEED;
    updateCamera();
    renderer.render(threeScene, camera);
  }
  loop();
}

function stopRender() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function updateCamera() {
  camera.lookAt(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  );
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
  camera.fov = fov;
  camera.updateProjectionMatrix();
  statusFov.textContent = `FOV: ${Math.round(fov)}°`;
}

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
// Mouse interaction
// ============================================================
const SENSITIVITY = 0.3;

viewerCanvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  viewerCanvas.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  rotate(e.clientX - lastX, e.clientY - lastY);
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  viewerCanvas.style.cursor = 'grab';
});

viewerCanvas.style.cursor = 'grab';

viewerCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  fov = Math.min(MAX_FOV, Math.max(MIN_FOV, fov + (e.deltaY > 0 ? 3 : -3)));
  applyFov();
}, { passive: false });

// ============================================================
// Touch interaction
// ============================================================
viewerCanvas.addEventListener('touchstart', (e) => {
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

viewerCanvas.addEventListener('touchmove', (e) => {
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

viewerCanvas.addEventListener('touchend', () => {
  lastTouches   = null;
  lastPinchDist = null;
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
  // Skip when editing a scene name or focused on an input
  if (document.activeElement?.contentEditable === 'true') return;
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  // Only active while viewer is shown
  if (viewerLayout.classList.contains('hidden')) return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      prevScene();
      break;
    case 'ArrowRight':
      e.preventDefault();
      nextScene();
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
      if (autoRotate) showToast('自動回転 ON');
      break;
    case 'f':
    case 'F':
      if (supportsFullscreen) fullscreenBtn.click();
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
  // If scenes remain, stay in viewer (user can pick from list)
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

if (!supportsFullscreen) fullscreenBtn.classList.add('hidden');

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
  if (renderer) requestAnimationFrame(() => fitCanvasToContainer());
}
document.addEventListener('fullscreenchange', onFsChange);
document.addEventListener('webkitfullscreenchange', onFsChange);

// ============================================================
// Resize
// ============================================================
window.addEventListener('resize', () => {
  if (renderer && !viewerLayout.classList.contains('hidden')) fitCanvasToContainer();
});
