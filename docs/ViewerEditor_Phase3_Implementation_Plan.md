# Viewer/Editor分離 Phase 3: 実装計画（v2.22.0時点）

このドキュメントは計画策定専用であり、実装は含まない。`index.html` /
`script.js` / `style.css` / `package.json` / ワークフロー / 既存テスト /
`obsidian-vault` は一切変更していない。

- 計画策定時点のmain HEAD: `9fff7172e3c953d932b69ad434534daa3573bb03`（PR #30 merge commit）
- `appVersion`: `2.22.0`（変更なし）
- 前提: `docs/ViewerEditor_DOM_Responsibility_Investigation.md`（PR #30、Phase 2
  「DOM責務分類調査」。以下「Phase 2調査文書」と呼ぶ）の結果を前提知識として
  参照し、本文書ではPhase 2で確定・確認済みとされた事実を再調査しない

以下、各項目はPhase 2調査文書と同じ表記規則に従い、`[事実]` / `[提案]` /
`[未検証]`を付す。本文書で新たに`[事実]`として述べる内容は、Phase 2調査文書
本体には含まれていない、本計画策定作業中に確認した既存テストカバレッジの
調査結果である（4節参照）。

---

## 1. Phase 2調査結果の要約 `[事実]`

Phase 2調査文書（PR #30、確定・確認済み事項のみを要約する）:

- `index.html`のユニークID数は184件（確定値）
- CSSベースEditor専用（`.editor-only`直接付与19＋継承8）は**27件**（確定値、
  `.editor-only`の全出現箇所をgrepで網羅したため）
- 27件中6件（22%）はguard済み（`if`×5、`?.`×1）、**残り21件（78%）は
  無guard**（確定値、6.1節）
- 無guard21件は「①DOM取得/呼び出しguard必要（複数箇所・非イベント用途）
  3件」＋「②イベント登録guard必要（単一の`addEventListener`のみ）18件」に
  分類される（確定値、6.2節）
- CSSクラスを持たないが関数レベルガードで安全な要素（`project-info-modal`系
  9・`set-name-modal`系8・`group-picker`系4、計21件）は別集合であり
  （4.2節「関数ガード系21件」）、①②の実装対象には含まれない（数字の
  「21」が2箇所で偶然一致するだけで、混同してはならない、2.4節）
- 上記21件（関数ガード系）と同様のパターンを持つ他のUIが存在するかは
  **未確認**であり（13節）、この網羅確認が完了するまでEditor専用48件・
  Common候補136件は暫定分類のまま（11節item3）。ただし①②（CSS無guard系
  21件、確定値）自体はこの未確認調査の結果に影響されない（6.4節）
- 6.3節: 無guard21件は現行の単一HTML構成では**現行不具合ではない**。
  将来、縮小版HTML（`viewer.html`相当）で該当DOMを物理的に除去した場合に
  限り問題になる安全化検討候補である
- 12節: 無guard21件は候補A（`project-info-btn`単独、1件、Pattern3で
  「最も脆弱」9.2節）／候補B（直接コントロール残り11件）／候補D
  （floormap方位補正・情報操作の2コンテナ関連、①3件＋②6件＝9件）に
  分割提案されている（A+B+D=21で一致）
- 9.2節: `project-info-btn`（変数キャッシュ無し・オプショナルチェイニング
  無し）は「対応の優先度が高い候補」と明記されている
- 9.2節: `floormap-orient-val`/`floormap-orient-preset`/`floormap-orient-bar`
  （①3件）は参照箇所が複数（2〜4箇所）にまたがるため、単純な1箇所の
  `if`追加では済まず、宣言直後にguardして以降の全参照をブロックする形が
  適切になる可能性がある

本計画は、この**確定値である無guard21件（①3＋②18）**を実装対象として、
機能単位のグループ化・実装順序・PR分割案を策定する。関数ガード系21件
（4.2節）は既に安全なため実装対象に含めない（Phase 2 4.2節・6.2節③④の
結論を踏襲）。

---

## 2. CSS無guard21件の機能単位グループ化 `[提案]`

Phase 2 6.2節の①②はガード方式（複数箇所参照か単一`addEventListener`か）
による分類だったのに対し、本節では実装単位を決めやすくするため、
**機能としての結びつき**を基準に6グループへ再編する。要素の集合自体は
Phase 2の①②21件と完全に一致し、過不足なく再分割したものである。

