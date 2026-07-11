# ArchView360 VR Render Path Audit (v2.15.2)

This is not a feature document — it is a diagnostic record for a single
question: **why doesn't anything ArchView360 adds to the VR scene (HUD,
Debug Panel, v2.15.1's camera-forward cube) show up on Meta Quest 3 /
Quest Browser, when WebXR-Sandbox's equivalent implementations do?**

Scope note: this audit's own code changes (v2.15.2) are limited to the VR
render-path block in `script.js` (state/HUD/probe/`vrLoop`/`enterVr`/
`onVrSessionEnd`) plus this document. FloorMap, compare mode, ZIP
import/export, the image loader, normal scene management, and Observer
Mode's own logic were read for cross-references only and were not
modified.

## 1. WebXR-Sandbox との差分

`WebXR-Sandbox` (`airesearchagl-art/WebXR-Sandbox`) is outside this
session's configured repository scope (`airesearchagl-art/obsidian-vault`
and `airesearchagl-art/archview360` only), so this table is built from the
Sandbox findings already relayed into this conversation by the user
(merge commit `34e3d4cf5f1da9c1c7fe3181a67bbe78fdc26ee2`, `README.md` /
`docs/findings.md` summaries), not from a fresh read of the Sandbox
source. If a discrepancy is found later between this table and the actual
Sandbox code, the Sandbox code wins.

| 項目 | WebXR-Sandbox | ArchView360現状（v2.15.1時点） | 差分 | 影響 |
|---|---|---|---|---|
| renderer初期化 | 単一 `WebGLRenderer`、`xr.enabled = true` を session要求前に設定 | 単一 `renderer`（`initThree()`内で1回だけ生成）。`renderer.xr.enabled = true` は `enterVr()` 冒頭で設定 | 無し（同一パターン） | 影響なし |
| session開始 | `navigator.xr.requestSession('immersive-vr')` → `renderer.xr.setSession(session)` | 同じ順序（`requestSession` → `setSession`） | 無し | 影響なし |
| `renderer.setAnimationLoop()` | VR中は`setAnimationLoop(loop)`のみ、通常`requestAnimationFrame`は完全停止 | v2.15.1時点でも`stopRender()`→`setSession`→`setAnimationLoop(vrLoop)`の順で呼ばれており、通常rAFは`inVrSession`フラグと`animFrameId`nullチェックで実質停止していた（本監査で構造を明示化） | 実装上はほぼ同一。ただし「明示的な状態変数」が無く、口頭でしか保証されていなかった | 低（心理的な不確実性はあったが、実挙動は既に単一ループだった） |
| `renderer.render(scene, camera)` | `setAnimationLoop`のコールバック内で1箇所のみ呼び出し | `vrLoop()`内で1箇所のみ（`renderer.render(threeScene, camera)`）。通常表示用の`startRender()`内にも1箇所あるが、VR中は到達しない | 無し（両者とも「VR用ループ内で1箇所」） | 影響なし |
| SceneへのCube追加 | `scene.add(cube)` を1回、Session開始時に実行。以降動かさない、または`camera-forward`で明示的に毎フレーム再配置 | v2.15.1では`threeScene.add(vrProbeMesh)`を1回、以降`vrLoop`内で毎フレーム`camera.getWorldPosition/getWorldDirection`から再配置 | 再配置ロジックの有無。Sandboxの「World Grid」的な検証は**固定座標**Cubeで、毎フレーム計算に依存していない | **高（本監査の主眼）**。camera-forward計算自体に問題がある可能性を切り分けるため、v2.15.2で固定座標4Cubeへ変更 |
| Camera前方配置 | `camera.getWorldPosition/getWorldDirection`によるcamera-forward、または固定座標のいずれかで検証。camera-forwardはSandboxでも「HUD用」として別途検証済み | v2.15.1のCube・v2.15のHUDともにcamera-forward方式 | 無し（同じ数式を使用） | 中。数式自体はSandboxで動作実績があるため、数式のバグよりは呼び出しタイミング／描画対象Sceneの疑いが強い |
| `inputSources` polling | `session.inputSources`を`requestAnimationFrame`相当のXRループ内で毎フレーム確認 | `_pollVrInputSources()`を`vrLoop()`内で毎フレーム呼び出し | 無し | 影響なし（本PRでは変更していない） |

**結論：** 実装パターン自体はSandboxとほぼ一致しており、「controller
eventに依存している」「setAnimationLoopを複数系統持っている」といった
構造的な誤りは見つかりませんでした（詳細は次項）。次に疑うべきは
camera-forward計算のタイミング依存性、またはArchView360固有の
Scene/Camera構成（後述）です。

## 2. ArchView360のVR描画経路

