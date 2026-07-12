# VR Runtime移植 — WebXR-Sandbox → ArchView360（v2.16.0）

## 背景

v2.13〜v2.15.2の段階的修正では、Quest 3実機で

- VR開始・パノラマ表示 … **成功**
- HUD / Controller表示 / Cube Probe / WORLD PANEL / CAMERA PANEL … **一切表示されない**

という状態が解決しなかった。v2.15.2では固定座標の4色Cube（(0,1.6,-2) / (0,1.6,2) / (2,1.6,0) / (-2,1.6,0)）まで試したが表示されず、「追加MeshだけがXR描画へ乗らない」ことが確認されている。

一方、WebXR-Sandbox（Three.js + WebXRのみの最小構成）では、同じQuest Browser実機で Cube表示 / Grid表示 / HUD表示（camera-forward）/ inputSources polling / gamepad.buttons（Right A・Left X・Right B・Left Y）まで実証済み。

v2.16では修正の積み重ねをやめ、**Sandboxで動作したScene生成・Camera生成・Renderer生成・AnimationLoop・VR開始・VR終了・HUD・Controller入力を一つのVR Runtimeとして移植**し、ArchView360独自部分（パノラマ画像・シーン一覧・currentIdx・marker.order・nextScene / prevScene）だけを接続する。

## 差分一覧（Sandbox基準実装 vs ArchView360 v2.15.2）

| 項目 | WebXR-Sandbox（Quest 3実機で動作） | ArchView360 v2.15.2（追加Meshが表示されない） | v2.16での対応 |
|---|---|---|---|
| Three.js | **0.169.0**（2024, ESM, Vite） | **r128**（2021, UMDグローバル, vendor同梱） | 0.169.0へ更新（実機検証済み環境との最大の未検証差分） |
| Scene生成 | 起動時に1つ生成、以後不変 | 同等（`initThree`で生成、以後不変） | 変更なし |
| Camera生成 | `PerspectiveCamera` 生成後 **`scene.add(camera)`**（camera子付けHUDの前提） | カメラをシーングラフに**追加していない** | `threeScene.add(camera)` を追加 |
| Renderer生成 | 起動直後に **`renderer.xr.enabled = true`**、以後不変 | VR開始時のみtrue、終了/失敗時にfalseへ戻す | 常時trueへ変更 |
| AnimationLoop | **単一の `renderer.setAnimationLoop(render)`** を起動時に設定。VR中も非VR中も同じループ（three.jsが内部でXRセッションのrAFへ切替） | 非VR: `requestAnimationFrame` ループ / VR: `setAnimationLoop(vrLoop)` へ**入替え**、終了時に逆操作 | rAFループを廃止し、単一 `setAnimationLoop(renderLoop)` に統一（`renderLoop`内で `inVrSession` により分岐） |
| requestSession | VRButton経由: `optionalFeatures: ['local-floor', 'bounded-floor', 'layers']` | 手動: `['local-floor', 'bounded-floor']`（`layers`なし） | VRButtonと同一の3件へ変更 |
| setSession | `renderer.xr.setSession(session)` のみ。ループには触れない | `setSession` 後に `setAnimationLoop(vrLoop)` へ入替え | `setSession` のみ（ループ入替を廃止） |
| VR終了 | `sessionend` 後もループ・`xr.enabled` は不変 | `setAnimationLoop(null)` → `xr.enabled = false` → rAFループ再開 | 後始末はHUD/Cube破棄とcanvasフィットのみ |
| HUD | **camera-forward = HUDメッシュをメインカメラの子に追加**（`camera.add(panel)`、位置は固定ローカルオフセット）。実機で追従・表示・ON/OFF確認済み | 「camera-forward」を**毎フレームworld座標を再計算してscene直下に置く**方式として誤移植（実機未検証のまま） | Sandbox通りの camera子付け方式へ置換（`_updateVrHudPose`廃止） |
| HUD メッシュ仕様 | PlaneGeometry + CanvasTexture, `transparent`, `depthTest:false`, `renderOrder` 大 | 同等 | 変更なし（CanvasTextureに `SRGBColorSpace` を明示） |
| Controller入力 | `session.inputSources` を毎フレームpolling、`gamepad.buttons[].pressed` の false→true エッジ検知。Right A/Left X = #4、Right B/Left Y = #5（Touch Plus実測） | 同方式（WeakMapによる前フレーム状態保持 + 400msクールダウン）— 実装は同等 | 変更なし（Sandboxと等価なため） |
| ボタン割当 | Right A: nextScene / Left X: prevScene / Right B: HUD切替 / Left Y: Debug詳細切替 | 同一 | 変更なし |

### 補足: 0.169.0更新に伴うアプリ側の追随

- three r152以降は `renderer.outputColorSpace` のデフォルトがsRGBのため、パノラマ／比較用テクスチャに `texture.colorSpace = THREE.SRGBColorSpace` を明示（色が浅くなるのを防ぐ）。
- three r150以降はUMDビルド（`three.min.js`）が配布されないため、`vendor/three.module.min.js`（ESM）+ `vendor/three-global.js`（`window.THREE` を公開するシム）で同梱。`script.js` は従来通り非モジュールのまま、既存の `waitForThree()` リトライがシムの実行完了を待つ。

## 移植方針

1. **Sandboxで実証された変数をすべて一致させる**（three本体バージョン、`xr.enabled`のライフサイクル、単一AnimationLoop、camera子付けHUD、`optionalFeatures`）。
2. ArchView360独自部分は接続のみ：`nextScene()` / `prevScene()`（marker.order対応の共通ナビ順）、シーン名・`currentIdx` のHUD表示、Observer Modeへのyaw/fov通知。
3. v2.15.2のCube Probe（固定4色Cube）は**検証基準としてそのまま残す**。次回実機テストで「Cubeが見える＝追加MeshがXRに乗った」を判定する。
4. スコープ外: FloorMap / Compare / Observer大改修 / ZIP / Share360 / Video / Insta360 — 一切変更しない。

## 次回実機テストの確認項目

1. VR開始 → パノラマ表示（従来通り成功すること）
2. 4色Cube（Red手前 / Blue背後 / Green右 / Yellow左、目線高さ1.6m）が見えること
3. HUDパネル（シーン名・Scene n/m・ボタン凡例）が視線に追従して表示されること
4. Right A / Left X でシーンが切り替わること（HUDの Scene n/m が更新される）
5. Right B でHUD表示ON/OFF、Left Y でDebug詳細切替
6. VR終了後、通常表示が復帰し、画面上のVR Debug Logに最終状態が残ること
