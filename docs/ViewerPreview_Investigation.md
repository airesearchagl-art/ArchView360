# Viewer Preview 機能 設計調査（v2.22.0時点）

このドキュメントは調査専用であり、実装は含まない。`script.js` / `index.html` /
`style.css` / `package.json` / ワークフロー / 既存テストは一切変更していない。

- 調査時点のmain: `5f6c69c14f1a6f23b35ecbf98c20569ced1fa275`
- `appVersion`: `2.22.0`（変更なし）
- 調査前のPlaywrightベースライン: 71/71成功

以下、各項目は次の3種類を明示的に分けて記載する。見出し・箇条書きの末尾に
`[事実]` / `[提案]` / `[未検証]` を付す。

- `[事実]` — 実際のコード・行番号を確認した上での記述。
- `[提案]` — 本調査で考案した設計案・仕様案。まだ確定していない。
- `[未検証]` — 本調査の範囲では確認していない・検証していない事項。実装着手時に
  改めて確認が必要なもの。

---

## 1. 現状構成 `[事実]`

### 1.1 App Mode（Viewer / Editor）

- `appMode`はセッション内変数のみ（`let appMode = 'viewer';`、script.js:652）。
  JSON/ZIP/localStorage/URLパラメータには一切保存されず、リロード後は必ず
  `'viewer'`から始まる（script.js:641-645のコメントで明記、かつ復元経路自体が
  存在しないため設計上リグレッションし得ない）。
- 状態遷移はすべて以下の関数経由のみで行われ、UIコードが`appMode`へ直接代入する
  箇所は無い：
  - `getAppMode()`（script.js:654） — 現在値の読み取り
  - `canMutateProject()`（script.js:660） — `appMode === 'editor'`の単純判定
  - `assertEditorMode(label)`（script.js:669-674） — Viewerなら`console.warn`+
    トースト表示+`false`を返す。呼び出し側は`if (!assertEditorMode(...)) return;`
    の形で必ず早期returnする
  - `enterViewerMode()` / `enterEditorMode()`（script.js:676-686） — 実際に
    `appMode`を書き換える唯一の箇所。同値なら早期return、変化時のみ
    `renderModeUi()`を呼ぶ
  - `requestEditorAccess()`（script.js:693-695） — Editorへの唯一の入口。現状は
    `enterEditorMode()`への素通しだが、将来の認可チェックを挿入するための
    抽象化として意図的に空実装
  - `renderModeUi()`（script.js:703-715） — `body`のクラス（`mode-editor`/
    `mode-viewer`）とツールバーのラベル/ボタン文言を反映する唯一の箇所。
    レンダラー・シーン・VRオブジェクトの再生成は一切行わない
- UIとの結線は`app-mode-toggle-btn`のクリックハンドラ1箇所のみ
  （script.js:2664-2688）。Editor→Viewerでは`confirmUnsavedChanges('switch-to-viewer')`
  を経由し、キャンセル時は何もしない。Viewer→Editorは`requestEditorAccess()`を
  直接呼ぶのみ（Viewerは常にクリーンなため確認ダイアログは常に即時解決）。

### 1.2 editor-only / viewer-only によるUI制御

- CSSルールは`style.css`にそれぞれ1行のみ存在：
  - `.mode-viewer .editor-only { display: none !important; }`（style.css:153）
  - `.mode-editor .viewer-only { display: none !important; }`（style.css:154）
- `editor-only`クラスは`index.html`内に19要素、`script.js`が動的生成する要素に
  12箇所付与されている（`grep -c`実測）。
- **`viewer-only`クラスは、実際にはCSSルールが存在するのみで、`index.html`・
  `script.js`のどちらにも実際にこのクラスを付与している要素が0件だった**
  （`grep -c "viewer-only" index.html script.js` = 0/1、1件はscript.js内の
  コメント文言のみ）。つまり現状「Viewer専用UI」という概念は仕組みとして
  用意されているが、実際に使われている箇所は無い。

### 1.3 mutation guard（JSレベル）

