# Viewer用DOM分離方式の設計比較（v2.22.0時点）

このドキュメントは設計比較専用であり、実装は含まない。`index.html` / `script.js` /
`style.css` / `tests/` / `package.json` / ワークフロー / `obsidian-vault` は
一切変更していない。

- 確認時点のmain HEAD: `7f45c1512170dc60191ef3c51b59438ebbbb4d7d`（PR #38 merge commit、
  Viewer/Editor分離 Phase 3完了時点）
- `appVersion`: `2.22.0`（変更なし）
- 前提として以下を参照する:
  - `docs/ViewerEditor_Entrypoints_Investigation.md`（Phase 1調査。以下「Entry調査文書」）
  - `docs/ViewerEditor_DOM_Responsibility_Investigation.md`（Phase 2調査。以下「DOM調査文書」）
  - `docs/ViewerEditor_Phase3_Implementation_Plan.md`（Phase 3実装計画）
  - `01_Projects/ArchView360/03_Decisions.md`（Obsidian Vault側、Phase 3完了時点の設計判断）

以下、各項目は次の3種類を明示的に分けて記載する。

- `[事実]` — 実際のコード・行番号を確認した上での記述。
- `[提案]` — 本文書で考案した設計案・比較評価。まだ確定していない。
- `[未検証]` — 本文書の範囲では確認していない・検証していない事項。

**本文書の位置づけ**: この文書はHTML分割の実装可否を判断するための比較検討であり、
本文書自体はいかなる実装（HTML新設・script.js変更・URL仕様変更・認証実装）も
行わない。次のステップは実装ではなく、この比較結果に基づく設計レビューである。

---

## 0. 前提の確認 `[事実]`

- Viewer URL（`?mode=viewer`/`?mode=editor`）は認証・権限境界ではない。`appMode`は
  セッション内JS変数に過ぎず、クライアント側から書き換え可能な状態を防ぐ設計には
  なっていない（PR #29時点の既存判断、`01_Projects/ArchView360/03_Decisions]]`の
  「URL指定は認証・権限境界ではなく…」判断を踏襲する）
- `requestEditorAccess()`（script.js:723）は、将来の認証・ライセンス・権限チェックを
  挿入するために意図的に空実装のまま用意されている唯一の入口である。現在の唯一の
  呼び出し元は`app-mode-toggle-btn`のクリックハンドラ（script.js:2772）のみ
- Viewer Preview（`previewActive`、既存実装）とViewer URL起動（`resolveInitialAppMode()`、
  既存実装）は別概念である。Viewer Previewは「Editorとして起動した後、セッション内で
  一時的にViewer表示を覗く」機能であり、Viewer URLは「起動時にどちらのモードで
  始まるか」を決めるだけの機能である。本文書で扱う「Viewer用DOM分離」は、この
  いずれとも独立した**配布物としてのDOM構成**の話であり、両概念を混同しない
- HTML分割へ即実装着手しない。本文書はあくまで比較・推奨案の整理に留める
- Phase 3（PR #31〜#38）で、DOM調査文書が確定したCSS無guard系21要素（①DOM取得/
  呼び出しguard必要3件＋②イベント登録guard必要18件）へのnull-guard対応は完了済み
  （merge commit `7f45c1512170dc60191ef3c51b59438ebbbb4d7d`、main push CI
  `30161824706`、Playwright 114 passed）

---

## 1. 現行のindex.html・script.js・mode切替処理の確認 `[事実]`

- `index.html`は658行、単一ファイルで`<script src="script.js?v=..." defer></script>`
  として`script.js`（7300行）を1箇所のみ読み込む。`style.css`（2770行）も1ファイル
