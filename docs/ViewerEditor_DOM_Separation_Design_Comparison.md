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

**単位の区別（重要）**: DOM調査文書2.7節と同様、本文書でも「ID基準（184を
分母とする集計）」と「HTMLノード基準（id無しノードも含む参考値）」を
明確に区別する。以降の合計・差分は**すべてID基準**で行い、HTMLノード基準の
値（③、28）を184から直接引く計算はしない（③は184の外側にある別集計単位のため）。

**更新履歴（2026-07-26）**: `docs/ViewerEditor_Phase2_Section13_Audit.md`
（以下「§13監査文書」）により、DOM調査文書13節の未確認事項が解消された。
これに伴い、下表の④・確認済みEditor専用合計・Common候補は暫定値から
確定値へ更新した（`project-info-modal`群の集計に1件の数え落としがあった
ことが判明し、21→22へ訂正された。詳細は§13監査文書4節参照）。

| カテゴリ | 件数 | 単位 | 確度 | 除去可否（本文書の評価） |
|---|---|---|---|---|
| ① CSSベースEditor専用・直接付与（`.editor-only`、id付き） | 19 | ID基準 | 確定値 | 除去可（Phase 3で該当分guard済み、または元々guard済み） |
| ② CSSベースEditor専用・継承（親`.editor-only`の子、id付き） | 8 | ID基準 | 確定値 | 除去可（`floormap-orient-bar`系4＋`floormap-info-actions`系4、いずれもPhase 3 G5/G6でguard済み） |
| ①+②合計（CSSベースEditor専用、ID基準） | **27** | ID基準 | 確定値（DOM調査文書2.7節の27と一致） | 除去可 |
| ③ CSSベースEditor専用・id無しコンテナ（`floormap-info-actions`本体） | 1 | HTMLノード（184件の外、id無し） | 確定値 | 除去可（script.js参照0件）。①②とは別集計単位のため、184からの差分計算には含めない |
| （参考）①+②+③合計（CSSベース、HTMLノード基準） | 28 | HTMLノード基準（184の外を含む参考値） | 確定値（DOM調査文書2.7節の28と一致） | ID基準の27とは単位が異なる別の値であり、混同しない |
| ④ 関数レベルガードEditor専用（`project-info-modal`系10・`set-name-modal`系8・`group-picker`系4） | **22**（21から訂正） | ID基準 | **確定値**（§13監査文書により、3群以外に同種パターンを持つ静的ID群が無いことを確認し、`project-info-modal`群の数え落としも訂正済み） | 除去可（§13監査文書9.1節） |
| 確認済みEditor専用合計（①+②+④、ID基準） | **49**（48から訂正） | ID基準 | **確定値** | — |
| ⑤ Common候補（184－49－0、ID基準） | **135**（136から訂正） | ID基準 | **確定値** | 除去不可（Viewer専用ページにも必須） |
| ⑥ Viewer専用（`.viewer-only`実使用） | 0 | ID基準 | 確定値 | 該当なし |

- **ID基準でのViewer専用ページの除去候補・残存Common数**: ①＋②＋④＝27＋22＝
  **49（確定）**。184－49－0＝**135（確定）**がID基準のCommon残存数になる。
  §13監査文書7節の確定値と一致する`[事実に基づく整理]`。
  **①②（27件）・④（22件）はいずれも確定値であり、49・135も確定値である**
- ③（id無しコンテナ`floormap-info-actions`本体、1件）は184のID基準集計には
  含まれない別集計単位（HTMLノード基準）である。①②の子要素をすべて除去すれば
  このコンテナ自身は空になるため、実装時には併せて物理的に除去する対象として
  扱うが、**「184から引いて残存数を求める」計算には加えない**（単位が異なる値を
  混在させないため）
- **重要な注意（本文書の初版が一時的に導出した「49」「135」との違い）**:
  本文書の初版は、①②③（HTMLノード基準の28）と④（ID基準の21）を誤って
  合算し、単位不整合の「49」「135」を一時的に導出していた（その後「単位の
  異なる値は合算しない」方針に訂正し、暫定の48・136とした）。**今回確定した
  49・135は、それとは全く別の経路（④自体の集計ミスの訂正、単位はすべて
  ID基準で一貫）から導出された、独立に正しい値である**。数字が同じに見える
  ため、§13監査文書でも同様の注記を行っている