| グループ | 要素 | 件数 | Phase 2分類 | Phase 2候補との対応 |
|---|---|---|---|---|
| **G1: シーン一覧・ツールバー基本操作** | `add-scene-btn` / `add-img-btn` / `update-scene-btn` / `flip-btn` | 4 | すべて② | 候補Bの一部 |
| **G2: Import/Export（JSON）** | `export-json-btn` / `import-json-btn` | 2 | すべて② | 候補Bの一部 |
| **G3: 比較モード保存・反転** | `save-set-btn` / `flip-a-btn` / `flip-b-btn` | 3 | すべて② | 候補Bの一部 |
| **G4: プロジェクト情報・平面図追加** | `project-info-btn`（Pattern3、最も脆弱） / `add-floorplan-btn` | 2 | すべて② | `project-info-btn`＝候補A、`add-floorplan-btn`＝候補Bの一部 |
| **G5: FloorMap 方位補正エリア** | `floormap-orient-bar` / `floormap-orient-l` / `floormap-orient-val` / `floormap-orient-r` / `floormap-orient-preset` | 5 | ①3＋②2 | 候補Dの一部（方位補正コンテナ側） |
| **G6: FloorMap マーカー配置・情報操作エリア** | `floormap-place-btn` / `floormap-rename-btn` / `floormap-rot-l` / `floormap-rot-r` / `floormap-del-mk` | 5 | すべて② | `floormap-place-btn`＝候補Bの一部、残り4件＝候補Dの一部（情報操作コンテナ側） |

**検算**: 4+2+3+2+5+5 = 21（Phase 2 6.1節の無guard21件と一致）`[事実に基づく評価]`

G5とG6は、Phase 2候補Dの9件（方位補正コンテナ`floormap-orient-bar`本体＋
子4件、情報操作コンテナ`floormap-info-actions`の子4件）を、
「方位補正」と「マーカー配置・情報操作」という機能の違いで2つに分割した
ものである。`floormap-place-btn`はDOM構造上どちらのコンテナの子でもない
独立ボタンだが、機能的には「マーカーを配置する」操作でG6の残り4件
（配置済みマーカーの名称変更・回転・削除）と密接に関連するため、G6に含めた
`[提案]`。

---

## 3. 既存テストカバレッジ調査（本計画策定で新たに確認） `[事実]`

Phase 2調査文書は既存テストのカバレッジを対象にしていなかったため、本計画
策定にあたり `tests/e2e/*.spec.js` を対象に、G1〜G6の21要素それぞれについて
`id`セレクタでの参照有無をgrepで確認した（読み取りのみ、テストファイルは
変更していない）。

| グループ | 要素 | 既存テストでのclick操作 | 既存テストでの参照（可視性等のみ含む） |
|---|---|---|---|
| G1 | `flip-btn` | ✓（`compare-flip-history.spec.js`、`scene-flip-history.spec.js`） | ✓ |
| G1 | `add-scene-btn` | ✗ | ✓（`viewer-preview.spec.js`、可視性確認のみ） |
| G1 | `add-img-btn` / `update-scene-btn` | ✗ | ✗（既存テスト無し） |
| G2 | `export-json-btn` | ✓（`project-lifecycle.spec.js`、`smoke.spec.js`） | ✓（`viewer-preview.spec.js`含む） |
| G2 | `import-json-btn` | ✗ | ✗（既存テスト無し） |
| G3 | `flip-a-btn` / `flip-b-btn` | ✓（`compare-flip-history.spec.js`） | ✓（`viewer-preview.spec.js`含む） |
| G3 | `save-set-btn` | ✗ | ✗（既存テスト無し） |
| G4 | `project-info-btn` | ✓（`history-controls.spec.js`） | ✓ |
| G4 | `add-floorplan-btn` | ✓（`floormap-name-history.spec.js`、前提手順として） | ✓ |
| G5 | `floormap-orient-bar` / `-l` / `-val` / `-r` / `-preset` | ✗（5件すべて） | ✗（既存テスト無し） |
| G6 | `floormap-place-btn` / `-rename-btn` / `-rot-l` / `-rot-r` / `-del-mk` | ✗（5件すべて） | ✗（既存テスト無し） |

**要約**: G2・G3・G4はグループ内の主要要素が既存テストでclick操作されて
おり、guard追加後の回帰は既存テストで検知できる可能性が高い。G1は
`flip-btn`のみ既存カバレッジがあり、残り3件は無い。**G5・G6は該当10要素
すべてについて既存テストが存在しない**（`floormap-name-history.spec.js`は
FloorMap名称編集をdblclick/contentEditable経由でテストする別機能であり、
G5/G6のボタン群は対象にしていない）。

