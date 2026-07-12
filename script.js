'use strict';

/* ============================================================
 * ArchView360
 * Three.js 0.169.0 ローカル同梱
 * （vendor/three.module.min.js + vendor/three-global.js シム経由で
 *   window.THREE として公開される。WebXR-Sandbox 実機検証と同一バージョン）
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
  const exportPackageBtn   = $('export-package-btn');
  const importPackageBtn   = $('import-package-btn');

  // Floor plan file input & JSON inputs
  const floorplanInput     = $('floorplan-input');
  const jsonImportInput    = $('json-import-input');
  const importImagesInput  = $('import-images-input');
  const replaceSceneInput  = $('replace-scene-input');
  const zipImportInput     = $('zip-import-input');

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

  // Quick help modal (v2.9.4)
  const quickHelpBtn       = $('quick-help-btn');
  const quickHelpModal     = $('quick-help-modal');
  const quickHelpCloseBtn  = $('quick-help-close-btn');
  const quickHelpOkBtn     = $('quick-help-ok-btn');

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
  // v2.16: renderer.setAnimationLoop(renderLoop) が設定済みかどうか。
  // 旧 rAF ループ（animFrameId）は廃止 — WebXR-Sandbox と同じく単一の
  // setAnimationLoop が通常表示と VR の両方を駆動する。
  let animLoopActive = false;

  // ---- WebXR / VR (v2.10) ----
  const vrBtn = $('vr-btn');
  let xrSupported  = false; // navigator.xr.isSessionSupported('immersive-vr') result
  let xrSession    = null;
  let inVrSession  = false;
  let autoRotateWasOnBeforeVr = false;

  // ---- VR HUD & Controller Navigation (v2.16 — WebXR-Sandbox runtime port) ----
  // Transient, VR-session-local only — never persisted to project JSON/ZIP.
  //
  // v2.16 stops layering incremental fixes and instead ports the VR runtime
  // verified working on Meta Quest 3 / Quest Browser in the WebXR-Sandbox
  // project as one unit:
  //   - three.js 0.169.0 — the exact version the Sandbox was verified with.
  //     The old vendored r128 (2021) was the largest untested difference
  //     between the two codebases and is replaced wholesale.
  //   - Renderer: renderer.xr.enabled = true for the renderer's whole
  //     lifetime (Sandbox sets it once at init), never toggled per session.
  //   - Loop: a single renderer.setAnimationLoop(renderLoop) drives both
  //     normal and VR rendering. No rAF↔XR-loop swapping on session
  //     start/end — three.js internally moves the loop onto the XR
  //     session's requestAnimationFrame while presenting.
  //   - HUD attachment: "camera-forward" as actually implemented in the
  //     Sandbox — the HUD mesh is a *child of the main camera*, and the
  //     camera itself is part of the scene graph (threeScene.add(camera)).
  //     v2.15 misported this as a world-positioned mesh repositioned every
  //     frame from the camera pose; that variant was never verified on
  //     hardware and is removed.
  //   - Input: session.inputSources polled once per frame, reading
  //     gamepad.buttons directly and edge-detecting the false→true
  //     transition (Sandbox-verified). No controller
  //     'selectstart'/'squeezestart' event listeners — those did not fire
  //     reliably on Quest 3 hardware in v2.13/v2.13.1 real-device testing.
  let vrHudVisible = true;
  let vrHudMesh = null, vrHudCanvas = null, vrHudCtx = null, vrHudTexture = null;
  let vrDebugDetailed = false; // Left Y (button[5]): simple <-> detailed debug panel
  let vrLastInputAt = 0;
  const VR_INPUT_COOLDOWN_MS = 400; // within the 300-500ms range from Sandbox findings
  // Per-gamepad previous-button-state, keyed by the gamepad object itself
  // (stable while a controller stays connected; WeakMap avoids manual cleanup).
  const vrPrevButtonState = new WeakMap();
  // Live debug snapshot drawn into the HUD every frame, and mirrored onto
  // the normal-screen VR Debug Log — Quest Browser has no accessible
  // DevTools mid-session. Session-local only, never persisted.
  const vrDebug = {
    inputSourceCount: 0,
    left: null,   // { hasGamepad, buttonsLength, pressedCount } | null
    right: null,
    lastAction: '-',
    nextCount: 0,
    prevCount: 0,
    hudCount: 0,
    debugCount: 0
  };
  // On-screen (non-VR) debug log so the last VR session's input state is
  // visible after removing the headset, without needing devtools. Left
  // populated after the session ends.
  const vrDebugLogEl = $('vr-debug-log');

  // ---- VR Scene Ring Navigation (v2.17) ----
  // Additive VR-only layer: the existing navigation targets (_getNavOrder(),
  // the same marker.order chain FloorMap numbering and nextScene()/prevScene()
  // use) are laid out as a ring of selectable items at equal intervals
  // around the wearer. A controller's laser pointer hovers an item and the
  // Trigger (button[0], previously reserved/unused — see _pollVrInputSources
  // comments) of the SAME hand confirms it, jumping straight to that scene.
  // This is NOT a spatial-hotspot system: project data has no per-scene 3D
  // coordinates, so ring positions are synthetic (evenly spaced) and are
  // unrelated to FloorMap pin positions. Deliberately independent of the
  // button-mapped polling above: it reads its own Trigger edge state so the
  // existing Right A/Left X/Right B/Left Y polling in _pollVrInputSources is
  // untouched. No new scene data or JSON fields. Session-local only; never
  // persisted to project JSON/ZIP.
  let vrRingGroup = null;      // THREE.Group holding the ring item sprites (VR-only, never created outside a session)
  let vrRingItems = [];        // { mesh, sceneIdx, name, normalTexture, hoverTexture, baseScale }[]
  // Hover is tracked per hand so each laser can only be confirmed by the
  // trigger of the same hand (left trigger never fires the right laser's
  // target and vice versa).
  const vrRingHovered = { left: null, right: null }; // ring item record | null
  let vrController1 = null, vrController2 = null; // renderer.xr.getController(0/1)
  let vrControllerLaser1 = null, vrControllerLaser2 = null;
  const vrRaycaster = new THREE.Raycaster();
  // Per-hand Trigger (button[0]) arm/edge state — keyed by handedness, not
  // by gamepad object identity. Starts un-armed: each hand must first be
  // observed with the trigger RELEASED once before its presses may select,
  // so the trigger squeeze that clicked the "enter VR" button (often still
  // held on the first VR frames) can never fire an immediate selection.
  // armed also drops on every selection, so re-selecting always requires a
  // release-then-press. Separate from vrPrevButtonState above, which only
  // tracks the mapped buttons (#4/#5).
  const vrRingTrigger = {
    left:  { pressed: false, armed: false },
    right: { pressed: false, armed: false }
  };
  let vrRingFadeMesh = null;       // black plane, child of camera, for a VR-native fade (DOM fade is invisible in-headset)
  let vrRingFadeState = 'idle';    // 'idle' | 'out' | 'loading' | 'in'
  let vrRingFadeAlpha = 0;
  let vrRingPendingSceneIdx = -1;
  let vrRingFadeSphereRef = null;  // `sphere` snapshot to detect when the new texture has finished loading
  let vrRingFadeLoadFrames = 0;    // safety counter while waiting for the new texture
  const VR_RING_RADIUS = 3;        // meters, fixed world coordinates (same convention the former Cube Probe used)
  const VR_RING_HEIGHT = 1.5;      // meters, near eye height
  const VR_RING_FADE_STEP = 0.06;  // per-frame opacity step (~0.3s at 60fps each way)
  const VR_RING_FADE_TIMEOUT_FRAMES = 300; // ~5s at 60fps: force fade-in if the texture never finishes loading
  const vrRingDebug = { hoveredLeft: '-', hoveredRight: '-', selectedName: '-', lastError: '-' };

  // ---- VR Scene Ring visibility toggle (v2.17.1) ----
  // VR-session-local only — reset to true every time the ring is (re)built
  // and discarded on dispose; never persisted to project JSON/ZIP. Bound to
  // Left Menu (button[12]), the only button/hand combination this project's
  // own measured Quest Touch Plus mapping (README.md / docs/vr.html —
  // "左コントローラーのMenu（button[12]）") documents as unused and
  // unambiguous (there is no measured right-hand Menu button, so there is no
  // handedness ambiguity to resolve here the way there was for Trigger).
  let vrRingEnabled = true;
  // Independent per-gamepad-object edge state for the toggle button, kept
  // separate from vrRingTrigger (Trigger, button[0]) and from
  // vrPrevButtonState (button[4]/[5]) above.
  const vrRingTogglePrevPressed = new WeakMap();

  // ---- VR Render Path ----
  // v2.16: there is only one render path — renderer.setAnimationLoop(renderLoop)
  // drives normal and VR rendering alike (renderLoop branches on inVrSession).
  // This flag is kept purely for the on-screen VR Debug Log.
  let renderMode = 'normal'; // 'normal' | 'vr'

  // ---- VR Observer Mode (v2.11) ----
  // Transient, browser-local only — never persisted to project JSON.
  const observerBtn = $('observer-btn');
  const observerPanel = $('observer-panel');
  const observerState = {
    enabled: false,
    role: null,        // 'observer' | 'viewer'
    sessionId: null,
    connected: false,
    sceneId: null,
    markerId: null,
    floorplanId: null,
    yaw: 0,            // degrees, 0-360, floor-map heading
    fov: 100,
    updatedAt: null
  };

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
    // v2.16 (WebXR-Sandbox runtime): the camera is part of the scene graph
    // so camera-parented meshes (VR HUD) are rendered — Sandbox does the
    // same (`scene.add(camera)`).
    threeScene.add(camera);
    renderer   = new THREE.WebGLRenderer({ canvas: viewerCanvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // v2.16: xr.enabled stays true for the renderer's whole lifetime
    // (Sandbox sets it once at init); harmless while no session is active.
    renderer.xr.enabled = true;

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
        file:        f, // v2.12: retained for ZIP package export
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
    // v2.13: skip the DOM fade while in VR — the overlay is invisible in-headset
    // and the 150ms delay would only postpone the texture swap.
    if (currentIdx >= 0 && currentIdx !== idx && !_fadePending && compareState.mode === 'single' && !inVrSession) {
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
    _updateObserverForScene(s);
  }

  // ---- VR Observer Mode (v2.11) ----
  function _thetaToFloorDeg(t) {
    // theta increases counter-clockwise from +X axis; floor heading is clockwise from north (0°)
    return ((90 - (t * 180 / Math.PI)) + 360) % 360;
  }

  function _updateObserverForScene(s) {
    if (!observerState.enabled) return;
    observerState.sceneId = s.id;
    const om = projectState.markers.find(m => m.sceneId === s.id);
    if (om) {
      observerState.markerId = om.id;
      observerState.floorplanId = om.floorplanId;
    } else {
      observerState.markerId = null;
      observerState.floorplanId = null;
    }
    observerState.updatedAt = Date.now();
    renderObserverPanel();
    renderFloormapCanvas();
  }

  function startObserverMode(role) {
    observerState.enabled = true;
    observerState.role = role || 'observer';
    if (!observerState.sessionId) observerState.sessionId = _genObserverSessionId();
    if (currentIdx >= 0 && scenes[currentIdx]) _updateObserverForScene(scenes[currentIdx]);
    updateObserverBtn();
    renderObserverPanel();
    showToast('Observer Modeを開始しました');
  }

  function endObserverMode() {
    observerState.enabled = false;
    observerState.role = null;
    observerState.connected = false;
    updateObserverBtn();
    renderObserverPanel();
    renderFloormapCanvas();
    showToast('Observer Modeを終了しました');
  }

  function _genObserverSessionId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${part()}-${part()}`;
  }

  function updateObserverBtn() {
    if (!observerBtn) return;
    observerBtn.classList.toggle('active', observerState.enabled);
  }

  function renderObserverPanel() {
    if (!observerPanel) return;
    const stateLabel = inVrSession ? 'VR中（追跡中）'
      : observerState.connected ? '接続中'
      : observerState.enabled ? '待機中' : '停止中';
    const scene = scenes.find(sc => sc.id === observerState.sceneId);
    const fp = projectState.floorplans.find(f => f.id === observerState.floorplanId);
    const marker = projectState.markers.find(m => m.id === observerState.markerId);

    const $val = (id) => observerPanel.querySelector('#' + id);
    if ($val('obs-state')) $val('obs-state').textContent = stateLabel;
    if ($val('obs-scene')) $val('obs-scene').textContent = scene ? scene.name : '—';
    if ($val('obs-floorplan')) $val('obs-floorplan').textContent = fp ? fp.name : '—';
    if ($val('obs-marker')) $val('obs-marker').textContent = marker ? `#${marker.order || '?'} ${marker.name || ''}`.trim() : '未配置';
    if ($val('obs-yaw')) $val('obs-yaw').textContent = `${Math.round(observerState.yaw)}°`;
    if ($val('obs-fov')) $val('obs-fov').textContent = `${Math.round(observerState.fov)}°`;
    if ($val('obs-session')) $val('obs-session').textContent = observerState.sessionId || '—';
    if ($val('obs-warning')) {
      $val('obs-warning').style.display = (observerState.enabled && observerState.sceneId && !marker) ? '' : 'none';
    }
    const startBtn = $val('obs-start-btn');
    const endBtn = $val('obs-end-btn');
    if (startBtn) startBtn.style.display = observerState.enabled ? 'none' : '';
    if (endBtn) endBtn.style.display = observerState.enabled ? '' : 'none';
  }

  let _lastObsCanvasYaw = null;
  function _observerFrameTick(yawDeg, fovDeg) {
    observerState.yaw = yawDeg;
    observerState.fov = fovDeg;
    observerState.updatedAt = Date.now();
    const yEl = observerPanel && observerPanel.querySelector('#obs-yaw');
    if (yEl) yEl.textContent = `${Math.round(yawDeg)}°`;
    // Only redraw the FloorMap canvas when the heading changed enough to matter visually
    if (_lastObsCanvasYaw === null || Math.abs(((yawDeg - _lastObsCanvasYaw + 540) % 360) - 180) > 2) {
      _lastObsCanvasYaw = yawDeg;
      if (activeFloorplanId === observerState.floorplanId) renderFloormapCanvas();
    }
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
    if (inVrSession) exitVr();
    if (observerState.enabled) endObserverMode();
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
    updateVrBtn();
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
        // three 0.169: renderer.outputColorSpace のデフォルトが sRGB のため、
        // 写真テクスチャは sRGB として明示しないと色が浅く（白っぽく）なる。
        texture.colorSpace = THREE.SRGBColorSpace;
        buildSphere(texture, flipH);
        showLoadingOverlay(false);
        // v2.13: during a VR session the XR animation loop is already rendering —
        // starting the rAF loop as well would double-render every frame.
        if (!inVrSession) startRender();
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
    // v2.13: in VR the HMD owns the camera pose — resetting phi/theta/fov here
    // would fight WebXR and visibly snap the view on in-headset scene switches.
    if (!inVrSession) resetView();
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
        texture.colorSpace = THREE.SRGBColorSpace;
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
  // Render loop (v2.16 — single setAnimationLoop, WebXR-Sandbox runtime)
  // ============================================================
  // One loop drives both normal and VR rendering, exactly like the Sandbox.
  // While an XR session is presenting, three.js internally moves
  // setAnimationLoop onto the session's requestAnimationFrame — the loop
  // itself is never swapped or torn down around session start/end.
  function renderLoop() {
    if (inVrSession) { vrFrame(); return; }

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
      if (observerState.enabled) _observerFrameTick(_thetaToFloorDeg(theta), fov);
    }
  }

  function startRender() {
    if (animLoopActive) return;
    if (!renderer) initThree();
    if (compareState.mode === 'single') fitSingleCanvas();
    animLoopActive = true;
    renderer.setAnimationLoop(renderLoop);
  }

  function stopRender() {
    // v2.16: never tear the loop down mid-VR-session — the XR compositor
    // drives it (loadPanorama calls stopRender() on every scene switch,
    // including switches triggered from inside VR).
    if (inVrSession) return;
    if (animLoopActive && renderer) renderer.setAnimationLoop(null);
    animLoopActive = false;
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
    updateVrBtn();
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
    updateVrBtn();
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
    updateVrBtn();
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

  // ---- Quick help modal (v2.9.4) ----
  function openQuickHelp() { showEl(quickHelpModal); }
  function closeQuickHelp() { hideEl(quickHelpModal); }
  quickHelpBtn.addEventListener('click', openQuickHelp);
  quickHelpCloseBtn.addEventListener('click', closeQuickHelp);
  quickHelpOkBtn.addEventListener('click', closeQuickHelp);
  quickHelpModal.addEventListener('click', (e) => { if (e.target === quickHelpModal) closeQuickHelp(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && quickHelpModal.style.display !== 'none') closeQuickHelp();
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
    const zipFiles   = files.filter(f => f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip' || f.type === 'application/x-zip-compressed');
    if (zipFiles.length > 0) { _doImportZipPackage(zipFiles[0]); return; }

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

  // ============================================================
  // WebXR / VR mode (v2.10 — single scene only)
  // ============================================================
  function checkXrSupport() {
    if (!navigator.xr || !navigator.xr.isSessionSupported) {
      xrSupported = false;
      updateVrBtn();
      return;
    }
    navigator.xr.isSessionSupported('immersive-vr')
      .then((supported) => { xrSupported = !!supported; updateVrBtn(); })
      .catch(() => { xrSupported = false; updateVrBtn(); });
  }

  function updateVrBtn() {
    if (!vrBtn) return;
    const compareActive = compareState.mode !== 'single';
    if (!xrSupported) {
      vrBtn.disabled = true;
      vrBtn.title = 'このブラウザはWebXR VRに対応していません';
    } else if (compareActive) {
      vrBtn.disabled = true;
      vrBtn.title = 'VRモードは通常表示のみ対応です';
    } else {
      vrBtn.disabled = false;
      vrBtn.title = 'Meta Quest Browserなど、WebXR対応ブラウザで現在シーンをVR表示します。PC画面拡張ではなく、Quest側ブラウザでの利用を推奨します。VR中はQuest Touch Plusコントローラーの右Aボタン（button[4]）で次のシーンへ、左Xボタン（button[4]）で前のシーンへ、右Bボタン（button[5]）でHUD表示切替、左Yボタン（button[5]）でDebug Panelの詳細/簡易切替ができます。周囲に表示されるシーンリングをレーザーポインターで狙い、同じ手のトリガー（button[0]）でそのシーンへ移動できます（VR Scene Ring Navigation）。左コントローラーのMenuボタン（button[12]）でシーンリングの表示/非表示を切り替えられます。';
    }
    vrBtn.classList.toggle('active', inVrSession);
  }

  // ============================================================
  // VR HUD & Controller Navigation (v2.16 — WebXR-Sandbox runtime port)
  // ============================================================
  // camera-forward HUD, as verified on Quest 3 in the Sandbox: a
  // PlaneGeometry + CanvasTexture panel added as a *child of the main
  // camera* (the camera itself is in the scene graph — see initThree).
  // The HMD moves the camera, the HUD follows for free; no per-frame
  // world-position math. State is VR-session-local, never saved to JSON/ZIP.

  function _vrNavPosition() {
    const order = _getNavOrder();
    const pos = order.indexOf(currentIdx);
    if (pos >= 0) return { pos: pos + 1, total: order.length };
    // Current scene outside the nav order (e.g. unplaced scene while a
    // floorplan with markers is active) — fall back to plain scene index.
    return { pos: currentIdx + 1, total: scenes.length };
  }

  function _createVrHud() {
    if (vrHudMesh || !camera) return;
    vrHudCanvas = document.createElement('canvas');
    vrHudCanvas.width = 1024; vrHudCanvas.height = 700;
    vrHudCtx = vrHudCanvas.getContext('2d');
    vrHudTexture = new THREE.CanvasTexture(vrHudCanvas);
    vrHudTexture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: vrHudTexture, transparent: true, opacity: 1,
      depthTest: false, side: THREE.DoubleSide
    });
    vrHudMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), mat);
    vrHudMesh.renderOrder = 999;
    vrHudMesh.visible = vrHudVisible;
    // v2.16 (Sandbox "camera-forward", Quest 3 verified): fixed local offset
    // as a child of the main camera — slightly below center so it doesn't
    // block the middle of the panorama.
    vrHudMesh.position.set(0, -0.45, -2.0);
    camera.add(vrHudMesh);
    _drawVrHud();
    console.log('[VR] hud created (camera-forward, camera-parented)');
  }

  function _disposeVrHud() {
    if (!vrHudMesh) return;
    if (vrHudMesh.parent) vrHudMesh.parent.remove(vrHudMesh);
    vrHudMesh.geometry.dispose();
    vrHudMesh.material.dispose();
    if (vrHudTexture) vrHudTexture.dispose();
    vrHudMesh = null; vrHudCanvas = null; vrHudCtx = null; vrHudTexture = null;
  }

  function _vrButtonSummary(side) {
    const s = vrDebug[side];
    if (!s) return '-';
    return s.hasGamepad ? `${s.buttonsLength}` : 'no gamepad';
  }

  function _vrHandDetail(side) {
    const s = vrDebug[side];
    if (!s || !s.hasGamepad) return 'no gamepad';
    return `buttons:${s.buttonsLength} pressed:${s.pressedCount}`;
  }

  // ------------------------------------------------------------
  // VR Controller Visual Guide (v2.18) — drawn into the same HUD canvas as
  // everything else, in the "always visible" band above the Debug
  // simple/detailed split, so it shows/hides with the HUD (vrHudVisible)
  // and is unaffected by the Left Y detail toggle. Pure Canvas 2D drawing:
  // no new DOM element, no input handling, no change to button mapping —
  // it only *reads* vrRingEnabled to grey out the Trigger affordance and to
  // show the Ring ON/OFF state next to Menu. Internal button indices
  // (#0/#4/#5/#12) are intentionally not printed here; they remain in
  // docs/vr.html for reference.
  function _drawVrHudButtonDot(ctx, x, y, symbol, labelX, labelY, label, active, color) {
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fillStyle = active ? color : 'rgba(140, 140, 150, 0.45)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = active ? '#ffffff' : 'rgba(200, 200, 200, 0.4)';
    ctx.stroke();
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = active ? '#0d121c' : 'rgba(20, 20, 24, 0.85)';
    ctx.fillText(symbol, x, y + 1);
    ctx.textBaseline = 'alphabetic';

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(labelX, labelY);
    ctx.strokeStyle = active ? 'rgba(210, 225, 255, 0.55)' : 'rgba(150, 150, 150, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = active ? '#eaf1ff' : 'rgba(190, 190, 190, 0.6)';
    ctx.fillText(label, labelX, labelY);
  }

  // Trigger gets its own mark instead of a plain button dot: a curved
  // "hook" stroke (suggesting a pulled lever, not a face button) at the
  // front-bottom of the grip, where the index finger actually rests on the
  // real controller — see the reference photos this shape/position was
  // adjusted against. Still just a label + leader line underneath, same as
  // _drawVrHudButtonDot.
  function _drawVrHudTriggerMark(ctx, x, y, labelX, labelY, label, active, color) {
    ctx.beginPath();
    ctx.arc(x, y, 11, -2.4, 0.5);
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = active ? color : 'rgba(140, 140, 150, 0.45)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = active ? color : 'rgba(140, 140, 150, 0.45)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.lineTo(labelX, labelY);
    ctx.strokeStyle = active ? 'rgba(210, 225, 255, 0.55)' : 'rgba(150, 150, 150, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = active ? '#eaf1ff' : 'rgba(190, 190, 190, 0.6)';
    ctx.fillText(label, labelX, labelY);
  }

  function _drawVrHudControllerGuide(ctx) {
    const ringEnabled = vrRingEnabled;

    // Real Touch Plus layout (checked against reference photos): thumbstick
    // and the small secondary button (Menu on left / Meta-Oculus on right)
    // sit together on the *inner* side of the ring — the side facing the
    // other controller — with the two main face buttons stacked on the
    // *outer* side. `inner` is +1 for the left controller (inner = right)
    // and -1 for the right controller (inner = left).
    function controller(cx, hand, color, handLabel) {
      const inner = hand === 'left' ? 1 : -1;
      const ringCy = 300, ringR = 44;

      // Tracking ring + grip, drawn as plain circle/rect strokes — a
      // deliberately simple silhouette, not a realistic controller model.
      ctx.beginPath();
      ctx.arc(cx, ringCy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 26, ringCy + ringR, 52, 64);

      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.fillText(handLabel, cx, 253);

      // Thumbstick — undecorated (not app-controlled), just for silhouette
      // recognizability. No leader line/label.
      ctx.beginPath();
      ctx.arc(cx + inner * 22, ringCy - 15, 9, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;

      const secondaryX = cx + inner * 6;
      const secondaryY = ringCy - 44;
      const secondaryLabelX = cx + inner * 132;
      const faceX = cx - inner * 24;
      const faceLabelX = cx - inner * 136;

      if (hand === 'left') {
        _drawVrHudButtonDot(ctx, secondaryX, secondaryY, 'M', secondaryLabelX, secondaryY - 2, `Ring ${ringEnabled ? 'ON' : 'OFF'}`, true, color);
        _drawVrHudButtonDot(ctx, faceX, ringCy - 22, 'Y', faceLabelX, ringCy - 22, 'Debug', true, color);
        _drawVrHudButtonDot(ctx, faceX, ringCy + 22, 'X', faceLabelX, ringCy + 22, '前', true, color);
      } else {
        // Meta/Oculus button: exits the current VR app to the system menu
        // at the OS level — Quest never exposes it as a WebXR
        // gamepad.buttons entry, so this label is purely informational and
        // is never gated on vrRingEnabled or any app state.
        _drawVrHudButtonDot(ctx, secondaryX, secondaryY, 'M', secondaryLabelX, secondaryY - 2, 'Meta : VR終了', true, '#a9c3e0');
        _drawVrHudButtonDot(ctx, faceX, ringCy - 22, 'B', faceLabelX, ringCy - 22, 'HUD', true, color);
        _drawVrHudButtonDot(ctx, faceX, ringCy + 22, 'A', faceLabelX, ringCy + 22, '次', true, color);
      }

      _drawVrHudTriggerMark(ctx, cx, ringCy + ringR + 48, cx, ringCy + ringR + 100, 'Scene選択', ringEnabled, color);
    }

    controller(260, 'left', '#5fd0c0', 'L');
    controller(764, 'right', '#e0a75f', 'R');
  }

  function _drawVrHud() {
    if (!vrHudCtx) return;
    const ctx = vrHudCtx, W = 1024, H = 700;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(13, 18, 28, 0.88)';
    ctx.strokeStyle = 'rgba(120, 170, 255, 0.6)';
    ctx.lineWidth = 4;
    const r = 36;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(W - r, 0); ctx.arcTo(W, 0, W, r, r);
    ctx.lineTo(W, H - r); ctx.arcTo(W, H, W - r, H, r);
    ctx.lineTo(r, H); ctx.arcTo(0, H, 0, H - r, r);
    ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    const nav = _vrNavPosition();
    const s = (currentIdx >= 0 && scenes[currentIdx]) ? scenes[currentIdx] : null;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.fillText('ArchView360 VR', W / 2, 70);
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText(`Scene ${nav.pos} / ${nav.total}`, W / 2, 140);
    ctx.font = '42px system-ui, sans-serif';
    ctx.fillStyle = '#cfe0ff';
    let name = s ? s.name : '—';
    if (name.length > 24) name = name.slice(0, 23) + '…';
    ctx.fillText(name, W / 2, 200);

    ctx.strokeStyle = 'rgba(120, 170, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(80, 230); ctx.lineTo(W - 80, 230); ctx.stroke();

    // v2.18: visual Controller guide replaces the old plain-text button
    // legend (still drawn in the "always visible" band, independent of the
    // Left Y detail toggle below — see _drawVrHudControllerGuide comments).
    _drawVrHudControllerGuide(ctx);

    ctx.strokeStyle = 'rgba(120, 170, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(80, 468); ctx.lineTo(W - 80, 468); ctx.stroke();

    ctx.font = '24px monospace';
    ctx.fillStyle = '#7a8bab';
    ctx.textAlign = 'center';
    let y = 480;
    if (vrDebugDetailed) {
      // Detailed debug panel (Left Y toggles this on). Line spacing tightened
      // to 23px so all 10 lines fit below the controller guide within the
      // fixed 700px-tall canvas.
      ctx.fillText(`inputSources: ${vrDebug.inputSourceCount}`, W / 2, y); y += 23;
      ctx.fillText(`left: ${_vrHandDetail('left')}`, W / 2, y); y += 23;
      ctx.fillText(`right: ${_vrHandDetail('right')}`, W / 2, y); y += 23;
      ctx.fillText(`last action: ${vrDebug.lastAction}`, W / 2, y); y += 23;
      ctx.fillText(`current scene: ${currentIdx}`, W / 2, y); y += 23;
      ctx.fillText(`nav order length: ${_getNavOrder().length}`, W / 2, y); y += 23;
      ctx.fillText(`ring items: ${vrRingItems.length}`, W / 2, y); y += 23;
      ctx.fillText(`ring enabled: ${vrRingEnabled}`, W / 2, y); y += 23;
      ctx.fillText(`hovered L:${vrRingDebug.hoveredLeft} R:${vrRingDebug.hoveredRight}`, W / 2, y); y += 23;
      ctx.fillText(`selected: ${vrRingDebug.selectedName}`, W / 2, y);
    } else {
      // Simple panel: just the controller guide already drawn above, plus
      // a one-line input-sources sanity check.
      ctx.fillText(`inputSources: ${vrDebug.inputSourceCount}`, W / 2, y);
    }

    if (vrHudTexture) vrHudTexture.needsUpdate = true;
  }

  function _vrShowHud() {
    _drawVrHud();
  }

  // ============================================================
  // VR Scene Ring Navigation (v2.17)
  // ============================================================
  // Self-contained VR-only subsystem, following the same pattern the (now
  // removed) VR Cube Probe used: it hooks in with one call each from
  // enterVr() / onVrSessionEnd() / the enterVr() catch branch, and one call
  // from vrFrame() (see below) — the HUD, controller button polling and
  // render loop code above/elsewhere are otherwise untouched.
  //
  // What this is NOT: it does not place hotspots at FloorMap pin positions
  // in 3D space. Project data carries no per-scene spatial coordinates, so
  // the ring simply presents the existing navigation targets at synthetic,
  // evenly spaced positions around the wearer.

  function _buildRingItemTexture(name, hovered) {
    const W = 256, H = 256;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(W / 2, 104, hovered ? 78 : 70, 0, Math.PI * 2);
    ctx.fillStyle = hovered ? 'rgba(120, 190, 255, 0.95)' : 'rgba(79, 124, 255, 0.82)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = hovered ? 8 : 5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${hovered ? 30 : 26}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    // ZIP/JSON-restored scenes may carry an empty or missing name — coerce
    // here as well so a bad value can never throw mid-creation.
    const text = String(name == null ? '' : name);
    const label = text.length > 14 ? text.slice(0, 13) + '…' : text;
    ctx.fillText(label, W / 2, 216);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function _buildLaserLine() {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -8)
    ]);
    const material = new THREE.LineBasicMaterial({
      color: 0x4f7cff, transparent: true, opacity: 0.85,
      depthTest: false, depthWrite: false
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 997;
    return line;
  }

  // Places one ring item per nav-order scene other than the current one, on
  // a fixed-radius circle around the wearer (no per-scene 3D position exists
  // in project data, so this reuses the same order — marker.order on the
  // active floorplan, falling back to plain scene order — as
  // nextScene()/prevScene()/FloorMap via _getNavOrder(), rather than adding
  // new positional data; item positions are synthetic and unrelated to
  // FloorMap pin coordinates).
  function _populateVrRingItems() {
    const order = _getNavOrder();
    const others = order.filter((idx) => idx !== currentIdx);
    others.forEach((sceneIdx, i) => {
      const scn = scenes[sceneIdx];
      if (!scn) return;
      // ZIP/JSON-restored scenes may have an empty/missing name — normalize
      // to a displayable string before any .length/.slice access.
      const safeName = String(scn.name || scn.title || `Scene ${sceneIdx + 1}`);
      const angle = (i / others.length) * Math.PI * 2;
      const x = Math.sin(angle) * VR_RING_RADIUS;
      const z = -Math.cos(angle) * VR_RING_RADIUS;
      const normalTexture = _buildRingItemTexture(safeName, false);
      const hoverTexture = _buildRingItemTexture(safeName, true);
      // THREE.Sprite always faces the camera (billboard) and scales with
      // perspective distance automatically (sizeAttenuation defaults to
      // true) — no per-frame lookAt/scale math needed.
      // depthTest/depthWrite off: the sprite's transparent texels must never
      // write depth or occlude the panorama sphere.
      const material = new THREE.SpriteMaterial({
        map: normalTexture, transparent: true, depthTest: false, depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      const baseScale = 0.9;
      sprite.scale.set(baseScale, baseScale, 1);
      sprite.position.set(x, VR_RING_HEIGHT, z);
      sprite.renderOrder = 998;
      vrRingGroup.add(sprite);
      vrRingItems.push({ mesh: sprite, sceneIdx, name: safeName, normalTexture, hoverTexture, baseScale });
    });
  }

  function _disposeVrRingSprites() {
    vrRingItems.forEach((h) => {
      if (vrRingGroup) vrRingGroup.remove(h.mesh);
      h.normalTexture.dispose();
      h.hoverTexture.dispose();
      h.mesh.material.dispose();
    });
    vrRingItems = [];
    vrRingHovered.left = null;
    vrRingHovered.right = null;
    vrRingDebug.hoveredLeft = '-';
    vrRingDebug.hoveredRight = '-';
  }

  // Called once the post-switch fade-in completes, so the ring reflects
  // the new current scene ("現在Scene以外を表示").
  function _rebuildVrRing() {
    if (!vrRingGroup) return;
    _disposeVrRingSprites();
    _populateVrRingItems();
  }

  // renderer.xr.getController() indices are connection slots, not hands —
  // the actual handedness arrives with the 'connected' event's
  // XRInputSource. It is cached on the controller so each laser's hover can
  // only be confirmed by the trigger of the same hand; a controller whose
  // handedness is unknown never hovers and never selects.
  function _onRingControllerConnected(event) {
    const h = event.data && event.data.handedness;
    event.target.userData.ringHandedness = (h === 'left' || h === 'right') ? h : null;
  }

  function _onRingControllerDisconnected(event) {
    event.target.userData.ringHandedness = null;
  }

  function _resetVrRingTriggerState() {
    vrRingTrigger.left.pressed = false;
    vrRingTrigger.left.armed = false;
    vrRingTrigger.right.pressed = false;
    vrRingTrigger.right.armed = false;
  }

  // Ring visibility toggle (v2.17.1, Left Menu / button[12]). Turning the
  // ring back on always re-arms safely (see _resetVrRingTriggerState) so a
  // trigger that happened to be held while the ring was hidden can't fire an
  // immediate selection the instant it reappears.
  function _toggleVrRingEnabled() {
    vrRingEnabled = !vrRingEnabled;
    console.log('[VR Ring]', 'enabled ->', vrRingEnabled);
    if (vrRingEnabled) {
      _resetVrRingTriggerState();
    } else {
      _updateRingHandHover('left', null);
      _updateRingHandHover('right', null);
    }
    _vrShowHud();
  }

  function _createVrSceneRing() {
    if (vrRingGroup || !threeScene || !camera || !renderer) return;
    // With a single scene there is nothing to navigate to — skip the whole
    // layer (ring, lasers, controllers, fade plane) instead of showing an
    // empty ring and dangling laser pointers.
    if (scenes.length <= 1) {
      console.log('[VR Ring]', 'skipped (single scene)');
      return;
    }
    vrRingEnabled = true;
    _resetVrRingTriggerState();
    try {
      vrRingGroup = new THREE.Group();
      threeScene.add(vrRingGroup);
      _populateVrRingItems();

      // Controller pose comes from three.js's own WebXR controller-space
      // tracking, a mechanism entirely separate from the gamepad.buttons
      // polling in _pollVrInputSources.
      vrController1 = renderer.xr.getController(0);
      vrController2 = renderer.xr.getController(1);
      [vrController1, vrController2].forEach((controller) => {
        controller.userData.ringHandedness = null;
        controller.addEventListener('connected', _onRingControllerConnected);
        controller.addEventListener('disconnected', _onRingControllerDisconnected);
      });
      vrControllerLaser1 = _buildLaserLine();
      vrControllerLaser2 = _buildLaserLine();
      vrController1.add(vrControllerLaser1);
      vrController2.add(vrControllerLaser2);
      threeScene.add(vrController1, vrController2);

      const fadeMat = new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false
      });
      vrRingFadeMesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), fadeMat);
      vrRingFadeMesh.position.set(0, 0, -0.3);
      vrRingFadeMesh.renderOrder = 1000;
      vrRingFadeMesh.visible = false;
      camera.add(vrRingFadeMesh);

      vrRingFadeState = 'idle';
      vrRingFadeAlpha = 0;
      vrRingPendingSceneIdx = -1;
      vrRingDebug.hoveredLeft = '-';
      vrRingDebug.hoveredRight = '-';
      vrRingDebug.selectedName = '-';
      console.log('[VR Ring]', 'ring created', vrRingItems.length, 'items');
    } catch (err) {
      // A ring failure must never take the VR session, HUD or A/X/B/Y
      // controls down — drop just the (possibly partially built) ring layer
      // and carry on with the base VR runtime.
      const msg = (err && err.message) ? err.message : String(err);
      console.error('[VR Ring]', 'creation failed — continuing without ring:', err);
      vrRingDebug.lastError = 'create: ' + msg;
      try { _disposeVrSceneRing(); } catch (e2) { /* partially built — ignore */ }
      _renderVrDebugLog('ring creation failed: ' + msg);
    }
  }

  function _disposeVrSceneRing() {
    _disposeVrRingSprites();
    if (vrRingGroup) { threeScene.remove(vrRingGroup); vrRingGroup = null; }
    [vrControllerLaser1, vrControllerLaser2].forEach((laser) => {
      if (!laser) return;
      laser.geometry.dispose();
      laser.material.dispose();
    });
    vrControllerLaser1 = null; vrControllerLaser2 = null;
    [vrController1, vrController2].forEach((controller) => {
      if (!controller) return;
      controller.removeEventListener('connected', _onRingControllerConnected);
      controller.removeEventListener('disconnected', _onRingControllerDisconnected);
      controller.userData.ringHandedness = null;
      threeScene.remove(controller);
    });
    vrController1 = null; vrController2 = null;
    if (vrRingFadeMesh) {
      if (vrRingFadeMesh.parent) vrRingFadeMesh.parent.remove(vrRingFadeMesh);
      vrRingFadeMesh.geometry.dispose();
      vrRingFadeMesh.material.dispose();
      vrRingFadeMesh = null;
    }
    vrRingFadeState = 'idle';
    vrRingFadeAlpha = 0;
    vrRingPendingSceneIdx = -1;
    vrRingFadeSphereRef = null;
    vrRingFadeLoadFrames = 0;
    _resetVrRingTriggerState();
    vrRingEnabled = true; // discard the session-local toggle; next VR session always starts with the ring visible
    vrRingDebug.hoveredLeft = '-';
    vrRingDebug.hoveredRight = '-';
    vrRingDebug.selectedName = '-';
    // vrRingDebug.lastError is intentionally kept so a failure stays
    // readable on the on-screen VR Debug Log after the session ends.
  }

  function _setRingItemHighlight(record, active) {
    record.mesh.material.map = active ? record.hoverTexture : record.normalTexture;
    record.mesh.material.needsUpdate = true;
    const scale = active ? record.baseScale * 1.12 : record.baseScale;
    record.mesh.scale.set(scale, scale, 1);
  }

  // Per-hand hover bookkeeping. An item stays highlighted while EITHER hand
  // hovers it; un-highlighting only happens once neither hand points at it.
  function _updateRingHandHover(hand, record) {
    if (vrRingHovered[hand] === record) return;
    const prev = vrRingHovered[hand];
    const otherHand = hand === 'left' ? 'right' : 'left';
    vrRingHovered[hand] = record;
    if (prev && vrRingHovered[otherHand] !== prev) _setRingItemHighlight(prev, false);
    if (record) _setRingItemHighlight(record, true);
    vrRingDebug[hand === 'left' ? 'hoveredLeft' : 'hoveredRight'] = record ? record.name : '-';
  }

  function _selectVrRingItem(record) {
    if (vrRingFadeState !== 'idle') return;
    vrRingPendingSceneIdx = record.sceneIdx;
    vrRingDebug.selectedName = record.name;
    console.log('[VR Ring]', 'selected', record.name, 'sceneIdx', record.sceneIdx);
    vrRingFadeState = 'out';
  }

  // Fade Out -> Texture Load -> Fade In, driven once per frame from
  // _updateVrSceneRing(). The existing VR Runtime (renderLoop/vrFrame,
  // enterVr/onVrSessionEnd, camera-forward HUD) is not modified to support
  // this — the fade plane is a child of `camera` created/disposed only by
  // this feature, and "Texture Load" completion is detected by watching
  // the existing `sphere` variable for the reassignment buildSphere()
  // already performs, with no changes to loadPanorama/buildSphere/switchToScene.
  function _updateVrRingFade() {
    if (vrRingFadeState === 'idle') return;
    // Defensive: a fade state machine running without its plane (partial
    // dispose) must self-reset instead of blocking selection forever.
    if (!vrRingFadeMesh) { vrRingFadeState = 'idle'; return; }

    if (vrRingFadeState === 'out') {
      vrRingFadeMesh.visible = true;
      vrRingFadeAlpha = Math.min(1, vrRingFadeAlpha + VR_RING_FADE_STEP);
      vrRingFadeMesh.material.opacity = vrRingFadeAlpha;
      if (vrRingFadeAlpha >= 1) {
        const idx = vrRingPendingSceneIdx;
        vrRingPendingSceneIdx = -1;
        vrRingFadeSphereRef = sphere;
        vrRingFadeLoadFrames = 0;
        // Every failure below (invalid index, switchToScene throwing) falls
        // through to 'in' instead of 'loading', so the black plane can never
        // be left covering the view; on failure the current scene is kept.
        let switched = false;
        if (idx >= 0 && idx < scenes.length) {
          try {
            switchToScene(idx);
            switched = true;
          } catch (err) {
            const msg = (err && err.message) ? err.message : String(err);
            console.error('[VR Ring]', 'switchToScene failed', err);
            vrRingDebug.lastError = 'switch: ' + msg;
          }
        } else {
          vrRingDebug.lastError = 'switch: invalid sceneIdx ' + idx;
        }
        vrRingFadeState = switched ? 'loading' : 'in';
      }
      return;
    }

    if (vrRingFadeState === 'loading') {
      // Screen stays fully black (opacity already 1) until buildSphere()
      // has swapped `sphere` for the newly loaded texture. The frame-count
      // safety valve (~5s) forces the fade-in even if the texture load
      // errors out or stalls — the previous panorama is still on `sphere`,
      // so a failed switch fades back into the original scene rather than
      // leaving the wearer staring at black.
      vrRingFadeLoadFrames++;
      if (sphere !== vrRingFadeSphereRef || vrRingFadeLoadFrames > VR_RING_FADE_TIMEOUT_FRAMES) {
        _vrShowHud();
        vrRingFadeState = 'in';
      }
      return;
    }

    // vrRingFadeState === 'in'
    vrRingFadeAlpha = Math.max(0, vrRingFadeAlpha - VR_RING_FADE_STEP);
    vrRingFadeMesh.material.opacity = vrRingFadeAlpha;
    if (vrRingFadeAlpha <= 0) {
      vrRingFadeMesh.visible = false;
      vrRingFadeState = 'idle';
      _rebuildVrRing();
    }
  }

  // Per-frame ring raycast + per-hand hover + armed-Trigger-select, called
  // once from vrFrame() after renderer.render() (so controller matrixWorld
  // reflects this frame's freshly-updated pose). The whole body is guarded:
  // any failure inside the ring layer logs, disposes just the ring, and
  // leaves the XR animation loop / HUD / A/X/B/Y running.
  function _updateVrSceneRing() {
    if (!vrRingGroup) return;
    try {
      _updateVrRingFade();

      // Fade中、または表示トグルでOFFにされている間は、リングとレーザーを
      // 非表示にしhover/選択を完全に止める（要件: 「Ring非表示時はRing
      // items、Laser、hover、Trigger選択をすべて無効化する」）。
      const fading = vrRingFadeState !== 'idle';
      const visible = vrRingEnabled && !fading;
      vrRingGroup.visible = visible;
      if (vrControllerLaser1) vrControllerLaser1.visible = visible;
      if (vrControllerLaser2) vrControllerLaser2.visible = visible;

      if (!visible) {
        _updateRingHandHover('left', null);
        _updateRingHandHover('right', null);
      } else {
        // Sprite.raycast() reads raycaster.camera internally — leaving it
        // unset (or stale) throws every frame, which kills the XR animation
        // loop entirely (seen on Quest 3 as a freeze plus last-frame
        // reprojection covering only part of the view). The principled
        // source is the active XR camera (renderer.xr.getCamera(camera)),
        // which is only meaningful while a frame is actually being
        // rendered inside an XR session; resolving it is wrapped so a
        // throw or a falsy return can never propagate. When it can't be
        // obtained, this frame's raycast is skipped outright (hover cleared,
        // no exception) rather than guessing with a substitute camera.
        let xrCam = null;
        try {
          xrCam = (renderer && renderer.xr && renderer.xr.getCamera) ? renderer.xr.getCamera(camera) : null;
        } catch (err) {
          xrCam = null;
        }

        const hits = { left: null, right: null };
        if (xrCam) {
          vrRaycaster.camera = xrCam;
          // Per-hand raycast: each laser only feeds the hover slot of its
          // own handedness (resolved via the 'connected' event, see
          // _onRingControllerConnected). A controller with unknown
          // handedness contributes no hover and therefore can never select.
          [vrController1, vrController2].forEach((controller) => {
            if (!controller) return;
            const hand = controller.userData.ringHandedness;
            if (hand !== 'left' && hand !== 'right') return;
            vrRaycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
            vrRaycaster.ray.direction.set(0, 0, -1).transformDirection(controller.matrixWorld).normalize();
            const intersects = vrRaycaster.intersectObjects(vrRingGroup.children, false);
            hits[hand] = intersects.length
              ? (vrRingItems.find((h) => h.mesh === intersects[0].object) || null)
              : null;
          });
        }
        _updateRingHandHover('left', hits.left);
        _updateRingHandHover('right', hits.right);
      }

      // Trigger (button[0]) arm/press handling, keyed by handedness and
      // independent of the button-mapped polling in _pollVrInputSources —
      // Trigger is explicitly reserved/unused there. A hand starts un-armed
      // and only arms once seen with the trigger RELEASED, so the squeeze
      // that started the VR session can never select on the first frames;
      // every selection drops armed again, so re-selecting (including after
      // a fade) always requires release-then-press. State keeps updating
      // during the fade so nothing stale fires when it ends.
      //
      // Left Menu (button[12]) toggles the ring's visibility (v2.17.1) and
      // is polled here too, unconditionally — it must keep working even
      // while the ring is hidden or fading, so it can always turn the ring
      // back on. It only ever reads source.gamepad.buttons[12] on the left
      // hand; it does not touch the Right A/Left X/Right B/Left Y polling
      // in _pollVrInputSources.
      const session = renderer && renderer.xr && renderer.xr.getSession ? renderer.xr.getSession() : null;
      const sources = session && session.inputSources ? Array.from(session.inputSources) : [];
      sources.forEach((source) => {
        const handedness = source.handedness;
        if (handedness !== 'left' && handedness !== 'right') return;
        const gamepad = source.gamepad;
        if (!gamepad || !gamepad.buttons) return;

        if (handedness === 'left' && gamepad.buttons[12]) {
          const togglePressed = !!gamepad.buttons[12].pressed;
          const wasTogglePressed = !!vrRingTogglePrevPressed.get(gamepad);
          if (togglePressed && !wasTogglePressed) _toggleVrRingEnabled();
          vrRingTogglePrevPressed.set(gamepad, togglePressed);
        }

        if (!gamepad.buttons[0]) return;
        const st = vrRingTrigger[handedness];
        const pressed = !!gamepad.buttons[0].pressed;
        if (!pressed) {
          // Observed released — from here on a fresh press may select.
          st.armed = true;
        } else if (st.armed && !st.pressed && vrRingEnabled && !fading && vrRingHovered[handedness]) {
          _selectVrRingItem(vrRingHovered[handedness]);
          st.armed = false;
        }
        st.pressed = pressed;
      });
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      console.error('[VR Ring]', 'update failed — disposing ring:', err);
      vrRingDebug.lastError = 'update: ' + msg;
      try { _disposeVrSceneRing(); } catch (e2) { /* already broken — ignore */ }
      _renderVrDebugLog('ring update failed: ' + msg);
    }
  }

  function vrGoNextScene() {
    if (!inVrSession || !scenes.length) return;
    // Reuses the shared navigation order (marker.order on the active
    // floorplan → scene filter → plain scene order); currentIdx, scene
    // list, FloorMap and observerState all sync via switchToScene. The
    // VR-safe guards added in v2.13 (skip DOM fade / no resetView / keep
    // the XR animation loop instead of restarting rAF) still apply here.
    nextScene();
    vrDebug.nextCount++;
    console.log('[VR]', 'scene next', currentIdx);
    _vrShowHud();
  }

  function vrGoPrevScene() {
    if (!inVrSession || !scenes.length) return;
    prevScene();
    vrDebug.prevCount++;
    console.log('[VR]', 'scene prev', currentIdx);
    _vrShowHud();
  }

  function vrToggleHud() {
    vrHudVisible = !vrHudVisible;
    vrDebug.hudCount++;
    console.log('[VR]', 'hud toggle', vrHudVisible);
    if (vrHudMesh) vrHudMesh.visible = vrHudVisible;
    if (vrHudVisible) _vrShowHud();
  }

  function vrToggleDebugDetail() {
    vrDebugDetailed = !vrDebugDetailed;
    vrDebug.debugCount++;
    console.log('[VR]', 'debug detail toggle', vrDebugDetailed);
    _vrShowHud();
  }

  // Quest Touch Plus mapping, as measured against WebXR-Sandbox
  // (merge commit 34e3d4cf5f1da9c1c7fe3181a67bbe78fdc26ee2):
  //   Right: trigger #0, grip #1, stick click #3, A #4, B #5
  //   Left:  trigger #0, grip #1, stick click #3, X #4, Y #5, menu #12
  // Only button[4] (A/X) and button[5] (B/Y) are used for the primary
  // actions below; trigger/grip/stick-click/menu/axes are intentionally
  // left unused in this PR.
  function _vrActionForButton(handedness, buttonIndex) {
    if (handedness === 'right') {
      if (buttonIndex === 4) return 'next';   // Right A
      if (buttonIndex === 5) return 'hud';    // Right B
    } else if (handedness === 'left') {
      if (buttonIndex === 4) return 'prev';   // Left X
      if (buttonIndex === 5) return 'debug';  // Left Y
    }
    return null;
  }

  function _vrRunAction(action, handedness, buttonIndex) {
    vrDebug.lastAction = `${handedness || 'unknown'} button[${buttonIndex}] ${action}`;
    console.log('[VR]', 'button edge', handedness, buttonIndex);
    const now = Date.now();
    if (now - vrLastInputAt < VR_INPUT_COOLDOWN_MS) return;
    vrLastInputAt = now;
    if (action === 'next') vrGoNextScene();
    else if (action === 'prev') vrGoPrevScene();
    else if (action === 'hud') vrToggleHud();
    else if (action === 'debug') vrToggleDebugDetail();
  }

  // v2.15: primary input path (WebXR-Sandbox verified). Polled once per
  // frame from vrFrame — no controller 'selectstart'/'squeezestart' event
  // listeners, which did not fire reliably on Meta Quest 3 hardware in
  // v2.13/v2.13.1 real-device testing. Reads session.inputSources directly
  // each frame and edge-detects gamepad.buttons[].pressed transitions.
  function _pollVrInputSources() {
    const session = renderer && renderer.xr && renderer.xr.getSession ? renderer.xr.getSession() : xrSession;
    const sources = session && session.inputSources ? Array.from(session.inputSources) : [];
    vrDebug.inputSourceCount = sources.length;
    vrDebug.left = null;
    vrDebug.right = null;

    for (const source of sources) {
      const handedness = source.handedness; // 'left' | 'right' | 'none' | undefined
      const gamepad = source.gamepad;
      if (!gamepad || !gamepad.buttons) continue;

      let prev = vrPrevButtonState.get(gamepad);
      if (!prev) { prev = []; vrPrevButtonState.set(gamepad, prev); }
      let pressedCount = 0;
      gamepad.buttons.forEach((button, idx) => {
        const nowPressed = !!(button && button.pressed);
        if (nowPressed) pressedCount++;
        const wasPressed = !!prev[idx];
        if (!wasPressed && nowPressed) {
          console.log('[VR]', 'input source', handedness, gamepad.buttons.length);
          const action = _vrActionForButton(handedness, idx);
          if (action) _vrRunAction(action, handedness, idx);
        }
        prev[idx] = nowPressed;
      });

      const summary = { hasGamepad: true, buttonsLength: gamepad.buttons.length, pressedCount };
      if (handedness === 'left') vrDebug.left = summary;
      else if (handedness === 'right') vrDebug.right = summary;
    }
  }

  function _vrResetInputState() {
    vrDebug.inputSourceCount = 0;
    vrDebug.left = null;
    vrDebug.right = null;
    vrDebug.lastAction = '-';
    vrDebug.nextCount = 0;
    vrDebug.prevCount = 0;
    vrDebug.hudCount = 0;
    vrDebug.debugCount = 0;
    vrDebugDetailed = false;
    vrLastInputAt = 0;
  }

  // ------------------------------------------------------------
  // On-screen (normal, non-VR) VR Debug Log
  // ------------------------------------------------------------
  // Quest Browser gives no practical access to devtools mid-session, so
  // input state is mirrored into a small panel on the regular 2D screen.
  // It stays populated after the VR session ends so results can be read
  // once the headset is off. Local-only; never sent anywhere, never saved
  // to JSON/ZIP.
  // v2.15.2 audit fields, kept separate from vrDebug (input state) so this
  // one block can be read as "is the render path itself alive" independent
  // of whether any controller input has occurred. See
  // docs/vr-render-path-audit.md and requirement 7 in the audit brief.
  const vrRenderDebug = {
    threeSceneUuid: '-',
    cameraUuid: '-',
    xrEnabled: false,
    animationLoopActive: false,
    normalRafActive: false,
    lastLoopAt: 0,
    frameCount: 0
  };

  function _renderVrDebugLog(statusLine) {
    if (!vrDebugLogEl) return;
    vrDebugLogEl.style.display = '';
    vrDebugLogEl.textContent =
`VR Debug:
${statusLine}
renderMode: ${renderMode}
threeScene uuid: ${vrRenderDebug.threeSceneUuid}
camera uuid: ${vrRenderDebug.cameraUuid}
renderer.xr.enabled: ${vrRenderDebug.xrEnabled}
animationLoop active: ${vrRenderDebug.animationLoopActive}
normalRAF active: ${vrRenderDebug.normalRafActive}
last vrFrame timestamp: ${vrRenderDebug.lastLoopAt}
vrFrame count: ${vrRenderDebug.frameCount}
inputSources: ${vrDebug.inputSourceCount}
left buttons: ${_vrButtonSummary('left')}
right buttons: ${_vrButtonSummary('right')}
last action: ${vrDebug.lastAction}
next:${vrDebug.nextCount} prev:${vrDebug.prevCount} hud:${vrDebug.hudCount} debug:${vrDebug.debugCount}
hud: ${vrHudMesh ? 'visible=' + vrHudVisible : '-'}
ring: ${vrRingGroup ? vrRingItems.length + ' items' : 'off'} / last ring error: ${vrRingDebug.lastError}`;
  }

  let _vrHudDebugFrameCount = 0;
  let _vrObsFrameCount = 0;
  let _vrDebugLogFrameCount = 0;
  // v2.16: per-frame VR work, called from the single renderLoop while
  // inVrSession is true. This is not a separate animation loop — the same
  // setAnimationLoop(renderLoop) installed at startRender() keeps running
  // through session start/end (WebXR-Sandbox runtime structure).
  function vrFrame() {
    vrRenderDebug.frameCount++;
    vrRenderDebug.lastLoopAt = Date.now();
    _pollVrInputSources();
    // Redraw the HUD canvas a few times a second so the live debug
    // counters/inputSources info stay current even without a button edge.
    if (vrHudCtx) {
      _vrHudDebugFrameCount = (_vrHudDebugFrameCount + 1) % 20;
      if (_vrHudDebugFrameCount === 0) _drawVrHud();
    }
    // Mirror the input state onto the normal-screen debug log a few times
    // a second so it stays current for anyone watching a mirrored display,
    // and is left in place once the session ends.
    _vrDebugLogFrameCount = (_vrDebugLogFrameCount + 1) % 30;
    if (_vrDebugLogFrameCount === 0) _renderVrDebugLog('VR session running');
    if (renderer && threeScene && camera) renderer.render(threeScene, camera);
    // v2.17: single additive call — controller matrixWorld reflects this
    // frame's pose only after render() has run its scene-graph update.
    _updateVrSceneRing();
    if (observerState.enabled && observerState.connected) {
      // Throttle: update Observer/FloorMap state every ~6 frames (~10/sec at 60fps)
      _vrObsFrameCount = (_vrObsFrameCount + 1) % 6;
      if (_vrObsFrameCount === 0) {
        // camera.matrixWorld holds HMD pose while a WebXR session is active;
        // forward (-Z) rotated into world space gives the look direction.
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const yawRad = Math.atan2(fwd.x, -fwd.z); // 0 = looking toward -Z (theta=0 equivalent)
        _observerFrameTick(((yawRad * 180 / Math.PI) + 360) % 360, fov);
      }
    }
  }

  function onVrSessionEnd() {
    inVrSession = false;
    renderMode = 'normal';
    xrSession = null;
    console.log('[VR]', 'session ended', JSON.parse(JSON.stringify(vrDebug)));
    // v2.16: no loop teardown / restart — the single setAnimationLoop keeps
    // running; three.js moves it back off the session's rAF automatically.
    // renderer.xr.enabled also stays true for the renderer's lifetime.
    vrRenderDebug.animationLoopActive = animLoopActive;
    vrRenderDebug.normalRafActive = animLoopActive;
    vrRenderDebug.xrEnabled = renderer ? renderer.xr.enabled : false;
    // Leave the on-screen log populated with the final state — this is the
    // only way to review input results once the headset is off.
    _renderVrDebugLog('session ended');
    _disposeVrHud();
    _disposeVrSceneRing();
    vrHudVisible = true;
    _vrResetInputState();
    autoRotate = autoRotateWasOnBeforeVr;
    if (compareState.mode === 'single' && scenes.length) fitSingleCanvas();
    // clearAllAndShowUpload() during VR can't stop the loop itself (stopRender
    // is a no-op mid-session) — if the session ended with no scenes left,
    // stop it here instead of rendering an empty scene forever.
    if (!scenes.length) stopRender();
    observerState.connected = false;
    renderObserverPanel();
    updateVrBtn();
    showToast('VRモードを終了しました');
  }

  async function enterVr() {
    if (!vrBtn || vrBtn.disabled || inVrSession) return;
    if (!window.isSecureContext) { showToast('VR表示にはHTTPS環境が必要です'); return; }
    if (!navigator.xr) { showToast('このブラウザはVR表示に対応していません'); return; }
    if (compareState.mode !== 'single' || !renderer || !camera || !threeScene) {
      showToast('VRモードは通常表示のみ対応です');
      return;
    }
    try {
      startRender(); // no-op when the loop is already running (normal case)
      vrHudVisible = true;
      _vrResetInputState();
      _createVrHud();
      _createVrSceneRing();
      vrRenderDebug.threeSceneUuid = threeScene.uuid;
      vrRenderDebug.cameraUuid = camera.uuid;
      vrRenderDebug.frameCount = 0;
      vrRenderDebug.xrEnabled = renderer.xr.enabled;
      // v2.16: same optionalFeatures as three.js VRButton — the exact
      // session-start path the WebXR-Sandbox was verified with on Quest 3.
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'layers']
      });
      xrSession = session;
      inVrSession = true;
      renderMode = 'vr';
      autoRotateWasOnBeforeVr = autoRotate;
      autoRotate = false;
      session.addEventListener('end', onVrSessionEnd);
      // v2.16: no loop swap — the single setAnimationLoop(renderLoop) keeps
      // running; setSession moves it onto the session's rAF internally.
      await renderer.xr.setSession(session);
      vrRenderDebug.animationLoopActive = animLoopActive;
      vrRenderDebug.normalRafActive = false;
      console.log('[VR]', 'session started');
      console.log('[VR Render]', 'threeScene', threeScene.uuid, 'camera', camera.uuid);
      _vrShowHud();
      _renderVrDebugLog('session started');
      // Observer Mode (v2.11): entering VR makes this browser tab act as the "viewer" side
      observerState.role = 'viewer';
      observerState.connected = true;
      observerState.enabled = true;
      if (!observerState.sessionId) observerState.sessionId = _genObserverSessionId();
      if (currentIdx >= 0 && scenes[currentIdx]) _updateObserverForScene(scenes[currentIdx]);
      updateObserverBtn();
      renderObserverPanel();
      updateVrBtn();
      showToast('VRモードを開始しました');
    } catch (err) {
      inVrSession = false;
      renderMode = 'normal';
      xrSession = null;
      console.log('[VR]', 'session error', err && err.message);
      _renderVrDebugLog('session failed to start');
      _disposeVrHud();
      _disposeVrSceneRing();
      _vrResetInputState();
      // v2.16: the loop was never swapped, so there is nothing to restart;
      // renderer.xr.enabled also stays true for the renderer's lifetime.
      vrRenderDebug.animationLoopActive = animLoopActive;
      vrRenderDebug.normalRafActive = animLoopActive;
      updateVrBtn();
      showToast('VRセッションを開始できませんでした');
    }
  }

  function exitVr() {
    if (xrSession) xrSession.end().catch(() => {});
  }

  if (vrBtn) {
    vrBtn.addEventListener('click', () => { inVrSession ? exitVr() : enterVr(); });
  }
  checkXrSupport();

  // ============================================================
  // VR Observer Mode (v2.11)
  // ============================================================
  if (observerBtn) {
    observerBtn.addEventListener('click', () => {
      if (observerPanel) observerPanel.classList.toggle('open');
      renderObserverPanel();
    });
  }
  if (observerPanel) {
    const closeBtn = observerPanel.querySelector('#obs-close-btn');
    const startBtn = observerPanel.querySelector('#obs-start-btn');
    const endBtn = observerPanel.querySelector('#obs-end-btn');
    const viewerBtn = observerPanel.querySelector('#obs-viewer-btn');
    const copyBtn = observerPanel.querySelector('#obs-copy-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => observerPanel.classList.remove('open'));
    if (startBtn) startBtn.addEventListener('click', () => startObserverMode('observer'));
    if (endBtn) endBtn.addEventListener('click', endObserverMode);
    if (viewerBtn) viewerBtn.addEventListener('click', () => {
      showToast('ローカル同期は今後対応予定です（v2.11ではローカルデモのみ）');
    });
    if (copyBtn) copyBtn.addEventListener('click', () => {
      if (!observerState.sessionId) { showToast('セッションがありません'); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(observerState.sessionId)
          .then(() => showToast('セッションIDをコピーしました'))
          .catch(() => showToast('コピーに失敗しました'));
      } else {
        showToast('このブラウザではコピーに対応していません');
      }
    });
  }

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
      const fp = { id: genId(), name: f.name.replace(/\.[^.]+$/, ''), fileName: f.name, blobUrl, file: f, imgEl, rotationOffset: 0 };
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

    // ---- Observer Mode (v2.11): VR viewer marker, drawn on its own layer on top ----
    if (observerState.enabled && observerState.floorplanId === activeFloorplanId && observerState.markerId) {
      const om = projectState.markers.find(m => m.id === observerState.markerId);
      if (om) {
        const px = dx + om.x * dw;
        const py = dy + om.y * dh;
        const displayDeg = (observerState.yaw + (fp.rotationOffset || 0) + 360) % 360;
        _drawObserverMarker(ctx, px, py, displayDeg, observerState.fov);
      }
    }
  }

  function _drawObserverMarker(ctx, px, py, deg, fovDeg) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(deg * Math.PI / 180);

    // FOV cone — red/magenta, semi-transparent, behind the pin
    if (fovDeg != null) {
      const coneLen = 60;
      const halfFov = (fovDeg / 2) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, coneLen, -Math.PI / 2 - halfFov, -Math.PI / 2 + halfFov);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,64,96,0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,64,96,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Arrow pointing in look direction
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(7, -9); ctx.lineTo(-7, -9); ctx.closePath();
    ctx.fillStyle = '#ff3366';
    ctx.fill();

    // Circle body (slightly larger + offset to stay distinct from the blue current marker)
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,51,102,0.95)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label, drawn without rotation so text stays upright
    ctx.rotate(-(deg * Math.PI / 180));
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('VR', 0, -24);

    ctx.restore();
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
  function _buildProjectData() {
    return {
      appVersion:  '2.18.0',
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
  }

  function exportProjectJSON() {
    const data = _buildProjectData();
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
  // ZIP Project Package Export (v2.12)
  // ============================================================
  function _pad2(n) { return String(n).padStart(2, '0'); }

  async function exportProjectPackage() {
    if (typeof JSZip === 'undefined') { showGlobalError('JSZipの読み込みに失敗しました。'); return; }
    if (!scenes.length) { showToast('書き出すシーンがありません'); return; }
    showToast('パッケージを作成中…');
    try {
      const zip = new JSZip();
      const data = _buildProjectData();
      const missing = [];

      const fetchBlob = async (blobUrl) => {
        const res = await fetch(blobUrl);
        return res.blob();
      };
      // Prefer the originally retained File object; fall back to re-fetching the blob: URL
      // (covers scenes/floorplans restored before v2.12, where `.file` may be absent).
      const resolveBlob = (entity) => entity.file ? Promise.resolve(entity.file) : fetchBlob(entity.blobUrl);

      for (const s of scenes) {
        try {
          const blob = await resolveBlob(s);
          zip.file(`panoramas/${s.fileName || (s.name + '.jpg')}`, blob);
        } catch {
          missing.push(s.fileName || s.name);
        }
      }
      for (const f of projectState.floorplans) {
        try {
          const blob = await resolveBlob(f);
          zip.file(`floorplans/${f.fileName}`, blob);
        } catch {
          missing.push(f.fileName);
        }
      }

      zip.file('project.json', JSON.stringify(data, null, 2));
      zip.file('README.txt',
        'ArchView360 Project Package\n' +
        '============================\n\n' +
        'このZIPには以下が含まれます:\n' +
        '  - project.json      : シーン構成・マーカー・比較セットなどの設定\n' +
        '  - panoramas/         : パノラマ画像\n' +
        '  - floorplans/        : 平面図画像\n\n' +
        '開き方:\n' +
        '  ArchView360 (index.html) を開き、この ZIP ファイルをそのまま\n' +
        '  ドラッグ＆ドロップしてください。画像・平面図・設定がまとめて復元されます。\n\n' +
        'すべての処理はブラウザ内で行われ、外部送信は行われません。\n' +
        `書き出し日時: ${new Date().toISOString()}\n`
      );

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const now = new Date();
      const stamp = `${now.getFullYear()}${_pad2(now.getMonth()+1)}${_pad2(now.getDate())}_${_pad2(now.getHours())}${_pad2(now.getMinutes())}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ArchView360_Project_${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (missing.length) {
        showToast(`パッケージを書き出しました（一部画像が取得できませんでした: ${missing.join(', ')}）`);
      } else {
        showToast('パッケージ(ZIP)を書き出しました');
      }
    } catch (err) {
      showGlobalError(`パッケージの書き出しに失敗しました: ${err.message}`);
    }
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
        id: sd.id, name: sd.name, fileName: sd.fileName, blobUrl, file, // v2.12: retained for ZIP package export
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
      newFPs.push({ id: fd.id, name: fd.name, fileName: fd.fileName, blobUrl, file, imgEl, rotationOffset: fd.rotationOffset || 0 });
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

  // ============================================================
  // ZIP Project Package Import (v2.12)
  // ============================================================
  function openImportZip() { zipImportInput && zipImportInput.click(); }

  async function _doImportZipPackage(zipFile) {
    if (typeof JSZip === 'undefined') { showGlobalError('JSZipの読み込みに失敗しました。'); return; }
    showToast('パッケージを読み込み中…');
    let zip;
    try {
      zip = await JSZip.loadAsync(zipFile);
    } catch (err) {
      showGlobalError(`ZIPファイルの読み込みに失敗しました: ${err.message}`);
      return;
    }

    // Locate project.json anywhere in the archive (root or subfolder)
    const entries = Object.keys(zip.files).filter(name => !zip.files[name].dir);
    const jsonEntryName = entries.find(n => /(^|\/)project\.json$/i.test(n))
      || entries.find(n => n.toLowerCase().endsWith('.json'));
    if (!jsonEntryName) {
      showGlobalError('ZIP内にproject.jsonが見つかりませんでした。');
      return;
    }

    let importData;
    try {
      const jsonText = await zip.files[jsonEntryName].async('string');
      importData = JSON.parse(jsonText);
    } catch (err) {
      showGlobalError(`project.jsonの解析に失敗しました: ${err.message}`);
      return;
    }

    // Collect all image-like entries (panoramas/, floorplans/, or anywhere else) keyed by basename
    const imageEntryNames = entries.filter(n =>
      n !== jsonEntryName && !/readme\.txt$/i.test(n) && /\.(jpe?g|png|webp)$/i.test(n)
    );
    const fileList = [];
    for (const name of imageEntryNames) {
      const baseName = name.split('/').pop();
      try {
        const blob = await zip.files[name].async('blob');
        const ext = (baseName.split('.').pop() || '').toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        fileList.push(new File([blob], baseName, { type: mime }));
      } catch { /* skip unreadable entry; reported as missing below */ }
    }

    // Detect files referenced by project.json but absent from the archive
    const availableNames = new Set(fileList.map(f => f.name));
    const expectedNames = [
      ...((importData.scenes || []).map(s => s.fileName)),
      ...((importData.floorplans || []).map(f => f.fileName)),
    ].filter(Boolean);
    const missing = expectedNames.filter(n => !availableNames.has(n));

    _importData = importData;
    _doImportWithFiles(fileList);

    if (missing.length) {
      showToast(`一部の画像がZIP内に見つかりませんでした: ${missing.join(', ')}`);
    }
  }

  if (zipImportInput) {
    zipImportInput.addEventListener('change', () => {
      const f = zipImportInput.files[0];
      zipImportInput.value = '';
      if (f) _doImportZipPackage(f);
    });
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
    const dropped = Array.from(e.dataTransfer.files);
    const zipFiles = dropped.filter(f => f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip' || f.type === 'application/x-zip-compressed');
    if (zipFiles.length > 0) { _doImportZipPackage(zipFiles[0]); return; }
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
  if (exportPackageBtn) exportPackageBtn.addEventListener('click', exportProjectPackage);
  if (importPackageBtn) importPackageBtn.addEventListener('click', openImportZip);

  // Upload-page "設定JSONから開く" button
  const openJsonBtn = document.getElementById('open-json-btn');
  if (openJsonBtn) openJsonBtn.addEventListener('click', openImportJSON);

  // Upload-page "プロジェクトZIPから開く" button
  const openZipBtn = document.getElementById('open-zip-btn');
  if (openZipBtn) openZipBtn.addEventListener('click', openImportZip);

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
