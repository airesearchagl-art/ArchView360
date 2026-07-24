# Viewer / Editor 別URL・別エントリーポイント分離 設計調査（v2.22.0時点）

このドキュメントは調査専用であり、実装は含まない。`script.js` / `index.html` /
`style.css` / `package.json` / ワークフロー / 既存テスト / `obsidian-vault` は
一切変更していない。

- 調査時点のmain HEAD: `ce74c1732ff533979480ce8a74c9b20a0728a76e`（PR #27 merge commit）
- `appVersion`: `2.22.0`（変更なし）
- 調査時点のPlaywright: `npx playwright test --list` で85件（既存71件＋Viewer Preview 14件）を確認。実行はしていない（コード変更を伴わない調査のため）
- 前提: Viewer Preview Phase 1（PR #26調査・PR #27実装、merge済み）の実装内容を前提知識として参照する
- 本文書はPR #28の初版（commit `d8a0ae2`、「docs: investigate viewer and editor entrypoints」）に対する要件明確化の改訂版であり、Phase 1の位置づけ・URL契約・初期化順序・セキュリティ上の限界を追加で明文化したもの

以下、各項目は次の3種類を明示的に分けて記載する。見出し・箇条書きの末尾に
`[事実]` / `[提案]` / `[未検証]` を付す。

- `[事実]` — 実際のコード・行番号を確認した上での記述。
- `[提案]` — 本調査で考案した設計案・仕様案。まだ確定していない。
- `[未検証]` — 本調査の範囲では確認していない・検証していない事項。実装着手時に
  改めて確認が必要なもの。

---

## 1. 調査対象と確認commit `[事実]`

- 対象repo: `airesearchagl-art/ArchView360`
- 確認commit（main HEAD）: `ce74c1732ff533979480ce8a74c9b20a0728a76e`
- 確認したファイル: `index.html`（658行）、`script.js`（7279行）、`style.css`（2770行）、
  `playwright.config.js`、`tests/server.js`、`.github/workflows/playwright.yml`、
  `package.json`、`vercel.json`、`docs/`配下の静的マニュアルページ一式
  （`docs/index.html`・`docs/manual.js`ほか）
- 本調査では上記ファイルの**内容確認のみ**を行い、一切変更していない

---

## 2. 現状の事実

### 2.1 単一HTML・単一JSという配布構成

- `index.html`は単一ファイルで、`<script src="script.js?v=20260720c" defer></script>`
  として`script.js`を1箇所のみ読み込む（index.html:657）`[事実]`
- `script.js`はクラシックスクリプト（`type="module"`ではない）であり、
  ほぼ全体（DOM参照取得・イベント登録・Viewer/Editor/VR全ロジック）が単一の
  `function init()`（script.js:122〜7265、`} // end init()`まで約7100行）の
  内部に定義されている`[事実]`
- three.jsのみ例外的にESMモジュールとして`vendor/three-global.js`
  （`<script type="module" src="vendor/three-global.js">`、index.html:474）経由で
  読み込まれ、`window.THREE`へグローバル公開するシムを介して非モジュールの
  `script.js`から参照される`[事実]`
- `init()`は`waitForThree(retries)`（script.js:7268〜7279）というポーリングで
  `THREE`が定義されるのを待ってから1回だけ呼ばれる。DOMContentLoaded等の
  イベントリスナーは使っていない（`<script defer>`により、パース完了後に
  実行される前提）`[事実]`

### 2.2 `appMode`の起動時初期値とURL依存の有無

- `let appMode = 'viewer';`（script.js:656）としてハードコードされており、
  URLクエリパラメータ・URLハッシュ・`localStorage`のいずれからも初期値を
  読み取っていない。`script.js`全体で`window.location`（`location.search`
  `location.hash`含む）を参照している箇所は0件（`grep -n "location\."`実測）
  `[事実]`
- つまり現状、「起動時にどちらのモードで開始するか」を外部から制御する仕組みは
  一切存在せず、**既存のデフォルト起動モードは`'viewer'`である**（これ以外の
  値は無い）`[事実]`。これは裏を返せば、**URL起点でモードを決定する設計を
  新規に追加しても、パラメータなし時に`'viewer'`を維持する限り、後方互換性を
  壊す既存の挙動が無い**ことを意味する`[事実に基づく評価]`

### 2.3 Editor専用UIの実装形態（`.editor-only`）

- `.editor-only`クラスは`index.html`内に20要素付与されている（`grep -c`実測、
  Viewer Preview Phase 1の2ボタン含む）`[事実]`
- CSSルールは`.mode-viewer .editor-only { display: none !important; }`
  （style.css:155）の1行のみ`[事実]`
- **重要な事実**: `.editor-only`要素は`toolbar-single`・`toolbar-compare`・
  `floormap-navigator`など**共通コンテナの内部に個々のボタン単位で散在**して
  おり、「Editor専用の連続したブロックを1つ削除すればよい」形にはなっていない
  （例: `add-img-btn`・`update-scene-btn`・`undo-btn`・`redo-btn`・`flip-btn`は
  いずれも`toolbar-single`直下で、Viewerでも表示される他のボタン
  （`autorotate-btn`・`fullscreen-btn`等）と隣接して並んでいる）`[事実]`
- `viewer-only`というCSSルール（style.css:156）も存在するが、`index.html`・
  `script.js`のどちらにも実際にこのクラスを付与している要素は0件
  （PR #26投資調査時点から変化なし）`[事実]`

### 2.4 JSコード側のDOM依存（null-guardの有無）

- `init()`冒頭で`const xxx = $('some-id');`という形のDOM参照取得が
  153件ある（`grep -c "= \$('"`実測）`[事実]`
- これらのうち、後続の利用箇所で`if (xxx) xxx.addEventListener(...)`のように
  **null-guardされているのは21件のみ**（`grep -c`実測、概数）で、残りの
  大半（`addImgBtn.addEventListener(...)`・`exportJsonBtn.addEventListener(...)`・
  `flipBtn.classList.toggle(...)`等）は**要素が存在すること前提で無条件に
  呼び出している**`[事実]`