---

## 4. 最小リスクで実装できる順序の提案 `[提案]`

3節のカバレッジ調査とPhase 2 9.2節の脆弱性評価を踏まえ、以下の順序を提案する。

**推奨順序: G4 → G3 → G2 → G1 → G6 → G5**

1. **G4が最優先**: Phase 2 9.2節が名指しで「対応の優先度が高い候補」と
   評価した`project-info-btn`（Pattern3、変数キャッシュ無し・オプショナル
   チェイニング無し）を含む。同時に`project-info-btn`は
   `history-controls.spec.js`で、`add-floorplan-btn`は
   `floormap-name-history.spec.js`でそれぞれ既存click操作のカバレッジが
   あり、guard追加による既存動作への影響を既存テストで即座に検知できる
   安全網が既にある
2. **G3・G2が次点**: `flip-a-btn`/`flip-b-btn`/`export-json-btn`は既存
   click操作カバレッジが厚く、未カバーは`save-set-btn`/`import-json-btn`
   各1件のみ。要素数も少なく（G3=3件、G2=2件）、単一`addEventListener`
   （Phase 2②）のみのため実装自体も単純
3. **G1**: `flip-btn`は既存カバレッジがあるが、`add-scene-btn`は可視性
   確認のみ（click未検証）、`add-img-btn`/`update-scene-btn`は既存テスト
   無し。G2・G3より新規テスト作成の負担が大きいため、その後に配置する
4. **G6**: 5要素すべてに既存テストが無いが、いずれもPhase 2②（単一
   `addEventListener`）で実装パターン自体は単純。新規spec作成が前提となる
5. **G5が最後**: 5要素すべてに既存テストが無い**上に**、Phase 2 9.2節が
   指摘するとおり①3件（`floormap-orient-bar`/`-val`/`-preset`）は参照が
   複数箇所（2〜4箇所）にまたがり、単純な1箇所`if`追加では済まない
   （宣言直後にguardして以降の全参照をブロックする設計が必要）。
   「新規テストが必要」かつ「実装自体が最も複雑」の両方が重なるため、
   最もリスクが高いグループとして最後に置く

---

## 5. 実装単位ごとの詳細 `[提案]`

各グループについて、対象DOM／影響範囲／必要なnull-guard／想定テスト／
完了条件を示す。「必要なnull-guard」はPhase 2 6.2節①②の分類（複数箇所
参照か単一`addEventListener`か）に基づく`[提案]`であり、実際のguard文の
書き方（`if`か`?.`か）はPhase 2が示した既存guard済み6件の書き方
（4.1節）に倣うことを想定する。

### G4: プロジェクト情報・平面図追加

- **対象DOM**: `project-info-btn`（script.js:6758、Pattern3）、
  `add-floorplan-btn`（script.js:228）
- **影響範囲**: `project-info-btn`はキャッシュ無しのインライン
  `addEventListener`（他の参照箇所への影響なし、修正はこの1箇所のみ）。
  `add-floorplan-btn`はPattern1（`init()`冒頭でキャッシュ）
- **必要なnull-guard**: `project-info-btn`はまず変数キャッシュを追加した
  上で`if (projectInfoBtn) projectInfoBtn.addEventListener(...)`形式に、
  `add-floorplan-btn`は既存キャッシュ変数に対して同形式のguardを追加
- **想定テスト**: 既存の`history-controls.spec.js`（`project-info-btn`
  click）・`floormap-name-history.spec.js`（`add-floorplan-btn`click、
  前提手順）が回帰検知の役割を果たす。新規テストとしては、Viewer
  モードで両要素が非表示であることを確認する専用ケースの追加を検討する
  （現状は`.editor-only`により非表示自体は保証されているため必須では
  ない）
- **完了条件**: 既存テスト（`history-controls.spec.js`、
  `floormap-name-history.spec.js`）が引き続き成功すること。guard追加後も
  Editorモードでの動作（モーダルが開く・平面図追加ボタンが機能する）が
  変わらないこと

### G3: 比較モード保存・反転

- **対象DOM**: `save-set-btn`（script.js:172）、`flip-a-btn`
  （script.js:168）、`flip-b-btn`（script.js:169）
- **影響範囲**: 3件ともPattern1、単一`addEventListener`
- **必要なnull-guard**: 各変数に対して`if (xxx) xxx.addEventListener(...)`
  形式のguardを個別に追加
