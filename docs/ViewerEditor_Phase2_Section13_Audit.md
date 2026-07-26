# Phase 2文書13節 未確認事項の解消（関数レベルガードUIの網羅監査）

このドキュメントは監査専用であり、実装は含まない。`index.html` / `script.js` /
`style.css` / `package.json` / ワークフロー / `obsidian-vault` は一切変更して
いない。唯一の例外は、本監査で確認した挙動を実行時に裏付けるための新規
Playwrightテスト1件（`tests/e2e/phase2-section13-audit.spec.js`）であり、
これも既存コードの動作を確認するだけで、実装コード（`script.js`等）は
変更していない。

- 確認時点のmain HEAD: `66929bb2ff6447bfa77c441a021c60d08aa8b1cd`（PR #39 merge commit、
  Viewer用DOM分離方式の設計比較完了時点）
- `appVersion`: `2.22.0`（変更なし）
- 前提として以下を参照する:
  - `docs/ViewerEditor_DOM_Responsibility_Investigation.md`（Phase 2調査。以下「DOM調査文書」）
  - `docs/ViewerEditor_Phase3_Implementation_Plan.md`（Phase 3実装計画）
  - `docs/ViewerEditor_DOM_Separation_Design_Comparison.md`（Viewer用DOM分離方式の設計比較。以下「設計比較文書」）

以下、各項目は次の3種類を明示的に分けて記載する。

- `[事実]` — 実際のコード・行番号を確認した上での記述。
- `[提案]` — 本文書で考案した評価・分類。まだ確定していない。
- `[未検証]` — 本文書の範囲では確認していない・検証していない事項。

**本文書の位置づけ**: 設計比較文書のPR-A（DOM調査文書13節の未確認事項の解消、
docs-only）を実施するものであり、`viewer.html`の実装そのものは行わない。

---

## 0. 前提の確認 `[事実]`

- Viewer URL（`?mode=viewer`/`?mode=editor`）は認証・権限境界ではない。`appMode`は
  セッション内JS変数に過ぎない（既存方針を踏襲）
- Viewer Preview（`previewActive`）とViewer URL起動（`resolveInitialAppMode()`）は
  別概念であり、本文書でも混同しない
- 本監査はDOM要素の分類・集計の確定のみを目的とし、HTML分割の実装・
  null-guard追加・URL仕様変更は一切行わない

---

## 1. Phase 2文書・Phase 3計画文書の確認 `[事実]`

- DOM調査文書（Phase 2）は、184件のユニークID（`index.html`、重複無し）を
  分母として、CSSベースEditor専用27件（確定値）・関数レベルガードEditor専用
  21件（確認済み値・暫定）・Common候補136件（候補値・暫定）に分類していた
- 同文書13節は「`project-info-modal`/`set-name-modal`/`group-picker`以外に、
  CSS上は`.editor-only`が無いが開く関数自体（または全呼び出し元）がガード
  されている同種のUIが他に存在するか」を未確認事項として残していた
- Phase 3実装計画・G1〜G6実装PRは、この13節の未確認事項が「CSS無guard系21件
  （①DOM取得/呼び出しguard必要3件＋②イベント登録guard必要18件、いずれも
  CSSベース27件の内数）」の集合には影響しないことを前提に、13節の解消を
  待たずに並行して進められた（DOM調査文書6.4節の既存記載どおり）

---

## 2. 文書13節に残る未確認事項の列挙 `[事実]`

1. `project-info-modal`/`set-name-modal`/`group-picker`の3群以外に、同種の
   「CSSクラス無し・関数レベルガード」パターンを持つUIが存在するかどうか
   （DOM調査文書13節・4.2節末尾）
2. 上記3群自体の子要素数（ID基準）が、DOM調査文書に記載された値
   （`project-info-modal`系9・`set-name-modal`系8・`group-picker`系4、
   合計21）で正確かどうか（本監査で独立して数え直す）
3. 3群の`.editor-only`クラスとの重複が実際に0件であるか（DOM調査文書は
   「重複0、確認済み」としていたが、本監査でも独立に確認する）

---

## 3. 監査方法 `[事実]`

- `index.html`から`id="..."`属性を機械的に全件抽出し、重複の有無を確認した
  （184件、重複0件、DOM調査文書と一致）
- `script.js`内の`assertEditorMode(`呼び出し（定義・コメントを除き32箇所）と
  `canMutateProject()`呼び出し（定義・コメントを除き18箇所）を全件列挙し、
  各呼び出し箇所が「新規のDOM表示（モーダル・パネル・メニュー等）をガード
  しているか」「既存の常設DOM（Common要素）に対する一部の操作（インライン
  編集・並び替え・削除等）をガードしているだけか」を個別に判定した