- `assertEditorMode(label)`の呼び出し箇所は35件（`grep -c`実測）。代表的な
  `label`引数（=編集操作の名称）は以下（全35件から抜粋、詳細は3節）：
  マーカー番号変更・マーカー番号整理・画像追加・シーン画像の更新・シーン削除・
  シーン並び替え・グループ削除/編集/割り当て/名変更・比較セット保存/削除/名変更・
  左右反転・平面図追加/削除・マーカー並び替え/配置モード/回転/削除・
  平面図の方位補正・グループ作成・プロジェクト情報編集/保存・JSON書き出し・
  ZIPパッケージ書き出し・JSON/ZIP読み込み
- `canMutateProject()`の直接呼び出しは19件（`grep -c`実測）。用途は主に
  `contentEditable`によるインライン編集（シーン名・FloorMap名のdblclick/blur）、
  ドラッグ並び替えの`draggable`属性切り替え、右クリックメニュー、マーカー作成、
  **および`performUndo()`/`performRedo()`（script.js:7107-7114）とその
  キーボードショートカットハンドラ（script.js:7135-7137）**。
  → **Undo/Redo自体が現状Editor専用**であり、Viewerでは`Ctrl/Cmd+Z`を押しても
  何も起きない（既存仕様、`history-controls.spec.js`のテスト#13で確認済み）。

### 1.4 Dirty State（未保存変更管理、PR #14）

- `isProjectDirty()` / `markProjectDirty(reason)` / `markProjectClean(reason)`
  による一元管理（script.js:739-767）。Viewerでの閲覧操作自体は
  mutation guardにより`markProjectDirty()`に到達し得ないため、Viewerは
  構造的にdirtyになり得ない。
- `confirmUnsavedChanges(context)`（script.js:819-832）は`'switch-to-viewer'`と
  `'replace-project'`の2文脈のみを持つ（script.js:802-815）。Preview用の
  第3の文脈は存在しない。

---

## 2. 既存コード利用可能箇所（Previewとして転用できる機能）`[事実]`

### 2.1 mutation guardが掛かっていない＝Viewerでも動作する機能（Common）

以下は`assertEditorMode()`/`canMutateProject()`のいずれも呼んでおらず、実際に
Viewer/Editor両方で同一に動作することを確認した（関数定義を直接確認）：

| 機能 | 関数 | 備考 |
|---|---|---|
| シーン切替 | `switchToScene(idx)`（script.js:1269） | フェード遷移含む |
| 分割比較モード開始 | `enterSplitMode(...)`（script.js:2387） | |
| スライダー比較モード開始 | `enterSliderMode(...)`（script.js:2439） | |
| VR開始/終了 | `enterVr()`（script.js:5419）/ `exitVr()`（script.js:5489） | `compareState.mode !== 'single'`時は非対応（既存制約、appModeとは無関係） |
| 視点操作（ドラッグ回転・ズーム） | camera.fov / 手動lon/lat更新（`resetView()`がcamera.fovを直接参照、script.js:2343） | 専用stateではなくThree.jsの`camera`オブジェクト自体が保持 |
| 自動回転 | `autoRotate`フラグ（script.js:610） | |
| FloorMap閲覧・マーカーのクリック選択によるシーン移動 | `renderMarkerList()`まわりの複数ハンドラ | クリックでの選択・移動先閲覧はガード対象外（PR #12設計判断で明示的に「クリックでの選択・移動先閲覧は維持」と記載済み） |

これらはPreview機能実装時に**そのまま流用でき、追加のViewer/Editor分岐が不要**な
既存の「閲覧」機能である。

### 2.2 mutation guardが掛かっている＝Previewでも禁止すべき機能（Editor限定）

3節の表を参照。

---

## 3. 編集操作一覧・禁止操作分類 `[事実＋提案＋未検証]`

`assertEditorMode()`（35件）・`canMutateProject()`（19件、Undo/Redo含む）の
全呼び出し箇所を基にした一覧。「Viewerで禁止済み」列は事実（既存コード）。
「Previewで禁止すべき」「Previewでも許可すべき」列は本調査の提案。

