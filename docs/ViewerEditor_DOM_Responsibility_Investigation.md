# Viewer/Editor分離 Phase 2: DOM責務分類調査（v2.22.0時点）

このドキュメントは調査専用であり、実装は含まない。`index.html` / `script.js` /
`style.css` / `package.json` / ワークフロー / 既存テスト / `obsidian-vault` は
一切変更していない。

- 調査時点のmain HEAD: `76f56a78d073e283459f20487262653f9e1600b9`（PR #29 merge commit）
- `appVersion`: `2.22.0`（変更なし）
- 前提: `docs/ViewerEditor_Entrypoints_Investigation.md`（PR #28、Phase 1「URL指定による
  起動モード分離」設計調査。以下「Phase 1調査文書」と呼ぶ）の内容を前提知識として参照する

以下、各項目は次の3種類を明示的に分けて記載する。見出し・箇条書きの末尾に
`[事実]` / `[提案]` / `[未検証]` を付す。

- `[事実]` — 実際のコード・行番号を確認した上での記述。
- `[提案]` — 本調査で考案した分類案・方針案。まだ確定していない。
- `[未検証]` — 本調査の範囲では確認していない・検証していない事項。

---

## 1. 調査対象と確認commit `[事実]`

- 対象repo: `airesearchagl-art/ArchView360`
- 確認commit（main HEAD）: `76f56a78d073e283459f20487262653f9e1600b9`
- 確認したファイル: `index.html`（658行）、`script.js`（7299行）、`style.css`（2770行）、
  `tests/e2e/`配下の既存スペック、`playwright.config.js`、`vercel.json`、
  `docs/ViewerEditor_Entrypoints_Investigation.md`
- 本調査では上記ファイルの**内容確認のみ**を行い、一切変更していない

---

## 2. 現状の事実

### 2.1 計測値（本調査時点で再計測）

Phase 1調査文書（PR #28）が測定した数値を、本調査時点（PR #29 merge後、
`script.js`は7299行、20行増）で再計測した。

| 指標 | Phase 1調査時点（PR #28） | 本調査時点（Phase 2） |
|---|---|---|
| `init()`内の`$('id')`形式のDOM参照 | 153件 | 153件（変化なし） |
| `.editor-only`クラスの出現数（index.html） | 20件 | 20件（変化なし） |
| `.viewer-only`クラスの出現数 | 0件（コメント除く） | 0件（変化なし） |
| `assertEditorMode()`呼び出し | 36件 | 36件（変化なし） |
| `canMutateProject()`呼び出し | 20件 | 20件（変化なし） |

`resolveInitialAppMode()`（PR #29で追加）はDOM参照を一切持たないため、これらの
数値に影響していない`[事実]`。

### 2.2 index.html上のユニークID数

- `id="..."`を持つ要素は**184件**（`grep`実測、重複なし）`[事実]`
- うち、デフォルトで`style="display:none"`が付与されている要素は**37件**
  （モーダル・オーバーレイ・警告・ドロップダウン等）`[事実]`

### 2.3 `.editor-only`の実態：直接付与と継承の2パターン

Phase 1調査文書は「`.editor-only`クラスは20要素」という**出現数**のみを
確認していたが、本調査でさらに詳しく確認したところ、実際にViewerで
非表示になる要素には**2つの異なる実装パターン**が存在する`[事実]`。

**パターンA: 要素自身に`.editor-only`クラスが付与されている（19要素、id付き）**

`viewer-preview-btn` / `add-scene-btn` / `add-img-btn` / `update-scene-btn` /
`undo-btn` / `redo-btn` / `flip-btn` / `add-floorplan-btn` / `project-info-btn` /
`export-json-btn` / `import-json-btn` / `export-package-btn` / `import-package-btn` /
`save-set-btn` / `flip-a-btn` / `flip-b-btn` / `floormap-place-btn` /
`floormap-orient-bar`（コンテナ、後述） / `floormap-reseq-btn`

**パターンB: 親コンテナに`.editor-only`が付与され、子要素は継承で隠れる**