- 具体例（script.js内、行番号は現時点のもの）:
  - `addImgBtn.addEventListener('click', ...)`（script.js:3426、`.editor-only`要素）
  - `updateSceneBtn.addEventListener('click', ...)`（script.js:3428、同上）
  - `flipBtn.addEventListener('click', toggleFlipSingle)`（script.js:3476、同上）
  - `exportJsonBtn.addEventListener('click', exportProjectJSON)`（script.js:7252、同上）
  - `importJsonBtn.addEventListener('click', openImportJSON)`（script.js:7253、同上）
- **この事実の意味**: 現状の`script.js`は「`.editor-only`要素も含めた
  DOM全体が常に存在する」ことを前提に書かれている。もし`.editor-only`要素を
  `index.html`から物理的に取り除いた縮小版HTML（例: 後述の`viewer.html`）を
  今の`script.js`にそのまま読み込ませると、該当行で`Cannot read properties of
  null`が発生し、**`init()`が最後まで実行できずアプリ全体が起動しない**
  可能性が高い（実機検証は行っていないため`[未検証]`の要素を含むが、
  コード上の無条件アクセスパターンは`[事実]`として確認済み）
- **計測時点の明記**: 上記「153件」「null-guard 21件」はいずれも**PR #28
  調査時点（本文書の初版commit `d8a0ae2`）での`grep`による計測値**であり、
  以降`script.js`に変更が入った場合は再計測が必要になる`[事実（計測条件の明記）]`

### 2.5 mutation guardの一元性（Viewer Preview Phase 1で確認済みの事実の再確認）

- `assertEditorMode(label)`（script.js:673）36件、`canMutateProject()`
  （script.js:664）20件、合計約54〜56件の呼び出し（Viewer Preview追加分を含め
  微増、PR #26調査時点の「約54箇所」から大きな変化なし）`[事実]`
- いずれも`appMode`の値のみを見て判定し、呼び出し元がどの画面・どのURLから
  来たかを区別しない。この一元性は、別エントリーポイント化においても
  「Editor機能を無効化する」ための仕組みとして**そのまま再利用できる**
  `[事実]`

### 2.6 静的配布・デプロイ構成

- `vercel.json`はパスベースのルール（`/style.css`・`/script.js`・
  `/vendor/three.module.min.js`に対する`Cache-Control: immutable`、
  `/(.*)`に対する共通セキュリティヘッダー）のみで、ビルドコマンド・
  リライト・リダイレクトの設定は無い`[事実]`
- README.md（349行・526行・533行）によれば、VercelとGitHub Pagesの両方への
  デプロイ手順が記載されており、いずれも「リポジトリの静的ファイルをそのまま
  配信する」形態（ビルドステップ無し）`[事実]`
- `tests/server.js`（Playwright用ローカルサーバー）もリポジトリルートを
  そのまま配信する汎用静的ファイルサーバーであり、パスに応じた特別な
  ルーティング設定は持たない。**新しい静的HTMLファイルを追加しても、
  このサーバー・CI・デプロイ設定のいずれも変更なしでそのまま配信できる**
  `[事実]`

### 2.7 既存の「共通bootstrap + 複数HTML」の precedent

- `docs/`配下に、`docs/index.html`・`docs/getting-started.html`・
  `docs/security.html`など**11個の独立した静的HTMLページ**が既に存在し、
  いずれも`<script src="/docs/manual.js"></script>`という共通スクリプトを
  読み込んだ上で、`<script>ArchViewManual.renderManualChrome('security');</script>`
  のように**ページ固有の識別子を1引数だけ渡す**形でヘッダー/ナビゲーションの
  共通部分を描画している（`docs/manual.js:17`の`renderManualChrome(activeId)`）
  `[事実]`
- これは「共通bootstrap（共有JS）＋エントリーごとの個別HTML＋1個の識別
  パラメータ」という構成が、このリポジトリに**実際に採用され、動作している
  precedentとして既に存在する**ことを意味する`[事実]`。ただし`docs/manual.js`は
  静的なマニュアル文書の見た目を描画するだけの軽量スクリプトであり、
  `script.js`（7279行、Three.js・状態管理・mutation guardを含む）とは
  規模・複雑さが大きく異なる点には注意が必要`[事実（比較の限界の指摘）]`

---

## 3. 現在の起動・初期化フロー `[事実]`

1. ブラウザが`index.html`を取得・パースする。`<head>`で`style.css`を、
   `<body>`末尾で`vendor/three-global.js`（ESMモジュール、非同期）と
   `vendor/jszip.min.js`（クラシック、同期）、`script.js`（クラシック、`defer`）を
   読み込む（index.html:474-476, 657）。
2. `script.js`はHTMLパース完了後（`defer`により）に実行される。まず
   `class HistoryManager`の定義（script.js:39-118）と`window.HistoryManager`
   への公開が走る（DOM/THREE非依存、テスト専用公開）。
3. 即座に`waitForThree(50)`（script.js:7268）が呼ばれ、`typeof THREE !==
   'undefined'`になるまで100msごとに最大50回（=最大5秒）リトライする。
4. `THREE`が利用可能になった時点で`init()`が1回だけ呼ばれる。
5. `init()`内部で、まず153件のDOM参照取得（`$('id')`）が行われ、続けて
   Viewer・Editor・VR・Compare・FloorMap・Import/Export・Undo/Redo・
   Viewer Preview等、**モードに関わらず全機能のイベントリスナー登録が
   無条件に実行される**（Editor専用ボタンへの`addEventListener`も含む、
   2.4節参照）。
6. `init()`の最後（script.js:2765付近）で`renderModeUi();`が1回呼ばれ、
   `appMode`の初期値`'viewer'`に応じたCSS/ラベルがDOMへ反映される。
7. ここまでの一連の流れに、モードによる分岐（「Editorの時だけこの
   リスナー群を登録する」等）は一切存在しない`[事実]`。分岐が発生するのは
   実行時（ボタンクリック等のイベントハンドラ内で`assertEditorMode()`/
   `canMutateProject()`を呼んだ時点）のみである。

