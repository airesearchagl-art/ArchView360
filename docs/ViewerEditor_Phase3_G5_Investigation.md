# Viewer/Editor分離 Phase 3 G5: 実装前事前調査（v2.22.0時点）

このドキュメントは調査専用であり、実装は含まない。`script.js` / `index.html` /
`style.css` / `tests/e2e/` / `package.json` / ワークフロー / `obsidian-vault`
は一切変更していない。

- 調査時点のmain HEAD: `ec5be6b42b7f7bb330568a392d110440f70d1efd`（PR #35 merge commit、G1安全化実装）
- `appVersion`: `2.22.0`（変更なし）
- 前提: `docs/ViewerEditor_DOM_Responsibility_Investigation.md`（Phase 2 DOM責務
  分類調査）・`docs/ViewerEditor_Phase3_Implementation_Plan.md`（Phase 3実装
  計画、5節「G5: FloorMap 方位補正エリア」）の内容を前提知識として参照する
- G1〜G4（PR #32〜#35）はすでにmainへmerge済み。本調査はG5着手前の設計確定を
  目的とする

以下、各項目はPhase 2/Phase 3の既存文書と同じ表記規則に従い、`[事実]` /
`[提案]` / `[未検証]`を付す。

---

## 1. G5対象5要素の正式ID `[事実]`

Phase 3実装計画5節「G5: FloorMap 方位補正エリア」で定義された5要素、
すべて`script.js`の`init()`冒頭で`Pattern 1`（一括キャッシュ）として
取得されている（script.js:196-200）。

| 順 | ID | 変数名 | キャッシュ行 |
|---|---|---|---|
| 1 | `floormap-orient-bar` | `floormapOrientBar` | script.js:196 |
| 2 | `floormap-orient-l` | `floormapOrientL` | script.js:197 |
| 3 | `floormap-orient-r` | `floormapOrientR` | script.js:198 |
| 4 | `floormap-orient-val` | `floormapOrientVal` | script.js:199 |
| 5 | `floormap-orient-preset` | `floormapOrientPreset` | script.js:200 |

5要素で確定（Phase 3計画の対象と一致）。

---

## 2. 全参照箇所の一覧 `[事実]`

各変数名について`script.js`全体を網羅的にgrepし、キャッシュ行を除く
全参照を洗い出した。リテラルID文字列（`$('floormap-orient-...')`形式の
インライン参照）による追加参照が無いことも別途確認済み（Pattern 2/3の
追加参照は無い、5節参照）。

| 要素 | 行 | コード | 所属関数 |
|---|---|---|---|
| `floormapOrientBar` | 5867 | `showEl(floormapOrientBar);` | `renderFloormapTabs()` |
| `floormapOrientBar` | 5871 | `hideEl(floormapOrientBar);` | `renderFloormapTabs()` |
| `floormapOrientL` | 6625 | `floormapOrientL.addEventListener('click', () => _adjustOrientOffset(-15));` | `init()`直下（イベント配線） |
| `floormapOrientR` | 6626 | `floormapOrientR.addEventListener('click', () => _adjustOrientOffset(+15));` | `init()`直下（イベント配線） |
| `floormapOrientVal` | 5868 | `floormapOrientVal.textContent = ...;` | `renderFloormapTabs()` |
| `floormapOrientVal` | 6632 | `floormapOrientVal.textContent = ...;` | `floormapOrientPreset`の`change`ハンドラ |
| `floormapOrientVal` | 6641 | `floormapOrientVal.textContent = ...;` | `_adjustOrientOffset(delta)` |
| `floormapOrientPreset` | 5869 | `floormapOrientPreset.value = ...;` | `renderFloormapTabs()` |
| `floormapOrientPreset` | 6627 | `floormapOrientPreset.addEventListener('change', () => {...});` | `init()`直下（イベント配線） |
| `floormapOrientPreset` | 6631 | `parseInt(floormapOrientPreset.value, 10)` | `floormapOrientPreset`自身の`change`ハンドラ |
| `floormapOrientPreset` | 6642 | `floormapOrientPreset.value = ...;` | `_adjustOrientOffset(delta)` |