- `floormap-orient-bar`（index.html:396、`.editor-only`かつ
  `style="display:none"`を併用）の子: `floormap-orient-l` / `floormap-orient-val` /
  `floormap-orient-r` / `floormap-orient-preset`（4要素、自身は`.editor-only`
  クラスを持たない）
- `floormap-info-actions`（index.html:433、`div class="floormap-info-actions
  editor-only"`、**id無し**）の子: `floormap-rename-btn` / `floormap-rot-l` /
  `floormap-rot-r` / `floormap-del-mk`（4要素、自身は`.editor-only`クラスを
  持たない）

**この事実の意味**: `.editor-only`クラスを持つ要素だけを`grep`で数えると
19〜20件だが、実際にViewerで非表示になっているUI要素はこれに8要素
（パターンBの子要素）を加えた**計26〜27要素**になる。将来、`.editor-only`
要素をHTMLから機械的に除去する場合、**クラスを持つ要素だけを見ていると
パターンBの子要素8件を見落とす**`[事実に基づく評価]`。

### 2.4 「Editor専用」はCSSクラスだけでなく関数レベルの入口ガードでも実現されている

Phase 1調査文書は`.editor-only`（CSS）と`assertEditorMode()`/`canMutateProject()`
（mutation自体のガード）の2層構造を確認していたが、本調査でさらに、
**「そのUIを開く関数」自体にガードがあり、CSS上は`.editor-only`が付与されて
いないDOM群**が複数あることを確認した`[事実]`。

| モーダル/UI群 | 開く関数 | ガード | 子要素数（概算） |
|---|---|---|---|
| `project-info-modal` | `openProjectInfoModal()`（script.js:6729） | `if (!assertEditorMode('プロジェクト情報編集')) return;`（PR #13で追加、既存事実） | 8（`pi-*`一式）＋モーダル本体で計9 |
| `set-name-modal` | `openSetNameModal()`（script.js:2710）**自体は無ガード**だが、全呼び出し元（`saveCurrentCompareSet()`・`renameCompareSet()`等）が個別に`assertEditorMode()`を呼んでいる | 呼び出し元3箇所すべてで確認 | 7＋モーダル本体で計8 |
| `group-picker` | `openGroupPicker()`（script.js:2128） | `if (!assertEditorMode('グループ編集')) return;` | 3＋本体で計4 |

これらは`.editor-only`クラスを一切持たないため、2.3節の26〜27要素には
含まれない。**CSSクラスによる分類だけではEditor専用UIの全体像を捉えられない**
という点が、本調査で新たに確認できた重要な事実である`[事実]`。

### 2.5 逆に、直感に反してCommon（両モード共通）と確定した要素

- `clear-all-btn`・`back-btn`（「すべてクリア」「戻る」）は`.editor-only`
  クラスを持たず、クリックハンドラ`_confirmedClearAll()`（script.js:3460）にも
  `assertEditorMode()`呼び出しが無い。確認ダイアログ（`confirmUnsavedChanges
  ('replace-project')`）は経由するが、これはViewerでも意味のある操作
  （閲覧中のプロジェクトを閉じて別のものを開き直す）として**意図的に
  Viewer/Editor共通**にされている`[事実]`
- `import-modal`（JSON/ZIP読み込み時の「必要な画像ファイルを選択」ダイアログ）
  も`.editor-only`を持たない。開く経路は2つあり、(1) Editor専用の
  `import-json-btn`/`import-package-btn`経由、(2) 空プロジェクトへの
  Viewerからでも到達できる`open-json-btn`/`open-zip-btn`経由の**両方**が
  同じモーダル・同じボタン（`import-upload-btn`等）を共有する。実際の
  Editorガードは`_doImportWithFiles()`内部の`if (!projectWasEmpty &&
  !assertEditorMode(...)) return;`（script.js:6959）に一本化されており、
  `handleFiles()`の`wasEmpty`ガード（script.js:1249）と全く同じ設計パターンで
  ある`[事実]`