**10節で述べる初期化順序の要件は、この現状フローの5〜6の間（DOM参照取得の
直後・イベントリスナー登録より前）にURL解析を割り込ませる、という前提に
基づく。**

---

## 4. UIと責務の分類 `[事実＋提案]`

### 4.1 分類テーブル（`[事実]`：現状の実装に基づく）

| 分類 | 内容 | 現状の実装形態 |
|---|---|---|
| Common（共通） | シーン表示・切替、比較モード閲覧、VR開始/終了、視点操作、自動回転、FloorMapのマーカークリック選択・移動先閲覧、ヘッダーのロゴ・マニュアル/セキュリティリンク | `appMode`によるガード無し。Viewer/Editorどちらでも同一コードが動く（PR #26調査2.1節で確認済み） |
| Editor専用 | シーン追加/削除/並び替え/画像更新、左右反転、グループ操作、比較セット保存/削除/名変更、平面図追加/削除/方位補正、マーカー番号変更/整理/並び替え/配置/回転/削除、プロジェクト情報編集、JSON/ZIP書き出し・読み込み、Undo/Redo | `.editor-only`クラス（CSS表示制御）＋`assertEditorMode()`/`canMutateProject()`（JS実行制御）の二重ガード |
| Viewer専用 | （現状該当なし） | `viewer-only`クラスは定義されているが実際に使われている要素は0件（2.3節） |
| Mode-dependent（切替そのもの） | `app-mode-toggle-btn`のクリックハンドラ、Viewer Preview開始/終了ボタン | `appMode`/`previewActive`の値を見て分岐 |

### 4.2 Viewer Entry分離を見据えた責務の再分類（`[提案]`）

別エントリーポイント化を検討する上では、上記の「Editor専用」をさらに
2つの観点で見る必要がある：

- **JSロジックとして実行しなくてよいもの**: Editor専用の関数定義・
  イベントリスナー登録そのもの（`exportProjectJSON`・`historyManager`関連・
  FloorMapの編集系ハンドラ等）。これらはViewer専用ページでは
  **読み込む必要すら無い**候補
- **DOM要素として存在しなくてよいもの**: `.editor-only`が付与された
  20個のHTML要素そのもの。これらはViewer専用ページでは**マークアップ自体を
  含めない**候補

現状はこの2つが分離されておらず、「JSは全部読み込むがDOM要素だけ無い」
「DOM要素はあるがJSだけ無い」のどちらの組み合わせで作っても、2.4節の
無条件DOM参照が原因で破綻する。**別エントリーポイント化は、この2つの
分離を同時に・整合的に行う設計判断を必要とする**`[提案]`。

**この4.2節で述べる「別エントリーポイント化」は、6節で定義するPhase 1
（URL指定による起動モード分離）には含まれず、8節のPhase 3（真の
エントリーポイント分離）の対象である。**

---

## 5. 方式比較

### 案1: 同一HTML＋URLパラメータ（例: `?mode=viewer` / `?mode=editor`）

- 概要: `index.html`を1つのまま維持し、起動時に`URLSearchParams`を読んで
  初期`appMode`を決定する。DOM要素・JSロジックはすべて現状通り単一ファイルに
  同居させたまま
- 重複: **無い**（HTML/JSともに1ファイルのまま）
- 移行コスト: **最小**。`let appMode = 'viewer';`の初期化部分に
  URLパラメータ読み取りを1箇所追加するのみ（`[提案]`、未実装）。2.4節の
  無条件DOM参照の問題も発生しない（DOM要素は常に全部存在するため）
- テスト容易性: 高い。既存の`tests/server.js`・Playwright設定を変更せず、
  `page.goto('/?mode=editor')`のようなURLだけ変えたテストを追加できる
- 静的配布との相性: 良好。追加の静的ファイルもルーティング設定も不要
- 既存URL互換性: 完全互換（2.2節の事実どおり、既存はURL依存が無いため
  パラメータ無し時＝現状の`'viewer'`初期値を維持すればよい）
- ViewerからEditorへの遷移: 既存の`requestEditorAccess()`（画面内切替）と
  併存できる。URLパラメータは「初期表示モード」のみを決め、切替自体は
  既存の仕組みのまま
- Viewer Previewとの共通化: 高い。Viewer Previewは既に「同一ページ内で
  `appMode`を一時的に切り替える」実装のため、設計思想がそのまま連続する
- **弱点**: 「別URL」ではあるが「別エントリーポイント（別HTML/別配布物）」
  ではない。Editor専用のJS/DOMを配布物から除去する効果は無く、
  「Viewerだけを軽量に配布したい」という将来的な動機には応えられない

### 案2: `viewer.html` / `editor.html`の別HTML

- 概要: `index.html`とは別に、Viewer専用マークアップのみを持つ
  `viewer.html`と、Editor機能を含む`editor.html`（または既存`index.html`を
  Editor用として維持）を新設する
- 重複: **高い**。共通ヘッダー・共通CSS読み込み・共通の`<input type="file">`
  要素などをどちらのHTMLにも書く必要があり、変更のたびに二重メンテナンスの
  リスクが生じる（`docs/`配下の11ページがまさにこの重複を抱えている
  precedent、2.7節）
- 移行コスト: **高い**。2.4節の事実（153件のDOM参照のうち大半が
  null-guard無し）により、`viewer.html`側のマークアップから`.editor-only`
  要素を本当に除去するなら、それらを参照する`script.js`側の全呼び出し箇所に
  null-guardを追加する対応が同時に必要になる。これは「大規模リファクタ」に
  該当する規模になり得る`[事実に基づく評価]`
- テスト容易性: 中。Playwright側で2つのURLに対するテストスイートを
  分ける必要があり、既存の1本のテストスイートを`viewer.html`向け/
  `editor.html`向けに再編する設計判断が必要になる
- 静的配布との相性: 良好（2.6節のとおり、静的ファイルを追加するだけで
  配信自体は可能）。ただし`vercel.json`のCache-Control個別ルール
  （現状`style.css`/`script.js`/`vendor/three.module.min.js`のみ指定）に
  新規ファイルを追加するかどうかの判断が必要になる