- `id="..."`を持つ要素は184件（DOM調査文書2.2節、変化なし）
- mode切替の中核関数（いずれもscript.js、行番号は現時点のもの）:
  - `resolveInitialAppMode()`（script.js:672）: 起動時のURLクエリパラメータ`mode`を
    読み、`'viewer'`/`'editor'`のいずれかを返す（Phase 1、PR #29実装）
  - `let appMode = resolveInitialAppMode();`（script.js:676）: 初期値の確定
  - `getAppMode()`（script.js:678）/`canMutateProject()`（script.js:684）/
    `assertEditorMode(label)`（script.js:693）: 判定・ガードの一元入口
  - `enterViewerMode()`（script.js:700）/`enterEditorMode()`（script.js:706）:
    ページ遷移を伴わない、同一ページ内でのモード切替
  - `requestEditorAccess()`（script.js:723）: ViewerからEditorへの唯一の入口
    （現状は素通しの空実装）
  - `renderModeUi()`（script.js:733）: `body`のmode class（`.mode-viewer`/
    `.mode-editor`）とラベルをCSS/DOM側へ反映するだけの関数（レンダラー・シーン・
    VRオブジェクトの再生成は行わない）
  - `previewActive`（script.js:771、Viewer Preview専用フラグ、`appMode`とは独立）
- `app-mode-toggle-btn`（script.js:270で取得、script.js:2755で`if (appModeToggleBtn)`
  ガード済み）のクリックハンドラのみが`requestEditorAccess()`を呼ぶ（script.js:2772）。
  **このボタンが物理的に存在しなければ、そのページ上で`appMode`が`'editor'`に
  変わる経路は存在しない**、という事実は3節の推奨案の前提として重要
- `applySceneFlip(sceneId, flipH)`（script.js:3102）は、`flipBtn`/`flipABtn`/
  `flipBBtn`への参照（script.js:3107, 3111, 3115）を無条件に持つ。この関数の呼び出し元は
  (a) `flip-btn`/`flip-a-btn`/`flip-b-btn`自身のクリックハンドラ（Phase 3 G1/G3で
  `if (element) element.addEventListener(...)`によりガード済み）、(b) `performUndo()`/
  `performRedo()`（script.js:7230, 7236）経由のhistory再生。(b)は`if (!canMutateProject())
  return;`で`appMode === 'editor'`を先頭ガードしているため、**Editorへ到達する経路が
  存在しない限り、`applySceneFlip()`自体が呼ばれることはない**という関係にある
  （ただしこれは本文書の設計観察であり、5節で改めて「既知の未対応事項」として
  切り分けて扱う）

---

## 2. Viewerで不要なDOM群のカテゴリ整理 `[事実]`

DOM調査文書（Phase 2）が確定した分類を、本文書の目的（Viewer専用ページで
物理的に除去してよい範囲の特定）に沿って再整理する。数値はDOM調査文書と同一の
確定値・確認済み値を踏襲し、本文書で新たに再計測はしていない。

| カテゴリ | 件数 | 確度 | 除去可否（本文書の評価） |
|---|---|---|---|
| ① CSSベースEditor専用・直接付与（`.editor-only`、id付き） | 19 | 確定値 | 除去可（Phase 3で全21件中の該当分guard済み、または元々guard済み） |
| ② CSSベースEditor専用・継承（親`.editor-only`の子、id付き） | 8 | 確定値 | 除去可（`floormap-orient-bar`系4＋`floormap-info-actions`系4、いずれもPhase 3 G5/G6でguard済み） |
| ③ CSSベースEditor専用・id無しコンテナ（`floormap-info-actions`） | 1（HTMLノード、184件の外） | 確定値 | 除去可（script.js参照0件） |
| ④ 関数レベルガードEditor専用（`project-info-modal`系9・`set-name-modal`系8・`group-picker`系4） | 21 | 確認済み値（暫定） | 除去可能性が高いが、13節の未確認事項が未解消のため`[未検証]`のまま残る（5節参照） |
| ⑤ Common（両モード共通） | 136 | 候補値（暫定） | 除去不可（Viewer専用ページにも必須） |
| ⑥ Viewer専用（`.viewer-only`実使用） | 0 | 確定値 | 該当なし |

