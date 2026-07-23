'use strict';

/* ============================================================
 * ArchView360
 * Three.js 0.169.0 ローカル同梱
 * （vendor/three.module.min.js + vendor/three-global.js シム経由で
 *   window.THREE として公開される。WebXR-Sandbox 実機検証と同一バージョン）
 * ============================================================ */

// ============================================================
// HistoryManager — Undo/Redo foundation (not yet wired to any
// editing operation; this commit only adds the stack + registration
// API described in the Roadmap task).
// ============================================================
//
// Kept as a standalone, DOM/THREE-free class (defined outside init())
// rather than in a separate file, since index.html can't gain a new
// <script> tag to load one and this app has no bundler/module loader —
// script.js itself is loaded as a single classic script. Being
// self-contained also means it's independently testable without
// waiting on THREE.js/app init.
//
// Command-pattern, not snapshot-based: the existing ~30 mutation call
// sites (markProjectDirty() callers across scenes/markers/floorplans/
// groups/compareSets/projectInfo) each already know their own
// before/after values at the point of mutation (e.g. a rename handler
// has both the old and new name in scope). Capturing an {undo, redo}
// closure pair right there is a small, local addition per call site
// when that wiring happens later. A snapshot/diff approach would need
// a generic deep-clone of heterogeneous state (including scene
// blobUrl/File references that can't be JSON-cloned) and a separate
// diffing step, which is more machinery than this foundation needs
// before any real operation is connected.
//
// Intentionally NOT in scope for undo/redo (per the Roadmap task):
// Import/Export (JSON/ZIP) — these load/save whole-project state, not
// a single editing action; Viewer/Editor mode switching — never
// mutates project data; Dirty State itself — a derived indicator, not
// an editable value.
class HistoryManager {
  constructor({ maxSize = 100, onChange } = {}) {
    this.maxSize = maxSize;
    this._undoStack = [];
    this._redoStack = [];
    // Optional UI-notification hook: called after every stack change
    // (push/undo/redo — including a failed undo/redo, since the entry
    // still moves between/back onto a stack — and clear), so a caller
    // can keep e.g. button disabled-state in sync without polling
    // canUndo()/canRedo() itself. Never called from inside this class
    // for any other reason, and this class never touches the DOM —
    // the callback is the caller's own function.
    this.onChange = typeof onChange === 'function' ? onChange : null;
  }

  _notify() {
    if (this.onChange) this.onChange();
  }

  // Registers an action that has ALREADY been applied. `entry.undo()`
  // reverts it, `entry.redo()` re-applies it; neither runs at
  // registration time. `entry.label` is optional, for future UI/debug
  // display only. Pushing a new entry always clears the redo stack —
  // the standard rule that a fresh action invalidates the redone-away
  // branch of history.
  push(entry) {
    if (!entry || typeof entry.undo !== 'function' || typeof entry.redo !== 'function') {
      throw new TypeError('HistoryManager.push() requires an { undo, redo } entry');
    }
    this._undoStack.push({ label: entry.label || null, undo: entry.undo, redo: entry.redo });
    if (this._undoStack.length > this.maxSize) this._undoStack.shift();
    this._redoStack.length = 0;
    this._notify();
  }

  canUndo() { return this._undoStack.length > 0; }
  canRedo() { return this._redoStack.length > 0; }

  undo() {
    if (!this.canUndo()) return false;
    const entry = this._undoStack.pop();
    try {
      entry.undo();
    } catch (err) {
      this._undoStack.push(entry); // failed — keep it on the undo side, not lost
      this._notify();
      throw err; // never swallowed; caller decides how to handle it
    }
    this._redoStack.push(entry);
    this._notify();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    const entry = this._redoStack.pop();
    try {
      entry.redo();
    } catch (err) {
      this._redoStack.push(entry); // failed — keep it on the redo side, not lost
      this._notify();
      throw err; // never swallowed; caller decides how to handle it
    }
    this._undoStack.push(entry);
    this._notify();
    return true;
  }

  clear() {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
    this._notify();
  }