**この事実の意味**: 「編集操作っぽい名前・見た目」から直感的にEditor専用と
誤分類しやすい要素（`clear-all-btn`・`import-modal`一式）が、実際には
Common設計であることを本調査で確認した。将来のDOM分類作業では、
**要素の見た目や名前ではなく、実際のガード関数の有無で判定する必要がある**
`[事実に基づく評価]`。

### 2.6 DOM参照パターンは3種類存在する

- **パターン1（大多数、136件）**: `init()`冒頭の「DOM refs」ブロックで
  `const xxx = $('id');`として一括取得し、後で無条件または`if`で使用する
  （`grep`実測、init()冒頭〜620行目付近に集中）
- **パターン2（17件）**: 特定機能の関数内部で、使用の都度`$('id')`を呼ぶ
  （例: `openProjectInfoModal()`内の`$('pi-name').value`、`openGroupPicker()`
  内の`$('group-picker')`）。この17件は、要素が存在しないと呼び出し時に
  失敗するが、`init()`自体の完走を妨げない
- **パターン3（少数、確認できた例は2件）**: 変数にキャッシュせず、
  `$('id').addEventListener(...)`または`$('id')?.addEventListener(...)`を
  その場で1回だけ呼ぶ。前者（`project-info-btn`、script.js:6758）は
  オプショナルチェイニング無しで無条件、後者（`floormap-reseq-btn`、
  script.js:6648）は`?.`付きで要素が無くても安全

`[事実]`

---

## 3. 分類基準 `[提案]`

本調査では、DOM要素を以下の4分類に整理する。

- **Editor専用**: `.editor-only`クラス（直接または親からの継承）、または
  開く関数自体の`assertEditorMode()`呼び出しにより、Viewerでは到達・表示
  されない
- **Viewer専用**: `.viewer-only`クラスが実際に付与されている要素
  （2.1節のとおり現状0件）
- **共通（Common）**: 上記いずれのガードも無く、Viewer/Editor両方から
  同一に到達・表示される
- **状態依存**: `appMode`ではなく、別の状態（`previewActive`・
  `isProjectDirty()`・比較モードの種類・VRセッション中か等）によって
  表示/非表示が切り替わる。`appMode`と無関係に決まるため、Editor専用/
  Viewer専用/共通のいずれとも独立した軸として扱う

**この4分類は互いに排他ではない**（例: `project-info-modal`はEditor専用かつ
状態依存＝モーダルが開いているかどうかで表示が変わる）。1つの要素が
複数のタグを持ちうることを前提とする`[提案]`。

---

## 4. DOM責務一覧

### 4.1 Editor専用（CSSクラスベース、26〜27要素）`[事実]`

| ID | 参照箇所 | init時取得 | null-guard | 将来の分離方針候補 |
|---|---|---|---|---|
| `viewer-preview-btn` | script.js:273 | ✓（パターン1） | ✓ `if (viewerPreviewBtn)` | Viewer entry除去候補 |
| `add-scene-btn` | script.js:181 | ✓ | ✗ | 同上 |
| `add-img-btn` | script.js:144 | ✓ | ✗ | 同上 |
| `update-scene-btn` | script.js:145 | ✓ | ✗ | 同上 |
| `undo-btn` | script.js:154 | ✓ | ✓ `if (undoBtn)` | 同上 |
| `redo-btn` | script.js:155 | ✓ | ✓ `if (redoBtn)` | 同上 |
| `flip-btn` | script.js:148 | ✓ | ✗ | 同上 |
| `add-floorplan-btn` | script.js:228 | ✓ | ✗ | 同上 |
| `project-info-btn` | script.js:6758（パターン3、変数キャッシュ無し） | 使用時都度 | ✗（`?.`も無し） | 同上、**最も脆弱** |
| `export-json-btn` | script.js:229 | ✓ | ✗ | 同上 |
| `import-json-btn` | script.js:230 | ✓ | ✗ | 同上 |
| `export-package-btn` | script.js:231 | ✓ | ✓ `if (exportPackageBtn)` | 同上 |
| `import-package-btn` | script.js:232 | ✓ | ✓ `if (importPackageBtn)` | 同上 |
| `save-set-btn` | script.js:172 | ✓ | ✗ | 同上 |
| `flip-a-btn` | script.js:168 | ✓ | ✗ | 同上 |
| `flip-b-btn` | script.js:169 | ✓ | ✗ | 同上 |
| `floormap-place-btn` | script.js:201 | ✓ | ✗ | 同上 |
| `floormap-orient-bar`（コンテナ） | script.js:212付近 | ✓ | `[未検証]` | 同上 |
| `floormap-reseq-btn` | script.js:6648（パターン3） | 使用時都度 | ✓ `?.`（安全） | 同上 |
| `floormap-orient-l`/`-val`/`-r`/`-preset`（継承、4件） | script.js:212-215付近 | ✓ | `[未検証]` | 同上（親ごと除去） |
| `floormap-rename-btn`/`floormap-rot-l`/`-r`/`floormap-del-mk`（継承、4件） | script.js:212-215、6649-6654 | ✓ | ✗（`floormapRotL.addEventListener`等、無条件） | 同上（親ごと除去） |

