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

### 5.1 Identity / duplicate semantics（B2 開始前の確定契約）

- **identity は `id` のみ。** 検索・更新・削除・history の replay はすべて `id` で行う。`sourceSceneId` + `targetSceneId` の組を identity として扱わない。
- **同一 `id` の重複は禁止。** 復元系（undo / import）は push 前に `sceneLinks.some(l => l.id === x.id)` を確認し、既存なら push しない（`applyMarkerLifecycle()` の既存ガードと同型）。
- **同一 `sourceSceneId` + `targetSceneId` の別 id リンク**: **B2 では `enabled` なものを 1 件までとする。** 既に enabled な同一ペアが存在する状態での新規作成は **no-op**（作成せず history も push しない）とし、既存リンクの heading 編集へ誘導する。
  - 理由: 「A から見て B はどちらの方向か」は本質的に 1 つであり、複数許可すると VR ring に同一 target が重複表示される。
  - `enabled: false` のリンクはこの制約の対象外（無効化して別方向で作り直す運用を許容）。
- **将来拡張**: 経路が複数ある（別の出口から同じ部屋へ行ける）ケースが必要になった時点で、この 1 件制限のみを緩める。id 中心の identity と cascade 契約は変更不要。
- **import 時**: 同一 id が既存と衝突する場合は既存を優先して読み飛ばす（markers の `newMarkerIds` による差し替えと同様の扱いを B2 で確定する）。

## 6. Direction Convention

**曖昧さを排除するため、基準・正負・回転方向をすべて明示する。**

記法: `normalize(d) = ((d mod 360) + 360) mod 360`、`sign = scene.flipH ? -1 : 1`。

### 6.1 基準の定義

- **格納空間**: `sceneLink.heading` は **`marker.rotation` と完全に同じ値空間**（以下「marker-space 度」）に格納する。
  - 単位: 度（整数）、範囲 `0 ≤ heading < 360`
  - `floorplan.rotationOffset` を**加算する前**の生の値（現行 `marker.rotation` と同様、offset は描画時のみ適用）
  - **marker-space は world-space ではない**。`heading = normalize(sign · θ°)` であり、`flipH = true` の scene では **world 方向を得るのに `sign` を再度適用して θ を復元する必要がある**（6.2）。
- **0° の意味**: FloorMap canvas 上で `rotationOffset = 0` のとき、**画面上方向（−Y、north）**。
- **回転方向（FloorMap 上）**: 度が増えると **画面上で時計回り**（`ctx.rotate(+deg)` は Y 下向き座標系で時計回り）。
- **world 座標との対応**: **復元した θ** が world 水平方向 `(x, z) = (cos θ°, sin θ°)` に対応する（カメラの `lookAt` の水平成分そのもの）。

### 6.2 変換規則（式）

**すべての world / VR 変換は、heading から直接ではなく「θ を復元してから」行う。**

| 変換 | 式 | 備考 |
|---|---|---|
| カメラ → heading（保存） | `heading = thetaToFloorRotation(theta, sourceScene.flipH)` = `normalize(sign · θ°)` | 既存関数をそのまま再利用（新規実装しない） |
| heading → カメラ θ（度）**復元** | `θ° = normalize(sign · heading)` | 上式の逆（`sign² = 1`）。**world/VR 系の入口は必ずここを通す** |
| heading → FloorMap 表示角 | `displayDeg = normalize(heading + floorplan.rotationOffset)` | marker と同一。`ctx.rotate(displayDeg · π/180)`。**θ 復元は不要**（marker-space のまま） |
| heading → world 方向ベクトル | `θ° = normalize(sign · heading)` → `(x, z) = (cos θ°, sin θ°)` | heading から直接 `(cos heading, sin heading)` としない |
| heading → VR Scene Ring 配置角 | `θ° = normalize(sign · heading)` → `a = normalize(θ° + 90°)` → `x = sin(a·π/180) · R`、`z = −cos(a·π/180) · R` | **`a = heading + 90°` を無条件に使わない**。導出は下記 |