### Scene / Camera の生成箇所

```
new THREE.Scene()               … 3箇所
  script.js:462  threeScene = new THREE.Scene();       ← 単体表示用（VRで使用）
  script.js:490  sceneA     = new THREE.Scene();        ← 比較モードA面用
  script.js:495  sceneB     = new THREE.Scene();        ← 比較モードB面用

new THREE.PerspectiveCamera()   … 3箇所
  script.js:463  camera  = new THREE.PerspectiveCamera(...)  ← 単体表示用（VRで使用）
  script.js:491  cameraA = new THREE.PerspectiveCamera(...)  ← 比較モードA面用
  script.js:496  cameraB = new THREE.PerspectiveCamera(...)  ← 比較モードB面用
```

- `threeScene`・`camera`は`initThree()`内で**それぞれ1回だけ**生成され、
  以降どこでも再代入されていません（`grep -n "threeScene\s*="`・
  `grep -n "^\s*camera\s*="`で確認、結果は生成箇所の1件のみ）。
- VRは`compareState.mode === 'single'`の場合のみ開始できる
  （`enterVr()`内のガード）ため、VR中に使われるのは常に`threeScene`/
  `camera`の組であり、`sceneA/B`・`cameraA/B`が混入する経路はありません。
- シーン切替（`_doSwitchToScene` → `buildSphere`）は`disposeCurrentSphere()`
  で球体メッシュ（`sphere`）だけを`threeScene`から取り除いて作り直して
  おり、**`threeScene`自体をclear/replaceすることはありません**。VR中に
  追加されたHUDメッシュ・Cube Probeは、シーン切替のたびに消えることは
  ありません。

### `renderer.render()` 呼び出し箇所

```
script.js:1589  rendererA.render(sceneA, cameraA)   ← 分割比較モード（syncViews ON）
script.js:1590  rendererB.render(sceneB, cameraB)   ← 分割比較モード（syncViews ON）
script.js:1599  rendererA.render(sceneA, cameraA)   ← 分割比較モード（syncViews OFF）
script.js:1604  rendererB.render(sceneB, cameraB)   ← 分割比較モード（syncViews OFF）
script.js:1612  renderer.render(threeScene, camera) ← 通常の単体表示rAFループ内（startRender）
script.js:3060  renderer.render(threeScene, camera) ← vrLoop() 内（VRセッション中の唯一の呼び出し）
```

VR中に到達しうるのは`script.js:3060`（`vrLoop()`内）のみです。
`script.js:1612`は`startRender()`の`loop()`内にあり、後述の通りVR中は
このループ自体が停止しているため到達しません。

### `requestAnimationFrame()` 呼び出し箇所（15箇所）

大半はUI用の1回きりのレイアウト調整（`fitComparePanes`・
`renderFloormapCanvas`・フェード演出など）で、繰り返し呼び出す「ループ」
として機能しているのは`startRender()`内の`loop()`（`script.js:1575`
付近、自己再帰する`requestAnimationFrame(loop)`）だけです。他の14箇所は
いずれも一度限りの`requestAnimationFrame(() => { ... })`で、ループでは
ありません。

### `setAnimationLoop()` 呼び出し箇所（2箇所）

```
enterVr():         renderer.setAnimationLoop(vrLoop)   ← VRセッション開始時に1回
onVrSessionEnd():   renderer.setAnimationLoop(null)     ← VRセッション終了時に1回
```

呼び出し箇所はこの2つのみで、多重登録・多重解除は起きていません。

### 通常rAFループとVR loopの競合有無

`enterVr()`の実行順序：

```
renderer.xr.enabled = true
_createVrHud() / _createVrProbeCubes()
await navigator.xr.requestSession('immersive-vr', ...)
inVrSession = true; renderMode = 'vr'
stopRender()                          ← 通常rAFループをここで確実に停止
await renderer.xr.setSession(session)
renderer.setAnimationLoop(vrLoop)     ← ここでVRループ開始
```

`stopRender()`は`cancelAnimationFrame(animFrameId)` + `animFrameId = null`
のみを行うシンプルな関数で、`setAnimationLoop(vrLoop)`より**前**に呼ばれ
ています。したがって、VRループが開始される時点で通常rAFループは確実に
停止しており、二重描画（同一フレームでの`renderer.render()`二重呼び出し）
は構造的に起こり得ません。

シーン切替時（`loadPanorama()`内）も`stopRender()`は呼ばれますが、
`startRender()`は`if (!inVrSession) startRender();`でガードされており、
VR中は再起動されません（v2.13で導入済みのガード、本監査で確認のみ）。

VR終了時（`onVrSessionEnd()`）は`setAnimationLoop(null)`のあとに
`startRender()`を1回だけ呼び、通常ループを再開します。

