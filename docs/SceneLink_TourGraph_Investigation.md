# sceneLink / Tour Graph データモデル設計調査（docs-only）

> 読み手: 次に sceneLink を実装する LLM IDE / Coding Agent、レビュー担当者
> 位置づけ: 設計調査のみ。本ドキュメントの追加自体は実装を一切含まない（`script.js` / `index.html` / `viewer.html` / `style.css` / `tests/` / package files / workflows はいずれも無変更）。
> 調査時点の main: `26ae38302574dcd2cc00eb1fea33c0c11c25fd0e`（PR #58 merge 済み、Playwright 251 tests）

## 1. Current State

コードを直接読んで確認した事実（推測ではなく現行実装の記述）。

### 1.1 既存データモデル

| 対象 | 形 | 定義箇所 |
|---|---|---|
| scene | `{ id, name, fileName, file, blobUrl, flipH, thumbUrl, floorplanId, groupId }` | `handleFiles()` |
| marker | `{ id, floorplanId, sceneId, x, y, rotation, name, order }` | FloorMap canvas の marker 生成箇所 |
| floorplan | `{ id, name, fileName, file, blobUrl, imgEl, rotationOffset }` | `handleFloorplanFiles()` |

- marker の `x` / `y` は **floorplan 画像に対する正規化値 0..1**（描画は `dx + m.x * dw`）。パノラマ解像度には非依存。
- marker は既に `sceneId` を持ち、**実質的に「FloorMap 上の点 → scene」への片方向参照**として機能している。
- `projectState.markers` は**トップレベル配列**で、U5〜U8 の Undo/Redo 拡張はこの形（id で live-scan して filter/push する cascade）を前提に構築されている。

### 1.2 方向に関する現行実装

- カメラ注視方向（XZ 平面）: `lookAt(sin(phi)cos(theta), cos(phi), sin(phi)sin(theta))` → 水平成分は `(x, z) = (cos θ, sin θ)`。
- `thetaToFloorRotation(θ, flipH)` = `((sign · θ · 180/π) mod 360 + 360) mod 360`、`sign = flipH ? -1 : 1`。これが `marker.rotation` の値空間。
- FloorMap 描画: `displayDeg = (marker.rotation + floorplan.rotationOffset) mod 360` → `ctx.rotate(displayDeg · π/180)` → コーンは `-π/2` 中心（画面上方向）に描画。
- **`floorplan.rotationOffset` は描画時にのみ加算され、`marker.rotation` へ書き戻されることはない**（使用箇所は FloorMap 描画の3箇所のみ）。

### 1.3 PR #58 で確定した gesture 規約

パノラマドラッグによる `marker.rotation` 更新は、以下の形に整理済み（sceneLink の heading 編集も同じ規約に乗せられる）。

- gesture 開始で snapshot、終了で 1 回だけ commit（1 gesture = 1 history entry）
- drag 中の書き込みは表示専用（dirty 化も history push もしない）
- `canMutateProject()` により Viewer では永続データを書き換えない
- gesture 中に pinch へ移行 / scene・FloorMap が変化した場合は `_cancelRotationDrag()` / commit 時の marker identity 再検証で破棄・巻き戻し
- apply 関数（`applyMarkerRotation()`）自身は `historyManager.push()` を呼ばない

### 1.4 VR Scene Ring の現状

`VR_SCENE_RING_ENABLED = false`。コードコメントが無効化理由を明記している。

- 「project data has no per-scene 3D coordinates, so ring positions are synthetic (evenly spaced) and are unrelated to FloorMap pin positions」
- Quest 3 実機検証で「合成配置がパノラマ内の実際の方向と対応せず disorienting」と判定され、**削除ではなくフラグで一時停止**
- 「the ring can be re-enabled in one line once a future version aligns ring item positions with real in-panorama link directions (or a spatial-link system replaces it outright)」
- 「Flipping this back to `true` alone is NOT sufficient to restore the old Left Menu binding」（左 Menu は現在 minimap の compact/expanded 切替に用途変更済み）

つまり **sceneLink はコード自身が名指ししている「不足データ」** であり、本テーマは Scene Ring 復活の前提条件そのものである。

