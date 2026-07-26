# viewer.html 既知の未対応事項（confirmed 49件のうち24件を意図的に残置）

このドキュメントは`viewer.html`追加PR（`feat: add minimal viewer html entry point`）
に付随する記録であり、実装は含まない。`index.html` / `script.js` / `style.css` /
`package.json` / ワークフロー / `obsidian-vault` は一切変更していない。本PRの
fail-firstテストで判明した事実の記録と、フォローアップPR（script.js変更を伴う、
本PRの範囲外）への引き継ぎ事項をまとめる。

- 確認時点のmain HEAD: `1ac204592f6ada8c12e90f875960692ba1ef3ea4`（PR #40 merge commit、
  Phase 2文書13節監査完了時点）
- `appVersion`: `2.22.0`（変更なし）
- 前提として以下を参照する:
  - `docs/ViewerEditor_DOM_Separation_Design_Comparison.md`（案2採用の設計比較、PR #39）
  - `docs/ViewerEditor_Phase2_Section13_Audit.md`（確定値の根拠、PR #40。
    CSSベースEditor専用27・関数レベルガードEditor専用22・Common候補135・
    確定Editor専用合計49）

以下、各項目は次の3種類を明示的に分けて記載する。

- `[事実]` — 実際のコード・行番号を確認した上での記述。
- `[提案]` — 本文書で考案した評価・分類。まだ確定していない。
- `[未検証]` — 本文書の範囲では確認していない・検証していない事項。

---

## 0. 結論の要約 `[事実]`

- `viewer.html`は`index.html`の184件のユニークID中、**26件**（CSSベースEditor専用
  25件＋`app-mode-toggle-btn`1件）とid無しコンテナ`floormap-info-actions`本体を
  除去した状態で新規作成した。結果として158件のIDが残る。
- 確定Editor専用49件（CSSベース27＋関数レベルガード22）のうち、**24件は本PRでは
  除去せず`viewer.html`に残置した**。理由は、これらのDOM要素が
  `openXxxModal()`/`openGroupPicker()`のガード済み入口関数の**外側**で、
  script.jsの複数箇所から無条件に参照されており、DOM要素ごと除去すると
  `script.js`側にnull-guardを追加しない限り`TypeError`で`init()`または
  Common機能（分割比較モード等）がクラッシュすることが、本PR自身が要求する
  fail-firstテストで実際に確認されたためである。
- `script.js`は本PRでは一切変更していない。したがって24件の残置は
  「対応済み」ではなく、**未対応のまま次PRに引き継ぐ**。

---

## 1. 除去した26件（安全と確認済み） `[事実]`

CSSベースEditor専用27件のうち、`flip-a-btn`/`flip-b-btn`を除く25件
（`flip-btn`（シングル表示用）を含む）。`flip-btn`は`flip-a-btn`/
`flip-b-btn`と同じ`.editor-only`クラスを持つが、その参照元
`toggleFlipSingle()`自体が`if (!assertEditorMode('左右反転')) return;`
（`script.js:3123`）で入口ガードされており、`applySceneFlip()`内の
`flipBtn.classList.toggle(...)`（`script.js:3107`）に到達する前に
Viewer側では必ず`return`する。グローバルキーボードハンドラの`M`キー
（`script.js:3427`）は`toggleFlipSingle()`をボタンの存在に関係なく
無条件に呼び出すが、上記ガードにより安全に`return`することを、
`viewer.html`に読み込ませた状態で実際に`m`キーを送信して確認済み
（コンソール・ページエラー0件）。よって`flip-btn`は除去して問題ない。
一方`flip-a-btn`/`flip-b-btn`は、その参照元`updateCompareSelects()`に
このような入口ガードが無い（2.4節）ため除去できず残置する。
加えて設計判断として`app-mode-toggle-btn`（確定49件外、
設計比較文書4.3節）を除去した。

除去したID一覧（26件）:

```
add-floorplan-btn, add-img-btn, add-scene-btn, app-mode-toggle-btn,
export-json-btn, export-package-btn, floormap-del-mk, floormap-orient-bar,
floormap-orient-l, floormap-orient-preset, floormap-orient-r,
floormap-orient-val, floormap-place-btn, floormap-rename-btn,
floormap-reseq-btn, floormap-rot-l, floormap-rot-r, import-json-btn,
import-package-btn, project-info-btn, redo-btn, save-set-btn, undo-btn,
update-scene-btn, viewer-preview-btn
```

id無しで除去したノード: `.floormap-info-actions`本体（`floormap-rename-btn`/
`floormap-rot-l`/`floormap-rot-r`/`floormap-del-mk`を包む`div`。上記26件中の
4件はこのコンテナの子要素）。

