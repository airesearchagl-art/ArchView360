'use strict';

/* ============================================================
 * ArchView360 v2.0
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
  const updateSceneBtn     = $('update-scene-btn');
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
  const compareSetsEmpty   = $('compare-sets-empty');

  // Picker dropdown
  const pickerDropdown     = $('picker-dropdown');
  const pickerDropdownList = $('picker-dropdown-list');

  // FloorMap Navigator
  const floormapNavigator  = $('floormap-navigator');
  const floormapFpTabs     = $('floormap-fp-tabs');
  const floormapOrientBar  = $('floormap-orient-bar');
  const floormapOrientL    = $('floormap-orient-l');
  const floormapOrientR    = $('floormap-orient-r');
  const floormapOrientVal  = $('floormap-orient-val');
  const floormapOrientPreset = $('floormap-orient-preset');
  const floormapPlaceBtn   = $('floormap-place-btn');
  const floormapToggleBtn  = $('floormap-toggle-btn');
  const floormapBody       = $('floormap-body');
  const floormapCanvas     = $('floormap-canvas');
  const floormapPlaceHint  = $('floormap-place-hint');
  const floormapTooltip    = $('floormap-tooltip');
  // Info panel (v2.4)
  const floormapInfoPanel  = $('floormap-info-panel');
  const floormapInfoName   = $('floormap-info-name');
  const floormapInfoScene  = $('floormap-info-scene');
  const floormapInfoDir    = $('floormap-info-dir');
  const floormapRenameBtn  = $('floormap-rename-btn');
  const floormapRotL       = $('floormap-rot-l');
  const floormapRotR       = $('floormap-rot-r');
  const floormapDelMk      = $('floormap-del-mk');
  // Marker list (v2.4)
  const floormapMkListUl    = $('floormap-mk-list-ul');
  const floormapMkListEmpty = $('floormap-mk-list-empty');
  // Scene fade overlay (v2.4)
  const sceneFadeOverlay   = $('scene-fade-overlay');
  // Unplaced warning (v2.6)
  const unplacedWarning    = $('unplaced-warning');

  // Viewer drop overlay
  const viewerDropOverlay  = $('viewer-drop-overlay');

  // Project toolbar buttons
  const addFloorplanBtn    = $('add-floorplan-btn');
  const exportJsonBtn      = $('export-json-btn');
  const importJsonBtn      = $('import-json-btn');

  // Floor plan file input & JSON inputs
  const floorplanInput     = $('floorplan-input');
  const jsonImportInput    = $('json-import-input');
  const importImagesInput  = $('import-images-input');
  const replaceSceneInput  = $('replace-scene-input');

  // Import modal
  const importModal        = $('import-modal');
  const importModalBody    = $('import-modal-body');
  const importCloseBtn     = $('import-close-btn');
  const importCancelBtn    = $('import-cancel-btn');
  const importUploadBtn    = $('import-upload-btn');

  // Sidebar floor plan elements
  const floorplanListEl    = $('floorplan-list-el');
  const floorplanEmptyMsg  = $('floorplan-empty-msg');

  // Set-name modal
  const setNameModal       = $('set-name-modal');
  const setNameModalTitle  = $('set-name-modal-title');
  const setNameModalInfo   = $('set-name-modal-info');
  const setNameModalNote   = $('set-name-modal-note');
  const setNameInput       = $('set-name-input');
  const setNameOkBtn       = $('set-name-ok-btn');
  const setNameCancelBtn   = $('set-name-cancel-btn');
  const setNameCloseBtn    = $('set-name-close-btn');

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
  const DEFAULT_FOV   = 100; // Wide initial FOV
  const MIN_FOV       = 30;
  const MAX_FOV       = 120; // v2.5: extended to 120° for ultra-wide
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

  // ---- Project State ----
  const projectState = {
    projectName: 'Untitled Project',
    projectInfo: { client: '', author: '', date: '', notes: '' },
    floorplans: [], // { id, name, fileName, blobUrl, imgEl }
    markers:    [], // { id, floorplanId, sceneId, x, y, rotation, name }
    groups:     [], // { id, name } — scene groupings
  };

  // ---- FloorMap Navigator state ----
  let activeFloorplanId   = null;
  let selectedMarkerId    = null;
  let isPlacementMode     = false;
  let isFloormapCollapsed = false;
  let isFloormapExpanded  = false;
  let isDraggingMarker    = false;
  let _dragMarkerId       = null;

  // ---- Scene filter / group state (v2.5) ----
  let sceneFilterFloorplanId = null; // null = all, string = filter by floorplan, '__unplaced__' = unplaced
  const collapsedGroups      = new Set();
  let   _groupPickerSceneIdx = -1;

  // ---- Marker placement helpers (v2.7) ----
  // A scene is "placed" if it has at least one marker on any floorplan
  function isScenePlaced(scene) {
    return projectState.markers.some(m => m.sceneId === scene.id);
  }
  // A scene is "on" a specific floorplan if it has a marker on that floorplan
  function isSceneOnFloorplan(scene, floorplanId) {
    return projectState.markers.some(m => m.sceneId === scene.id && m.floorplanId === floorplanId);
  }
  // Next auto order for current floorplan
  function _nextMarkerOrder() {
    const orders = projectState.markers
      .filter(m => m.floorplanId === activeFloorplanId)
      .map(m => m.order || 0);
    return orders.length ? Math.max(...orders) + 1 : 1;
  }

  // Set marker order and resolve duplicates (v2.8)
  function setMarkerOrder(markerId, newOrder) {
    const v = parseInt(newOrder, 10);
    if (!Number.isInteger(v) || v < 1) return false;
    const mk = projectState.markers.find(m => m.id === markerId);
    if (!mk) return false;
    mk.order = v;
    _resolveOrderConflicts(mk.floorplanId, markerId);
    return true;
  }

  // Bump colliding markers up; pinned marker keeps its slot (v2.8)
  function _resolveOrderConflicts(floorplanId, pinnedId) {
    const pinned = projectState.markers.find(m => m.id === pinnedId && m.floorplanId === floorplanId);
    if (!pinned) return;
    const others = projectState.markers
      .filter(m => m.floorplanId === floorplanId && m.id !== pinnedId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const used = new Set([pinned.order]);
    others.forEach(m => {
      let o = m.order || 1;
      while (used.has(o)) o++;
      m.order = o;
      used.add(o);
    });
  }

  // Re-sequence to 1,2,3... in current order (v2.8)
  function resequenceMarkers() {
    if (!activeFloorplanId) return;
    projectState.markers
      .filter(m => m.floorplanId === activeFloorplanId)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((m, i) => { m.order = i + 1; });
    renderMarkerList(); renderFloormapCanvas();
    showToast('番号を整理しました');
  }

  // ---- Import state ----
  let _importData         = null;

  // ---- Viewer D&D counter ----
  let viewerDragCounter   = 0;

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
        id:          genId(),
        name:        f.name.replace(/\.[^.]+$/, ''),
        fileName:    f.name,
        blobUrl,
        flipH:       false,
        thumbUrl:    null,
        floorplanId: activeFloorplanId || null, // auto-associate with current floor plan
        groupId:     null,
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
    renderSceneFilterBar();
    renderDashboard();
  }

  // ============================================================
  // Scene image replacement (v2.9.1) — keeps scene.id and all
  // references (markers/compareSets/groups/floorplan linkage) intact,
  // only swaps the image data (blobUrl/thumbUrl/fileName).
  // ============================================================
  let _replaceTargetIdx = -1;
  function openReplaceScenePicker(idx) {
    _replaceTargetIdx = idx;
    replaceSceneInput.value = '';
    replaceSceneInput.click();
  }

  replaceSceneInput.addEventListener('change', () => {
    const f = replaceSceneInput.files[0];
    const idx = _replaceTargetIdx;
    _replaceTargetIdx = -1;
    if (!f || idx < 0 || idx >= scenes.length) return;

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const maxBytes = 100 * 1024 * 1024;
    if (!allowed.has(f.type) || f.size > maxBytes) {
      showGlobalError('有効な画像ファイルではありません。JPEG・PNG・WebP（100MB以下）を選択してください。');
      return;
    }

    const s = scenes[idx];
    const oldBlobUrl = s.blobUrl;
    const newBlobUrl = URL.createObjectURL(f);

    s.blobUrl  = newBlobUrl;
    s.fileName = f.name;
    s.thumbUrl = null;
    // scene.id, markers, compareSets, groups, floorplanId, projectInfo references all untouched

    generateThumb(newBlobUrl, (dataUrl) => {
      s.thumbUrl = dataUrl;
      renderSceneList();
    });

    if (idx === currentIdx && compareState.mode === 'single') {
      loadPanorama(s.blobUrl, s.name, s.flipH);
    }
    if (compareState.mode !== 'single') {
      if (idx === compareState.sceneAIndex) loadCompareSphere('a', idx);
      if (idx === compareState.sceneBIndex) loadCompareSphere('b', idx);
      updateCompareSelects();
    }

    URL.revokeObjectURL(oldBlobUrl);
    renderSceneList();
    showToast('シーンを更新しました');
  });

  let _fadePending = false;
  function switchToScene(idx) {
    if (idx < 0 || idx >= scenes.length) return;
    // Fade transition when already viewing a scene (not first load)
    if (currentIdx >= 0 && currentIdx !== idx && !_fadePending && compareState.mode === 'single') {
      _fadePending = true;
      sceneFadeOverlay.style.opacity = '1';
      setTimeout(() => {
        _doSwitchToScene(idx);
        requestAnimationFrame(() => {
          sceneFadeOverlay.style.opacity = '0';
          _fadePending = false;
        });
      }, 150);
      return;
    }
    _doSwitchToScene(idx);
  }

  function _doSwitchToScene(idx) {
    currentIdx = idx;
    const s = scenes[idx];
    currentSceneNameEl.textContent = s.name;
    flipBtn.classList.toggle('active', s.flipH);
    renderSceneList();
    loadPanorama(s.blobUrl, s.name, s.flipH);
    // Auto-sync FloorMap: v2.7 uses marker-based lookup first, then scene.floorplanId fallback
    const markerForScene = projectState.markers.find(m => m.sceneId === s.id);
    const targetFpId = markerForScene?.floorplanId || s.floorplanId || null;
    if (targetFpId && targetFpId !== activeFloorplanId) {
      const fp = projectState.floorplans.find(f => f.id === targetFpId);
      if (fp) {
        activeFloorplanId = targetFpId;
        _updateFloormapSelect();
        renderFloorplanList();
      }
    }
    if (activeFloorplanId) setTimeout(() => { renderFloormapCanvas(); renderMarkerList(); }, 0);
  }

  function _getNavOrder() {
    // Priority 1: markers on active floorplan sorted by order
    if (activeFloorplanId) {
      const fpMarkers = projectState.markers
        .filter(m => m.floorplanId === activeFloorplanId)
        .sort((a, b) => (a.order || 999) - (b.order || 999));
      if (fpMarkers.length) {
        return fpMarkers.map(m => scenes.findIndex(s => s.id === m.sceneId)).filter(i => i >= 0);
      }
    }
    // Priority 2: filtered scene indices
    if (sceneFilterFloorplanId) {
      return scenes.reduce((acc, s, i) => {
        if (sceneFilterFloorplanId === '__unplaced__') { if (!isScenePlaced(s)) acc.push(i); }
        else if (isSceneOnFloorplan(s, sceneFilterFloorplanId)) acc.push(i);
        return acc;
      }, []);
    }
    // Priority 3: all scenes in order
    return scenes.map((_, i) => i);
  }

  function prevScene() {
    if (!scenes.length) return;
    const order = _getNavOrder();
    if (order.length <= 1) { switchToScene((currentIdx - 1 + scenes.length) % scenes.length); return; }
    const pos = order.indexOf(currentIdx);
    const nextPos = pos < 0 ? 0 : (pos - 1 + order.length) % order.length;
    switchToScene(order[nextPos]);
  }

  function nextScene() {
    if (!scenes.length) return;
    const order = _getNavOrder();
    if (order.length <= 1) { switchToScene((currentIdx + 1) % scenes.length); return; }
    const pos = order.indexOf(currentIdx);
    const nextPos = pos < 0 ? 0 : (pos + 1) % order.length;
    switchToScene(order[nextPos]);
  }

  function deleteScene(idx) {
    if (idx < 0 || idx >= scenes.length) return;
    URL.revokeObjectURL(scenes[idx].blobUrl);
    const wasCurrent = idx === currentIdx;
    if (wasCurrent) stopRender();
    if (compareState.mode !== 'single') exitCompareMode(true);
    scenes.splice(idx, 1);

    if (!scenes.length) { disposeCurrentSphere(); clearAllAndShowUpload(); return; }
    // Remove markers referencing deleted scene
    const deletedId = scenes[idx]?.id; // scenes[idx] was already spliced? No, we spliced before this line
    // Actually: idx was already removed by splice above; use the blobUrl approach
    // We stored deleted scene id before splice in wasCurrent check — use scenes array pre-splice
    // Better: filter markers whose sceneId no longer matches any scene
    const sceneIds = new Set(scenes.map(s => s.id));
    projectState.markers = projectState.markers.filter(m => sceneIds.has(m.sceneId));
    if (activeFloorplanId) setTimeout(() => renderFloormapCanvas(), 0);
    renderSceneFilterBar();
    renderDashboard();

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

    // Clear project state
    projectState.floorplans.forEach(fp => URL.revokeObjectURL(fp.blobUrl));
    projectState.floorplans = [];
    projectState.markers    = [];
    projectState.groups     = [];
    projectState.projectInfo = { client: '', author: '', date: '', notes: '' };
    activeFloorplanId        = null;
    selectedMarkerId         = null;
    isPlacementMode          = false;
    sceneFilterFloorplanId   = null;
    collapsedGroups.clear();
    hideEl(floormapNavigator);
    renderFloorplanList();
    renderSceneFilterBar();
    const dashEl = $('project-dashboard'); if (dashEl) hideEl(dashEl);

    const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
    if ((document.fullscreenElement || document.webkitFullscreenElement) && exitFs)
      exitFs.call(document).catch(() => {});

    hideEl(viewerLayout);
    showEl(uploadSection);
  }

  // ============================================================
  // Render scene list — v2.5: filtered + grouped
  // ============================================================
  function renderSceneList() {
    sceneListEl.innerHTML = '';

    // 1. Filter by active floor plan or unplaced (v2.7: marker-based)
    const visibleIndices = scenes.reduce((acc, s, i) => {
      if (!sceneFilterFloorplanId) acc.push(i);
      else if (sceneFilterFloorplanId === '__unplaced__') { if (!isScenePlaced(s)) acc.push(i); }
      else if (isSceneOnFloorplan(s, sceneFilterFloorplanId)) acc.push(i);
      return acc;
    }, []);

    // 2. Group visible scenes by groupId
    const groupOrder  = [];
    const byGroup     = {};
    const ungrouped   = [];
    visibleIndices.forEach(i => {
      const s = scenes[i];
      const gid = s.groupId && projectState.groups.find(g => g.id === s.groupId) ? s.groupId : null;
      if (gid) {
        if (!byGroup[gid]) { byGroup[gid] = []; groupOrder.push(gid); }
        byGroup[gid].push(i);
      } else {
        ungrouped.push(i);
      }
    });

    const frag = document.createDocumentFragment();

    // 3. Ungrouped scenes first
    ungrouped.forEach(i => frag.appendChild(_createSceneItem(i)));

    // 4. Grouped scenes with collapsible headers
    groupOrder.forEach(gid => {
      const group = projectState.groups.find(g => g.id === gid);
      if (!group) return;
      const isCollapsed = collapsedGroups.has(gid);
      const count = byGroup[gid].length;

      const hdr = document.createElement('li');
      hdr.className = 'scene-group-header';
      hdr.dataset.gid = gid;

      const toggle = document.createElement('span');
      toggle.className = 'scene-group-toggle';
      toggle.textContent = isCollapsed ? '▶' : '▼';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'scene-group-name';
      nameSpan.textContent = group.name;

      const countSpan = document.createElement('span');
      countSpan.className = 'scene-group-count';
      countSpan.textContent = count;

      // Rename button
      const renameBtn = document.createElement('button');
      renameBtn.className = 'scene-group-rename-btn';
      renameBtn.title = 'グループ名を変更';
      renameBtn.textContent = '✏';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _startGroupRename(hdr, group, nameSpan, renameBtn);
      });

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'scene-group-del-btn';
      delBtn.title = 'グループを削除';
      delBtn.textContent = '🗑';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('グループを削除しますか？シーンは削除されません。未分類へ移動します。')) return;
        scenes.forEach(s => { if (s.groupId === gid) s.groupId = null; });
        projectState.groups = projectState.groups.filter(g => g.id !== gid);
        collapsedGroups.delete(gid);
        renderSceneList();
      });

      hdr.appendChild(toggle); hdr.appendChild(nameSpan); hdr.appendChild(countSpan);
      hdr.appendChild(renameBtn); hdr.appendChild(delBtn);
      hdr.addEventListener('click', () => {
        if (collapsedGroups.has(gid)) collapsedGroups.delete(gid); else collapsedGroups.add(gid);
        renderSceneList();
      });
      frag.appendChild(hdr);

      if (!isCollapsed) {
        byGroup[gid].forEach(i => {
          const li = _createSceneItem(i);
          li.classList.add('scene-in-group');
          frag.appendChild(li);
        });
      }
    });

    sceneListEl.appendChild(frag);

    // 5. Update counter
    const shown = visibleIndices.length;
    const total = scenes.length;
    if (!total) {
      sceneCounter.textContent = '0 / 0';
    } else if (sceneFilterFloorplanId) {
      sceneCounter.textContent = `${shown} / ${total}`;
    } else {
      sceneCounter.textContent = `${currentIdx + 1} / ${total}`;
    }
    // Show/hide unplaced warning (v2.7: marker-based)
    if (currentIdx >= 0) {
      const curScene = scenes[currentIdx];
      if (projectState.floorplans.length && curScene && !isScenePlaced(curScene)) showEl(unplacedWarning);
      else hideEl(unplacedWarning);
    }

    sceneListEl.querySelector('.scene-item.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function _createSceneItem(i) {
    const s = scenes[i];
    const isActive = i === currentIdx;
    const li = document.createElement('li');
    li.className = 'scene-item' + (isActive ? ' active' : '');
    li.draggable = true;
    li.dataset.idx = i;

    // ---- Left: meta block (number/name row + sub-info row) ----
    const main = document.createElement('div');
    main.className = 'scene-item-main';

    const titleRow = document.createElement('div');
    titleRow.className = 'scene-item-title-row';

    const numEl = document.createElement('span');
    numEl.className = 'scene-num';
    numEl.textContent = i + 1;
    titleRow.appendChild(numEl);

    const nameEl = document.createElement('span');
    nameEl.className = 'scene-name';
    nameEl.textContent = s.name;
    nameEl.title = s.name;
    titleRow.appendChild(nameEl);

    nameEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      nameEl.contentEditable = 'true';
      nameEl.classList.add('editing');
      const r = document.createRange();
      r.selectNodeContents(nameEl);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    });
    nameEl.addEventListener('blur', () => {
      nameEl.contentEditable = 'false';
      nameEl.classList.remove('editing');
      const n = nameEl.textContent.trim();
      s.name = n || s.name;
      nameEl.textContent = s.name;
      nameEl.title = s.name;
      if (i === currentIdx) currentSceneNameEl.textContent = s.name;
      if (compareState.mode !== 'single') updateCompareSelects();
    });
    nameEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter')  { e.preventDefault(); nameEl.blur(); }
      if (e.key === 'Escape') { nameEl.textContent = s.name; nameEl.blur(); }
    });

    // Marker order badge (e.g. "#1") — prefers a marker on the active floorplan
    const marker = projectState.markers.find(m => m.sceneId === s.id && m.floorplanId === activeFloorplanId)
                 || projectState.markers.find(m => m.sceneId === s.id);
    if (marker && marker.order) {
      const ordEl = document.createElement('span');
      ordEl.className = 'scene-order-badge';
      ordEl.textContent = `#${marker.order}`;
      ordEl.title = 'FloorMap上の番号';
      titleRow.appendChild(ordEl);
    }

    main.appendChild(titleRow);

    const subRow = document.createElement('div');
    subRow.className = 'scene-item-sub-row';

    const fp = s.floorplanId ? projectState.floorplans.find(f => f.id === s.floorplanId) : null;
    if (fp) {
      const badge = document.createElement('span');
      badge.className = 'scene-floor-badge';
      badge.textContent = fp.name;
      badge.title = fp.name;
      subRow.appendChild(badge);
    }

    const curGroup = s.groupId ? projectState.groups.find(g => g.id === s.groupId) : null;
    if (curGroup) {
      const gTag = document.createElement('span');
      gTag.className = 'scene-group-tag';
      gTag.textContent = curGroup.name;
      gTag.title = `グループ: ${curGroup.name}`;
      subRow.appendChild(gTag);
    }

    if (projectState.floorplans.length) {
      const placed = isScenePlaced(s);
      const statusEl = document.createElement('span');
      statusEl.className = 'scene-status-tag' + (placed ? ' placed' : ' unplaced');
      statusEl.textContent = placed ? '配置済' : '未配置';
      subRow.appendChild(statusEl);
    }

    main.appendChild(subRow);

    // ---- Right: fixed-size thumbnail ----
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'scene-thumb-wrap' + (s.thumbUrl ? '' : ' scene-thumb-placeholder');
    if (s.thumbUrl) {
      const img = document.createElement('img');
      img.className = 'scene-thumb'; img.src = s.thumbUrl; img.alt = ''; img.draggable = false;
      thumbWrap.appendChild(img);
      thumbWrap.addEventListener('mouseenter', () => showThumbPreview(s.thumbUrl, li));
      thumbWrap.addEventListener('mouseleave', hideThumbPreview);
    }
    if (compareState.mode !== 'single') {
      if (i === compareState.sceneAIndex) {
        const ab = document.createElement('span');
        ab.className = 'scene-ab-badge scene-ab-badge-a'; ab.textContent = 'A';
        thumbWrap.appendChild(ab);
      } else if (i === compareState.sceneBIndex) {
        const ab = document.createElement('span');
        ab.className = 'scene-ab-badge scene-ab-badge-b'; ab.textContent = 'B';
        thumbWrap.appendChild(ab);
      }
    }

    // ---- Actions: compact, revealed on hover/focus ----
    const actions = document.createElement('div');
    actions.className = 'scene-item-actions';

    const groupBtn = document.createElement('button');
    groupBtn.className = 'scene-group-btn' + (curGroup ? ' has-group' : '');
    groupBtn.title = curGroup ? `グループ: ${curGroup.name}（クリックで変更）` : 'グループを設定';
    groupBtn.textContent = '📁';
    groupBtn.addEventListener('click', (e) => { e.stopPropagation(); openGroupPicker(i, groupBtn); });
    actions.appendChild(groupBtn);

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'scene-replace-btn';
    replaceBtn.title = '画像を差し替え（markers/比較セット/グループ/平面図紐付けは維持）';
    replaceBtn.textContent = '🖼';
    replaceBtn.addEventListener('click', (e) => { e.stopPropagation(); openReplaceScenePicker(i); });
    actions.appendChild(replaceBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'scene-delete-btn';
    delBtn.title = 'このシーンを削除';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteScene(i); });
    actions.appendChild(delBtn);

    li.appendChild(main);
    li.appendChild(thumbWrap);
    li.appendChild(actions);

    // Click to switch scene
    li.addEventListener('click', () => {
      if (nameEl.contentEditable === 'true') return;
      if (i !== currentIdx) switchToScene(i);
    });

    // Drag & Drop
    li.addEventListener('dragstart', (e) => {
      dragSrcIdx = i; li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
    });
    li.addEventListener('dragend', () => {
      dragSrcIdx = -1; dragOverIdx = -1;
      li.classList.remove('dragging');
      sceneListEl.querySelectorAll('.drop-before,.drop-after').forEach(el =>
        el.classList.remove('drop-before', 'drop-after'));
    });
    li.addEventListener('dragover', (e) => {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      if (dragSrcIdx === i) return;
      const rect = li.getBoundingClientRect();
      const insertBefore = e.clientY < rect.top + rect.height / 2;
      sceneListEl.querySelectorAll('.drop-before,.drop-after').forEach(el => {
        if (el !== li) el.classList.remove('drop-before', 'drop-after');
      });
      if (insertBefore) {
        li.classList.add('drop-before'); li.classList.remove('drop-after'); dragOverIdx = i;
      } else {
        li.classList.add('drop-after'); li.classList.remove('drop-before'); dragOverIdx = i + 1;
      }
    });
    li.addEventListener('dragleave', () => li.classList.remove('drop-before', 'drop-after'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      li.classList.remove('drop-before', 'drop-after');
      if (dragSrcIdx < 0 || dragSrcIdx === dragOverIdx) return;
      let insertAt = dragOverIdx;
      if (insertAt > dragSrcIdx) insertAt--;
      reorderScene(dragSrcIdx, insertAt);
    });

    return li;
  }

  // ============================================================
  // Scene filter bar (v2.5)
  // ============================================================
  function renderSceneFilterBar() {
    const bar = $('scene-filter-bar');
    if (!bar) return;
    if (!projectState.floorplans.length) { hideEl(bar); return; }
    showEl(bar);
    bar.innerHTML = '';

    // Label (v2.8)
    const label = document.createElement('div');
    label.className = 'scene-filter-label';
    label.textContent = '表示範囲';
    bar.appendChild(label);

    const allBtn = document.createElement('button');
    allBtn.className = 'scene-filter-btn' + (!sceneFilterFloorplanId ? ' active' : '');
    allBtn.textContent = `すべて (${scenes.length})`;
    allBtn.addEventListener('click', () => {
      sceneFilterFloorplanId = null;
      renderSceneFilterBar(); renderSceneList();
    });
    bar.appendChild(allBtn);

    projectState.floorplans.forEach(fp => {
      const count = scenes.filter(s => isSceneOnFloorplan(s, fp.id)).length;
      const btn = document.createElement('button');
      btn.className = 'scene-filter-btn' + (sceneFilterFloorplanId === fp.id ? ' active' : '');
      btn.textContent = `${fp.name} (${count})`;
      btn.title = fp.name;
      btn.addEventListener('click', () => {
        sceneFilterFloorplanId = fp.id;
        if (fp.id !== activeFloorplanId) setActiveFloorplan(fp.id);
        renderSceneFilterBar(); renderSceneList();
      });
      bar.appendChild(btn);
    });

    // Unplaced tab (marker-based)
    const unplacedCount = scenes.filter(s => !isScenePlaced(s)).length;
    if (unplacedCount > 0) {
      const btn = document.createElement('button');
      btn.className = 'scene-filter-btn' + (sceneFilterFloorplanId === '__unplaced__' ? ' active' : '');
      btn.textContent = `未配置 (${unplacedCount})`;
      btn.title = 'マーカーが配置されていないシーン';
      btn.addEventListener('click', () => {
        sceneFilterFloorplanId = '__unplaced__';
        renderSceneFilterBar(); renderSceneList();
      });
      bar.appendChild(btn);
    }
  }

  // ============================================================
  // Project Dashboard (v2.7)
  // ============================================================
  function renderDashboard() {
    const el = $('project-dashboard');
    if (!el) return;
    if (!scenes.length && !projectState.floorplans.length) { hideEl(el); return; }
    showEl(el);
    const placedCount   = scenes.filter(s => isScenePlaced(s)).length;
    const unplacedCount = scenes.length - placedCount;
    const placedPct     = scenes.length ? Math.round(placedCount / scenes.length * 100) : 0;
    const csets         = _loadCompareSets();
    el.innerHTML =
      `<div class="dashboard-grid">` +
      `<div class="dashboard-cell"><span class="dashboard-val">${scenes.length}</span><span class="dashboard-lbl">シーン</span></div>` +
      `<div class="dashboard-cell"><span class="dashboard-val">${projectState.floorplans.length}</span><span class="dashboard-lbl">FloorMap</span></div>` +
      `<div class="dashboard-cell"><span class="dashboard-val">${projectState.markers.length}</span><span class="dashboard-lbl">マーカー</span></div>` +
      `<div class="dashboard-cell dashboard-cell-placed" title="配置済シーンをフィルタ" style="cursor:pointer"><span class="dashboard-val dashboard-placed">${placedCount}</span><span class="dashboard-lbl">配置済</span></div>` +
      `<div class="dashboard-cell dashboard-cell-unplaced" title="未配置シーンをフィルタ" style="cursor:pointer"><span class="dashboard-val dashboard-unplaced">${unplacedCount}</span><span class="dashboard-lbl">未配置</span></div>` +
      `<div class="dashboard-cell"><span class="dashboard-val">${projectState.groups.length}</span><span class="dashboard-lbl">グループ</span></div>` +
      `<div class="dashboard-cell"><span class="dashboard-val">${csets.length}</span><span class="dashboard-lbl">比較セット</span></div>` +
      `<div class="dashboard-cell dashboard-cell-rate"><span class="dashboard-val dashboard-rate">${placedPct}%</span><span class="dashboard-lbl">配置率</span></div>` +
      `</div>`;
    // Click handlers for placed/unplaced cells (v2.8)
    el.querySelector('.dashboard-cell-unplaced')?.addEventListener('click', () => {
      sceneFilterFloorplanId = '__unplaced__';
      renderSceneFilterBar(); renderSceneList();
    });
    el.querySelector('.dashboard-cell-placed')?.addEventListener('click', () => {
      sceneFilterFloorplanId = null;
      renderSceneFilterBar(); renderSceneList();
    });
  }

  // ============================================================
  // Group picker (v2.5)
  // ============================================================
  function openGroupPicker(sceneIdx, anchorEl) {
    _groupPickerSceneIdx = sceneIdx;
    const picker = $('group-picker');
    _renderGroupPickerList();
    showEl(picker);
    const rect = anchorEl.getBoundingClientRect();
    picker.style.left = Math.min(rect.left, window.innerWidth - 230) + 'px';
    picker.style.top  = Math.min(rect.bottom + 4, window.innerHeight - 250) + 'px';
    setTimeout(() => document.addEventListener('click', _onGroupPickerOutside, { once: true }), 0);
  }

  function _onGroupPickerOutside(e) {
    const picker = $('group-picker');
    if (picker && !picker.contains(e.target)) {
      closeGroupPicker();
    } else {
      document.addEventListener('click', _onGroupPickerOutside, { once: true });
    }
  }

  function closeGroupPicker() {
    const picker = $('group-picker');
    if (picker) hideEl(picker);
    _groupPickerSceneIdx = -1;
  }

  function _renderGroupPickerList() {
    const list = $('group-picker-list');
    list.innerHTML = '';
    const s = _groupPickerSceneIdx >= 0 ? scenes[_groupPickerSceneIdx] : null;

    const noneItem = document.createElement('li');
    noneItem.className = 'group-picker-item' + (!s?.groupId ? ' active' : '');
    noneItem.textContent = '未分類';
    noneItem.addEventListener('click', (e) => {
      e.stopPropagation();
      if (s) s.groupId = null;
      closeGroupPicker(); renderSceneList();
    });
    list.appendChild(noneItem);

    projectState.groups.forEach(g => {
      const item = document.createElement('li');
      item.className = 'group-picker-item' + (s?.groupId === g.id ? ' active' : '');

      const nameSpan = document.createElement('span');
      nameSpan.textContent = g.name;

      const delBtn = document.createElement('button');
      delBtn.className = 'group-picker-del';
      delBtn.textContent = '×';
      delBtn.title = 'グループを削除';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        scenes.forEach(sc => { if (sc.groupId === g.id) sc.groupId = null; });
        projectState.groups = projectState.groups.filter(x => x.id !== g.id);
        collapsedGroups.delete(g.id);
        _renderGroupPickerList(); renderSceneList();
      });

      item.appendChild(nameSpan); item.appendChild(delBtn);
      item.addEventListener('click', (e) => {
        if (e.target === delBtn) return;
        e.stopPropagation();
        if (s) s.groupId = g.id;
        closeGroupPicker(); renderSceneList();
      });
      list.appendChild(item);
    });
  }

  // ============================================================
  // Group rename (v2.6)
  // ============================================================
  function _startGroupRename(hdr, group, nameSpan, renameBtn) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'scene-group-name-input';
    input.value = group.name;
    input.maxLength = 40;
    hdr.replaceChild(input, nameSpan);
    renameBtn.style.opacity = '0';
    input.focus();
    input.select();
    const commit = () => {
      const v = input.value.trim();
      if (v) group.name = v;
      renderSceneList();
    };
    const cancel = () => renderSceneList();
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter')  { e.preventDefault(); input.removeEventListener('blur', commit); commit(); }
      if (e.key === 'Escape') { input.removeEventListener('blur', commit); cancel(); }
    });
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

  // ---- Modal helpers ----
  let _setNameOnOk = null;

  function openSetNameModal({ title, infoHTML, note, defaultName, okLabel = '保存' }, onOk) {
    _setNameOnOk = onOk;
    setNameModalTitle.textContent = title;
    if (infoHTML) {
      setNameModalInfo.innerHTML = infoHTML;
      showEl(setNameModalInfo);
    } else {
      setNameModalInfo.innerHTML = '';
      hideEl(setNameModalInfo);
    }
    if (note) {
      setNameModalNote.textContent = note;
      showEl(setNameModalNote);
    } else {
      setNameModalNote.textContent = '';
      hideEl(setNameModalNote);
    }
    setNameInput.value = defaultName || '';
    setNameOkBtn.textContent = okLabel;
    showEl(setNameModal);
    // defer focus so modal is visible first (avoids INP on keydown)
    setTimeout(() => { setNameInput.select(); setNameInput.focus(); }, 0);
  }

  function _closeSetNameModal(confirmed) {
    hideEl(setNameModal);
    const name = confirmed ? setNameInput.value.trim() : null;
    const cb = _setNameOnOk;
    _setNameOnOk = null;
    if (confirmed && cb) cb(name);
  }

  setNameOkBtn.addEventListener('click', () => _closeSetNameModal(true));
  setNameCancelBtn.addEventListener('click', () => _closeSetNameModal(false));
  setNameCloseBtn.addEventListener('click', () => _closeSetNameModal(false));
  setNameModal.addEventListener('click', (e) => { if (e.target === setNameModal) _closeSetNameModal(false); });
  setNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); _closeSetNameModal(true); }
    if (e.key === 'Escape') { e.preventDefault(); _closeSetNameModal(false); }
  });

  // ---- Save / Restore / Delete / Rename ----
  function saveCurrentCompareSet() {
    if (compareState.mode === 'single') { showToast('比較モード中のみ保存できます'); return; }
    const sa = scenes[compareState.sceneAIndex];
    const sb = scenes[compareState.sceneBIndex];
    if (!sa || !sb) return;

    const modeLabel    = compareState.mode === 'slider' ? 'スライダー比較' : '分割比較';
    const layoutLabel  = compareState.layout === 'stack'  ? '上下' : '左右';
    const syncLabel    = compareState.syncViews ? '視点同期 ON' : '視点同期 OFF';
    const infoHTML =
      `<div class="modal-scene-row"><span class="tb-badge tb-badge-a">A</span>` +
      `<span class="modal-scene-text">${_esc(sa.name)}</span></div>` +
      `<div class="modal-scene-row"><span class="tb-badge tb-badge-b">B</span>` +
      `<span class="modal-scene-text">${_esc(sb.name)}</span></div>` +
      `<div class="modal-mode-row"><span>${modeLabel}</span>` +
      (compareState.mode === 'split' ? `<span>・${layoutLabel}</span>` : '') +
      `<span>・${syncLabel}</span></div>`;
    const note = 'ℹ️ 比較セットはこのブラウザ内にのみ保存されます。画像データは保存されません。別のPCやブラウザには共有されません。';

    openSetNameModal(
      { title: '比較セットを保存', infoHTML, note, defaultName: `${sa.name} vs ${sb.name}` },
      (name) => {
        if (name === null) return;
        const setName = name || `${sa.name} vs ${sb.name}`;
        const sets = _loadCompareSets();
        const existingIdx = sets.findIndex(s => s.name === setName);
        const newSet = {
          id:             existingIdx >= 0 ? sets[existingIdx].id : genId(),
          name:           setName,
          mode:           compareState.mode,
          sceneAId:       sa.id,
          sceneAName:     sa.name,
          sceneBId:       sb.id,
          sceneBName:     sb.name,
          layout:         compareState.layout,
          sliderPosition: compareState.sliderPosition,
          syncViews:      compareState.syncViews,
          createdAt:      existingIdx >= 0 ? sets[existingIdx].createdAt : new Date().toISOString(),
        };
        if (existingIdx >= 0) sets[existingIdx] = newSet;
        else sets.push(newSet);
        _saveCompareSetsToStorage(sets);
        compareState.activeSetId = newSet.id;
        showToast(`比較セット「${setName}」を保存しました — サイドバーから再表示できます`);
        // Defer DOM rebuild to avoid INP on the save button click
        setTimeout(() => renderCompareSets(), 0);
      }
    );
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
    // Update card highlight without full rebuild
    setTimeout(() => renderCompareSets(), 0);
  }

  function deleteCompareSet(setId) {
    const sets = _loadCompareSets().filter(s => s.id !== setId);
    _saveCompareSetsToStorage(sets);
    if (compareState.activeSetId === setId) compareState.activeSetId = null;
    showToast('比較セットを削除しました');
    setTimeout(() => renderCompareSets(), 0);
  }

  function renameCompareSet(setId) {
    const sets = _loadCompareSets();
    const set = sets.find(s => s.id === setId);
    if (!set) return;
    openSetNameModal(
      { title: 'セット名を変更', defaultName: set.name, okLabel: '変更' },
      (name) => {
        if (!name) return;
        set.name = name;
        _saveCompareSetsToStorage(sets);
        setTimeout(() => renderCompareSets(), 0);
      }
    );
  }

  function _esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _formatDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ` +
             `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return ''; }
  }

  // ============================================================
  // Render compare sets sidebar section
  // ============================================================
  function renderCompareSets() {
    const sets = _loadCompareSets();
    compareSetsList.innerHTML = '';

    if (!sets.length) {
      hideEl(compareSetsList);
      showEl(compareSetsEmpty);
      return;
    }
    hideEl(compareSetsEmpty);
    showEl(compareSetsList);

    const frag = document.createDocumentFragment();
    sets.forEach(set => {
      const li = document.createElement('li');
      li.className = 'compare-set-item' + (set.id === compareState.activeSetId ? ' active' : '');

      // ---- header row ----
      const hd = document.createElement('div');
      hd.className = 'cset-header';

      const iconEl = document.createElement('span');
      iconEl.className = 'cset-mode-icon';
      iconEl.textContent = set.mode === 'slider' ? '◫' : '⊞';

      const nameEl = document.createElement('span');
      nameEl.className = 'cset-name';
      nameEl.textContent = set.name;
      nameEl.title = set.name;

      const actionsEl = document.createElement('div');
      actionsEl.className = 'cset-actions';

      const openBtn = document.createElement('button');
      openBtn.className = 'cset-btn cset-btn-open';
      openBtn.title = 'この比較セットを開く';
      openBtn.textContent = '開く';
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (scenes.length < 2) { showToast('2枚以上のシーンが必要です'); return; }
        restoreCompareSet(set);
      });

      const renameBtn = document.createElement('button');
      renameBtn.className = 'cset-btn';
      renameBtn.title = '名前を変更';
      renameBtn.textContent = '✏';
      renameBtn.addEventListener('click', (e) => { e.stopPropagation(); renameCompareSet(set.id); });

      const delBtn = document.createElement('button');
      delBtn.className = 'cset-btn cset-btn-del';
      delBtn.title = 'このセットを削除';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteCompareSet(set.id); });

      actionsEl.appendChild(openBtn);
      actionsEl.appendChild(renameBtn);
      actionsEl.appendChild(delBtn);
      hd.appendChild(iconEl);
      hd.appendChild(nameEl);
      hd.appendChild(actionsEl);

      // ---- scenes row ----
      const scenesRow = document.createElement('div');
      scenesRow.className = 'cset-scenes';

      const labelA = document.createElement('span');
      labelA.className = 'cset-scene-label';
      const badgeA = document.createElement('span');
      badgeA.className = 'tb-badge tb-badge-a';
      badgeA.textContent = 'A';
      const nameA = document.createElement('span');
      nameA.className = 'cset-scene-name';
      // Try to resolve live scene name if still in memory
      const liveA = scenes.find(s => s.id === set.sceneAId);
      nameA.textContent = liveA ? liveA.name : (set.sceneAName || set.sceneAId);
      nameA.title = nameA.textContent;
      labelA.appendChild(badgeA);
      labelA.appendChild(nameA);

      const arrow = document.createElement('span');
      arrow.className = 'cset-arrow';
      arrow.textContent = '→';

      const labelB = document.createElement('span');
      labelB.className = 'cset-scene-label';
      const badgeB = document.createElement('span');
      badgeB.className = 'tb-badge tb-badge-b';
      badgeB.textContent = 'B';
      const nameB = document.createElement('span');
      nameB.className = 'cset-scene-name';
      const liveB = scenes.find(s => s.id === set.sceneBId);
      nameB.textContent = liveB ? liveB.name : (set.sceneBName || set.sceneBId);
      nameB.title = nameB.textContent;
      labelB.appendChild(badgeB);
      labelB.appendChild(nameB);

      scenesRow.appendChild(labelA);
      scenesRow.appendChild(arrow);
      scenesRow.appendChild(labelB);

      // ---- meta row ----
      const metaRow = document.createElement('div');
      metaRow.className = 'cset-meta';

      const modeTag = document.createElement('span');
      modeTag.className = 'cset-tag';
      modeTag.textContent = set.mode === 'slider' ? 'スライダー' : '分割';
      metaRow.appendChild(modeTag);

      if (set.mode === 'split') {
        const layoutTag = document.createElement('span');
        layoutTag.className = 'cset-tag';
        layoutTag.textContent = set.layout === 'stack' ? '上下' : '左右';
        metaRow.appendChild(layoutTag);
      }

      const syncTag = document.createElement('span');
      syncTag.className = 'cset-tag';
      syncTag.textContent = set.syncViews ? '同期ON' : '同期OFF';
      metaRow.appendChild(syncTag);

      const dateEl = document.createElement('span');
      dateEl.className = 'cset-date';
      dateEl.textContent = _formatDate(set.createdAt);
      metaRow.appendChild(dateEl);

      li.appendChild(hd);
      li.appendChild(scenesRow);
      li.appendChild(metaRow);

      // Click card body to open (but not when clicking buttons)
      li.addEventListener('click', (e) => {
        if (e.target.closest('.cset-actions')) return;
        if (scenes.length < 2) { showToast('2枚以上のシーンが必要です'); return; }
        restoreCompareSet(set);
      });

      frag.appendChild(li);
    });
    compareSetsList.appendChild(frag);
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
  // Drop zone — supports panorama images, JSON, or JSON + images together
  // ============================================================
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault(); dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    _handleDropZoneFiles(Array.from(e.dataTransfer.files));
  });
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = '';
  });

  function _handleDropZoneFiles(files) {
    const jsonFiles  = files.filter(f => f.name.endsWith('.json') || f.type === 'application/json');
    const imageFiles = files.filter(f => ['image/jpeg','image/png','image/webp'].includes(f.type));

    if (jsonFiles.length > 0) {
      // Read the first JSON file
      const jsonFile = jsonFiles[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          _importData = JSON.parse(ev.target.result);
        } catch {
          showGlobalError('JSONファイルの解析に失敗しました。');
          return;
        }
        if (imageFiles.length > 0) {
          // Case 3: JSON + images dropped together — try direct restore
          _doImportWithFiles(imageFiles);
        } else {
          // Case 1: JSON only — show modal to let user select images
          _showImportModal();
        }
      };
      reader.readAsText(jsonFile);
    } else if (imageFiles.length > 0) {
      // Case 2 / Case 4: images only — standard new project
      handleFiles(imageFiles);
    }
  }

  // ============================================================
  // Canvas interaction
  // ============================================================
  const SENSITIVITY = 0.3;

  let _floormapRotRafPending = false;
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
      // Update current scene's marker rotation in real time
      if (activeFloorplanId && currentIdx >= 0) {
        const curScene = scenes[currentIdx];
        if (curScene) {
          const mk = projectState.markers.find(m => m.floorplanId === activeFloorplanId && m.sceneId === curScene.id);
          if (mk) mk.rotation = Math.round(thetaToFloorRotation(theta, curScene.flipH || false));
        }
      }
    }
    // Throttled floormap redraw
    if (activeFloorplanId && !_floormapRotRafPending) {
      _floormapRotRafPending = true;
      requestAnimationFrame(() => { _floormapRotRafPending = false; renderFloormapCanvas(); });
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
      // Update FOV cone in FloorMap
      if (activeFloorplanId && !_floormapRotRafPending) {
        _floormapRotRafPending = true;
        requestAnimationFrame(() => { _floormapRotRafPending = false; renderFloormapCanvas(); });
      }
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
    if (setNameModal.style.display !== 'none') return; // modal open

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
  updateSceneBtn.addEventListener('click', () => {
    if (currentIdx < 0 || !scenes.length) { showToast('シーンがありません'); return; }
    openReplaceScenePicker(currentIdx);
  });
  clearAllBtn.addEventListener('click',  clearAllAndShowUpload);
  backBtn.addEventListener('click',      clearAllAndShowUpload);

  splitCompareBtn.addEventListener('click',   () => enterSplitMode());
  sliderCompareBtn.addEventListener('click',  () => enterSliderMode());
  exitCompareBtn.addEventListener('click',    () => exitCompareMode());
  // Switching between split/slider while already comparing must keep the current A/B pair
  // (not the click MouseEvent, which would be misread as the options arg and trigger
  // the "fresh entry" currentIdx-based fallback inside enterSplitMode/enterSliderMode).
  switchToSplitBtn.addEventListener('click', () => {
    if (compareState.mode === 'single') { enterSplitMode(); return; }
    enterSplitMode({
      idxA: compareState.sceneAIndex,
      idxB: compareState.sceneBIndex,
      layout: compareState.layout,
      syncViews: compareState.syncViews,
    });
  });
  switchToSliderBtn.addEventListener('click', () => {
    if (compareState.mode === 'single') { enterSliderMode(); return; }
    enterSliderMode({
      idxA: compareState.sceneAIndex,
      idxB: compareState.sceneBIndex,
      sliderPos: compareState.sliderPosition,
      syncViews: compareState.syncViews,
    });
  });

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
    if (activeFloorplanId) renderFloormapCanvas();
  });

  // ============================================================
  // Floor Plan Management
  // ============================================================
  function handleFloorplanFiles(fileList) {
    const allowed = new Set(['image/jpeg','image/png','image/webp']);
    const valid   = Array.from(fileList).filter(f => allowed.has(f.type) && f.size <= 50*1024*1024);
    if (!valid.length) return;
    valid.forEach(f => {
      const blobUrl = URL.createObjectURL(f);
      const imgEl   = new Image();
      imgEl.src = blobUrl;
      const fp = { id: genId(), name: f.name.replace(/\.[^.]+$/, ''), fileName: f.name, blobUrl, imgEl, rotationOffset: 0 };
      imgEl.onload = () => { if (!activeFloorplanId) setActiveFloorplan(fp.id); renderFloormap(); };
      projectState.floorplans.push(fp);
    });
    if (!activeFloorplanId && projectState.floorplans.length)
      activeFloorplanId = projectState.floorplans[0].id;
    renderFloorplanList();
    renderSceneFilterBar();
    renderDashboard();
    showToast(`平面図を ${valid.length} 件追加しました`);
  }

  function deleteFloorplan(id) {
    const fp = projectState.floorplans.find(f => f.id === id);
    if (fp) URL.revokeObjectURL(fp.blobUrl);
    projectState.floorplans = projectState.floorplans.filter(f => f.id !== id);
    projectState.markers    = projectState.markers.filter(m => m.floorplanId !== id);
    // Clear floorplanId from scenes that referenced deleted floor plan
    scenes.forEach(s => { if (s.floorplanId === id) s.floorplanId = null; });
    if (activeFloorplanId === id)
      activeFloorplanId = projectState.floorplans[0]?.id || null;
    if (sceneFilterFloorplanId === id) sceneFilterFloorplanId = null;
    renderFloorplanList();
    renderFloormap();
    renderSceneFilterBar();
    renderSceneList();
    renderDashboard();
  }

  function setActiveFloorplan(id) {
    activeFloorplanId = id;
    selectedMarkerId  = null;
    renderFloorplanList();
    renderFloormap();
    renderSceneFilterBar();
    renderMarkerList();
  }

  function renderFloorplanList() {
    floorplanListEl.innerHTML = '';
    if (!projectState.floorplans.length) {
      hideEl(floorplanListEl);
      showEl(floorplanEmptyMsg);
      return;
    }
    showEl(floorplanListEl);
    hideEl(floorplanEmptyMsg);

    projectState.floorplans.forEach(fp => {
      const div = document.createElement('div');
      div.className = 'floorplan-item' + (fp.id === activeFloorplanId ? ' active' : '');

      const icon = document.createElement('span');
      icon.className = 'floorplan-icon';
      icon.textContent = '🗺';

      const nameEl = document.createElement('span');
      nameEl.className = 'floorplan-name';
      nameEl.textContent = fp.name;
      nameEl.title = fp.name;

      nameEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        nameEl.contentEditable = 'true';
        nameEl.classList.add('editing');
        const r = document.createRange(); r.selectNodeContents(nameEl);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      });
      nameEl.addEventListener('blur', () => {
        nameEl.contentEditable = 'false'; nameEl.classList.remove('editing');
        fp.name = nameEl.textContent.trim() || fp.name;
        nameEl.textContent = fp.name;
        // Update select if this is active
        if (fp.id === activeFloorplanId) _updateFloormapSelect();
      });
      nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); nameEl.blur(); }
        if (e.key === 'Escape') { nameEl.textContent = fp.name; nameEl.blur(); }
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'floorplan-del-btn';
      delBtn.textContent = '×'; delBtn.title = 'この平面図を削除';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteFloorplan(fp.id); });

      div.appendChild(icon); div.appendChild(nameEl); div.appendChild(delBtn);
      div.addEventListener('click', () => setActiveFloorplan(fp.id));
      floorplanListEl.appendChild(div);
    });
  }

  // ============================================================
  // FloorMap Navigator
  // ============================================================

  // Convert camera yaw (theta radians) to floor plan arrow direction (degrees).
  // sign(theta) drives the arrow CW/CCW. Empirically validated:
  //   non-flipped: +theta gives correct correspondence with panorama drag direction.
  //   flipped: image is mirrored so the sign is negated to maintain same visual feel.
  function thetaToFloorRotation(theta, flipH) {
    const sign = flipH ? -1 : 1;
    return ((sign * theta * 180 / Math.PI) % 360 + 360) % 360;
  }

  function renderFloormap() {
    if (!projectState.floorplans.length || !activeFloorplanId) {
      hideEl(floormapNavigator);
      return;
    }
    showEl(floormapNavigator);
    _updateFloormapSelect();
    // Sync canvas size to body on first show
    requestAnimationFrame(() => {
      const bw = floormapBody.clientWidth;
      const bh = floormapBody.clientHeight;
      if (bw > 0 && bh > 0) { floormapCanvas.width = bw; floormapCanvas.height = bh; }
      renderFloormapCanvas();
      renderMarkerList();
    });
  }

  function _updateFloormapSelect() {
    renderFloormapTabs();
  }

  function renderFloormapTabs() {
    floormapFpTabs.innerHTML = '';
    projectState.floorplans.forEach(fp => {
      // count = scenes with a marker on this floorplan
      const count = scenes.filter(s => isSceneOnFloorplan(s, fp.id)).length;
      const btn = document.createElement('button');
      btn.className = 'floormap-fp-tab' + (fp.id === activeFloorplanId ? ' active' : '');
      btn.textContent = `${fp.name} (${count})`;
      btn.title = fp.name;
      btn.addEventListener('click', () => {
        if (fp.id !== activeFloorplanId) setActiveFloorplan(fp.id);
      });
      floormapFpTabs.appendChild(btn);
    });
    // Show/hide orientation bar
    const fp = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (fp) {
      showEl(floormapOrientBar);
      floormapOrientVal.textContent = `${fp.rotationOffset || 0}°`;
      floormapOrientPreset.value = String((fp.rotationOffset || 0) % 360);
    } else {
      hideEl(floormapOrientBar);
    }
  }

  function renderFloormapCanvas() {
    const fp = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (!fp?.imgEl || !fp.imgEl.complete || !fp.imgEl.naturalWidth) {
      fp && (fp.imgEl.onload = () => renderFloormapCanvas());
      return;
    }
    // Keep canvas dimensions in sync with body element
    const bw = floormapBody.clientWidth;
    const bh = floormapBody.clientHeight;
    if (bw > 0 && bh > 0 && (floormapCanvas.width !== bw || floormapCanvas.height !== bh)) {
      floormapCanvas.width = bw; floormapCanvas.height = bh;
    }
    const img = fp.imgEl;
    const W   = floormapCanvas.width;
    const H   = floormapCanvas.height;
    const ctx = floormapCanvas.getContext('2d');

    // Draw background
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Letter-box fit
    const ia = img.naturalWidth / img.naturalHeight;
    const ca = W / H;
    let dw, dh, dx, dy;
    if (ia > ca) { dw = W; dh = W / ia; dx = 0; dy = (H - dh) / 2; }
    else         { dh = H; dw = H * ia; dy = 0; dx = (W - dw) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);

    // Store render area for coordinate mapping
    fp._renderArea = { dx, dy, dw, dh };

    // Draw markers (non-current first so current renders on top)
    const curSceneId = currentIdx >= 0 ? scenes[currentIdx]?.id : null;
    const markers = projectState.markers.filter(m => m.floorplanId === activeFloorplanId);
    // Draw non-current markers first
    markers.filter(m => m.sceneId !== curSceneId).forEach(m => {
      const px = dx + m.x * dw;
      const py = dy + m.y * dh;
      const label = m.order || '?';
      const displayDeg = ((m.rotation || 0) + (fp.rotationOffset || 0) + 360) % 360;
      _drawMarker(ctx, px, py, displayDeg, false, m.id === selectedMarkerId, label, null);
    });
    // Draw current marker on top with FOV cone
    markers.filter(m => m.sceneId === curSceneId).forEach(m => {
      const px = dx + m.x * dw;
      const py = dy + m.y * dh;
      const label = m.order || '?';
      // Use shared fov in single/sync mode
      const coneFov = (compareState.mode === 'single' || compareState.syncViews) ? fov : null;
      const displayDeg = ((m.rotation || 0) + (fp.rotationOffset || 0) + 360) % 360;
      _drawMarker(ctx, px, py, displayDeg, true, m.id === selectedMarkerId, label, coneFov);
    });
  }

  function _drawMarker(ctx, px, py, deg, isCurrent, isSelected, label, fovDeg) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(deg * Math.PI / 180);

    // FOV cone (drawn first so it's behind the pin)
    if (isCurrent && fovDeg != null) {
      const coneLen = 55;
      const halfFov = (fovDeg / 2) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      // arc centered on "up" direction (-π/2 in standard canvas angles)
      ctx.arc(0, 0, coneLen, -Math.PI / 2 - halfFov, -Math.PI / 2 + halfFov);
      ctx.closePath();
      ctx.fillStyle = 'rgba(79,124,255,0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(79,124,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Arrow pointing "up" (in the direction of rotation)
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(6, -8); ctx.lineTo(-6, -8); ctx.closePath();
    ctx.fillStyle = isCurrent ? '#4f7cff' : 'rgba(160,160,160,0.9)';
    ctx.fill();

    // Circle body
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fillStyle = isCurrent ? 'rgba(79,124,255,0.9)' : 'rgba(100,100,100,0.8)';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#fff' : (isCurrent ? 'rgba(107,147,255,0.7)' : 'rgba(255,255,255,0.3)');
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    // Scene number label (drawn without rotation so text stays upright)
    if (label != null) {
      ctx.rotate(-(deg * Math.PI / 180));
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(label), 0, 1);
    }

    ctx.restore();
  }

  function _canvasToImage(e) {
    const fp = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (!fp?._renderArea) return null;
    const rect = floormapCanvas.getBoundingClientRect();
    const scaleX = floormapCanvas.width  / rect.width;
    const scaleY = floormapCanvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top)  * scaleY;
    const { dx, dy, dw, dh } = fp._renderArea;
    if (cx < dx || cx > dx + dw || cy < dy || cy > dy + dh) return null;
    return { x: (cx - dx) / dw, y: (cy - dy) / dh, cx, cy };
  }

  function _findMarkerAt(cx, cy) {
    const fp = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (!fp?._renderArea) return null;
    const { dx, dy, dw, dh } = fp._renderArea;
    const HIT = 12;
    return projectState.markers
      .filter(m => m.floorplanId === activeFloorplanId)
      .find(m => Math.hypot(cx - (dx + m.x * dw), cy - (dy + m.y * dh)) <= HIT) || null;
  }

  function _updateInfoPanel() {
    const mk = projectState.markers.find(m => m.id === selectedMarkerId);
    if (mk) {
      const sc = scenes.find(s => s.id === mk.sceneId);
      floormapInfoName.textContent  = mk.name || sc?.name || '---';
      floormapInfoScene.textContent = sc?.name || '---';
      floormapInfoDir.textContent   = (mk.rotation || 0) + '°';
      // Order cell (v2.8): click to edit inline
      const orderEl = $('floormap-info-order');
      if (orderEl) {
        orderEl.textContent = `#${mk.order || '?'}`;
        orderEl.onclick = null;
        orderEl.onclick = () => _startInfoOrderEdit(mk, orderEl);
      }
      showEl(floormapInfoPanel);
    } else {
      hideEl(floormapInfoPanel);
    }
  }

  function _startInfoOrderEdit(mk, orderEl) {
    if (orderEl.querySelector('input')) return; // already editing
    const prev = mk.order || 1;
    orderEl.textContent = '';
    const input = document.createElement('input');
    input.type = 'number'; input.min = '1'; input.max = '999';
    input.value = prev;
    input.className = 'floormap-order-input';
    orderEl.appendChild(input);
    input.focus(); input.select();
    const commit = () => {
      const ok = setMarkerOrder(mk.id, input.value);
      if (!ok) mk.order = prev;
      renderMarkerList(); renderFloormapCanvas(); _updateInfoPanel();
    };
    const cancel = () => { mk.order = prev; _updateInfoPanel(); };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter')  { e.preventDefault(); input.removeEventListener('blur', commit); commit(); }
      if (e.key === 'Escape') { input.removeEventListener('blur', commit); cancel(); }
    });
  }

  function renderMarkerList() {
    if (!activeFloorplanId) return;
    // Sort by order (v2.7)
    const markers = projectState.markers
      .filter(m => m.floorplanId === activeFloorplanId)
      .sort((a, b) => (a.order || 999) - (b.order || 999));

    const curSceneId = currentIdx >= 0 ? scenes[currentIdx]?.id : null;
    floormapMkListUl.innerHTML = '';

    if (!markers.length) {
      showEl(floormapMkListEmpty);
      return;
    }
    hideEl(floormapMkListEmpty);

    let _mkDragSrcIdx = -1;

    markers.forEach((mk, listIdx) => {
      const sc    = scenes.find(s => s.id === mk.sceneId);
      const isCur = mk.sceneId === curSceneId;
      const isSel = mk.id === selectedMarkerId;
      const li    = document.createElement('li');
      li.className = 'floormap-mk-list-item'
        + (isCur ? ' current-scene' : '')
        + (isSel ? ' active' : '');
      li.draggable = true;
      li.dataset.mkid = mk.id;

      // Drag handle (v2.9)
      const handleEl = document.createElement('div');
      handleEl.className = 'floormap-mk-drag-handle';
      handleEl.textContent = '⠿';
      handleEl.title = 'ドラッグして並び替え';

      // Order number chip — single click to edit (v2.8)
      const numEl = document.createElement('div');
      numEl.className = 'floormap-mk-list-num';
      numEl.textContent = mk.order || (listIdx + 1);
      numEl.title = 'クリックして番号を変更';
      numEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (numEl.querySelector('input')) return;
        const prev = mk.order || (listIdx + 1);
        numEl.textContent = '';
        const input = document.createElement('input');
        input.type = 'number'; input.min = '1'; input.max = '999';
        input.value = prev;
        input.className = 'floormap-order-input';
        numEl.appendChild(input);
        input.focus(); input.select();
        const commit = () => {
          const ok = setMarkerOrder(mk.id, input.value);
          if (!ok) mk.order = prev;
          renderMarkerList(); renderFloormapCanvas(); _updateInfoPanel();
        };
        const cancel = () => { mk.order = prev; renderMarkerList(); };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter')  { ev.preventDefault(); input.removeEventListener('blur', commit); commit(); }
          if (ev.key === 'Escape') { input.removeEventListener('blur', commit); cancel(); }
        });
      });

      const textEl = document.createElement('div');
      textEl.className = 'floormap-mk-list-text';
      const nameEl = document.createElement('div');
      nameEl.className = 'floormap-mk-list-name';
      nameEl.textContent = mk.name || sc?.name || '---';
      const sceneEl = document.createElement('div');
      sceneEl.className = 'floormap-mk-list-scene';
      sceneEl.textContent = sc?.name || '---';
      textEl.appendChild(nameEl);
      textEl.appendChild(sceneEl);

      const dirEl = document.createElement('div');
      dirEl.className = 'floormap-mk-list-dir';
      dirEl.textContent = (mk.rotation || 0) + '°';

      li.appendChild(handleEl);
      li.appendChild(numEl);
      li.appendChild(textEl);
      li.appendChild(dirEl);

      // Row click: navigate to scene (but not when clicking num/handle)
      li.addEventListener('click', (e) => {
        if (e.target === numEl || numEl.contains(e.target)) return;
        if (e.target === handleEl) return;
        selectedMarkerId = mk.id;
        const idx = scenes.findIndex(s => s.id === mk.sceneId);
        if (idx >= 0) switchToScene(idx);
        renderFloormapCanvas();
        _updateInfoPanel();
        renderMarkerList();
      });

      // Drag & drop for reordering (v2.9)
      li.addEventListener('dragstart', (e) => {
        _mkDragSrcIdx = listIdx;
        li.classList.add('mk-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', mk.id);
      });
      li.addEventListener('dragend', () => {
        _mkDragSrcIdx = -1;
        floormapMkListUl.querySelectorAll('.mk-drop-before,.mk-drop-after,.mk-dragging')
          .forEach(el => el.classList.remove('mk-drop-before', 'mk-drop-after', 'mk-dragging'));
      });
      li.addEventListener('dragover', (e) => {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        if (_mkDragSrcIdx === listIdx) return;
        floormapMkListUl.querySelectorAll('.mk-drop-before,.mk-drop-after')
          .forEach(el => { if (el !== li) el.classList.remove('mk-drop-before', 'mk-drop-after'); });
        const mid = li.getBoundingClientRect().top + li.getBoundingClientRect().height / 2;
        if (e.clientY < mid) { li.classList.add('mk-drop-before'); li.classList.remove('mk-drop-after'); }
        else                  { li.classList.add('mk-drop-after');  li.classList.remove('mk-drop-before'); }
      });
      li.addEventListener('dragleave', () => li.classList.remove('mk-drop-before', 'mk-drop-after'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('mk-drop-before', 'mk-drop-after');
        if (_mkDragSrcIdx < 0 || _mkDragSrcIdx === listIdx) return;
        const isBefore = e.clientY < li.getBoundingClientRect().top + li.getBoundingClientRect().height / 2;
        let insertAt = isBefore ? listIdx : listIdx + 1;
        if (_mkDragSrcIdx < insertAt) insertAt--;
        // Reorder: remove from src, insert at dest
        const moved = markers.splice(_mkDragSrcIdx, 1)[0];
        markers.splice(insertAt, 0, moved);
        // Re-sequence orders 1,2,3...
        markers.forEach((m, i) => { m.order = i + 1; });
        renderMarkerList(); renderFloormapCanvas();
        showToast('マーカーを並び替えました');
      });

      floormapMkListUl.appendChild(li);
    });
  }

  // ============================================================
  // FloorMap pin right-click context menu (v2.9)
  // ============================================================
  let _ctxMenuEl = null;

  function _closeCtxMenu() {
    if (_ctxMenuEl) { _ctxMenuEl.remove(); _ctxMenuEl = null; }
    document.removeEventListener('click',   _closeCtxMenu);
    document.removeEventListener('keydown', _ctxMenuKey);
  }
  function _ctxMenuKey(e) { if (e.key === 'Escape') _closeCtxMenu(); }

  floormapCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    _closeCtxMenu();
    const fp = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (!fp?._renderArea) return;
    const rect = floormapCanvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (floormapCanvas.width  / rect.width);
    const cy = (e.clientY - rect.top)  * (floormapCanvas.height / rect.height);
    const mk = _findMarkerAt(cx, cy);
    if (!mk) return;

    // Build sorted list for prev/next
    const fpMarkers = projectState.markers
      .filter(m => m.floorplanId === activeFloorplanId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const mkPos = fpMarkers.findIndex(m => m.id === mk.id);

    const menu = document.createElement('div');
    menu.className = 'mk-ctx-menu';
    _ctxMenuEl = menu;

    const items = [
      { label: '↑ 番号を前へ', disabled: mkPos <= 0, action: () => {
        const prev = fpMarkers[mkPos - 1];
        [mk.order, prev.order] = [prev.order, mk.order];
        renderMarkerList(); renderFloormapCanvas();
      }},
      { label: '↓ 番号を後ろへ', disabled: mkPos >= fpMarkers.length - 1, action: () => {
        const next = fpMarkers[mkPos + 1];
        [mk.order, next.order] = [next.order, mk.order];
        renderMarkerList(); renderFloormapCanvas();
      }},
      { label: '🔢 番号を変更', action: () => {
        selectedMarkerId = mk.id;
        _updateInfoPanel(); renderMarkerList();
        // Trigger edit on info panel order cell
        const orderEl = $('floormap-info-order');
        if (orderEl) setTimeout(() => _startInfoOrderEdit(mk, orderEl), 50);
      }},
      { label: '✏ 名称変更', action: () => {
        selectedMarkerId = mk.id;
        _updateInfoPanel();
        setTimeout(() => floormapRenameBtn.click(), 50);
      }},
      { label: '× 削除', danger: true, action: () => {
        selectedMarkerId = mk.id;
        deleteSelectedMarker();
      }},
    ];

    items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'mk-ctx-item' + (item.danger ? ' mk-ctx-danger' : '');
      btn.textContent = item.label;
      if (item.disabled) btn.disabled = true;
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        _closeCtxMenu();
        if (!item.disabled) item.action();
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    // Position: avoid clipping
    const mw = 160, mh = items.length * 28 + 8;
    let left = e.clientX, top = e.clientY;
    if (left + mw > window.innerWidth)  left = window.innerWidth  - mw - 4;
    if (top  + mh > window.innerHeight) top  = window.innerHeight - mh - 4;
    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';

    setTimeout(() => {
      document.addEventListener('click',   _closeCtxMenu, { once: true });
      document.addEventListener('keydown', _ctxMenuKey);
    }, 0);
  });

  // FloorMap canvas events
  floormapCanvas.addEventListener('mousedown', (e) => {
    if (isPlacementMode) return;
    const fp = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (!fp?._renderArea) return;
    const rect = floormapCanvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (floormapCanvas.width  / rect.width);
    const cy = (e.clientY - rect.top)  * (floormapCanvas.height / rect.height);
    const mk = _findMarkerAt(cx, cy);
    if (mk) {
      isDraggingMarker = true; _dragMarkerId = mk.id;
      selectedMarkerId = mk.id;
      floormapCanvas.style.cursor = 'grabbing';
      // Switch to that scene on click (not drag)
      _markerClickX = e.clientX; _markerClickY = e.clientY;
    } else {
      selectedMarkerId = null;
    }
    renderFloormapCanvas(); _updateInfoPanel(); renderMarkerList();
  });

  let _markerClickX = 0, _markerClickY = 0;

  floormapCanvas.addEventListener('mousemove', (e) => {
    // Tooltip hover
    if (!isDraggingMarker) {
      const fp = projectState.floorplans.find(f => f.id === activeFloorplanId);
      if (fp?._renderArea) {
        const rect = floormapCanvas.getBoundingClientRect();
        const sx = floormapCanvas.width  / rect.width;
        const sy = floormapCanvas.height / rect.height;
        const cx = (e.clientX - rect.left) * sx;
        const cy = (e.clientY - rect.top)  * sy;
        const hovered = _findMarkerAt(cx, cy);
        if (hovered) {
          const sc = scenes.find(s => s.id === hovered.sceneId);
          const ttName  = hovered.name || sc?.name || '';
          const ttScene = sc?.name || '';
          floormapTooltip.innerHTML = `<strong>${_esc(ttName)}</strong>${ttScene && ttScene !== ttName ? '<br>' + _esc(ttScene) : ''}`;
          const bodyRect = floormapBody.getBoundingClientRect();
          floormapTooltip.style.left = (e.clientX - bodyRect.left + 12) + 'px';
          floormapTooltip.style.top  = (e.clientY - bodyRect.top  - 32) + 'px';
          showEl(floormapTooltip);
        } else {
          hideEl(floormapTooltip);
        }
      }
    }
    // Drag marker
    if (!isDraggingMarker || !_dragMarkerId) return;
    const fp2 = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (!fp2?._renderArea) return;
    const coords = _canvasToImage(e);
    if (!coords) return;
    const mk = projectState.markers.find(m => m.id === _dragMarkerId);
    if (mk) { mk.x = coords.x; mk.y = coords.y; renderFloormapCanvas(); }
  });

  floormapCanvas.addEventListener('mouseleave', () => {
    hideEl(floormapTooltip);
  });

  floormapCanvas.addEventListener('mouseup', (e) => {
    if (isDraggingMarker) {
      // If barely moved = click → navigate to scene
      const dist = Math.hypot(e.clientX - _markerClickX, e.clientY - _markerClickY);
      if (dist < 5 && _dragMarkerId) {
        const mk = projectState.markers.find(m => m.id === _dragMarkerId);
        if (mk) {
          const idx = scenes.findIndex(s => s.id === mk.sceneId);
          if (idx >= 0) switchToScene(idx);
        }
      }
      isDraggingMarker = false; _dragMarkerId = null;
      floormapCanvas.style.cursor = isPlacementMode ? 'crosshair' : 'default';
      _updateInfoPanel(); renderMarkerList();
    }
  });

  floormapCanvas.addEventListener('click', (e) => {
    if (!isPlacementMode) {
      // In non-placement mode, click on marker is handled by mouseup; but check if
      // clicked on empty area to deselect — already handled in mousedown.
      return;
    }
    if (currentIdx < 0 || !scenes.length) { showToast('シーンを選択してください'); return; }

    // Check if clicked on an existing marker → navigate to that scene
    const fp2 = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (fp2?._renderArea) {
      const rect2 = floormapCanvas.getBoundingClientRect();
      const cx2 = (e.clientX - rect2.left) * (floormapCanvas.width / rect2.width);
      const cy2 = (e.clientY - rect2.top)  * (floormapCanvas.height / rect2.height);
      const hitMk = _findMarkerAt(cx2, cy2);
      if (hitMk) {
        const idx = scenes.findIndex(s => s.id === hitMk.sceneId);
        if (idx >= 0) switchToScene(idx);
        selectedMarkerId = hitMk.id;
        renderFloormapCanvas(); _updateInfoPanel();
        return;
      }
    }

    const coords = _canvasToImage(e);
    if (!coords) return;
    const curScene = scenes[currentIdx];
    // Use current yaw (theta) as initial rotation; snap to 15° increments
    const initialRot = Math.round(thetaToFloorRotation(theta, curScene.flipH || false) / 15) * 15 % 360;
    let mk = projectState.markers.find(m => m.floorplanId === activeFloorplanId && m.sceneId === curScene.id);
    const isNew = !mk;
    if (mk) {
      mk.x = coords.x; mk.y = coords.y; mk.rotation = initialRot;
    } else {
      mk = { id: genId(), floorplanId: activeFloorplanId, sceneId: curScene.id,
             x: coords.x, y: coords.y, rotation: initialRot, name: curScene.name,
             order: _nextMarkerOrder() };
      projectState.markers.push(mk);
    }
    // Auto-associate scene with current floor plan
    curScene.floorplanId = activeFloorplanId;
    selectedMarkerId = mk.id;
    renderFloormapCanvas();
    _updateInfoPanel();
    renderMarkerList();
    renderSceneList();
    renderSceneFilterBar();
    if (isNew) renderDashboard();
    showToast(`「${curScene.name}」のマーカーを配置しました（向き: ${initialRot}°）`);
  });

  function togglePlacementMode() {
    isPlacementMode = !isPlacementMode;
    floormapPlaceBtn.classList.toggle('active', isPlacementMode);
    floormapCanvas.classList.toggle('placement-mode', isPlacementMode);
    floormapPlaceHint.style.display = isPlacementMode ? '' : 'none';
    if (isPlacementMode) showToast('マーカー配置モード: 平面図をクリックして配置');
  }

  function toggleFloormapCollapse() {
    isFloormapCollapsed = !isFloormapCollapsed;
    floormapNavigator.classList.toggle('collapsed', isFloormapCollapsed);
    floormapToggleBtn.textContent = isFloormapCollapsed ? '+' : '−';
    floormapToggleBtn.title = isFloormapCollapsed ? '展開する' : '折りたたむ';
  }

  function toggleFloormapExpand() {
    isFloormapExpanded = !isFloormapExpanded;
    floormapNavigator.classList.toggle('expanded', isFloormapExpanded);
    requestAnimationFrame(() => {
      const w = floormapBody.clientWidth;
      const h = floormapBody.clientHeight;
      if (w > 0 && h > 0) { floormapCanvas.width = w; floormapCanvas.height = h; }
      renderFloormapCanvas();
    });
  }

  function rotateSelectedMarker(delta) {
    const mk = projectState.markers.find(m => m.id === selectedMarkerId);
    if (!mk) return;
    mk.rotation = ((mk.rotation || 0) + delta + 360) % 360;
    renderFloormapCanvas(); _updateInfoPanel(); renderMarkerList();
  }

  function deleteSelectedMarker() {
    if (!selectedMarkerId) return;
    const mk = projectState.markers.find(m => m.id === selectedMarkerId);
    if (mk) {
      const sceneId = mk.sceneId;
      projectState.markers = projectState.markers.filter(m => m.id !== selectedMarkerId);
      // If scene has no more markers, clear its floorplanId
      const scene = scenes.find(s => s.id === sceneId);
      if (scene && !isScenePlaced(scene)) scene.floorplanId = null;
    }
    selectedMarkerId = null;
    renderFloormapCanvas(); _updateInfoPanel(); renderMarkerList();
    renderSceneList(); renderSceneFilterBar(); renderDashboard();
    showToast('マーカーを削除しました');
  }

  // FloorMap size presets
  const FM_LS_KEY = 'archview360.floormapWidth';
  function _applyFloormapWidth(w) {
    floormapNavigator.style.width = w + 'px';
    // Resize canvas to fit new body width
    requestAnimationFrame(() => {
      const bw = floormapBody.clientWidth;
      const bh = floormapBody.clientHeight;
      if (bw > 0 && bh > 0) { floormapCanvas.width = bw; floormapCanvas.height = bh; }
      renderFloormapCanvas();
    });
  }

  floormapNavigator.querySelectorAll('.floormap-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = parseInt(btn.dataset.size, 10);
      _applyFloormapWidth(w);
      try { localStorage.setItem(FM_LS_KEY, w); } catch {}
    });
  });

  // Restore saved width
  try {
    const saved = parseInt(localStorage.getItem(FM_LS_KEY), 10);
    if (saved >= 240 && saved <= 700) floormapNavigator.style.width = saved + 'px';
  } catch {}

  // Drag resize handle (top edge → resize height of floormap-body)
  const floormapResizeHandle     = document.getElementById('floormap-resize-handle');
  const floormapResizeHandleLeft = document.getElementById('floormap-resize-handle-left');
  let _fmResizing = false, _fmResizeStartY = 0, _fmResizeStartH = 0;
  floormapResizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    _fmResizing = true;
    _fmResizeStartY = e.clientY;
    _fmResizeStartH = floormapBody.clientHeight;
    document.addEventListener('mousemove', _fmResizeMove);
    document.addEventListener('mouseup',   _fmResizeUp);
  });
  function _fmResizeMove(e) {
    if (!_fmResizing) return;
    const dy = _fmResizeStartY - e.clientY; // dragging up increases height
    const newH = Math.max(100, Math.min(window.innerHeight * 0.7, _fmResizeStartH + dy));
    floormapBody.style.height = newH + 'px';
    floormapCanvas.width  = floormapBody.clientWidth;
    floormapCanvas.height = newH;
    renderFloormapCanvas();
  }
  function _fmResizeUp() {
    _fmResizing = false;
    document.removeEventListener('mousemove', _fmResizeMove);
    document.removeEventListener('mouseup',   _fmResizeUp);
    try { localStorage.setItem('archview360.floormapHeight', floormapBody.clientHeight); } catch {}
  }

  // Drag resize handle (left edge → resize width)
  let _fmResizingW = false, _fmResizeStartX = 0, _fmResizeStartW = 0;
  floormapResizeHandleLeft.addEventListener('mousedown', (e) => {
    e.preventDefault();
    _fmResizingW = true;
    _fmResizeStartX = e.clientX;
    _fmResizeStartW = floormapNavigator.offsetWidth;
    document.addEventListener('mousemove', _fmResizeMoveW);
    document.addEventListener('mouseup',   _fmResizeUpW);
  });
  function _fmResizeMoveW(e) {
    if (!_fmResizingW) return;
    const dx = _fmResizeStartX - e.clientX; // dragging left increases width
    const newW = Math.max(240, Math.min(window.innerWidth * 0.85, _fmResizeStartW + dx));
    floormapNavigator.style.width = newW + 'px';
    requestAnimationFrame(() => {
      const bw = floormapBody.clientWidth;
      const bh = floormapBody.clientHeight;
      if (bw > 0 && bh > 0) { floormapCanvas.width = bw; floormapCanvas.height = bh; }
      renderFloormapCanvas();
    });
  }
  function _fmResizeUpW() {
    _fmResizingW = false;
    document.removeEventListener('mousemove', _fmResizeMoveW);
    document.removeEventListener('mouseup',   _fmResizeUpW);
    try { localStorage.setItem(FM_LS_KEY, floormapNavigator.offsetWidth); } catch {}
  }

  // Restore saved height
  try {
    const savedH = parseInt(localStorage.getItem('archview360.floormapHeight'), 10);
    if (savedH >= 100) floormapBody.style.height = savedH + 'px';
  } catch {}

  // FloorMap button wiring
  floormapOrientL.addEventListener('click', () => _adjustOrientOffset(-15));
  floormapOrientR.addEventListener('click', () => _adjustOrientOffset(+15));
  floormapOrientPreset.addEventListener('change', () => {
    const fp = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (!fp) return;
    fp.rotationOffset = parseInt(floormapOrientPreset.value, 10);
    floormapOrientVal.textContent = `${fp.rotationOffset}°`;
    renderFloormapCanvas();
  });
  function _adjustOrientOffset(delta) {
    const fp = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (!fp) return;
    fp.rotationOffset = ((fp.rotationOffset || 0) + delta + 360) % 360;
    floormapOrientVal.textContent = `${fp.rotationOffset}°`;
    floormapOrientPreset.value = String(fp.rotationOffset);
    renderFloormapCanvas();
  }
  floormapPlaceBtn.addEventListener('click', togglePlacementMode);
  floormapToggleBtn.addEventListener('click', toggleFloormapCollapse);
  $('floormap-reseq-btn')?.addEventListener('click', resequenceMarkers);
  floormapRotL.addEventListener('click', () => rotateSelectedMarker(-15));
  floormapRotR.addEventListener('click', () => rotateSelectedMarker(+15));
  floormapDelMk.addEventListener('click', deleteSelectedMarker);

  // Rename button: make info-name div editable
  floormapRenameBtn.addEventListener('click', () => {
    floormapInfoName.contentEditable = 'true';
    floormapInfoName.focus();
    const r = document.createRange();
    r.selectNodeContents(floormapInfoName);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(r);
  });
  floormapInfoName.addEventListener('dblclick', () => {
    floormapInfoName.contentEditable = 'true';
    floormapInfoName.focus();
    const r = document.createRange();
    r.selectNodeContents(floormapInfoName);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(r);
  });
  floormapInfoName.addEventListener('blur', () => {
    floormapInfoName.contentEditable = 'false';
    const mk = projectState.markers.find(m => m.id === selectedMarkerId);
    if (mk) {
      const trimmed = floormapInfoName.textContent.trim();
      if (trimmed) mk.name = trimmed;
      floormapInfoName.textContent = mk.name || '';
      renderMarkerList();
    }
  });
  floormapInfoName.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); floormapInfoName.blur(); }
    if (e.key === 'Escape') { floormapInfoName.contentEditable = 'false'; _updateInfoPanel(); }
  });

  // Floor plan file input
  addFloorplanBtn.addEventListener('click', () => floorplanInput.click());
  floorplanInput.addEventListener('change', () => {
    if (floorplanInput.files.length) handleFloorplanFiles(floorplanInput.files);
    floorplanInput.value = '';
  });

  // Group picker add button wiring
  const groupPickerInput  = $('group-picker-input');
  const groupPickerAddBtn = $('group-picker-add-btn');
  groupPickerAddBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const name = groupPickerInput.value.trim();
    if (!name) return;
    const group = { id: genId(), name };
    projectState.groups.push(group);
    if (_groupPickerSceneIdx >= 0 && scenes[_groupPickerSceneIdx]) {
      scenes[_groupPickerSceneIdx].groupId = group.id;
    }
    groupPickerInput.value = '';
    closeGroupPicker();
    renderSceneList();
    renderDashboard();
  });
  groupPickerInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); groupPickerAddBtn.click(); }
    if (e.key === 'Escape') { e.stopPropagation(); closeGroupPicker(); }
  });
  groupPickerInput.addEventListener('click', (e) => e.stopPropagation());

  // ============================================================
  // Project Info Modal (v2.5)
  // ============================================================
  function openProjectInfoModal() {
    $('pi-name').value   = projectState.projectName || '';
    $('pi-client').value = projectState.projectInfo.client || '';
    $('pi-author').value = projectState.projectInfo.author || '';
    $('pi-date').value   = projectState.projectInfo.date   || '';
    $('pi-notes').value  = projectState.projectInfo.notes  || '';
    showEl($('project-info-modal'));
  }

  function closeProjectInfoModal() { hideEl($('project-info-modal')); }

  function saveProjectInfo() {
    const name = $('pi-name').value.trim();
    if (name) projectState.projectName = name;
    projectState.projectInfo.client = $('pi-client').value.trim();
    projectState.projectInfo.author = $('pi-author').value.trim();
    projectState.projectInfo.date   = $('pi-date').value;
    projectState.projectInfo.notes  = $('pi-notes').value.trim();
    closeProjectInfoModal();
    showToast('プロジェクト情報を保存しました');
  }

  $('project-info-btn').addEventListener('click', openProjectInfoModal);
  $('pi-close-btn').addEventListener('click',  closeProjectInfoModal);
  $('pi-cancel-btn').addEventListener('click', closeProjectInfoModal);
  $('pi-save-btn').addEventListener('click',   saveProjectInfo);
  $('project-info-modal').addEventListener('click', (e) => {
    if (e.target === $('project-info-modal')) closeProjectInfoModal();
  });

  // ============================================================
  // JSON Export
  // ============================================================
  function exportProjectJSON() {
    const data = {
      appVersion:  '2.7',
      exportedAt:  new Date().toISOString(),
      projectName: projectState.projectName,
      projectInfo: { ...projectState.projectInfo },
      scenes: scenes.map(s => ({
        id:          s.id,
        name:        s.name,
        fileName:    s.fileName || `${s.name}.jpg`,
        flipped:     s.flipH || false,
        floorplanId: s.floorplanId || null,
        groupId:     s.groupId     || null,
      })),
      groups: projectState.groups.map(g => ({ ...g })),
      floorplans: projectState.floorplans.map(f => ({
        id:             f.id,
        name:           f.name,
        fileName:       f.fileName,
        rotationOffset: f.rotationOffset || 0,
      })),
      markers: projectState.markers.map((m, i) => ({ ...m, order: m.order || (i + 1) })),
      compareSets: _loadCompareSets(),
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'archview360-project.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('プロジェクトをJSONとして書き出しました（画像データは含まれません）');
  }

  // ============================================================
  // JSON Import
  // ============================================================
  function openImportJSON() { jsonImportInput.click(); }

  jsonImportInput.addEventListener('change', () => {
    const f = jsonImportInput.files[0];
    if (!f) return;
    jsonImportInput.value = '';
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        _importData = JSON.parse(e.target.result);
        _showImportModal();
      } catch {
        showGlobalError('JSONファイルの解析に失敗しました。');
      }
    };
    reader.readAsText(f);
  });

  function _showImportModal() {
    if (!_importData) return;
    const sceneFiles = (_importData.scenes     || []).map(s => s.fileName);
    const fpFiles    = (_importData.floorplans || []).map(f => f.fileName);
    const sceneCount = _importData.scenes?.length     || 0;
    const fpCount    = _importData.floorplans?.length || 0;
    const mkCount    = _importData.markers?.length    || 0;
    const csCount    = _importData.compareSets?.length || 0;
    const totalFiles = sceneFiles.length + fpFiles.length;

    const panoList = sceneFiles.map(fn =>
      `<li class="import-file-item"><span class="import-file-cat">🖼️</span>${_esc(fn)}</li>`
    ).join('');
    const fpList = fpFiles.map(fn =>
      `<li class="import-file-item"><span class="import-file-cat">🗺️</span>${_esc(fn)}</li>`
    ).join('');

    importModalBody.innerHTML =
      `<div class="import-summary">` +
        `<span class="import-badge">シーン ${sceneCount}</span>` +
        `<span class="import-badge">平面図 ${fpCount}</span>` +
        `<span class="import-badge">マーカー ${mkCount}</span>` +
        `<span class="import-badge">比較セット ${csCount}</span>` +
      `</div>` +
      `<p class="import-files-label">必要な画像ファイル（合計 ${totalFiles} 件）— 同名ファイルを選択してください</p>` +
      `<ul class="import-files-list">` +
        (panoList || `<li class="import-file-item import-file-none">パノラマ画像なし</li>`) +
        (fpList   || '') +
      `</ul>` +
      `<p class="import-note">ℹ️ JSONには画像データが含まれません。ファイル名が完全一致したものだけ復元されます。別PCで復元するには画像ファイル一式が必要です。</p>`;

    importUploadBtn.textContent = '画像ファイルを選択して復元';
    showEl(importModal);
  }

  function _doImportWithFiles(fileList) {
    if (!_importData) return;
    const fileMap = {};
    Array.from(fileList).forEach(f => { fileMap[f.name] = f; });

    // Restore groups (v2.5) — before scenes so groupId references work
    const importedGroups = _importData.groups || [];
    const existingGroupIds = new Set(projectState.groups.map(g => g.id));
    importedGroups.forEach(g => {
      if (!existingGroupIds.has(g.id)) projectState.groups.push({ id: g.id, name: g.name });
    });

    // Restore scenes
    let restoredScenes = 0;
    const newScenes = [];
    (_importData.scenes || []).forEach(sd => {
      const file = fileMap[sd.fileName];
      if (!file) return;
      const blobUrl = URL.createObjectURL(file);
      const scene = {
        id: sd.id, name: sd.name, fileName: sd.fileName, blobUrl,
        flipH: sd.flipped || false, thumbUrl: null,
        floorplanId: sd.floorplanId || null, // v2.5
        groupId:     sd.groupId     || null, // v2.5
      };
      newScenes.push(scene);
      restoredScenes++;
      generateThumb(blobUrl, (dataUrl) => { scene.thumbUrl = dataUrl; renderSceneList(); });
    });

    // Restore floor plans
    let restoredFPs = 0;
    const newFPs = [];
    (_importData.floorplans || []).forEach(fd => {
      const file = fileMap[fd.fileName];
      if (!file) return;
      const blobUrl = URL.createObjectURL(file);
      const imgEl   = new Image();
      imgEl.onload  = () => renderFloormapCanvas();
      imgEl.src     = blobUrl;
      newFPs.push({ id: fd.id, name: fd.name, fileName: fd.fileName, blobUrl, imgEl, rotationOffset: fd.rotationOffset || 0 });
      restoredFPs++;
    });

    // Apply
    if (newScenes.length) {
      const wasEmpty = !scenes.length;
      scenes.push(...newScenes);
      if (wasEmpty) {
        showViewerLayout(); initThree();
        requestAnimationFrame(() => { fitSingleCanvas(); switchToScene(0); });
        renderCompareSets();
      } else {
        renderSceneList(); updateCompareBtns();
      }
    }

    if (newFPs.length) {
      projectState.floorplans.push(...newFPs);
      if (!activeFloorplanId) activeFloorplanId = newFPs[0].id;
      renderFloorplanList();
    }

    // Markers — use restored scene/FP IDs (JSON IDs preserved)
    const validSceneIds = new Set(scenes.map(s => s.id));
    const validFpIds    = new Set(projectState.floorplans.map(f => f.id));
    // Build scene lookup for name fallback
    const sceneNameById = {};
    [...scenes, ...newScenes].forEach(s => { sceneNameById[s.id] = s.name; });

    const newMarkers = (_importData.markers || []).filter(m =>
      validSceneIds.has(m.sceneId) && validFpIds.has(m.floorplanId)
    ).map((m, i) => ({
      ...m,
      name:  m.name  || sceneNameById[m.sceneId] || '',
      order: m.order || (i + 1), // auto-fill order for old JSON (v2.7)
    }));
    // Merge: remove existing markers with same id, then push new
    const newMarkerIds = new Set(newMarkers.map(m => m.id));
    projectState.markers = [
      ...projectState.markers.filter(m => !newMarkerIds.has(m.id)),
      ...newMarkers,
    ];
    const restoredMk = newMarkers.length;

    // Compare sets
    let restoredCs = 0;
    if (_importData.compareSets?.length) {
      _saveCompareSetsToStorage(_importData.compareSets);
      restoredCs = _importData.compareSets.length;
      setTimeout(() => renderCompareSets(), 0);
    }

    if (_importData.projectName) projectState.projectName = _importData.projectName;
    // Restore project info (v2.5)
    if (_importData.projectInfo) {
      projectState.projectInfo = { ...projectState.projectInfo, ..._importData.projectInfo };
    }

    // Rebuild scene.floorplanId from markers (v2.7: marker-based source of truth)
    scenes.forEach(s => {
      const mk = projectState.markers.find(m => m.sceneId === s.id);
      if (mk) s.floorplanId = mk.floorplanId;
      else if (!projectState.floorplans.some(f => f.id === s.floorplanId)) s.floorplanId = null;
    });

    renderFloormap();
    renderSceneFilterBar();
    renderDashboard();
    hideEl(importModal);
    _importData = null;
    showToast(`復元完了: シーン ${restoredScenes} / 平面図 ${restoredFPs} / マーカー ${restoredMk} / 比較セット ${restoredCs}`);
  }

  // Import modal wiring
  importCloseBtn.addEventListener('click',  () => { hideEl(importModal); _importData = null; });
  importCancelBtn.addEventListener('click', () => { hideEl(importModal); _importData = null; });
  importUploadBtn.addEventListener('click', () => importImagesInput.click());
  importImagesInput.addEventListener('change', () => {
    if (importImagesInput.files.length) _doImportWithFiles(importImagesInput.files);
    importImagesInput.value = '';
  });
  importModal.addEventListener('click', (e) => {
    if (e.target === importModal) { hideEl(importModal); _importData = null; }
  });

  // ============================================================
  // Viewer Drag & Drop (add while viewing)
  // ============================================================
  const viewerWrapEl = viewerLayout.querySelector('.viewer-wrap');

  viewerWrapEl.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes?.('Files')) return;
    e.preventDefault(); e.stopPropagation();
    viewerDragCounter++;
    if (viewerDragCounter === 1) showEl(viewerDropOverlay);
  });

  viewerWrapEl.addEventListener('dragleave', (e) => {
    if (!e.dataTransfer?.types?.includes?.('Files')) return;
    viewerDragCounter = Math.max(0, viewerDragCounter - 1);
    if (viewerDragCounter === 0) hideEl(viewerDropOverlay);
  });

  viewerWrapEl.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types?.includes?.('Files')) return;
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  });

  viewerWrapEl.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.types?.includes?.('Files')) return;
    e.preventDefault(); e.stopPropagation();
    viewerDragCounter = 0; hideEl(viewerDropOverlay);
    handleFiles(e.dataTransfer.files); // always adds, never replaces
  });

  // ============================================================
  // Ctrl + O shortcut (add images while viewing)
  // ============================================================
  document.addEventListener('keydown', (e) => {
    if (e.key === 'o' && e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault(); fileInput.click();
    }
  });

  exportJsonBtn.addEventListener('click', exportProjectJSON);
  importJsonBtn.addEventListener('click', openImportJSON);

  // Upload-page "設定JSONから開く" button
  const openJsonBtn = document.getElementById('open-json-btn');
  if (openJsonBtn) openJsonBtn.addEventListener('click', openImportJSON);

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