- **Viewer専用ページで除去してよい候補の合計**: ①＋②＋③＋④＝19＋8＋1＋21＝**49**
  （id付き48＋id無し1）。DOM調査文書2.7節の「確認済みEditor専用合計48（ID基準）」に
  id無しコンテナ1を加えた数値であり、新たな集計ではなく既存確定値の組み替えである
  `[事実に基づく整理]`
- ①②はPhase 3（PR #35 G1、PR #37 G5、PR #38 G6等）で該当箇所のnull-guardが
  完了済みであるため、**script.js側の追加変更なしに、これらのDOM要素をHTMLから
  物理的に除去しても`init()`が例外なく完走する見込みが高い**`[事実に基づく評価、
  実HTML上での検証は未実施のため未検証]`
- ④は開く関数自体（`openProjectInfoModal()`・`openGroupPicker()`・
  `openSetNameModal()`の全呼び出し元）が`assertEditorMode()`をDOM参照より前に
  呼んでいるため、除去しても安全である可能性が高いが、**DOM調査文書13節の
  未確認事項（同種パターンを持つ他モーダルの網羅確認）が未解消**であり、
  本文書もこれを解消していない。この点は5節で分離して明記する

---

## 3. 4案の比較 `[提案]`

比較対象は指示どおりの4案とする。

1. **案1（現行維持）**: 単一`index.html`を維持し、CSS/JSで表示制御する（現状のまま）
2. **案2（viewer.html追加）**: `viewer.html`を新設し、`script.js`をそのまま共用する
3. **案3（editor.html/viewer.html分割）**: `viewer.html`と`editor.html`へ分割し、
   共通部分（head/vendor読み込み/ヘッダー等）をテンプレート化する
4. **案4（ビルド時生成）**: ビルド時に共通テンプレートから複数HTMLを生成する

### 比較表

| 評価軸 | 案1 現行維持 | 案2 viewer.html追加 | 案3 editor.html/viewer.html分割 | 案4 ビルド時生成 |
|---|---|---|---|---|
| DOM削減効果 | 無し（184件常時全部） | 高い（viewer.htmlは2節の49件を除いた135件相当） | 案2と同等（viewer.html側）。editor.html側はViewer専用要素が現状0件のため追加削減はほぼ無い | 案2/3と同じ削減結果を、生成元テンプレートから機械的に達成 |
| コード重複 | 無し | 低〜中（HTMLマークアップの共通部分のみ。`script.js`/`style.css`は完全共有） | 中〜高（2つの完全なHTMLを手動保守。テンプレート化しない限り重複が残る） | 低（ソース上はテンプレート1つ。ただしビルドパイプライン自体が新規コスト） |
| 保守性 | 高い（変更箇所1つ、Phase 1〜3の実績どおり） | 中（`script.js`/`style.css`は1箇所のまま、HTMLのみ2箇所） | 低〜中（2ファイル並行保守＋テンプレート機構自体の保守） | 中（テンプレートは1箇所だが、生成スクリプト・CIの保守が新規発生） |
| テスト負担 | 低（既存114件のまま） | 中（`viewer.html`向け新規回帰テストのみ追加。既存`index.html`向けテストは無変更で維持できる見込み） | 中〜高（2ページ分のテストスイート再編が必要になりうる） | 高（生成物に対するテスト＋ビルドステップ自体の妥当性検証が必要） |
| 静的ホスティング適合性 | 最良（現状のままVercel/GitHub Pagesへビルドレス配信中） | 良好（静的ファイル1つの追加のみ、ビルドステップ不要） | 良好（静的ファイル2つ、テンプレートを静的な部分ファイル読み込みで実現する場合はビルドステップ不要） | 悪化（ビルドステップ導入が前提となり、「ソースがそのまま配布物」という現状の前提が崩れる） |
| 既存URL互換性 | 完全互換 | 完全互換（`/`＝`index.html`は無変更、`/viewer.html`は新規追加のみ） | `/`の意味の再定義が必要になりうる（`index.html`をどちらに割り当てるかの判断が必要） | 案3と同様＋ビルド成果物のパス設計が必要 |
| script.js共用可否 | 完全共有（単一） | 完全共有（Phase 3のnull-guardにより、DOM要素の有無差異を吸収できる見込み） | 完全共有可能。ただしEditor専用ロジックも含めた全体が両ページに配信され続ける（JS配信量削減という動機には応えられない） | 完全共有可能。将来的に`script.js`自体の分割を検討する余地はあるが、本比較の対象（HTML生成）とは別課題 |
| 将来の認証・ライセンス導入との整合 | 変わらず`requestEditorAccess()`が唯一の入口 | 同左。`viewer.html`に`app-mode-toggle-btn`を含めるかどうかが下位設計判断として残る（4節参照） | 同左。`editor.html`側は現状どおり`requestEditorAccess()`不要（既にEditorとして開始する設計にするか要判断） | 同左 |
| 配布形態 | 単一HTML1ファイル＋共有JS/CSS | HTML2ファイル（`index.html`／`viewer.html`）＋共有JS/CSS | HTML2ファイル（`editor.html`／`viewer.html`）＋共有JS/CSS＋テンプレート機構 | ビルド成果物としての複数HTML＋共有JS/CSS＋ビルドパイプライン |
| 段階導入のしやすさ | 該当なし（既に導入済み） | 高い（既存`index.html`に一切手を入れず新規ファイル1つの追加のみ。ロールバックも新規ファイル削除のみで完結） | 中（`index.html`の位置づけ（廃止／維持）の移行判断が伴う） | 低い（ビルドパイプライン導入自体が既存の「ビルドレス」運用からの大きな移行になる） |