| 操作 | 該当コード | Viewerで禁止済み | Previewで禁止すべき | Previewでも許可すべき |
|---|---|---|---|---|
| シーン名称変更 | `canMutateProject()`（dblclick/blur） | ✅ | ✅ | - |
| FloorMap名称変更 | `canMutateProject()`（dblclick/blur） | ✅ | ✅ | - |
| シーン左右反転 | `assertEditorMode('左右反転')` ×2 | ✅ | ✅ | - |
| シーン追加 | `assertEditorMode('画像追加')` | ✅ | ✅ | - |
| シーン画像更新（差し替え） | `assertEditorMode('シーン画像の更新')` ×2 | ✅ | ✅ | - |
| シーン削除 | `assertEditorMode('シーン削除')` | ✅ | ✅ | - |
| シーン並び替え | `assertEditorMode('シーン並び替え')` | ✅ | ✅ | - |
| グループ作成/編集/削除/割り当て/名変更 | `assertEditorMode(...)` ×6 | ✅ | ✅ | - |
| 比較セット保存/削除/名変更 | `assertEditorMode(...)` ×3 | ✅ | ✅ | - |
| 平面図追加/削除 | `assertEditorMode(...)` ×2 | ✅ | ✅ | - |
| 平面図の方位補正 | `assertEditorMode(...)` ×2 | ✅ | ✅ | - |
| マーカー番号変更/整理/並び替え/配置モード/回転/削除 | `assertEditorMode(...)` ×6 | ✅ | ✅ | - |
| プロジェクト情報編集/保存 | `assertEditorMode(...)` ×2 | ✅ | ✅ | - |
| JSON書き出し | `assertEditorMode('JSON書き出し')` | ✅ | ✅ | - |
| ZIPパッケージ書き出し | `assertEditorMode(...)` | ✅ | ✅ | - |
| JSON/ZIP読み込み（非空プロジェクトへ） | `assertEditorMode(...)` | ✅ | ✅ | - |
| Undo / Redo | `canMutateProject()`（`performUndo`/`performRedo`、ショートカット） | ✅ | ✅（提案：Previewは編集履歴を操作しない読み取り専用モードのため） | - |
| シーン切替・比較モード切替・VR開始 | ガード無し（2.1節） | ❌（元々Viewerで許可） | - | ✅ |
| 視点操作・ズーム・自動回転 | ガード無し | ❌ | - | ✅ |
| マーカーのクリック選択（移動なし） | ガード無し（PR #12設計判断） | ❌ | - | ✅ |

### 事実と評価の切り分け

- **確認できた事実 `[事実]`**: `assertEditorMode()`（35箇所）・`canMutateProject()`
  （19箇所）はいずれも、呼び出し元がどの画面から来たかに関わらず`appMode`の
  値だけを見て判定する。したがって、Preview中に何らかの方法で
  `canMutateProject()`が`false`を返すようにできれば、既存の54箇所の
  呼び出しコード自体は一切変更せずに再利用できる（＝新しいガード条件を
  個々の呼び出し箇所に追加する必要はない）。
- **本調査で未確認の点 `[未検証]`**: 上記はあくまで「`assertEditorMode()`/
  `canMutateProject()`を経由する54箇所」が遮断されるという意味であり、
  **script.js全体でこの2関数を経由しない別のデータ更新経路が存在しないか
  どうかは、本調査では網羅的に検証していない**（`grep -c`によるこの2関数の
  呼び出し件数の集計と、3節の表に載せた個々の呼び出し確認に留まる）。実装
  着手時には、新規に追加される機能や、将来追加される編集操作が必ずこの
  2関数のいずれかを経由する設計になっているかを、実装のたびに確認する
  運用が必要になる。「既存ガードを再利用できる」ことと「全データ更新経路が
  遮断済みであることの網羅的保証」は同じではない、という点を区別しておく。

---

## 4. UI状態の保持・復元対象 `[提案（事実に基づく評価）]`

Preview開始時に「保持すべきか」を、実際にその状態を保持している変数の有無を
確認した上で評価する。