### 1.5 既存の方向変換の不整合（重要・既存バグ相当）

同一の「カメラ θ を床角度へ変換する」処理が **2 つ存在し、値が一致しない**。

| 関数 | 式 | 用途 | 状態 |
|---|---|---|---|
| `thetaToFloorRotation(θ, flipH)` | `sign · θ°` | `marker.rotation` | 常用 |
| `_thetaToFloorDeg(θ)` | `(90 − θ°) mod 360` | Observer Mode の `observerState.yaw` | **live**（render loop から `observerState.enabled` 時に毎フレーム呼ばれる） |

両者は FloorMap 上で**同じ描画規約**（`+ rotationOffset` → `ctx.rotate`）で描かれるため、同一カメラ姿勢に対して scene marker のコーンと observer のコーンが**別方向を向く**（一致するのは θ = 45° のときのみ）。Observer Mode がローカルデモ限定で、`yaw` が外部メッセージからも設定され得るため実害が表面化していないと考えられるが、sceneLink は方向を扱う機能であるため、**どちらの規約を採るかを明示的に決める必要がある**（本調査の結論は 6 章）。本 PR では修正しない（対象外）。

## 2. Problem Definition

- 現在、scene 間の関係は **marker.order による一次元の並び**と、**FloorMap 上のピン位置**の 2 つしか存在しない。
- 「この scene から見て、あの scene はどの方向にあるか」という**方向付きの関係**を表現するデータが存在しない。
- そのため VR Scene Ring は合成配置しか作れず無効化され、パノラマ内 hotspot ナビゲーションも実装できない。
- 解決すべきこと: **scene 間の方向付き有向リンク（tour graph）を、既存の marker / FloorMap / Undo/Redo / JSON-ZIP 互換性を壊さずに追加する。**

## 3. Existing Navigation Model

| 経路 | 実装 | scene 決定方法 | sceneLink 導入後の扱い |
|---|---|---|---|
| FloorMap marker クリック | canvas mouseup → `switchToScene()` | marker.sceneId | **維持**（変更しない） |
| ← / → キー | `nextScene()` / `prevScene()` → `_getNavOrder()` | active floorplan の marker を `order` 昇順 → なければ filter 済み scene 配列順 | **維持**（sceneLink は順序を変更しない） |
| scene リストクリック | `switchToScene(i)` | 配列 index | **維持** |
| VR minimap | marker 投影 → hover → Trigger | marker.sceneId | **維持** |
| VR Scene Ring | `_populateVrRingItems()` → `_getNavOrder()` から現在 scene を除外し等間隔配置 | nav order | **sceneLink があれば配置角度を置換**（5・10 章） |
| compare mode | A/B index | `compareState.sceneAIndex/BIndex` | **無関係**（リンクは単一表示のナビゲーション概念） |
| `viewer.html` | 上記のうち Viewer 許可分を共有 | 同上 | **表示・遷移のみ許可、編集不可** |
| URL startup mode | `?mode=viewer\|editor` | — | **無関係** |

**方針: sceneLink は既存 navigation を置換しない。** marker.order による順送りは「巡回順」、sceneLink は「空間的な隣接関係」であり目的が異なる。両者は**共存**し、sceneLink が未定義の scene では既存挙動が 100% そのまま残る（fallback）。

## 4. Data Model Options

### 案 A: marker 付随（`marker.links[]`）

```
marker = { ..., links: [{ targetSceneId, heading, label, order, enabled }] }
```

- FloorMap 未配置 scene: **リンク不可**（marker は floorplan 上に置かれて初めて存在する）
- export/import: **0 行**（marker は export `{...m}` / import `{...m}` の spread 往復のため新 field が自動的に往復する）
- 後方互換: 高（旧版は未知 field を単純に無視）
- Undo/Redo: marker 系 apply 関数の隣に置ける
- VR Scene Ring: 現在 scene に marker が無いと ring を作れない → **VR 目的を満たせない**
- marker.order との衝突: 同一オブジェクト内に「巡回順」と「リンク順」が同居し紛らわしい
- 複数リンク: 可（配列）
- 正規化: marker 削除でリンクも消える一方、**別 scene から自分への inbound リンクは検知できない**

