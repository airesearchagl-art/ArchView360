# viewer.html DOM分離の完了記録（旧: 24件残置の既知の未対応事項）

このドキュメントは`viewer.html`（`feat: add minimal viewer html entry point`,
PR #41）に付随する記録である。当初のPRは`index.html` / `script.js` /
`style.css` / `package.json` / ワークフロー / `obsidian-vault`を一切変更せず、
確定Editor専用49件のうち24件を`script.js`未変更のため意図的に`viewer.html`に
残置していた。本記録はそのフォローアップとして、`script.js`に最小限の
null-guardを追加した上で、残置していた24件を含む確定Editor専用49件を
全て`viewer.html`から除去した経緯をまとめる。

- 確認時点のmain HEAD: `1ac204592f6ada8c12e90f875960692ba1ef3ea4`（PR #40
  merge commit、Phase 2文書13節監査完了時点。本フォローアップの間、mainに
  新規コミットは無い）
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

- `script.js`に、以下の3群・5+2箇所の無条件参照に対する最小限の
  null-guard（`if (element) element.addEventListener(...)`等の形）を追加した。
- これにより、`viewer.html`から確定Editor専用49件（CSSベース27＋関数レベル
  ガード22）を**全件除去**した。`app-mode-toggle-btn`（確定49件外、設計判断）
  および id無しコンテナ`floormap-info-actions`本体も引き続き除去済み。
- `viewer.html`の総ID数は`184 − 49 − 1(app-mode-toggle-btn) = 134`。
  `index.html`の184件から重複なく完全に部分集合であることを`comm`コマンドで
  機械的に検証済み（4節参照）。
- `index.html`は本フォローアップでも一切変更していない。全ガードは
  「要素が存在しない場合のみ処理をスキップする」形であり、既存要素が
  常に存在する`index.html`側の挙動に変化は無い。

---

## 1. 追加したnull-guard一覧（script.js） `[事実]`

当初のPRで判明した5箇所に加え、その後のfail-firstテストで**追加で2箇所**
（各モーダル自身のボタン配線）が無条件参照であることが判明した。
既存の`outside-click-to-close`ハンドラだけでなく、モーダルの
close/cancel/save/okボタン自体のイベント登録も、開く側の入口関数
（`openXxxModal()`）の外側で無条件に行われていたためである。

### 1.1 project-info-modal群（10件除去）

- `script.js:6762-6767`（旧`6759-6764`付近）: `pi-close-btn` /
  `pi-cancel-btn` / `pi-save-btn`のクリックハンドラ登録を、それぞれ
  `const piCloseBtn = $('pi-close-btn'); if (piCloseBtn) ...`の形で
  null-guard。**当初のPR文書には無かった発見**（外側クリックハンドラのみ
  記載されていたが、ボタン自身の配線も無条件だった）。
- `script.js:6768-6772`（旧`6763-6764`）: `project-info-modal`要素への
  外側クリックハンドラ登録を`const projectInfoModalEl = $(...); if
  (projectInfoModalEl) { ... }`でnull-guard（当初PR文書記載の箇所）。
- `openProjectInfoModal()` / `saveProjectInfo()` / `closeProjectInfoModal()`
  内部の`pi-name`等5フィールド・`project-info-modal`自体への参照は、
  いずれも`assertEditorMode()`ガード済みの入口（`projectInfoBtn`の
  クリックハンドラ、既に`if (projectInfoBtn)`でガード済み）からのみ
  到達するため、`viewer.html`では到達不能であることを確認済み
  （`openProjectInfoModal`の呼び出し箇所は`script.js`内でこの1箇所のみ）。

### 1.2 set-name-modal群（8件除去）

- `script.js:2742-2744`: `setNameOkBtn` / `setNameCancelBtn` /
  `setNameCloseBtn`のクリックハンドラ登録をnull-guard。**当初のPR文書には
  無かった発見**。
- `script.js:2745`: `setNameModal`への外側クリックハンドラ登録をnull-guard
  （当初PR文書記載の箇所）。