- モーダル・パネル・ドロップダウン・メニュー・ピッカー・ツールチップ・
  オーバーレイに該当しそうな`index.html`内のID（`modal`/`panel`/`dropdown`/
  `menu`/`picker`/`popup`/`overlay`/`tooltip`/`dialog`を含むもの、31件）を
  個別に洗い出し、それぞれの開閉関数を特定して同様に判定した
- 上記に加え、`document.createElement`でその場限りの動的UI（右クリック
  メニュー等）を生成している箇所も洗い出し、生成前のガードの有無を確認した

---

## 4. 監査結果: 3群自体の子要素数の再検証 `[事実]`

DOM調査文書4.2節の3群それぞれについて、`index.html`から実際のIDを再度
数え直した。

### 4.1 `project-info-modal`群 — **9→10へ訂正**

`index.html`515〜536行を確認したところ、`pi-*`接頭辞のユニークIDは以下の
**9件**である。

`pi-modal-title` / `pi-close-btn` / `pi-name` / `pi-client` / `pi-author` /
`pi-date` / `pi-notes` / `pi-cancel-btn` / `pi-save-btn`

これにモーダル本体`project-info-modal`を加えると、この群のID基準の総数は
**10件**（9＋1）になる。

DOM調査文書2.4節の表は「8（`pi-*`一式）＋モーダル本体で計9」と記載していたが、
実際に列挙されている`pi-*`のIDは同文書の同じ表内でも9件（上記と同一）が
明記されており、要素数の**列挙自体は正しかったが、合計の算出時に1件の
数え落とし（8→9への訂正漏れ）があった**、という単純な集計上の誤りである
`[事実]`。DOM本体・要素の追加/削除は無く、既存記載の集計ミスの訂正に限る。

### 4.2 `set-name-modal`群 — 8件のまま変更なし

`set-name-modal-title` / `set-name-close-btn` / `set-name-modal-info` /
`set-name-input` / `set-name-modal-note` / `set-name-cancel-btn` /
`set-name-ok-btn`（7件）＋モーダル本体`set-name-modal`＝**8件**。
DOM調査文書の記載と一致し、訂正の必要はない`[事実]`。

### 4.3 `group-picker`群 — 4件のまま変更なし

`group-picker-list` / `group-picker-input` / `group-picker-add-btn`（3件）＋
本体`group-picker`＝**4件**。DOM調査文書の記載と一致し、訂正の必要はない
`[事実]`。

### 4.4 訂正後の合計

`project-info-modal`（10、訂正後）＋`set-name-modal`（8）＋`group-picker`
（4）＝**22件**（ID基準）。DOM調査文書の「21件」は、この1件の集計ミスにより
1件少なく記載されていたことになる`[事実]`。

**呼び出し元数の補足**: DOM調査文書4.2節は`set-name-modal`について
「開く関数自体は無guardだが、全呼び出し元3箇所がそれぞれ`assertEditorMode()`
を呼ぶ」と記載していたが、現時点の`script.js`で`openSetNameModal(`の呼び出しは
`saveCurrentCompareSet()`（`assertEditorMode('比較セット保存')`でガード、
script.js:2800）と`renameCompareSet()`（`assertEditorMode('比較セット名変更')`
でガード、script.js:2879）の**2箇所のみ**確認できた。いずれもガード済みで
あり、この点は結論（安全である）に影響しないが、呼び出し元数の記載
（3箇所）は現時点のコードでは2箇所である`[事実]`。

---

## 5. 監査結果: 3群以外に同種パターンを持つUIが存在するか `[事実]`

`assertEditorMode()`32箇所・`canMutateProject()`18箇所の全呼び出しと、
モーダル/パネル/メニュー等候補31件のIDを個別に確認した結果、**新規に
静的ID（`index.html`内の`id="..."`）を持つ「CSSクラス無し・関数レベル
ガード」のUI群は見つからなかった**。既存の3群（訂正後合計22件）が
引き続き該当する全てである`[事実]`。

確認した候補のうち、Editor専用ではなくCommonであると確認できた主な例
（すでにDOM調査文書4.3節が確認済みの`clear-all-btn`/`import-modal`一式に
加えて、本監査で新たに個別確認したもの）:

| ID/群 | 開閉関数 | 確認結果 |
|---|---|---|
| `compare-sets-panel`/`compare-sets-list`/`compare-sets-empty` | `renderCompareSets()` | ガード無し。一覧表示・保存済みセットを開く（`restoreCompareSet()`）操作はCommon。削除・名称変更は動的生成される`.editor-only`ボタン経由でEditor専用（5.1節参照） |
| `dirty-confirm-modal`一式 | `confirmUnsavedChanges()` | 明示的な`assertEditorMode()`/`canMutateProject()`呼び出しは無い。`projectDirty`が真の時のみ表示され、Viewerは構造的にdirtyになり得ない設計（既存事実）に依存する間接的な状態依存であり、DOM調査文書の定義する「関数レベルガード」パターン（呼び出し元での明示的なmode判定）とは異なる。本監査では明示的ガードが無い以上Common候補のまま維持する`[提案]` |
| `error-overlay` / `loading-overlay` / `scene-fade-overlay` / `viewer-drop-overlay` | `showError()`/`showLoadingOverlay()`等 | ガード無し。モード非依存の共通インジケーター |
| `floormap-info-panel`とその子（`floormap-info-order`/`-name`/`-scene`/`-dir`） | `_updateInfoPanel()` | ガード無し。マーカー選択時の情報表示はCommon（Viewerでも閲覧可能）。ただし`floormap-info-order`のクリック時のインライン編集動作のみ`_startInfoOrderEdit()`内で`canMutateProject()`によりガードされる（5.2節参照、要素自体はCommonのまま） |
| `observer-panel`とその子（`obs-*`） | 各種VRハンドラ | ガード無し。Observer ModeはEditor専用ではなくCommon（DOM調査文書9.1節ですでに確認済みの分類を再確認） |
| `picker-dropdown`一式（`picker-btn-a`/`-b`/`picker-dropdown-list`/`picker-name-a`/`-b`/`picker-thumb-a`/`-b`） | `openPicker(side)` | ガード無し。比較A/Bスロットに表示するシーンの選択は閲覧操作でありCommon |
| `quick-help-modal`一式 | `openQuickHelp()` | ガード無し。ヘルプ表示はCommon |

いずれも、DOM調査文書4.2節が定義する「CSS上は`.editor-only`が無いが、
開く関数自体（または全呼び出し元）に明示的な`assertEditorMode()`/
`canMutateProject()`ガードがある」という基準には該当せず、Common候補の
ままとする`[事実に基づく評価]`。

---

## 6. 新規に判明した参照（ID基準の集合には含まれないが記録する） `[事実]`

3群以外に**静的IDを持つ**新規のEditor専用グループは見つからなかったが
（5節）、動的に生成されるDOM（`index.html`に静的IDを持たない）について、
3群と同種の「関数レベルガード」パターンを持つ例が1件見つかった。ID基準の
集計（184/22/135、7節参照）には含まれないが、設計上の参考情報として記録
する。

### 6.1 マーカー右クリックコンテキストメニュー（`.mk-ctx-menu`）

- **ID**: 無し。`script.js`内で`document.createElement('div')`により
  その場で生成され、`class="mk-ctx-menu"`のみを持つ（`floormap-canvas`の
  `contextmenu`イベントハンドラ内、script.js:6259〜6324付近）
- **参照箇所**: `floormapCanvas.addEventListener('contextmenu', (e) => { ... })`
  （script.js:6259）
- **到達経路**: FloorMap上のマーカーを右クリックすると、メニューDOMが
  その場で生成され表示される
- **Editor専用と判断する根拠**: メニューDOMを生成する**前**に
  `if (!canMutateProject()) return;`（script.js:6262、コメント
  「every item in this menu mutates markers」）というガードがあり、
  Viewerモードではメニュー自体が一切生成されない。これは3群と全く同じ
  「関数の入口でガードし、ガード後でなければDOMを参照・生成しない」という
  設計原則の適用例である
- **実装影響**: **無し**。静的IDを持たないため、`index.html`から除去する
  対象にも、`viewer.html`のマークアップにも一切関係しない。本監査では
  この事実を実行時に確認するテストを1件追加した
  （`tests/e2e/phase2-section13-audit.spec.js`、Viewerモードでマーカーを
  右クリックしても`.mk-ctx-menu`が作られないことを確認）

### 6.2 動的生成される`.editor-only`ボタン（複数箇所、参考情報）

シーン一覧（`renderSceneList()`のグループ/差替え/削除ボタン）・平面図一覧
（`renderFloorplanList()`の削除ボタン）・比較セット一覧
（`renderCompareSets()`の名称変更/削除ボタン）は、いずれも
`document.createElement()`でボタンを生成する際に`class`へ`editor-only`を
動的に付与している（静的IDは持たない）。既存の
`.mode-viewer .editor-only { display: none !important; }`（style.css）が
そのまま適用されるため、CSS側の追加対応は不要であり、`viewer.html`が
`script.js`/`style.css`を共有するという設計比較文書の推奨案（案2）とも
矛盾しない`[事実に基づく評価]`。これらもIDを持たないため184件の集計には
含まれない。

---

## 7. ID基準の分類値の確定 `[事実]`

**単位はDOM調査文書2.7節・設計比較文書2節と同じくID基準（184を分母とする
集計）を用いる。**