### 案 B: scene 付随（`scene.links[]`）

```
scene = { ..., links: [{ targetSceneId, heading, label, order, enabled }] }
```

- FloorMap 未配置 scene: **リンク可**
- export/import: scene は **whitelist** 方式のため export 1 箇所・import 1 箇所の編集が必要
- 後方互換: 高
- Undo/Redo: scene 系 apply 関数の隣
- VR Scene Ring: 可（現在 scene の links をそのまま使える）
- marker.order との衝突: なし
- 複数リンク: 可
- 正規化: outbound は scene 削除で自然に消えるが、**inbound リンクは全 scene を走査しないと掃除できない**

### 案 C: トップレベル配列（`projectState.sceneLinks[]`）★

```
projectState.sceneLinks = [{ id, sourceSceneId, targetSceneId, heading, label, order, enabled }]
```

- FloorMap 未配置 scene: **リンク可**
- export/import: export 1 箇所追加・import 1 箇所追加（`markers` と同じ扱いで実装できる）
- 後方互換: 高（旧版は未知トップレベル key を無視、`(_importData.sceneLinks || [])` で新版は旧 JSON を読める）
- Undo/Redo: **`projectState.markers` と同一の形**（トップレベル配列 + id + live-scan filter）であり、U5〜U8 で確立した cascade パターンをそのまま流用できる
- VR Scene Ring: 可
- marker.order との衝突: なし
- 複数リンク: 可
- 正規化: **outbound / inbound を同じ 1 回の filter で対称に掃除できる**（`l.sourceSceneId === id || l.targetSceneId === id`）

## 5. Recommended Model

**案 C（トップレベル `projectState.sceneLinks[]`）を推奨する。**

理由:

1. **要件を満たす唯一性**: 比較観点に挙がっている「FloorMap 未配置 scene でもリンク可能か」を案 A は原理的に満たせない。VR Scene Ring は「現在 scene から見た他 scene の方向」を必要とするため、marker の有無に依存してはならない。
2. **既存 cascade パターンの再利用**: `projectState.markers` は既にトップレベル配列で、scene 削除 / floorplan 削除の undo・redo における「固定 snapshot ではなく live-scan で filter する」という設計原則（U6・U8 の Required Fix で確立）が組み上がっている。案 C は同じ形なので、この原則と既存の実装・レビュー観点をそのまま適用できる。
3. **inbound リンクの掃除が対称**: scene 削除時に「その scene を指すリンク」も 1 回の filter で除去でき、案 B のような全 scene 走査が不要。dangling reference を作りにくい。
4. **役割の分離**: `marker.order`（巡回順）と `sceneLink.order`（同一 scene 内でのリンク表示順）が別オブジェクトに分かれ、意味の混線が起きない。

推奨スキーマ（最小）:

| field | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | ✔ | `genId()` 由来。history / 更新の対象キー |
| `sourceSceneId` | string | ✔ | リンク元 scene |
| `targetSceneId` | string | ✔ | リンク先 scene |
| `heading` | number | ✔ | 方向（度、整数 0–359）。空間は 6 章で厳密定義 |
| `label` | string | — | 表示名。空なら target scene 名にフォールバック |
| `order` | number | — | 同一 source 内の表示順（未指定は追加順） |
| `enabled` | boolean | — | 既定 true。false で表示・遷移から除外（削除せず一時無効化） |

`enabled` は Scene Ring の段階導入時に「リンクは定義済みだが VR には出さない」という状態を作れるため、初期スキーマに含めておくことを推奨する。

## 6. Direction Convention

**曖昧さを排除するため、基準・正負・回転方向をすべて明示する。**

### 6.1 基準の定義

- **格納空間**: `sceneLink.heading` は **`marker.rotation` と完全に同じ値空間**（以下「floor-space 度」）に格納する。
  - 単位: 度（整数）、範囲 `0 ≤ heading < 360`
  - `floorplan.rotationOffset` を**加算する前**の生の値（現行 `marker.rotation` と同様、offset は描画時のみ適用）