**null-guard集計（直接タグ付けされた18個の操作系ボタンのみ）**: 6/18が
guard済み（`if`×5、`?.`×1）、**12/18は無guard**`[事実]`。継承パターンの
8要素については、少なくとも`floormapRotL`/`floormapDelMk`/`floormapRenameBtn`
が無guardであることを確認したが、残り（`floormapOrientL`等）の網羅的な
guard状況確認は`[未検証]`のまま残す。

### 4.2 Editor専用（関数レベルガード、CSSクラス無し）`[事実]`

| UI群 | 個別要素 | ガード方式 | 参照箇所 |
|---|---|---|---|
| `project-info-modal` | `pi-modal-title`/`pi-close-btn`/`pi-name`/`pi-client`/`pi-author`/`pi-date`/`pi-notes`/`pi-cancel-btn`/`pi-save-btn` | 開く関数`openProjectInfoModal()`内の`assertEditorMode()` | script.js:6729-6734 |
| `set-name-modal` | `set-name-modal-title`/`set-name-close-btn`/`set-name-modal-info`/`set-name-input`/`set-name-modal-note`/`set-name-cancel-btn`/`set-name-ok-btn` | 共有関数`openSetNameModal()`自体は無guard、全呼び出し元（3箇所）が個別に`assertEditorMode()` | script.js:2710、呼び出し元 script.js:2800, 2884付近 |
| `group-picker` | `group-picker-list`/`group-picker-input`/`group-picker-add-btn` | 開く関数`openGroupPicker()`内の`assertEditorMode()` | script.js:2128-2129 |

これら3群（計21要素、モーダル本体含む）は、将来`.editor-only`と同じ扱いで
分離候補にできる`[提案]`が、**同様の「開く関数にガードがあるだけの
モーダル」が他にも存在するかどうかは、本調査ではこの3例のみ確認しており、
全モーダルの網羅確認はしていない**`[未検証]`（12節参照）。

### 4.3 Common（両モード共通と確認した代表例）`[事実]`

全184要素中、4.1・4.2の分類に含まれないものは原則Common候補だが、
本調査では以下を重点的に個別確認した。

| ID/群 | 確認内容 |
|---|---|
| `clear-all-btn` / `back-btn` | ガード無し。Viewerでも「閉じて別プロジェクトを開き直す」操作として意図的にCommon（2.5節） |
| `import-modal`一式（`import-modal`/`import-close-btn`/`import-modal-body`/`import-cancel-btn`/`import-upload-btn`/`import-images-input`） | ガード無し。実際の分岐は`_doImportWithFiles()`内部（2.5節） |
| `file-input` / `handleFiles()`経由の初回アップロード | `wasEmpty`時は無条件許可（既存事実、Phase 1調査文書2.1節でも確認済み） |
| シーン切替・比較モード開始・VR開始・視点操作 | Phase 1調査文書2.1節で確認済み、本調査でも変更無し |
| ヘッダー（`manual-link-btn`/`security-link-btn`/`quick-help-btn`等） | 純粋な静的リンク・ヘルプ表示、mutation無し |