### v2.15.2で明示化した状態

上記の挙動は既に（暗黙的に）正しく実装されていましたが、「本当に単一
経路か」を毎回コードジャンプして確認する必要があったため、以下を追加
しました。

- `renderMode`（`'normal' | 'vr'`）: VRセッションの開始/終了と同期して
  切り替える単一の状態変数。過剰な状態管理を避けるため、これ1つのみ
  追加しています。
- `vrRenderDebug`: `threeSceneUuid`・`cameraUuid`・`xrEnabled`・
  `animationLoopActive`・`normalRafActive`・`cubeCount`・
  `lastLoopAt`・`frameCount`を保持し、通常画面の「VR Debug Log」へ
  ミラーします。VR内Debug Panelの追加は今回スコープ外のため行って
  いません。

## 3. 既存VR Debug Probeの整理

| 項目 | 状態 | 対応 |
|---|---|---|
| v2.14.1 Debug Probe（赤WORLD PANEL/青CAMERA PANEL） | v2.15で完全削除済み（`_createVrDebugProbe`等は既に存在しない） | 対応不要（既に整理済み） |
| v2.15 camera-forward HUD（`_createVrHud`/`_updateVrHudPose`/`_drawVrHud`） | 現役。本PRでは**変更していません**（HUD方式の再修正は指示外） | 変更なし |
| v2.15.1赤Cube Probe（camera前方追従の単一Cube） | 本PRで置き換え。`_createVrProbeMesh`/`_updateVrProbeMesh`/`_disposeVrProbeMesh`を削除し、`_createVrProbeCubes`/`_disposeVrProbeCubes`（固定座標4Cube、毎フレーム更新なし）に置換 | 削除・置換（最小差分） |
| VR Debug Log（`_renderVrDebugLog`） | 現役。本PRでレンダーパス診断フィールドを追記（入力系フィールドは維持） | 拡張のみ |
| Controller polling（`_pollVrInputSources`/`_vrActionForButton`/`_vrRunAction`） | 現役。本PRでは**変更していません** | 変更なし |
| 旧HUD/旧Probeの残骸 | `grep`で`vrProbeMesh`・`_createVrDebugProbe`・`_updateVrDebugProbe`・`xrCamStatus`等の旧識別子が残っていないことを確認済み（0件） | 該当なし |

未使用コード・到達不能コード・同一状態の重複管理は、上記の入れ替え
以外には見つかりませんでした。大規模なリファクタリングは今回のスコープ
外のため実施していません。

## 4. 絶対座標Cube Probe（v2.15.2）

v2.15.1の「camera前方1.5mへ毎フレーム追従する赤Cube」は、camera-forward
計算そのものが疑わしい変数だったため、いったん使用を止めました。
代わりに、VR開始時に同一`threeScene`へ以下4つのCubeを**固定座標**で
追加します（以降、位置は更新しません）。

| 色 | 座標 |
|---|---|
| Red | `(0, 0, -2)` |
| Blue | `(0, 0, 2)` |
| Green | `(2, 0, 0)` |
| Yellow | `(-2, 0, 0)` |

- `BoxGeometry(0.4, 0.4, 0.4)` / `MeshBasicMaterial` /
  `depthTest: false` / `depthWrite: false` / `renderOrder: 9999`
- `threeScene.add(...)`のみ（`camera.add()`・
  `renderer.xr.getCamera().add()`は使用しない）
- VR開始時に追加、VR終了時に`dispose`
- 毎フレームの位置更新は行わない

どの方向を向いても4方向のいずれかにCubeが存在するため、camera-forward
計算を完全に排除した状態で「ArchView360が追加したMeshがXR描画に乗って
いるか」だけを確認できます。

## 5. 未対応事項 / 次のステップ

- 本PRはコードレベルの構造監査であり、Quest 3実機での見え方は未確認
  です。マージ後のVercel Production反映後に実機確認が必要です。
- 4色Cubeのいずれも見えない場合、問題はArchView360のコード構造では
  なく、WebXRセッションの`referenceSpaceType`（`local-floor` /
  `bounded-floor`のoptionalFeatures指定）や、Quest Browser側の
  レンダーターゲット関連の疑いが強まります。次のステップとして
  `requiredFeatures`指定の見直しや、`renderer.xr.getReferenceSpace()`
  の状態確認を検討してください（本PRでは未実施・未検証です）。
- WebXR-Sandboxリポジトリはこのセッションのリポジトリスコープ外だった
  ため、直接のコード比較ではなく会話内で共有された情報に基づく比較と
  なっています。正確な比較が必要な場合は、Sandbox側リポジトリへの
  アクセス権をこのセッションに追加してください。