- **0° の意味**: FloorMap canvas 上で `rotationOffset = 0` のとき、**画面上方向（−Y、north）**。
- **回転方向**: 度が増えると **画面上で時計回り**（`ctx.rotate(+deg)` は Y 下向き座標系で時計回り）。
- **世界座標との対応**: floor-space 度 `D` は、Three.js 世界座標の水平方向ベクトル `(x, z) = (cos D°, sin D°)` に対応する。
  - 検証: `D = 0` → `(1, 0)` = +X 軸。カメラは `θ = 0` のとき `(cos 0, sin 0) = (1, 0)` を向き、`thetaToFloorRotation(0, false) = 0` なので一致。
  - 検証: `D = 90` → `(0, 1)` = +Z 軸。カメラ `θ = 90°` は `(0, 1)` を向き、`thetaToFloorRotation` も 90 を返す。

### 6.2 変換規則（式）

`sign = flipH ? -1 : 1` とする。

| 変換 | 式 | 備考 |
|---|---|---|
| カメラ → heading | `heading = thetaToFloorRotation(theta, sourceScene.flipH)` | 既存関数をそのまま再利用（新規実装しない） |
| heading → カメラ θ（度） | `theta° = ((sign · heading) mod 360 + 360) mod 360` | 上式の逆。`sign² = 1` より成立 |
| heading → FloorMap 表示角 | `displayDeg = ((heading + floorplan.rotationOffset) mod 360 + 360) mod 360` | marker と同一。`ctx.rotate(displayDeg · π/180)` |
| heading → VR Scene Ring 配置角 | `a = ((heading + 90) mod 360) · π/180`、`x = sin(a) · R`、`z = −cos(a) · R` | 導出は下記 |
| heading → 世界方向ベクトル | `(x, z) = (cos(heading°), sin(heading°))` | 6.1 の対応 |

**VR ring 配置角の導出**: 現行 `_populateVrRingItems()` は `x = sin(a)·R`, `z = −cos(a)·R` で配置する。方向ベクトルは `(sin a, −cos a)`。これを `(cos D, sin D)` に一致させると `sin a = cos D` かつ `−cos a = sin D` となり、**`a = D + 90°`**。
検証: `D = 0` → `a = 90°` → `(sin 90, −cos 90) = (1, 0)` = +X（正しい）。`D = 90` → `a = 180°` → `(0, 1)` = +Z（正しい）。

### 6.3 rotationOffset の適用範囲（重要）

- `floorplan.rotationOffset` は **FloorMap 画像の向きを北に合わせるための表示専用補正**であり、`marker.rotation` に書き戻されない（現行実装で確認済み）。
- したがって **VR Scene Ring の配置には rotationOffset を適用してはならない**。VR 世界座標はカメラ θ に直結しており、FloorMap 画像の貼り付け向きとは無関係。
- 適用するのは FloorMap canvas 描画時のみ。

### 6.4 既存の不整合への対応

1.5 で述べた `_thetaToFloorDeg`（`90 − θ°`）とは**異なる規約**を採用する。sceneLink は `thetaToFloorRotation`（`sign · θ°`）側に統一する。理由は、`marker.rotation` という**実際に永続化され UI に出ている値**がそちらの空間であり、sceneLink の heading を marker と同じ空間に置くことで FloorMap 上での併記・比較・編集がそのまま成立するため。Observer Mode 側の不整合は**既存の別問題**として本調査の対象外とし、14 章の Open Questions に残す。

## 7. Persistence / Compatibility

### 7.1 案 C の変更箇所（実装時）

| 箇所 | 変更 |
|---|---|
| `_buildProjectData()` | `sceneLinks: projectState.sceneLinks.map(l => ({ ...l }))` を 1 行追加 |
| import（`_doImportProjectData()`） | `(_importData.sceneLinks || [])` を読み、`sourceSceneId` / `targetSceneId` が復元済み scene id 集合に含まれるものだけ採用（markers の `validSceneIds` フィルタと同型） |
| ZIP | **変更不要**（画像ファイルが増えないため、ZIP 構造は `project.json` の中身が変わるだけ） |

### 7.2 互換性の評価