---

## 4. 推奨案 `[提案]`

**推奨: 案2（`viewer.html`を新設し、`script.js`をそのまま共用する）**

### 推奨理由

1. Phase 3完了により、2節で整理した除去候補49件（①②③④）のうち①②③（28件、
   CSSベース）はscript.js側の追加変更が不要な状態まで既にnull-guard対応済みであり、
   案2は**この既存資産をそのまま活かせる**最小コストの選択肢である
2. 段階導入のしやすさ・ロールバックの容易さで他案より明確に優れる（3節の比較表）。
   `index.html`に一切手を加えないため、既存114件のPlaywrightテスト・既存URL契約
   （PR #29のURL契約）・Viewer Preview実装のいずれにも影響しない
3. 案3（editor.html/viewer.html分割）は`/`の意味の再定義という追加の移行判断を
   要求し、案4（ビルド時生成）は「ビルドレスな静的配布」という現状の前提を崩す
   （2.6節相当、Entry調査文書2.6節で確認済みの事実）。いずれも本文書の前提
   「HTML分割へ即実装着手しない」という段階的検討の精神に対して、リスクと
   コストが不釣り合いに大きい
4. `script.js`/`style.css`を完全共有するため、将来`requestEditorAccess()`に
   実際の認証・ライセンス・権限ロジックが追加された場合も、その変更は
   `index.html`・`viewer.html`のどちらにも同時に反映される（フォークが無いため
   実装の二重管理が発生しない）

### 4.1 URL設計

- 既存URL（`/`、`/?mode=viewer`、`/?mode=editor`）の挙動・契約は一切変更しない
  （PR #29のURL契約を維持）
- 新規に`/viewer.html`という静的パスを追加する。このページは**常にViewerとして
  動作する**設計とし、`resolveInitialAppMode()`のURLパラメータ解析結果に
  関わらず、そもそも`app-mode-toggle-btn`を含まない（4.3節参照）ため、
  実質的にURLクエリパラメータを必要としない
- `/viewer.html`と`/index.html?mode=viewer`は「見た目・機能としては同じViewer
  体験」を提供するが、前者はDOM削減された軽量版、後者は既存の全DOM込みの
  ページである、という違いを利用者向けドキュメントで明記する`[提案]`
- `/viewer.html`を公開URLとして案内するかどうかは、Entry調査文書9.3節の
  「`?mode=editor`を公開仕様とするかは未確定」と同様、実装着手時の判断事項として
  残す（本文書では決定しない）