- `script.js:2746`: `setNameInput`のkeydownハンドラ登録をnull-guard。
  **当初のPR文書には無かった発見**。
- `script.js:3405`: グローバルキーボードショートカットハンドラ内の
  `setNameModal.style.display !== 'none'`参照を`setNameModal &&
  setNameModal.style.display !== 'none'`にnull-guard（当初PR文書記載の
  箇所）。`viewer.html`では`setNameModal`が常に`null`のため、この条件は
  常に`false`となり、以降の各ショートカット（矢印キー・R・A・F・M・C・S・
  V等）は modal-open チェックを素通りして正常に動作する。
- `openSetNameModal()`内部の`setNameModalTitle`等の参照は、呼び出し元
  （`saveCompareSet()`・`renameCompareSet()`、いずれも`assertEditorMode()`
  ガード済み）からのみ到達するため、`viewer.html`では到達不能であることを
  確認済み（`openSetNameModal`の呼び出し箇所は`script.js`内でこの2箇所の
  み）。

### 1.3 group-picker群（4件除去）

- `script.js:6703-6725`（旧`6700-6724`）: `group-picker-add-btn`の
  クリックハンドラと`group-picker-input`のkeydown/clickハンドラの登録を
  `if (groupPickerInput && groupPickerAddBtn) { ... }`でまとめてnull-guard
  （当初PR文書記載の箇所）。
- `openGroupPicker()`・`_onGroupPickerOutside()`・`closeGroupPicker()`・
  `_renderGroupPickerList()`は、いずれも`assertEditorMode()`ガード済みの
  入口（`openGroupPicker()`自身、または`closeGroupPicker()`経由）からのみ
  到達し、かつ内部で`$('group-picker')`を都度再取得した上でnull-checkを
  伴う（`if (picker) ...`）ため、既存のまま安全であることを再確認済み。

### 1.4 flip-a-btn / flip-b-btn（2件除去）

- `script.js:2625-2626`: `updateCompareSelects()`内の`flipABtn.classList.
  toggle(...)` / `flipBBtn.classList.toggle(...)`をnull-guard（当初PR
  文書記載の箇所）。`enterSplitMode()`/`enterSliderMode()`から無条件に
  呼ばれるCommon機能だが、要素が存在しない場合は単に見た目の更新を
  スキップするだけで、機能自体（比較モードへの入場）は影響を受けない。
- `script.js:3107,3111,3115`（`applySceneFlip()`内）: `flipBtn` /
  `flipABtn` / `flipBBtn`への参照を同様にnull-guard。Phase 3
  （G1/G3監査文書・本文書旧版）で「既知の未対応事項」として静的な読解の
  みで済まされていた箇所だが、本フォローアップで実際にguardを追加し、
  併せてfail-first的な再検証（4節）も行った。

---

## 2. 除去した49件の内訳（最終確定） `[事実]`

`viewer.html`から除去した49件（＋app-mode-toggle-btn 1件、＋id無し
コンテナ1件）:

**CSSベースEditor専用27件**:
```
add-floorplan-btn, add-img-btn, add-scene-btn, export-json-btn,
export-package-btn, flip-a-btn, flip-b-btn, flip-btn, floormap-del-mk,
floormap-orient-bar, floormap-orient-l, floormap-orient-preset,
floormap-orient-r, floormap-orient-val, floormap-place-btn,
floormap-rename-btn, floormap-reseq-btn, floormap-rot-l, floormap-rot-r,
import-json-btn, import-package-btn, project-info-btn, redo-btn,
save-set-btn, undo-btn, update-scene-btn, viewer-preview-btn
```

**関数レベルガードEditor専用22件**:
```
project-info-modal, pi-modal-title, pi-close-btn, pi-name, pi-client,
pi-author, pi-date, pi-notes, pi-cancel-btn, pi-save-btn,
set-name-modal, set-name-modal-title, set-name-close-btn,
set-name-modal-info, set-name-input, set-name-modal-note,
set-name-cancel-btn, set-name-ok-btn,
group-picker, group-picker-list, group-picker-input, group-picker-add-btn
```