これらは`script.js`内の全参照箇所（`addEventListener`登録・関数内DOM操作の
両方）を個別に洗い出し、いずれも次のいずれかの形で安全と確認した:

- 参照が対応するボタン自身の（今回除去する）guarded click handlerの内側に
  限られる（例: `undo-btn`/`redo-btn`は`updateHistoryControls()`が
  `if (!undoBtn || !redoBtn) return;`で全体をガードしている、`script.js:970-974`）
- 参照元の関数自体が呼び出されるトリガーが、今回除去するボタン以外に
  存在しない（floormap-orient-*系、Phase 3 G5監査で確認済みの既存ガード、
  `script.js:5867-5871`, `6625-6642`）
- 既存の防御的null-guardが付いている（`floormapPlaceBtn`: `script.js:6483`、
  `floormapRenameBtn`: `script.js:6304`、Phase 3 G6由来）

---

## 2. 残置した24件と、その根拠となったfail-first発見 `[事実]`

### 2.1 project-info-modal群（10件）

対象ID: `project-info-modal`, `pi-modal-title`, `pi-close-btn`, `pi-name`,
`pi-client`, `pi-author`, `pi-date`, `pi-notes`, `pi-cancel-btn`, `pi-save-btn`

- 開く側の入口（`openProjectInfoModal()`)自体は`projectInfoBtn`のclickに
  紐付き、そのボタンは`if (projectInfoBtn) ...`でガードされている
  （`script.js:6759`）ため、この経路は元から安全。
- しかし`script.js:6763-6764`に、同モーダルへの**無条件**の外側クリック
  ハンドラが別途登録されている:
  ```js
  $('project-info-modal').addEventListener('click', (e) => {
    if (e.target === $('project-info-modal')) closeProjectInfoModal();
  });
  ```
  `project-info-modal`要素そのものを除去すると、`init()`実行中にこの行で
  `TypeError: Cannot read properties of null (reading 'addEventListener')`
  が発生し、以降の全てのイベント登録（Common機能含む）が完走しない。

### 2.2 set-name-modal群（8件）

対象ID: `set-name-modal`, `set-name-modal-title`, `set-name-close-btn`,
`set-name-modal-info`, `set-name-input`, `set-name-modal-note`,
`set-name-cancel-btn`, `set-name-ok-btn`

- `script.js:2745`に同様の無条件の外側クリックハンドラが存在:
  ```js
  setNameModal.addEventListener('click', (e) => {
    if (e.target === setNameModal) _closeSetNameModal(false);
  });
  ```
  （`setNameModal`は`script.js:253`でトップレベルの`$('set-name-modal')`
  として取得）
- さらに深刻な発見として、`script.js:3405`のグローバルキーボードショート
  カットハンドラ（Arrow/R/A/F/M/C/S/V/Esc等、Common機能の主要な操作導線）が
  無条件に`setNameModal.style.display !== 'none'`を読んでいる。
  `set-name-modal`要素を除去すると、`setNameModal`が`null`になり、この
  グローバルキーボードハンドラが**全てのキーボードショートカット**で
  `TypeError`を投げる。これはCommon機能への影響が最も広いパターンの一つ。

### 2.3 group-picker群（4件）

対象ID: `group-picker`, `group-picker-list`, `group-picker-input`,
`group-picker-add-btn`

- `openGroupPicker()`自体は`script.js:2129`で
  `if (!assertEditorMode('グループ編集')) return;`によりガードされており、
  また外側クリックハンドラ`_onGroupPickerOutside()`（`script.js:2135-2145`
  付近）はローカル変数として`$('group-picker')`を都度再取得し
  `if (picker && !picker.contains(e.target))`のnull-checkを伴う。この2つの
  経路自体は安全。
- しかし`script.js:6700-6724`（「Group picker add button wiring」）に、
  `group-picker-add-btn`のclickハンドラと`group-picker-input`のkeydown/click
  ハンドラが、`openGroupPicker()`のガードの**外側**で`init()`実行時に
  無条件で`addEventListener`登録されている:
  ```js
  const groupPickerInput = $('group-picker-input');
  const groupPickerAddBtn = $('group-picker-add-btn');
  groupPickerAddBtn.addEventListener('click', (e) => { ... });
  groupPickerInput.addEventListener('keydown', ...);
  groupPickerInput.addEventListener('click', ...);
  ```
  これらの要素を除去すると`init()`中に`TypeError`が発生する。

### 2.4 flip-a-btn / flip-b-btn（2件）

