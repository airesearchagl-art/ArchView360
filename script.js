'use strict';

/* ============================================================
 * ArchView360 — 360° Panorama Viewer
 * Three.js r128 を CDN から使用
 * ============================================================ */

// ----- DOM -----
const uploadSection  = document.getElementById('upload-section');
const viewerSection  = document.getElementById('viewer-section');
const dropZone       = document.getElementById('drop-zone');
const fileInput      = document.getElementById('file-input');
const viewerCanvas   = document.getElementById('viewer-canvas');
const loadingOverlay = document.getElementById('loading-overlay');
const errorOverlay   = document.getElementById('error-overlay');
const errorMessage   = document.getElementById('error-message');
const errorBackBtn   = document.getElementById('error-back-btn');
const resetBtn       = document.getElementById('reset-btn');
const backBtn        = document.getElementById('back-btn');
const statusFov      = document.getElementById('status-fov');
const statusFilename = document.getElementById('status-filename');
const globalError    = document.getElementById('global-error');

// ----- Three.js objects -----
let renderer, scene, camera, sphere;
let animFrameId = null;

// ----- Camera state -----
const DEFAULT_FOV   = 75;
const MIN_FOV       = 30;
const MAX_FOV       = 100;
const DEFAULT_PHI   = Math.PI / 2; // 垂直角（上下）
const DEFAULT_THETA = 0;           // 水平角（左右）

let phi   = DEFAULT_PHI;
let theta = DEFAULT_THETA;
let fov   = DEFAULT_FOV;

// ----- Drag state -----
let isDragging   = false;
let lastX        = 0;
let lastY        = 0;
let lastTouches  = null;
let lastPinchDist = null;

// ============================================================
// Three.js 初期化
// ============================================================
function initThree() {
  if (renderer) return; // 再初期化防止

  scene    = new THREE.Scene();
  camera   = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ canvas: viewerCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // サイズ設定は呼び出し元で showViewer() の後に fitCanvasToContainer() を行う
}

function fitCanvasToContainer() {
  const container = viewerCanvas.parentElement;
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || Math.round(window.innerHeight * 0.8);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ============================================================
// パノラマ画像の読み込みと球体生成
// ============================================================
function loadPanorama(src, filename) {
  showLoading(true);
  hideError();

  const texture = new THREE.TextureLoader().load(
    src,
    () => {
      buildSphere(texture);
      showLoading(false);
      statusFilename.textContent = filename || '';
      startRender();
    },
    undefined,
    () => {
      showLoading(false);
      showError('画像の読み込みに失敗しました。\n対応形式（JPEG / PNG / WebP）の画像を選択してください。');
    }
  );
}

function buildSphere(texture) {
  // 既存の球体を破棄
  if (sphere) {
    sphere.geometry.dispose();
    sphere.material.dispose();
    scene.remove(sphere);
  }

  // 球体の内側にテクスチャを貼る
  // geo.scale(-1,1,1) は winding order を反転させ FrontSide カリングで全面が消えるため使わない。
  // 代わりに BackSide を指定して球体の内面を描画する。
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
  // 球面座標からカメラの向きを計算
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
  viewerSection.classList.add('hidden');
  uploadSection.classList.remove('hidden');
  // リソース解放
  if (sphere) {
    sphere.geometry.dispose();
    sphere.material.map && sphere.material.map.dispose();
    sphere.material.dispose();
    scene.remove(sphere);
    sphere = null;
  }
}

function showLoading(visible) {
  loadingOverlay.classList.toggle('hidden', !visible);
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
  setTimeout(() => globalError.classList.add('hidden'), 5000);
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

  const url = URL.createObjectURL(file);

  showViewer();        // 先に表示してから
  initThree();         // renderer 初期化（clientWidth が取れる状態で）
  fitCanvasToContainer();
  loadPanorama(url, file.name);
}

// ============================================================
// ドラッグ & ドロップ
// ============================================================
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  handleFile(file);
});

dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});

fileInput.addEventListener('change', () => {
  handleFile(fileInput.files[0]);
  fileInput.value = ''; // 同一ファイル再選択を可能に
});

// ============================================================
// ビューワーのマウス操作
// ============================================================
const SENSITIVITY = 0.3; // deg/px

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

// ホイールズーム
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
  // 上下の角度をクランプ（真上・真下に入り込まないよう）
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

// ============================================================
// リサイズ対応
// ============================================================
window.addEventListener('resize', () => {
  if (renderer && !viewerSection.classList.contains('hidden')) {
    fitCanvasToContainer();
  }
});