- 既存URL互換性: `index.html`（＝`/`）の意味をどちらに割り当てるかで
  互換性が変わる。「`/`は今まで通りEditor機能込みの全部入り」を維持しつつ
  `/viewer.html`を新設するなら後方互換、「`/`をViewer専用に変える」なら
  既存ブックマーク等の意味が変わる非互換な変更になる
- ViewerからEditorへの遷移: 別ページ遷移（`location.href`等）が必要になる。
  現状の`compareState`・`currentIdx`・`historyManager`はすべて`init()`内の
  ローカル変数（クロージャ）であり、ページ遷移すればJSの実行コンテキスト
  ごと失われる。Viewer Preview Phase 1が前提にしていた「同一ページ内・
  同一変数を共有」という前提（7節）が**成立しなくなる**ため、プロジェクト
  状態を何らかの形でページ間に引き継ぐ手段（`sessionStorage`・
  `postMessage`・URLへのシリアライズ等）が新たに必要になる
  `[事実に基づく評価]`
- Viewer Previewとの共通化: **低い**。Viewer Previewが依拠する
  「同一`appMode`変数・同一ページ」という前提と、この案の「別ページ」という
  前提は構造的に相容れない。共通化するなら、Viewer Preview自体を
  「Editorページ内で`viewer.html`を`iframe`表示する」等の別実装に
  作り替える必要が生じる可能性がある`[提案]`

### 案3: 共通bootstrap＋entry script分離

- 概要: `script.js`本体（Three.js初期化・シーン管理・Common機能）は
  共有ファイルのまま維持し、Editor専用ロジック（Undo/Redo・Import/Export・
  平面図編集等）を`editor-entry.js`のような別ファイルに切り出す。両方の
  HTML（`viewer.html`/`index.html`）が共通の`script.js`を読み込み、
  `index.html`だけが追加で`editor-entry.js`を読み込む。2.7節の
  `docs/manual.js`パターンと同型の構成
- 重複: 中程度。HTML側の共通マークアップ（ヘッダー・トグルボタン等）の
  重複は案2と同様に残るが、**JS側の重複は避けられる**（Editor専用ロジックは
  1ファイルにのみ存在する）
- 移行コスト: 高い。現状`init()`は単一関数であり、Editor専用の関数群
  （`exportProjectJSON`・`historyManager`まわり・平面図編集ハンドラ等）は
  Common機能の関数（`switchToScene`・`compareState`操作等）と**同じ
  クロージャ・同じ変数スコープを共有している**（例:
  `performUndo()`/`performRedo()`は`canMutateProject()`と同じ`init()`内の
  ローカル関数）。ファイル分割にはこれらの変数共有をモジュール間の
  明示的な受け渡し（`window`公開、または引数渡し）に置き換える設計変更が
  必要で、機械的なコピー&ペーストでは完了しない`[事実に基づく評価]`
- テスト容易性: 中。ファイルが2つに分かれても実行時のDOM/振る舞いは
  1ページ内で完結するため、既存のPlaywrightテストの構造（1ページに対する
  操作シーケンス）自体は概ね維持できる可能性がある`[提案、未検証]`
- 静的配布との相性: 良好（追加の静的JSファイルを配信するだけ）
- 既存URL互換性: 案2と同様の判断が必要（`/`の意味をどうするか）
- ViewerからEditorへの遷移: 案2と同じ「別ページ問題」を抱える
  （プロジェクト状態の引き継ぎ手段が別途必要）
- Viewer Previewとの共通化: 案2と同様に低いが、`script.js`本体
  （Common機能＋`appMode`関連）は引き続き共有されるため、案2よりは
  多少共通化しやすい`[提案]`

### 案4: build stepを伴うentrypoint分離（bundler導入）

- 概要: Vite/esbuild等のバンドラーを導入し、`viewer`/`editor`それぞれの
  entry pointから必要なモジュールだけをバンドルする
- 重複: 低い（バンドラーのtree-shaking/code-splittingに委ねられる）
- 移行コスト: **最も高い**。現状「ビルドステップの無い静的サイト」
  （2.6節、README.mdでも明記）という前提そのものを変更することになり、
  `package.json`へのビルド依存追加、`.github/workflows/playwright.yml`への
  ビルドステップ追加、Vercel/GitHub Pagesのデプロイ設定変更、
  `tests/server.js`（現状ビルド成果物を想定していない）の作り直しが
  必要になる。これらは本調査の禁止事項（大規模リファクタ・
  `package.json`/ワークフロー変更）に抵触する規模であり、**Phase 1は
  おろか、単独のフェーズとして着手するだけでも本調査の枠を超える**
  `[事実に基づく評価]`
- テスト容易性: バンドル成果物に対するテストとなり、既存のPlaywright
  テストが「ソースファイルをそのまま配信する」前提（`tests/server.js`が
  リポジトリルートをそのまま配信、2.6節）から外れるため、テスト基盤自体の
  作り直しが必要
- 静的配布との相性: 悪い方向への変化。「配布はビルド成果物のみ」という
  運用に変わり、現状の「リポジトリのソースファイルがそのまま配布物」
  というシンプルな前提が崩れる
- 既存URL互換性・ViewerからEditorへの遷移・Viewer Previewとの共通化:
  案2/案3と同様の課題に加え、バンドル境界をどう引くかという追加の設計
  判断が必要になる

### 比較まとめ表

| 観点 | 案1 URLパラメータ | 案2 別HTML | 案3 共通bootstrap+entry分離 | 案4 build step |
|---|---|---|---|---|
| 重複 | 無し | 高い | 中（JS重複は回避） | 低い |
| 移行コスト | 最小 | 高い | 高い | 最も高い |
| テスト容易性 | 高い | 中 | 中 | 低い（基盤作り直し） |
| 静的配布との相性 | 最良 | 良好 | 良好 | 悪化（ビルド成果物配布に変わる） |
| 既存URL互換性 | 完全互換 | `/`の再定義が必要 | `/`の再定義が必要 | 同左＋ビルド境界の判断 |
| Viewer→Editor遷移 | 既存のまま（画面内） | 別ページ遷移＋状態引き継ぎが新規必要 | 同左 | 同左 |
| Viewer Previewとの共通化 | 高い | 低い | 中程度 | 低い |
| 本調査の禁止事項との抵触 | 無し | 無し（ただし規模大） | 無し（ただし規模大） | **抵触リスクが高い**（package.json/workflow変更が前提になりやすい） |