  get undoCount() { return this._undoStack.length; }
  get redoCount() { return this._redoStack.length; }
}
// Exposed for testing only (class declarations aren't auto-global like
// function/var); never referenced by any UI or editing code in this
// commit.
window.HistoryManager = HistoryManager;

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
  const undoBtn            = $('undo-btn');
  const redoBtn            = $('redo-btn');

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

  // App Mode (Viewer / Editor) switch — foundation
  const appModeLabel       = $('app-mode-label');
  const appModeToggleBtn   = $('app-mode-toggle-btn');

  // Viewer Preview (Phase 1)
  const viewerPreviewBtn     = $('viewer-preview-btn');
  const viewerPreviewExitBtn = $('viewer-preview-exit-btn');

  // Dirty State (unsaved changes) — foundation
  const dirtyIndicator         = $('dirty-indicator');
  const dirtyConfirmModal      = $('dirty-confirm-modal');
  const dirtyConfirmCloseBtn   = $('dirty-confirm-close-btn');
  const dirtyConfirmCancelBtn  = $('dirty-confirm-cancel-btn');
  const dirtyConfirmDiscardBtn = $('dirty-confirm-discard-btn');
  const dirtyConfirmBodyEl     = $('dirty-confirm-modal-body');

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
  //
  // v2.20.2: Quest 3 real-device testing found the ring's synthetic,
  // evenly-spaced item layout doesn't correspond to the actual direction of
  // each linked scene inside the 360° panorama, which reads as disorienting
  // now that the minimap (below) offers a spatially-grounded alternative.
  // Scene Ring is temporarily suspended via this single feature flag rather
  // than removed — all ring functions/state below are left fully intact so
  // the ring can be re-enabled in one line once a future version aligns ring
  // item positions with real in-panorama link directions (or a spatial-link
  // system replaces it outright). Flipping this back to `true` alone is NOT
  // sufficient to restore the old Left Menu binding — see
  // _toggleVrMinimapModeViaMenu()'s comment for that half of the handoff.
  const VR_SCENE_RING_ENABLED = false;
  let vrRingGroup = null;      // THREE.Group holding the ring item sprites (VR-only, never created outside a session)
  let vrRingItems = [];        // { mesh, sceneIdx, name, normalTexture, hoverTexture, baseScale }[]
  // Hover is tracked per hand so each laser can only be confirmed by the
  // trigger of the same hand (left trigger never fires the right laser's
  // target and vice versa).
  const vrRingHovered = { left: null, right: null }; // ring item record | null
  let vrController1 = null, vrController2 = null; // renderer.xr.getController(0/1)
  let vrControllerLaser1 = null, vrControllerLaser2 = null;
  // v2.20.2: small always-camera-facing dots marking each laser's
  // intersection with the minimap plane while expanded (real Quest 3
  // feedback: "拡大中にController laserが見えず照準位置が分かりにくい").
  // Built once alongside the lasers in _createVrSceneRing() regardless of
  // VR_SCENE_RING_ENABLED — they belong to the controller/laser runtime the
  // minimap shares with Scene Ring, not to Scene Ring itself. Sprites here
  // are purely decorative (never raycast targets), so they don't conflict
  // with the "Mesh raycasting only" rule that applies to minimap marker
  // hit-testing.
  let vrLaserHitDot1 = null, vrLaserHitDot2 = null;
  let vrLaserHitDotTexture = null;
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
  // inputActive (v2.20.2): whether Ring hover/select processing actually ran
  // this frame — VR_SCENE_RING_ENABLED && vrRingEnabled && !fading &&
  // !minimapExpanded, mirrored here so the Debug panel (which can't see
  // _updateVrSceneRing()'s local vars) can show "Scene Ring input active".
  const vrRingDebug = { hoveredLeft: '-', hoveredRight: '-', selectedName: '-', lastError: '-', inputActive: false };

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

  // ---- VR Floor Navigation (v2.19) ----
  // Floors are existing FloorMap floor plans (projectState.floorplans); no
  // new project data. Bound to left/right stick-click (button[3]) — real
  // hardware mapping confirmed by the project owner (this project's own
  // measurement, not the axes this button-click is distinct from), and
  // otherwise unused everywhere else in this file (_vrActionForButton only
  // maps #4/#5; Trigger is #0; Ring toggle is #12). Same per-hand
  // armed/pressed edge-detection pattern as vrRingTrigger, so a stick
  // already held down when the VR session starts can never fire an
  // immediate floor change.
  const vrFloorStick = {
    left:  { pressed: false, armed: false },
    right: { pressed: false, armed: false }
  };
  // Per-floorplan "last viewed scene index this VR session" — session-local
  // only, never persisted to project JSON/ZIP; cleared on VR session end.
  let vrFloorLastScene = new Map();
  const vrFloorDebug = { lastAction: '-', lastError: '-' };

  // ---- VR Minimap Navigation (v2.20, two-stage v2.20.1) ----
  // A second camera-parented CanvasTexture panel (same construction pattern
  // as the main HUD) showing the CURRENT floor's FloorMap image and its
  // markers, with the current-scene marker highlighted. No new project
  // data: reuses projectState.floorplans / projectState.markers / the same
  // normalized [0,1]-within-letterbox marker coordinate system the normal
  // 2D FloorMap panel already uses (renderFloormapCanvas/_canvasToImage).
  // Markers are drawn into the canvas, not built as individual THREE
  // objects — hit-testing intersects the single plane mesh and converts the
  // local-space hit point to canvas pixels, then matches against a cached
  // per-floor marker position list.
  //
  // Real Quest 3 testing of the always-small single-panel v2.20 design
  // found direct marker selection on the small corner panel impractical.
  // v2.20.1 splits this into two modes sharing ONE mesh/canvas/texture
  // (resized via mesh.scale + a mode-specific canvas resolution, never
  // recreated per-frame):
  //   'compact'  — the original small bottom-right panel, always visible,
  //                camera-following. No per-marker hit-testing: the whole
  //                panel is a single hover/select target. Trigger on it
  //                enters 'expanded'; it never jumps scenes directly.
  //   'expanded' — a large panel just below view-center, big enough for
  //                real per-marker aiming. Individual markers are
  //                hover/select targets; Trigger on a marker jumps (reusing
  //                the same Fade Out -> switchToScene -> Fade In machinery)
  //                and returns to 'compact'; Trigger on the panel
  //                background/anywhere else while expanded also returns to
  //                'compact' without jumping. Scene Ring hover/select is
  //                fully suspended (and the ring hidden) while expanded, so
  //                the two can never compete for the same Trigger press.
  // Trigger selection shares vrRingTrigger's armed/pressed state with Scene
  // Ring (one physical button, one state machine, one priority check) so
  // compact-panel-select / expanded-marker-select / expanded-close /
  // Ring-select can never double-fire off a single press, and switching
  // mode always consumes the press (armed=false) so the newly-entered mode
  // requires a fresh release+press before it reacts to anything.
  const VR_MINIMAP_CANVAS_SIZE = 640;      // px, shared square canvas resolution for both modes
  const VR_MINIMAP_TITLE_H = 56;           // px reserved at the top of the canvas for the floor-name title
  const VR_MINIMAP_MARGIN = 14;            // px inset before the letterboxed floor image area
  const VR_MINIMAP_HIT_RADIUS = 34;        // px, canvas-space hit-test radius around a marker's drawn position (expanded mode only)
  const VR_MINIMAP_COMPACT_PLANE_SIZE = 0.46;  // meters — unchanged from the v2.20 single-panel size/position
  const VR_MINIMAP_COMPACT_POSITION = { x: 1.15, y: -0.70, z: -2.0 };
  const VR_MINIMAP_EXPANDED_PLANE_SIZE = 1.3;  // meters — large enough for real per-marker aiming on Quest 3
  const VR_MINIMAP_EXPANDED_POSITION = { x: 0, y: -0.35, z: -1.6 }; // just below view-center, closer than the main HUD so it reads as a distinct overlay
  let vrMinimapMesh = null, vrMinimapCanvas = null, vrMinimapCtx = null, vrMinimapTexture = null;
  let vrMinimapMode = 'compact'; // 'compact' | 'expanded' — session-local only, never persisted
  let vrMinimapMarkers = [];          // [{ id, sceneIdx, name, px, py }] for the current floor only, rebuilt on floor change
  let vrMinimapCurrentMarkerId = null;
  const vrMinimapHovered = { left: null, right: null };       // expanded mode: marker record | null
  const vrMinimapCompactHovered = { left: false, right: false }; // compact mode: whole-panel hit | not
  let vrMinimapPendingFloorChange = false; // set in _updateVrRingFade's 'out' stage, consumed at fade-in completion
  // ---- VR Minimap Left Menu toggle (v2.20.2) ----
  // With Scene Ring suspended (VR_SCENE_RING_ENABLED), Left Menu
  // (button[12]) is repurposed from "toggle ring visibility" to "toggle
  // minimap compact/expanded" — this is now the primary open/close control
  // (compact-panel Trigger remains a secondary way to expand). Same
  // armed/pressed edge-detection shape as vrRingTrigger/vrFloorStick so a
  // held Menu button can never repeat-toggle. Entirely separate from
  // vrRingTogglePrevPressed (left untouched below, in the Ring section) so
  // Scene Ring's own Menu binding can be restored with a one-line change if
  // VR_SCENE_RING_ENABLED is ever flipped back on.
  const vrMinimapMenuToggle = { pressed: false, armed: false };
  const vrMinimapDebug = {
    mode: 'compact', floorName: '-', markerCount: 0, imageLoaded: false, imageBounds: '-',
    currentMarkerId: '-', hoveredLeft: '-', hoveredRight: '-',
    compactHoverLeft: false, compactHoverRight: false,
    rayHitLeft: false, rayHitRight: false, switching: false, ringSuspended: false,
    lastAction: '-', lastError: '-', closeReason: '-',
    // v2.20.2: toggle source ('menu' | 'compact-trigger' | 'background-close'
    // | 'scene-switch' | 'floor-switch'), Left Menu armed state, and
    // controller-laser hit feedback (see _updateVrSceneRing).
    toggleSource: '-', menuArmed: false, laserVisible: false, laserHand: '-',
    laserHitX: null, laserHitY: null
  };

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

  // ============================================================
  // App Mode (Viewer / Editor) — foundation (v2.21)
  // ============================================================
  // Application-wide mode, independent of View Type. Panorama / Compare /
  // Slider / VR remain "what you're looking at" (View Type) and are
  // unaffected by this; appMode instead governs whether project data
  // (scenes/projectState/compareSets) can be mutated at all, and whether
  // save/export can run. VR is not a separate mode here — VR's own
  // read-only viewing (panorama, Minimap navigation, Scene Ring — the
  // latter currently disabled via VR_SCENE_RING_ENABLED, unrelated to and
  // unchanged by this feature) works the same in both Viewer and Editor;
  // no VR-side editing UI exists or is added by this change.
  //
  // Session-local only: never read from or written to project JSON, ZIP,
  // localStorage, or a URL parameter. Every page load/reload always starts
  // in 'viewer' — there is no restore path for 'editor' at all, so this
  // requirement can't regress by omission.
  //
  // UI code must never assign to `appMode` directly. All transitions go
  // through enterViewerMode() / enterEditorMode() / requestEditorAccess()
  // so there is exactly one place (`renderModeUi()`) that reacts to a
  // mode change, and exactly one seam (`requestEditorAccess()`) where a
  // future auth/license/permission check can be inserted without touching
  // any button handler.
  let appMode = 'viewer'; // 'viewer' | 'editor'

  function getAppMode() { return appMode; }

  // The single predicate every mutation guard below calls. Kept
  // deliberately trivial today so future gating logic only needs to
  // change requestEditorAccess() (how you GET to 'editor'), not this
  // check (what 'editor' is allowed to do).
  function canMutateProject() { return appMode === 'editor'; }

  // Call at the top of any function that writes to scenes/projectState/
  // compareSets, or starts a save/export. Returns false (and the caller
  // must then return without acting) when not in Editor mode. Logs to
  // console and shows one toast so hidden DOM, keyboard shortcuts,
  // context-menu items, or a direct console call can never silently
  // mutate project data while Viewing. `label` is a short user-facing
  // description of the blocked action, not an internal function name.
  function assertEditorMode(label) {
    if (appMode === 'editor') return true;
    console.warn(`[ArchView360] Viewer mode: blocked "${label}"`);
    showToast('Viewerモードのため実行できません（Editorへ切り替えてください）');
    return false;
  }

  function enterViewerMode() {
    if (appMode === 'viewer') return;
    appMode = 'viewer';
    renderModeUi();
  }

  function enterEditorMode() {
    // Defensive, not just the normal path: this is the only place that ever
    // sets appMode to 'editor', so clearing previewActive here (rather than
    // only in exitViewerPreview()) guarantees Preview's session flag can
    // never survive a return to Editor, even via a hidden/forced/legacy
    // path that bypasses exitViewerPreview() itself.
    previewActive = false;
    if (appMode === 'editor') return;
    appMode = 'editor';
    renderModeUi();
  }

  // The only sanctioned entry point for switching INTO Editor — UI event
  // handlers call this, never enterEditorMode() directly. Today it is a
  // straight passthrough; this indirection exists so a future
  // auth -> license -> permission check sequence can be inserted here
  // without any call site (the toggle button, or anything else) changing.
  function requestEditorAccess() {
    enterEditorMode();
  }

  // Applies the current mode to the DOM: a body-level class pair that
  // `.viewer-only` / `.editor-only` CSS rules key off, plus the mode
  // switch UI's own label/button text. Called once at startup and on
  // every mode transition. Pure class/text toggling — never rebuilds or
  // reattaches listeners, never recreates a renderer/scene/VR object, so
  // repeated toggling cannot duplicate events or objects.
  function renderModeUi() {
    const editing = appMode === 'editor';
    document.body.classList.toggle('mode-editor', editing);
    document.body.classList.toggle('mode-viewer', !editing);
    if (appModeLabel) appModeLabel.textContent = editing ? 'Editor' : (previewActive ? 'Viewer (Preview)' : 'Viewer');
    if (appModeToggleBtn) {
      appModeToggleBtn.textContent = editing ? 'Viewerで確認' : 'Editorへ切替';
      appModeToggleBtn.title = editing
        ? 'Viewer表示に戻ります（表示のみ・編集はできません）'
        : 'Editorに切り替えて編集機能を利用します';
      // Preview reuses real Viewer mode, so the normal toggle button would
      // otherwise sit right next to the dedicated Preview-exit button in
      // the exact same state (appMode === 'viewer'). Hiding it during
      // Preview is what keeps the two return-to-Editor paths from being
      // confused with each other — see startViewerPreview()/
      // exitViewerPreview() below.
      appModeToggleBtn.style.display = previewActive ? 'none' : '';
    }
    if (viewerPreviewExitBtn) viewerPreviewExitBtn.style.display = previewActive ? '' : 'none';
    document.body.classList.toggle('preview-active', previewActive);
    updateHistoryControls();
  }

  // ============================================================
  // Viewer Preview (Phase 1, v2.22.x+)
  // ============================================================
  // Lets Editor temporarily see the project exactly as Viewer mode shows
  // it, without leaving Editor's own confirm/dirty semantics behind.
  // Deliberately reuses the real 'viewer' appMode as-is — there is no
  // third appMode value — so every existing mutation guard
  // (assertEditorMode()/canMutateProject(), all ~54 call sites),
  // editor-only CSS, and Export gating keeps working completely
  // unmodified. previewActive is a separate session-local flag layered on
  // top of appMode purely to (a) know which of the two return-to-Editor
  // buttons to show, and (b) skip the normal switch-to-viewer confirmation
  // (Preview never actually leaves Editor's data, so nothing needs
  // confirming). Never persisted to JSON/ZIP/localStorage — matches
  // appMode's and Dirty State's own non-persistence contract.
  let previewActive = false;

  // Starts Preview only from Editor — this is an Editor-only operation
  // (the button itself is also `.editor-only`, but the mutation-guard
  // lesson from PR #13 is that CSS visibility alone is never the actual
  // boundary, so this checks appMode directly too). Skips
  // confirmUnsavedChanges('switch-to-viewer') entirely: Preview keeps all
  // in-memory project data untouched and returns to the exact same Editor
  // state, so there is nothing to confirm and nothing to mark dirty.
  function startViewerPreview() {
    if (appMode !== 'editor') return;
    if (inVrSession) { showToast('VR表示中はプレビューを開始できません'); return; }
    previewActive = true;
    enterViewerMode(); // real Viewer mode — every existing guard applies unchanged
  }

  // Returns to Editor from Preview. Also reachable defensively via
  // enterEditorMode() itself clearing previewActive, so this never leaves
  // the flag set if Editor is reached by some other path.
  function exitViewerPreview() {
    if (!previewActive) return;
    previewActive = false;
    requestEditorAccess(); // real Editor entry point — unchanged
  }

  // ============================================================
  // Dirty State (unsaved changes) — foundation (v2.21.x)
  // ============================================================
  // Tracks whether project data has unsaved changes. Independent of
  // appMode, but only ever reachable through it: every function that
  // writes to scenes/projectState/compareSets is already gated by
  // assertEditorMode()/canMutateProject() (see App Mode above), so
  // markProjectDirty() is only ever called after a real Editor-mode
  // mutation actually succeeds — Viewer itself can never become dirty.
  //
  // Session-local only: never read from or written to project JSON, ZIP,
  // localStorage, or a URL parameter, and never restored after reload —
  // matches appMode's non-persistence contract exactly. Every page
  // load/reload always starts clean.
  //
  // UI code must never assign to `projectDirty` directly. All transitions
  // go through markProjectDirty()/markProjectClean() so there is exactly
  // one place (renderDirtyUi()) that reacts to a change.
  let projectDirty = false;
  let _lastDirtyReason = null; // last transition's reason, for debugging only — never displayed or persisted
  const _baseDocumentTitle = document.title;

  function isProjectDirty() { return projectDirty; }

  // Call immediately after a mutation has actually been applied to
  // scenes/projectState/compareSets — never at the start of a handler, and
  // never before a guard/validation/cancel check. `reason` is a short
  // internal label (mirrors assertEditorMode()'s `label`), not shown to
  // the user.
  function markProjectDirty(reason) {
    if (projectDirty) return; // no-op if already dirty; avoids redundant renders
    projectDirty = true;
    _lastDirtyReason = reason || null;
    renderDirtyUi();
  }

  // Call after a save/export actually completes, or after a load/import
  // fully replaces the working state with content that has no unsaved
  // edits of its own (fresh open, successful restore, or an explicit
  // discard). Never call this before an async save's success is known.
  function markProjectClean(reason) {
    if (!projectDirty) return;
    projectDirty = false;
    _lastDirtyReason = reason || null;
    renderDirtyUi();
  }

  function renderDirtyUi() {
    if (dirtyIndicator) dirtyIndicator.style.display = projectDirty ? '' : 'none';
    document.title = projectDirty ? `* ${_baseDocumentTitle}` : _baseDocumentTitle;
  }

  // ============================================================
  // Unsaved-changes confirmation (Dirty State) — foundation (v2.21.x/2.22.x)
  // ============================================================
  // The single shared gate in front of any operation that needs the user's
  // acknowledgement of unsaved Editor changes. Two contexts, because they
  // mean genuinely different things and must never share copy or a result
  // token:
  //
  //   'switch-to-viewer' — Editor -> Viewer. This NEVER touches project
  //   data (Viewer keeps browsing the same in-memory state), so nothing is
  //   actually discarded here. Resolves 'continue-without-saving' (user
  //   acknowledged and wants to proceed) or 'cancel'. The caller must NOT
  //   call markProjectClean() on 'continue-without-saving' — the unsaved
  //   changes are still unsaved after the switch.
  //
  //   'replace-project' — an operation that actually overwrites/merges
  //   into current project data (JSON/ZIP import into a non-empty
  //   project, or clearing the project). Resolves 'discard-and-continue'
  //   or 'cancel'. Here the caller's own mutation logic determines the
  //   resulting dirty/clean state (e.g. clearAllAndShowUpload({markClean})
  //   or the import's own post-merge markProjectDirty()).
  //
  // Resolves immediately (no dialog) when clean, since there is nothing to
  // acknowledge. Never stacks a second dialog.
  //
  // This PR intentionally offers only continue/discard + Cancel from the
  // dialog itself, not a third "save and continue" option — see PR body
  // for the reasoning (no single canonical save action exists: JSON
  // export and ZIP export are two separate, format-choosing actions, and
  // guessing one on the user's behalf risks silently saving the wrong
  // artifact). Saving remains an explicit, separate action via the
  // existing export buttons, done before triggering the operation that
  // needs this gate.
  const DIRTY_CONFIRM_COPY = {
    'switch-to-viewer': {
      body: '編集中の内容はまだ保存されていません。保存せずにViewerへ移動しても、編集内容はメモリ上に残り、Editorへ戻れば引き続き編集できます。ただし保存されるまでは、ページの再読み込みやファイルを開く操作で失われる可能性があります。',
      confirmLabel: '保存せずViewerへ移動',
      confirmClass: 'btn-primary',
      resultToken: 'continue-without-saving',
    },
    'replace-project': {
      body: 'このまま続行すると、保存していない変更が失われます。保存する場合は先にキャンセルし、既存の「設定を書き出し」または「パッケージ書き出し」から保存してください。',
      confirmLabel: '破棄して続行',
      confirmClass: 'btn-danger',
      resultToken: 'discard-and-continue',
    },
  };
  let _dirtyConfirmResolve = null;
  let _dirtyConfirmActiveCopy = null;

  function confirmUnsavedChanges(context) {
    if (!projectDirty) return Promise.resolve('proceed');
    if (_dirtyConfirmResolve) return Promise.resolve('cancel'); // already open — never stack a second dialog
    const copy = DIRTY_CONFIRM_COPY[context];
    _dirtyConfirmActiveCopy = copy;
    if (dirtyConfirmBodyEl) dirtyConfirmBodyEl.textContent = copy.body;
    if (dirtyConfirmDiscardBtn) {
      dirtyConfirmDiscardBtn.textContent = copy.confirmLabel;
      dirtyConfirmDiscardBtn.classList.remove('btn-primary', 'btn-danger');
      dirtyConfirmDiscardBtn.classList.add(copy.confirmClass);
    }
    showEl(dirtyConfirmModal);
    return new Promise((resolve) => { _dirtyConfirmResolve = resolve; });
  }

  function _closeDirtyConfirmModal(result) {
    hideEl(dirtyConfirmModal);
    const resolve = _dirtyConfirmResolve;
    _dirtyConfirmResolve = null;
    _dirtyConfirmActiveCopy = null;
    if (resolve) resolve(result);
  }

  if (dirtyConfirmDiscardBtn) {
    dirtyConfirmDiscardBtn.addEventListener('click', () => {
      _closeDirtyConfirmModal(_dirtyConfirmActiveCopy ? _dirtyConfirmActiveCopy.resultToken : 'cancel');
    });
  }
  if (dirtyConfirmCancelBtn)  dirtyConfirmCancelBtn.addEventListener('click',  () => _closeDirtyConfirmModal('cancel'));
  if (dirtyConfirmCloseBtn)   dirtyConfirmCloseBtn.addEventListener('click',   () => _closeDirtyConfirmModal('cancel'));
  if (dirtyConfirmModal) {
    dirtyConfirmModal.addEventListener('click', (e) => {
      if (e.target === dirtyConfirmModal) _closeDirtyConfirmModal('cancel');
    });
  }

  // beforeunload: always attached, but only actually warns while dirty —
  // never added/removed dynamically, so it can't fall out of sync with
  // projectDirty. Viewer can never be dirty (see above), so browsing-only
  // sessions never see this warning; it fires only for unsaved Editor
  // changes, matching the browser's own generic warning text (custom
  // messages are ignored by modern browsers regardless).
  window.addEventListener('beforeunload', (e) => {
    if (!projectDirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  // ---- Project State ----
  const projectState = {
    projectName: 'Untitled Project',
    projectInfo: { client: '', author: '', date: '', notes: '' },
    floorplans: [], // { id, name, fileName, blobUrl, imgEl }
    markers:    [], // { id, floorplanId, sceneId, x, y, rotation, name }
    groups:     [], // { id, name } — scene groupings
  };

  // Reflects HistoryManager's current undo/redo availability onto the
  // Undo/Redo toolbar buttons. Called after the manager is created, after
  // every push/undo/redo/clear (via the onChange hook below), and after
  // every Viewer/Editor mode switch (see renderModeUi()). Editor-only
  // visibility itself is handled by the existing `.editor-only` CSS rule
  // (the buttons carry that class already); this only ever toggles
  // `disabled`, which is meaningless-but-harmless while hidden in Viewer.
  function updateHistoryControls() {
    if (!undoBtn || !redoBtn) return;
    undoBtn.disabled = !historyManager.canUndo();
    redoBtn.disabled = !historyManager.canRedo();
  }

  // Undo/Redo foundation (see HistoryManager above). Scene renaming (see
  // applySceneName()), single-view and compare-mode scene flip (see
  // applySceneFlip()), and FloorMap renaming (see applyFloorMapName())
  // are the only editing operations wired into it so far — every other
  // mutation (scenes add/delete/reorder, markers, floorplan add/delete,
  // groups, compare sets, project info, Import/Export) is still
  // unconnected.
  const historyManager = new HistoryManager({ maxSize: 100, onChange: updateHistoryControls });
  updateHistoryControls(); // set the buttons' initial (empty-history) disabled state
  // Test-only hook: there is no Undo/Redo keyboard/UI test seam otherwise,
  // so Playwright can reach the manager directly. Deliberately named
  // differently from window.HistoryManager (the class, exposed for the
  // same reason) since this is a specific instance, not the constructor.
  // Never read by any production/UI code path.
  window.__historyManagerForTests = historyManager;

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
    if (!assertEditorMode('マーカー番号変更')) return false;
    const v = parseInt(newOrder, 10);
    if (!Number.isInteger(v) || v < 1) return false;
    const mk = projectState.markers.find(m => m.id === markerId);
    if (!mk) return false;
    mk.order = v;
    _resolveOrderConflicts(mk.floorplanId, markerId);
    markProjectDirty('マーカー番号変更');
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
    if (!assertEditorMode('マーカー番号整理')) return;
    const targets = projectState.markers
      .filter(m => m.floorplanId === activeFloorplanId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!targets.length) return; // nothing to renumber — not a mutation
    targets.forEach((m, i) => { m.order = i + 1; });
    markProjectDirty('マーカー番号整理');
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
    // WebGL context loss is involuntary — never a confirmed user decision
    // to discard unsaved work — so this recovery reset must not clear an
    // existing dirty flag.
    viewerCanvas.addEventListener('webglcontextrestored', () => clearAllAndShowUpload({ markClean: false }));
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

    // Opening files into an empty project ("view this") is allowed in
    // Viewer mode; adding more to an already-loaded project is editing
    // and requires Editor. Guarded here (not at each button handler)
    // because add-img-btn / add-scene-btn / Ctrl+O / viewer drag&drop all
    // funnel into this one function via the shared fileInput.
    if (!wasEmpty && !assertEditorMode('画像追加')) return;

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
      // Opening files as a fresh project is a load, not an edit — always
      // ends clean, regardless of which mode opened it in.
      markProjectClean('新規プロジェクトを開く');
      showViewerLayout();
      initThree();
      requestAnimationFrame(() => {
        fitSingleCanvas();
        switchToScene(0);
      });
      renderCompareSets();
    } else {
      markProjectDirty('画像追加');
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
    if (!assertEditorMode('シーン画像の更新')) return;
    _replaceTargetIdx = idx;
    replaceSceneInput.value = '';
    replaceSceneInput.click();
  }

  replaceSceneInput.addEventListener('change', () => {
    const f = replaceSceneInput.files[0];
    const idx = _replaceTargetIdx;
    _replaceTargetIdx = -1;
    if (!f || idx < 0 || idx >= scenes.length) return;
    // Defense-in-depth: openReplaceScenePicker() already guards entry, but
    // this is the actual mutation point (native file picker 'change' can
    // fire after a mode switch race, or via a direct programmatic call on
    // the hidden input), so it gets its own check too.
    if (!assertEditorMode('シーン画像の更新')) return;

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
    markProjectDirty('シーン画像の更新');

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
    if (!assertEditorMode('シーン削除')) return;
    URL.revokeObjectURL(scenes[idx].blobUrl);
    const wasCurrent = idx === currentIdx;
    if (wasCurrent) stopRender();
    if (compareState.mode !== 'single') exitCompareMode(true);
    scenes.splice(idx, 1);
    // Mark dirty for the delete itself before the possible cascade below —
    // deleting the last scene wasn't confirmed through
    // confirmUnsavedChanges(), and it also wipes floorplans/markers/groups
    // via clearAllAndShowUpload(), so this must not silently present as
    // clean just because the project ends up empty.
    markProjectDirty('シーン削除');

    if (!scenes.length) {
      disposeCurrentSphere();
      clearAllAndShowUpload({ markClean: false });
      return;
    }
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
    if (!assertEditorMode('シーン並び替え')) return;
    const [moved] = scenes.splice(fromIdx, 1);
    scenes.splice(toIdx, 0, moved);
    markProjectDirty('シーン並び替え');

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

  // markClean defaults to false: this function is also called from
  // forced/automatic recovery paths (WebGL context restore, error
  // recovery) where the reset is involuntary, not a confirmed user
  // decision to start fresh — those must NOT silently clear an unsaved
  // dirty flag. Only call sites that represent a genuinely confirmed,
  // intentional "start a new empty project" pass markClean: true.
  function clearAllAndShowUpload({ markClean = false } = {}) {
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
    // The project data itself is always empty/pristine after this point,
    // but whether that counts as an acknowledged "clean" state depends on
    // *why* this ran — see markClean's doc comment above and each call
    // site. The discard *confirmation* before an intentional clear lives
    // at the clear-all-btn/back-btn handlers, not in this shared reset
    // function.
    if (markClean) markProjectClean('プロジェクトをクリア');
  }

  // ============================================================
  // Scene renaming — first operation wired into HistoryManager (v2.22.x+)
  // ============================================================
  // Single point that actually applies a scene's name and refreshes every
  // place that currently displays it (sidebar list, current-scene label,
  // and — matching the rename handler's pre-existing behavior — the
  // compare-mode select labels when compare mode is active). Used both
  // for a live user rename and for undo/redo replaying a past rename, so
  // there is exactly one place that needs to stay in sync with whatever
  // the sidebar/labels actually show.
  //
  // Always marks the project dirty, including when called from undo/redo:
  // those are real changes to the working state relative to whatever was
  // last saved, matching Dirty State's existing "never auto-clean" rule —
  // undoing back to a previously-saved name does not by itself mean the
  // project is saved again.
  //
  // Never calls historyManager.push() itself — only the rename commit
  // handler below does, at the single point a user actually confirms a
  // new name. That keeps undo()/redo() (which call this function) from
  // ever recording a new history entry while replaying one.
  function applySceneName(sceneId, name) {
    const s = scenes.find(sc => sc.id === sceneId);
    if (!s) return;
    s.name = name;
    renderSceneList();
    if (currentIdx >= 0 && scenes[currentIdx] && scenes[currentIdx].id === sceneId) {
      currentSceneNameEl.textContent = name;
    }
    if (compareState.mode !== 'single') updateCompareSelects();
    markProjectDirty('シーン名称変更');
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
      renameBtn.className = 'scene-group-rename-btn editor-only';
      renameBtn.title = 'グループ名を変更';
      renameBtn.textContent = '✏';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _startGroupRename(hdr, group, nameSpan, renameBtn);
      });

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'scene-group-del-btn editor-only';
      delBtn.title = 'グループを削除';
      delBtn.textContent = '🗑';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!assertEditorMode('グループ削除')) return;
        if (!confirm('グループを削除しますか？シーンは削除されません。未分類へ移動します。')) return;
        scenes.forEach(s => { if (s.groupId === gid) s.groupId = null; });
        projectState.groups = projectState.groups.filter(g => g.id !== gid);
        collapsedGroups.delete(gid);
        markProjectDirty('グループ削除');
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
    li.draggable = canMutateProject();
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
      if (!canMutateProject()) return;
      nameEl.contentEditable = 'true';
      nameEl.classList.add('editing');
      const r = document.createRange();
      r.selectNodeContents(nameEl);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    });
    nameEl.addEventListener('blur', () => {
      nameEl.contentEditable = 'false';
      nameEl.classList.remove('editing');
      if (!canMutateProject()) return;
      const n = nameEl.textContent.trim();
      if (n && n !== s.name) {
        // Capture before/after now — s.id never changes, but s.name is
        // about to; renderSceneList() inside applySceneName() also
        // recreates this exact DOM node, so nothing here is touched again
        // after the branch below.
        const sceneId = s.id, oldName = s.name, newName = n;
        applySceneName(sceneId, newName);
        historyManager.push({
          label: 'Rename scene',
          undo: () => applySceneName(sceneId, oldName),
          redo: () => applySceneName(sceneId, newName),
        });
      } else {
        nameEl.textContent = s.name;
        nameEl.title = s.name;
        if (i === currentIdx) currentSceneNameEl.textContent = s.name;
        if (compareState.mode !== 'single') updateCompareSelects();
      }
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
    groupBtn.className = 'scene-group-btn editor-only' + (curGroup ? ' has-group' : '');
    groupBtn.title = curGroup ? `グループ: ${curGroup.name}（クリックで変更）` : 'グループを設定';
    groupBtn.textContent = '📁';
    groupBtn.addEventListener('click', (e) => { e.stopPropagation(); openGroupPicker(i, groupBtn); });
    actions.appendChild(groupBtn);

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'scene-replace-btn editor-only';
    replaceBtn.title = '画像を差し替え（markers/比較セット/グループ/平面図紐付けは維持）';
    replaceBtn.textContent = '🖼';
    replaceBtn.addEventListener('click', (e) => { e.stopPropagation(); openReplaceScenePicker(i); });
    actions.appendChild(replaceBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'scene-delete-btn editor-only';
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
    if (!assertEditorMode('グループ編集')) return;
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
      if (!assertEditorMode('グループ割り当て')) return;
      if (s && s.groupId !== null) { s.groupId = null; markProjectDirty('グループ割り当て'); }
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
        if (!assertEditorMode('グループ削除')) return;
        scenes.forEach(sc => { if (sc.groupId === g.id) sc.groupId = null; });
        projectState.groups = projectState.groups.filter(x => x.id !== g.id);
        collapsedGroups.delete(g.id);
        markProjectDirty('グループ削除');
        _renderGroupPickerList(); renderSceneList();
      });

      item.appendChild(nameSpan); item.appendChild(delBtn);
      item.addEventListener('click', (e) => {
        if (e.target === delBtn) return;
        e.stopPropagation();
        if (!assertEditorMode('グループ割り当て')) return;
        if (s && s.groupId !== g.id) { s.groupId = g.id; markProjectDirty('グループ割り当て'); }
        closeGroupPicker(); renderSceneList();
      });
      list.appendChild(item);
    });
  }

  // ============================================================
  // Group rename (v2.6)
  // ============================================================
  function _startGroupRename(hdr, group, nameSpan, renameBtn) {
    if (!assertEditorMode('グループ名変更')) return;
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
      if (v && v !== group.name) { group.name = v; markProjectDirty('グループ名変更'); }
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

  // ---- App Mode switch UI (v2.21) ----
  // The single click handler that can move the app INTO Editor —
  // requestEditorAccess() is the only function it calls, never
  // appMode = 'editor' or enterEditorMode() directly.
  if (appModeToggleBtn) {
    appModeToggleBtn.addEventListener('click', async () => {
      if (getAppMode() === 'editor') {
        // Editor -> Viewer never touches project data (Viewer keeps
        // browsing the same in-memory state) — nothing is actually
        // discarded by switching, so the dirty flag must NOT be cleared
        // here. It stays dirty (indicator + beforeunload keep warning)
        // until an actual save or an actual data-replacing operation
        // resolves it. See confirmUnsavedChanges()'s 'switch-to-viewer'
        // context.
        const result = await confirmUnsavedChanges('switch-to-viewer');
        if (result === 'cancel') return;
        enterViewerMode();
      } else {
        // Viewer -> Editor never needs an unsaved-changes confirmation:
        // Viewer can never be dirty (every mutation path is guarded), so
        // this is always a no-op fast path via confirmUnsavedChanges().
        requestEditorAccess();
      }
    });
  }
  // ---- Viewer Preview (Phase 1) ----
  // Deliberately separate buttons/handlers from app-mode-toggle-btn above:
  // Preview must never be reachable through the normal Editor<->Viewer
  // toggle's confirmUnsavedChanges('switch-to-viewer') path, and the
  // normal toggle button is hidden (see renderModeUi()) for the entire
  // duration of Preview so it cannot be clicked into firing that path by
  // mistake.
  if (viewerPreviewBtn)     viewerPreviewBtn.addEventListener('click', startViewerPreview);
  if (viewerPreviewExitBtn) viewerPreviewExitBtn.addEventListener('click', exitViewerPreview);
  renderModeUi(); // apply the initial 'viewer' state to the DOM immediately

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
    if (!assertEditorMode('比較セット保存')) return;
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
        markProjectDirty('比較セット保存');
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
    if (!assertEditorMode('比較セット削除')) return;
    const sets = _loadCompareSets().filter(s => s.id !== setId);
    _saveCompareSetsToStorage(sets);
    markProjectDirty('比較セット削除');
    if (compareState.activeSetId === setId) compareState.activeSetId = null;
    showToast('比較セットを削除しました');
    setTimeout(() => renderCompareSets(), 0);
  }

  function renameCompareSet(setId) {
    if (!assertEditorMode('比較セット名変更')) return;
    const sets = _loadCompareSets();
    const set = sets.find(s => s.id === setId);
    if (!set) return;
    openSetNameModal(
      { title: 'セット名を変更', defaultName: set.name, okLabel: '変更' },
      (name) => {
        if (!name || name === set.name) return;
        set.name = name;
        _saveCompareSetsToStorage(sets);
        markProjectDirty('比較セット名変更');
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
      renameBtn.className = 'cset-btn editor-only';
      renameBtn.title = '名前を変更';
      renameBtn.textContent = '✏';
      renameBtn.addEventListener('click', (e) => { e.stopPropagation(); renameCompareSet(set.id); });

      const delBtn = document.createElement('button');
      delBtn.className = 'cset-btn cset-btn-del editor-only';
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
  // Single point that actually applies a scene's flip state and refreshes
  // every surface that currently shows it. flipH lives on the scene
  // itself (scenes[i].flipH) — it is not per-compare-slot state — so a
  // scene picked for BOTH compare slots at once is handled correctly by
  // just checking each slot independently below, no special-casing
  // needed. All three "current" references (single-view currentIdx,
  // compare slot A, compare slot B) are checked unconditionally,
  // regardless of which view type is on screen right now:
  //  - this keeps the single view's flip button + live sphere in sync
  //    even while compare mode is what's actually visible, so switching
  //    back to single view later (exitCompareMode() doesn't rebuild
  //    the single sphere or re-sync flipBtn on its own) shows the
  //    correct state without any extra work there;
  //  - conversely, flipping in single view keeps the A/B compare
  //    surfaces in sync for whenever compare mode is re-entered.
  // Touching a hidden view's button/sphere here is harmless (applyFlip
  // no-ops on a null/disposed mesh, and updateCompareSelects()/
  // loadCompareSphere() already reset stale classes on next compare
  // entry regardless).
  // Used both for a live user toggle and for undo/redo replaying a past
  // toggle. Always marks the project dirty, including when called from
  // undo/redo, matching applySceneName()'s same rule. Never calls
  // historyManager.push() itself — only toggleFlipSingle()/
  // toggleFlipCompare() do, at the single point a user actually toggles
  // the flip — so undo()/redo() (which call this function) can never
  // record a new history entry while replaying one.
  function applySceneFlip(sceneId, flipH) {
    const s = scenes.find(sc => sc.id === sceneId);
    if (!s) return;
    s.flipH = flipH;
    if (currentIdx >= 0 && scenes[currentIdx] && scenes[currentIdx].id === sceneId) {
      flipBtn.classList.toggle('active', flipH);
      applyFlip(sphere, flipH);
    }
    if (compareState.sceneAIndex >= 0 && scenes[compareState.sceneAIndex] && scenes[compareState.sceneAIndex].id === sceneId) {
      flipABtn.classList.toggle('active', flipH);
      applyFlip(sphereA, flipH);
    }
    if (compareState.sceneBIndex >= 0 && scenes[compareState.sceneBIndex] && scenes[compareState.sceneBIndex].id === sceneId) {
      flipBBtn.classList.toggle('active', flipH);
      applyFlip(sphereB, flipH);
    }
    markProjectDirty('左右反転');
  }

  function toggleFlipSingle() {
    if (currentIdx < 0) return;
    if (!assertEditorMode('左右反転')) return;
    const s = scenes[currentIdx];
    const sceneId = s.id;
    const oldFlip = s.flipH;
    const newFlip = !oldFlip;
    applySceneFlip(sceneId, newFlip);
    historyManager.push({
      label: 'Flip scene',
      undo: () => applySceneFlip(sceneId, oldFlip),
      redo: () => applySceneFlip(sceneId, newFlip),
    });
  }

  function toggleFlipCompare(side) {
    const idx = side === 'a' ? compareState.sceneAIndex : compareState.sceneBIndex;
    if (idx < 0 || idx >= scenes.length) return;
    if (!assertEditorMode('左右反転')) return;
    const s = scenes[idx];
    const sceneId = s.id;
    const oldFlip = s.flipH;
    const newFlip = !oldFlip;
    applySceneFlip(sceneId, newFlip);
    historyManager.push({
      label: 'Flip scene (compare)',
      undo: () => applySceneFlip(sceneId, oldFlip),
      redo: () => applySceneFlip(sceneId, newFlip),
    });
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
  // These are the only two user-initiated entry points to
  // clearAllAndShowUpload() — the confirm gate lives here, not inside the
  // shared reset function itself, because that function is also called
  // from forced/automatic recovery paths (WebGL context restore, error
  // recovery, the last-scene-deleted cascade) that must never block on a
  // dialog. See clearAllAndShowUpload()'s own comment. This is a genuine
  // 'replace-project' operation — the current project is actually wiped —
  // so it uses the discard/cancel context, not 'switch-to-viewer'.
  async function _confirmedClearAll() {
    const result = await confirmUnsavedChanges('replace-project');
    if (result === 'cancel') return;
    // User explicitly confirmed discarding — this intentionally creates a
    // fresh empty project, so it's the one clearAllAndShowUpload() call
    // site that always ends clean.
    clearAllAndShowUpload({ markClean: true });
  }
  clearAllBtn.addEventListener('click',  _confirmedClearAll);
  backBtn.addEventListener('click',      _confirmedClearAll);

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
    // Dismissing a global error is UI recovery, not a confirmed decision
    // to discard unsaved work — never auto-clean here.
    if (!scenes.length) clearAllAndShowUpload({ markClean: false });
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
      vrBtn.title = 'Meta Quest Browserなど、WebXR対応ブラウザで現在シーンをVR表示します。PC画面拡張ではなく、Quest側ブラウザでの利用を推奨します。VR中はQuest Touch Plusコントローラーの右Aボタン（button[4]）で次のシーンへ、左Xボタン（button[4]）で前のシーンへ、右Bボタン（button[5]）でHUD表示切替、左Yボタン（button[5]）でDebug Panelの詳細/簡易切替ができます。右下に表示される小さいミニマップは、左コントローラーのMenuボタン（button[12]）で拡大／縮小を切り替えられます（ミニマップ自体へのレイでのTriggerでも拡大できます）。拡大中はコントローラーのレーザーが表示され、マーカーを狙ってトリガー（button[0]）で選択するとそのシーンへ移動します。マーカー以外でのトリガーでも縮小表示に戻ります。現段階ではシーンリング機能（VR Scene Ring Navigation）は一時停止中です。';
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

  // Debug detail text runs two to a row (v2.20, two-column layout) — each
  // column has roughly half the canvas width, so free-text fields (floor
  // names, scene names, error messages) must be truncated defensively or a
  // long one silently overflows the canvas edge. Truncates by measured
  // PIXEL width (via ctx.measureText, at the ctx's current font) rather
  // than character count — a character-count limit under- or over-shoots
  // badly once Japanese (full-width) and Latin (half-width) characters mix
  // in the same free-text field (floor/scene names are user-provided).
  function _dbgTrunc(ctx, s, maxPx) {
    const str = (s == null || s === '') ? '-' : String(s);
    if (ctx.measureText(str).width <= maxPx) return str;
    let lo = 0, hi = str.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ctx.measureText(str.slice(0, mid) + '…').width <= maxPx) lo = mid; else hi = mid - 1;
    }
    return str.slice(0, lo) + '…';
  }

  // ------------------------------------------------------------
  // VR Controller Visual Guide (v2.18) — drawn into the same HUD canvas as
  // everything else, in the "always visible" band above the Debug
  // simple/detailed split, so it shows/hides with the HUD (vrHudVisible)
  // and is unaffected by the Left Y detail toggle. Pure Canvas 2D drawing:
  // no new DOM element, no input handling, no change to button mapping —
  // it only *reads* vrRingEnabled to grey out the Trigger affordance.
  // Internal button indices (#0/#4/#5/#12) are intentionally not printed
  // here; they remain in docs/vr.html for reference. Shape/layout follows a
  // reference diagram supplied by the project owner: a tracking-ring
  // silhouette with a keyring-style loop at the top (Trigger → シーン選択)
  // and a 2x2 button grid inside the ring (thumbstick + 3 labeled buttons
  // per hand). v2.20.2: the Menu icon's label was changed from
  // "リンク先 ON・OFF" (Scene Ring visibility, now suspended — see
  // VR_SCENE_RING_ENABLED) to "マップ 拡大/縮小" (minimap compact/expanded
  // toggle, its new meaning); shape/color/other button labels are
  // unchanged.
  function _drawVrHudButtonDot(ctx, x, y, symbol, labelX, labelY, label, active, color, iconType) {
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = active ? color : 'rgba(140, 140, 150, 0.45)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = active ? '#ffffff' : 'rgba(200, 200, 200, 0.4)';
    ctx.stroke();

    const iconColor = active ? '#0d121c' : 'rgba(20, 20, 24, 0.85)';
    if (iconType === 'menu') {
      // Hamburger icon (3 horizontal bars) drawn as vectors rather than a
      // glyph, so it renders identically regardless of font availability.
      ctx.strokeStyle = iconColor;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      [-6, 0, 6].forEach((dy) => {
        ctx.beginPath();
        ctx.moveTo(x - 8, y + dy);
        ctx.lineTo(x + 8, y + dy);
        ctx.stroke();
      });
    } else if (iconType === 'meta') {
      // Infinity icon (Meta/Oculus logo shape) — two touching circles.
      ctx.strokeStyle = iconColor;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(x - 5, y, 5.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 5, y, 5.5, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = iconColor;
      ctx.fillText(symbol, x, y + 1);
      ctx.textBaseline = 'alphabetic';
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(labelX, labelY);
    ctx.strokeStyle = active ? 'rgba(210, 225, 255, 0.55)' : 'rgba(150, 150, 150, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '19px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = active ? '#eaf1ff' : 'rgba(190, 190, 190, 0.6)';
    // label may be a single string or an array of strings (multi-line,
    // e.g. the Menu/Meta labels).
    const labelLines = Array.isArray(label) ? label : [label];
    labelLines.forEach((line, i) => ctx.fillText(line, labelX, labelY + i * 22));
  }

  // Leader line + label from the thumbstick position, for VR floor
  // navigation (v2.19, stick-click / button[3]) — no circle marker of its
  // own (the thumbstick's undecorated fill circle, drawn separately, is
  // enough of a visual anchor) and no internal button number in the label,
  // matching the existing labeled buttons' text style. Greyed out via
  // `active` on single/zero-floor projects, same convention as the Trigger
  // loop's Ring-off state.
  function _drawVrHudStickLabel(ctx, x, y, labelX, labelY, label, active, color) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(labelX, labelY);
    ctx.strokeStyle = active ? 'rgba(210, 225, 255, 0.55)' : 'rgba(150, 150, 150, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '19px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = active ? '#eaf1ff' : 'rgba(190, 190, 190, 0.6)';
    ctx.fillText(label, labelX, labelY);
  }

  // Trigger is represented as a small keyring-style loop at the top of the
  // ring (not a face button), with a leader line straight to "シーン選択" —
  // matches the reference diagram's convention of putting the most
  // important action at the top, independent of the button grid below.
  function _drawVrHudTriggerLoop(ctx, cx, ringCy, ringR, labelX, active, color) {
    const loopHalf = 12;
    const loopTop = ringCy - ringR - 32;
    ctx.beginPath();
    ctx.moveTo(cx - loopHalf, ringCy - ringR + 8);
    ctx.lineTo(cx - loopHalf, loopTop + 10);
    ctx.arcTo(cx - loopHalf, loopTop, cx, loopTop, 10);
    ctx.arcTo(cx + loopHalf, loopTop, cx + loopHalf, loopTop + 10, 10);
    ctx.lineTo(cx + loopHalf, ringCy - ringR + 8);
    ctx.strokeStyle = active ? color : 'rgba(140, 140, 150, 0.45)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, loopTop, 4, 0, Math.PI * 2);
    ctx.fillStyle = active ? color : 'rgba(140, 140, 150, 0.45)';
    ctx.fill();

    const labelY = loopTop + 8;
    ctx.beginPath();
    ctx.moveTo(cx, loopTop);
    ctx.lineTo(labelX, labelY);
    ctx.strokeStyle = active ? 'rgba(210, 225, 255, 0.55)' : 'rgba(150, 150, 150, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = active ? '#eaf1ff' : 'rgba(190, 190, 190, 0.6)';
    ctx.fillText('シーン選択', labelX, labelY);
  }

  function _drawVrHudControllerGuide(ctx) {
    const ringEnabled = vrRingEnabled;
    // v2.19: stick-click floor navigation is only meaningful with 2+ valid
    // floors — on a single/zero-floor project the labels below stay drawn
    // (layout is stable) but greyed out, same convention as the Trigger
    // loop's Ring-off state.
    const floorNavActive = _vrValidFloorplans().length >= 2;

    function controller(cx, hand, color) {
      // `inward` points toward the canvas center — used to mirror the
      // Trigger label and the decorative grip bump so both controllers
      // read as a symmetric pair, matching the reference diagram.
      const inward = hand === 'left' ? 1 : -1;
      const ringCy = 348, ringR = 58;

      _drawVrHudTriggerLoop(ctx, cx, ringCy, ringR, cx + inward * 100, ringEnabled, color);

      // Tracking ring.
      ctx.beginPath();
      ctx.arc(cx, ringCy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Grip: a tapered silhouette below the ring, narrowing to a rounded
      // point (bullet shape), rather than the old plain rectangle.
      ctx.beginPath();
      ctx.moveTo(cx - 28, ringCy + ringR - 6);
      ctx.bezierCurveTo(cx - 32, ringCy + ringR + 14, cx - 14, ringCy + ringR + 34, cx, ringCy + ringR + 46);
      ctx.bezierCurveTo(cx + 14, ringCy + ringR + 34, cx + 32, ringCy + ringR + 14, cx + 28, ringCy + ringR - 6);
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Decorative finger-loop bump on the inner side of the grip — a
      // silhouette cue only, no leader line/label (matches reference).
      ctx.beginPath();
      ctx.moveTo(cx + inward * 26, ringCy + ringR + 4);
      ctx.quadraticCurveTo(cx + inward * 46, ringCy + ringR + 20, cx + inward * 26, ringCy + ringR + 34);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // 2x2 button grid inside the ring.
      const gx = 24, gy = 22;
      const at = (qx, qy) => ({ x: cx + qx * gx, y: ringCy + qy * gy });
      const drawStick = (p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
      };

      const topLeft = at(-1, -1), topRight = at(1, -1), botLeft = at(-1, 1), botRight = at(1, 1);
      if (hand === 'left') {
        drawStick(topLeft);
        _drawVrHudStickLabel(ctx, topLeft.x, topLeft.y, cx - 150, 300, '下の階', floorNavActive, color);
        _drawVrHudButtonDot(ctx, topRight.x, topRight.y, 'Y', cx + 150, topRight.y - 11, ['デバッグ', 'ON・OFF'], true, color);
        _drawVrHudButtonDot(ctx, botLeft.x, botLeft.y, null, cx - 150, botLeft.y + 32, ['マップ', '拡大/縮小'], true, color, 'menu');
        _drawVrHudButtonDot(ctx, botRight.x, botRight.y, 'X', cx + 150, botRight.y + 32, '前シーン', true, color);
      } else {
        _drawVrHudButtonDot(ctx, topLeft.x, topLeft.y, 'B', cx - 150, topLeft.y - 11, ['操作方法', 'ON・OFF'], true, color);
        drawStick(topRight);
        _drawVrHudStickLabel(ctx, topRight.x, topRight.y, cx + 150, 300, '上の階', floorNavActive, color);
        _drawVrHudButtonDot(ctx, botLeft.x, botLeft.y, 'A', cx - 150, botLeft.y + 32, '次シーン', true, color);
        _drawVrHudButtonDot(ctx, botRight.x, botRight.y, null, cx + 150, botRight.y + 32, ['メニュー', '※長押しで', '視界リセット'], true, color, 'meta');
      }
    }

    controller(260, 'left', '#5fd0c0');
    controller(764, 'right', '#e0a75f');
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

    // v2.19: current floor indicator — only drawn when the project actually
    // has 2+ floors with valid scenes (_vrFloorHudInfo returns null on
    // single/zero-floor projects, so this stays silent there by design).
    const floorInfo = _vrFloorHudInfo();
    if (floorInfo) {
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillStyle = '#9fd8c8';
      ctx.textAlign = 'center';
      ctx.fillText(`${floorInfo.name}（${floorInfo.index} / ${floorInfo.total}）`, W / 2, 228);
    }

    ctx.strokeStyle = 'rgba(120, 170, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(80, 238); ctx.lineTo(W - 80, 238); ctx.stroke();

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
      // v2.20: two-column layout (was single-column) — three PRs' worth of
      // debug fields (Ring, Floor Nav, Minimap) no longer fit one column at
      // a size legible in-headset. Column A keeps the original Ring/session
      // fields at their original 24px/23px sizing (v2.20.2: the last two
      // lines now report the VR_SCENE_RING_ENABLED feature flag and whether
      // Ring input is actually live this frame, replacing the old single
      // "ring enabled" runtime-toggle line — see vrRingDebug.inputActive).
      // Column B holds `selected` plus every field added since (Floor Nav
      // v2.19, Minimap v2.20/v2.20.1, Menu-toggle + controller-laser
      // feedback v2.20.2) at a slightly tighter 21px pitch so the extra
      // laser/menu line still fits inside the 700px canvas.
      const colA = W / 4, colB = (3 * W) / 4;
      let yA = y, yB = y;
      ctx.fillText(`inputSources: ${vrDebug.inputSourceCount}`, colA, yA); yA += 23;
      ctx.fillText(`left: ${_vrHandDetail('left')}`, colA, yA); yA += 23;
      ctx.fillText(`right: ${_vrHandDetail('right')}`, colA, yA); yA += 23;
      ctx.fillText(`last action: ${vrDebug.lastAction}`, colA, yA); yA += 23;
      ctx.fillText(`current scene: ${currentIdx}`, colA, yA); yA += 23;
      ctx.fillText(`nav order length: ${_getNavOrder().length}`, colA, yA); yA += 23;
      ctx.fillText(`ring items: ${vrRingItems.length}`, colA, yA); yA += 23;
      ctx.fillText(`ring feature enabled: ${VR_SCENE_RING_ENABLED}`, colA, yA); yA += 23;
      ctx.fillText(`ring input active: ${vrRingDebug.inputActive}`, colA, yA); yA += 23;
      ctx.fillText(`hovered L:${vrRingDebug.hoveredLeft} R:${vrRingDebug.hoveredRight}`, colA, yA);

      // Column B's usable half-width (center to canvas edge) is ~256px;
      // every free-text field below is pixel-truncated (_dbgTrunc) against
      // a budget sized so the whole line stays comfortably inside that,
      // however wide the mostly-Japanese source text renders.
      ctx.fillText(`selected: ${_dbgTrunc(ctx, vrRingDebug.selectedName, 260)}`, colB, yB); yB += 21;
      // v2.19: VR Floor Navigation debug fields.
      const fi = _vrFloorHudInfo();
      const fiText = fi ? `${_dbgTrunc(ctx, fi.name, 130)} [${fi.index}/${fi.total}] sc:${fi.sceneCount}` : 'n/a (1 floor)';
      ctx.fillText(`floor: ${fiText}`, colB, yB); yB += 21;
      ctx.fillText(`floor stick L p:${vrFloorStick.left.pressed ? 1 : 0} a:${vrFloorStick.left.armed ? 1 : 0} R p:${vrFloorStick.right.pressed ? 1 : 0} a:${vrFloorStick.right.armed ? 1 : 0}`, colB, yB); yB += 21;
      ctx.fillText(`floor last:${_dbgTrunc(ctx, vrFloorDebug.lastAction, 220)} err:${_dbgTrunc(ctx, vrFloorDebug.lastError, 100)}`, colB, yB); yB += 21;
      // v2.20 / v2.20.1 / v2.20.2: VR Minimap Navigation debug fields
      // (compact/expanded, Menu-toggle source + armed state, controller
      // laser/hit-dot feedback).
      ctx.fillText(`mm mode:${vrMinimapDebug.mode} src:${_dbgTrunc(ctx, vrMinimapDebug.toggleSource, 90)}`, colB, yB); yB += 21;
      ctx.fillText(`mm ${_dbgTrunc(ctx, vrMinimapDebug.floorName, 130)} mk:${vrMinimapDebug.markerCount} img:${vrMinimapDebug.imageLoaded ? 'ok' : 'none'}`, colB, yB); yB += 21;
      {
        const hovText = vrMinimapDebug.mode === 'expanded'
          ? `hov L:${_dbgTrunc(ctx, vrMinimapDebug.hoveredLeft, 90)} R:${_dbgTrunc(ctx, vrMinimapDebug.hoveredRight, 90)}`
          : `hov L:${vrMinimapDebug.compactHoverLeft} R:${vrMinimapDebug.compactHoverRight}`;
        ctx.fillText(`mm cur:${_dbgTrunc(ctx, vrMinimapCurrentMarkerId, 70)} ${hovText}`, colB, yB); yB += 21;
      }
      ctx.fillText(`mm ray L:${vrMinimapDebug.rayHitLeft} R:${vrMinimapDebug.rayHitRight} sw:${vrMinimapDebug.switching}`, colB, yB); yB += 21;
      {
        const handTag = vrMinimapDebug.laserHand === 'left' ? 'L' : vrMinimapDebug.laserHand === 'right' ? 'R' : '-';
        const xy = (vrMinimapDebug.laserHitX != null) ? `${vrMinimapDebug.laserHitX},${vrMinimapDebug.laserHitY}` : '-';
        ctx.fillText(`mm laser:${vrMinimapDebug.laserVisible ? 1 : 0} h:${handTag} xy:${xy} arm:${vrMinimapDebug.menuArmed ? 1 : 0}`, colB, yB); yB += 21;
      }
      ctx.fillText(`mm last:${_dbgTrunc(ctx, vrMinimapDebug.lastAction, 170)} close:${_dbgTrunc(ctx, vrMinimapDebug.closeReason, 90)}`, colB, yB); yB += 21;
      ctx.fillText(`mm err:${_dbgTrunc(ctx, vrMinimapDebug.lastError, 220)}`, colB, yB);
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

  // v2.20.2: shortens/restores a laser's existing endpoint in place — the
  // BufferGeometry is never disposed/recreated, only its position attribute
  // is mutated (design requirement: no per-frame geometry/material
  // regeneration). `dist` is clamped so a very close or stale huge value can
  // never invert/degenerate the line.
  function _setLaserLength(laser, dist) {
    if (!laser) return;
    const clamped = Math.max(0.05, Math.min(dist, 8));
    const pos = laser.geometry.attributes.position;
    pos.setXYZ(1, 0, 0, -clamped);
    pos.needsUpdate = true;
  }

  // Small always-camera-facing dot marking a laser's intersection with the
  // minimap plane while expanded (real Quest 3 feedback: aiming was hard to
  // judge without it). Built once and shared as the map for both hands'
  // sprites — never recreated per frame.
  function _buildLaserHitDotTexture() {
    const S = 64;
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(79,124,255,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2); ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // A THREE.Sprite is used purely for its always-camera-facing billboard
  // behavior — it is never a raycast target (the "Mesh raycasting only, no
  // new Sprites" rule applies to minimap marker HIT-TESTING objects, not to
  // this decorative, non-interactive indicator).
  function _buildLaserHitDot() {
    const material = new THREE.SpriteMaterial({
      map: vrLaserHitDotTexture, transparent: true, depthTest: false, depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.05, 0.05, 1);
    sprite.renderOrder = 1001; // above the minimap panel (999) and laser (997)
    sprite.visible = false;
    return sprite;
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
    if (VR_SCENE_RING_ENABLED) _populateVrRingItems();
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

  // v2.20.2: Left Menu (button[12]) now calls this instead of
  // _toggleVrRingEnabled() above — see VR_SCENE_RING_ENABLED. Reuses
  // _setVrMinimapMode so a Menu-driven transition shares the exact same
  // hover-reset/redraw/laser-reset path as the Trigger-driven
  // compact<->expanded transitions; only the recorded toggle source differs.
  // To restore the old binding once Scene Ring is re-enabled, swap this
  // function back for _toggleVrRingEnabled() at the button[12] call site in
  // _updateVrSceneRing() — nothing else needs to change.
  function _toggleVrMinimapModeViaMenu() {
    if (!vrMinimapMesh || vrRingFadeState !== 'idle') return;
    _setVrMinimapMode(vrMinimapMode === 'expanded' ? 'compact' : 'expanded', 'menu');
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
      // v2.20.2: Scene Ring items are only populated (and therefore only
      // ever visible/hoverable/selectable) while VR_SCENE_RING_ENABLED is
      // true — see the flag's comment. vrRingGroup itself is still created
      // unconditionally because Floor Navigation and the Minimap's Trigger
      // handling (both in _updateVrSceneRing()) key off its existence, and
      // the controller/laser runtime below is shared with the minimap.
      if (VR_SCENE_RING_ENABLED) _populateVrRingItems();

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

      // v2.20.2: hit-point indicators for the minimap's expanded mode (see
      // _updateVrSceneRing). Added directly to threeScene, not as controller
      // children, because their position is set every frame from the
      // raycast's world-space intersection point.
      vrLaserHitDotTexture = _buildLaserHitDotTexture();
      vrLaserHitDot1 = _buildLaserHitDot();
      vrLaserHitDot2 = _buildLaserHitDot();
      threeScene.add(vrLaserHitDot1, vrLaserHitDot2);

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
    // v2.20.2: hit-dot sprites share THREE.Sprite's internal default
    // geometry (never a per-instance one — see _disposeVrRingSprites()'s
    // identical convention for the ring item sprites above), so only the
    // material is disposed here; the texture is disposed once, separately.
    [vrLaserHitDot1, vrLaserHitDot2].forEach((dot) => {
      if (!dot) return;
      if (dot.parent) dot.parent.remove(dot);
      dot.material.dispose();
    });
    vrLaserHitDot1 = null; vrLaserHitDot2 = null;
    if (vrLaserHitDotTexture) { vrLaserHitDotTexture.dispose(); vrLaserHitDotTexture = null; }
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
        // v2.20: captured before switchToScene() so the fade-in completion
        // below (several frames later) knows whether to fully rebuild the
        // minimap (floor changed) or just refresh its current-position
        // highlight (same floor) — switchToScene()/_doSwitchToScene()
        // already auto-syncs activeFloorplanId, this only observes it.
        const floorBefore = activeFloorplanId;
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
        if (switched) vrMinimapPendingFloorChange = activeFloorplanId !== floorBefore;
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
      // v2.20: minimap update on the same fade-completion hook Scene Ring
      // uses — full rebuild only when the floor actually changed, otherwise
      // just a lightweight current-position redraw (design requirement:
      // rebuild the FloorMap/marker list only on floor change). v2.20.1:
      // any fade completing while the expanded minimap is open also
      // returns it to compact — covers both a successful marker jump and,
      // as a safety net, a floor-nav stick-click firing while expanded was
      // still showing a now-stale floor.
      if (vrMinimapMode === 'expanded') {
        _setVrMinimapMode('compact', vrMinimapPendingFloorChange ? 'floor-switch' : 'scene-switch');
      }
      if (vrMinimapPendingFloorChange) _rebuildVrMinimapForFloor();
      else _drawVrMinimap();
      vrMinimapPendingFloorChange = false;
    }
  }

  // ------------------------------------------------------------
  // VR Floor Navigation (v2.19)
  // ------------------------------------------------------------
  // Floors are existing FloorMap floor plans (projectState.floorplans); a
  // floor's scene set/order mirrors exactly what _getNavOrder() already
  // uses for the active floorplan (markers on that floorplan, sorted by
  // marker.order). nextScene()/prevScene() (Right A/Left X) and Scene Ring
  // (_populateVrRingItems) are BOTH already routed through _getNavOrder()
  // and the shared activeFloorplanId, and _doSwitchToScene() already
  // auto-syncs activeFloorplanId to the current scene's floor on every
  // switchToScene() call (marker lookup, falling back to scene.floorplanId)
  // — in VR and out. So once a floor move lands on a scene belonging to the
  // target floor, A/X and Scene Ring are automatically re-scoped to that
  // floor with no changes to either. The helpers below duplicate
  // _getNavOrder()'s marker-based lookup read-only, because _getNavOrder()
  // can only report on the CURRENTLY active floorplan and floor navigation
  // needs to inspect floors that are not currently active (e.g. to find the
  // next non-empty floor, or its first scene).

  function _vrFloorSceneIndices(floorplanId) {
    const fpMarkers = projectState.markers
      .filter(m => m.floorplanId === floorplanId)
      .sort((a, b) => (a.order || 999) - (b.order || 999));
    return fpMarkers.map(m => scenes.findIndex(s => s.id === m.sceneId)).filter(i => i >= 0);
  }

  // Floors with zero valid scenes are excluded from floor navigation
  // entirely, in the existing projectState.floorplans array order (upload
  // order — the only order that exists; no floor-number field, no reorder
  // UI, so there is nothing to string-sort).
  function _vrValidFloorplans() {
    return projectState.floorplans.filter(fp => _vrFloorSceneIndices(fp.id).length > 0);
  }

  // Mirrors the marker-then-scene.floorplanId fallback _doSwitchToScene()
  // already uses to keep activeFloorplanId in sync, for the case where
  // activeFloorplanId is null, stale, or points at a now-invalid floor.
  function _vrResolveCurrentFloorId(validFloors) {
    if (activeFloorplanId && validFloors.some(fp => fp.id === activeFloorplanId)) return activeFloorplanId;
    const s = (currentIdx >= 0 && scenes[currentIdx]) ? scenes[currentIdx] : null;
    if (!s) return null;
    const markerForScene = projectState.markers.find(m => m.sceneId === s.id);
    const fallbackId = markerForScene?.floorplanId || s.floorplanId || null;
    return (fallbackId && validFloors.some(fp => fp.id === fallbackId)) ? fallbackId : null;
  }

  // Priority: the scene last viewed on that floor this VR session, else the
  // floor's nav-order first scene. Falls back past a stale remembered index
  // (e.g. a marker was moved to a different floor mid-session) instead of
  // trusting it blindly.
  function _vrTargetSceneForFloor(floorplanId) {
    const last = vrFloorLastScene.get(floorplanId);
    if (last != null && last >= 0 && last < scenes.length && isSceneOnFloorplan(scenes[last], floorplanId)) {
      return last;
    }
    const indices = _vrFloorSceneIndices(floorplanId);
    return indices.length ? indices[0] : null;
  }

  // Small read-only summary for the HUD (current-floor line + Debug detail).
  // Returns null when floor navigation has nothing to show (0 or 1 valid
  // floors) — HUD callers use this to stay silent on single-floor projects.
  function _vrFloorHudInfo() {
    const floors = _vrValidFloorplans();
    if (floors.length < 2) return null;
    const curId = _vrResolveCurrentFloorId(floors);
    const idx = curId ? floors.findIndex(fp => fp.id === curId) : -1;
    if (idx < 0) return null;
    const fp = floors[idx];
    return {
      id: fp.id,
      name: fp.name || `Floor ${idx + 1}`,
      index: idx + 1,
      total: floors.length,
      sceneCount: _vrFloorSceneIndices(fp.id).length
    };
  }

  function _vrResetFloorNavState() {
    vrFloorStick.left.pressed = false;
    vrFloorStick.left.armed = false;
    vrFloorStick.right.pressed = false;
    vrFloorStick.right.armed = false;
    vrFloorLastScene = new Map();
    vrFloorDebug.lastAction = '-';
    vrFloorDebug.lastError = '-';
  }

  // direction: -1 (left stick-click → one floor down) | +1 (right
  // stick-click → one floor up). No cycling: past the top/bottom floor is a
  // no-op. Reuses the exact same Fade Out -> switchToScene -> Fade In state
  // machine Scene Ring selection uses (vrRingFadeState/vrRingPendingSceneIdx
  // /_updateVrRingFade), so fade behavior, the failure-falls-through-to-'in'
  // guarantee, and the post-fade _rebuildVrRing() call (which re-scopes the
  // ring to the new activeFloorplanId) are unmodified and shared between
  // the two features — nothing here duplicates or re-implements that state
  // machine, it only feeds it a target scene index.
  function _vrGoFloor(direction) {
    if (!vrRingGroup) return; // no ring/fade infra built (<=1 scene) — nothing to navigate
    try {
      if (vrRingFadeState !== 'idle') { vrFloorDebug.lastError = 'busy: fade in progress'; return; }
      const floors = _vrValidFloorplans();
      if (floors.length < 2) { vrFloorDebug.lastAction = 'no-op (single floor)'; return; }
      const curId = _vrResolveCurrentFloorId(floors);
      if (!curId) { vrFloorDebug.lastError = 'current floor unresolved'; return; }
      const curIdx = floors.findIndex(fp => fp.id === curId);
      const targetIdx = curIdx + direction;
      if (targetIdx < 0 || targetIdx >= floors.length) {
        vrFloorDebug.lastAction = (direction < 0 ? 'down' : 'up') + ' blocked (edge floor)';
        return;
      }
      const targetFloor = floors[targetIdx];
      const targetSceneIdx = _vrTargetSceneForFloor(targetFloor.id);
      if (targetSceneIdx == null) {
        vrFloorDebug.lastError = 'no target scene on floor ' + (targetFloor.name || targetFloor.id);
        return;
      }
      vrFloorLastScene.set(curId, currentIdx);
      vrFloorDebug.lastAction = (direction < 0 ? 'down -> ' : 'up -> ') + (targetFloor.name || targetFloor.id);
      vrFloorDebug.lastError = '-';
      console.log('[VR Floor]', vrFloorDebug.lastAction);
      // Safely reset hover/selected/Trigger-arm for the floor change, same
      // as the Ring visibility toggle does when re-enabling.
      vrRingDebug.selectedName = '-';
      _resetVrRingTriggerState();
      vrRingPendingSceneIdx = targetSceneIdx;
      vrRingFadeState = 'out';
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      console.error('[VR Floor]', 'floor navigation failed:', err);
      vrFloorDebug.lastError = msg;
    }
  }

  // ------------------------------------------------------------
  // VR Minimap Navigation (v2.20)
  // ------------------------------------------------------------
  // Second camera-parented CanvasTexture panel (same construction as the
  // main HUD) showing the current floor's FloorMap image + markers. See the
  // state block above for the overall design notes.

  let vrMinimapImageArea = null; // { dx, dy, dw, dh } in minimap-canvas pixels, from the same letterbox-fit math renderFloormapCanvas() uses

  // `isCurrent` is passed in rather than read from the marker record — the
  // record is cached at floor-rebuild time, but currentIdx can change on
  // every A/X press without a floor change (no rebuild), so "which marker
  // is the current position" must always be resolved live against the
  // live currentIdx, never trusted from a stale cached flag. `expanded`
  // only scales the drawn radii up for the bigger panel — the underlying
  // px/py positions are identical in both modes (same shared canvas/fit).
  function _drawMinimapMarkerDot(ctx, m, isCurrent, hovered, expanded) {
    const baseR = isCurrent ? (expanded ? 20 : 12) : (expanded ? 11 : 6);
    const r = hovered ? baseR + (expanded ? 7 : 4) : baseR;
    if (isCurrent) {
      // Double-ring emphasis for "you are here" (design: bigger + bright
      // outline + double circle, in place of a per-frame pulse animation).
      ctx.beginPath();
      ctx.arc(m.px, m.py, r + (expanded ? 9 : 6), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = expanded ? 3 : 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(m.px, m.py, r, 0, Math.PI * 2);
    ctx.fillStyle = isCurrent ? '#4f7cff' : (hovered ? '#ffd166' : 'rgba(160, 160, 160, 0.85)');
    ctx.fill();
    ctx.strokeStyle = isCurrent ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = isCurrent ? 2.5 : 1.5;
    ctx.stroke();
  }

  // Redraws the minimap canvas from already-cached state (vrMinimapMarkers,
  // vrMinimapImageArea, hover) for whichever mode is currently active.
  // Never rebuilds the marker list or reloads the image itself — only
  // _rebuildVrMinimapForFloor() does that. Called on hover change, scene
  // change, floor change and mode change, not unconditionally every frame.
  function _drawVrMinimap() {
    if (!vrMinimapCtx) return;
    const ctx = vrMinimapCtx, S = VR_MINIMAP_CANVAS_SIZE;
    const expanded = vrMinimapMode === 'expanded';
    const panelHovered = vrMinimapCompactHovered.left || vrMinimapCompactHovered.right;
    ctx.clearRect(0, 0, S, S);

    ctx.fillStyle = 'rgba(13, 18, 28, 0.9)';
    ctx.strokeStyle = (!expanded && panelHovered) ? 'rgba(255, 209, 102, 0.9)' : 'rgba(120, 170, 255, 0.6)';
    ctx.lineWidth = (!expanded && panelHovered) ? 6 : 3;
    const r = 20;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(S - r, 0); ctx.arcTo(S, 0, S, r, r);
    ctx.lineTo(S, S - r); ctx.arcTo(S, S, S - r, S, r);
    ctx.lineTo(r, S); ctx.arcTo(0, S, 0, S - r, r);
    ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.font = `bold ${expanded ? 30 : 22}px system-ui, sans-serif`;
    ctx.fillStyle = '#9fd8c8';
    ctx.textAlign = 'center';
    const titleMax = expanded ? 20 : 16;
    let title = vrMinimapDebug.floorName === '-' ? 'FloorMap' : vrMinimapDebug.floorName;
    if (title.length > titleMax) title = title.slice(0, titleMax - 1) + '…';
    ctx.fillText(title, S / 2, expanded ? 42 : 30);

    if (!vrMinimapDebug.imageLoaded || !vrMinimapImageArea) {
      ctx.font = `${expanded ? 26 : 18}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(190, 190, 190, 0.7)';
      ctx.fillText('FloorMapなし', S / 2, S / 2);
      if (vrMinimapTexture) vrMinimapTexture.needsUpdate = true;
      return;
    }

    const fpId = _vrResolveCurrentFloorId(projectState.floorplans);
    const fp = fpId ? projectState.floorplans.find(f => f.id === fpId) : null;
    const { dx, dy, dw, dh } = vrMinimapImageArea;
    if (fp && fp.imgEl) {
      try { ctx.drawImage(fp.imgEl, dx, dy, dw, dh); } catch (err) { /* image draw failed — background/markers still render below */ }
    }

    // "Current position" is resolved live against currentIdx on every draw
    // (not from a cached flag) so an A/X move that doesn't trigger a floor
    // rebuild still highlights the right marker. Per-marker hover only
    // applies in expanded mode — compact mode never hovers individual
    // markers (whole-panel hover only, drawn via the border glow above).
    const hoveredIds = expanded
      ? new Set([vrMinimapHovered.left && vrMinimapHovered.left.id, vrMinimapHovered.right && vrMinimapHovered.right.id].filter(Boolean))
      : new Set();
    vrMinimapMarkers.filter(m => m.sceneIdx !== currentIdx).forEach(m => _drawMinimapMarkerDot(ctx, m, false, hoveredIds.has(m.id), expanded));
    const curMarker = vrMinimapMarkers.find(m => m.sceneIdx === currentIdx);
    if (curMarker) _drawMinimapMarkerDot(ctx, curMarker, true, hoveredIds.has(curMarker.id), expanded);
    vrMinimapCurrentMarkerId = curMarker ? curMarker.id : null;
    vrMinimapDebug.currentMarkerId = curMarker ? curMarker.id : '-';

    if (expanded) {
      const hoveredRecord = vrMinimapHovered.left || vrMinimapHovered.right;
      if (hoveredRecord) {
        let label = hoveredRecord.name;
        if (label.length > 22) label = label.slice(0, 21) + '…';
        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.fillStyle = '#eaf1ff';
        ctx.textAlign = 'center';
        ctx.fillText(label, S / 2, S - 40);
        ctx.font = '18px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(210, 225, 255, 0.7)';
        ctx.fillText('Triggerで移動', S / 2, S - 14);
      } else {
        ctx.font = '18px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(190, 190, 190, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('マーカー以外でTrigger: 閉じる', S / 2, S - 14);
      }
    } else if (panelHovered) {
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.textAlign = 'center';
      ctx.fillText('Triggerで拡大', S / 2, S - 14);
    }

    if (vrMinimapTexture) vrMinimapTexture.needsUpdate = true;
  }

  // Full rebuild: resolves the current floor (reusing the same helper VR
  // Floor Navigation uses, passing ALL floorplans rather than just
  // nav-"valid" ones — a floor with a FloorMap image but zero markers is
  // still worth displaying here even though it's excluded from floor-nav
  // targets), reloads the floor image if needed, and recomputes the
  // per-floor marker list with the exact letterbox-fit math
  // renderFloormapCanvas() uses (scoped to this canvas's own dimensions).
  // Only called on VR start and on floor change — never per-frame, never
  // per-scene-switch (see _drawVrMinimap for the lightweight path).
  function _rebuildVrMinimapForFloor() {
    if (!vrMinimapCanvas) return;
    try {
      vrMinimapMarkers = [];
      vrMinimapCurrentMarkerId = null;
      vrMinimapImageArea = null;
      vrMinimapHovered.left = null;
      vrMinimapHovered.right = null;
      vrMinimapDebug.hoveredLeft = '-';
      vrMinimapDebug.hoveredRight = '-';

      const fpId = _vrResolveCurrentFloorId(projectState.floorplans);
      const fp = fpId ? projectState.floorplans.find(f => f.id === fpId) : null;
      vrMinimapDebug.floorName = fp ? (fp.name || fpId) : '-';

      if (!fp || !fp.imgEl) {
        vrMinimapDebug.imageLoaded = false;
        vrMinimapDebug.imageBounds = '-';
        vrMinimapDebug.markerCount = 0;
        vrMinimapDebug.currentMarkerId = '-';
        _drawVrMinimap();
        return;
      }

      const img = fp.imgEl;
      if (!img.complete || !img.naturalWidth) {
        vrMinimapDebug.imageLoaded = false;
        vrMinimapDebug.imageBounds = '-';
        // Adds a listener rather than assigning img.onload — the normal 2D
        // FloorMap panel already owns that property (renderFloormapCanvas);
        // this must never clobber it.
        img.addEventListener('load', () => {
          if (fpId === _vrResolveCurrentFloorId(projectState.floorplans)) _rebuildVrMinimapForFloor();
        }, { once: true });
        _drawVrMinimap();
        return;
      }
      vrMinimapDebug.imageLoaded = true;

      const areaW = VR_MINIMAP_CANVAS_SIZE - VR_MINIMAP_MARGIN * 2;
      const areaH = VR_MINIMAP_CANVAS_SIZE - VR_MINIMAP_TITLE_H - VR_MINIMAP_MARGIN * 2;
      const ia = img.naturalWidth / img.naturalHeight;
      const ca = areaW / areaH;
      let dw, dh, dx, dy;
      if (ia > ca) { dw = areaW; dh = areaW / ia; dx = VR_MINIMAP_MARGIN; dy = VR_MINIMAP_TITLE_H + VR_MINIMAP_MARGIN + (areaH - dh) / 2; }
      else         { dh = areaH; dw = areaH * ia; dy = VR_MINIMAP_TITLE_H + VR_MINIMAP_MARGIN; dx = VR_MINIMAP_MARGIN + (areaW - dw) / 2; }
      vrMinimapImageArea = { dx, dy, dw, dh };
      vrMinimapDebug.imageBounds = `${Math.round(dw)}x${Math.round(dh)}@${Math.round(dx)},${Math.round(dy)}`;

      // "Current position" is NOT baked into these records — _drawVrMinimap()
      // resolves it live against currentIdx every time it draws, so it
      // stays correct across A/X moves that don't trigger a rebuild.
      const list = [];
      projectState.markers
        .filter(m => m.floorplanId === fpId)
        .forEach((m) => {
          const sceneIdx = scenes.findIndex(s => s.id === m.sceneId);
          if (sceneIdx < 0) return; // marker references a missing/deleted scene — skip just this marker
          const scn = scenes[sceneIdx];
          const safeName = String(scn.name || scn.title || `Scene ${sceneIdx + 1}`);
          list.push({
            id: m.id, sceneIdx, name: safeName,
            px: dx + m.x * dw, py: dy + m.y * dh
          });
        });
      vrMinimapMarkers = list;
      vrMinimapDebug.markerCount = list.length;
      _drawVrMinimap();
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      console.error('[VR Minimap]', 'rebuild failed:', err);
      vrMinimapDebug.lastError = 'rebuild: ' + msg;
      vrMinimapMarkers = [];
      vrMinimapCurrentMarkerId = null;
      try { _drawVrMinimap(); } catch (e2) { /* canvas itself is broken — nothing more to do safely */ }
    }
  }

  // Expanded-mode per-marker hover.
  function _updateMinimapHandHover(hand, record) {
    if (vrMinimapHovered[hand] === record) return;
    vrMinimapHovered[hand] = record;
    vrMinimapDebug[hand === 'left' ? 'hoveredLeft' : 'hoveredRight'] = record ? record.name : '-';
    _drawVrMinimap();
  }

  // Compact-mode whole-panel hover (no individual markers) — hit or miss,
  // used only to show the "Triggerで拡大" hover glow.
  function _updateMinimapCompactHover(hand, hit) {
    if (vrMinimapCompactHovered[hand] === hit) return;
    vrMinimapCompactHovered[hand] = hit;
    vrMinimapDebug[hand === 'left' ? 'compactHoverLeft' : 'compactHoverRight'] = hit;
    _drawVrMinimap();
  }

  // Mirrors _selectVrRingItem/_vrGoFloor's reuse of the shared Fade Out ->
  // switchToScene -> Fade In state machine. Guards against re-triggering a
  // fade to the scene already being viewed (design requirement: selecting
  // the current-position marker must not cause a re-transition). Clears
  // hover immediately so the about-to-close expanded panel doesn't keep
  // showing a stale hovered marker while the fade plays out.
  function _selectVrMinimapMarker(record) {
    if (vrRingFadeState !== 'idle') return;
    if (record.sceneIdx === currentIdx) { vrMinimapDebug.lastAction = 'no-op (already current scene)'; return; }
    vrMinimapDebug.lastAction = 'jump -> ' + record.name;
    vrMinimapDebug.lastError = '-';
    console.log('[VR Minimap]', 'selected', record.name, 'sceneIdx', record.sceneIdx);
    vrMinimapHovered.left = null;
    vrMinimapHovered.right = null;
    vrMinimapDebug.hoveredLeft = '-';
    vrMinimapDebug.hoveredRight = '-';
    vrRingPendingSceneIdx = record.sceneIdx;
    vrRingFadeState = 'out';
  }

  function _createVrMinimap() {
    if (vrMinimapMesh || !camera) return;
    try {
      vrMinimapCanvas = document.createElement('canvas');
      vrMinimapCanvas.width = VR_MINIMAP_CANVAS_SIZE; vrMinimapCanvas.height = VR_MINIMAP_CANVAS_SIZE;
      vrMinimapCtx = vrMinimapCanvas.getContext('2d');
      vrMinimapTexture = new THREE.CanvasTexture(vrMinimapCanvas);
      vrMinimapTexture.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({
        map: vrMinimapTexture, transparent: true, opacity: 1,
        depthTest: false, side: THREE.DoubleSide
      });
      // Geometry is always built at the COMPACT size — expanded mode
      // enlarges it via mesh.scale (see _setVrMinimapMode), never by
      // disposing/recreating the geometry. Object3D.worldToLocal() already
      // undoes scale, so raycasting hit-testing always works in this same
      // base geometry space regardless of which mode is active (see the
      // hit-test code below).
      vrMinimapMesh = new THREE.Mesh(new THREE.PlaneGeometry(VR_MINIMAP_COMPACT_PLANE_SIZE, VR_MINIMAP_COMPACT_PLANE_SIZE), mat);
      vrMinimapMesh.renderOrder = 999;
      vrMinimapMode = 'compact';
      vrMinimapDebug.mode = 'compact';
      const p = VR_MINIMAP_COMPACT_POSITION;
      vrMinimapMesh.position.set(p.x, p.y, p.z);
      vrMinimapMesh.scale.set(1, 1, 1);
      camera.add(vrMinimapMesh);
      _rebuildVrMinimapForFloor();
      console.log('[VR Minimap]', 'created');
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      console.error('[VR Minimap]', 'creation failed — continuing without minimap:', err);
      vrMinimapDebug.lastError = 'create: ' + msg;
      try { _disposeVrMinimap(); } catch (e2) { /* partially built — ignore */ }
    }
  }

  function _disposeVrMinimap() {
    if (vrMinimapMesh) {
      if (vrMinimapMesh.parent) vrMinimapMesh.parent.remove(vrMinimapMesh);
      vrMinimapMesh.geometry.dispose();
      vrMinimapMesh.material.dispose();
    }
    if (vrMinimapTexture) vrMinimapTexture.dispose();
    vrMinimapMesh = null; vrMinimapCanvas = null; vrMinimapCtx = null; vrMinimapTexture = null;
    vrMinimapMode = 'compact'; // v2.20.1: never leave a session in 'expanded'
    vrMinimapMarkers = [];
    vrMinimapCurrentMarkerId = null;
    vrMinimapImageArea = null;
    vrMinimapHovered.left = null;
    vrMinimapHovered.right = null;
    vrMinimapCompactHovered.left = false;
    vrMinimapCompactHovered.right = false;
    vrMinimapPendingFloorChange = false;
    vrMinimapDebug.mode = 'compact';
    vrMinimapDebug.floorName = '-';
    vrMinimapDebug.markerCount = 0;
    vrMinimapDebug.imageLoaded = false;
    vrMinimapDebug.imageBounds = '-';
    vrMinimapDebug.currentMarkerId = '-';
    vrMinimapDebug.hoveredLeft = '-';
    vrMinimapDebug.hoveredRight = '-';
    vrMinimapDebug.compactHoverLeft = false;
    vrMinimapDebug.compactHoverRight = false;
    vrMinimapDebug.rayHitLeft = false;
    vrMinimapDebug.rayHitRight = false;
    vrMinimapDebug.switching = false;
    vrMinimapDebug.ringSuspended = false;
    vrMinimapDebug.lastAction = '-';
    vrMinimapDebug.closeReason = '-';
    vrMinimapDebug.toggleSource = '-';
    vrMinimapDebug.menuArmed = false;
    vrMinimapDebug.laserVisible = false;
    vrMinimapDebug.laserHand = '-';
    vrMinimapDebug.laserHitX = null;
    vrMinimapDebug.laserHitY = null;
    vrMinimapMenuToggle.pressed = false;
    vrMinimapMenuToggle.armed = false;
    // lastError intentionally kept, same convention as vrRingDebug.lastError
    // (stays readable on the on-screen VR Debug Log after the session ends).
  }

  // Switches between 'compact' and 'expanded': repositions/rescales the
  // SAME mesh (never disposes/recreates geometry/material/texture),
  // clears both hover trackers (whole-panel and per-marker track different
  // things across the two modes, so stale hover must never carry over),
  // resets both lasers/hit-dots to their default (full-length, hidden)
  // state, and redraws. `source` — one of 'menu' | 'compact-trigger' |
  // 'background-close' | 'scene-switch' | 'floor-switch' — records what
  // caused this transition (Debug: "minimap toggle source" on open, "last
  // minimap close reason" on close).
  function _setVrMinimapMode(mode, source) {
    if (!vrMinimapMesh || vrMinimapMode === mode) return;
    vrMinimapMode = mode;
    vrMinimapDebug.mode = mode;
    vrMinimapDebug.toggleSource = source || '-';
    if (mode === 'expanded') {
      const p = VR_MINIMAP_EXPANDED_POSITION;
      vrMinimapMesh.position.set(p.x, p.y, p.z);
      const scale = VR_MINIMAP_EXPANDED_PLANE_SIZE / VR_MINIMAP_COMPACT_PLANE_SIZE;
      vrMinimapMesh.scale.set(scale, scale, 1);
      vrMinimapDebug.lastAction = 'expanded (' + (source || '-') + ')';
      vrMinimapDebug.closeReason = '-';
      console.log('[VR Minimap]', 'expanded', source);
    } else {
      const p = VR_MINIMAP_COMPACT_POSITION;
      vrMinimapMesh.position.set(p.x, p.y, p.z);
      vrMinimapMesh.scale.set(1, 1, 1);
      vrMinimapDebug.closeReason = source || '-';
      vrMinimapDebug.lastAction = 'closed (' + (source || '-') + ')';
      console.log('[VR Minimap]', 'closed to compact:', source);
    }
    vrMinimapHovered.left = null;
    vrMinimapHovered.right = null;
    vrMinimapCompactHovered.left = false;
    vrMinimapCompactHovered.right = false;
    vrMinimapDebug.hoveredLeft = '-';
    vrMinimapDebug.hoveredRight = '-';
    vrMinimapDebug.compactHoverLeft = false;
    vrMinimapDebug.compactHoverRight = false;
    // A mode transition always leaves both lasers/hit-dots in their default
    // (full-length, hidden) state — whichever mode is now active recomputes
    // them fresh next frame, so a stale shortened laser/hit-dot from
    // expanded can never linger after closing to compact.
    if (vrControllerLaser1) _setLaserLength(vrControllerLaser1, 8);
    if (vrControllerLaser2) _setLaserLength(vrControllerLaser2, 8);
    if (vrLaserHitDot1) vrLaserHitDot1.visible = false;
    if (vrLaserHitDot2) vrLaserHitDot2.visible = false;
    _drawVrMinimap();
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

      // v2.20.1: cached once per frame so raycasting and Trigger handling
      // below agree on the same mode even if a mode switch happens to fire
      // mid-frame (e.g. both hands pressing Trigger the same frame) — the
      // switch still only ever takes effect starting next frame.
      const minimapExpanded = vrMinimapMode === 'expanded';
      vrMinimapDebug.ringSuspended = minimapExpanded;

      // Fade中、Ring表示トグルOFF中、VR_SCENE_RING_ENABLEDがfalse、または
      // ミニマップ拡大表示中は、リングを非表示にしhover/選択を完全に止める
      // （要件: 「Ring非表示時はRing items、hover、Trigger選択をすべて無効化
      // する」。ミニマップ拡大中はScene Ring入力を完全に一時停止する）。
      // v2.20.2: レーザー自体はRingとは切り離した可視性を持つ — Scene Ring
      // が無効化されていてもミニマップexpanded中は表示する（実機フィード
      // バック: 「expanded中にController laserが見えず照準位置が分からな
      // い」への対応）。
      const fading = vrRingFadeState !== 'idle';
      const ringVisible = VR_SCENE_RING_ENABLED && vrRingEnabled && !fading && !minimapExpanded;
      vrRingGroup.visible = ringVisible;
      vrRingDebug.inputActive = ringVisible;
      const laserVisible = !fading && (ringVisible || minimapExpanded);
      if (vrControllerLaser1) vrControllerLaser1.visible = laserVisible;
      if (vrControllerLaser2) vrControllerLaser2.visible = laserVisible;
      if (vrLaserHitDot1 && !laserVisible) vrLaserHitDot1.visible = false;
      if (vrLaserHitDot2 && !laserVisible) vrLaserHitDot2.visible = false;
      vrMinimapDebug.laserVisible = laserVisible;

      vrMinimapDebug.switching = fading;

      // Sprite.raycast() reads raycaster.camera internally — leaving it
      // unset (or stale) throws every frame, which kills the XR animation
      // loop entirely (seen on Quest 3 as a freeze plus last-frame
      // reprojection covering only part of the view). The principled
      // source is the active XR camera (renderer.xr.getCamera(camera)),
      // which is only meaningful while a frame is actually being rendered
      // inside an XR session; resolving it is wrapped so a throw or a
      // falsy return can never propagate. Only Ring-sprite hover needs
      // this — the v2.20 minimap below is a Mesh (not a Sprite), whose
      // raycast() doesn't read raycaster.camera at all, so minimap hover
      // works even in a frame where the XR camera can't be resolved.
      let xrCam = null;
      try {
        xrCam = (renderer && renderer.xr && renderer.xr.getCamera) ? renderer.xr.getCamera(camera) : null;
      } catch (err) {
        xrCam = null;
      }
      if (xrCam) vrRaycaster.camera = xrCam;

      const ringHits = { left: null, right: null };
      const minimapMarkerHits = { left: null, right: null };  // expanded mode only
      const minimapPanelHits = { left: false, right: false }; // compact: whole-panel hit; expanded: hit-but-no-marker (used for the close fallback)
      // Per-hand raycast: each laser only feeds the hover slot of its own
      // handedness (resolved via the 'connected' event, see
      // _onRingControllerConnected). A controller with unknown handedness
      // contributes no hover and therefore can never select anything.
      const controllerRig = [
        { controller: vrController1, laser: vrControllerLaser1, hitDot: vrLaserHitDot1 },
        { controller: vrController2, laser: vrControllerLaser2, hitDot: vrLaserHitDot2 }
      ];
      controllerRig.forEach(({ controller, laser, hitDot }) => {
        if (!controller) return;
        const hand = controller.userData.ringHandedness;
        if (hand !== 'left' && hand !== 'right') return;
        vrRaycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        vrRaycaster.ray.direction.set(0, 0, -1).transformDirection(controller.matrixWorld).normalize();

        if (ringVisible && xrCam) {
          const intersects = vrRaycaster.intersectObjects(vrRingGroup.children, false);
          ringHits[hand] = intersects.length
            ? (vrRingItems.find((h) => h.mesh === intersects[0].object) || null)
            : null;
        }

        // Minimap hover — independent of Ring visibility/fade state (design
        // requirement: minimap works even with Ring OFF). Hits the single
        // minimap plane; Object3D.worldToLocal() already undoes the mesh's
        // current scale, so the local-space hit point is always in the same
        // base (compact-size) geometry coordinates regardless of which mode
        // is active — the same VR_MINIMAP_COMPACT_PLANE_SIZE conversion
        // works unchanged for both. Compact mode only cares whether the ray
        // hit the panel at all (no per-marker distinction); expanded mode
        // additionally finds the nearest cached marker within
        // VR_MINIMAP_HIT_RADIUS — no per-marker 3D objects needed either way.
        // v2.20.2: while expanded, a real hit also shortens this hand's
        // laser to the intersection distance and shows its hit-dot there
        // (marker hits scale the dot up slightly) — a background hit with
        // no nearby marker still gets both, so aiming is legible even off
        // any marker (real Quest 3 feedback: "markerがない背景上でもrayの
        // 指示位置が分かるように"). Reset below to full-length/hidden
        // whenever this hand has no live expanded hit this frame.
        let hitThisHand = false;
        if (vrMinimapMesh) {
          try {
            const mmIntersects = vrRaycaster.intersectObject(vrMinimapMesh, false);
            const hit = mmIntersects.length > 0;
            vrMinimapDebug[hand === 'left' ? 'rayHitLeft' : 'rayHitRight'] = hit;
            if (!hit) {
              // no-op — panel/marker hover cleared below via the hit=false default
            } else if (!minimapExpanded) {
              minimapPanelHits[hand] = true;
            } else {
              const localPoint = vrMinimapMesh.worldToLocal(mmIntersects[0].point.clone());
              const cx = (localPoint.x / VR_MINIMAP_COMPACT_PLANE_SIZE + 0.5) * VR_MINIMAP_CANVAS_SIZE;
              const cy = (0.5 - localPoint.y / VR_MINIMAP_COMPACT_PLANE_SIZE) * VR_MINIMAP_CANVAS_SIZE;
              let closest = null, closestDist = VR_MINIMAP_HIT_RADIUS;
              vrMinimapMarkers.forEach((m) => {
                const d = Math.hypot(m.px - cx, m.py - cy);
                if (d <= closestDist) { closest = m; closestDist = d; }
              });
              minimapMarkerHits[hand] = closest;
              minimapPanelHits[hand] = true; // hit the panel even if no marker was close enough

              hitThisHand = true;
              if (laser) _setLaserLength(laser, mmIntersects[0].distance);
              if (hitDot) {
                hitDot.visible = laserVisible;
                hitDot.position.copy(mmIntersects[0].point);
                const dotScale = closest ? 0.075 : 0.05;
                hitDot.scale.set(dotScale, dotScale, 1);
              }
              vrMinimapDebug.laserHand = hand;
              vrMinimapDebug.laserHitX = Math.round(cx);
              vrMinimapDebug.laserHitY = Math.round(cy);
            }
          } catch (err) {
            vrMinimapDebug[hand === 'left' ? 'rayHitLeft' : 'rayHitRight'] = false;
          }
        }
        if (!hitThisHand) {
          if (laser) _setLaserLength(laser, 8);
          if (hitDot) hitDot.visible = false;
        }
      });

      if (ringVisible) {
        _updateRingHandHover('left', ringHits.left);
        _updateRingHandHover('right', ringHits.right);
      } else {
        _updateRingHandHover('left', null);
        _updateRingHandHover('right', null);
      }
      if (vrMinimapMesh) {
        if (minimapExpanded) {
          _updateMinimapHandHover('left', minimapMarkerHits.left);
          _updateMinimapHandHover('right', minimapMarkerHits.right);
        } else {
          _updateMinimapCompactHover('left', minimapPanelHits.left);
          _updateMinimapCompactHover('right', minimapPanelHits.right);
        }
      }

      // Trigger (button[0]) arm/press handling, keyed by handedness and
      // independent of the button-mapped polling in _pollVrInputSources —
      // Trigger is explicitly reserved/unused there. A hand starts un-armed
      // and only arms once seen with the trigger RELEASED, so the squeeze
      // that started the VR session can never select on the first frames;
      // every selection drops armed again, so re-selecting (including after
      // a fade, and after any minimap mode switch) always requires
      // release-then-press. State keeps updating during the fade so nothing
      // stale fires when it ends.
      //
      // Left Menu (button[12]) is polled here too, unconditionally. v2.20.2:
      // with Scene Ring suspended, it now toggles the minimap's
      // compact/expanded state instead of ring visibility (see
      // VR_SCENE_RING_ENABLED / _toggleVrMinimapModeViaMenu) — it is the
      // primary open/close control; compact-panel Trigger remains a
      // secondary way to expand. It only ever reads
      // source.gamepad.buttons[12] on the left hand; it does not touch the
      // Right A/Left X/Right B/Left Y polling in _pollVrInputSources.
      const session = renderer && renderer.xr && renderer.xr.getSession ? renderer.xr.getSession() : null;
      const sources = session && session.inputSources ? Array.from(session.inputSources) : [];
      // Floor stick-click (button[3]) edges this frame, collected per hand
      // so a same-frame double-press (both sticks clicked together) can be
      // detected and ignored below, instead of acting on whichever hand's
      // XRInputSource happens to iterate first.
      const floorStickEdge = { left: false, right: false };
      // v2.20.2: set when Left Menu actually changes the minimap mode this
      // frame — the Trigger handling below was computed against the mode
      // cached at the TOP of this function (minimapExpanded), which a
      // same-frame Menu toggle can make stale (e.g. Menu just closed
      // expanded->compact, but minimapMarkerHits was still populated from
      // this frame's earlier expanded-mode raycast and would otherwise fire
      // a scene jump the instant the panel closes). Left Menu and Trigger
      // are physically only ever both pressable on the SAME hand (left), so
      // this only ever suppresses that one hand's Trigger action for the
      // rest of this frame — satisfies "左Menu toggleとTrigger selectionが
      // 同一フレームで競合しない" without re-raycasting mid-frame.
      let minimapModeChangedByMenu = false;
      sources.forEach((source) => {
        const handedness = source.handedness;
        if (handedness !== 'left' && handedness !== 'right') return;
        const gamepad = source.gamepad;
        if (!gamepad || !gamepad.buttons) return;

        // v2.20.2: same armed/pressed edge-detection shape as
        // vrRingTrigger/vrFloorStick below (not the older prevPressed
        // WeakMap _toggleVrRingEnabled used) — a held Menu button can never
        // repeat-toggle, and it only re-arms once observed released.
        if (handedness === 'left' && gamepad.buttons[12]) {
          const menuPressed = !!gamepad.buttons[12].pressed;
          if (!menuPressed) {
            vrMinimapMenuToggle.armed = true;
          } else if (vrMinimapMenuToggle.armed && !vrMinimapMenuToggle.pressed) {
            const modeBefore = vrMinimapMode;
            _toggleVrMinimapModeViaMenu();
            if (vrMinimapMode !== modeBefore) minimapModeChangedByMenu = true;
            vrMinimapMenuToggle.armed = false;
          }
          vrMinimapMenuToggle.pressed = menuPressed;
          vrMinimapDebug.menuArmed = vrMinimapMenuToggle.armed;
        }

        // Stick-click (button[3]) — VR floor navigation (v2.19). Confirmed
        // unused elsewhere in this file. Independent per-hand armed/pressed
        // state (vrFloorStick), same edge-detection shape as vrRingTrigger
        // below, but a separate button/state entirely — never touches
        // Trigger, Menu, or the Right A/Left X/Right B/Left Y polling in
        // _pollVrInputSources. Placed before the `if (!gamepad.buttons[0])
        // return;` below so it still runs even on a gamepad that happens to
        // lack a trigger entry.
        if (gamepad.buttons[3]) {
          const fst = vrFloorStick[handedness];
          const stickPressed = !!gamepad.buttons[3].pressed;
          if (!stickPressed) {
            // Observed released — from here on a fresh press may move a floor.
            fst.armed = true;
          } else if (fst.armed && !fst.pressed) {
            floorStickEdge[handedness] = true;
            fst.armed = false;
          }
          fst.pressed = stickPressed;
        }

        if (!gamepad.buttons[0]) return;
        const st = vrRingTrigger[handedness];
        const pressed = !!gamepad.buttons[0].pressed;
        if (!pressed) {
          // Observed released — from here on a fresh press may select.
          st.armed = true;
        } else if (st.armed && !st.pressed && !fading && !(handedness === 'left' && minimapModeChangedByMenu)) {
          // v2.20.1: exactly one Trigger action per hand per frame, chosen
          // by the mode cached at the top of this function —
          //   compact:  panel hover -> enter expanded; else Ring hover -> select.
          //   expanded: marker hover -> jump; else (panel or nothing) -> close
          //             to compact. Scene Ring never reacts while expanded
          //             (visible/hover are already forced off above).
          // One shared armed/pressed state the whole way through — no
          // parallel state, so nothing here can double-fire off one press.
          if (!minimapExpanded) {
            if (minimapPanelHits[handedness]) {
              _setVrMinimapMode('expanded', 'compact-trigger');
              st.armed = false;
            } else if (VR_SCENE_RING_ENABLED && vrRingEnabled && vrRingHovered[handedness]) {
              _selectVrRingItem(vrRingHovered[handedness]);
              st.armed = false;
            }
          } else {
            if (minimapMarkerHits[handedness]) {
              _selectVrMinimapMarker(minimapMarkerHits[handedness]);
              st.armed = false;
            } else {
              _setVrMinimapMode('compact', 'background-close');
              st.armed = false;
            }
          }
        }
        st.pressed = pressed;
      });

      // Both stick-clicks edged in the same frame: act on neither (avoids
      // an ambiguous double floor move). Left alone → one floor down;
      // right alone → one floor up. _vrGoFloor no-ops safely on its own
      // (busy/edge-floor/single-floor), so no extra guard is needed here.
      if (floorStickEdge.left && floorStickEdge.right) {
        vrFloorDebug.lastAction = 'ignored (both stick-clicks same frame)';
      } else if (floorStickEdge.left) {
        _vrGoFloor(-1);
      } else if (floorStickEdge.right) {
        _vrGoFloor(1);
      }
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
    // A/X never changes floor (_getNavOrder() stays scoped to
    // activeFloorplanId), so only the current-position highlight needs a
    // lightweight redraw — no marker-list/image rebuild.
    _drawVrMinimap();
  }

  function vrGoPrevScene() {
    if (!inVrSession || !scenes.length) return;
    prevScene();
    vrDebug.prevCount++;
    console.log('[VR]', 'scene prev', currentIdx);
    _vrShowHud();
    _drawVrMinimap();
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
    _disposeVrMinimap();
    vrHudVisible = true;
    _vrResetInputState();
    _vrResetFloorNavState();
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
    if (previewActive) { showToast('プレビュー中はVRを開始できません'); return; }
    try {
      startRender(); // no-op when the loop is already running (normal case)
      vrHudVisible = true;
      _vrResetInputState();
      _vrResetFloorNavState();
      _createVrHud();
      _createVrSceneRing();
      _createVrMinimap();
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
      _disposeVrMinimap();
      _vrResetInputState();
      _vrResetFloorNavState();
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
  // Test-only hook: genuine WebXR immersive sessions require real XR
  // hardware/runtime and have never been reachable in this headless test
  // environment (xrSupported resolves false, vrBtn stays disabled — VR
  // entry itself has no Playwright coverage for this reason). Exposes
  // enterVr() itself plus the inVrSession flag it depends on, so the
  // Preview<->VR exclusion guards (see startViewerPreview()/enterVr()
  // above) can be exercised deterministically without a real session.
  // getCameraFov() is a plain read-only accessor for asserting the single
  // -view camera's zoom is untouched across a Preview round-trip (there is
  // no dedicated zoom state variable — see script.js's camera object
  // itself). Never read by any production/UI code path.
  window.__viewerPreviewTestHooks = {
    isPreviewActive: () => previewActive,
    isInVrSession:   () => inVrSession,
    setInVrSession:  (v) => { inVrSession = v; },
    enterVr,
    getCameraFov:    () => (camera ? camera.fov : null),
  };

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
    if (!assertEditorMode('平面図追加')) return;
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
    markProjectDirty('平面図追加');
    renderFloorplanList();
    renderSceneFilterBar();
    renderDashboard();
    showToast(`平面図を ${valid.length} 件追加しました`);
  }

  function deleteFloorplan(id) {
    if (!assertEditorMode('平面図削除')) return;
    const fp = projectState.floorplans.find(f => f.id === id);
    if (fp) URL.revokeObjectURL(fp.blobUrl);
    projectState.floorplans = projectState.floorplans.filter(f => f.id !== id);
    projectState.markers    = projectState.markers.filter(m => m.floorplanId !== id);
    // Clear floorplanId from scenes that referenced deleted floor plan
    scenes.forEach(s => { if (s.floorplanId === id) s.floorplanId = null; });
    if (activeFloorplanId === id)
      activeFloorplanId = projectState.floorplans[0]?.id || null;
    if (sceneFilterFloorplanId === id) sceneFilterFloorplanId = null;
    markProjectDirty('平面図削除');
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

  // ============================================================
  // FloorMap (floorplan) renaming — third operation wired into
  // HistoryManager (v2.22.x+)
  // ============================================================
  // Single point that actually applies a floorplan's name and refreshes
  // every place that currently displays it (the sidebar floorplan list,
  // and — matching the rename handler's pre-existing behavior — the
  // FloorMap Navigator's floorplan select when this is the active
  // floorplan). Used both for a live user rename and for undo/redo
  // replaying a past rename, so there is exactly one place that needs to
  // stay in sync with whatever the sidebar/select actually show.
  //
  // Always marks the project dirty, including when called from undo/
  // redo, matching applySceneName()'s same rule: undoing back to a
  // previously-saved name does not by itself mean the project is saved
  // again.
  //
  // Never calls historyManager.push() itself — only the rename commit
  // handler below does, at the single point a user actually confirms a
  // new name. That keeps undo()/redo() (which call this function) from
  // ever recording a new history entry while replaying one.
  function applyFloorMapName(floorplanId, name) {
    const fp = projectState.floorplans.find(f => f.id === floorplanId);
    if (!fp) return;
    fp.name = name;
    renderFloorplanList();
    if (floorplanId === activeFloorplanId) _updateFloormapSelect();
    markProjectDirty('平面図名称変更');
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
        if (!canMutateProject()) return;
        nameEl.contentEditable = 'true';
        nameEl.classList.add('editing');
        const r = document.createRange(); r.selectNodeContents(nameEl);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      });
      nameEl.addEventListener('blur', () => {
        nameEl.contentEditable = 'false'; nameEl.classList.remove('editing');
        if (!canMutateProject()) { nameEl.textContent = fp.name; return; }
        const newName = nameEl.textContent.trim() || fp.name;
        if (newName !== fp.name) {
          // Capture before/after now — fp.id never changes, but fp.name is
          // about to; renderFloorplanList() inside applyFloorMapName() also
          // recreates this exact DOM node, so nothing here is touched again
          // after this branch.
          const floorplanId = fp.id, oldName = fp.name, confirmedName = newName;
          applyFloorMapName(floorplanId, confirmedName);
          historyManager.push({
            label: 'Rename floor map',
            undo: () => applyFloorMapName(floorplanId, oldName),
            redo: () => applyFloorMapName(floorplanId, confirmedName),
          });
        } else {
          nameEl.textContent = fp.name;
          // Update select if this is active
          if (fp.id === activeFloorplanId) _updateFloormapSelect();
        }
      });
      nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); nameEl.blur(); }
        if (e.key === 'Escape') { nameEl.textContent = fp.name; nameEl.blur(); }
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'floorplan-del-btn editor-only';
      delBtn.textContent = '×'; delBtn.title = 'この平面図を削除';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteFloorplan(fp.id); });

      div.appendChild(icon); div.appendChild(nameEl); div.appendChild(delBtn);
      // Mirrors the scene list's `if (i !== currentIdx) switchToScene(i)`
      // guard: a native dblclick fires two click events before the dblclick
      // itself, and re-rendering on an already-active item would tear down
      // nameEl mid-rename.
      div.addEventListener('click', () => { if (fp.id !== activeFloorplanId) setActiveFloorplan(fp.id); });
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
    if (!canMutateProject()) return;
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
      li.draggable = canMutateProject();
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
        if (!canMutateProject()) return;
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
        if (!assertEditorMode('マーカー並び替え')) return;
        const isBefore = e.clientY < li.getBoundingClientRect().top + li.getBoundingClientRect().height / 2;
        let insertAt = isBefore ? listIdx : listIdx + 1;
        if (_mkDragSrcIdx < insertAt) insertAt--;
        // Reorder: remove from src, insert at dest
        const moved = markers.splice(_mkDragSrcIdx, 1)[0];
        markers.splice(insertAt, 0, moved);
        // Re-sequence orders 1,2,3...
        markers.forEach((m, i) => { m.order = i + 1; });
        markProjectDirty('マーカー並び替え');
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
    if (!canMutateProject()) return; // every item in this menu mutates markers
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
        markProjectDirty('マーカー番号変更');
        renderMarkerList(); renderFloormapCanvas();
      }},
      { label: '↓ 番号を後ろへ', disabled: mkPos >= fpMarkers.length - 1, action: () => {
        const next = fpMarkers[mkPos + 1];
        [mk.order, next.order] = [next.order, mk.order];
        markProjectDirty('マーカー番号変更');
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
    // Drag marker — position mutation only; click-to-select/navigate
    // (mousedown/mouseup below) stays available in Viewer mode, it just
    // never moves anything: no early return here on purpose, so a Viewer
    // dragging a marker still sees normal cursor/select feedback with no
    // visible "broken" drag, it simply doesn't move the marker.
    if (!isDraggingMarker || !_dragMarkerId) return;
    const fp2 = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (!fp2?._renderArea) return;
    if (!canMutateProject()) return;
    const coords = _canvasToImage(e);
    if (!coords) return;
    const mk = projectState.markers.find(m => m.id === _dragMarkerId);
    if (mk) { mk.x = coords.x; mk.y = coords.y; markProjectDirty('マーカー移動'); renderFloormapCanvas(); }
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
    // Defense-in-depth: isPlacementMode can normally only become true via
    // the already-guarded togglePlacementMode(), but this is the actual
    // marker-creation entry point, so it gets its own check too.
    if (!canMutateProject()) return;
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
    markProjectDirty('マーカー配置');
    renderFloormapCanvas();
    _updateInfoPanel();
    renderMarkerList();
    renderSceneList();
    renderSceneFilterBar();
    if (isNew) renderDashboard();
    showToast(`「${curScene.name}」のマーカーを配置しました（向き: ${initialRot}°）`);
  });

  function togglePlacementMode() {
    if (!assertEditorMode('マーカー配置モード')) return;
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
    if (!assertEditorMode('マーカー回転')) return;
    mk.rotation = ((mk.rotation || 0) + delta + 360) % 360;
    markProjectDirty('マーカー回転');
    renderFloormapCanvas(); _updateInfoPanel(); renderMarkerList();
  }

  function deleteSelectedMarker() {
    if (!selectedMarkerId) return;
    if (!assertEditorMode('マーカー削除')) return;
    const mk = projectState.markers.find(m => m.id === selectedMarkerId);
    if (mk) {
      const sceneId = mk.sceneId;
      projectState.markers = projectState.markers.filter(m => m.id !== selectedMarkerId);
      // If scene has no more markers, clear its floorplanId
      const scene = scenes.find(s => s.id === sceneId);
      if (scene && !isScenePlaced(scene)) scene.floorplanId = null;
      markProjectDirty('マーカー削除');
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
    if (!assertEditorMode('平面図の方位補正')) return;
    const fp = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (!fp) return;
    fp.rotationOffset = parseInt(floormapOrientPreset.value, 10);
    floormapOrientVal.textContent = `${fp.rotationOffset}°`;
    markProjectDirty('平面図の方位補正');
    renderFloormapCanvas();
  });
  function _adjustOrientOffset(delta) {
    if (!assertEditorMode('平面図の方位補正')) return;
    const fp = projectState.floorplans.find(f => f.id === activeFloorplanId);
    if (!fp) return;
    fp.rotationOffset = ((fp.rotationOffset || 0) + delta + 360) % 360;
    floormapOrientVal.textContent = `${fp.rotationOffset}°`;
    floormapOrientPreset.value = String(fp.rotationOffset);
    markProjectDirty('平面図の方位補正');
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
    // Defense-in-depth: this button lives inside .floormap-info-actions
    // (editor-only in CSS) and the context-menu path to it is already
    // gated, but the handler itself had no independent check — add one so
    // a hidden-element/programmatic click can't enable editing in Viewer.
    if (!canMutateProject()) return;
    floormapInfoName.contentEditable = 'true';
    floormapInfoName.focus();
    const r = document.createRange();
    r.selectNodeContents(floormapInfoName);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(r);
  });
  floormapInfoName.addEventListener('dblclick', () => {
    if (!canMutateProject()) return;
    floormapInfoName.contentEditable = 'true';
    floormapInfoName.focus();
    const r = document.createRange();
    r.selectNodeContents(floormapInfoName);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(r);
  });
  floormapInfoName.addEventListener('blur', () => {
    floormapInfoName.contentEditable = 'false';
    if (!canMutateProject()) return;
    const mk = projectState.markers.find(m => m.id === selectedMarkerId);
    if (mk) {
      const trimmed = floormapInfoName.textContent.trim();
      if (trimmed && trimmed !== mk.name) { mk.name = trimmed; markProjectDirty('マーカー名称変更'); }
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
    if (!assertEditorMode('グループ作成')) return;
    const name = groupPickerInput.value.trim();
    if (!name) return;
    const group = { id: genId(), name };
    projectState.groups.push(group);
    if (_groupPickerSceneIdx >= 0 && scenes[_groupPickerSceneIdx]) {
      scenes[_groupPickerSceneIdx].groupId = group.id;
    }
    markProjectDirty('グループ作成');
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
    // project-info-btn (the only caller) is already editor-only in the DOM;
    // guard here too so a hidden-element/programmatic call can't surface
    // this editing-oriented modal in Viewer (saveProjectInfo() is guarded
    // independently, but the dialog itself should never appear either).
    if (!assertEditorMode('プロジェクト情報編集')) return;
    $('pi-name').value   = projectState.projectName || '';
    $('pi-client').value = projectState.projectInfo.client || '';
    $('pi-author').value = projectState.projectInfo.author || '';
    $('pi-date').value   = projectState.projectInfo.date   || '';
    $('pi-notes').value  = projectState.projectInfo.notes  || '';
    showEl($('project-info-modal'));
  }

  function closeProjectInfoModal() { hideEl($('project-info-modal')); }

  function saveProjectInfo() {
    if (!assertEditorMode('プロジェクト情報保存')) return;
    const name = $('pi-name').value.trim();
    if (name) projectState.projectName = name;
    projectState.projectInfo.client = $('pi-client').value.trim();
    projectState.projectInfo.author = $('pi-author').value.trim();
    projectState.projectInfo.date   = $('pi-date').value;
    projectState.projectInfo.notes  = $('pi-notes').value.trim();
    markProjectDirty('プロジェクト情報保存');
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
      appVersion:  '2.22.0',
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
    if (!assertEditorMode('JSON書き出し')) return;
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
    // Browsers give no reliable "saved to disk" signal for a download; per
    // this app's existing save UX, reaching this point (blob built, download
    // triggered without throwing) is treated as save success — see PR body.
    markProjectClean('JSON書き出し');
    showToast('プロジェクトをJSONとして書き出しました（画像データは含まれません）');
  }

  // ============================================================
  // ZIP Project Package Export (v2.12)
  // ============================================================
  function _pad2(n) { return String(n).padStart(2, '0'); }

  async function exportProjectPackage() {
    if (!assertEditorMode('ZIPパッケージ書き出し')) return;
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
      // Same "no reliable disk-save signal" constraint as JSON export — see
      // exportProjectJSON() and PR body.
      markProjectClean('ZIPパッケージ書き出し');

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

  async function _doImportWithFiles(fileList) {
    if (!_importData) return;
    // Same "open into empty project" exception as handleFiles(): restoring
    // a JSON/ZIP into an empty viewer is viewing a file, not editing one.
    // Importing into an already-loaded project merges/overwrites existing
    // scenes/floorplans/markers, which is editing and requires Editor.
    // Covers both the JSON-only path and the ZIP path (_doImportZipPackage
    // delegates to this same function).
    const projectWasEmpty = !scenes.length && !projectState.floorplans.length;
    if (!projectWasEmpty && !assertEditorMode('JSON/ZIP読み込み')) return;
    // Importing into a non-empty project can overwrite projectInfo/
    // projectName and any marker sharing an id with the imported data, so
    // it goes through the same 'replace-project' confirmation as any other
    // project-replacing operation. Opening into an empty project never
    // reaches here (nothing to lose), so it's never gated.
    if (!projectWasEmpty) {
      const result = await confirmUnsavedChanges('replace-project');
      if (result === 'cancel') return;
    }
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
    // Opening into an empty project is a load (clean); merging into an
    // already-loaded one is an edit (dirty) — same "open vs add" split as
    // handleFiles().
    if (projectWasEmpty) markProjectClean('プロジェクトを開く');
    else markProjectDirty('JSON/ZIP読み込み');
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
    // Snapshot into a plain array before resetting .value: _doImportWithFiles()
    // is async and, for a non-empty project, suspends at its own
    // `await confirmUnsavedChanges()` before ever reading this list — by
    // which time a live FileList reference from importImagesInput.files would
    // already have been emptied by the reset below. _doImportWithFiles()
    // already treats its argument as an iterable (Array.from(fileList)), so
    // an Array works exactly like the FileList did.
    const files = Array.from(importImagesInput.files || []);
    importImagesInput.value = '';
    if (files.length) _doImportWithFiles(files);
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

  // ============================================================
  // Undo / Redo — buttons + Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z
  // ============================================================
  // Only scene renaming is wired into HistoryManager so far (see
  // applySceneName()); these buttons/shortcuts just expose whatever is
  // already on its stacks, so no operation-specific logic lives here.
  function performUndo() {
    if (!canMutateProject()) return;
    if (!historyManager.canUndo()) return;
    historyManager.undo();
  }

  function performRedo() {
    if (!canMutateProject()) return;
    if (!historyManager.canRedo()) return;
    historyManager.redo();
  }

  if (undoBtn) undoBtn.addEventListener('click', performUndo);
  if (redoBtn) redoBtn.addEventListener('click', performRedo);

  document.addEventListener('keydown', (e) => {
    // Ignore key-repeat so holding the combo doesn't fire undo/redo
    // over and over.
    if (e.repeat) return;
    if (e.key.toLowerCase() !== 'z') return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;

    // Never steal the shortcut from a field the user is actively typing
    // or editing in — this includes the scene-name span while it's the
    // contentEditable rename field, so the browser's own native undo
    // inside that field keeps working exactly as before.
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.activeElement?.contentEditable === 'true') return;

    if (!canMutateProject()) return; // Viewer mode: never run, never preventDefault

    if (e.shiftKey) {
      if (!historyManager.canRedo()) return; // empty: never preventDefault
      e.preventDefault();
      historyManager.redo();
    } else {
      if (!historyManager.canUndo()) return; // empty: never preventDefault
      e.preventDefault();
      historyManager.undo();
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