- **旧 JSON → 新版**: `sceneLinks` 不在 → `|| []` で空配列。既存挙動と完全に同一（リンク未定義 = 既存 navigation のみ）。**安全**。
- **新 JSON → 旧版**: 旧版の import は未知のトップレベル key を読まないため、`sceneLinks` は**黙って消える**。scene / marker / floorplan は無傷。→ 「情報消失はするがデータ破壊はしない」= 既存の Dirty State / appMode が JSON に載らないのと同じ度合いの劣化。
- **schema version の要否**: `appVersion` が既に `_buildProjectData()` に含まれており、import 側はどのバージョンでも同じ経路で読む（バージョン分岐なし）。sceneLinks は **加算的（additive）かつ省略可能**なので、**新たな schema version 機構は不要**と判断する。将来、既存フィールドの意味を変える破壊的変更が必要になった時点で導入すればよい（`docs/Release_Tagging_Policy.md` の MAJOR 判定基準に合致）。

### 7.3 参考: 案 A / B のコスト差

- 案 A（marker 付随）は marker が export/import とも `{...m}` spread のため**永続化層の変更が 0 行**という利点があるが、5 章の理由で不採用。
- 案 B（scene 付随）は scene が whitelist のため export/import 各 1 箇所の編集が必要で、案 C と同コスト。案 C のほうが cascade が対称なぶん有利。

## 8. Undo/Redo Integration

既存原則（U1〜U9・PR #58 で確立）にそのまま適合する。

- apply 関数は**状態適用と再描画のみ**を行い、自身は `historyManager.push()` を呼ばない
- ユーザーの確定操作側で **1 操作 = 1 history entry** を push
- undo/redo は同じ apply 関数を再利用する
- 削除・復元は **live-scan** で行い、固定 snapshot 外のデータを壊さない（U6・U8 Required Fix の原則）

想定 apply 関数:

| 操作 | apply 関数 | 備考 |
|---|---|---|
| link 作成 / 削除 | `applySceneLinkLifecycle(link, isPresent)` | `applyMarkerLifecycle()` と同型。`isPresent=false` 側は id で filter |
| target 変更 | `applySceneLinkTarget(linkId, targetSceneId)` | |
| heading 変更 | `applySceneLinkHeading(linkId, heading)` | ドラッグ編集する場合は PR #58 の gesture 規約（開始 snapshot → 終了 commit → identity 再検証）を踏襲 |
| label 変更 | `applySceneLinkLabel(linkId, label)` | no-op ガード（同値なら push しない） |
| order 変更 | `applySceneLinkOrder(...)` | U3/U4 の marker order 系と同型 |

**cascade（重要）**: scene 削除 / 復元時に、その scene を `sourceSceneId` **または** `targetSceneId` に持つリンクを対称に除去・復元する。U8 の Required Fix と同じ理由で、削除時点の固定 snapshot ではなく **replay 時の live-scan** で対象を決めること（undo 窓の間に追加されたリンクを取りこぼさないため）。

## 9. Viewer / Editor Responsibilities

| 機能 | Editor | Viewer |
|---|---|---|
| link 作成 / 削除 / 編集 | ✔（`assertEditorMode()` ガード） | ✖ |
| link の表示 | ✔ | ✔ |
| link での scene 遷移 | ✔ | ✔（閲覧操作であり mutation ではない） |
| VR Scene Ring | ✔ | ✔（VR は Viewer/Editor 共通） |

**Viewer で link が存在し得るか（重要な事実確認）**: 現行の import ガードは `if (!projectWasEmpty && !assertEditorMode('JSON/ZIP読み込み')) return;` であり、**空プロジェクトへの JSON/ZIP 読み込みは Viewer でも許可**されている。したがって Viewer セッションでも floorplan・marker・（将来の）sceneLink を持つプロジェクトを開くことができ、FloorMap ナビゲータも表示される。

（`tests/e2e/viewer-html-regression.spec.js` の「FloorMap ナビゲータが Viewer セッションで出現しない」というテストは、**何も import していない素の Viewer セッション**を対象としたものであり、上記と矛盾しない。）

→ **Viewer でのリンク遷移は実現可能であり、配布用 `viewer.html` に対する主要な価値**になる。ドラッグによる heading 編集は `canMutateProject()` で塞ぐ（PR #58 と同じ扱い）。