- ①②はPhase 3（PR #35 G1、PR #37 G5、PR #38 G6等）で該当箇所のnull-guardが
  完了済みであるため、**script.js側の追加変更なしに、これらのDOM要素をHTMLから
  物理的に除去しても`init()`が例外なく完走する見込みが高い**`[事実に基づく評価、
  実HTML上での検証は未実施のため未検証]`
- ④は開く関数自体（`openProjectInfoModal()`・`openGroupPicker()`・
  `openSetNameModal()`の全呼び出し元）が`assertEditorMode()`をDOM参照より前に
  呼んでいるため除去可能であることを、§13監査文書が3群以外の網羅監査と
  合わせて確定させた（DOM調査文書13節の未確認事項は解消済み）

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
| DOM削減効果 | 無し（184件常時全部） | 高い（viewer.htmlは2節のID基準49件・確定を除いたCommon135件・確定相当。加えてid無しコンテナ1件も併せて除去） | 案2と同等（viewer.html側）。editor.html側はViewer専用要素が現状0件のため追加削減はほぼ無い | 案2/3と同じ削減結果を、生成元テンプレートから機械的に達成 |
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

1. Phase 3完了により、2節の①②（CSSベース、ID基準27件、確定値。HTMLノード基準では
   ③を加えた28件）はscript.js側の追加変更が不要な状態まで既にnull-guard対応済みであり、
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

- `viewer.html`は184件（ID基準）中、2節の①＋②＋④＝27＋22＝**49件（確定）**
  を除いた**135件（確定）のCommon要素**を中心に含む。加えて、
  ③（id無しコンテナ`floormap-info-actions`本体、184の外側の別集計単位）も
  併せて物理的に除去する
- `app-mode-toggle-btn`自体は`viewer.html`に含めない設計とする。これにより
  `viewer.html`は**通常のUI操作導線としてはEditorへの切替手段を持たない**
  ページになる`[提案]`。ただし、これは通常のUI上の導線を設けないという設計
  判断であり、`appMode`自体はセッション内のJS変数に過ぎず認証・権限境界では
  ないため（0節参照）、ブラウザの開発者コンソール等から`appMode`相当の状態を
  操作することまで防ぐものではない。**「Editorへの到達経路が一切存在しない」
  という無条件の断定はしない**。起動時は常にViewerモードとして扱われる、
  という限定的な意味で理解する
- Editorとして編集したい利用者は、既存の`/`（`index.html`、必要なら
  `?mode=editor`）を使う、という役割分担にする
- ④（関数レベルガード22件、`project-info-modal`/`set-name-modal`/`group-picker`）は、
  `docs/ViewerEditor_Phase2_Section13_Audit.md`により13節相当の網羅確認が
  完了し、除去可であることが確定した（同文書9.1節参照）

### 4.4 既存テストへの影響

- 既存の`tests/e2e/`配下114件は、対象URLがすべて`index.html`（`/`）であるため、
  **無変更のまま維持できる見込み**（`index.html`自体は変更しないため）
- テストは2段階に分けて追加する（6節のPR分割案と対応させる）`[提案]`:
  - **最低限の起動・主要表示テスト**（`viewer.html`追加PRに同梱、6節PR-B）:
    1. `viewer.html`で`init()`が例外なく完走すること（ID基準49件＋id無し
       コンテナ1件が存在しない条件でのcanary確認、Phase 3の各テストファイルと
       同じ手法を流用できる）
    2. 主要なCommon機能の代表例（シーン表示、FloorMapマーカー表示）が
       `viewer.html`上で最低限動作すること
  - **詳細回帰テスト**（別ファイル・別PR、6節PR-C。範囲は以下）:
    3. Common機能全般（分割/スライダー比較、VR開始/終了、視点操作、FloorMap
       マーカークリック選択等）が`viewer.html`上で従来どおり動作すること
    4. `app-mode-toggle-btn`を含めない設計により、通常のUI操作からはEditorへの
       切替導線が無いことの確認（意図した設計であることの回帰確認。0節・4.3節の
       とおり、これは認証・権限境界の検証ではなく、通常UI導線の不在を確認する
       テストである）
    5. Viewer Preview関連のUI（`viewer-preview-btn`等、Editor専用のためそもそも
       存在しない）が無いことの確認
- `tests/server.js`（静的ファイルサーバー）は汎用配信のため無変更で
  `/viewer.html`も配信できる見込み（Entry調査文書2.6節の既存事実を踏襲）

### 4.5 段階的移行手順

1. `docs/`配下の本設計比較文書に基づき、まず4節の設計（特に4.3節の
   `app-mode-toggle-btn`除外方針）についてユーザー承認を得る