| 候補 | 保持している変数（事実） | Preview開始時に保持が必要か（評価） |
|---|---|---|
| current scene | `currentIdx`（script.js:1016、`let currentIdx = -1;`） | 必要。Previewは「今Editorで見ている続き」を見せる機能のため、Preview開始時点の`currentIdx`をそのまま使う（変更不要、Editorと同じ変数を共有すればよい） |
| compare mode / layout / slider位置 / sync | `compareState`オブジェクト一式（script.js:986-994、`mode`/`sceneAIndex`/`sceneBIndex`/`layout`/`sliderPosition`/`syncViews`/`activeSetId`） | 必要。同上の理由で、Editorと同じ`compareState`をそのまま共有すればよく、Preview専用にコピー・退避する設計は不要と考えられる |
| active floor（FloorMap） | `activeFloorplanId`（script.js:906） | 必要。同上 |
| selected marker | `selectedMarkerId`（script.js:907） | 任意。マーカー選択はViewerでも変更可能な閲覧状態のため、保持してもしなくても機能上の矛盾は無い |
| camera direction / zoom | 専用のstate変数は無く、Three.jsの`camera`オブジェクト自身（`camera.fov`等）が直接保持 | 保持は自動的に満たされる。`appMode`の切替は`renderModeUi()`でCSSクラスとラベルを変えるだけで、シーン・カメラ・レンダラーの再生成を一切行わないため（script.js:701のコメントで明記）、Previewへの切替でカメラ状態が失われる余地が無い |
| VR状態 | `inVrSession`（script.js:327） | 保持しない方針を推奨。VR中にPreviewへ出入りする、または逆にPreview中にVRへ入る、という組み合わせは既存のVR実装が想定していない可能性が高く、本調査では検証していない未確認領域（6節・10節参照） |
| fullscreen | `viewerContainer.requestFullscreen`（script.js:3447） | 保持は自動的に満たされる（ブラウザのFullscreen APIの状態自体はDOM側にあり、`appMode`と無関係） |

**評価まとめ**: `currentIdx`・`compareState`・`activeFloorplanId`・`selectedMarkerId`は
いずれも**Editor/Viewer共通の1つの変数**として既に実装されており、Preview専用に
「退避してから復元する」設計にしなくても、単に`appMode`を一時的に切り替える
だけで自動的に「Editorで見ていたのと同じ状態」がPreviewにも引き継がれる。
これは本調査で確認できた最も重要な構造的事実であり、7節のappMode方式比較・
8節のPhase 1提案の前提になる。

---

## 5. Preview終了時の復元対象 `[提案]`

**「Preview終了時に明示的な復元処理が不要である」というのは事実ではなく、
Phase 1の仕様提案の1つである点に注意する。** 4節で確認した事実（`currentIdx`/
`compareState`/`activeFloorplanId`がEditor/Viewer共通の1変数であること）は
あくまで「復元処理を書かなくても、Preview中の操作がEditor側の変数を直接
書き換える」という技術的な帰結を示しているに過ぎず、それが望ましい仕様か
どうかは別の判断である。

### 案1（Phase 1推奨案）: Editorへ引き継ぐ

Preview中にユーザーがシーン切替・比較モード変更・視点操作を行った場合、
それらは`currentIdx`/`compareState`/カメラを直接書き換えるため、Preview
終了後のEditorにもそのまま反映される（＝「復元」ではなく「引き継ぎ」）。
実装コストが最小で、4節の構造的事実とも合致するため、Phase 1の推奨仕様と
する。「今Editorで作業している内容が、閲覧者にどう見えるかを確認する」という
Previewの目的とも整合する。

### 案2（代替案）: Preview開始時の状態へ戻す

Preview開始時点の`currentIdx`/`compareState`/カメラ状態を退避しておき、
Preview終了時に必ずその状態へ戻す。Preview中の閲覧操作（デモのために複数
シーンを見て回る、比較モードを一時的に試す等）をEditor側の作業状態に
一切影響させたくない場合に必要になる。ただし、現在は共有1変数として実装
されている状態を「Preview用に複製し、終了時に破棄する」設計へ変更する
必要があり、影響範囲は案1より大きくなる（7節）。

**本調査ではどちらを採用するかを確定させず、実装着手時の判断事項として残す。**

---

## 6. Dirty Stateへの影響評価と理想仕様案 `[事実＋提案]`

### 確認できた事実

- Preview開始・終了はいずれも「編集」ではないため、既存の`markProjectDirty()`は
  一切呼ばれない（mutation guardを通過する経路が無いため構造的に呼びようがない）。