その他の大多数（ツールバー閲覧系ボタン、`viewer-container`/`compare-container`
配下、`floormap-navigator`の閲覧系操作、各種`toast`/`error-overlay`等）は
Phase 1調査文書で確認済みの「ガード無し＝Common」という既存分類を踏襲する
`[事実に基づく評価、個別の再確認はしていない]`。

### 4.4 状態依存（appModeと独立した表示制御）`[事実]`

- `dirty-indicator`: `isProjectDirty()`に応じてJSが直接`style.display`を
  操作（CSSクラスカスケードではない）
- `viewer-preview-exit-btn`: `previewActive`に応じて`renderModeUi()`が
  直接`style.display`を操作（既存実装、PR #27）
- `dirty-confirm-modal`: `confirmUnsavedChanges()`が呼ばれ、かつdirtyな
  ときのみ表示。トリガーボタン自体（`clear-all-btn`等）はCommonだが、
  実際に表示されるのはEditorでdirtyな場合のみ（既存設計上、Viewerは
  構造的にdirtyになり得ないため）
- 各種モーダル（`quick-help-modal`/`observer-panel`/`picker-dropdown`等）は
  `appMode`と無関係に、それぞれの機能固有の状態でのみ表示

`appMode`（Editor専用/Viewer専用/共通の軸）と、この「状態依存」の軸は
**独立している**ため、Editor専用要素の中にも状態依存の要素（例:
`project-info-modal`はEditor専用**かつ**「開いているかどうか」で状態依存）
がある、という重なりを許容する`[提案]`（3節の分類基準どおり）。

---

## 5. 初期化依存 `[事実]`

- `init()`内の153件の`$()`呼び出しのうち136件は、`init()`冒頭の単一の
  「DOM refs」ブロック内で一括して行われる（2.6節パターン1）。この
  ブロック自体は要素の有無を問わず完走する（`document.getElementById()`は
  存在しない場合`null`を返すのみで例外を投げないため）。危険なのは
  **後続の無条件メソッド呼び出し**（`.addEventListener`等）であり、
  取得そのものではない
- 残り17件は、特定機能の関数内部で使用の都度取得される（パターン2）。
  これらは元々「遅延取得」に近い形になっており、要素が存在しない場合も
  `init()`自体をブロックしない（該当機能を実行しようとした時点で
  初めて失敗する）
- 2件（`project-info-btn`・`floormap-reseq-btn`）は変数キャッシュ無しの
  インライン参照（パターン3）で、これも`init()`完走そのものは妨げない

**Phase 3で「Viewer専用の縮小版HTML」を試作する場合の実際のリスクは、
「DOM取得の失敗」ではなく「取得結果（null）に対する後続の無条件メソッド
呼び出し」に集約される**、という理解を、Phase 1調査文書の記述
（DOM参照の欠如がinit()を止める、という表現）よりも一段精密にした
`[事実に基づく評価]`。

---

## 6. null-guard状況 `[事実]`

- 4.1節の直接タグ付けEditor専用18要素中、6要素（33%）がguard済み
  （`if`×5、`?.`×1）、12要素（67%）が無guard
- Phase 1調査文書が示した全体概算「153件中21件（約14%）がguard済み」と
  比較すると、**Editor専用要素に限定した方がguard済み率がやや高い
  （33% vs 14%）**が、それでも過半数が無guardのままである
- 一律にguardを追加する方針は取らない（8節・9節参照）。Editor専用要素
  グループ全体を対象にした網羅的なguard追加は「大規模リファクタ」に
  該当しうる規模のため、Phase 2はあくまで分類に留め、実際の追加要否は
  Phase 3着手時に個々に判断する`[提案]`

---

## 7. Viewer Previewとの共有 `[事実]`