**設計判断による追加除去1件**: `app-mode-toggle-btn`（確定49件外、設計比較
文書4.3節）

**id無しで除去したノード1件**: `.floormap-info-actions`本体

---

## 3. Common候補135件との照合 `[事実]`

`viewer.html`は134件のユニークIDを持つ。`index.html`の184件から、上記の
確定49件＋`app-mode-toggle-btn`の計50件を除いた残りと完全に一致する
（`comm`コマンドによる集合差分で検証: `index.htmlのみに存在する50件` =
上記50件と完全一致、`viewer.htmlのみに存在するID` = 0件、`viewer.html`内の
重複ID = 0件）。

`viewer-preview-exit-btn`はCommon/状態依存として引き続き含まれる
（`app-mode-toggle-btn`を除去したため実質到達不能だが、要素自体は元々
Common分類でありDOM除去対象ではないため残置。設計・実装の変更なし）。

---

## 4. fail-firstによる再現確認 `[事実]`

本フォローアップでは、以下の手順でfail-first検証を行った:

1. `viewer.html`から確定Editor専用49件のうち残置していた24件を除去
   （`script.js`は未変更の状態）。
2. `tests/e2e/viewer-html-minimal.spec.js`を実行し、7件中6件が
   `TypeError: Cannot read properties of null (reading 'addEventListener')`
   で失敗することを確認（`setNameOkBtn.addEventListener(...)`
   （`script.js`旧`2742`行、`set-name-ok-btn`除去による）が最初に
   到達する失敗箇所であることをエラー内容から確認）。
3. 1節の全guardを`script.js`に追加。
4. 同テストを再実行し、機能面のテスト（init完走・Common機能・split/slider
   比較モード・app-mode-toggle-btn不在・safe-removed-ids不在）が全て成功
   することを確認。この時点で唯一失敗したのは「24件が存在する」という
   *当時のテスト側の古いアサーション*のみであり、`script.js`側の問題では
   ないことを確認した上で、テストを新しい状態（49件全て不在）に更新した。
5. `git stash`で一時的にguard追加前の`script.js`に戻し、同じ失敗が再現
   すること（3で確認した内容と同一）を再確認してから`git stash pop`で
   guard適用済みの状態に戻した。
6. 更新後の`tests/e2e/viewer-html-minimal.spec.js`（8テスト、split比較
   モードに加えslider比較モード・キーボードショートカットのテストを追加）
   が全件成功することを確認。

---

## 5. 未対応のまま残る事項 `[事実]`

- 本文書1節のguardはいずれも「要素が無ければ何もしない」という最小限の
  ものであり、`script.js`の大規模なリファクタリングは行っていない。
- 本フォローアップの監査は、あくまで現時点の`script.js`に対する`grep`＋
  個別コード読解＋fail-firstテストによる確認であり、将来`script.js`に
  新たな関数追加・改修が入った場合は、その変更が同種のパターン
  （開く関数の外側での無条件DOM参照）を新たに追加しないか個別に再確認
  する必要が残る`[提案]`。
- Viewer URLの直接アクセスは、セキュリティ境界やアクセス制御を意味する
  ものではない（`viewer.html`は静的ファイルであり、誰でも直接開ける）。
  これは当初PRから変更のない前提であり、本フォローアップでも変更していない。

---

## 関連

- `docs/ViewerEditor_DOM_Separation_Design_Comparison.md`（案2採用の設計比較、PR #39）
- `docs/ViewerEditor_Phase2_Section13_Audit.md`（確定49/135件の根拠、PR #40）
- `docs/ViewerEditor_Phase3_Implementation_Plan.md`
- `tests/e2e/viewer-html-minimal.spec.js`（本文書が参照する回帰テスト）
- `viewer.html` / `script.js`（本文書が説明する変更箇所）