- Viewer操作・Compare操作（シーン切替・比較モード変更・視点操作）は現在の
  Viewerでも`markProjectDirty()`を一切呼んでいない（2.1節の関数はいずれも
  mutation guardの内側ではない）。

### Phase 1の基本仕様案（提案）

Preview開始・終了について、以下をPhase 1の基本仕様案として明記する（いずれも
提案であり、事実ではない）：

- **Dirty Stateを維持する**: Preview開始前にdirtyならdirtyのまま、cleanなら
  cleanのまま、Preview終了後も変化させない。
- **Preview開始/終了そのものではdirty化しない**: `markProjectDirty()`を
  呼ばない。
- **未保存確認（confirm dialog）を表示しない**: Preview開始・終了のいずれも
  ユーザーへの確認ダイアログを挟まない。
- **`confirmUnsavedChanges('switch-to-viewer')`をPreview経路では利用しない**:
  既存の`'switch-to-viewer'`文脈は「Editorを実際に離れてViewerへ移動する」
  ことを前提にした文言（「保存せずにViewerへ移動しても...Editorへ戻れば
  引き続き編集できます」）であり、Editorに留まったままの一時的なPreviewには
  そのまま流用できない。Preview専用の新しい確認文脈を追加するのではなく、
  そもそも確認ダイアログを呼ばない、という単純な仕様をPhase 1の提案とする。

Preview開始/終了はいずれも「編集」ではないため、既存の`markProjectDirty()`が
呼ばれる経路自体が無い（1.4節・上記「確認できた事実」参照）ことから、
この仕様案は実装コストがほぼゼロで実現できる。

---

## 7. データ更新経路の遮断方法・appMode方式の比較 `[事実＋提案]`

3節の事実（`assertEditorMode()`/`canMutateProject()`の54箇所は、呼び出し元を
区別せず`appMode`の値のみで判定する）から、Previewを実現するには
「Preview中は`canMutateProject()`が`false`を返すようにする」ことだけが最低限
必要になる。その実現方法として、以下の2案を比較する。**どちらを採用するかは
本調査では確定せず、次の実装PRで判断する。**

### 案A: `appMode`の第三状態として`'preview'`を追加する

`appMode`を`'viewer' | 'editor' | 'preview'`の3値にする。

### 案B: `appMode`は`'viewer'`/`'editor'`のまま変更せず、別途Previewセッション用の状態を持つ

`appMode`自体は現行のまま`'viewer' | 'editor'`の2値を維持し、`appMode`とは
別に`let previewSessionActive = false;`のような独立したフラグを新設する。
Preview中も`appMode`の値そのものは`'editor'`のままにしておく。

### 各案の影響比較