- Viewer Previewは既存の`appMode='viewer'`をそのまま利用する実装
  （PR #26/#27、既存事実）であるため、**Viewer Preview中に表示される
  DOM要素の集合は、通常のViewer Modeで表示されるDOM要素の集合と完全に
  一致する**。Viewer Preview専用のDOM要素は存在しない
- 例外は`viewer-preview-exit-btn`（Preview中のみ表示、状態依存、4.4節）と、
  Preview中は非表示になる`app-mode-toggle-btn`自体（`renderModeUi()`が
  `style.display`を直接操作、既存実装）
- **将来のViewer URL起動・別HTML分離との関係**: Viewer Previewが依拠する
  DOM集合（＝通常のViewer Mode表示に必要なDOM一式）は、そのまま将来の
  「Viewer専用HTML」に必要なDOM集合の下限になる。Viewer Previewが
  正しく動作し続ける限り、Viewer専用DOMの集合は「Editor専用（4.1・4.2節）
  を除いた残り全部」で足りる、という設計上の制約を確認した`[事実に基づく評価]`

---

## 8. Viewer URLとの共有 `[事実]`

- Phase 1（URL指定による起動モード分離、PR #29）は`resolveInitialAppMode()`
  が`appMode`の初期値のみを決定する変更であり、DOM要素を一切追加・削除
  していない（既存事実）
- したがって、`?mode=viewer`で起動した場合に実際に表示されるDOM集合は、
  7節のViewer Previewと同じ「Editor専用を除いた全体」であり、**Viewer URL
  起動・Viewer Preview・通常のViewer Modeの3経路すべてが、全く同じDOM
  集合を共有する**`[事実に基づく評価]`
- Phase 3で仮に別HTML（`viewer.html`）を作る場合、この3経路すべてが
  同一のDOM要件を持つことを前提にでき、経路ごとに異なるDOM集合を
  用意する必要は無い、という設計上の単純化ができる`[提案]`

---

## 9. 分離可能性 `[提案]`

### 9.1 分離しやすい候補

- 4.1節のEditor専用18要素中、**6要素は既にguard済み**であり、これらは
  仮に`.editor-only`要素をHTMLから除去しても、script.js側の該当行を
  変更する必要が無い（既にnullを想定した書き方になっているため）
- Observer Mode一式（`obs-*`、9要素）は、既に`observerPanel.querySelector()`
  というスコープドクエリ＋`if`guardのパターンで実装されており（2.6節、
  script.js:5628-5636）、**将来の「機能ごとに閉じたDOM取得」のモデルケース
  として参考にできる**（Observer Mode自体はEditor専用ではなくCommonだが、
  実装パターンとして参考になる）

### 9.2 分離が難しい候補

- 4.1節の12個の無guard要素と、4.2節の関数レベルガードの3群（計21要素）は、
  script.js側の該当箇所（`.addEventListener`呼び出しおよびモーダル内の
  `$('pi-name').value`等の値取得）に個別のnull-guardまたは条件分岐を
  追加しないと、HTMLから物理的に除去した際に動作しない
- 特に`project-info-btn`（パターン3、変数キャッシュ無し・オプショナル
  チェイニング無し）は最も脆弱な実装であり、対応の優先度が高い候補になる
  `[提案]`

---

## 10. リスク `[提案＋未検証]`

- **継承パターン（2.3節パターンB）の見落としリスク**: `.editor-only`クラスの
  grep件数だけを見て「これで全部」と判断すると、親コンテナ経由で隠れている
  8要素を見落とす。Phase 3の実装時は、クラスの直接付与だけでなく、
  DOM木構造上の祖先も確認する必要がある
- **関数レベルガード（4.2節）の網羅性が未確認**: 本調査で確認したのは
  3つのモーダル群のみであり、他にも同様のパターンを持つUIが存在するか
  どうかは`[未検証]`のまま残る（12節）
- **状態依存要素との相互作用**: Editor専用かつ状態依存の要素
  （`project-info-modal`等）を分離する場合、モーダルを開く関数のガードと
  DOM自体の存在確認の両方を同時に扱う必要があり、単純な「クラスを
  見て削除」より複雑になる