### 4.2 共通JS/CSSの扱い

- `script.js`・`style.css`は一切フォークせず、`index.html`と全く同じファイルを
  そのまま`<script src="script.js?v=...">`／`<link rel="stylesheet" href="style.css">`
  で読み込む
- `viewer.html`専用の追加JSは書かない。DOM要素の有無による差異は、Phase 3で
  追加済みのnull-guard（`if (element) ...`パターン）のみで吸収される設計とする
- three.js（`vendor/three-global.js`）・JSZip（`vendor/jszip.min.js`）の読み込みも
  `index.html`と同一のタグをそのまま複製する

### 4.3 DOM責務

- `viewer.html`は184件中、2節で整理した除去候補49件（①CSSベース直接付与19＋
  ②継承8＋③id無しコンテナ1＋④関数レベルガード21）を除いた**135件のCommon要素
  のみ**を含む
- `app-mode-toggle-btn`自体を`viewer.html`に含めない（新規カテゴリとして
  追加除去する）。この設計判断により、`requestEditorAccess()`（script.js:723）への
  到達経路が`viewer.html`上には物理的に存在しなくなり、`viewer.html`は
  「Editorへ昇格する手段を持たない、純粋なViewer専用ページ」になる`[提案]`。
  Editorとして編集したい利用者は、既存の`/`（`index.html`、必要なら
  `?mode=editor`）を使う、という役割分担にする
- ④（関数レベルガード21件、`project-info-modal`/`set-name-modal`/`group-picker`）は
  実装時点で改めて13節相当の網羅確認（5節）を先行させることを前提条件とする。
  本文書ではあくまで「除去候補」として整理するに留め、確定的に除去可としない

### 4.4 既存テストへの影響

- 既存の`tests/e2e/`配下114件は、対象URLがすべて`index.html`（`/`）であるため、
  **無変更のまま維持できる見込み**（`index.html`自体は変更しないため）
- `viewer.html`向けの新規回帰テストを別ファイル（例:
  `tests/e2e/viewer-html-standalone.spec.js`）として追加する必要がある。
  最低限、以下の確認が必要になる`[提案]`:
  1. `viewer.html`で`init()`が例外なく完走すること（DOM要素49件が存在しない
     条件でのcanary確認、Phase 3の各テストファイルと同じ手法を流用できる）
  2. Common機能（シーン閲覧・分割/スライダー比較・VR開始・FloorMapマーカー
     クリック選択）が`viewer.html`上で従来どおり動作すること
  3. `app-mode-toggle-btn`が存在しないため、Editorへの遷移手段が無いことの確認
     （意図した設計であることの回帰確認）
  4. Viewer Preview関連のUI（`viewer-preview-btn`等、Editor専用のためそもそも
     存在しない）が無いことの確認
- `tests/server.js`（静的ファイルサーバー）は汎用配信のため無変更で
  `/viewer.html`も配信できる見込み（Entry調査文書2.6節の既存事実を踏襲）

### 4.5 段階的移行手順

1. `docs/`配下の本設計比較文書に基づき、まず4節の設計（特に4.3節の
   `app-mode-toggle-btn`除外方針）についてユーザー承認を得る
2. `viewer.html`を新規追加する。`index.html`から2節の除去候補49件を取り除いた
   コピーとして作成し、`script.js`/`style.css`の読み込みタグは`index.html`と
   同一にする
3. `viewer.html`単体で`init()`が例外なく完走することをローカルで確認する
   （ブラウザ実機・Playwrightいずれか、fail-first-then-fixの手法で実施）
4. 4.4節の新規回帰テストを追加し、既存114件と合わせて全件成功することを確認する
5. 5節の未確認事項（DOM調査文書13節）が未解消のままである旨をPR本文に明記し、
   ④（関数レベルガード21件）の除去は「未検証のまま実施する設計判断」であることを
   レビューで共有する
6. 必要であれば`vercel.json`のキャッシュルールへ`viewer.html`を追加するかどうかを
   判断する（Entry調査文書16節の既存の未確認事項）