| 影響箇所 | 案A（`'preview'`追加） | 案B（別フラグ） |
|---|---|---|
| `canMutateProject()` | **変更不要**。`appMode === 'editor'`のままで、`'preview'`は自動的に`false`判定になる | **変更が必要**。`return appMode === 'editor' && !previewSessionActive;`のように、この1関数（全54箇所が依存する中核関数）に手を入れる必要がある |
| `renderModeUi()` | 現状の`const editing = appMode === 'editor';`はそのまま`'preview'`を`false`（Viewer扱いのCSS）として扱えるため、`.editor-only`/`.viewer-only`のCSS切り替え自体は無変更で成立する。ただしツールバーのラベル文言（`'Editor'`/`'Viewer'`）を`'Preview'`用に出し分けたい場合は、この関数に条件分岐を1つ追加する必要がある | `editing`の判定式自体を`appMode === 'editor' && !previewSessionActive`に変える必要があり、既存の「`appMode`が`'editor'`かどうかだけを見る」というこの関数の前提が変わる。ラベル文言の出し分けも同様に必要 |
| `.editor-only` / `.viewer-only` | 上記の通り、`renderModeUi()`が`'preview'`を`editing=false`として扱える限り、CSSルール自体（style.css:153-154）は無変更で機能する | `renderModeUi()`側の判定式を変更すれば、CSSルール自体は無変更で機能する（案Aと同じ） |
| `requestEditorAccess()` | 無変更。ただしPreview→Editorへの復帰は、既存の`requestEditorAccess()`（`'viewer'→'editor'`用の唯一の入口）をそのまま使うか、専用の`exitPreviewMode()`を新設するかを決める必要がある。同じ関数を流用すると、「本来のViewerからEditorへ戻る」操作と「Previewから元のEditorへ戻る」操作が同一コード経路になるため、区別できるようにするなら専用関数が必要 | 無変更。`appMode`は最初からずっと`'editor'`のままなので、`requestEditorAccess()`は一切呼ばれない。Preview終了は`previewSessionActive = false`にする専用関数のみで完結する |
| Viewer / Editor切替（`app-mode-toggle-btn`のクリックハンドラ） | 既存ハンドラは`getAppMode() === 'editor'`を見て分岐している（script.js:2670）。`appMode`が`'preview'`のときこの条件は`false`になるため、既存ボタンを押すと「Viewer→Editor」の分岐（`requestEditorAccess()`）に入ってしまう。Preview用には**既存ボタンとは別の、専用のPreview開始/終了ボタン**が必須になる | 既存ハンドラの条件`getAppMode() === 'editor'`は、Preview中も`appMode`が`'editor'`のままのため`true`のままになる。つまり**Preview中に既存の「Viewerで確認」ボタンを押すと、意図せず`confirmUnsavedChanges('switch-to-viewer')`が呼ばれ、本当にEditorを離れてViewerへ切り替わってしまう**。既存ボタンのハンドラ自体に`previewSessionActive`を考慮する分岐を追加するか、Preview中は既存ボタンを隠す対応が必要 |
| Undo / Redo（`performUndo`/`performRedo`） | `canMutateProject()`が無変更で機能するため、追加対応なしで自動的に無効化される | `canMutateProject()`を修正すれば同様に自動的に無効化される（案Aと同じ結果になるが、修正対象が1つ増える） |
| keyboard shortcut（Undo/Redoのショートカットハンドラ） | 同上、`canMutateProject()`経由のため無変更で無効化される | 同上 |
| VR（`enterVr()`/`exitVr()`） | 現状`appMode`/`canMutateProject()`のガードが一切無いため（2.1節）、案A/案Bのどちらでも影響を受けず、Preview中もVRを無条件に開始できてしまう。これが望ましいかどうかは8節で別途扱う | 同左 |

### 比較のまとめ（本調査の評価、いずれの案も未確定）

- 案Aは`canMutateProject()`という中核の共有関数に一切手を入れずに済む点で、
  「既存ガードをそのまま再利用する」という3節の事実に最も忠実だが、
  `getAppMode()`の戻り値が`'viewer'|'editor'`の2値であることを前提にした
  コードが他に無いかどうかは本調査では未検証であり（11節）、`'preview'`という
  新しい値が既存の判定式に予期せず影響する可能性がある。
- 案Bは`appMode`という型・値の集合自体を変えずに済む点で外部からの見え方の
  互換性は高いが、`canMutateProject()`本体と、`app-mode-toggle-btn`の
  クリックハンドラの分岐条件という、2箇所の共有コードに手を入れる必要があり、
  かつ既存ボタンの誤動作（上表）を防ぐための追加対応が必須になる。
- どちらの案でも、Preview開始・終了には既存の`app-mode-toggle-btn`とは別の、
  専用のUI（ボタン）が必要になるという点は共通の結論として導ける。

---

## 8. 段階的実装案 `[提案]`

### Phase 1（最小実装）

- `appMode`の第三状態（案A）と別フラグ（案B）のいずれかを選択する（7節、
  次の実装PRで判断・未確定）。
- 選択した案に応じて`canMutateProject()`を調整し、Preview中は`false`を
  返すようにする（＝既存35+19箇所のガードがそのまま機能する。ただし7節の
  「事実と評価の切り分け」で述べたとおり、この2関数を経由しない更新経路が
  無いことまでは保証できない）。
- 既存の`app-mode-toggle-btn`とは別の、Preview開始/終了専用ボタンを
  Editor画面に1つ追加する（7節の比較まとめで共通結論とした点）。
- Preview中の閲覧位置の扱いは5節の案1（Editorへ引き継ぐ）を推奨するが、
  案2（開始時状態へ戻す）も代替案として残す。