## 10. VR Scene Ring Integration

**本 PR では再有効化しない。** 再有効化の条件と設計のみ整理する。

再有効化に必要な条件:

1. `sceneLink.heading` が定義済みであること（本設計の実装完了）
2. `_populateVrRingItems()` の配置角を、等間隔 `(i / n) · 2π` から **`a = (heading + 90°)`**（6.2）へ置換
3. **左 Menu の入力再割当**: 現在 `button[12]` は minimap の compact/expanded 切替に用途変更済み。フラグを `true` に戻すだけでは復帰しない旨がコードコメントに明記されている。Ring 表示 ON/OFF をどのボタンへ割り当てるか（または minimap と排他にするか）を別途決める必要がある
4. 現在 scene の除外は既存実装（`others = order.filter(idx => idx !== currentIdx)`）を踏襲
5. **link 未定義 scene の fallback**: 現在 scene に sceneLink が 1 件も無い場合の挙動を決める。推奨は「ring を表示しない」（合成配置に戻すと、無効化の原因となった disorienting な体験が再発するため）
6. **one-way / two-way**: データモデルは有向（source → target）。実装時に「逆向きリンクを自動生成するか」を選べるが、**自動生成しない**ことを推奨する（A→B の方向と B→A の方向は独立に決まるべきで、自動生成すると誤った逆方位が入る）。Editor UI で「逆リンクも作成する」チェックボックスを提供する案は B3 で検討

## 11. Test Strategy

既存の Playwright 資産（251 tests）と同じ手法で検証できる。新規 production test hook は不要。

| 対象 | 手法 |
|---|---|
| データモデル / history | `window.__historyManagerForTests` の undo/redo カウントと、JSON export 内容の突き合わせ（marker 系 spec と同型） |
| 永続化往復 | export JSON を読んで `sceneLinks` を検証。旧 JSON（`sceneLinks` 不在）を import して既存挙動が変わらないことを確認 |
| cascade | scene 削除 → inbound / outbound リンクが消える → undo で復活。U6/U8 と同じ live-scan 観点で、undo 窓中に追加したリンクが redo 後も壊れないことを確認 |
| 方向変換 | heading を既知値に設定 → FloorMap canvas の `toDataURL()` fingerprint 比較（`marker-attrs-history.spec.js` の確立手法） |
| Viewer ガード | Viewer で編集操作を試み、export JSON が不変であることを確認（PR #58 で確立した「DOM ではなく export で検証する」手法） |
| VR | Playwright では検証しきれない。Scene Ring 再有効化（B5）は **Quest 3 実機確認**が前提 |

**fail-first 可能性: 高。** すべて DOM / export JSON / history stack で観測でき、B5 を除き実機不要。

## 12. PR Breakdown

1 PR が過大にならないよう、以下に分割する。

| PR | 内容 | production 変更 | 完了条件 |
|---|---|---|---|
| **B1**（本 PR） | 設計調査（docs-only） | なし | 本ドキュメントのレビュー承認 |
| **B2** | データモデル + 永続化 + Undo/Redo。`projectState.sceneLinks` の導入、`applySceneLinkLifecycle()` ほか apply 関数、export/import、scene 削除 cascade。**UI は付けない**（テストは history/export 経由で検証） | `script.js` + 新規 spec | 往復・cascade・undo/redo が spec で緑 |
| **B3** | Editor UI。リンク作成（target 選択・heading の現在カメラからの自動取得）、一覧、削除。FloorMap 上での方向編集は B3 に含めるか別 PR かを B2 完了時に判断 | `script.js` / `index.html` / `style.css` + spec | Editor で作成・編集でき、Viewer で編集不可 |
| **B4** | Viewer ナビゲーション。リンク表示と遷移（`viewer.html` 含む） | `script.js` + spec | Viewer でリンク遷移でき、dirty にならない |
| **B5** | VR Scene Ring 再有効化。配置角を heading 基準に置換、左 Menu 再割当、fallback | `script.js` | Quest 3 実機確認 + フルスイート |

**B2 を最初の実装 PR とする**ことを推奨する。データモデルが最も後戻りしにくく、UI を伴わないぶんレビュー範囲を差分の本質（スキーマ・cascade・履歴）に集中させられる。

