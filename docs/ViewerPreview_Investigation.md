# Viewer Preview 機能 設計調査（v2.22.0時点）

このドキュメントは調査専用であり、実装は含まない。`script.js` / `index.html` /
`style.css` / `package.json` / ワークフロー / 既存テストは一切変更していない。

- 調査時点のmain: `5f6c69c14f1a6f23b35ecbf98c20569ced1fa275`
- `appVersion`: `2.22.0`（変更なし）
- 調査前のPlaywrightベースライン: 71/71成功

以下、各項目は「確認できた事実」（実際のコード・行番号に基づく）と
「推測・提案」（本調査で新たに考案した設計案）を明示的に分けて記載する。
見出しの末尾に `[事実]` / `[提案]` を付す。

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

## 3. 編集操作一覧・禁止操作分類 `[事実＋提案]`

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

**結論（事実に基づく）**: PreviewはVieweと全く同じ「禁止操作」集合になる。
既存の`assertEditorMode()`/`canMutateProject()`ガードは、呼び出し元が
どちらの経路（Editorの通常編集画面／Editorから開いたPreview）であっても
`appMode`の値だけを見て判定するため、**Preview中に`appMode`を一時的に
`'viewer'`にできれば、既存ガードをそのまま再利用でき、Preview専用の
新しいガード条件を追加する必要が無い**（後述4節・7節の設計の核）。

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
これは本調査で確認できた最も重要な構造的事実であり、7節の最小実装案の前提になる。

---

## 5. Preview終了時の復元対象 `[提案]`

4節の評価により、**Preview終了時に明示的な「復元」処理が必要な状態は無い**と
考えられる。Preview中にユーザーがシーン切替・比較モード変更・視点操作を行った
場合、それらは`currentIdx`/`compareState`/カメラを直接書き換えるため、Preview
終了後のEditorにもそのまま反映される（＝「復元」ではなく「引き継ぎ」）。

これはPreviewの目的（「今の状態が閲覧者にどう見えるかを確認する」）と整合する。
もしPreview中の閲覧操作をEditor側に一切反映したくない場合（＝Preview専用の
一時ビュー状態にしたい場合）は、`currentIdx`/`compareState`をPreview開始時に
複製し、終了時に破棄する設計が必要になるが、その場合は現在の共有state設計を
変更する必要があり、影響範囲が大きくなる（6節）。**本調査ではどちらの仕様に
するかは未確定とし、7節でPhase分けの判断材料として提示する。**

---

## 6. Dirty Stateへの影響評価と理想仕様案 `[事実＋提案]`

### 確認できた事実

- Preview開始・終了はいずれも「編集」ではないため、既存の`markProjectDirty()`は
  一切呼ばれない（mutation guardを通過する経路が無いため構造的に呼びようがない）。
- Viewer操作・Compare操作（シーン切替・比較モード変更・視点操作）は現在の
  Viewerでも`markProjectDirty()`を一切呼んでいない（2.1節の関数はいずれも
  mutation guardの内側ではない）。

### 理想仕様案（提案）

- Preview開始/終了はDirty Stateに一切影響しない（現状のViewer切替と同じ扱い）。
- Preview中の閲覧操作（シーン切替・比較モード変更・視点操作）もDirty Stateに
  一切影響しない。
- **既存の`confirmUnsavedChanges('switch-to-viewer')`は、Editor→Viewer（本当に
  Editorを離れる）の場合にのみ表示されるべきで、Editor→Preview（Editorに留まった
  ままの一時プレビュー）では表示すべきではない**。Previewはデータを一切破棄
  せず、そのままEditorへ戻れるため、既存の`'switch-to-viewer'`文言
  （「保存せずにViewerへ移動しても...Editorへ戻れば引き続き編集できます」）は
  Previewの実態とは異なる。Preview専用の確認文脈を新設するか、確認自体を
  不要にするかは実装時に判断する（8節Phase2）。

---

## 7. データ更新経路の遮断方法（最小実装案）`[提案]`

3節・4節の事実から、**既存設計を変更せずに実現できる最小実装**が導ける。

### 最小実装案（Phase1、7節）

Previewを「`appMode`を一時的に`'viewer'`へ切り替え、Editorの状態
（`currentIdx`/`compareState`/`activeFloorplanId`等）と`body`のCSSクラス
以外は何も変更しない一時モード」として実装する。

1. 新しい関数`enterPreviewMode()`を追加する。内部で`appMode`を保存してから
   `enterViewerMode()`相当のCSS適用（`body`に`mode-viewer`を付与）を行うが、
   `appMode`の値自体は`'editor'`のまま変えないか、あるいは`'preview'`という
   第3の値を新設するかは実装時に選択する（後者の場合、`canMutateProject()`は
   `appMode === 'editor'`のままで良く、`'preview'`は自動的に「編集不可」になる）。
2. `exitPreviewMode()`で元の`appMode`（常に`'editor'`）へ戻し、CSSクラスを
   `mode-editor`に戻す。
3. `renderModeUi()`・既存の35件の`assertEditorMode()`・19件の
   `canMutateProject()`は**一切変更しない**。`appMode`が`'preview'`という
   新しい値を持つ場合でも、`canMutateProject()`を`appMode === 'editor'`から
   `appMode === 'editor' && !inPreview`（またはそれに類する追加条件）に
   変えるだけで、既存の35+19箇所の呼び出し元コードは無変更で済む。

この最小実装は「既存設計を優先すること」という調査指示と直接合致する。

---

## 8. 段階的実装案 `[提案]`

### Phase 1（最小実装）

- `appMode`に`'preview'`を追加（または`inPreview`フラグを`appMode === 'editor'`と
  併用する設計、実装時にどちらか選択）。
- `canMutateProject()`のみ変更し、Preview中は`false`を返すようにする
  （＝既存35+19箇所のガードがそのまま機能する）。
- Preview開始/終了ボタンをEditor画面に1つ追加。
- Dirty Stateは無変更（6節の理想仕様どおり、影響しない）。
- Undo/Redoボタン・ショートカットはPreview中`canMutateProject()`により
  自動的に無効化される（3節の表のとおり）。

### Phase 2（UI/UXの調整）

- Preview中であることを示す専用インジケーター（Viewer/Editorのラベルとは
  別に「プレビュー中」等の表示）を追加。
- `confirmUnsavedChanges`にPreview専用の扱いを追加するか、Preview切替では
  そもそも呼ばないようにする（6節）。
- Preview中のUndo/Redoボタンの表示/非表示方針を確定する（非表示にするか、
  Viewer同様に隠すか、を仕様として決定）。

### Phase 3（将来のViewer別Entry対応を見据えた抽象化）

- 9節で述べる将来の`viewer.html`/`editor.html`分離を見据え、
  `enterPreviewMode()`/`exitPreviewMode()`の内部実装を、将来Viewer側が
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

## 11. 実装時のリスク `[提案]`

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
