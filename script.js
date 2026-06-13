'use strict';

/* ============================================================
 * ArchView360 v1.5
 * Three.js r128 ローカル同梱
 * ============================================================ */

function init() {
  if (typeof THREE === 'undefined') {
    show('threejs-error');
    hide('upload-section');
    return;
  }

  // ---- Helpers ----
  function $(id) { return document.getElementById(id); }
  function show(id) { $(id).style.display = ''; }
  function hide(id) { $(id).style.display = 'none'; }
  function showEl(el) { el.style.display = ''; }
  function hideEl(el) { el.style.display = 'none'; }

  // ---- DOM refs ----
  const uploadSection      = $('upload-section');
  const viewerLayout       = $('viewer-layout');
  const dropZone           = $('drop-zone');
  const fileInput          = $('file-input');

  // Single toolbar
  const toolbarSingle      = $('toolbar-single');
  const addImgBtn          = $('add-img-btn');
  const splitCompareBtn    = $('split-compare-btn');
  const sliderCompareBtn   = $('slider-compare-btn');
  const flipBtn            = $('flip-btn');
  const autorotateBtn      = $('autorotate-btn');
  const resetBtn           = $('reset-btn');
  const fullscreenBtn      = $('fullscreen-btn');
  const fullscreenIcon     = $('fullscreen-icon');
  const backBtn            = $('back-btn');

  // Compare toolbar
  const toolbarCompare     = $('toolbar-compare');
  const exitCompareBtn     = $('exit-compare-btn');
  const switchToSplitBtn   = $('switch-to-split-btn');
  const switchToSliderBtn  = $('switch-to-slider-btn');
  const compareSelectA     = $('compare-select-a');
  const compareSelectB     = $('compare-select-b');
  const flipABtn           = $('flip-a-btn');
  const flipBBtn           = $('flip-b-btn');
  const swapAbBtn          = $('swap-ab-btn');
  const layoutLrBtn        = $('layout-lr-btn');
  const layoutTbBtn        = $('layout-tb-btn');
  const splitLayoutSep     = $('split-layout-sep');
  const compareAutorotBtn  = $('compare-autorotate-btn');
  const compareResetBtn    = $('compare-reset-btn');
  const compareFsBtn       = $('compare-fullscreen-btn');

  // Sidebar
  const addSceneBtn        = $('add-scene-btn');
  const clearAllBtn        = $('clear-all-btn');
  const sceneListEl        = $('scene-list');
  const sceneCounter       = $('scene-counter');

  // Viewer
  const viewerCanvas       = $('viewer-canvas');
  const viewerContainer    = $('viewer-container');
  const loadingOverlay     = $('loading-overlay');
  const loadingMessage     = $('loading-message');
  const errorOverlay       = $('error-overlay');
  const errorMessage       = $('error-message');
  const errorBackBtn       = $('error-back-btn');
  const statusFov          = $('status-fov');
  const currentSceneNameEl = $('current-scene-name');
  const toast              = $('toast');
  const globalError        = $('global-error');

  // Compare
  const compareContainer   = $('compare-container');
  const paneBEl            = $('compare-pane-b');
  const canvasA            = $('canvas-a');
  const canvasB            = $('canvas-b');
  const loadingA           = $('loading-a');
  const loadingB           = $('loading-b');
  const compareNameA       = $('compare-name-a');
  const compareNameB       = $('compare-name-b');
  const sliderDivider      = $('slider-divider');

  // ---- Three.js (single) ----
  let renderer, threeScene, camera, sphere;
  let animFrameId = null;

  // ---- Three.js (compare) ----
  let rendererA = null, rendererB = null;
  let sceneA    = null, sceneB    = null;
  let cameraA   = null, cameraB   = null;
  let sphereA   = null, sphereB   = null;
  let compareInited = false;

  // ---- Camera state (shared) ----
  const DEFAULT_FOV   = 75;
  const MIN_FOV       = 30;
  const MAX_FOV       = 100;
  const DEFAULT_PHI   = Math.PI / 2;
  const DEFAULT_THETA = 0;
  let phi   = DEFAULT_PHI;
  let theta = DEFAULT_THETA;
  let fov   = DEFAULT_FOV;

  // ---- Autorotate ----
  let autoRotate = false;
  const AUTO_ROTATE_SPEED = 0.0015;

  // ---- Canvas drag ----
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let lastTouches = null, lastPinchDist = null;

  // ---- Slider drag ----
  let isSliderDragging = false;
  let sliderPos = 50;

  // ---- Toast timer ----
  let toastTimer = null;

  // ---- State ----
  let viewMode      = 'single'; // 'single' | 'split' | 'slider'
  let compareLayout = 'side';   // 'side' | 'stack'  (split mode)
  let compareIdxA   = 0;
  let compareIdxB   = 1;
  let viewerActive  = false;

  // ---- Scenes ----
  let scenes     = [];
  let currentIdx = -1;

  function genId() { return Math.random().toString(36).slice(2, 10); }

  // ============================================================
  // Three.js — single
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
    viewerCanvas.addEventListener('webglcontextrestored', clearAllAndShowUpload);
  }

  function fitSingleCanvas() {
    const w = viewerContainer.clientWidth  || window.innerWidth;
    const h = viewerContainer.clientHeight || Math.round(window.innerHeight * 0.7);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ============================================================
  // Three.js — compare
  // ============================================================
  function initCompareRenderers() {
    if (compareInited) return;
    compareInited = true;

    sceneA    = new THREE.Scene();
    cameraA   = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 1000);
    rendererA = new THREE.WebGLRenderer({ canvas: canvasA, antialias: true });
    rendererA.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    sceneB    = new THREE.Scene();
    cameraB   = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 1000);
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

  function disposeCurrentSphere() { disposeMesh(sphere, threeScene); sphere = null; }

  function applyFlip(mesh, flipH) {
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
    const allowed  = new Set(['image/jpeg','image/png','image/webp']);
    const maxBytes = 100 * 1024 * 1024;
    const valid    = Array.from(fileList).filter(f => allowed.has(f.type) && f.size <= maxBytes);

    if (!valid.length) {
      if (fileList.length) showGlobalError('有効なファイルがありません。JPEG・PNG・WebP（100MB以下）を選択してください。');
      return;
    }

    const skipped = fileList.length - valid.length;
    if (skipped) showGlobalError(`${skipped} 件をスキップしました（対応外の形式または100MB超）。`);

    const wasEmpty    = !scenes.length;
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
      // Wait for browser reflow so viewerContainer has real dimensions
      requestAnimationFrame(() => {
        fitSingleCanvas();
        switchToScene(0);
      });
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
    flipBtn.classList.toggle('active', s.flipH);
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
    const wasCurrent = idx === currentIdx;
    if (wasCurrent) stopRender();
    if (viewMode !== 'single') exitCompareMode(true);
    scenes.splice(idx, 1);

    if (!scenes.length) { disposeCurrentSphere(); clearAllAndShowUpload(); return; }

    updateCompareBtns();
    let next = currentIdx;
    if (wasCurrent)            next = Math.min(idx, scenes.length - 1);
    else if (idx < currentIdx) next = currentIdx - 1;
    currentIdx = -1;
    switchToScene(next);
  }

  function clearAllAndShowUpload() {
    if (viewMode !== 'single') exitCompareMode(true);
    stopRender();
    hideToast();
    disposeCurrentSphere();
    scenes.forEach(s => URL.revokeObjectURL(s.blobUrl));
    scenes = []; currentIdx = -1; viewerActive = false;

    autoRotate = false;
    autorotateBtn.classList.remove('active');
    compareAutorotBtn.classList.remove('active');

    const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
    if ((document.fullscreenElement || document.webkitFullscreenElement) && exitFs)
      exitFs.call(document).catch(() => {});

    hideEl(viewerLayout);
    showEl(uploadSection);
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
        const r = document.createRange();
        r.selectNodeContents(nameEl);
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(r);
      });

      nameEl.addEventListener('blur', () => {
        nameEl.contentEditable = 'false';
        nameEl.classList.remove('editing');
        const n = nameEl.textContent.trim();
        s.name = n || s.name;
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

      li.appendChild(numEl); li.appendChild(nameEl); li.appendChild(delBtn);
      li.addEventListener('click', () => {
        if (nameEl.contentEditable === 'true') return;
        if (i !== currentIdx) switchToScene(i);
      });
      sceneListEl.appendChild(li);
    });

    sceneCounter.textContent = scenes.length
      ? `${currentIdx + 1} / ${scenes.length}`
      : '0 / 0';

    sceneListEl.querySelector('.scene-item.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function updateCompareBtns() {
    const ok = scenes.length >= 2;
    splitCompareBtn.disabled  = !ok;
    sliderCompareBtn.disabled = !ok;
    splitCompareBtn.title  = ok ? '分割して2シーンを比較 (C)' : '2枚以上のシーンが必要です';
    sliderCompareBtn.title = ok ? 'スライダーで2シーンを比較 (S)' : '2枚以上のシーンが必要です';
    switchToSplitBtn.disabled  = !ok;
    switchToSliderBtn.disabled = !ok;
  }

  // ============================================================
  // Panorama load
  // ============================================================
  function loadPanorama(src, name, flipH) {
    showLoadingOverlay(true, `「${name}」を読み込み中…`);
    hideErrorOverlay();
    stopRender();

    new THREE.TextureLoader().load(
      src,
      (texture) => {
        buildSphere(texture, flipH);
        showLoadingOverlay(false);
        startRender();
        showToast('ドラッグで自由に見回せます');
      },
      (prog) => {
        if (prog.total > 0) {
          const pct = Math.round(prog.loaded / prog.total * 100);
          showLoadingOverlay(true, `「${name}」を読み込み中… ${pct}%`);
        }
      },
      () => {
        showLoadingOverlay(false);
        showError('画像の読み込みに失敗しました。\n正距円筒図法の JPEG / PNG / WebP を選択してください。');
      }
    );
  }

  function buildSphere(texture, flipH) {
    disposeCurrentSphere();
    if (flipH) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.repeat.x = -1; texture.offset.x = 1;
    }
    const geo = new THREE.SphereGeometry(500, 60, 40);
    const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
    sphere = new THREE.Mesh(geo, mat);
    threeScene.add(sphere);
    resetView();
  }

  function loadCompareSphere(side, idx) {
    if (idx < 0 || idx >= scenes.length) return;
    const s      = scenes[idx];
    const loadEl = side === 'a' ? loadingA : loadingB;
    const nameEl = side === 'a' ? compareNameA : compareNameB;
    nameEl.textContent = s.name;
    showEl(loadEl);

    new THREE.TextureLoader().load(
      s.blobUrl,
      (texture) => {
        if (s.flipH) {
          texture.wrapS = THREE.RepeatWrapping;
          texture.repeat.x = -1; texture.offset.x = 1;
        }
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(500, 60, 40),
          new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide })
        );
        if (side === 'a') { disposeMesh(sphereA, sceneA); sphereA = mesh; sceneA.add(sphereA); fitOnePane(canvasA, rendererA, cameraA); }
        else               { disposeMesh(sphereB, sceneB); sphereB = mesh; sceneB.add(sphereB); fitOnePane(canvasB, rendererB, cameraB); }
        hideEl(loadEl);
      },
      null,
      () => hideEl(loadEl)
    );
  }

  // ============================================================
  // Render loop
  // ============================================================
  function startRender() {
    if (animFrameId !== null) return;
    // Ensure canvas is sized before first frame
    if (viewMode === 'single' && renderer) fitSingleCanvas();
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
  // Show viewer
  // ============================================================
  function showViewerLayout() {
    viewerActive = true;
    hideEl(uploadSection);
    viewerLayout.style.display = 'flex';
    // Initial state: single mode
    showEl(toolbarSingle);
    hideEl(toolbarCompare);
    showEl(viewerContainer);
    hideEl(compareContainer);
    updateCompareBtns();
  }

  // ============================================================
  // Split compare mode
  // ============================================================
  function enterSplitMode() {
    if (scenes.length < 2) { showToast('分割比較には2枚以上のシーンが必要です'); return; }
    // Clean up from any previous compare mode
    if (viewMode === 'slider') _exitCompareUI();
    else if (viewMode === 'split') { /* already in split, refresh */ }

    viewMode    = 'split';
    compareIdxA = currentIdx >= 0 ? currentIdx : 0;
    compareIdxB = compareIdxA === scenes.length - 1 ? compareIdxA - 1 : compareIdxA + 1;

    hideEl(viewerContainer);
    hideEl(toolbarSingle);
    showEl(toolbarCompare);
    showEl(compareContainer);
    compareContainer.classList.remove('slider-mode');
    hideEl(sliderDivider);
    paneBEl.style.clipPath    = '';
    paneBEl.style.pointerEvents = '';

    // Show layout buttons
    showEl(layoutLrBtn);
    showEl(layoutTbBtn);
    showEl(splitLayoutSep);

    // Highlight current layout
    applyCompareLayout(false);
    updateCompareSelects();
    switchToSplitBtn.classList.add('active');
    switchToSliderBtn.classList.remove('active');

    initCompareRenderers();
    requestAnimationFrame(() => {
      fitComparePanes();
      loadCompareSphere('a', compareIdxA);
      loadCompareSphere('b', compareIdxB);
    });
    stopRender(); startRender();
  }

  // ============================================================
  // Slider compare mode
  // ============================================================
  function enterSliderMode() {
    if (scenes.length < 2) { showToast('スライダー比較には2枚以上のシーンが必要です'); return; }
    if (viewMode === 'split') _exitCompareUI();

    viewMode    = 'slider';
    compareIdxA = currentIdx >= 0 ? currentIdx : 0;
    compareIdxB = compareIdxA === scenes.length - 1 ? compareIdxA - 1 : compareIdxA + 1;

    hideEl(viewerContainer);
    hideEl(toolbarSingle);
    showEl(toolbarCompare);
    showEl(compareContainer);
    compareContainer.classList.add('slider-mode');
    compareContainer.classList.remove('stack');
    showEl(sliderDivider);
    paneBEl.style.pointerEvents = 'none'; // pane-a handles all interaction

    // Hide split-only layout buttons
    hideEl(layoutLrBtn);
    hideEl(layoutTbBtn);
    hideEl(splitLayoutSep);

    switchToSliderBtn.classList.add('active');
    switchToSplitBtn.classList.remove('active');

    sliderPos = 50;
    updateSlider(sliderPos);

    updateCompareSelects();
    initCompareRenderers();
    requestAnimationFrame(() => {
      fitComparePanes();
      loadCompareSphere('a', compareIdxA);
      loadCompareSphere('b', compareIdxB);
    });
    stopRender(); startRender();
  }

  // Internal: clean up compare UI without changing viewMode
  function _exitCompareUI() {
    compareContainer.classList.remove('slider-mode', 'stack');
    paneBEl.style.clipPath    = '';
    paneBEl.style.pointerEvents = '';
  }

  function exitCompareMode(silent) {
    if (viewMode === 'single' && !silent) return;
    _exitCompareUI();
    viewMode = 'single';

    hideEl(compareContainer);
    hideEl(sliderDivider);
    hideEl(toolbarCompare);
    showEl(toolbarSingle);
    showEl(viewerContainer);
    switchToSplitBtn.classList.remove('active');
    switchToSliderBtn.classList.remove('active');

    stopRender();
    if (scenes.length) { fitSingleCanvas(); startRender(); }
  }

  function applyCompareLayout(fit) {
    if (compareLayout === 'stack') {
      compareContainer.classList.add('stack');
      layoutLrBtn.classList.remove('active');
      layoutTbBtn.classList.add('active');
    } else {
      compareContainer.classList.remove('stack');
      layoutLrBtn.classList.add('active');
      layoutTbBtn.classList.remove('active');
    }
    if (fit !== false) requestAnimationFrame(fitComparePanes);
  }

  function updateCompareSelects() {
    [compareSelectA, compareSelectB].forEach((sel, si) => {
      const cur = si === 0 ? compareIdxA : compareIdxB;
      sel.innerHTML = '';
      scenes.forEach((s, i) => {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = `${i+1}. ${s.name}`;
        if (i === cur) opt.selected = true;
        sel.appendChild(opt);
      });
    });
    flipABtn.classList.toggle('active', scenes[compareIdxA]?.flipH || false);
    flipBBtn.classList.toggle('active', scenes[compareIdxB]?.flipH || false);
  }

  // ============================================================
  // Slider
  // ============================================================
  function updateSlider(pos) {
    sliderPos = Math.max(2, Math.min(98, pos));
    paneBEl.style.clipPath   = `inset(0 0 0 ${sliderPos}%)`;
    sliderDivider.style.left = `${sliderPos}%`;
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
    flipBtn.classList.toggle('active', scenes[currentIdx].flipH);
    applyFlip(sphere, scenes[currentIdx].flipH);
  }

  function toggleFlipCompare(side) {
    const idx  = side === 'a' ? compareIdxA : compareIdxB;
    if (idx < 0 || idx >= scenes.length) return;
    scenes[idx].flipH = !scenes[idx].flipH;
    (side === 'a' ? flipABtn : flipBBtn).classList.toggle('active', scenes[idx].flipH);
    applyFlip(side === 'a' ? sphereA : sphereB, scenes[idx].flipH);
  }

  // ============================================================
  // Autorotate
  // ============================================================
  function toggleAutoRotate(forced) {
    autoRotate = forced !== undefined ? forced : !autoRotate;
    autorotateBtn.classList.toggle('active', autoRotate);
    compareAutorotBtn.classList.toggle('active', autoRotate);
    if (autoRotate) showToast('自動回転 ON');
  }

  // ============================================================
  // UI Overlays
  // ============================================================
  function showLoadingOverlay(visible, msg) {
    loadingOverlay.style.display = visible ? '' : 'none';
    if (msg) loadingMessage.textContent = msg;
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorOverlay.style.display = '';
  }

  function hideErrorOverlay() { hideEl(errorOverlay); }

  function showGlobalError(msg) {
    if (!msg) return;
    globalError.textContent = msg;
    globalError.style.display = '';
    setTimeout(() => hideEl(globalError), 6000);
  }

  function showToast(msg, dur = 3000) {
    hideToast();
    toast.textContent = msg;
    toast.classList.add('show');
    toastTimer = setTimeout(hideToast, dur);
  }

  function hideToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    toast.classList.remove('show');
  }

  // ============================================================
  // Drop zone
  // ============================================================
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault(); dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
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
      isDragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('wheel', onWheel, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        isDragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; lastPinchDist = null;
      } else if (e.touches.length === 2) {
        lastPinchDist = pinchDist(e.touches);
      }
      lastTouches = e.touches;
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && lastTouches?.length === 1) {
        rotate(e.touches[0].clientX - lastX, e.touches[0].clientY - lastY);
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
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
      isDragging = false; lastTouches = null; lastPinchDist = null;
      canvas.style.cursor = 'grab';
    });
  }

  attachCanvasInteraction(viewerCanvas);
  attachCanvasInteraction(canvasA);
  attachCanvasInteraction(canvasB);

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
    e.preventDefault(); e.stopPropagation(); isSliderDragging = true;
  });

  sliderDivider.addEventListener('touchstart', (e) => {
    e.preventDefault(); e.stopPropagation(); isSliderDragging = true;
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
  // Keyboard shortcuts — clean, no conflicts
  // ============================================================
  document.addEventListener('keydown', (e) => {
    // Skip if modifier key held (Ctrl+C = copy, etc.)
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    // Skip if focused on interactive elements
    const tag = document.activeElement?.tagName;
    if (['INPUT','TEXTAREA','SELECT','BUTTON'].includes(tag)) return;
    if (document.activeElement?.contentEditable === 'true') return;

    // Skip if viewer not active
    if (!viewerActive) return;

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
      case 'r': case 'R':
        resetView();
        break;
      case 'a': case 'A':
        toggleAutoRotate();
        break;
      case 'f': case 'F':
        triggerFullscreen();
        break;
      case 'm': case 'M':
        if (viewMode === 'single') toggleFlipSingle();
        break;
      case 'c': case 'C':
        // C: toggle split compare
        if (viewMode === 'split') exitCompareMode();
        else enterSplitMode();
        break;
      case 's': case 'S':
        // S: toggle slider compare
        if (viewMode === 'slider') exitCompareMode();
        else enterSliderMode();
        break;
      case 'v': case 'V':
        // V: toggle layout in split mode only
        if (viewMode === 'split') {
          compareLayout = compareLayout === 'side' ? 'stack' : 'side';
          applyCompareLayout();
        }
        break;
    }
  });

  // ============================================================
  // Button event wiring
  // ============================================================
  addImgBtn.addEventListener('click',    () => fileInput.click());
  addSceneBtn.addEventListener('click',  () => fileInput.click());
  clearAllBtn.addEventListener('click',  clearAllAndShowUpload);
  backBtn.addEventListener('click',      clearAllAndShowUpload);

  splitCompareBtn.addEventListener('click',   enterSplitMode);
  sliderCompareBtn.addEventListener('click',  enterSliderMode);
  exitCompareBtn.addEventListener('click',    () => exitCompareMode());
  switchToSplitBtn.addEventListener('click',  enterSplitMode);
  switchToSliderBtn.addEventListener('click', enterSliderMode);

  flipBtn.addEventListener('click',   toggleFlipSingle);
  flipABtn.addEventListener('click',  () => toggleFlipCompare('a'));
  flipBBtn.addEventListener('click',  () => toggleFlipCompare('b'));
  swapAbBtn.addEventListener('click', swapAB);

  autorotateBtn.addEventListener('click',  () => toggleAutoRotate());
  compareAutorotBtn.addEventListener('click', () => toggleAutoRotate());

  resetBtn.addEventListener('click',       resetView);
  compareResetBtn.addEventListener('click', resetView);

  layoutLrBtn.addEventListener('click', () => {
    if (viewMode !== 'split') return;
    compareLayout = 'side';
    applyCompareLayout();
  });

  layoutTbBtn.addEventListener('click', () => {
    if (viewMode !== 'split') return;
    compareLayout = 'stack';
    applyCompareLayout();
  });

  compareSelectA.addEventListener('change', () => {
    compareIdxA = parseInt(compareSelectA.value, 10);
    flipABtn.classList.toggle('active', scenes[compareIdxA]?.flipH || false);
    loadCompareSphere('a', compareIdxA);
  });

  compareSelectB.addEventListener('change', () => {
    compareIdxB = parseInt(compareSelectB.value, 10);
    flipBBtn.classList.toggle('active', scenes[compareIdxB]?.flipH || false);
    loadCompareSphere('b', compareIdxB);
  });

  errorBackBtn.addEventListener('click', () => {
    hideErrorOverlay();
    if (!scenes.length) clearAllAndShowUpload();
  });

  // ============================================================
  // Fullscreen
  // ============================================================
  const supportsFs = !!(viewerContainer.requestFullscreen || viewerContainer.webkitRequestFullscreen);
  if (!supportsFs) { hideEl(fullscreenBtn); hideEl(compareFsBtn); }

  function triggerFullscreen() {
    if (!supportsFs) return;
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    const target = (viewMode === 'single') ? viewerContainer : compareContainer;
    if (!isFs) {
      const req = target.requestFullscreen || target.webkitRequestFullscreen;
      if (req) req.call(target).catch(err => showGlobalError(`全画面表示に失敗しました: ${err.message}`));
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => {});
    }
  }

  fullscreenBtn.addEventListener('click', triggerFullscreen);
  compareFsBtn.addEventListener('click',  triggerFullscreen);

  function onFsChange() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    fullscreenIcon.textContent = isFs ? '✕' : '⛶';
    fullscreenBtn.title = isFs ? '全画面を終了 (F)' : '全画面表示 (F)';
    requestAnimationFrame(() => {
      if (viewMode === 'single' && renderer) fitSingleCanvas();
      if (viewMode === 'split' || viewMode === 'slider') fitComparePanes();
    });
  }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  // ============================================================
  // Resize
  // ============================================================
  window.addEventListener('resize', () => {
    if (!viewerActive) return;
    if (viewMode === 'single' && renderer) fitSingleCanvas();
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
    if (el) el.style.display = '';
    const us = document.getElementById('upload-section');
    if (us) us.style.display = 'none';
  }
})(50);