- Dirty Stateは6節の基本仕様案（維持する・dirty化しない・確認ダイアログを
  表示しない・`'switch-to-viewer'`は使わない）に従う。
- Undo/Redoボタン・ショートカットはPreview中`canMutateProject()`により
  自動的に無効化される（3節の表のとおり）。
- **以下3点はPhase 1時点で未確定事項として残し、実装着手時に仕様として
  決定する（いずれも`[提案]`であり結論ではない）**:
  - **Export（JSON/ZIP書き出し）**: 現行の`assertEditorMode()`ガードにより
    Preview中は自動的にブロックされる（＝Editorに戻らないと書き出せない）。
    これをPhase 1のデフォルト仕様として推奨するが、「Preview中でも書き出しは
    許可すべきでは」という代替意見もあり得るため未確定。
  - **Fullscreen**: 既存のFullscreen APIは`appMode`と無関係に独立して動作する
    （4節）。Preview開始/終了時にFullscreenを自動的に切り替える仕様は本調査
    では提案しない（現状のViewer/Editor切替と同様、Fullscreen状態には一切
    触れない）ことをPhase 1の推奨仕様とするが、確定事項ではない。
  - **VR中のPreview開始/終了、Preview中のVR開始**: 11節の未検証リスクの
    とおり、`enterVr()`にはappMode起因のガードが無いため、技術的には
    Preview中でもVRを開始できてしまう。Phase 1では保守的に「VRセッション中は
    Preview開始ボタンを無効化する」「Preview中はVR開始ボタンを無効化する」
    という排他制御を推奨仕様として提案するが、実機検証（Quest 3等）を
    行っていないため未確定・未検証のまま次の実装PRへ引き継ぐ。

### Phase 2（UI/UXの調整）

- Preview中であることを示す専用インジケーター（Viewer/Editorのラベルとは
  別に「プレビュー中」等の表示）を追加。
- `confirmUnsavedChanges`にPreview専用の扱いを追加するか、Preview切替では
  そもそも呼ばないようにする（6節）。
- Preview中のUndo/Redoボタンの表示/非表示方針を確定する（非表示にするか、
  Viewer同様に隠すか、を仕様として決定）。

### Phase 3（将来のViewer別Entry対応を見据えた抽象化）

- 9節で述べる将来の`viewer.html`/`editor.html`分離を見据え、Preview開始/終了
  処理（7節の案A/案Bいずれを選んだ場合も）の内部実装を、将来Viewer側が
  「別ページとして開く」形に置き換わっても、Editor側の呼び出しコードが
  変わらないよう抽象化しておく（例: Preview開始点を将来的に
  「新しいタブでviewer.htmlを開き、現在のプロジェクト状態をpostMessage/
  一時保存で渡す」に差し替えられるようにする）。
- この段階は本調査の範囲外（9節参照）であり、Phase 1/2の設計判断が
  固まった後に着手する。

---

## 9. Viewer別Entry対応（将来のviewer.html/editor.html分離）`[事実＋提案]`

### 確認できた事実

- `01_Roadmap.md`（Vault側、本repoには存在しない）には「Viewer/Editorの
  別URL・別エントリーポイント分離」が「後回しにする内容」として既に
  記載されている。現状の`script.js`は単一の`init()`関数内にViewer/Editor
  両方のロジックが同居しており、別ファイル分離は行われていない
  （`grep -n "^function init"` = script.js:122の1箇所のみ）。

### Viewer Mode / Viewer Preview / 将来のViewer Entryの責務整理（提案）

| 概念 | 責務 | 現状 |
|---|---|---|
| Viewer Mode（既存） | プロジェクト全体を「閲覧のみ」で開く、恒久的なapp全体のモード。reload後は必ずここから始まる | 実装済み（PR #12） |
| Viewer Preview（本調査の対象） | Editorに留まったまま、一時的に「Viewerではどう見えるか」を確認する。Editorの状態を共有し、終了すれば即Editorに戻る | 未実装。本調査はここまで |
| 将来のViewer Entry（`viewer.html`分離） | Viewer専用の別ページ・別エントリーポイントとして完全に切り離す。Editor機能を一切含まないバンドルにできる可能性がある | 未着手、本調査の範囲外 |

