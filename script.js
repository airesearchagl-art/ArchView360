'use strict';

/* ============================================================
 * ArchView360 — 360° Panorama Viewer
 * Three.js r128 CDN
 * ============================================================ */

// ---- Three.js 読み込み確認 ----
if (typeof THREE === 'undefined') {
  document.getElementById('threejs-error').classList.remove('hidden');
  document.getElementById('upload-section').classList.add('hidden');
  throw new Error('Three.js の読み込みに失敗しました。');
}

// ----- DOM -----
const uploadSection   = document.getElementById('upload-section');
const viewerSection   = document.getElementById('viewer-section');
const dropZone        = document.getElementById('drop-zone');
const fileInput       = document.getElementById('file-input');
const viewerCanvas    = document.getElementById('viewer-canvas');
const viewerContainer = document.getElementById('viewer-container');
const loadingOverlay  = document.getElementById('loading-overlay');
const loadingMessage  = document.getElementById('loading-message');
const errorOverlay    = document.getElementById('error-overlay');
const errorMessage    = document.getElementById('error-message');
const errorBackBtn    = document.getElementById('error-back-btn');
const resetBtn        = document.getElementById('reset-btn');
const backBtn         = document.getElementById('back-btn');
const autorotateBtn   = document.getElementById('autorotate-btn');
const fullscreenBtn   = document.getElementById('fullscreen-btn');
const fullscreenIcon  = document.getElementById('fullscreen-icon');
const statusFov       = document.getElementById('status-fov');
const statusFilename  = document.getElementById('status-filename');
const globalError     = document.getElementById('global-error');
const toast           = document.getElementById('toast');

// ----- Three.js objects -----
let renderer, scene, camera, sphere;
let animFrameId = null;
let currentBlobUrl = null;

// ----- Camera state -----
const DEFAULT_FOV   = 75;
const MIN_FOV       = 30;
const MAX_FOV       = 100;
const DEFAULT_PHI   = Math.PI / 2;
const DEFAULT_THETA = 0;

let phi   = DEFAULT_PHI;
let theta = DEFAULT_THETA;
let fov   = DEFAULT_FOV;

// ----- Auto-rotate -----
let autoRotate = false;
const AUTO_ROTATE_SPEED = 0.0015; // rad/frame

// ----- Drag state -----
let isDragging    = false;
let lastX         = 0;
let lastY         = 0;
let lastTouches   = null;
let lastPinchDist = null;

// ----- Toast timer -----
let toastTimer = null;

// ============================================================
// Three.js 初期化
// ============================================================
function initThree() {
  if (renderer) return;

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ canvas: viewerCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function fitCanvasToContainer() {
  const w = viewerContainer.clientWidth  || window.innerWidth;
  const h = viewerContainer.clientHeight || Math.round(window.innerHeight * 0.8);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ============================================================
// パノラマ読み込みと球体生成
// ============================================================
function loadPanorama(src, filename) {
  showLoading(true, '画像を読み込み中…');
  hideError();

  const loader = new THREE.TextureLoader();
  loader.load(
    src,
    (texture) => {
      buildSphere(texture);
      showLoading(false);
      statusFilename.textContent = filename || '';
      startRender();
      showToast('ドラッグで自由に見回せます 🖱️');
    },
    (progress) => {
      if (progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        showLoading(true, `画像を読み込み中… ${pct}%`);
      }
    },
    () => {
      showLoading(false);
      showError('画像の読み込みに失敗しました。\n正距円筒図法の JPEG / PNG / WebP を選択してください。');
    }
  );
}

function buildSphere(texture) {
  // 既存の球体とテクスチャを完全に解放
  if (sphere) {
    sphere.geometry.dispose();
    if (sphere.material.map) sphere.material.map.dispose();
    sphere.material.dispose();
    scene.remove(sphere);
    sphere = null;
  }

  // BackSide で球体の内面を描画（正距円筒図法パノラマの正しい貼り付け方）
  const geo = new THREE.SphereGeometry(500, 60, 40);
  const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
  sphere = new THREE.Mesh(geo, mat);
  scene.add(sphere);

  resetView();
}

// ============================================================
// レンダーループ
// ============================================================
function startRender() {
  if (animFrameId !== null) return;

  function loop() {
    animFrameId = requestAnimationFrame(loop);
    if (autoRotate && !isDragging) {
      theta += AUTO_ROTATE_SPEED;
    }
    updateCamera();
    renderer.render(scene, camera);
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
  const x = Math.sin(phi) * Math.cos(theta);
  const y = Math.cos(phi);
  const z = Math.sin(phi) * Math.sin(theta);
  camera.lookAt(x, y, z);
}

// ============================================================
// 視点リセット
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
// UI 切り替え
// ============================================================
function showViewer() {
  uploadSection.classList.add('hidden');
  viewerSection.classList.remove('hidden');
}

function showUpload() {
  stopRender();
  hideToast();

  // リソース解放
  if (sphere) {
    sphere.geometry.dispose();
    if (sphere.material.map) sphere.material.map.dispose();
    sphere.material.dispose();
    scene.remove(sphere);
    sphere = null;
  }

  // BlobURL 解放
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }

  // 全画面解除
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

  viewerSection.classList.add('hidden');
  uploadSection.classList.remove('hidden');
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
  globalError.textContent = msg;
  globalError.classList.remove('hidden');
  setTimeout(() => globalError.classList.add('hidden'), 6000);
}

function showToast(msg, duration = 3500) {
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
// ファイル処理
// ============================================================
function handleFile(file) {
  if (!file) return;

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    showGlobalError('対応していないファイル形式です。JPEG・PNG・WebP のいずれかを選択してください。');
    return;
  }

  const maxMB = 100;
  if (file.size > maxMB * 1024 * 1024) {
    showGlobalError(`ファイルサイズが大きすぎます（上限 ${maxMB}MB）。`);
    return;
  }

  // 前の BlobURL を解放
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
  }
  currentBlobUrl = URL.createObjectURL(file);

  showViewer();           // 先に表示 → clientWidth を正確に取得できる
  initThree();
  fitCanvasToContainer();
  loadPanorama(currentBlobUrl, file.name);
}

// ============================================================
// ドラッグ & ドロップ
// ============================================================
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  // ドロップゾーン外に出た時だけ解除
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
});

dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  handleFile(fileInput.files[0]);
  fileInput.value = '';
});

// ============================================================
// マウス操作
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
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  rotate(dx, dy);
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  viewerCanvas.style.cursor = 'grab';
});

viewerCanvas.style.cursor = 'grab';

viewerCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 3 : -3;
  fov = Math.min(MAX_FOV, Math.max(MIN_FOV, fov + delta));
  applyFov();
}, { passive: false });

// ============================================================
// タッチ操作
// ============================================================
viewerCanvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (e.touches.length === 1) {
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
    lastPinchDist = null;
  } else if (e.touches.length === 2) {
    lastPinchDist = pinchDistance(e.touches);
  }
  lastTouches = e.touches;
}, { passive: false });

viewerCanvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (e.touches.length === 1 && lastTouches && lastTouches.length === 1) {
    const dx = e.touches[0].clientX - lastX;
    const dy = e.touches[0].clientY - lastY;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
    rotate(dx, dy);
  } else if (e.touches.length === 2) {
    const dist = pinchDistance(e.touches);
    if (lastPinchDist !== null) {
      const delta = (lastPinchDist - dist) * 0.15;
      fov = Math.min(MAX_FOV, Math.max(MIN_FOV, fov + delta));
      applyFov();
    }
    lastPinchDist = dist;
  }
  lastTouches = e.touches;
}, { passive: false });

viewerCanvas.addEventListener('touchend', () => {
  lastTouches = null;
  lastPinchDist = null;
});

function pinchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function rotate(dx, dy) {
  const degToRad = Math.PI / 180;
  theta -= dx * SENSITIVITY * degToRad;
  phi   -= dy * SENSITIVITY * degToRad;
  phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi));
}

// ============================================================
// コントロールボタン
// ============================================================
resetBtn.addEventListener('click', resetView);
backBtn.addEventListener('click', showUpload);

errorBackBtn.addEventListener('click', () => {
  hideError();
  showUpload();
});

// 自動回転
autorotateBtn.addEventListener('click', () => {
  autoRotate = !autoRotate;
  autorotateBtn.classList.toggle('ctrl-btn-active', autoRotate);
  autorotateBtn.title = autoRotate ? '自動回転をOFF' : '自動回転をON';
  if (autoRotate) showToast('自動回転 ON');
});

// 全画面
fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    viewerContainer.requestFullscreen().catch((err) => {
      showGlobalError(`全画面表示に失敗しました: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
});

document.addEventListener('fullscreenchange', () => {
  const isFs = !!document.fullscreenElement;
  fullscreenIcon.textContent = isFs ? '✕' : '⛶';
  fullscreenBtn.title = isFs ? '全画面を終了' : '全画面表示';
  // 全画面切り替え後にキャンバスサイズを再計算
  if (renderer) {
    requestAnimationFrame(() => fitCanvasToContainer());
  }
});

// ============================================================
// リサイズ対応
// ============================================================
window.addEventListener('resize', () => {
  if (renderer && !viewerSection.classList.contains('hidden')) {
    fitCanvasToContainer();
  }
});