**VR ring 配置角の導出**: 現行 `_populateVrRingItems()` は `x = sin(a)·R`, `z = −cos(a)·R` で配置するので、方向ベクトルは `(sin a, −cos a)`。これを world 方向 `(cos θ, sin θ)` に一致させると `sin a = cos θ` かつ `−cos a = sin θ` となり、**`a = θ + 90°`**。

### 6.2.1 検証（flipH = false / true の両方）

`sign = flipH ? -1 : 1`、ring 方向ベクトル = `(sin a, −cos a)`。

**flipH = false（sign = +1）**

| heading | θ = normalize(+1·heading) | world (x,z) | a = θ+90 | ring (sin a, −cos a) | 一致 |
|---|---|---|---|---|---|
| 0 | 0 | (1, 0) = +X | 90 | (1, 0) | ✔ |
| 90 | 90 | (0, 1) = +Z | 180 | (0, 1) | ✔ |

**flipH = true（sign = −1）**

| heading | θ = normalize(−1·heading) | world (x,z) | a = θ+90 | ring (sin a, −cos a) | 一致 |
|---|---|---|---|---|---|
| 0 | 0 | (1, 0) = +X | 90 | (1, 0) | ✔ |
| 90 | 270 | (0, −1) = −Z | normalize(360) = 0 | (0, −1) | ✔ |

**旧式との差異（この修正が必要な理由）**: `flipH = true, heading = 90` の場合、誤った `a = heading + 90 = 180` は `(0, +1) = +Z` を指し、正しい `−Z` と **180° 反転（ミラー）** する。反転 scene のリンクが VR で真逆に出るため、B2 開始前に確定が必要。

### 6.3 rotationOffset の適用範囲（重要）

- `floorplan.rotationOffset` は **FloorMap 画像の向きを北に合わせるための表示専用補正**であり、`marker.rotation` に書き戻されない（現行実装で確認済み）。
- したがって **VR Scene Ring の配置には rotationOffset を適用してはならない**。VR 世界座標はカメラ θ に直結しており、FloorMap 画像の貼り付け向きとは無関係。
- 適用するのは FloorMap canvas 描画時のみ。

### 6.4 flipH 変更時の heading 移行（B2 開始前の確定契約）

`heading` は marker-space（`sign · θ`）で保存するため、**source scene の `flipH` が変わると、同じ heading 値が指す world 方向が反転してしまう**。これを放置すると、scene を反転しただけでリンクが物理的に逆を向く。

**決定: world（物理）方向を維持する。** source scene の `flipH` を変更する際、その scene を `sourceSceneId` に持つ全リンクの heading を再計算する。

```
θ          = normalize(oldSign · oldHeading)   // 旧規約で world 方向を復元
newHeading = normalize(newSign · θ)            // 新規約へ再エンコード
```

反転は必ず `newSign = −oldSign` なので、実質的に **`newHeading = normalize(−oldHeading)` = `(360 − oldHeading) mod 360`**（`heading = 0` は 0 のまま）。

検証: `oldFlip=false (sign=+1), oldHeading=90` → `θ=90` → `newFlip=true (sign=−1)` → `newHeading = normalize(−90) = 270`。新規約で復元すると `θ = normalize(−1·270) = 90` となり world 方向は不変 ✔。

**既存 `marker.rotation` との差異（意図的）**: 現行 `applySceneFlip()` は `scene.flipH` とテクスチャ反転のみを行い、**`marker.rotation` を再計算しない**（実装で確認済み）。したがって marker は反転後も数値を保ち、その数値が意味する world 方向のほうが変わる。sceneLink はこれと**逆**の方針を採る。

理由: `marker.rotation` は「FloorMap という平面図注記の上で、ピンの矢印がどちらを向いて描かれるか」という**図面空間の見た目**であり、反転しても図面上の見え方が保たれるのが自然。一方 `sceneLink.heading` は「この scene から見て別の scene が物理的にどちらにあるか」という**空間関係**であり、パノラマの反転という表示上の都合で実際の位置関係が変わってはならない。VR Scene Ring はこの物理方向をそのまま使うため、後者の一貫性を優先する。