**合計11参照**（キャッシュ行5件を除く、内訳: `floormapOrientBar`2件＋
`floormapOrientL`1件＋`floormapOrientR`1件＋`floormapOrientVal`3件＋
`floormapOrientPreset`4件＝11件）`[事実]`。Phase 2調査文書4.1節の記載
（`floormap-orient-bar`: `showEl`/`hideEl`2箇所、`floormap-orient-val`:
`.textContent`3箇所、`floormap-orient-preset`: `.value`取得/設定＋
`addEventListener`4箇所、`floormap-orient-l`/`floormap-orient-r`:
`addEventListener`各1箇所）と本調査の上表を突き合わせた結果、件数・
参照箇所とも完全に一致することを確認した`[事実に基づく評価]`。

---

## 3. 到達経路分類 `[提案]`

各参照を、指示書が定める5分類（init時に必ず到達／init後の通常操作時に
到達／undo/redo再生時に到達／特定状態のみ到達／到達未確認）に分類する。

| 参照 | 分類 | 理由 |
|---|---|---|
| `floormapOrientL`のaddEventListener登録（6625） | **init時に必ず到達** | `init()`実行時に無条件で1回実行される登録文そのもの |
| `floormapOrientR`のaddEventListener登録（6626） | **init時に必ず到達** | 同上 |
| `floormapOrientPreset`のaddEventListener登録（6627） | **init時に必ず到達** | 同上 |
| `renderFloormapTabs()`内の4参照（5867,5868,5869,5871） | **init後の通常操作時に到達** | `renderFloormapTabs()`は`renderFloormap()`→`_updateFloormapSelect()`経由で、平面図追加（`handleFloorplanFiles()`、G4で既にguard済みの`add-floorplan-btn`が起点）・平面図削除（`deleteFloorplan()`）・平面図切替（`setActiveFloorplan()`）・JSON/ZIP読み込み完了（`_doImportWithFiles()`、script.js:7075）のいずれからも呼ばれる。**平面図を1件追加するだけ**という基本操作で到達するため、比較モードのような限定的な操作ではない（4節参照） |
| `floormapOrientPreset`の`change`ハンドラ本体（6628-6635、内部で6631・6632を参照） | **特定状態のみ到達** | アクティブな平面図が存在し（`fp`が truthy）、かつユーザーが実際にpresetセレクトを変更した場合のみ到達 |
| `_adjustOrientOffset(delta)`本体（6636-6645、内部で6641・6642を参照） | **特定状態のみ到達** | アクティブな平面図が存在し、かつユーザーが`floormapOrientL`/`floormapOrientR`を実際にクリックした場合のみ到達（呼び出し元は6625・6626の2箇所のみ） |
| — | **undo/redo再生時に到達** | **該当無し**。`rotationOffset`はHistoryManagerに一切登録されていないことを`grep`で確認済み（Undo/Redo対象外の機能） |
| — | **到達未確認** | **該当無し**。全参照を`grep`で網羅確認済み、Pattern 2/3の追加参照も無し |

---

## 4. 「既存分類より広い到達経路」の確認（G1で判明したパターンとの比較） `[事実]`

G1（PR #35）では、`flip-btn`がPhase 2の「②イベント登録guard必要（単一の
`addEventListener`のみ）」という分類だったにもかかわらず、実際には
`_doSwitchToScene()`という**シーン切替のたびに無条件で呼ばれる関数**からも
参照されており、しかもこの関数は「シーン追加」という最も基本的な操作
（`file-input`への1枚目の画像追加）で到達することが判明した。

本調査で同様の観点から確認した結果、G5にも類似のパターンが存在する
`[事実]`:

- `floormapOrientBar`/`floormapOrientVal`/`floormapOrientPreset`の
  `renderFloormapTabs()`内の参照は、Phase 2 4.1節の時点で「複数箇所参照」
  として認識されてはいたが、**その複数箇所が具体的にどのユーザー操作から
  到達するか**（平面図の追加・削除・切替・インポート完了という、
  方位補正UIそのものを一切操作しなくても到達する経路）までは、Phase 2
  文書には明記されていなかった
- 特に「平面図を1件追加する」（`add-floorplan-btn`、G4で既にguard済み）
  という基本操作だけで`renderFloormapTabs()`が呼ばれ、方位補正エリアの
  3要素（`floormapOrientBar`/`floormapOrientVal`/`floormapOrientPreset`）
  すべてに無条件でアクセスする、という事実は、G1の`flip-btn`と同じ
  「基本操作経由での広い到達」パターンに該当する`[事実に基づく評価]`