- **想定テスト**: `compare-flip-history.spec.js`・`viewer-preview.spec.js`
  が`flip-a-btn`/`flip-b-btn`の既存回帰検知となる。`save-set-btn`は
  既存テストが無いため、比較モードでのセット保存操作に対するclickベースの
  新規テストケースの追加を推奨する
- **完了条件**: `compare-flip-history.spec.js`・`scene-flip-history.spec.js`
  が引き続き成功すること。`save-set-btn`の新規テストが追加され成功すること

### G2: Import/Export（JSON）

- **対象DOM**: `export-json-btn`（script.js:229）、`import-json-btn`
  （script.js:230）
- **影響範囲**: 2件ともPattern1、単一`addEventListener`
- **必要なnull-guard**: 各変数に対して`if (xxx) xxx.addEventListener(...)`
  形式のguardを個別に追加
- **想定テスト**: `project-lifecycle.spec.js`・`smoke.spec.js`・
  `viewer-preview.spec.js`が`export-json-btn`の既存回帰検知となる。
  `import-json-btn`は既存テストが無いため、JSONインポート操作に対する
  clickベースの新規テストケースの追加を推奨する
- **完了条件**: `project-lifecycle.spec.js`・`smoke.spec.js`が引き続き
  成功すること。`import-json-btn`の新規テストが追加され成功すること

### G1: シーン一覧・ツールバー基本操作

- **対象DOM**: `add-scene-btn`（script.js:181）、`add-img-btn`
  （script.js:144）、`update-scene-btn`（script.js:145）、`flip-btn`
  （script.js:148）
- **影響範囲**: 4件ともPattern1、単一`addEventListener`
- **必要なnull-guard**: 各変数に対して`if (xxx) xxx.addEventListener(...)`
  形式のguardを個別に追加
- **想定テスト**: `compare-flip-history.spec.js`・`scene-flip-history.spec.js`
  が`flip-btn`の既存回帰検知となる。`add-scene-btn`は
  `viewer-preview.spec.js`で可視性確認のみのため、clickベースのテストへの
  拡張を推奨する。`add-img-btn`・`update-scene-btn`は既存テストが無いため
  新規追加が必要
- **完了条件**: `flip-btn`関連の既存テストが引き続き成功すること。
  `add-scene-btn`/`add-img-btn`/`update-scene-btn`のclickベース新規テストが
  追加され成功すること

### G6: FloorMap マーカー配置・情報操作エリア

- **対象DOM**: `floormap-place-btn`（script.js:201）、
  `floormap-rename-btn`（script.js:212）、`floormap-rot-l`
  （script.js:213）、`floormap-rot-r`（script.js:214）、
  `floormap-del-mk`（script.js:215）
- **影響範囲**: 5件ともPattern1、単一`addEventListener`。
  `floormap-rename-btn`/`-rot-l`/`-rot-r`/`-del-mk`は親コンテナ
  `floormap-info-actions`（`id`無し、Phase 2パターンB）の子であり、
  親コンテナのCSS非表示とscript.js側のguardは独立した別レイヤーである点に
  注意（親コンテナのCSS非表示が無guardの安全網にはならない）
- **必要なnull-guard**: 各変数に対して`if (xxx) xxx.addEventListener(...)`
  形式のguardを個別に追加
- **想定テスト**: 既存テストが5件とも無いため、FloorMapマーカーの配置・
  名称変更・回転・削除操作それぞれについて、新規specファイル（または
  既存`floormap-name-history.spec.js`の拡張）でのclickベーステスト追加が
  前提となる
- **完了条件**: 新規テストが追加され成功すること。特にEditorモードでの
  一連の操作（配置→名称変更→回転→削除）が既存のFloorMap名称変更機能
  （`floormap-name-history.spec.js`が対象とするdblclick経由の編集）と
  干渉しないことを確認する

### G5: FloorMap 方位補正エリア

- **対象DOM**: `floormap-orient-bar`（script.js:196、5867、5871）、
  `floormap-orient-l`（script.js:197、6625）、`floormap-orient-val`
  （script.js:199、5868、6632、6641）、`floormap-orient-r`
  （script.js:198、6626）、`floormap-orient-preset`（script.js:200、
  5869、6627、6631、6642）
- **影響範囲**: G5内で最も広い。`floormap-orient-bar`は`showEl`/`hideEl`
  で2箇所から開閉制御、`floormap-orient-val`は`.textContent`で3箇所から
  更新、`floormap-orient-preset`は`.value`取得/設定＋`addEventListener`で
  4箇所から参照される（Phase 2 4.1節）。単一箇所の`if`追加では他の参照
  箇所を見落とすため、変数宣言直後に一括guardし、以降の全参照箇所を
  ブロックする設計が必要（Phase 2 9.2節）