実装上の位置づけ: この再計算は `applySceneFlip()` から呼ぶのではなく、**flip の確定操作側**（`toggleFlipSingle()` 等の commit 地点）で 1 つの history entry に含める（apply 関数自身は push しない既存原則を維持）。flip の undo で heading も元へ戻る必要があるため、flip と heading 再計算は**同一 entry で原子的に**扱う。

### 6.5 既存の不整合への対応

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

### 8.1 scene 削除 cascade: execution-scoped snapshot 契約（B2 の実装契約）

scene 削除時は、その scene を `sourceSceneId` **または** `targetSceneId` に持つリンクを対称に除去する。ただし **「固定 snapshot をそのまま復元する」も「live-scan だけで復元する」も不十分**である。

- 固定 snapshot をそのまま復元 → その後の状態に属さないリンクを**復活させてしまう**（U8 で問題化した resurrection）
- live-scan のみ → 削除された link オブジェクトは既に配列に無いため、**undo で復元する対象を再構築できない**

したがって **execution-scoped cascade snapshot** を採用する。「どの実行が何を実際に取り除いたか」を、その実行ごとに保持する。

**delete / redo 実行時**

1. live な `projectState.sceneLinks` を scan する
2. `l.sourceSceneId === deletedSceneId || l.targetSceneId === deletedSceneId` を満たし、**その時点で実在する**リンクを取得する
3. **その実行で実際に取り除くリンクオブジェクト**を、その実行の cascade snapshot として保持する
4. live 配列から除去する
5. snapshot は、対になる undo 専用の復元元として保持する

**undo 実行時**

1. **直前の delete / redo 実行が capture した snapshot のみ**を対象とする
2. 各リンクの `sourceSceneId` / `targetSceneId` の scene が現時点でも有効か確認する
3. 同一 `id` が既に存在しないことを確認する（重複復元の禁止、5.1）
4. 条件を満たすものだけ復元する
5. **無関係なリンク・新規追加されたリンクには一切触れない**

**次の redo 実行時**

- 古い snapshot を**盲目的に再利用しない**
- 改めて live-scan し、その redo 実行で実際に取り除いた集合で **snapshot を置き換える**

**undo 窓の間に起きた変化の扱い**

| 窓内で起きたこと | 次の redo での扱い |
|---|---|
| 対象 scene に紐づくリンクが新規追加された | 次 redo の live-scan が拾い、除去対象になる（取りこぼさない） |
| snapshot 内のリンクが手動削除された | 次 redo 時点で存在しないため snapshot 対象にならない（二重削除しない） |
| 無関係なリンク | 常に保持される（触れない） |
| 同一 id が既に存在する | undo で二重復元しない（5.1 のガード） |