- 一方、`_adjustOrientOffset()`と`floormapOrientPreset`の`change`ハンドラ
  本体は、G3の`applySceneFlip()`と同様、方位補正UI自体を明示的に操作
  しない限り到達しない、より限定的な経路である`[事実に基づく評価]`

**結論**: G5は「方位補正UIを操作しなくても到達する経路（
`renderFloormapTabs()`、3要素）」と「方位補正UIを明示的に操作した場合の
み到達する経路（`_adjustOrientOffset()`・`change`ハンドラ、`floormapOrientVal`/
`floormapOrientPreset`）」の両方を含む。前者はG1の`flip-btn`と同じ理由で
guard対象に含めるべきであり、後者は縮小DOM環境では呼び出し元のボタン
自体が存在しないため実質到達不能になるが、部分的な要素除去（5要素の
一部だけが欠落するような一貫性の無い縮小HTML）に対する防御的guardとして
追加する意味がある`[提案]`。

---

## 5. DOM欠落時に発生する例外種別の整理 `[事実]`

| 参照 | アクセス種別 | 欠落時の例外 |
|---|---|---|
| `floormapOrientL`/`floormapOrientR`/`floormapOrientPreset`のaddEventListener登録 | `addEventListener`呼び出し | `TypeError: Cannot read properties of null (reading 'addEventListener')` |
| `showEl(floormapOrientBar)`/`hideEl(floormapOrientBar)` | `showEl`/`hideEl`関数内部で`el.style.display`を操作 | `TypeError: Cannot read properties of null (reading 'style')`（`showEl`/`hideEl`の実装が`el.style.display = ...`のため） |
| `floormapOrientVal.textContent = ...`（3箇所） | `textContent`書き込み | `TypeError: Cannot set properties of null (setting 'textContent')` |
| `floormapOrientPreset.value = ...`（2箇所、書き込み） | `value`書き込み | `TypeError: Cannot set properties of null (setting 'value')` |
| `floormapOrientPreset.value`（1箇所、読み取り、6631） | `value`読み取り | `TypeError: Cannot read properties of null (reading 'value')` |

`disabled`プロパティへのアクセスは無し（G5対象5要素はいずれも`disabled`
属性を操作されていない）`[事実]`。`showEl`/`hideEl`の実装を確認した:

```js
function showEl(el) { el.style.display = ''; }
function hideEl(el) { el.style.display = 'none'; }
```

（script.js内、既存実装・本調査で変更無し）`[事実]`

---

## 6. 推奨guard方式 `[提案]`

G1〜G4は一貫して「単純な存在確認（`if (x) x.method(...)`）」を採用して
きたが、G5は同一関数内に**複数の関連参照が連続して出現する**という
Phase 2 6.2節で既に指摘されていた特徴があるため、以下の使い分けを提案する。

### 6.1 addEventListener登録（3件）: 単純な存在確認

`floormapOrientL`/`floormapOrientR`/`floormapOrientPreset`の3つの
`addEventListener`呼び出しは、G1〜G4と同じ形式（`if (x) x.addEventListener(...)`）
で個別にguardする`[提案]`。

### 6.2 `renderFloormapTabs()`内の3要素: 関連要素をまとめた早期returnまたはブロックguard

`floormapOrientBar`/`floormapOrientVal`/`floormapOrientPreset`は、
`renderFloormapTabs()`内で常に3つセットで更新される（`if (fp) {...}
else {...}`ブロックの中に3文がまとまっている）。個別に`if`を3回書く
よりも、3要素が実際には「1つのUIユニット」として設計されている点を
踏まえ、**ブロック先頭で一括存在確認してから3文を実行する**方式を推奨
する`[提案]`:

```js
// 提案イメージ（実装はしない）
if (fp) {
  if (floormapOrientBar) showEl(floormapOrientBar);
  if (floormapOrientVal) floormapOrientVal.textContent = `${fp.rotationOffset || 0}°`;
  if (floormapOrientPreset) floormapOrientPreset.value = String((fp.rotationOffset || 0) % 360);
} else {
  if (floormapOrientBar) hideEl(floormapOrientBar);
}
```

個別`if`とブロックガードのどちらでも安全性は同じだが、3要素が同時に
存在する/しないという前提（縮小HTMLで方位補正エリアを丸ごと除去する
場合、3要素は一括で消える設計になる可能性が高い）に鑑みると、個別
`if`の方がG1〜G4との書き方の一貫性を保てる。**最終的な採用形式は
実装PR側で決定する**、本調査では両案を提示するに留める`[提案]`。

