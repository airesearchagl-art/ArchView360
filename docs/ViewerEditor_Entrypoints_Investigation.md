# Viewer / Editor 別URL・別エントリーポイント分離 設計調査（v2.22.0時点）

このドキュメントは調査専用であり、実装は含まない。`script.js` / `index.html` /
`style.css` / `package.json` / ワークフロー / 既存テスト / `obsidian-vault` は
一切変更していない。

- 調査時点のmain HEAD: `ce74c1732ff533979480ce8a74c9b20a0728a76e`（PR #27 merge commit）
- `appVersion`: `2.22.0`（変更なし）
- 調査時点のPlaywright: `npx playwright test --list` で85件（既存71件＋Viewer Preview 14件）を確認。実行はしていない（コード変更を伴わない調査のため）
- 前提: Viewer Preview Phase 1（PR #26調査・PR #27実装、merge済み）の実装内容を前提知識として参照する

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
  一切存在しない。これは裏を返せば、**URL起点でモードを決定する設計を新規に
  追加しても、後方互換性を壊す既存の挙動が無い**ことを意味する`[事実]`

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
  同一変数を共有」という4節の事実（Viewer Preview投資調査文書）が
  **成立しなくなる**ため、プロジェクト状態を何らかの形でページ間に
  引き継ぐ手段（`sessionStorage`・`postMessage`・URLへのシリアライズ等）が
  新たに必要になる`[事実に基づく評価]`
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

**Phase 1としては案1（同一HTML＋URLパラメータ）を推奨する。**

理由:

1. 2.2節の事実（現状`appMode`はURLに一切依存しておらず、既存の互換性を
   壊すリスクが無い）と、2.4節の事実（`script.js`が153件のDOM参照の大半を
   null-guard無しで前提にしている）を踏まえると、案2・案3のような
   「DOM/JSの物理分離」は、それ自体が2.4節の無条件DOM参照という
   **既存の技術的負債**への大規模な対処（null-guard追加、または
   モジュール分割のための変数共有の作り替え）を前提条件として要求する。
   これは本調査の禁止事項である「大規模リファクタ」に該当する可能性が
   高く、単独のPhase 1としては着手できない
2. Viewer Preview Phase 1（既存実装）は「同一ページ・同一`appMode`変数」
   という前提の上に成立しており、案1はこの前提と完全に整合する
   （7節で詳述）。案2・案3は「別ページ」という前提でViewer Previewとの
   共通化を弱める
3. 案1は「別URL」という当初の課題設定（Vault側の記述にある
   「Viewer/Editorの別URL・別エントリーポイント分離」）の**一部
   （別URL）を満たしつつ**、「別エントリーポイント（別HTML/別JSバンドル）」
   というより踏み込んだ目標は、案1を土台にした次段階（8節のPhase 2）で
   引き続き検討できる

ただし、**案1は「別URLで開ける」ことは実現するが、「Editor専用コードを
配布物から除去する」という将来的な動機には応えられない**、という限界を
明記しておく`[提案・限界の明示]`。この限界を解消したい場合は、2.4節の
DOM参照の網羅的なnull-guard化（それ自体が独立した先行タスクになり得る）
を済ませた上で、案2または案3へ段階的に移行する、という順序が現実的だと
考える`[提案]`。

---

## 7. Viewer Previewとの関係 `[事実＋提案]`

- Viewer Preview Phase 1（既存実装、script.js:751-786）は、`appMode`を
  実際に`'viewer'`へ切り替えつつ、`previewActive`という別フラグで
  「Editorから来たか」を判別する設計であり、**同一ページ内でのモード
  切替**を前提にしている（`enterViewerMode()`/`enterEditorMode()`は
  ページ遷移を一切伴わない、script.js:680-696）`[事実]`
- 案1（URLパラメータ）を採用した場合、Viewer Previewの実装は
  **無変更のまま両立できる**: URLパラメータは「初期表示モード」だけを
  決定し、Viewer Preview自体は既存どおり画面内の`appMode`/`previewActive`
  操作として機能し続ける`[提案]`
- 逆に案2（別HTML）を将来的に採用する場合は、Viewer Previewの
  「Editor画面内で一時的にViewerを覗く」という体験を、「別ページを
  新しいタブ/iframeで開く」という形に置き換える設計変更が必要になる
  可能性が高く、その場合はViewer Preview自体の再設計を伴う
  `[提案、未検証]`（ViewerPreview_Investigation.md 8節のPhase 3で
  同様の懸念が既に示唆されている）
- **本調査の結論**: 案1を推奨する最大の理由の1つは、Viewer Preview
  Phase 1という**既存の確定済み実装に対して後方互換**であり、
  再設計を要求しないことである

---

## 8. 段階的実装案 `[提案]`

### Phase 1（本調査の次のPRで実装候補・最小実装）

- `index.html`起動時に`URLSearchParams`を読み、`?mode=editor`が
  指定されていれば初期`appMode`を`'editor'`にする（`?mode=viewer`または
  パラメータ無しは現状どおり`'viewer'`のまま、後方互換を維持）
- URLパラメータは**あくまで初期値の決定にのみ使う**。画面内切替
  （`app-mode-toggle-btn`・Viewer Preview）の既存挙動には一切手を
  入れない
- URLの一部（クエリパラメータ）を新設する変更のみであり、`.editor-only`/
  `viewer-only`のCSS、`assertEditorMode()`/`canMutateProject()`等の
  mutation guard、`renderModeUi()`の実装はいずれも無変更で機能する
  （5節・6節の評価に基づく）

### Phase 2（Editor専用コードの配布分離、案2/3への布石）