7. README・マニュアルへ`/viewer.html`の案内を追加するかどうかは、公開URL仕様の
   判断（4.1節）と合わせてユーザーが決定する

### 4.6 rollback方法

- `viewer.html`は`index.html`に一切依存しない独立した新規静的ファイルであるため、
  ロールバックは`viewer.html`ファイルの削除（またはPRのrevert）のみで完結する
- `script.js`・`style.css`・`index.html`はいずれも本設計の実装過程で変更しない
  想定のため、ロールバックによってこれらのファイルに影響が生じることは無い
- `vercel.json`にキャッシュルールを追加した場合は、そのルールも同時にrevertする

---

## 5. 既知の未対応事項（分離して記載） `[未検証]`

以下は本文書のいずれの案でも解消されない、独立した未対応事項である。
**これらが「対応済み」であるとは記載しない。**

1. **`applySceneFlip()`内の`flipBtn`/`flipABtn`/`flipBBtn`参照
   （script.js:3107, 3111, 3115）**: 依然として無guardのままである。1節で述べた
   とおり、4.3節の設計（`viewer.html`に`app-mode-toggle-btn`を含めない）を
   採用した場合、`viewer.html`上ではEditorへの到達経路が無くなるため、
   `performUndo()`/`performRedo()`経由での`applySceneFlip()`呼び出しは構造的に
   起こりえない、という設計上の観察はできる。**しかし、これはコードの解析に
   基づく設計上の推測であり、実機・Playwrightでの検証を行っていない
   `[未検証]`。参照そのものへのnull-guard追加は本文書のスコープ外であり、
   未対応のまま残る**
2. **DOM調査文書13節の未確認事項（他モーダルの関数レベルガード網羅確認）**:
   `project-info-modal`/`set-name-modal`/`group-picker`以外に同種のパターン
   （CSS上は`.editor-only`が無いが、開く関数自体または全呼び出し元がガード
   されている）を持つUIが存在するかどうかは、本文書でも解消していない。
   2節の④（関数レベルガード21件）を`viewer.html`から除去する判断は、
   この未確認事項が解消されるまでは**確定的な安全宣言ではない**、という
   位置づけのまま残す

---

## 6. 実装PRの最小分割案 `[提案]`

推奨案（案2）を実際に実装する場合の最小分割案を示す。いずれも本文書では
実装していない。

1. **PR-A**: DOM調査文書13節の未確認事項の解消（他モーダルの関数レベル
   ガードの網羅調査、docs-only）。4節の④（21件）の除去可否を確定させる
   前提作業として先行させる
2. **PR-B**: `viewer.html`静的ファイルの新規追加のみ（2節の除去候補49件を
   除いたコピー、`script.js`/`style.css`読み込みは`index.html`と同一）。
   PR-Aの結果次第で④の除去範囲を調整する
3. **PR-C**: `viewer.html`向けの新規Playwright回帰テスト追加
   （4.4節の1〜4）。既存`index.html`向け114件は無変更のまま維持する
4. **PR-D（任意）**: `vercel.json`のキャッシュルール検討、README/マニュアルへの
   `/viewer.html`案内追加。公開URL仕様として案内するかどうかのユーザー判断を
   前提とする

いずれのPRも、実装前に本文書の該当節（特に4.3節・5節）を前提条件として
再確認したうえで着手する。

---

## 関連

- `docs/ViewerEditor_Entrypoints_Investigation.md`（Phase 1調査。案1〜4の元となった
  比較の初出、5節・6節・8節）
- `docs/ViewerEditor_DOM_Responsibility_Investigation.md`（Phase 2調査。2節の
  除去候補49件の内訳の出典、13節の未確認事項）
- `docs/ViewerEditor_Phase3_Implementation_Plan.md` / 各G1〜G6実装PR（Phase 3、
  ①②③の除去候補が安全になった根拠）
- `01_Projects/ArchView360/03_Decisions.md`（Obsidian Vault側、Phase 1〜3の
  既存設計判断）