---

## 6. 推奨方式 `[提案]`

### 6.1 Phase 1の名称と位置づけ（本調査での正式な定義）

**本調査における「Phase 1」は、「URL指定による起動モード分離」を指す。**
具体的には、案1（同一HTML＋URLパラメータ）をベースに、起動時のURL
クエリパラメータで初期`appMode`を決定できるようにする変更のみを指す。

**Phase 1には、以下は一切含まれない**（誤解を避けるため明記する）:

- `viewer.html`/`editor.html`のような**別HTMLファイルの新設**（案2）
- `editor-entry.js`のような**別entry scriptファイルの新設**（案3）
- バンドラー導入によるビルド境界の分離（案4）
- Editor専用コード・DOMの物理的な配布分離

これら「実エントリーポイント分離」（別HTML/別entry scriptによる分離）は、
**Phase 1には含まれない後続フェーズ**として、8節のPhase 3に位置づける。
Phase 1は`index.html`・`script.js`が単一ファイルのままであることを前提と
した、あくまで「起動時にどちらのモードで始まるかをURLで指定できるようにする」
という限定的な変更である`[提案・確定]`。

### 6.2 推奨理由

1. 2.2節の事実（現状`appMode`はURLに一切依存しておらず、既存の互換性を
   壊すリスクが無い）と、2.4節の事実（`script.js`が153件のDOM参照の大半を
   null-guard無しで前提にしている）を踏まえると、案2・案3のような
   「DOM/JSの物理分離」は、それ自体が2.4節の無条件DOM参照という
   **既存の技術的負債**への大規模な対処（null-guard追加、または
   モジュール分割のための変数共有の作り替え）を前提条件として要求する。
   これは本調査の禁止事項である「大規模リファクタ」に該当する可能性が
   高く、単独のPhase 1としては着手できない
2. Viewer Preview Phase 1（既存実装）は「同一ページ・同一`appMode`変数」
   という前提の上に成立しており、6.1節で定義したPhase 1（URL指定による
   起動モード分離）はこの前提と完全に整合する（7節で詳述）。案2・案3は
   「別ページ」という前提でViewer Previewとの共通化を弱める
3. Phase 1は「別URL」という当初の課題設定（Vault側の記述にある
   「Viewer/Editorの別URL・別エントリーポイント分離」）の**一部
   （別URL）を満たしつつ**、「別エントリーポイント（別HTML/別JSバンドル）」
   というより踏み込んだ目標は、Phase 1を土台にした後続フェーズ（8節の
   Phase 3）で引き続き検討できる

ただし、**Phase 1は「別URLで開ける」ことは実現するが、「Editor専用コードを
配布物から除去する」という将来的な動機には応えられない**、という限界を
明記しておく`[提案・限界の明示]`。この限界を解消したい場合は、2.4節の
DOM参照の分類・必要箇所へのnull-guard化（8節のPhase 2）を済ませた上で、
案2または案3へ段階的に移行する、という順序が現実的だと考える`[提案]`。

---

## 7. Viewer Previewとの関係／Viewer URL起動との責務分離 `[事実＋提案]`

### 7.1 既存のViewer Preview実装との整合性（事実の再確認）

- Viewer Preview Phase 1（既存実装、script.js:751-786）は、`appMode`を
  実際に`'viewer'`へ切り替えつつ、`previewActive`という別フラグで
  「Editorから来たか」を判別する設計であり、**同一ページ内でのモード
  切替**を前提にしている（`enterViewerMode()`/`enterEditorMode()`は
  ページ遷移を一切伴わない、script.js:680-696）`[事実]`
- Phase 1（URL指定による起動モード分離）を採用した場合、Viewer Previewの
  実装は**無変更のまま両立できる**: URLパラメータは「初期表示モード」だけを
  決定し、Viewer Preview自体は既存どおり画面内の`appMode`/`previewActive`
  操作として機能し続ける`[提案]`
- 逆に案2（別HTML）を将来的に採用する場合は、Viewer Previewの
  「Editor画面内で一時的にViewerを覗く」という体験を、「別ページを
  新しいタブ/iframeで開く」という形に置き換える設計変更が必要になる
  可能性が高く、その場合はViewer Preview自体の再設計を伴う
  `[提案、未検証]`（ViewerPreview_Investigation.md 8節のPhase 3で
  同様の懸念が既に示唆されている）

### 7.2 Viewer PreviewとViewer URL起動の責務の違い（提案・明確化）

両者は目的も作用範囲も異なる、**独立した別々の関心事**である。

| 項目 | Viewer Preview（既存実装） | Viewer URL起動（Phase 1で新設提案） |
|---|---|---|
| 作用するタイミング | Editorとして起動した**後**、実行時にユーザーが任意のタイミングで開始/終了する | ページの**起動時のみ**、`init()`早期のURL解析時に一度だけappModeの初期値を決める |
| 何を制御するか | 実行中のセッション状態（`previewActive`フラグ）。Editorに留まったまま一時的にViewer表示を覗く | 起動直後の`appMode`の初期値そのもの。実行中のセッション状態には影響しない |
| ページ遷移の有無 | 無し（同一ページ内、`enterViewerMode()`/`enterEditorMode()`のみ） | 無し（URLパラメータは初期値の決定にのみ使われ、その後の画面内切替は既存の`app-mode-toggle-btn`/Viewer Previewのまま） |
| 終了後の状態 | `exitViewerPreview()`で必ずEditorへ戻る（script.js:778-786） | 概念上「終了」は無い。起動後は通常の`appMode`切替（`requestEditorAccess()`/`enterViewerMode()`）と同じ扱いになる |

- **Viewer URL(`?mode=viewer`)で起動した場合**、`.editor-only`により
  Viewer Previewボタン自体が非表示になる（Editorでないため）。つまり
  Viewer URL起動時点ではViewer Previewは関与しない`[提案（現状のガード
  ロジックからの帰結）]`