## 13. Risks

- **方向規約の取り違え**: 6 章の変換式を実装時に誤ると、FloorMap 上は正しいのに VR で 90° ずれる（またはミラーする）といった、実機でしか気付けない不具合になる。B2 の時点で FloorMap fingerprint による方向テストを入れ、B5 の実機確認前に規約を固定しておくこと。
- **flipH の伝播**: `heading → θ` の逆変換は scene の `flipH` に依存する。リンク元 scene が後から反転（U 系の flip 操作）された場合に heading をどう扱うか（据え置き / 符号反転）が未決。14 章参照。
- **既存 `_thetaToFloorDeg` 不整合**: 本設計は `thetaToFloorRotation` 側に統一するが、Observer Mode と併用した際に「2 種類のコーンが別方向を向く」既存の見た目の齟齬は残る。
- **cascade 漏れ**: inbound リンクの掃除を忘れると dangling reference が残る。U8 Required Fix と同じ失敗パターンなので、live-scan での対称 filter を必須とする。
- **VR 実機依存**: B5 のみ Playwright で完結せず、Quest 3 検証が必要。

## 14. Open Questions

- **flipH 変更時の heading**: リンク元 scene の `flipH` がリンク作成後に変更された場合、既存 heading を据え置くか符号反転するか。`marker.rotation` は現状据え置き（反転時に再計算しない）なので、それに合わせて据え置きが一貫するが、実利用上どちらが自然かは未確認。
- **VR ring の fallback**: リンク未定義 scene で ring を非表示にする案を推奨したが、「一部の scene だけ ring が出る」体験が許容できるかは実機確認が必要。
- **リンク数の上限 / 重複**: 同一 source→target の重複リンク、および 1 scene あたりのリンク数上限を設けるかは未検討。
- **Observer Mode の方向規約不整合**（1.5）を将来どう解消するか（`_thetaToFloorDeg` を廃止して `thetaToFloorRotation` に寄せるのが自然に見えるが、Observer の外部入力仕様が不明なため本調査では判断しない）。
- **パノラマ内 hotspot 表示**: 本設計は heading を持つため将来 hotspot 描画へ発展可能だが、球面上への配置・当たり判定は本調査の範囲外。
- **compare mode との関係**: リンク遷移は単一表示前提。compare 中にリンクを踏んだ場合の挙動（無効化 / 単一へ戻る）は B4 で決める。

## 15. Recommendation

1. **データモデルは案 C（トップレベル `projectState.sceneLinks[]`）を採用する。** FloorMap 未配置 scene でもリンクでき、`projectState.markers` と同形のため既存 cascade / Undo/Redo パターンをそのまま流用でき、inbound / outbound を対称に掃除できる。
2. **heading は `marker.rotation` と同じ floor-space 度（0–359、rotationOffset 適用前）で格納し**、変換は 6.2 の式に厳密に従う。VR ring 配置角は `a = heading + 90°`、rotationOffset は VR には適用しない。
3. **既存 navigation は置換せず共存させる。** sceneLink 未定義時は現行挙動が完全に維持される。
4. **schema version 機構は追加しない。** `sceneLinks` は加算的・省略可能で、旧 JSON も新 JSON も安全に読める。
5. **次の実装 PR は B2（データモデル + 永続化 + Undo/Redo、UI なし）とする。**
6. **VR Scene Ring は B5 まで再有効化しない。** 再有効化には heading の実装に加えて左 Menu の入力再割当と Quest 3 実機確認が必要。

## 関連

- `docs/ArchView360_Next_Phase_Investigation.md`（次フェーズ候補の比較）
- `docs/UndoRedo_Expansion_Implementation_Plan.md`（U1〜U9 の apply 関数パターン）
- `docs/Release_Tagging_Policy.md`（SemVer 判定基準。sceneLink 追加は MINOR 相当）
- `docs/ViewerEditor_Viewer_Html_Known_Gaps.md`（`viewer.html` の Editor 専用要素除去の経緯）
- `tests/e2e/panorama-rotation-history.spec.js`（PR #58。gesture snapshot / commit / cancel の規約）