この契約は U6（snapshot 外データの消失）と U8（古い snapshot による誤復活）の**両方**を同時に防ぐことを目的とする。floorplan 削除 cascade についても、リンクが floorplan を直接参照しない設計（案 C）のため sceneLink 側の追加対応は不要だが、floorplan 削除に伴って scene が消えるわけではない点は B2 のテストで確認する。

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
2. `_populateVrRingItems()` の配置角を、等間隔 `(i / n) · 2π` から **6.2 の復元済み θ 基準**へ置換する。すなわち各リンクについて `θ° = normalize(sign · heading)`（`sign` は **source scene**（＝現在 scene）の `flipH`）を復元し、`a = normalize(θ° + 90°)` を用いる。**`a = heading + 90°` を無条件に使ってはならない**（反転 scene で 180° ミラーする。6.2.1 参照）。`rotationOffset` は適用しない（6.3）
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
| cascade | 8.1 の契約を各行ごとに検証: ①delete→undo で元の集合だけが戻る ②undo 窓中に追加した matching link が次 redo で除去される ③undo 窓中に手動削除した link が次 redo で二重削除されない ④無関係な link が常に不変 ⑤同一 id が二重復元されない |
| 方向変換 | heading を既知値に設定 → FloorMap canvas の `toDataURL()` fingerprint 比較（`marker-attrs-history.spec.js` の確立手法）。**flipH = true / false の両方**で、6.2.1 の期待値と一致することを確認する |
| flipH 移行 | scene を反転 → export JSON 上で heading が `(360 − old) mod 360` へ再エンコードされる → undo で flip と heading が同時に戻る（6.4） |
| duplicate | 同一 source→target の enabled リンクを二重作成 → no-op（history が増えない）ことを確認（5.1） |
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
- **flipH の伝播**: `heading → θ` の逆変換は scene の `flipH` に依存する。方針は 6.4 で確定済み（world 方向を維持するため flip 時に heading を再エンコード）だが、**flip と heading 再計算を同一 history entry で原子的に扱わないと undo で不整合が残る**点が実装上の注意。
- **既存 `_thetaToFloorDeg` 不整合**: 本設計は `thetaToFloorRotation` 側に統一するが、Observer Mode と併用した際に「2 種類のコーンが別方向を向く」既存の見た目の齟齬は残る。
- **cascade 漏れ / 誤復活**: inbound リンクの掃除を忘れると dangling reference が残り、逆に古い snapshot を盲目的に復元すると誤復活する。8.1 の execution-scoped 契約を必須とする。
- **VR 実機依存**: B5 のみ Playwright で完結せず、Quest 3 検証が必要。

## 14. Open Questions

### Resolved（本改訂で B2 開始前の契約として確定）

- ~~**flipH 変更時の heading**~~ → **6.4 で確定**: world 方向を維持する。`θ = normalize(oldSign · oldHeading)` → `newHeading = normalize(newSign · θ)`（実質 `(360 − oldHeading) mod 360`）。flip と同一 history entry で原子的に適用する。`marker.rotation` は据え置きのままとし、差異の理由も 6.4 に明記した。
- ~~**同一 source→target の重複**~~ → **5.1 で確定**: identity は `id` のみ。同一 id 重複は禁止。同一 source→target の **enabled** なリンクは B2 では 1 件まで（重複作成は no-op）。

### 未解決

- **VR ring の fallback**: リンク未定義 scene で ring を非表示にする案を推奨したが、「一部の scene だけ ring が出る」体験が許容できるかは実機確認が必要。
- **1 scene あたりのリンク数上限**: 上限を設けるかは未検討（ring の視認性の観点から B5 で再評価）。
- **Observer Mode の方向規約不整合**（1.5）を将来どう解消するか（`_thetaToFloorDeg` を廃止して `thetaToFloorRotation` に寄せるのが自然に見えるが、Observer の外部入力仕様が不明なため本調査では判断しない）。
- **パノラマ内 hotspot 表示**: 本設計は heading を持つため将来 hotspot 描画へ発展可能だが、球面上への配置・当たり判定は本調査の範囲外。
- **compare mode との関係**: リンク遷移は単一表示前提。compare 中にリンクを踏んだ場合の挙動（無効化 / 単一へ戻る）は B4 で決める。

## 15. Recommendation

1. **データモデルは案 C（トップレベル `projectState.sceneLinks[]`）を採用する。** FloorMap 未配置 scene でもリンクでき、`projectState.markers` と同形のため既存 cascade / Undo/Redo パターンをそのまま流用でき、inbound / outbound を対称に掃除できる。
2. **heading は `marker.rotation` と同じ marker-space 度（0–359、rotationOffset 適用前）で格納し**、変換は 6.2 の式に厳密に従う。**world / VR 系へ渡す前に必ず `θ° = normalize(sign · heading)` で θ を復元**し、VR ring 配置角は `a = normalize(θ° + 90°)` とする（`heading + 90°` を無条件に使わない）。rotationOffset は FloorMap 描画時のみ適用し、VR には適用しない。
2.1. **flipH 変更時は world 方向を維持するため heading を再エンコードする**（6.4）。flip と同一 history entry で原子的に扱う。
2.2. **identity は `id` のみ。同一 source→target の enabled リンクは B2 では 1 件まで**（5.1）。
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