- **`?mode=editor`で起動した場合**、その後Editorから通常どおりViewer
  Previewを開始することは何ら制限されない。Phase 1はappModeの**初期値**
  だけに関与し、起動後の挙動には一切干渉しないため`[提案]`

### 7.3 Viewer URLからEditorへの遷移: `requestEditorAccess()`の位置づけ

- 現状、Viewer→Editorへの切替はUIの`app-mode-toggle-btn`クリック
  ハンドラが`requestEditorAccess()`を呼ぶ経路が唯一である（script.js:2752）
  `[事実]`
- **提案**: Viewer URL（`?mode=viewer`または未指定）で起動した場合も、
  Editorへの遷移は**この既存の`requestEditorAccess()`経路をそのまま
  使う**。Viewer URL起点だからといって新しい専用の遷移関数を追加する
  必要は無い、という整理をPhase 1の前提とする`[提案]`
- 根拠: `requestEditorAccess()`は「将来の認可チェックを挿入するための
  唯一の入口」として意図的に空実装のまま用意されている（script.js:698-702の
  コメント、既存事実）。Viewer URL起点であってもViewer Preview起点であっても
  「ViewerからEditorへ移る」という操作の意味自体は変わらないため、
  この共通入口をそのまま使うのが自然である`[提案]`
- **本調査の結論**: Phase 1推奨の最大の理由の1つは、Viewer Preview
  Phase 1という**既存の確定済み実装に対して後方互換**であり、Viewer→
  Editorの既存経路（`requestEditorAccess()`）にも一切手を加えず、
  再設計を要求しないことである

---

## 8. 段階的実装案 `[提案]`

### Phase 1: URL指定による起動モード分離（本調査の次のPRで実装候補・最小実装）

6.1節で定義したとおり、別HTML/別entry scriptによる実エントリーポイント
分離を一切含まない、限定的な変更。

- `index.html`起動時に`URLSearchParams`を読み、9節で定義するURL契約に
  従って初期`appMode`を決定する
- URLパラメータは**あくまで初期値の決定にのみ使う**。画面内切替
  （`app-mode-toggle-btn`・Viewer Preview）の既存挙動には一切手を
  入れない
- URLの一部（クエリパラメータ）を新設する変更のみであり、`.editor-only`/
  `viewer-only`のCSS、`assertEditorMode()`/`canMutateProject()`等の
  mutation guard、`renderModeUi()`の実装はいずれも無変更で機能する
  （5節・6節の評価に基づく）
- 完了条件は13節を参照

### Phase 2（Editor専用コードの配布分離、Phase 3への布石）

**「2.4節で確認した153件のDOM参照すべてに一律でnull-guardを追加する」
という方針ではない**。そうではなく、以下の順序で進める:

1. まず153件のDOM参照を「Editor専用」「Viewer専用（現状0件）」
   「共通（Common）」の3種に分類する（4.1節の分類テーブルをコード単位に
   詳細化する棚卸し作業）
2. その分類結果のうち、**実際に将来HTMLから除去する可能性がある
   Editor専用DOM参照にのみ**、null-guardの追加が必要かどうかを判断する
   （Common・Viewer専用のDOM参照は、どちらのエントリーポイントでも
   存在し続ける前提のため、null-guard追加は原則不要）
3. 上記が完了した後、`.editor-only`要素を実際に持たない縮小版HTML
   （`viewer.html`相当）を試作し、既存`script.js`がそのまま動作するかを
   検証する

この順序により、不要な箇所への一律null-guard追加という過剰な作業を避け、
実際に必要な箇所だけに対応を絞り込む`[提案]`。

### Phase 3（真のエントリーポイント分離）

- 6.1節で「Phase 1には含まれない」と明記した、別HTML（案2）または
  共通bootstrap+entry script分離（案3）のどちらを採用するかを、Phase 2の
  検証結果を踏まえて判断する
- ページ間でのプロジェクト状態引き継ぎ手段（`sessionStorage`・
  `postMessage`・URLシリアライズ等）の設計
- Viewer Preview自体の再設計要否の判断（7節）

**Phase 2・3は本調査の範囲外であり、実装着手前に別途調査・判断が必要な
項目として残す。**`[提案]`

---

## 9. URL契約（実装前判断事項） `[提案＋未確定]`

### 9.1 判断が必要な項目一覧

Phase 1の実装着手前に、以下の項目を確定させる必要がある。

- パラメータ名（本調査では`mode`を仮称とする）
- `viewer`/`editor`の正式な値（大文字小文字・別名の有無を含む）
- パラメータなし時に既存の`'viewer'`起動を維持すること
- 不正値・空値・大文字小文字表記ゆれの扱い
- モード切替時（画面内での`app-mode-toggle-btn`操作等）にURLを自動更新するか
- リロード時の挙動（URLから再判定するか、直前のセッション状態を優先するか）
- browser back/forwardの扱い
- Viewer共有URLとして、外部にどこまでの動作を保証するか

### 9.2 推奨初期契約案（本調査の確定提案）

以下をPhase 1の推奨契約として明記する。**これは本調査における確定提案
であり、5節・6節の評価および2.2節の事実（既存デフォルトは`'viewer'`）と
整合させたものである。**

| 項目 | 契約内容 |
|---|---|
| パラメータなし | `'viewer'`（既存デフォルトを維持、後方互換） |
| `?mode=viewer` | `'viewer'` |
| `?mode=editor` | `'editor'` |
| 空値・不正値（`?mode=`、`?mode=foo`等） | `'viewer'`へフォールバック（安全側に倒す） |
| 正式な値の表記 | 小文字のみを正式値とする（`Editor`・`VIEWER`等の表記ゆれは9.1節の不正値と同様に`'viewer'`へフォールバックする案を採る） |
| 画面内モード切替時のURL自動更新 | **行わない**。`app-mode-toggle-btn`やViewer Previewでモードが変わっても、アドレスバーのURLは書き換えない |
| リロード時の挙動 | URLから再判定する（リロード時に`appMode`がセッション内変数としてリセットされる既存の挙動と整合し、その初期値をURLパラメータが決める） |
| browser back/forwardの扱い | Phase 1では明示的なモード遷移の手段として使わない（履歴操作・`popstate`イベントの利用は行わない） |