- **必要なnull-guard**: `floormap-orient-l`/`floormap-orient-r`は
  単一`addEventListener`のためG1〜G4と同形式で対応可能。
  `floormap-orient-bar`/`floormap-orient-val`/`floormap-orient-preset`は
  複数参照箇所すべてを洗い出した上で、共通のguard方針（例:
  宣言直後に存在確認し、以降のブロックすべてで同じ条件を再利用する、
  または各参照箇所に個別guardを追加する）を実装時に個別設計する必要が
  ある（本計画では設計方針の確定・実装は行わない）
- **想定テスト**: 既存テストが5件とも無いため、FloorMap方位補正UI
  （方位表示・左右回転・プリセット選択）に対する新規spec作成が前提となる。
  参照箇所が複数にまたがるため、テストも「表示直後」「操作後の再表示」
  など複数のタイミングでの確認が必要になる可能性が高い
- **完了条件**: 新規テストが追加され成功すること。複数参照箇所すべてで
  guardが一貫して機能することを確認する（1箇所のみguardして他を
  見落とす、という6.3節が警告するリスクを避ける）

---

## 6. 複数PRへの分割案 `[提案]`

4節の順序に沿って、**G1〜G6を1グループ1PRとする計6PR構成**を提案する。
本プロジェクトの既存の開発履歴（PR #20〜#25でHistoryManagerの接続を1操作
ずつ分割した前例、PR #28/#29でPhase 1調査と実装を分離した前例）を踏襲し、
1PRの変更範囲を小さく保つことを優先する`[提案]`。

| 順序 | PR | 内容 | 新規テスト作成の要否 |
|---|---|---|---|
| 1 | PR-G4 | `project-info-btn`（Pattern3対応含む）・`add-floorplan-btn`のguard追加 | 不要（既存テストで回帰検知可能、追加は任意） |
| 2 | PR-G3 | `save-set-btn`/`flip-a-btn`/`flip-b-btn`のguard追加 | `save-set-btn`のみ新規テスト推奨 |
| 3 | PR-G2 | `export-json-btn`/`import-json-btn`のguard追加 | `import-json-btn`のみ新規テスト推奨 |
| 4 | PR-G1 | `add-scene-btn`/`add-img-btn`/`update-scene-btn`/`flip-btn`のguard追加 | `add-scene-btn`（click拡張）/`add-img-btn`/`update-scene-btn`の新規テスト必要 |
| 5 | PR-G6 | FloorMapマーカー配置・情報操作4+1件のguard追加 | 5件とも新規テスト必要 |
| 6 | PR-G5 | FloorMap方位補正エリア5件のguard追加（複数参照箇所対応含む） | 5件とも新規テスト必要、参照箇所ごとの確認も必要 |

**代替案**: PR-G2とPR-G3はどちらも既存カバレッジが厚く要素数も少ない
（合計5件）ため、レビュー負担軽減のために1PRへ統合することも可能である。
ただし本計画では、各PRの差分を独立してロールバックできる状態を優先し、
6PR構成を第一候補として提案する`[提案]`。

---

## 7. 未確認の関数レベルガードUI調査（Phase 2 13節）との関係 `[提案]`

Phase 2 6.4節は次のように明記している:

> 未確認の関数レベルガードUIが新たに見つかった場合、③④の集合（現在21件）・
> 2.7節の48/136（Editor専用/Common候補）が変動する可能性があるが、
> **①②（CSSベースの無guard21件、確定値）の数には影響しない**

すなわち、Phase 2 13節の未確認事項（`project-info-modal`/`set-name-modal`/
`group-picker`以外に同様の関数レベルガードUIが存在するかの網羅確認、
Phase 2 12節候補E）は、本計画が対象とする**①②＝無guard21件（G1〜G6）の
集合・件数には影響しない**`[事実]`。したがって、

- **G1〜G6の実装（本計画のスコープ）は、未確認事項の解消を待たずに
  着手できる**。未確認調査で新たな関数ガード系UIが見つかったとしても、
  それは「関数ガード系」という別集合（4.2節）に追加されるだけであり、
  CSSベースの無guard21件を再分類する必要は生じない`[提案]`