### 6.3 `_adjustOrientOffset()`と`change`ハンドラ本体: 単純な存在確認（防御的）

`floormapOrientVal`/`floormapOrientPreset`への書き込み（6632,6641,6642）
と読み取り（6631）は、呼び出し元のボタン自体が縮小DOMで無ければ実質
到達不能だが、部分的な要素除去に対する防御として個別`if`guardを推奨する
`[提案]`。関数単位でのguard（`_adjustOrientOffset()`冒頭で早期return）
も選択肢になるが、`fp.rotationOffset`自体の更新（データ操作、DOM非依存）
は縮小DOMでも継続させたい可能性があるため、**DOM書き込み文だけを
個別にguardし、データ更新ロジックは維持する**方式を推奨する`[提案]`。

### 6.4 状態更新処理の分離

`fp.rotationOffset`の更新（データ操作）と`floormapOrientVal`/
`floormapOrientPreset`の表示更新（DOM操作）は現状すでに近接しているが
分離はされていない。本調査では、DOM操作文にguardを追加するだけで
十分であり、**データ操作とDOM操作の分離という設計変更は不要**と判断
する`[提案]`（分離は「大規模リファクタ」寄りの変更であり、Phase 2の
既存方針「一律の大規模リファクタは行わない」と整合しない）。

---

## 7. G5を1PRで実装可能か `[提案]`

**1PRでの実装が可能かつ推奨**と判断する`[提案]`。理由:

- 対象は5要素・11参照（2節）と、G1（4要素・複数関数にまたがる参照＋
  1件の追加guard）と同程度の規模であり、単独PRとして過大ではない
- 11参照はすべて`renderFloormapTabs()`・`_adjustOrientOffset()`・
  `change`ハンドラ・3件のaddEventListener登録という、狭い範囲（
  script.js:5867-5873、6625-6645の2箇所）に集中しており、レビュー時に
  追いやすい
- 5要素は「FloorMap方位補正」という単一機能のUIであり、機能的に分割
  すると却って一部だけguardされた中途半端な状態を生みやすい（例:
  `floormapOrientL`/`R`だけ先にguardし`floormapOrientVal`/`Preset`を
  後回しにすると、`_adjustOrientOffset()`が一時的に「呼び出し元は
  guard済みだが内部の書き込みは未guard」という不整合な状態になる）

---

## 8. 分割が必要な場合の最小PR単位と実施順（代替案） `[提案]`

7節のとおり1PRを推奨するが、レビュー負担軽減のために分割する場合の
代替案を示す。

| 順 | PR | 対象参照（行） | 件数 |
|---|---|---|---|
| 1 | PR-G5a | addEventListener登録（`floormapOrientL`/`floormapOrientR`/`floormapOrientPreset`、6625,6626,6627） | 3 |
| 2 | PR-G5b | `renderFloormapTabs()`内（`floormapOrientBar`のshowEl/hideEl、`floormapOrientVal`/`floormapOrientPreset`の初期表示、5867,5868,5869,5871） | 4 |
| 3 | PR-G5c | `change`ハンドラ本体・`_adjustOrientOffset()`内（`floormapOrientPreset`の`.value`読み取り、`floormapOrientVal`/`floormapOrientPreset`の書き込み、6631,6632,6641,6642） | 4 |

**検算**: PR-G5a 3件＋PR-G5b 4件＋PR-G5c 4件＝11件で、2節の合計11参照と
過不足なく一致する`[事実に基づく評価]`。PR-G5bは平面図追加による到達を
新規テストで確認する（10.2節参照）。

---

## 9. 既存テストでのカバー範囲 `[事実]`

`tests/e2e/*.spec.js`全体を`grep`で確認した結果、`floormap-orient`を
含むテストは**1件も存在しない**`[事実]`（Phase 3計画文書3節の既存確認
結果と一致、再確認済み）。

| 要素 | 既存テストでのclick/change操作 | 既存テストでの参照（可視性等含む） |
|---|---|---|
| `floormap-orient-bar`/`-l`/`-val`/`-r`/`-preset` | ✗（5件すべて） | ✗（既存テスト無し） |

`floormap-name-history.spec.js`はFloorMap**名称**編集（dblclick/
contentEditable経由）を対象とした別機能であり、方位補正UIとは無関係
（Phase 3計画文書3節の既存記載を踏襲、再確認済み）。

---

## 10. 縮小DOMテストの設計案 `[提案]`

