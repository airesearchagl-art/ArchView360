'use strict';

/* ============================================================
 * ArchView360 v1.8
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
  const pickerBtnA         = $('picker-btn-a');
  const pickerBtnB         = $('picker-btn-b');
  const pickerThumbA       = $('picker-thumb-a');
  const pickerThumbB       = $('picker-thumb-b');
  const pickerNameA        = $('picker-name-a');
  const pickerNameB        = $('picker-name-b');
  const flipABtn           = $('flip-a-btn');
  const flipBBtn           = $('flip-b-btn');
  const swapAbBtn          = $('swap-ab-btn');
  const syncBtn            = $('sync-btn');
  const saveSetBtn         = $('save-set-btn');
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
  const compareSetsPanelEl = $('compare-sets-panel');
  const compareSetsList    = $('compare-sets-list');

  // Picker dropdown
  const pickerDropdown     = $('picker-dropdown');
  const pickerDropdownList = $('picker-dropdown-list');

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

  // Thumb preview overlay (injected once into body)
  const thumbPreview    = document.createElement('div');
  const thumbPreviewImg = document.createElement('img');
  thumbPreview.id        = 'thumb-preview';
  thumbPreview.className = 'thumb-preview';
  thumbPreview.style.display = 'none';
  thumbPreviewImg.alt    = '';
  thumbPreviewImg.draggable = false;
  thumbPreview.appendChild(thumbPreviewImg);
  document.body.appendChild(thumbPreview);
  let thumbPreviewTimer = null;

  // ---- Three.js (single) ----
  let renderer, threeScene, camera, sphere;
  let animFrameId = null;

  // ---- Three.js (compare) ----
  let rendererA = null, rendererB = null;
  let sceneA    = null, sceneB    = null;
  let cameraA   = null, cameraB   = null;
  let sphereA   = null, sphereB   = null;
  let compareInited = false;

  // ---- Camera state — shared (single mode + sync ON) ----
  const DEFAULT_FOV   = 75;
  const MIN_FOV       = 30;
  const MAX_FOV       = 100;
  const DEFAULT_PHI   = Math.PI / 2;
  const DEFAULT_THETA = 0;
  let phi   = DEFAULT_PHI;
  let theta = DEFAULT_THETA;
  let fov   = DEFAULT_FOV;

  // ---- Camera state — independent A/B (sync OFF) ----
  let phiA = DEFAULT_PHI, thetaA = DEFAULT_THETA, fovA = DEFAULT_FOV;
  let phiB = DEFAULT_PHI, thetaB = DEFAULT_THETA, fovB = DEFAULT_FOV;

  // ---- Autorotate ----
  let autoRotate = false;
  const AUTO_ROTATE_SPEED = 0.0015;

  // ---- Canvas drag ----
  let isDragging    = false;
  let draggingPane  = null; // null | 'a' | 'b'
  let lastX = 0, lastY = 0;
  let lastTouches = null, lastPinchDist = null;

  // ---- Slider drag ----
  let isSliderDragging = false;

  // ---- Toast timer ----
  let toastTimer = null;

  // ---- Viewer state ----
  let viewerActive = false;

  // ---- compareState: centralised compare mode state ----
  const compareState = {
    mode:           'single', // 'single' | 'split' | 'slider'
    sceneAIndex:    0,
    sceneBIndex:    1,
    layout:         'side',   // 'side' | 'stack'
    sliderPosition: 50,
    syncViews:      true,
    activeSetId:    null,
  };

  // ---- Picker state ----
  let pickerActiveSide = null; // null | 'a' | 'b'

  // ---- localStorage key ----
  const LS_COMPARE_SETS = 'archview360.compareSets';

  // Convenience aliases (always read from / write to compareState)
  function get_viewMode()      { return compareState.mode; }
  function get_compareIdxA()   { return compareState.sceneAIndex; }
  function get_compareIdxB()   { return compareState.sceneBIndex; }
  function get_compareLayout() { return compareState.layout; }
  function get_sliderPos()     { return compareState.sliderPosition; }
  function get_syncViews()     { return compareState.syncViews; }

  // ---- Drag-and-drop reorder state ----
  let dragSrcIdx  = -1;
  let dragOverIdx = -1;

  // ---- Scenes ----
  let scenes     = [];
  let currentIdx = -1;

  function genId() { return Math.random().toString(36).slice(2, 10); }

  // ============================================================
  // Thumbnail generation  (240×135 @ 16:9, center-crop)
  // ============================================================
  function generateThumb(blobUrl, callback) {
    const img = new Image();
    img.onload = () => {
      const W = 240, H = 135;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const aspect = img.width / img.height;
      const target = W / H;
      let sx, sy, sw, sh;
      if (aspect > target) {
        sh = img.height; sw = Math.round(img.height * target);
        sx = Math.round((img.width - sw) / 2); sy = 0;
      } else {
        sw = img.width; sh = Math.round(img.width / target);
        sx = 0; sy = Math.round((img.height - sh) / 2);
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      callback(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => callback(null);
    img.src = blobUrl;
  }

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

    valid.forEach(f => {
      const blobUrl = URL.createObjectURL(f);
      const scene = {
        id:       genId(),
        name:     f.name.replace(/\.[^.]+$/, ''),
        blobUrl,
        flipH:    false,
        thumbUrl: null,
      };
      scenes.push(scene);
      generateThumb(blobUrl, (dataUrl) => {
        scene.thumbUrl = dataUrl;
        renderSceneList();
      });
    });

    if (wasEmpty) {
      showViewerLayout();
      initThree();
      requestAnimationFrame(() => {
        fitSingleCanvas();
        switchToScene(0);
      });
      renderCompareSets();
    } else {
      renderSceneList();
      if (compareState.mode !== 'single') updateCompareSelects();
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
    if (compareState.mode !== 'single') exitCompareMode(true);
    scenes.splice(idx, 1);

    if (!scenes.length) { disposeCurrentSphere(); clearAllAndShowUpload(); return; }

    // Adjust indices
    if (idx < compareState.sceneAIndex) compareState.sceneAIndex--;
    else if (idx === compareState.sceneAIndex) compareState.sceneAIndex = Math.min(compareState.sceneAIndex, scenes.length - 1);
    if (idx < compareState.sceneBIndex) compareState.sceneBIndex--;
    else if (idx === compareState.sceneBIndex) compareState.sceneBIndex = Math.min(compareState.sceneBIndex, scenes.length - 1);
    // Keep A !== B if possible
    if (compareState.sceneAIndex === compareState.sceneBIndex && scenes.length >= 2) {
      compareState.sceneBIndex = compareState.sceneAIndex === 0 ? 1 : 0;
    }

    updateCompareBtns();
    let next = currentIdx;
    if (wasCurrent)            next = Math.min(idx, scenes.length - 1);
    else if (idx < currentIdx) next = currentIdx - 1;
    currentIdx = -1;
    switchToScene(next);
  }

  // ---- Drag-and-drop reorder ----
  function reorderScene(fromIdx, toIdx) {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    const [moved] = scenes.splice(fromIdx, 1);
    scenes.splice(toIdx, 0, moved);

    // Adjust currentIdx
    if (currentIdx === fromIdx) {
      currentIdx = toIdx;
    } else if (fromIdx < toIdx) {
      if (currentIdx > fromIdx && currentIdx <= toIdx) currentIdx--;
    } else {
      if (currentIdx >= toIdx && currentIdx < fromIdx) currentIdx++;
    }

    // Adjust compareState indices
    compareState.sceneAIndex = _shiftIdx(compareState.sceneAIndex, fromIdx, toIdx);
    compareState.sceneBIndex = _shiftIdx(compareState.sceneBIndex, fromIdx, toIdx);

    renderSceneList();
    if (compareState.mode !== 'single') updateCompareSelects();
    updateCompareBtns();
  }

  function _shiftIdx(idx, fromIdx, toIdx) {
    if (idx === fromIdx) return toIdx;
    if (fromIdx < toIdx) {
      if (idx > fromIdx && idx <= toIdx) return idx - 1;
    } else {
      if (idx >= toIdx && idx < fromIdx) return idx + 1;
    }
    return idx;
  }

  function clearAllAndShowUpload() {
    if (compareState.mode !== 'single') exitCompareMode(true);
    stopRender();
    hideToast();
    disposeCurrentSphere();
    hideThumbPreview();
    scenes.forEach(s => URL.revokeObjectURL(s.blobUrl));
    scenes = []; currentIdx = -1; viewerActive = false;

    autoRotate = false;
    autorotateBtn.classList.remove('active');
    compareAutorotBtn.classList.remove('active');

    compareState.mode           = 'single';
    compareState.sceneAIndex    = 0;
    compareState.sceneBIndex    = 1;
    compareState.layout         = 'side';
    compareState.sliderPosition = 50;
    compareState.syncViews      = true;
    compareState.activeSetId    = null;

    const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
    if ((document.fullscreenElement || document.webkitFullscreenElement) && exitFs)
      exitFs.call(document).catch(() => {});

    hideEl(viewerLayout);
    showEl(uploadSection);
  }

  // ============================================================
  // Render scene list (with thumbnails + drag & drop)
  // ============================================================
  function renderSceneList() {
    sceneListEl.innerHTML = '';
    scenes.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'scene-item' + (i === currentIdx ? ' active' : '');
      li.draggable = true;
      li.dataset.idx = i;

      // ---- Thumbnail ----
      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'scene-thumb-wrap' + (s.thumbUrl ? '' : ' scene-thumb-placeholder');
      if (s.thumbUrl) {
        const img = document.createElement('img');
        img.className = 'scene-thumb';
        img.src = s.thumbUrl;
        img.alt = '';
        img.draggable = false;
        thumbWrap.appendChild(img);

        // Hover preview (desktop only)
        thumbWrap.addEventListener('mouseenter', (e) => showThumbPreview(s.thumbUrl, li));
        thumbWrap.addEventListener('mouseleave', hideThumbPreview);
      }

      // ---- Bottom row ----
      const row = document.createElement('div');
      row.className = 'scene-item-row';

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
        if (compareState.mode !== 'single') updateCompareSelects();
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

      row.appendChild(numEl);
      row.appendChild(nameEl);
      row.appendChild(delBtn);

      li.appendChild(thumbWrap);
      li.appendChild(row);

      // ---- Click to switch scene ----
      li.addEventListener('click', () => {
        if (nameEl.contentEditable === 'true') return;
        if (i !== currentIdx) switchToScene(i);
      });

      // ---- Drag & Drop events ----
      li.addEventListener('dragstart', (e) => {
        dragSrcIdx = i;
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i));
      });

      li.addEventListener('dragend', () => {
        dragSrcIdx  = -1;
        dragOverIdx = -1;
        li.classList.remove('dragging');
        // Clear all drop indicators
        sceneListEl.querySelectorAll('.drop-before,.drop-after').forEach(el => {
          el.classList.remove('drop-before', 'drop-after');
        });
      });

      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSrcIdx === i) return;
        // Determine insert before/after based on mouse position within item
        const rect = li.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midY;
        // Clear other indicators
        sceneListEl.querySelectorAll('.drop-before,.drop-after').forEach(el => {
          if (el !== li) el.classList.remove('drop-before', 'drop-after');
        });
        if (insertBefore) {
          li.classList.add('drop-before');
          li.classList.remove('drop-after');
          dragOverIdx = i;
        } else {
          li.classList.add('drop-after');
          li.classList.remove('drop-before');
          dragOverIdx = i + 1;
        }
      });

      li.addEventListener('dragleave', () => {
        li.classList.remove('drop-before', 'drop-after');
      });

      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drop-before', 'drop-after');
        if (dragSrcIdx < 0 || dragSrcIdx === dragOverIdx) return;
        // dragOverIdx is insert position; adjust for removed item
        let insertAt = dragOverIdx;
        if (insertAt > dragSrcIdx) insertAt--;
        reorderScene(dragSrcIdx, insertAt);
      });

      sceneListEl.appendChild(li);
    });

    sceneCounter.textContent = scenes.length
      ? `${currentIdx + 1} / ${scenes.length}`
      : '0 / 0';

    sceneListEl.querySelector('.scene-item.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ============================================================
  // Thumb hover preview
  // ============================================================
  function showThumbPreview(thumbUrl, itemEl) {
    clearTimeout(thumbPreviewTimer);
    thumbPreviewTimer = setTimeout(() => {
      if (!thumbUrl) return;
      thumbPreviewImg.src = thumbUrl;
      thumbPreview.style.display = '';
      // Position: to the right of the sidebar
      const sidebarEl = itemEl.closest('.scene-panel');
      const sidebarRect = sidebarEl ? sidebarEl.getBoundingClientRect() : { right: 250 };
      const itemRect = itemEl.getBoundingClientRect();
      const pw = 240, ph = 135;
      let left = sidebarRect.right + 8;
      let top  = itemRect.top + (itemRect.height - ph) / 2;
      // Clamp to viewport
      top  = Math.max(8, Math.min(window.innerHeight - ph - 8, top));
      left = Math.max(8, Math.min(window.innerWidth  - pw - 8, left));
      thumbPreview.style.left = `${left}px`;
      thumbPreview.style.top  = `${top}px`;
    }, 120);
  }

  function hideThumbPreview() {
    clearTimeout(thumbPreviewTimer);
    thumbPreview.style.display = 'none';
  }

  // ============================================================
  // Compare button availability
  // ============================================================
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
        if (side === 'a') {
          disposeMesh(sphereA, sceneA); sphereA = mesh; sceneA.add(sphereA);
          fitOnePane(canvasA, rendererA, cameraA);
        } else {
          disposeMesh(sphereB, sceneB); sphereB = mesh; sceneB.add(sphereB);
          fitOnePane(canvasB, rendererB, cameraB);
        }
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
    if (compareState.mode === 'single' && renderer) fitSingleCanvas();

    function loop() {
      animFrameId = requestAnimationFrame(loop);

      if (compareState.mode === 'split' || compareState.mode === 'slider') {
        if (compareState.syncViews) {
          if (autoRotate && !isDragging && !isSliderDragging) theta += AUTO_ROTATE_SPEED;
          const lx = Math.sin(phi) * Math.cos(theta);
          const ly = Math.cos(phi);
          const lz = Math.sin(phi) * Math.sin(theta);
          if (rendererA && sceneA && cameraA) { cameraA.lookAt(lx,ly,lz); rendererA.render(sceneA, cameraA); }
          if (rendererB && sceneB && cameraB) { cameraB.lookAt(lx,ly,lz); rendererB.render(sceneB, cameraB); }
        } else {
          if (autoRotate && !isDragging && !isSliderDragging) {
            thetaA += AUTO_ROTATE_SPEED;
            thetaB += AUTO_ROTATE_SPEED;
          }
          if (rendererA && sceneA && cameraA) {
            cameraA.fov = fovA; cameraA.updateProjectionMatrix();
            cameraA.lookAt(Math.sin(phiA)*Math.cos(thetaA), Math.cos(phiA), Math.sin(phiA)*Math.sin(thetaA));
            rendererA.render(sceneA, cameraA);
          }
          if (rendererB && sceneB && cameraB) {
            cameraB.fov = fovB; cameraB.updateProjectionMatrix();
            cameraB.lookAt(Math.sin(phiB)*Math.cos(thetaB), Math.cos(phiB), Math.sin(phiB)*Math.sin(thetaB));
            rendererB.render(sceneB, cameraB);
          }
        }
      } else {
        if (autoRotate && !isDragging) theta += AUTO_ROTATE_SPEED;
        const lx = Math.sin(phi) * Math.cos(theta);
        const ly = Math.cos(phi);
        const lz = Math.sin(phi) * Math.sin(theta);
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
    phiA = DEFAULT_PHI; thetaA = DEFAULT_THETA; fovA = DEFAULT_FOV;
    phiB = DEFAULT_PHI; thetaB = DEFAULT_THETA; fovB = DEFAULT_FOV;
    applyFov();
  }

  function applyFov() {
    if (camera)  { camera.fov  = fov; camera.updateProjectionMatrix(); }
    if (cameraA) { cameraA.fov = fov; cameraA.updateProjectionMatrix(); }
    if (cameraB) { cameraB.fov = fov; cameraB.updateProjectionMatrix(); }
    statusFov.textContent = `FOV: ${Math.round(fov)}°`;
  }

  // ============================================================
  // View sync toggle
  // ============================================================
  function toggleSyncViews() {
    compareState.syncViews = !compareState.syncViews;
    if (compareState.syncViews) {
      phiA = phi; thetaA = theta; fovA = fov;
      phiB = phi; thetaB = theta; fovB = fov;
      if (cameraA) { cameraA.fov = fov; cameraA.updateProjectionMatrix(); }
      if (cameraB) { cameraB.fov = fov; cameraB.updateProjectionMatrix(); }
    }
    updateSyncBtn();
    showToast(compareState.syncViews ? '視点同期 ON — 両面が連動します' : '視点同期 OFF — 別々に操作できます');
  }

  function updateSyncBtn() {
    syncBtn.classList.toggle('active', compareState.syncViews);
    const label = syncBtn.querySelector('.btn-label');
    if (label) label.textContent = compareState.syncViews ? '視点同期 ON' : '視点同期 OFF';
  }

  // ============================================================
  // Show viewer
  // ============================================================
  function showViewerLayout() {
    viewerActive = true;
    hideEl(uploadSection);
    viewerLayout.style.display = 'flex';
    showEl(toolbarSingle);
    hideEl(toolbarCompare);
    showEl(viewerContainer);
    hideEl(compareContainer);
    updateCompareBtns();
  }

  // ============================================================
  // Split compare mode
  // ============================================================
  function enterSplitMode({ idxA, idxB, layout, syncViews } = {}) {
    if (scenes.length < 2) { showToast('分割比較には2枚以上のシーンが必要です'); return; }
    if (compareState.mode === 'slider') _exitCompareUI();

    compareState.mode = 'split';
    if (idxA !== undefined) {
      compareState.sceneAIndex = idxA;
      compareState.sceneBIndex = idxB;
      if (layout !== undefined) compareState.layout = layout;
    } else {
      compareState.sceneAIndex = currentIdx >= 0 ? currentIdx : 0;
      compareState.sceneBIndex = compareState.sceneAIndex === scenes.length - 1
        ? compareState.sceneAIndex - 1 : compareState.sceneAIndex + 1;
      compareState.layout = 'side';
    }

    hideEl(viewerContainer);
    hideEl(toolbarSingle);
    showEl(toolbarCompare);
    showEl(compareContainer);
    compareContainer.classList.remove('slider-mode');
    hideEl(sliderDivider);
    paneBEl.style.clipPath    = '';
    paneBEl.style.pointerEvents = '';

    showEl(layoutLrBtn);
    showEl(layoutTbBtn);
    showEl(splitLayoutSep);

    applyCompareLayout(false);
    updateCompareSelects();
    switchToSplitBtn.classList.add('active');
    switchToSliderBtn.classList.remove('active');

    compareState.syncViews = syncViews !== undefined ? syncViews : true;
    phiA = phi; thetaA = theta; fovA = fov;
    phiB = phi; thetaB = theta; fovB = fov;
    updateSyncBtn();

    initCompareRenderers();
    requestAnimationFrame(() => {
      fitComparePanes();
      loadCompareSphere('a', compareState.sceneAIndex);
      loadCompareSphere('b', compareState.sceneBIndex);
    });
    stopRender(); startRender();
  }

  // ============================================================
  // Slider compare mode
  // ============================================================
  function enterSliderMode({ idxA, idxB, sliderPos, syncViews } = {}) {
    if (scenes.length < 2) { showToast('スライダー比較には2枚以上のシーンが必要です'); return; }
    if (compareState.mode === 'split') _exitCompareUI();

    compareState.mode = 'slider';
    if (idxA !== undefined) {
      compareState.sceneAIndex = idxA;
      compareState.sceneBIndex = idxB;
    } else {
      compareState.sceneAIndex = currentIdx >= 0 ? currentIdx : 0;
      compareState.sceneBIndex = compareState.sceneAIndex === scenes.length - 1
        ? compareState.sceneAIndex - 1 : compareState.sceneAIndex + 1;
    }

    hideEl(viewerContainer);
    hideEl(toolbarSingle);
    showEl(toolbarCompare);
    showEl(compareContainer);
    compareContainer.classList.add('slider-mode');
    compareContainer.classList.remove('stack');
    showEl(sliderDivider);
    paneBEl.style.pointerEvents = 'none';

    hideEl(layoutLrBtn);
    hideEl(layoutTbBtn);
    hideEl(splitLayoutSep);

    switchToSliderBtn.classList.add('active');
    switchToSplitBtn.classList.remove('active');

    compareState.syncViews = syncViews !== undefined ? syncViews : true;
    phiA = phi; thetaA = theta; fovA = fov;
    phiB = phi; thetaB = theta; fovB = fov;
    updateSyncBtn();

    compareState.sliderPosition = sliderPos !== undefined ? sliderPos : 50;
    updateSlider(compareState.sliderPosition);

    updateCompareSelects();
    initCompareRenderers();
    requestAnimationFrame(() => {
      fitComparePanes();
      loadCompareSphere('a', compareState.sceneAIndex);
      loadCompareSphere('b', compareState.sceneBIndex);
    });
    stopRender(); startRender();
  }

  function _exitCompareUI() {
    compareContainer.classList.remove('slider-mode', 'stack');
    paneBEl.style.clipPath    = '';
    paneBEl.style.pointerEvents = '';
  }

  function exitCompareMode(silent) {
    if (compareState.mode === 'single' && !silent) return;
    _exitCompareUI();
    compareState.mode = 'single';

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
    if (compareState.layout === 'stack') {
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
    const sa = scenes[compareState.sceneAIndex];
    const sb = scenes[compareState.sceneBIndex];
    if (sa) {
      if (sa.thumbUrl) { pickerThumbA.src = sa.thumbUrl; pickerThumbA.style.display = ''; }
      else pickerThumbA.style.display = 'none';
      pickerNameA.textContent = sa.name;
    }
    if (sb) {
      if (sb.thumbUrl) { pickerThumbB.src = sb.thumbUrl; pickerThumbB.style.display = ''; }
      else pickerThumbB.style.display = 'none';
      pickerNameB.textContent = sb.name;
    }
    flipABtn.classList.toggle('active', sa?.flipH || false);
    flipBBtn.classList.toggle('active', sb?.flipH || false);
  }

  // ============================================================
  // Scene picker dropdown
  // ============================================================
  function openPicker(side) {
    if (pickerActiveSide === side) { closePicker(); return; }
    pickerActiveSide = side;

    pickerDropdownList.innerHTML = '';
    scenes.forEach((s, i) => {
      const curIdx = side === 'a' ? compareState.sceneAIndex : compareState.sceneBIndex;
      const li = document.createElement('li');
      li.className = 'picker-item' + (i === curIdx ? ' selected' : '');
      li.setAttribute('role', 'option');

      const thumbEl = document.createElement('div');
      thumbEl.className = 'picker-item-thumb' + (s.thumbUrl ? '' : ' picker-item-thumb-empty');
      if (s.thumbUrl) {
        const img = document.createElement('img');
        img.src = s.thumbUrl; img.alt = ''; img.draggable = false;
        thumbEl.appendChild(img);
      }
      const numEl = document.createElement('span');
      numEl.className = 'picker-item-num';
      numEl.textContent = i + 1;
      const nameEl = document.createElement('span');
      nameEl.className = 'picker-item-name';
      nameEl.textContent = s.name;

      li.appendChild(thumbEl);
      li.appendChild(numEl);
      li.appendChild(nameEl);

      li.addEventListener('click', () => {
        if (side === 'a') {
          compareState.sceneAIndex = i;
          loadCompareSphere('a', i);
        } else {
          compareState.sceneBIndex = i;
          loadCompareSphere('b', i);
        }
        updateCompareSelects();
        closePicker();
      });
      pickerDropdownList.appendChild(li);
    });

    const btn = side === 'a' ? pickerBtnA : pickerBtnB;
    const rect = btn.getBoundingClientRect();
    pickerDropdown.style.display = '';
    pickerDropdown.style.left = `${rect.left}px`;
    pickerDropdown.style.top  = `${rect.bottom + 4}px`;

    requestAnimationFrame(() => {
      const dpRect = pickerDropdown.getBoundingClientRect();
      if (dpRect.right > window.innerWidth - 8)
        pickerDropdown.style.left = `${Math.max(8, window.innerWidth - dpRect.width - 8)}px`;
      if (dpRect.bottom > window.innerHeight - 8)
        pickerDropdown.style.top = `${Math.max(8, rect.top - dpRect.height - 4)}px`;
    });
  }

  function closePicker() {
    pickerActiveSide = null;
    pickerDropdown.style.display = 'none';
  }

  // ============================================================
  // Compare sets — localStorage CRUD
  // ============================================================
  function _loadCompareSets() {
    try { return JSON.parse(localStorage.getItem(LS_COMPARE_SETS)) || []; }
    catch { return []; }
  }

  function _saveCompareSetsToStorage(sets) {
    try { localStorage.setItem(LS_COMPARE_SETS, JSON.stringify(sets)); } catch {}
  }

  function saveCurrentCompareSet() {
    if (compareState.mode === 'single') { showToast('比較モード中のみ保存できます'); return; }
    const sa = scenes[compareState.sceneAIndex];
    const sb = scenes[compareState.sceneBIndex];
    if (!sa || !sb) { showToast('シーンが見つかりません'); return; }

    const defaultName = `${sa.name} vs ${sb.name}`;
    const name = window.prompt('セット名を入力してください', defaultName);
    if (name === null) return;
    const setName = name.trim() || defaultName;

    const sets = _loadCompareSets();
    const existingIdx = sets.findIndex(s => s.name === setName);
    const newSet = {
      id:             existingIdx >= 0 ? sets[existingIdx].id : genId(),
      name:           setName,
      mode:           compareState.mode,
      sceneAId:       sa.id,
      sceneBId:       sb.id,
      layout:         compareState.layout,
      sliderPosition: compareState.sliderPosition,
      syncViews:      compareState.syncViews,
      createdAt:      existingIdx >= 0 ? sets[existingIdx].createdAt : new Date().toISOString(),
    };
    if (existingIdx >= 0) sets[existingIdx] = newSet;
    else sets.push(newSet);
    _saveCompareSetsToStorage(sets);
    compareState.activeSetId = newSet.id;
    renderCompareSets();
    showToast(`「${setName}」を保存しました`);
  }

  function restoreCompareSet(set) {
    const idxA = scenes.findIndex(s => s.id === set.sceneAId);
    const idxB = scenes.findIndex(s => s.id === set.sceneBId);
    if (idxA < 0 || idxB < 0) {
      showToast('シーンが見つかりません（削除済みかもしれません）', 4000);
      return;
    }
    compareState.activeSetId = set.id;
    if (set.mode === 'slider') {
      enterSliderMode({ idxA, idxB, sliderPos: set.sliderPosition ?? 50, syncViews: set.syncViews ?? true });
    } else {
      enterSplitMode({ idxA, idxB, layout: set.layout || 'side', syncViews: set.syncViews ?? true });
    }
  }

  function deleteCompareSet(setId) {
    const sets = _loadCompareSets().filter(s => s.id !== setId);
    _saveCompareSetsToStorage(sets);
    if (compareState.activeSetId === setId) compareState.activeSetId = null;
    renderCompareSets();
    showToast('セットを削除しました');
  }

  function renameCompareSet(setId) {
    const sets = _loadCompareSets();
    const set = sets.find(s => s.id === setId);
    if (!set) return;
    const newName = window.prompt('新しいセット名', set.name);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    set.name = trimmed;
    _saveCompareSetsToStorage(sets);
    renderCompareSets();
  }

  // ============================================================
  // Render compare sets sidebar section
  // ============================================================
  function renderCompareSets() {
    const sets = _loadCompareSets();
    if (!sets.length) { hideEl(compareSetsPanelEl); return; }
    showEl(compareSetsPanelEl);

    compareSetsList.innerHTML = '';
    sets.forEach(set => {
      const li = document.createElement('li');
      li.className = 'compare-set-item' + (set.id === compareState.activeSetId ? ' active' : '');

      const iconEl = document.createElement('span');
      iconEl.className = 'cset-mode-icon';
      iconEl.textContent = set.mode === 'slider' ? '◫' : '⊞';

      const nameEl = document.createElement('span');
      nameEl.className = 'cset-name';
      nameEl.textContent = set.name;
      nameEl.title = set.name;

      const actionsEl = document.createElement('div');
      actionsEl.className = 'cset-actions';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'cset-btn';
      renameBtn.title = '名前を変更';
      renameBtn.textContent = '✏';
      renameBtn.addEventListener('click', (e) => { e.stopPropagation(); renameCompareSet(set.id); });

      const delBtn = document.createElement('button');
      delBtn.className = 'cset-btn cset-btn-del';
      delBtn.title = '削除';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteCompareSet(set.id); });

      actionsEl.appendChild(renameBtn);
      actionsEl.appendChild(delBtn);
      li.appendChild(iconEl);
      li.appendChild(nameEl);
      li.appendChild(actionsEl);

      li.addEventListener('click', () => {
        if (scenes.length < 2) { showToast('2枚以上のシーンが必要です'); return; }
        restoreCompareSet(set);
      });

      compareSetsList.appendChild(li);
    });
  }

  // ============================================================
  // Slider
  // ============================================================
  function updateSlider(pos) {
    compareState.sliderPosition = Math.max(2, Math.min(98, pos));
    paneBEl.style.clipPath   = `inset(0 0 0 ${compareState.sliderPosition}%)`;
    sliderDivider.style.left = `${compareState.sliderPosition}%`;
  }

  // ============================================================
  // A/B swap
  // ============================================================
  function swapAB() {
    [compareState.sceneAIndex, compareState.sceneBIndex] = [compareState.sceneBIndex, compareState.sceneAIndex];
    updateCompareSelects();
    loadCompareSphere('a', compareState.sceneAIndex);
    loadCompareSphere('b', compareState.sceneBIndex);
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
    const idx = side === 'a' ? compareState.sceneAIndex : compareState.sceneBIndex;
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

  function rotate(dx, dy, pane) {
    const r = Math.PI / 180;
    if (!compareState.syncViews && pane === 'a') {
      thetaA -= dx * SENSITIVITY * r;
      phiA   -= dy * SENSITIVITY * r;
      phiA    = Math.max(0.05, Math.min(Math.PI - 0.05, phiA));
    } else if (!compareState.syncViews && pane === 'b') {
      thetaB -= dx * SENSITIVITY * r;
      phiB   -= dy * SENSITIVITY * r;
      phiB    = Math.max(0.05, Math.min(Math.PI - 0.05, phiB));
    } else {
      theta -= dx * SENSITIVITY * r;
      phi   -= dy * SENSITIVITY * r;
      phi    = Math.max(0.05, Math.min(Math.PI - 0.05, phi));
    }
  }

  function zoomBy(delta, pane) {
    if (!compareState.syncViews && pane === 'a') {
      fovA = Math.min(MAX_FOV, Math.max(MIN_FOV, fovA + delta));
      statusFov.textContent = `FOV: ${Math.round(fovA)}°`;
    } else if (!compareState.syncViews && pane === 'b') {
      fovB = Math.min(MAX_FOV, Math.max(MIN_FOV, fovB + delta));
      statusFov.textContent = `FOV: ${Math.round(fovB)}°`;
    } else {
      fov = Math.min(MAX_FOV, Math.max(MIN_FOV, fov + delta));
      applyFov();
    }
  }

  function pinchDist(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  }

  function attachCanvasInteraction(canvas, pane) {
    canvas.style.cursor = 'grab';

    canvas.addEventListener('mousedown', (e) => {
      isDragging = true; draggingPane = pane;
      lastX = e.clientX; lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomBy(e.deltaY > 0 ? 3 : -3, pane);
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      draggingPane = pane;
      if (e.touches.length === 1) {
        isDragging = true;
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
        lastPinchDist = null;
      } else if (e.touches.length === 2) {
        lastPinchDist = pinchDist(e.touches);
      }
      lastTouches = e.touches;
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && lastTouches?.length === 1) {
        rotate(e.touches[0].clientX - lastX, e.touches[0].clientY - lastY, pane);
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const d = pinchDist(e.touches);
        if (lastPinchDist !== null) zoomBy((lastPinchDist - d) * 0.15, pane);
        lastPinchDist = d;
      }
      lastTouches = e.touches;
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
      isDragging = false; draggingPane = null;
      lastTouches = null; lastPinchDist = null;
      canvas.style.cursor = 'grab';
    });
  }

  attachCanvasInteraction(viewerCanvas, null);
  attachCanvasInteraction(canvasA, 'a');
  attachCanvasInteraction(canvasB, 'b');

  window.addEventListener('mousemove', (e) => {
    if (isSliderDragging) {
      const rect = compareContainer.getBoundingClientRect();
      updateSlider(((e.clientX - rect.left) / rect.width) * 100);
      return;
    }
    if (!isDragging) return;
    rotate(e.clientX - lastX, e.clientY - lastY, draggingPane);
    lastX = e.clientX; lastY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    if (isSliderDragging) { isSliderDragging = false; return; }
    if (!isDragging) return;
    isDragging = false; draggingPane = null;
    [viewerCanvas, canvasA, canvasB].forEach(c => { c.style.cursor = 'grab'; });
  });

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
  // Keyboard shortcuts
  // ============================================================
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const tag = document.activeElement?.tagName;
    if (['INPUT','TEXTAREA','SELECT','BUTTON'].includes(tag)) return;
    if (document.activeElement?.contentEditable === 'true') return;
    if (!viewerActive) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (compareState.mode === 'single') prevScene();
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (compareState.mode === 'single') nextScene();
        break;
      case 'Escape':
        e.preventDefault();
        if (compareState.mode !== 'single') exitCompareMode();
        break;
      case 'r': case 'R':
        resetView(); break;
      case 'a': case 'A':
        toggleAutoRotate(); break;
      case 'f': case 'F':
        triggerFullscreen(); break;
      case 'm': case 'M':
        if (compareState.mode === 'single') toggleFlipSingle(); break;
      case 'c': case 'C':
        if (compareState.mode === 'split') exitCompareMode(); else enterSplitMode(); break;
      case 's': case 'S':
        if (compareState.mode === 'slider') exitCompareMode(); else enterSliderMode(); break;
      case 'v': case 'V':
        if (compareState.mode === 'split') {
          compareState.layout = compareState.layout === 'side' ? 'stack' : 'side';
          applyCompareLayout();
        }
        break;
      case 'l': case 'L':
        if (compareState.mode !== 'single') toggleSyncViews(); break;
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
  syncBtn.addEventListener('click',   toggleSyncViews);

  autorotateBtn.addEventListener('click',    () => toggleAutoRotate());
  compareAutorotBtn.addEventListener('click', () => toggleAutoRotate());

  resetBtn.addEventListener('click',        resetView);
  compareResetBtn.addEventListener('click',  resetView);

  layoutLrBtn.addEventListener('click', () => {
    if (compareState.mode !== 'split') return;
    compareState.layout = 'side';
    applyCompareLayout();
  });

  layoutTbBtn.addEventListener('click', () => {
    if (compareState.mode !== 'split') return;
    compareState.layout = 'stack';
    applyCompareLayout();
  });

  pickerBtnA.addEventListener('click', (e) => { e.stopPropagation(); openPicker('a'); });
  pickerBtnB.addEventListener('click', (e) => { e.stopPropagation(); openPicker('b'); });
  saveSetBtn.addEventListener('click', saveCurrentCompareSet);

  // Close picker when clicking outside
  document.addEventListener('click', (e) => {
    if (pickerActiveSide && !pickerDropdown.contains(e.target) &&
        e.target !== pickerBtnA && e.target !== pickerBtnB &&
        !pickerBtnA.contains(e.target) && !pickerBtnB.contains(e.target)) {
      closePicker();
    }
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
    const target = (compareState.mode === 'single') ? viewerContainer : compareContainer;
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
      if (compareState.mode === 'single' && renderer) fitSingleCanvas();
      if (compareState.mode === 'split' || compareState.mode === 'slider') fitComparePanes();
    });
  }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  window.addEventListener('resize', () => {
    if (!viewerActive) return;
    if (compareState.mode === 'single' && renderer) fitSingleCanvas();
    if (compareState.mode === 'split' || compareState.mode === 'slider') fitComparePanes();
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