- 2.4節で確認した無条件DOM参照（153件中、null-guard無しの大多数）の
  棚卸しと、必要箇所へのnull-guard追加。これ自体をViewer/Editor分離とは
  独立した先行リファクタとして先に完了させる
- 上記が完了した後、`.editor-only`要素を実際に持たない縮小版HTML
  （`viewer.html`相当）を試作し、既存`script.js`がそのまま動作するかを
  検証する

### Phase 3（真のエントリーポイント分離）

- Phase 2の検証結果を踏まえ、案2（別HTML）または案3（共通bootstrap+
  entry分離）のどちらを採用するかを判断する
- ページ間でのプロジェクト状態引き継ぎ手段（`sessionStorage`・
  `postMessage`・URLシリアライズ等）の設計
- Viewer Preview自体の再設計要否の判断（7節）

**Phase 2・3は本調査の範囲外であり、実装着手前に別途調査・判断が必要な
項目として残す。**`[提案]`

---

## 9. Phase 1実装候補（編集するファイル候補と編集しない範囲） `[提案]`

### 編集候補（Phase 1、次の実装PRで想定）

- `script.js`: `let appMode = 'viewer';`（script.js:656）の直前後に、
  `URLSearchParams(window.location.search)`から`mode`パラメータを読み取り、
  `'editor'`の場合のみ初期値を上書きする処理を追加（数行程度の想定）
- `tests/e2e/`: 新規スペックファイル1つ（例:
  `tests/e2e/mode-url-param.spec.js`）を追加し、`?mode=editor`での起動・
  パラメータ無し起動・不正な値（例: `?mode=foo`）での起動を検証

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

**これらはあくまで次の実装PRに向けた「候補」であり、本PRでは一切
実装していない。**

---

## 10. テスト計画 `[提案]`

まだ実装しないため、以下は項目の洗い出しのみ。

- `?mode=editor`で起動した場合、`renderModeUi()`適用後に
  `body.classList.contains('mode-editor')`がtrueになることの確認
- パラメータ無しで起動した場合、従来どおり`body.classList.contains
  ('mode-viewer')`がtrueのままであることの確認（既存71件の回帰確認と
  重複する観点だが、URLパラメータ処理追加後も同じ結果になることの
  明示的な確認として別途追加）
- 不正な値（`?mode=foo`・`?mode=`空文字等）を指定した場合、既存の
  デフォルト（`'viewer'`）にフォールバックすることの確認
- 大文字小文字・前後空白等の表記ゆれをどこまで許容するかは実装時の
  仕様判断（本調査では未確定）
- Viewer Preview・Undo/Redo等、既存機能がURLパラメータの有無に関わらず
  従来どおり動作することの回帰確認（既存85件のフルスイートを実行）
- 既存85件（71＋Viewer Preview 14）の回帰: 変更後も全件成功することの確認

---

## 11. リスク `[提案＋未検証]`

- **URLパラメータの命名・値の最終決定**: `mode`という名前・
  `viewer`/`editor`という値は本調査内での仮称であり、確定していない
- **ブラウザの戻る/進むボタンとの相互作用**: `appMode`はセッション内変数
  であり（2.2節）、URLパラメータで初期値を決めた後にブラウザの戻る操作を
  行った場合の挙動（ページ全体がリロードされるかどうか）は本調査では
  検証していない
- **共有リンクとしての意味**: `?mode=editor`のURLを第三者と共有した場合、
  Editorモードで開かれた相手に対して何を意味するか（プロジェクトデータは
  URLに含まれないため、単に「空のEditor画面が開く」だけになる）は、
  ユーザー向けの説明が必要になる可能性がある。本調査では技術的な実現性の
  評価に留め、UX上の意味付けは次の実装PRでの判断事項として残す
- **Phase 2以降の見積り精度**: 2.4節のDOM参照棚卸し（153件）は`grep`による
  概算であり、1件ごとの個別確認（null-guardの要否、Editor専用かCommonか
  の再分類）は本調査では行っていない。Phase 2の実際の工数はこの精査後
  でないと確定しない
- **`docs/manual.js`パターンとの規模差**: 2.7節で述べたとおり、
  `docs/manual.js`は軽量な描画専用スクリプトであり、`script.js`
  （状態管理・mutation guard・Three.js統合を含む7279行）にそのまま
  同じパターンを適用できるかどうかは、規模の違いから慎重な検証が必要
  `[未検証]`

---

## 12. 未確認事項 `[未検証]`

実装前に判断・確認が必要な事項として、以下を分離して残す。

- URLパラメータ名・値の最終仕様（11節）
- Phase 2で必要になる153件のDOM参照の個別棚卸し（null-guard要否の分類）
- `vercel.json`のCache-Controlルールを、将来`viewer.html`等の新規静的
  ファイルを追加する際にどう拡張するか（Phase 2/3時点で再検討）
- ページ間でのプロジェクト状態引き継ぎ手段（Phase 3、`sessionStorage`/
  `postMessage`/URLシリアライズのいずれを採るか）の技術検証
- Viewer Preview自体の再設計要否（Phase 3、7節）
- ブラウザバック/フォワード時の`appMode`初期化タイミング（11節）
- 共有URLとしての`?mode=editor`のUX上の意味付け（11節）

---

## 関連

- `docs/ViewerPreview_Investigation.md`（Viewer Preview Phase 1のPR #26
  設計調査文書。9節で本調査と同じ将来課題に既に触れている）
- `01_Projects/ArchView360/01_Roadmap.md`（Obsidian Vault側、「次の開発
  フェーズ」としてViewer/Editorの別URL・別エントリーポイント分離が
  記載されている）
- `01_Projects/ArchView360/03_Decisions.md`（App Mode基盤・mutation guard
  方針の既存設計判断）