| カテゴリ | 件数 | 確度 |
|---|---|---|
| ①＋② CSSベースEditor専用（ID基準） | 27 | 確定値（変更なし） |
| ④ 関数レベルガードEditor専用（ID基準） | **22**（21から訂正） | **確定値**（本監査により、4.1節の1件の集計ミスを訂正し、5節で3群以外に新規の静的ID群が無いことを確認したため、暫定から確定へ） |
| Editor専用合計（①＋②＋④、ID基準） | **49**（48から訂正） | **確定値** |
| Common候補（184－49－0、ID基準） | **135**（136から訂正） | **確定値** |
| ⑥ Viewer専用（`.viewer-only`実使用） | 0 | 確定値（変更なし） |

**184件との検算**: 27（①②）＋22（④）＋135（Common候補）＋0（Viewer専用）
＝184。一致する`[事実]`。

**重要な注意（前回の「49」「135」との違い）**: 設計比較文書（PR #39）の
初版は、①②③（HTMLノード基準の28）と④（ID基準の21）を誤って合算し、
「49」「135」という単位不整合の値を一時的に導出していたが、その後の修正で
「単位の異なる値は合算しない」方針に訂正し、ID基準の48・136（いずれも
暫定）を正式な値とした。**本文書で確定した49・135は、それとは全く別の
経路（④の集計ミス訂正、単位はすべてID基準で一貫）から導出された、独立に
正しい値である。** 数字が同じ「49」「135」に見えるが、導出根拠が異なる
ことを明記する。

- ③（id無しコンテナ`floormap-info-actions`本体、1件）は引き続き184の外側の
  別集計単位（HTMLノード基準）であり、この184/22/135のID基準集計には
  含めない。`viewer.html`へ実際に反映する際は、ID基準49件の除去に加えて
  この1件（HTMLノード）も併せて物理的に除去する対象となる（設計比較文書
  4.3節の扱いを維持）

---

## 8. `viewer.html`へ含めるCommon候補数 `[事実]`

7節の確定値により、`viewer.html`が含めるべきCommon要素数は**135件（ID基準、
確定）**に確定する。設計比較文書が暫定としていた136は135へ更新する。

---

## 9. PR-Bへ渡す削除対象一覧 `[事実]`

### 9.1 確定値（除去してよいと確定した対象）

- CSSベースEditor専用27件（①19＋②8、ID基準）— Phase 3で全件null-guard対応
  済み
- 関数レベルガードEditor専用22件（`project-info-modal`群10・`set-name-modal`群8・
  `group-picker`群4、ID基準）— いずれも開く関数（または全呼び出し元）が
  `assertEditorMode()`をDOM参照より前に呼んでおり、本監査により3群以外の
  新規該当グループが無いことを確認済み
- id無しコンテナ`floormap-info-actions`本体1件（HTMLノード基準、184の外）

**確定値の合計（除去対象）**: ID基準49件＋HTMLノード基準1件

### 9.2 未確定値

- 本監査の時点で、確定値として残っている未確定事項は**無い**。DOM調査
  文書13節が求めていた「3群以外の同種パターンの網羅確認」は5節で完了し、
  4.1節の集計ミスも訂正済みである
- ただし、本監査もあくまで現時点の`script.js`に対する`grep`＋個別コード
  読解による確認であり、将来`script.js`に新たな関数追加・改修が入った
  場合は、その変更が同種のパターンを追加しないか個別に再確認する必要が
  残る`[提案]`。これは「未確定値」ではなく「今後の変更に対する運用上の
  注意」として区別する

---

## 10. 既知の未対応事項（引き続き分離して記載） `[未検証]`

以下は本監査でも解消されない、独立した未対応事項である。
**これらが「対応済み」であるとは記載しない。**

- `applySceneFlip()`内の`flipBtn`/`flipABtn`/`flipBBtn`参照（script.js:3107,
  3111, 3115）は依然として無guardのままである。本監査の対象外であり、
  未対応のまま残る
- 本監査は「CSSクラス無し・関数レベルガード」パターンの網羅確認に限定
  しており、既存のCSSベース27件・null-guard対応状況（Phase 3で完了済み）
  自体の再検証は行っていない

---

## 関連

- `docs/ViewerEditor_DOM_Responsibility_Investigation.md`（Phase 2調査。
  4.2節・13節の対象文書）
- `docs/ViewerEditor_DOM_Separation_Design_Comparison.md`（設計比較文書。
  PR-Aとして本監査を要求していた文書。本監査の結果を反映して更新する）
- `docs/ViewerEditor_Phase3_Implementation_Plan.md` / 各G1〜G6実装PR
- `tests/e2e/phase2-section13-audit.spec.js`（本監査で追加した確認テスト）