2. `viewer.html`を新規追加する。`index.html`から2節のID基準49件（確定）＋
   id無しコンテナ1件を取り除いたコピーとして作成し、`script.js`/`style.css`の
   読み込みタグは`index.html`と同一にする。同じPRに4.4節の「最低限の起動・
   主要表示テスト」を同梱する（6節PR-B）
3. `viewer.html`単体で`init()`が例外なく完走することをローカルで確認する
   （ブラウザ実機・Playwrightいずれか、fail-first-then-fixの手法で実施）
4. 4.4節の「詳細回帰テスト」を別PRとして追加し（6節PR-C）、既存114件と
   合わせて全件成功することを確認する
5. `docs/ViewerEditor_Phase2_Section13_Audit.md`によりDOM調査文書13節の
   未確認事項は解消済みである旨をPR本文に明記する。④（関数レベルガード22件）
   の除去可否は確定済みのため、この点についてPR本文で改めて留保する必要は
   ない
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
   （script.js:3107, 3111, 3115）**: 依然として無guardのままであり、**本文書は
   これを対応済みとは記載しない**。1節で述べたとおり、4.3節の設計（`viewer.html`に
   `app-mode-toggle-btn`という通常のUI上のEditor切替導線を設けない）を採用した
   場合、`viewer.html`は起動時からViewerモードのまま扱われ、通常操作からは
   `performUndo()`/`performRedo()`経由で`applySceneFlip()`が呼ばれる経路には
   到達しにくいという設計上の観察はできる。**しかし、`appMode`はセッション内の
   JS変数でありセキュリティ境界ではないため（0節）、この観察は「Editorへの
   到達経路が一切存在しない」という無条件の保証を意味しない**。開発者コンソール等
   からの状態操作や、将来`viewer.html`に何らかのEditor導線が追加された場合には
   前提が崩れる。この観察はあくまで設計上の参考情報であり、実機・Playwrightでの
   検証は行っていない`[未検証]`。参照そのものへのnull-guard追加は本文書の
   スコープ外であり、**未対応のまま残る**
2. **（解消済み）DOM調査文書13節の未確認事項（他モーダルの関数レベルガード
   網羅確認）**: `docs/ViewerEditor_Phase2_Section13_Audit.md`により解消済み。
   `project-info-modal`/`set-name-modal`/`group-picker`以外に同種パターンを
   持つ静的ID群は見つからず、`project-info-modal`群の集計に1件の数え落とし
   （9→10）があったことが判明した。2節の④（関数レベルガード22件）を
   `viewer.html`から除去する判断は確定済みである。なお、動的生成される
   マーカー右クリックメニュー（`.mk-ctx-menu`）に同種の関数レベルガードが
   1件見つかったが、静的IDを持たないためこの節の対象（ID基準の集計）には
   影響しない（同監査文書6.1節参照）

---

## 6. 実装PRの最小分割案 `[提案]`

推奨案（案2）を実際に実装する場合の最小分割案を示す。いずれも本文書では
実装していない。

1. **（完了）PR-A**: DOM調査文書13節の未確認事項の解消（他モーダルの関数
   レベルガードの網羅調査、docs-only）。`docs/ViewerEditor_Phase2_Section13_Audit.md`
   として実施済み。2節の④は21件から22件（確定）へ訂正された
2. **PR-B**: `viewer.html`静的ファイルの新規追加（2節のID基準49件・確定＋
   id無しコンテナ1件を除いたコピー、`script.js`/`style.css`読み込みは
   `index.html`と同一）**に加え、4.4節の「最低限の起動・主要表示テスト」
   （`init()`完走のcanary確認＋主要Common機能の代表例の動作確認）を同一PRに
   含める**
3. **PR-C**: `viewer.html`向けの「詳細回帰テスト」を追加する別PR（4.4節の
   詳細回帰テスト範囲: Common機能全般の網羅的な動作確認、Editor切替導線が
   無いことの確認、Viewer Preview関連UIが無いことの確認）。既存`index.html`
   向け114件は無変更のまま維持する
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
  HTMLノード基準28件・13節の未確認事項の出典）
- `docs/ViewerEditor_Phase2_Section13_Audit.md`（13節の未確認事項の解消。
  ID基準49件・135件の確定値の出典）
- `docs/ViewerEditor_Phase3_Implementation_Plan.md` / 各G1〜G6実装PR（Phase 3、
  ①②③の除去候補が安全になった根拠）
- `01_Projects/ArchView360/03_Decisions.md`（Obsidian Vault側、Phase 1〜3の
  既存設計判断）