### 9.3 `?mode=editor`の公開仕様上の扱い（確定と未確定の区別）

- `?mode=editor`という**内部実装としての仕様**（9.2節の契約表どおりに
  `appMode`の初期値を`'editor'`にする）は、本調査における確定提案である
  `[提案・確定]`
- 一方、これを**公開URL（ユーザー向けドキュメント・共有リンクとして
  積極的に案内する仕様）として保証するかどうかは未確定**である
  `[未検証]`。11節のセキュリティ上の限界（`?mode=editor`はいかなる
  権限判定の根拠にもならない）と合わせて、実装着手時に「内部的には
  存在するが、公開ドキュメントには記載しない」という選択肢も含めて
  判断する必要がある

---

## 10. 初期化順序の要件 `[提案]`

Phase 1の実装は、3節で確認した既存の初期化フローに対して、以下の順序
要件を満たす必要がある。

1. `init()`の**早期**（DOM参照取得の直後、Viewer/Editor双方のイベント
   リスナー登録より前）でURLを解析する
2. 初回の`renderModeUi()`呼び出しより**前**に`appMode`の初期値を確定
   させる。9.2節の契約に基づき、URL解析結果を`let appMode = 'viewer';`
   の初期化式（またはその直後）に反映してから、初めて`renderModeUi()`を
   呼ぶ
3. **Viewer URLでEditor UIを一瞬でも表示しない**: 上記の順序を守れば、
   `renderModeUi()`が最初に一度だけ呼ばれた時点で既に正しい`appMode`が
   確定しているため、「まず`'viewer'`で描画されてからJSでEditor表示に
   切り替わる」ようなちらつき（フラッシュ）は発生しない設計にできる
4. **Viewer URLで編集可能な瞬間を作らない**: 3と同じ理由で、
   `assertEditorMode()`/`canMutateProject()`が参照する`appMode`は
   `renderModeUi()`呼び出し前の時点で既に確定済みであるため、
   「一瞬だけEditor扱いになり、その間に何らかの操作が通ってしまう」
   という時間的な隙は生じない

この要件は、既存の`renderModeUi()`（レンダラー・シーン・VRオブジェクトの
再生成を一切行わない、単なるCSS/ラベル反映関数、script.js:713-734）が
初期化中に複数回呼ばれることを想定していない、という既存実装の前提
（`[事実]`、3節）とも整合する。

---

## 11. Viewer Modeのセキュリティ上の限界 `[事実＋提案]`

Phase 1（およびViewer Mode全体）について、以下の限界を明記する。これは
実装の不備ではなく、**現状のApp Mode設計そのものの前提**である。

- **認証境界ではない**: `appMode`はセッション内のJS変数に過ぎず
  （2.2節）、サーバーサイドでの認証・認可を一切伴わない。URLに
  `?mode=viewer`が付いていてもいなくても、クライアント側のJavaScript
  コンソールから`appMode`相当の状態を書き換えることは技術的に可能で
  あり、これを防ぐ設計にはなっていない（既存のViewer/Editor App Mode
  基盤そのものの前提、PR #12設計判断を踏襲）`[事実に基づく評価]`
- **EditorコードやDOMの配布分離ではない**: Phase 1はURLパラメータで
  `appMode`の初期値を変えるだけであり、Editor専用のJSコード・DOM要素は
  引き続き**全ユーザーに配布される**（2.4節・6.1節）。「Viewerとして
  開いた相手にEditorの機能・コードを一切見せない」という効果は
  Phase 1には無い`[提案・限界の明示]`
- **URL値を権限判定として信頼しない**: `?mode=editor`は「初期表示を
  Editorにする」という**利便性のための指定**であり、それ自体を
  「このユーザーはEditor権限を持つ」という権限判定の根拠として
  扱ってはならない。既存の`assertEditorMode()`/`canMutateProject()`は
  あくまで`appMode`の値のみを見ており、URLパラメータの有無やその値を
  直接の権限根拠にするコードを追加してはならない、という制約を
  Phase 1の設計原則として明記する`[提案]`
- **認証・ライセンス・権限は別責務**: `requestEditorAccess()`
  （script.js:703-705）は、将来こうした認証・ライセンス・権限チェックを
  挿入するために意図的に空実装のまま用意されている入口である（既存
  コメント、`[事実]`）。Phase 1のURL契約は、この将来の認可レイヤーとは
  **完全に独立した、別の責務**である。Viewer URL起動もViewer Preview
  終了も、いずれも将来`requestEditorAccess()`に認可ロジックが入れば
  同じように影響を受けることになり、Phase 1がこの将来レイヤーを
  迂回する特別な経路を作ってはならない`[提案]`

---

## 12. Phase 1実装候補（編集するファイル候補と編集しない範囲） `[提案]`

### 編集候補（Phase 1、次の実装PRで想定）

- `script.js`: `let appMode = 'viewer';`（script.js:656）の直前後に、
  `URLSearchParams(window.location.search)`から9.1節のパラメータを読み取り、
  9.2節の契約に従って初期値を決定する処理を追加（数行程度の想定、
  10節の初期化順序要件を満たす位置に配置）
- `tests/e2e/`: 新規スペックファイル1つ（例:
  `tests/e2e/mode-url-param.spec.js`）を追加し、13節の完了条件に対応する
  E2Eテストを実装

### 編集しない範囲（Phase 1時点でも変更しない想定）

- `index.html`のマークアップ自体（DOM構造・`.editor-only`要素の追加/削除
  無し）
- `style.css`（CSSルールの追加/変更無し、既存の`.mode-viewer`/
  `.mode-editor`をそのまま利用）
- `.github/workflows/playwright.yml`・`package.json`・`package-lock.json`
- `vercel.json`（新規ファイルを追加しないため、Cache-Controlルールの
  追加は不要）