Viewer PreviewはViewer Modeの「一時的な部分集合」として実装するのが自然であり、
将来Viewer Entryへ分離する際も、Viewer Previewで培った「Editorの状態をどう
Viewer側へ渡すか」のロジック（4節）がそのまま流用できる可能性が高いと考える
（提案・未検証）。

---

## 10. Playwrightテスト計画（実装時に必要になる項目）`[提案]`

まだ実装しないため、以下は項目の洗い出しのみ。

- Preview開始: Editorから開始できる、Viewerからは開始ボタンが存在しない
  （またはEditor限定であることの確認）
- Preview中の状態: `currentIdx`/`compareState`/`activeFloorplanId`が
  Editor終了時点と一致していることの確認
- Preview中の編集禁止: 3節の表にある全操作（シーン名変更・削除・追加・
  左右反転・比較セット操作・平面図操作・マーカー操作・Import/Export・
  Undo/Redo）がPreview中に実行できないことの確認（既存の
  `smoke.spec.js`のViewerガードテストと同様のパターンを流用可能）
- Preview中の閲覧操作: シーン切替・比較モード切替・VR開始・視点操作が
  Preview中も正常に動作することの確認
- Preview終了: Editorへ正しく戻ること、Preview中に行った閲覧操作
  （シーン切替等）がEditor側にも反映されている（5節の「引き継ぎ」仕様）ことの確認
- Dirty State: Preview開始/終了がdirty状態を変化させないことの確認
  （dirtyな状態でPreviewへ入って戻ってもdirtyのまま、クリーンな状態で
  入って戻ってもクリーンなまま、の両方）
- Undo/Redo: Preview中はUndo/Redoボタン・ショートカットが無効化される
  ことの確認（既存の`history-controls.spec.js`のViewerモードテストと
  同型のテストを追加する想定）
- 10回連続Preview開始/終了: イベント重複やレンダラー再生成が発生しない
  ことの確認（既存のPR #12監査で行った「10回連続モード切替」と同型）
- 既存71件の回帰: Preview機能追加後も既存テストがすべて成功すること

---

## 11. 実装時のリスク `[提案＋未検証]`

- **`appMode`に第3の値を追加する場合の後方互換性**: `getAppMode()`の戻り値を
  `'viewer' | 'editor'`前提で使っているコードが他にないか、実装時に
  再確認が必要（本調査では`getAppMode()`の呼び出し箇所が
  `renderModeUi()`内の判定以外に無いかまでは確認していない未検証事項）。
- **VR中のPreview遷移**: 4節で述べたとおり、VR中にPreviewへ出入りする
  組み合わせは本調査では未検証。`enterVr()`が`compareState.mode !== 'single'`
  時に非対応としている（script.js:5423）のと同様に、Preview中はVR開始を
  禁止する、またはVR中はPreview切替ボタン自体を隠す、といった追加の
  排他制御が必要になる可能性がある。
- **Dirty State文脈の拡張**: 6節で提案したとおり、`confirmUnsavedChanges`に
  Preview専用の文脈を追加する場合、既存の`'switch-to-viewer'`/
  `'replace-project'`との文言の一貫性を保つ必要がある（PR #14の設計判断
  「switch-to-viewerとreplace-projectで同一の確認文言・選択肢を共有しない」
  という既存方針をPreviewにも適用するかどうかの判断が必要）。
- **Undo/Redoとの関係**: Preview中にUndo/Redoを完全に無効化する場合、
  ユーザーが「Previewで気づいた問題をすぐUndoしたい」というユースケースに
  対応できない。Preview中もUndo/Redoだけは許可する設計にするかは、本調査
  では結論を出さず、実装着手時にユーザーへ確認すべき仕様判断として残す。
- **将来のViewer Entry分離との整合性**: 9節の将来構想と矛盾しない設計に
  しておかないと、Phase 3で手戻りが発生するリスクがある。

---

## 関連

- `01_Projects/ArchView360/01_Roadmap.md`（Obsidian Vault側、「後回しにする内容」
  節にViewer Preview・別URL分離が記載されている）
- `01_Projects/ArchView360/03_Decisions.md`（App Mode基盤・mutation guard方針の
  既存設計判断）