G1の教訓（`_doSwitchToScene()`のような`init()`後の基本操作経由の参照は、
`init()`完了確認だけでは検知できない）を踏まえ、以下の3種類のテストを
設計する`[提案]`（実装はしない、設計のみ）。

### 10.1 init()完了確認（Editor/Viewer各1件、G1〜G4と同型）

`document.getElementById`を5要素分オーバーライドし、`init()`が例外を
投げず完走することを確認する。既存の`phase3-g1〜g4-guard.spec.js`と
同一パターン。

### 10.2 平面図追加後の`renderFloormapTabs()`到達確認（新規パターン、G5固有）

G1の`_doSwitchToScene()`の教訓を反映し、`init()`完了確認だけでなく、
**平面図を1件追加する操作**（`#add-floorplan-btn`クリック→
`#floorplan-input`へのファイル設定、`floormap-name-history.spec.js`の
`loadSceneAndFloorplan()`と同じ手順）まで実行し、`renderFloormapTabs()`
が呼ばれる経路（`floormapOrientBar`/`floormapOrientVal`/
`floormapOrientPreset`への参照を含む）で例外が発生しないことを確認する
テストを追加する必要がある`[提案]`。これはG1で`add-scene-btn`クリック
後のシーン読み込みが`_doSwitchToScene()`を経由して`flipBtn`参照に到達
したのと同じ理由による。

### 10.3 `_adjustOrientOffset()`・`change`ハンドラの到達性についての注記

`floormapOrientL`/`floormapOrientR`/`floormapOrientPreset`自体が縮小
DOMで存在しない場合、これらのクリック/change操作をテストで再現する
手段が無い（ボタン自体がDOMに存在しないため）。したがって
`_adjustOrientOffset()`本体・`change`ハンドラ本体の読み取り・書き込み文
（6631,6632,6641,6642）に対する縮小DOM条件下の到達性テストは、**全5要素が
一括で欠落する現実的なシナリオでは意味を持たない**（呼び出し元が
既に存在しないため）`[事実に基づく評価]`。これらのguardは6.3節の
とおり部分的な要素除去に対する防御目的であり、対応する自動テストは
「一部要素のみを欠落させた場合」という非現実的なシナリオでしか意味を
持たないため、実装PR側で追加するかどうかは任意とすることを提案する
`[提案]`。

---

## 11. リスク `[提案＋未検証]`

- **`renderFloormapTabs()`のguard方式（6.2節）が実装PR側で個別`if`か
  ブロックguardかを都度判断する必要がある**: 本調査では両案を提示した
  のみで確定していない
- **6.3節の防御的guardは自動テストで検証しにくい**: 10.3節のとおり、
  全要素一括欠落シナリオでは到達不能なコードにguardを追加する形になる
  ため、実装PR側でこのguardの要否・テスト方針を個別判断する必要がある
- **`renderFloormapTabs()`の呼び出し元が今後増える可能性**: 現時点で
  確認した呼び出し元は4箇所（`handleFloorplanFiles()`・
  `deleteFloorplan()`・`setActiveFloorplan()`・JSON/ZIPインポート完了）
  だが、将来の機能追加でさらに増える可能性があり、その場合も
  `renderFloormapTabs()`内部でguardしていれば新規呼び出し元の追加は
  影響を受けない（関数内部でguardする設計の利点として記録する）
  `[事実に基づく評価]`

---

## 12. 未確認事項 `[未検証]`

- Phase 2 13節の未確認事項（関数レベルガードUIの網羅確認）は本調査の
  対象外であり、G5とは独立した課題として未解消のまま
- 6.2節のguard方式（個別`if`かブロックguardか）の最終決定は実装PR着手時
  に行う
- 6.3節の防御的guardを実際に追加するかどうかは実装PR側の判断に委ねる

---

## 関連

- `docs/ViewerEditor_DOM_Responsibility_Investigation.md`（Phase 2 DOM
  責務分類調査文書。2節の参照件数はこの文書の4.1節・6.2節と対応関係を
  確認済み）
- `docs/ViewerEditor_Phase3_Implementation_Plan.md`（Phase 3実装計画。
  5節「G5」の内容を前提として本調査を実施した）
- `tests/e2e/phase3-g1-guard.spec.js`（G1、`flip-btn`の`_doSwitchToScene()`
  参照という同種の「既存分類より広い到達経路」が判明した先行事例）