- `appMode`の値の集合（`'viewer'|'editor'`の2値を維持、第三の値は
  追加しない）
- Viewer Preview（`previewActive`・`startViewerPreview()`・
  `exitViewerPreview()`）の実装
- `requestEditorAccess()`の実装（7.3節のとおり、既存の空実装のまま
  流用する）

**これらはあくまで次の実装PRに向けた「候補」であり、本PRでは一切
実装していない。**

---

## 13. Phase 1の完了条件 `[提案]`

次の実装PRにおいて、以下すべてを満たした時点でPhase 1完了とする。

1. `?mode=viewer`のURLで直接起動した場合、Viewer Modeで起動すること
2. `?mode=editor`のURLで直接起動した場合、Editor Modeで起動すること
3. パラメータなしのURLで起動した場合、既存どおり`'viewer'`で起動すること
   （後方互換の維持）
4. 不正値・空値のURLで起動した場合、`'viewer'`へ安全にフォールバックする
   こと
5. 10節の初期化順序要件のとおり、初期表示のフラッシュ（Editor UIが一瞬
   表示されてからViewerへ切り替わる、または逆）が発生しないこと
6. 既存のmutation guard（`assertEditorMode()`/`canMutateProject()`、
   2.5節）が無変更のまま機能し続けること
7. Viewer Preview（既存実装）に回帰が無いこと
8. 既存85件のPlaywrightテストが全件成功すること
9. URL起動用の新規E2Eテストが追加され、成功すること（1〜5の各条件に
   対応するテストケースを含む）

---

## 14. テスト計画 `[提案]`

まだ実装しないため、以下は項目の洗い出しのみ。13節の完了条件と対応する。

- `?mode=editor`で起動した場合、`renderModeUi()`適用後に
  `body.classList.contains('mode-editor')`がtrueになることの確認
- `?mode=viewer`で起動した場合、`body.classList.contains('mode-viewer')`が
  trueになることの確認
- パラメータ無しで起動した場合、従来どおり`body.classList.contains
  ('mode-viewer')`がtrueのままであることの確認（既存71件の回帰確認と
  重複する観点だが、URLパラメータ処理追加後も同じ結果になることの
  明示的な確認として別途追加）
- 不正な値（`?mode=foo`・`?mode=`空文字等）を指定した場合、
  `'viewer'`にフォールバックすることの確認
- 大文字小文字・前後空白等の表記ゆれをどこまで許容するかは実装時の
  最終的な文字列比較仕様として実装し、9.2節の契約どおりフォールバック
  することの確認
- Viewer Preview・Undo/Redo等、既存機能がURLパラメータの有無に関わらず
  従来どおり動作することの回帰確認（既存85件のフルスイートを実行）
- 既存85件（71＋Viewer Preview 14）の回帰: 変更後も全件成功することの確認
- 初期表示フラッシュが無いことの確認（可能であれば、`renderModeUi()`が
  初期化中に複数回呼ばれていないことを検証するテスト、または初期DOM状態の
  スナップショット比較）

---

## 15. リスク `[提案＋未検証]`

- **ブラウザの戻る/進むボタンとの相互作用**: `appMode`はセッション内変数
  であり（2.2節）、URLパラメータで初期値を決めた後にブラウザの戻る操作を
  行った場合の挙動（ページ全体がリロードされるかどうか）は本調査では
  検証していない。9.2節でPhase 1では戻る/進むをモード遷移の手段として
  使わないことを契約としたが、ブラウザ側の挙動そのもの（BFCache等）は
  未検証のまま残る
- **共有リンクとしての意味**: `?mode=editor`のURLを第三者と共有した場合、
  Editorモードで開かれた相手に対して何を意味するか（プロジェクトデータは
  URLに含まれないため、単に「空のEditor画面が開く」だけになる）は、
  ユーザー向けの説明が必要になる可能性がある。9.3節で「公開仕様として
  保証するかは未確定」とした点と合わせて、UX上の意味付けは次の実装PRでの
  判断事項として残す
- **Phase 2以降の見積り精度**: 2.4節のDOM参照棚卸し（153件）は`grep`による
  概算であり、1件ごとの個別確認（Editor専用/Viewer専用/共通の分類、
  null-guardの要否）は本調査では行っていない。Phase 2の実際の工数はこの
  精査後でないと確定しない
- **`docs/manual.js`パターンとの規模差**: 2.7節で述べたとおり、
  `docs/manual.js`は軽量な描画専用スクリプトであり、`script.js`
  （状態管理・mutation guard・Three.js統合を含む7279行）にそのまま
  同じパターンを適用できるかどうかは、規模の違いから慎重な検証が必要
  `[未検証]`

---

## 16. 未確認事項 `[未検証]`

実装前に判断・確認が必要な事項として、以下を分離して残す。

- `?mode=editor`を公開URL仕様として保証するか、内部実装に留めるか（9.3節）
- Phase 2で必要になる153件のDOM参照の個別分類（Editor専用/Viewer専用/
  共通、およびnull-guard要否）
- `vercel.json`のCache-Controlルールを、将来`viewer.html`等の新規静的
  ファイルを追加する際にどう拡張するか（Phase 2/3時点で再検討）
- ページ間でのプロジェクト状態引き継ぎ手段（Phase 3、`sessionStorage`/
  `postMessage`/URLシリアライズのいずれを採るか）の技術検証
- Viewer Preview自体の再設計要否（Phase 3、7節）
- ブラウザバック/フォワード時の`appMode`初期化タイミング（BFCache等の
  ブラウザ側挙動、15節）
- 共有URLとしての`?mode=editor`のUX上の意味付け（15節）

---

## 関連

- `docs/ViewerPreview_Investigation.md`（Viewer Preview Phase 1のPR #26
  設計調査文書。9節で本調査と同じ将来課題に既に触れている）
- `01_Projects/ArchView360/01_Roadmap.md`（Obsidian Vault側、「次の開発
  フェーズ」としてViewer/Editorの別URL・別エントリーポイント分離が
  記載されている）
- `01_Projects/ArchView360/03_Decisions.md`（App Mode基盤・mutation guard
  方針の既存設計判断）