---

## 11. Phase 3前提 `[提案]`

Phase 3（真のエントリーポイント分離、Phase 1調査文書8節）に進むための
前提条件として、以下を提案する。

1. 4.1節の12個の無guard要素・4.2節の21要素（計33要素）について、
   個別にnull-guardまたは同等の安全化を行う（一律追加ではなく、
   このリストに基づく個別対応）
2. 2.3節パターンBの継承関係（`floormap-orient-bar`/`floormap-info-actions`の
   2コンテナと、その子8要素）を、Phase 3の実装候補ファイルで明示的に
   ドキュメント化し、見落としを防ぐ
3. 10節の未確認事項（他の関数レベルガード付きUIの網羅確認）を解消する
4. 7節・8節で確認した「Viewer Preview・Viewer URL・通常Viewer Modeは
   同一DOM集合を共有する」という前提が崩れていないことを、Phase 3
   着手直前に再確認する
5. 上記1〜4が完了した時点で、縮小版HTML（`viewer.html`相当）を試作し、
   既存`script.js`が変更なしで動作するかを検証するプロトタイプフェーズへ
   進む（Phase 1調査文書8節のPhase 2相当の作業に一致）

---

## 12. 実装候補（小さい単位に分割） `[提案]`

Phase 2自体はドキュメント調査のみのため実装は行わないが、次のフェーズで
着手しやすいよう、小さい単位に分割した候補を示す。

1. **候補A**: `project-info-btn`（4.1節、変数キャッシュ無し・最も脆弱）に
   変数キャッシュと`if`guardを追加する、単独の最小修正
2. **候補B**: 4.1節の残り11個の無guard要素に、`if (xxx) xxx.addEventListener
   (...)`形式のguardを個別に追加する（1PRで全部ではなく、機能グループ
   （toolbar系・floormap系）ごとに分割することを推奨）
3. **候補C**: 4.2節の3モーダル群について、モーダル本体
   （`project-info-modal`/`set-name-modal`/`group-picker`）の`.editor-only`
   クラス付与を検討する（現状は関数レベルガードのみで、CSS側は無防備な
   ため、DOM分離時の可読性向上を狙う）
4. **候補D**: 2.3節パターンBの2コンテナ（`floormap-orient-bar`/
   `floormap-info-actions`）の子要素に、個別のnull-guardを追加する
5. **候補E**: 10節の未確認事項（他モーダルの関数レベルガード網羅確認）
   を専用の調査タスクとして独立させる

いずれも本PRでは実装しない。

---

## 13. 未確認事項 `[未検証]`

- 4.2節で確認した3つの関数レベルガードモーダル以外に、同様のパターン
  （CSS上は`.editor-only`が無いが、開く関数自体がガードされている）を
  持つUIが他に存在するか
- 2.3節パターンBの8継承要素すべてについて、個別のnull-guard有無を
  網羅確認したわけではない（`floormapRotL`/`floormapDelMk`/
  `floormapRenameBtn`の無guardは確認済みだが、`floormapOrientL`等の
  4要素は未確認）
- Common分類（4.3節）とした残り約140要素超について、本調査は
  Phase 1調査文書の既存分類を踏襲したのみで、1件ずつの再確認は
  行っていない
- Phase 3で実際に`viewer.html`を試作した際、9節で述べた「分離しやすい/
  難しい」の判断が実機検証でも成立するかどうか

---

## 関連

- `docs/ViewerEditor_Entrypoints_Investigation.md`（Phase 1設計調査文書。
  6.1節・8節でPhase 2をこのDOM責務分類調査と定義している）
- `01_Projects/ArchView360/01_Roadmap.md`（Obsidian Vault側、「次の開発
  フェーズ」としてViewer/Editor分離 Phase 2が記載されている）
- `01_Projects/ArchView360/03_Decisions.md`（Phase 1のURL契約・
  セキュリティ上の限界に関する既存設計判断）