- 一方、Phase 2 11節item3が定める前提（**未確認事項の解消until、
  Editor専用48件・Common候補136件は暫定分類のまま**であり、Phase 3の
  対象範囲を最終確定する前提として当該調査の完了を先行させる、という
  条件）は、**「縮小版HTML（`viewer.html`相当）を実際に試作し、
  Editor専用要素全体をHTMLから物理的に除去する」という、より広い
  スコープの意思決定**に対して適用される。G1〜G6（無guard21件の
  safening）はこの広いスコープの一部ではあるが、除去そのものではなく
  「除去に備えた事前のguard追加」に留まるため、未確認調査の完了を
  待つ必要は無い`[提案]`
- 結論として、**G1〜G6の実装と、Phase 2 12節候補E（未確認事項の調査）は
  並行して進めることができる**。候補Eは独立した調査タスクとして別途
  着手することを推奨する（Phase 2 12節の提案を踏襲）`[提案]`

---

## 8. リスク `[提案＋未検証]`

- **G5の複数参照箇所対応の設計未確定リスク**: G5（`floormap-orient-bar`/
  `-val`/`-preset`）は参照箇所が2〜4箇所にまたがるため、実装時に
  guard方針（宣言直後の一括ブロック方式か、各参照箇所への個別guard方式か）
  を新たに設計する必要がある。本計画はこの設計自体を確定していない
  （5節G5参照）
- **G1・G5・G6の新規テスト作成負荷**: 3節のとおり、G1の一部（3/4要素）と
  G5・G6の全要素（合計10要素）には既存テストが無い。guard追加と新規テスト
  追加を同一PRで行う場合、PR-G5・PR-G6の変更量が他グループより大きくなる
  可能性がある
- **`floormap-info-actions`（id無し親コンテナ）とscript.js側guardの二重管理**:
  G6の4要素（`floormap-rename-btn`等）はCSS上は親コンテナ経由で非表示に
  なるが、script.js側のguard追加は独立した別対応であり、片方の変更が
  もう片方に影響しない設計を維持する必要がある（Phase 2 2.3節参照）
- **本計画のグループ分割（G1〜G6）は候補A〜Eとは異なる切り口のため、
  実装時に混同する可能性**: Phase 2 12節の候補A〜Eはガード方式基準、
  本計画のG1〜G6は機能単位基準であり、対象要素の集合は同一だが呼び方が
  異なる。実装PRでは両方の対応関係（2節の表）を参照することを推奨する

---

## 9. 未確認事項 `[未検証]`

- Phase 2 13節の未確認事項（関数レベルガードUIの網羅確認）自体は本計画の
  対象外であり、未解消のまま残っている
- G5の複数参照箇所guard方針（8節・5節G5参照）は実装時に確定する必要があり、
  本計画では具体的な実装コード案を示していない
- 5節で「推奨」とした新規テストケースの具体的なテストシナリオ（アサーション
  内容、セットアップ手順）は、各PR実装時に個別に設計する必要がある
- G1〜G6実装後、Phase 2 11節item4（Viewer Preview・Viewer URL・通常Viewer
  Modeが同一DOM集合を共有するという前提）が崩れていないことの再確認は、
  本計画では行っていない（Phase 2 11節item4が定めるとおり、Phase 3
  本格着手直前に別途必要）

---

## 10. 変更していないこと `[事実]`

- `index.html` / `script.js` / `style.css` / `package.json` は一切変更して
  いない
- `tests/e2e/`配下の既存テストファイルは一切変更していない（3節のカバレッジ
  調査は`grep`による読み取りのみ）
- `.github/workflows/`配下のCI設定は一切変更していない
- `docs/ViewerEditor_Entrypoints_Investigation.md`（Phase 1）・
  `docs/ViewerEditor_DOM_Responsibility_Investigation.md`（Phase 2）は
  一切変更していない
- `obsidian-vault`配下のファイルは一切変更していない
- null-guardの実際の追加、`.editor-only`クラスの追加、HTML分割
  （`viewer.html`等の新規作成）は行っていない
- `main`ブランチへの直接コミット・PRのmergeは行っていない

---

## 関連

- `docs/ViewerEditor_Entrypoints_Investigation.md`（Phase 1設計調査文書）
- `docs/ViewerEditor_DOM_Responsibility_Investigation.md`（Phase 2 DOM責務
  分類調査文書。本文書はこの調査結果を前提として作成した）
- `01_Projects/ArchView360/01_Roadmap.md`（Obsidian Vault側、「次の開発
  フェーズ」としてViewer/Editor分離 Phase 2が記載されている）