- `script.js:2612-2627`の`updateCompareSelects()`が無条件に
  `flipABtn.classList.toggle(...)` / `flipBBtn.classList.toggle(...)`を実行
  する。この関数は`enterSplitMode()`（`script.js:2504`付近）と
  `enterSliderMode()`（`script.js:2564`付近）の両方から呼ばれ、これらは
  分割比較モード／スライダー比較モードへの入場という、**日常的に使われる
  Common機能そのもの**（キーボードショートカットC/S含む）である。
  `flip-a-btn`/`flip-b-btn`を除去すると、比較モードに入るたびに
  `TypeError: Cannot read properties of null (reading 'classList')`が発生する。
  49件の中で最もCommon機能への影響が大きい発見であり、専用のfail-first
  テスト（下記4節）で個別に再現・確認した。

---

## 3. Common候補135件との照合 `[事実]`

`viewer.html`は158件のユニークIDを持つ。内訳:

- Common候補135件（DOM調査文書・PR #40確定値） — 全件存在
- `viewer-preview-exit-btn`（Common/状態依存、`app-mode-toggle-btn`を除去した
  ため実質到達不能だが、要素自体は元からCommon分類でありDOM除去対象では
  ないため残置。設計・実装の変更なし）
- 上記2節の残置24件（本来はEditor専用だが、script.js非変更のため物理的に
  除去できないもの）

`app-mode-toggle-btn`はCommon候補135件には含まれない（元々`app-mode-switch`
グループの一部としてCommon/状態依存に分類されていたが、設計比較文書4.3節の
判断により本PRでは意図的に除去対象とした）。

除去した26件・id無し1件は、確定Editor専用49件・135件のいずれとも重複しない
ことを確認済み（`grep`によるID集合の`comm`差分で検証、0件の予期しない
過不足）。

---

## 4. 専用fail-firstテストによる再現確認 `[事実]`

flip-a-btn/flip-b-btnの発見（2.4節）についてのみ、他の3群と切り離した
専用のfail-first再現を行った:

1. `viewer.html`を`/tmp/viewer_good.html`にバックアップ。
2. Pythonスクリプトで`flip-a-btn`/`flip-b-btn`の2要素のみを一時的に除去。
3. `tests/e2e/viewer-html-minimal.spec.js`の「分割比較モード」テストのみを
   実行し、予測どおり`TypeError: Cannot read properties of null
   (reading 'classList')`が発生することを確認。
4. `/tmp/viewer_good.html`から復元し、`diff`でバイト同一であることを確認。
5. 同テストを再実行し、パスすることを確認。

他の3群（project-info-modal / set-name-modal / group-picker）については、
`viewer.html`全体を一時的に退避するfail-first（本PRのテスト一式で共通に
実施）の過程で、除去した状態のテスト失敗として発見した。個別の分離
fail-firstは行っていない `[未検証・次PRへの申し送り]`。

---

## 5. 未対応のまま残る事項 `[事実]`

- 本2節の24件は、`script.js`側に対応するnull-guard（または該当ハンドラの
  ガード内への移設）を追加しない限り、`viewer.html`から除去できない。
  この`script.js`変更は本PRの範囲外であり、フォローアップPRで扱う。
- `applySceneFlip()`（`script.js:3102-3117`）内の`flipBtn`/`flipABtn`/
  `flipBBtn`への無条件参照は、Phase 3（G1/G3）で既に「既知の未対応事項」
  として文書化済みのものであり、本PRでも引き続き未対応のままである。
  本PRでは呼び出し経路（`toggleFlipSingle()`/`toggleFlipCompare()`は
  除去済みボタンのguarded click handlerからのみ呼ばれる、
  `performUndo()`/`performRedo()`は`canMutateProject()`必須かつ
  flip系のhistoryエントリを`viewer.html`単体では生成しえない）から
  到達しないと判断したが、これは静的な読解による判断であり、専用の
  fail-firstによる実行時再検証は行っていない `[未検証]`。
- フォローアップPRで24件を実際に除去するには、最低限次の`script.js`変更が
  必要になる見込み `[提案]`:
  - `script.js:6763-6764`（project-info-modal外側クリック）にnull-guard追加
  - `script.js:2745`（set-name-modal外側クリック）にnull-guard追加
  - `script.js:3405`（グローバルキーボードハンドラの`setNameModal`参照）に
    null-guard追加
  - `script.js:6700-6724`（group-picker-add-btn/input配線）にnull-guard追加
  - `script.js:2612-2627`（`updateCompareSelects()`のflipA/B参照）に
    null-guard追加

---

## 関連

- `docs/ViewerEditor_DOM_Separation_Design_Comparison.md`（案2採用の設計比較、PR #39）
- `docs/ViewerEditor_Phase2_Section13_Audit.md`（確定49/135件の根拠、PR #40）
- `docs/ViewerEditor_Phase3_Implementation_Plan.md`
- `tests/e2e/viewer-html-minimal.spec.js`（本文書が参照する回帰テスト）
- `viewer.html`（本文書が説明する残置箇所のHTMLコメント）
