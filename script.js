'use strict';

/* ============================================================
 * ArchView360 v1.4 — 360° Panorama Viewer
 * Three.js r128 ローカル同梱
 * ============================================================ */

function init() {
  if (typeof THREE === 'undefined') {
    document.getElementById('threejs-error').classList.remove('hidden');
    document.getElementById('upload-section').classList.add('hidden');
    return;
  }

  // ---- DOM refs ----
  const uploadSection       = document.getElementById('upload-section');
  const viewerLayout        = document.getElementById('viewer-layout');
  const dropZone            = document.getElementById('drop-zone');
  const fileInput           = document.getElementById('file-input');
  const viewerCanvas        = document.getElementById('viewer-canvas');
  const viewerContainer     = document.getElementById('viewer-container');
  const loadingOverlay      = document.getElementById('loading-overlay');
  const loadingMessage      = document.getElementById('loading-message');
  const errorOverlay        = document.getElementById('error-overlay');
  const errorMessage        = document.getElementById('error-message');
  const errorBackBtn        = document.getElementById('error-back-btn');
  const statusFov           = document.getElementById('status-fov');
  const currentSceneNameEl  = document.getElementById('current-scene-name');
  const sceneListEl         = document.getElementById('scene-list');
  const sceneCounter        = document.getElementById('scene-counter');
  const addSceneBtn         = document.getElementById('add-scene-btn');
  const clearAllBtn         = document.getElementById('clear-all-btn');
  const globalError         = document.getElementById('global-error');
  const toast               = document.getElementById('toast');

  // Toolbars
  const toolbarSingle       = document.getElementById('toolbar-single');
  const toolbarCompare      = document.getElementById('toolbar-compare');

  // Single-mode toolbar buttons
  const addImgBtn           = document.getElementById('add-img-btn');
  const splitCompareBtn     = document.getElementById('split-compare-btn');
  const sliderCompareBtn    = document.getElementById('slider-compare-btn');
  const flipBtn             = document.getElementById('flip-btn');
  const autorotateBtn       = document.getElementById('autorotate-btn');
  const resetBtn            = document.getElementById('reset-btn');
  const fullscreenBtn       = document.getElementById('fullscreen-btn');
  const fullscreenIcon      = document.getElementById('fullscreen-icon');
  const backBtn             = document.getElementById('back-btn');

  // Compare-mode toolbar buttons
  const compareSelectA      = document.getElementById('compare-select-a');
  const compareSelectB      = document.getElementById('compare-select-b');
  const flipABtn            = document.getElementById('flip-a-btn');
  const flipBBtn            = document.getElementById('flip-b-btn');
  const swapAbBtn           = document.getElementById('swap-ab-btn');
  const layoutSideBtn       = document.getElementById('layout-side-btn');
  const layoutStackBtn      = document.getElementById('layout-stack-btn');
  const splitLayoutSep      = document.getElementById('split-layout-sep');
  const compareAutorotBtn   = document.getElementById('compare-autorotate-btn');
  const compareResetBtn     = document.getElementById('compare-reset-btn');
  const compareFsBtn        = document.getElementById('compare-fullscreen-btn');
  const exitCompareBtn      = document.getElementById('exit-compare-btn');

  // Compare containers
  const compareContainer    = document.getElementById('compare-container');
  const paneBEl             = document.getElementById('compare-pane-b');
  const canvasA             = document.getElementById('canvas-a');
  const canvasB             = document.getElementById('canvas-b');
  const loadingA            = document.getElementById('loading-a');
  const loadingB            = document.getElementById('loading-b');
  const compareNameA        = document.getElementById('compare-name-a');
  const compareNameB        = document.getElementById('compare-name-b');
  const sliderDivider       = document.getElementById('slider-divider');

  // ---- Three.js (single) ----
  let renderer, threeScene, camera, sphere;
  let animFrameId = null;

  // ---- Three.js (compare) ----
  let rendererA = null, rendererB = null;
  let sceneA = null, sceneB = null;
  let cameraA = null, cameraB = null;
  let sphereA = null, sphereB = null;
  let compareInited = false;

  // ---- Shared camera state ----
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

  // ---- Canvas drag ----
  let isDragging    = false;
  let lastX = 0, lastY = 0;
  let lastTouches = null, lastPinchDist = null;

  // ---- Slider drag ----
  let isSliderDragging = false;
  let sliderPos = 50;

  // ---- Toast ----
  let toastTimer = null;

  // ---- View mode ----
  let viewMode      = 'single'; // 'single' | 'split' | 'slider'
  let compareLayout = 'side';   // 'side' | 'stack'
  let compareIdxA   = 0;
  let compareIdxB   = 1;

  // ---- Scenes ----
  let scenes     = [];
  let currentIdx = -1;

  function genId() { return Math.random().toString(36).slice(2, 10); }

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
    viewerCanvas.addEventListener('webglcontextrestored', () => clearAllAndShowUpload());
  }

  function fitCanvasToContainer() {
    const w = viewerContainer.clientWidth  || window.innerWidth;
    const h = viewerContainer.clientHeight || Math.round(window.innerHeight * 0.7);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function initCompareRenderers() {
    if (compareInited) return;
    compareInited = true;
    sceneA  = new THREE.Scene();
    cameraA = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 1000);
    rendererA = new THREE.WebGLRenderer({ canvas: canvasA, antialias: true });
    rendererA.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    sceneB  = new THREE.Scene();
    cameraB = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 1000);
    rendererB = new THREE.WebGLRenderer({ canvas: canvasB, antialias: true });
    rendererB.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  function fitComparePanes() {
    fitOnePane(canvasA, rendererA, cameraA);
    fitOnePane(canvasB, rendererB, cameraB);
  }

  function fitOnePane(canvas, rend, cam) {
    if (!rend) return;
    const pane = canvas.parentElement;
    const w = pane.clientWidth  || 200;
    const h = pane.clientHeight || 200;
    rend.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }

  // ============================================================
  // GPU helpers
  // ============================================================
  function disposeMesh(mesh, scene) {
    if (!mesh) return;
    mesh.geometry.dispose();
    if (mesh.material.map) mesh.material.map.dispose();
    mesh.material.dispose();
    if (scene) scene.remove(mesh);
  }

  function disposeCurrentSphere() {
    disposeMesh(sphere, threeScene);
    sphere = null;
  }

  function applyFlipToMesh(mesh, flipH) {
    if (!mesh?.material?.map) return;
    const tex = mesh.material.map;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = flipH ? -1 : 1;
    tex.offset.x = flipH ? 1 : 0;
    tex.needsUpdate = true;
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
      if (fileList.length > 0)
        showGlobalError('有効なファイルがありません。JPEG・PNG・WebP（100MB以下）を選択してください。');
      return;
    }
    const skipped = fileList.length - valid.length;
    if (skipped > 0) showGlobalError(`${skipped} 件をスキップしました（対応外の形式または100MB超）。`);

    const wasEmpty    = scenes.length === 0;
    const firstNewIdx = scenes.length;

    valid.forEach(f => scenes.push({
      id:      genId(),
      name:    f.name.replace(/\.[^.]+$/, ''),
      blobUrl: URL.createObjectURL(f),
      flipH:   false,
    }));

    if (wasEmpty) {
      showViewerLayout();
      initThree();
      fitCanvasToContainer();
      switchToScene(0);
    } else {
      renderSceneList();
      if (viewMode !== 'single') updateCompareSelects();
      updateCompareBtns();
      showToast(`${valid.length} 件のシーンを追加しました`);
      sceneListEl.querySelectorAll('.scene-item')[firstNewIdx]
        ?.scrollIntoView({ block: 'nearest' });
    }
  }

  function switchToScene(idx) {
    if (idx < 0 || idx >= scenes.length) return;
    currentIdx = idx;
    const s = scenes[idx];
    currentSceneNameEl.textContent = s.name;
    flipBtn.classList.toggle('tbtn-active', s.flipH);
    renderSceneList();
    loadPanorama(s.blobUrl, s.name, s.flipH);
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
    const wasCurrent = (idx === currentIdx);
    if (wasCurrent) stopRender();
    if (viewMode !== 'single') exitCompareMode(true);

    scenes.splice(idx, 1);

    if (scenes.length === 0) {
      disposeCurrentSphere();
      clearAllAndShowUpload();
      return;
    }

    updateCompareBtns();
    let nextIdx = currentIdx;
    if (wasCurrent)            nextIdx = Math.min(idx, scenes.length - 1);
    else if (idx < currentIdx) nextIdx = currentIdx - 1;

    currentIdx = -1;
    switchToScene(nextIdx);
  }

  function clearAllAndShowUpload() {
    if (viewMode !== 'single') exitCompareMode(true);
    stopRender();
    hideToast();
    disposeCurrentSphere();
    scenes.forEach(s => URL.revokeObjectURL(s.blobUrl));
    scenes = []; currentIdx = -1;

    autoRotate = false;
    autorotateBtn.classList.remove('tbtn-active');
    compareAutorotBtn.classList.remove('tbtn-active');

    const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
    if ((document.fullscreenElement || document.webkitFullscreenElement) && exitFs)
      exitFs.call(document).catch(() => {});

    viewerLayout.classList.add('viewer-layout-hidden');
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
        if (viewMode !== 'single') updateCompareSelects();
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
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteScene(i); });

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

    sceneListEl.querySelector('.scene-item.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function updateCompareBtns() {
    const ok = scenes.length >= 2;
    splitCompareBtn.disabled  = !ok;
    sliderCompareBtn.disabled = !ok;
    splitCompareBtn.title  = ok ? '分割して2シーンを比較 (C)' : '2枚以上の画像が必要です';
    sliderCompareBtn.title = ok ? 'スライダーで2シーンを比較 (S)' : '2枚以上の画像が必要です';
  }

  // ============================================================
  // Panorama load / build
  // ============================================================
  function loadPanorama(src, name, flipH) {
    showLoading(true, `「${name}」を読み込み中…`);
    hideError();
    stopRender();
    new THREE.TextureLoader().load(
      src,
      (texture) => {
        buildSphere(texture, flipH);
        showLoading(false);
        startRender();
        showToast('ドラッグで自由に見回せます');
      },
      (prog) => {
        if (prog.total > 0) {
          const pct = Math.round(prog.loaded / prog.total * 100);
          showLoading(true, `「${name}」を読み込み中… ${pct}%`);
        }
      },
      () => {
        showLoading(false);
        showError('画像の読み込みに失敗しました。\n正距円筒図法の JPEG / PNG / WebP を選択してください。');
      }
    );
  }

  function buildSphere(texture, flipH) {
    disposeCurrentSphere();
    if (flipH) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.repeat.x = -1;
      texture.offset.x = 1;
    }
    const geo = new THREE.SphereGeometry(500, 60, 40);
    const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
    sphere = new THREE.Mesh(geo, mat);
    threeScene.add(sphere);
    resetView();
  }

  function loadCompareSphere(side, idx) {
    if (idx < 0 || idx >= scenes.length) return;
    const s        = scenes[idx];
    const loadEl   = side === 'a' ? loadingA : loadingB;
    const nameEl   = side === 'a' ? compareNameA : compareNameB;
    nameEl.textContent = s.name;
    loadEl.classList.remove('hidden');

    new THREE.TextureLoader().load(
      s.blobUrl,
      (texture) => {
        if (s.flipH) {
          texture.wrapS = THREE.RepeatWrapping;
          texture.repeat.x = -1;
          texture.offset.x = 1;
        }
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(500, 60, 40),
          new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide })
        );
        if (side === 'a') {
          disposeMesh(sphereA, sceneA);
          sphereA = mesh;
          sceneA.add(sphereA);
          fitOnePane(canvasA, rendererA, cameraA);
        } else {
          disposeMesh(sphereB, sceneB);
          sphereB = mesh;
          sceneB.add(sphereB);
          fitOnePane(canvasB, rendererB, cameraB);
        }
        loadEl.classList.add('hidden');
      },
      null,
      () => loadEl.classList.add('hidden')
    );
  }

  // ============================================================
  // Render loop
  // ============================================================
  function startRender() {
    if (animFrameId !== null) return;
    function loop() {
      animFrameId = requestAnimationFrame(loop);
      if (autoRotate && !isDragging && !isSliderDragging) theta += AUTO_ROTATE_SPEED;

      const lx = Math.sin(phi) * Math.cos(theta);
      const ly = Math.cos(phi);
      const lz = Math.sin(phi) * Math.sin(theta);

      if (viewMode === 'split' || viewMode === 'slider') {
        if (rendererA && sceneA && cameraA) { cameraA.lookAt(lx,ly,lz); rendererA.render(sceneA, cameraA); }
        if (rendererB && sceneB && cameraB) { cameraB.lookAt(lx,ly,lz); rendererB.render(sceneB, cameraB); }
      } else {
        if (renderer && threeScene && camera) { camera.lookAt(lx,ly,lz); renderer.render(threeScene, camera); }
      }
    }
    loop();
  }

  function stopRender() {
    if (animFrameId !== null) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  }

  // ============================================================
  // View control
  // ============================================================
  function resetView() {
    phi = DEFAULT_PHI; theta = DEFAULT_THETA; fov = DEFAULT_FOV;
    applyFov();
  }

  function applyFov() {
    if (camera)  { camera.fov  = fov; camera.updateProjectionMatrix(); }
    if (cameraA) { cameraA.fov = fov; cameraA.updateProjectionMatrix(); }
    if (cameraB) { cameraB.fov = fov; cameraB.updateProjectionMatrix(); }
    statusFov.textContent = `FOV: ${Math.round(fov)}°`;
  }

  // ============================================================
  // Show/hide viewer
  // ============================================================
  function showViewerLayout() {
    uploadSection.classList.add('hidden');
    viewerLayout.classList.remove('viewer-layout-hidden');
    // Single mode: show single toolbar, hide compare toolbar and compare container
    toolbarSingle.style.display  = '';
    toolbarCompare.style.display = 'none';
    compareContainer.style.display = 'none';
    viewerContainer.style.display  = '';
    updateCompareBtns();
  }

  // ============================================================
  // Split compare mode
  // ============================================================
  function enterSplitMode() {
    if (scenes.length < 2) { showToast('分割比較には2枚以上必要です'); return; }

    viewMode    = 'split';
    compareIdxA = currentIdx >= 0 ? currentIdx : 0;
    compareIdxB = compareIdxA === scenes.length - 1 ? compareIdxA - 1 : compareIdxA + 1;

    viewerContainer.style.display    = 'none';
    toolbarSingle.style.display      = 'none';
    toolbarCompare.style.display     = '';
    compareContainer.style.display   = '';
    compareContainer.classList.remove('slider-mode');
    sliderDivider.style.display      = 'none';
    paneBEl.style.clipPath           = '';
    paneBEl.style.pointerEvents      = '';

    applyCompareLayout(false);
    updateSplitLayoutBtns();
    initCompareRenderers();
    updateCompareSelects();

    requestAnimationFrame(() => {
      fitComparePanes();
      loadCompareSphere('a', compareIdxA);
      loadCompareSphere('b', compareIdxB);
    });

    stopRender();
    startRender();
  }

  // ============================================================
  // Slider compare mode
  // ============================================================
  function enterSliderMode() {
    if (scenes.length < 2) { showToast('スライダー比較には2枚以上必要です'); return; }

    viewMode    = 'slider';
    compareIdxA = currentIdx >= 0 ? currentIdx : 0;
    compareIdxB = compareIdxA === scenes.length - 1 ? compareIdxA - 1 : compareIdxA + 1;

    viewerContainer.style.display    = 'none';
    toolbarSingle.style.display      = 'none';
    toolbarCompare.style.display     = '';
    compareContainer.style.display   = '';
    compareContainer.classList.add('slider-mode');
    compareContainer.classList.remove('stack');
    sliderDivider.style.display      = '';
    paneBEl.style.pointerEvents      = 'none';

    // Hide split-only layout buttons
    layoutSideBtn.style.display  = 'none';
    layoutStackBtn.style.display = 'none';
    splitLayoutSep.style.display = 'none';

    sliderPos = 50;
    updateSlider(sliderPos);

    initCompareRenderers();
    updateCompareSelects();

    requestAnimationFrame(() => {
      fitComparePanes();
      loadCompareSphere('a', compareIdxA);
      loadCompareSphere('b', compareIdxB);
    });

    stopRender();
    startRender();
  }

  function exitCompareMode(silent) {
    if (viewMode === 'single' && !silent) return;
    viewMode = 'single';

    compareContainer.style.display   = 'none';
    compareContainer.classList.remove('slider-mode');
    compareContainer.classList.remove('stack');
    sliderDivider.style.display      = 'none';
    paneBEl.style.clipPath           = '';
    paneBEl.style.pointerEvents      = '';
    toolbarCompare.style.display     = 'none';
    toolbarSingle.style.display      = '';
    viewerContainer.style.display    = '';

    stopRender();
    if (scenes.length > 0) { fitCanvasToContainer(); startRender(); }
  }

  function applyCompareLayout(fit) {
    if (compareLayout === 'stack') {
      compareContainer.classList.add('stack');
    } else {
      compareContainer.classList.remove('stack');
    }
    updateSplitLayoutBtns();
    if (fit !== false) requestAnimationFrame(() => fitComparePanes());
  }

  function updateSplitLayoutBtns() {
    if (viewMode === 'slider') {
      layoutSideBtn.style.display  = 'none';
      layoutStackBtn.style.display = 'none';
      splitLayoutSep.style.display = 'none';
    } else {
      layoutSideBtn.style.display  = '';
      layoutStackBtn.style.display = '';
      splitLayoutSep.style.display = '';
      layoutSideBtn.classList.toggle('layout-btn-active',  compareLayout === 'side');
      layoutStackBtn.classList.toggle('layout-btn-active', compareLayout === 'stack');
    }
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
    flipABtn.classList.toggle('tbtn-active', scenes[compareIdxA]?.flipH || false);
    flipBBtn.classList.toggle('tbtn-active', scenes[compareIdxB]?.flipH || false);
  }

  // ============================================================
  // Slider position
  // ============================================================
  function updateSlider(pos) {
    sliderPos = Math.max(2, Math.min(98, pos));
    paneBEl.style.clipPath    = `inset(0 0 0 ${sliderPos}%)`;
    sliderDivider.style.left  = `${sliderPos}%`;
  }

  // ============================================================
  // A/B swap
  // ============================================================
  function swapAB() {
    [compareIdxA, compareIdxB] = [compareIdxB, compareIdxA];
    updateCompareSelects();
    loadCompareSphere('a', compareIdxA);
    loadCompareSphere('b', compareIdxB);
  }

  // ============================================================
  // Flip
  // ============================================================
  function toggleFlipSingle() {
    if (currentIdx < 0) return;
    scenes[currentIdx].flipH = !scenes[currentIdx].flipH;
    flipBtn.classList.toggle('tbtn-active', scenes[currentIdx].flipH);
    applyFlipToMesh(sphere, scenes[currentIdx].flipH);
  }

  function toggleFlipCompare(side) {
    const idx  = side === 'a' ? compareIdxA : compareIdxB;
    if (idx < 0 || idx >= scenes.length) return;
    scenes[idx].flipH = !scenes[idx].flipH;
    const btn  = side === 'a' ? flipABtn : flipBBtn;
    const mesh = side === 'a' ? sphereA  : sphereB;
    btn.classList.toggle('tbtn-active', scenes[idx].flipH);
    applyFlipToMesh(mesh, scenes[idx].flipH);
  }

  // ============================================================
  // UI helpers
  // ============================================================
  function showLoading(visible, msg) {
    loadingOverlay.classList.toggle('hidden', !visible);
    if (msg) loadingMessage.textContent = msg;
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorOverlay.classList.remove('hidden');
  }

  function hideError() { errorOverlay.classList.add('hidden'); }

  function showGlobalError(msg) {
    if (!msg) return;
    globalError.textContent = msg;
    globalError.classList.remove('hidden');
    setTimeout(() => globalError.classList.add('hidden'), 6000);
  }

  function showToast(msg, dur = 3000) {
    hideToast();
    toast.textContent = msg;
    toast.classList.remove('hidden');
    toast.classList.add('toast-show');
    toastTimer = setTimeout(hideToast, dur);
  }

  function hideToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    toast.classList.remove('toast-show');
    toast.classList.add('hidden');
  }

  // ============================================================
  // Drag & Drop upload
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
  // Canvas interaction
  // ============================================================
  const SENSITIVITY = 0.3;

  function rotate(dx, dy) {
    const r = Math.PI / 180;
    theta -= dx * SENSITIVITY * r;
    phi   -= dy * SENSITIVITY * r;
    phi    = Math.max(0.05, Math.min(Math.PI - 0.05, phi));
  }

  function pinchDist(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  }

  function onWheel(e) {
    e.preventDefault();
    fov = Math.min(MAX_FOV, Math.max(MIN_FOV, fov + (e.deltaY > 0 ? 3 : -3)));
    applyFov();
  }

  function attachCanvasInteraction(canvas) {
    canvas.style.cursor = 'grab';

    canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX; lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('wheel', onWheel, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        isDragging = true;
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
      isDragging = false;
      lastTouches = null; lastPinchDist = null;
      canvas.style.cursor = 'grab';
    });
  }

  // Attach once for all three canvases
  attachCanvasInteraction(viewerCanvas);
  attachCanvasInteraction(canvasA);
  attachCanvasInteraction(canvasB);

  // Global mouse events
  window.addEventListener('mousemove', (e) => {
    if (isSliderDragging) {
      const rect = compareContainer.getBoundingClientRect();
      updateSlider(((e.clientX - rect.left) / rect.width) * 100);
      return;
    }
    if (!isDragging) return;
    rotate(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    if (isSliderDragging) { isSliderDragging = false; return; }
    if (!isDragging) return;
    isDragging = false;
    [viewerCanvas, canvasA, canvasB].forEach(c => { c.style.cursor = 'grab'; });
  });

  // Slider divider drag
  sliderDivider.addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation();
    isSliderDragging = true;
  });

  sliderDivider.addEventListener('touchstart', (e) => {
    e.preventDefault(); e.stopPropagation();
    isSliderDragging = true;
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!isSliderDragging) return;
    e.preventDefault();
    if (e.touches.length === 1) {
      const rect = compareContainer.getBoundingClientRect();
      updateSlider(((e.touches[0].clientX - rect.left) / rect.width) * 100);
    }
  }, { passive: false });

  window.addEventListener('touchend', () => { isSliderDragging = false; });

  // ============================================================
  // Keyboard shortcuts
  // ============================================================
  document.addEventListener('keydown', (e) => {
    if (document.activeElement?.contentEditable === 'true') return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (viewerLayout.classList.contains('viewer-layout-hidden')) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (viewMode === 'single') prevScene();
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (viewMode === 'single') nextScene();
        break;
      case 'Escape':
        e.preventDefault();
        if (viewMode !== 'single') exitCompareMode();
        break;
      case 'r': case 'R': resetView(); break;
      case 'a': case 'A': toggleAutoRotate(); break;
      case 'f': case 'F':
        if (supportsFullscreen) {
          viewMode === 'single' ? fullscreenBtn.click() : compareFsBtn.click();
        }
        break;
      case 'm': case 'M':
        if (viewMode === 'single') toggleFlipSingle();
        break;
      case 'c': case 'C':
        if (viewMode === 'single') enterSplitMode();
        else if (viewMode !== 'slider') exitCompareMode();
        break;
      case 's': case 'S':
        if (viewMode === 'single') enterSliderMode();
        else if (viewMode === 'slider') exitCompareMode();
        break;
      case 'v': case 'V':
        if (viewMode === 'split') {
          compareLayout = compareLayout === 'side' ? 'stack' : 'side';
          applyCompareLayout();
        }
        break;
    }
  });

  function toggleAutoRotate(forced) {
    autoRotate = forced !== undefined ? forced : !autoRotate;
    autorotateBtn.classList.toggle('tbtn-active', autoRotate);
    compareAutorotBtn.classList.toggle('tbtn-active', autoRotate);
    if (autoRotate) showToast('自動回転 ON');
  }

  // ============================================================
  // Button wiring
  // ============================================================
  addImgBtn.addEventListener('click', () => fileInput.click());
  addSceneBtn.addEventListener('click', () => fileInput.click());
  clearAllBtn.addEventListener('click', clearAllAndShowUpload);
  backBtn.addEventListener('click', clearAllAndShowUpload);

  splitCompareBtn.addEventListener('click', enterSplitMode);
  sliderCompareBtn.addEventListener('click', enterSliderMode);
  exitCompareBtn.addEventListener('click', () => exitCompareMode());

  autorotateBtn.addEventListener('click', () => toggleAutoRotate());
  compareAutorotBtn.addEventListener('click', () => toggleAutoRotate());

  flipBtn.addEventListener('click', toggleFlipSingle);
  flipABtn.addEventListener('click', () => toggleFlipCompare('a'));
  flipBBtn.addEventListener('click', () => toggleFlipCompare('b'));

  swapAbBtn.addEventListener('click', swapAB);

  resetBtn.addEventListener('click', resetView);
  compareResetBtn.addEventListener('click', resetView);

  layoutSideBtn.addEventListener('click', () => {
    if (viewMode !== 'split') return;
    compareLayout = 'side';
    applyCompareLayout();
  });

  layoutStackBtn.addEventListener('click', () => {
    if (viewMode !== 'split') return;
    compareLayout = 'stack';
    applyCompareLayout();
  });

  compareSelectA.addEventListener('change', () => {
    compareIdxA = parseInt(compareSelectA.value, 10);
    flipABtn.classList.toggle('tbtn-active', scenes[compareIdxA]?.flipH || false);
    loadCompareSphere('a', compareIdxA);
  });

  compareSelectB.addEventListener('change', () => {
    compareIdxB = parseInt(compareSelectB.value, 10);
    flipBBtn.classList.toggle('tbtn-active', scenes[compareIdxB]?.flipH || false);
    loadCompareSphere('b', compareIdxB);
  });

  errorBackBtn.addEventListener('click', () => {
    hideError();
    if (scenes.length === 0) clearAllAndShowUpload();
  });

  // ============================================================
  // Fullscreen
  // ============================================================
  const supportsFullscreen = !!(
    viewerContainer.requestFullscreen || viewerContainer.webkitRequestFullscreen
  );

  if (!supportsFullscreen) {
    fullscreenBtn.classList.add('hidden');
    compareFsBtn.classList.add('hidden');
  }

  fullscreenBtn.addEventListener('click', () => {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) {
      const req = viewerContainer.requestFullscreen || viewerContainer.webkitRequestFullscreen;
      if (req) req.call(viewerContainer).catch(err =>
        showGlobalError(`全画面表示に失敗しました: ${err.message}`)
      );
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => {});
    }
  });

  compareFsBtn.addEventListener('click', () => {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) {
      const req = compareContainer.requestFullscreen || compareContainer.webkitRequestFullscreen;
      if (req) req.call(compareContainer).catch(err =>
        showGlobalError(`全画面表示に失敗しました: ${err.message}`)
      );
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => {});
    }
  });

  function onFsChange() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    fullscreenIcon.textContent = isFs ? '✕' : '⛶';
    fullscreenBtn.title = isFs ? '全画面を終了 (F)' : '全画面表示 (F)';
    requestAnimationFrame(() => {
      if (viewMode === 'single' && renderer) fitCanvasToContainer();
      if (viewMode === 'split' || viewMode === 'slider') fitComparePanes();
    });
  }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  // ============================================================
  // Resize
  // ============================================================
  window.addEventListener('resize', () => {
    if (viewerLayout.classList.contains('viewer-layout-hidden')) return;
    if (viewMode === 'single' && renderer) fitCanvasToContainer();
    if (viewMode === 'split' || viewMode === 'slider') fitComparePanes();
  });

} // end init()

// ---- Wait for Three.js ----
(function waitForThree(retries) {
  if (typeof THREE !== 'undefined') {
    init();
  } else if (retries > 0) {
    setTimeout(() => waitForThree(retries - 1), 100);
  } else {
    const el = document.getElementById('threejs-error');
    if (el) el.classList.remove('hidden');
    const us = document.getElementById('upload-section');
    if (us) us.classList.add('hidden');
  }
})(50);
