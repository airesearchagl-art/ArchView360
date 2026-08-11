# ArchView360 リリース・タグ運用ポリシー（docs-only）

> 読み手: 次にリリース作業（タグ付け・GitHub Release作成）を行う人間の担当者、または将来それを自動化するCoding Agent
> 位置づけ: 設計文書のみ。**本PRはタグ・GitHub Releaseの作成を一切行わない。** `viewer.html`/`index.html`/`script.js`/`style.css`/`tests/`/`package.json`/`package-lock.json`/`.github/workflows/`はいずれも無変更。
> 対象範囲: 次フェーズ候補「案C: リリース管理・バージョンタグ整備」（`docs/ArchView360_Next_Phase_Investigation.md`参照）の第一段階として、運用ルールのみを定義する。

## 現状（Current State）

本ポリシー策定時点（`main` = `53b5a2031abc637403ebcfd8b45ee8a14449e778`）で確認した事実は以下の通り。

- **Gitタグ**: `git tag -l` の結果は0件。本リポジトリにタグは1つも存在しない。
- **GitHub Releases**: GitHub API (`list_releases`) の結果は0件。GitHub Releaseも1つも存在しない。
- **`package.json`の`version`フィールド**: `"2.22.0"`。
- **`index.html`**: `#app-version-badge`（15行目）とフッター文（471行目）の両方に `v2.22.0` という文字列がハードコードされている。
- **`viewer.html`**: 15行目・401行目に、`index.html`と同一の `v2.22.0` 表記がハードコードされている。
- **`README.md`**: 冒頭の引用ブロックが `v2.22.0` を先頭に、`v2.21.0`・`v2.20.0`…と新しい順に機能追加ごとの説明を並べる**プローズ形式の変更履歴**になっている。構造化されたCHANGELOGファイル（`CHANGELOG.md`等）は存在しない。
- これら4箇所（`package.json`・`index.html`・`viewer.html`・`README.md`冒頭）は現時点ではすべて`2.22.0`系で一致しているが、これは**手動での同時更新に依存した一致**であり、更新を怠っても検知する仕組み（CI等）は存在しない。
- **CI構成**: `.github/workflows/`には`playwright.yml`の1ファイルのみ存在する。トリガーは`pull_request`（全PR対象、パスフィルタなし）と`push`（`main`ブランチのみ）。単一ジョブ`test`（`timeout-minutes: 30`）が`npm ci` → `npx playwright install --with-deps chromium` → `npm test`を実行し、失敗時のみ`playwright-report/`・`test-results/`を7日間保持のartifactとしてアップロードする。タグ作成・Release作成・バージョン文字列の同期・CHANGELOG生成を行うワークフローは存在しない。

以上より、現状のバージョン管理は「`README.md`のプローズ変更履歴と3ファイルへの手動反映」のみに依存しており、Gitタグ・GitHub Releaseという配布物追跡の基盤が一切ない状態である。

## 目的・非目的（Goals / Non-Goals）

**目的（このポリシーが定めること）**

- どのファイル値を「現在のバージョン」の正とするか（Version Source of Truth）
- バージョン番号の上げ方の判断基準（SemVer運用ルール）
- タグの命名規則・打つ対象コミットの条件
- GitHub Releaseを作成する条件、およびタグ作成のみとの違い
- Release Notesに最低限含めるべき内容
- CI（Playwrightスイート）とリリース可否の関係
- 誤ったタグ・Releaseを作ってしまった場合の対処手順
- 現段階での手動/自動の境界と、将来自動化する場合の条件
- リリース情報としてVault（`obsidian-vault`）に記録すべき内容

**非目的（このPR・このポリシーが行わないこと）**

- 現在の`main`（または過去の任意のコミット）へのタグ作成
- GitHub Releaseの作成
- `.github/workflows/`への自動タグ付け・自動Release作成ワークフローの追加
- `package.json`・`index.html`・`viewer.html`・`README.md`のバージョン表記の変更
- 現在README等に見えている`v2.22.0`系表記を、本ポリシーの言う「公式Releaseバージョン」として追認すること（次節で述べる通り、根拠未確認のまま追認しない）

## Version Source of Truth（バージョンの正）

**`package.json`の`version`フィールドを、機械可読なバージョン情報の正（source of truth）とする。**

理由:

- Node.jsプロジェクトの標準的な慣習に合致し、`npm version`コマンド等の既存ツールチェーンと自然に接続できる。
- `index.html`・`viewer.html`のバッジ/フッター文字列は表示用の**派生値**であり、`package.json`の値と手動で一致させる運用とする（タグ作成時のチェックリストに含める。自動同期は本ポリシーの範囲外＝将来検討）。
- `README.md`冒頭のプローズ変更履歴は、バージョンごとの**機能説明のログ**として引き続き有用だが、「今どのバージョンが正式リリースとして配布されているか」を示す構造化された情報源としては扱わない。

**重要な区別**: `package.json`の`version`が`2.22.0`であることは、「開発上直近に導入した機能セットのラベル」であることを意味するに過ぎず、それ自体が「GitHubタグ`v2.22.0`が存在する」「GitHub Release `v2.22.0`として配布された」ことを意味しない。本ポリシー策定時点でタグ・Releaseは0件であるため、`package.json`の現在値をもって過去のいずれかのバージョンを遡って公式リリースと追認することはしない（後述「First Release Recommendation」参照）。

## SemVer Rules（バージョン番号の上げ方）

[Semantic Versioning 2.0.0](https://semver.org/) の `MAJOR.MINOR.PATCH` に準拠する。ArchView360の実態に合わせた判断基準は以下の通り。

| 区分 | 上げる条件 | ArchView360における具体例 |
|---|---|---|
| MAJOR | 既存のプロジェクトJSON/ZIPフォーマットとの後方互換性を壊す変更、または既存の主要機能（Viewer/Editor分離、VR、Undo/Redo等）の前提を覆す設計変更 | 例: プロジェクトデータのスキーマを破壊的に変更し、旧バージョンで書き出したZIPが読み込めなくなる場合 |
| MINOR | 新機能の追加、既存機能の後方互換な拡張。JSON/ZIP読み込みの後方互換性は維持される | 例: 今回完了したUndo/Redo対象拡張（U1〜U9）、Dirty State基盤（v2.22.0）、Viewer/Editor Mode基盤（v2.21.0）のような機能単位の追加 |
| PATCH | バグ修正、CI/ドキュメントのみの変更、既存機能の外部から見た挙動を変えない内部修正 | 例: PR #54のCI timeout是正、PR #52のReferential Integrity修正 |

補足:

- 1.0.0未満（`0.x.y`）の運用は行わない。本リポジトリの`package.json`は既に`2.22.0`であり、`1.x`は実質的に経過済みとして扱う。
- 「MINORかPATCHか迷うケース」（例: 既存機能の細かい改善）は、**ユーザー（Editor利用者）から見て新しい操作・新しい選択肢が増えたかどうか**を判断基準とする。増えていればMINOR、増えていなければPATCH。
- MAJORの判断は必ず後述のRelease Gate（Playwrightフルスイート含む）を通過した上で、Vaultへの記録時に明示的な理由を残す。

## Tag Rules（タグ規則）

- **命名規則**: `vX.Y.Z`（例: `v2.22.0`）。プレフィックスなしの`X.Y.Z`は使わない。プレリリース識別子が必要になった場合は`vX.Y.Z-rc.N`のように[SemVerのpre-release構文](https://semver.org/#spec-item-9)に従う（現時点では通常運用では使用しない）。
- **タグの対象コミット**: 原則として`main`ブランチ上の、PRマージによって取り込まれた**マージコミット**（またはfast-forwardで`main`に反映された時点のHEAD）に限る。フィーチャーブランチや未マージのコミットに直接タグを打たない。
- **タグを打つ前提条件**:
  1. 対象コミットが`main`のHEAD（または`main`の履歴上の到達可能なコミット）であること。
  2. 対象コミットに対するPlaywrightフルスイートのCI（`push`トリガーの`playwright.yml`実行）が`success`であること（詳細は後述Release Gate）。
  3. `package.json`の`version`フィールドが、これから打つタグと一致するように事前に更新・コミットされていること（バージョン更新自体は本ポリシーの対象範囲外の別PRで行う）。
- **タグとGitHub Releaseの関係**: タグ作成とGitHub Release作成は別の操作であり、必ずしもセットで行う必要はない。次節「Release Gate」で両者の使い分けを定める。

## Release Gate（GitHub Release作成条件、CIとの関係）

- **タグのみ作成し、GitHub Releaseを作成しない**運用は、内部的な区切り（開発マイルストーンの記録等）としては許容するが、社内展開・施主共有の対象にはしない。
- **GitHub Releaseを作成する**のは、以下をすべて満たす場合に限る。
  1. 上記Tag Rulesの前提条件（`main`上のコミット、CI success、`version`フィールド一致）をすべて満たしている。
  2. 対象コミットに対するPlaywrightフルスイート（現行241件超、`push`トリガーの実行）が`conclusion: success`であることをGitHub Actions上で確認済みである。**CI successはReleaseの必須ゲートとする**（timeout等によるcancelledはsuccessとして扱わない — PR #53/#54で経験した15分timeout cancelledのような事象を、成功と誤認しないため）。
  3. 社内展開・施主共有の対象として実際に配布する意図がある（単なる開発区切りではタグのみで足りる）。
- CIが失敗またはcancelledの場合、その状態のコミットにはタグもReleaseも作成しない。まず原因を切り分け（コード起因かCIインフラ起因か）、必要な修正PRをマージした上で、新しいHEADに対して改めてタグ付けを検討する。

## Release Notes（最低限の記載内容）

GitHub Release作成時、Release Notesには最低限以下を含める。

1. **バージョン番号**（`vX.Y.Z`）と対象コミットSHA（短縮SHAで可、フルSHAはGitHub側に自動記録される）。
2. **このリリースに含まれる主な変更点**: 該当バージョンレンジに含まれるマージ済みPRのタイトル一覧、または機能単位の要約（`README.md`冒頭の該当バージョンの説明文を流用・要約してよい）。
3. **互換性に関する注記**: 既存プロジェクトJSON/ZIPとの互換性が維持されているか、破壊的変更（MAJOR時）がある場合はその内容と移行方法。
4. **既知の制限事項**: そのバージョン時点で未対応・既知の課題があれば明記（obsidian-vaultの`02_Current_Status.md`「既知の注意点」と重複してよい）。
5. **確認済み動作環境**: 少なくとも「Playwrightフルスイート success」の事実、VR関連の変更を含む場合は実機（Quest 3）確認の有無。

## Manual Release Procedure（手動リリース手順）

現段階（本ポリシー策定時点）では、タグ作成・Release作成は**手動のみ**とする（自動化しない理由は次節Future Automation参照）。手順は以下の通り。

1. `main`を最新のorigin/mainに同期し、`git log`でリリース対象コミット（Tag Rules参照）を確定する。
2. 対象コミットに対する`push`トリガーCI実行が`success`であることをGitHub Actions上で確認する（Release Gate参照）。
3. `package.json`の`version`が対象バージョンと一致していることを確認する。一致していなければ、バージョン更新のみを行う別PR（本ポリシーの範囲外）を先にマージする。
4. `index.html`・`viewer.html`のバージョンバッジ/フッター文字列が`package.json`と一致していることを確認する（不一致があれば同様に別PRで先に修正する）。
5. 対象コミットに対し、ローカルまたはGitHub UI/API経由で`vX.Y.Z`タグを作成し、`origin`にpushする。
6. GitHub Releaseを作成する場合は、上記Release Notesの内容を満たす説明文とともに、作成したタグを対象にRelease Notesを公開する。
7. **Vaultへの記録**: obsidian-vaultの該当プロジェクトページ（例: `01_Roadmap.md`または`02_Current_Status.md`）に、以下を記録する。
   - リリースバージョン番号（`vX.Y.Z`）
   - 対象コミットSHA
   - リリース日
   - 対応するGitHub Release URL（作成した場合）
   - 主な変更点の要約（Release Notesと重複してよい）
   - 用途（例: 「施主説明会向け配布」「社内検証用」等、配布の意図が分かる一言）

## Rollback / Mistag Procedure（誤タグ・誤リリース時の対処）

- **タグのみ作成し、GitHub Release未作成の段階で誤りに気づいた場合**: `git push origin :refs/tags/vX.Y.Z`でリモートタグを削除し、ローカルタグも`git tag -d vX.Y.Z`で削除する。タグ削除は「後戻りしやすい」操作であり、他者が既にそのタグを参照していない限り安全に取り消せる。
- **GitHub Releaseまで作成した後に誤りに気づいた場合**: タグを削除する前に、まずGitHub Release自体を削除する（Releaseがタグを参照しているため、Release→タグの順で削除する）。既に外部（施主等）に共有済みの場合は、タグ・Release削除だけでなく、Vaultの記録にも「取り消し」の事実と理由を追記し、正しいバージョンの再リリース手順（本ポリシーのManual Release Procedureをそのまま再実行）を案内する。
- **誤ったバージョン番号を打ってしまった場合**（例: MINORで上げるべきをPATCHで打った等）: 既存タグ・Releaseは削除せず放置しない。上記の削除手順を実施した上で、正しいバージョン番号で再度手順を実行する。同一バージョン番号を指す2つの矛盾したタグ・コミットを放置しない。
- いずれの場合も、**タグ・Release操作は`main`ブランチのコミット履歴そのものを書き換える操作ではない**ため、`main`への直接コミット・force pushは不要かつ行わない。

## Future Automation（将来の自動化条件）

現段階で手動運用とする理由:

- タグ・Release作成の頻度が現時点では低い（本ポリシー策定時点でまだ1件も実施していない）ため、自動化の投資対効果が低い。
- `version`フィールドの機能単位での上げ方（MINOR/PATCHの判断）は、現状は人間の判断（PRの内容評価）に依存しており、機械的なルールだけでは誤判定のリスクがある。

以下の条件が揃った段階で、自動化（例: `main`への`push`時に`package.json`の`version`変更を検知して自動タグ付けするワークフロー等）を検討する。

1. 手動運用を最低でも3〜5回実施し、Manual Release Procedureの手順自体が安定していること。
2. `package.json`の`version`更新と`index.html`/`viewer.html`のバージョン表記更新を、単一のPRまたは単一のコマンドで同時に行う仕組み（同期漏れ防止）が別途整備されていること。
3. Release Gateの判定（CI success確認）を人間が都度手動確認する運用が、リリース頻度の増加によって負担になってきたこと。

自動化する場合も、**GitHub Release本文の生成（Release Notesの要約文）は当面人間のレビューを介在させる**（機械的なPRタイトル羅列だけでは「既知の制限事項」等の質的な情報が抜け落ちるため）。

## First Release Recommendation（初回リリース候補の提案）

**結論: 現在の`main`（`53b5a2031abc637403ebcfd8b45ee8a14449e778`）を、`v2.22.0`として初回タグ・GitHub Releaseの候補にすることを提案する。ただし本PRではタグ・Releaseの作成は行わない。**

根拠:

1. `package.json`の`version`が既に`2.22.0`であり、Version Source of Truthとして定義した値とコミット内容が一致している。
2. `index.html`・`viewer.html`のバージョン表記も同じく`v2.22.0`で一致しており、Tag Rulesの前提条件（バージョン表記の事前一致）を追加の修正なしに満たしている。
3. Undo/Redo対象拡張（U1〜U9、PR #45〜#53）とCI timeout是正（PR #54）が完了し、`main`へのpushトリガーCIが直近で`success`していることを確認済みである（本セッション内でPR #54の main-push CI success を確認済み）。
4. 過去のいずれのコミット（`v2.21.0`時点や`v2.20.0`時点等）に遡ってタグを打つことも技術的には可能だが、それらの時点ではCIワークフロー自体が現行の構成（`timeout-minutes: 30`等）でなかった可能性があり、「Release Gateを満たしていたことの事後確認」が困難になる。現在の`main`を起点とする方が、本ポリシーのRelease Gateをそのまま適用できて一貫性が高い。

ただし、以下は本ポリシー単独では判断できないため、実際にタグ・Releaseを作成する回のPR（本ポリシーの次のステップ）で改めて確認・実行することとする。

- 実際にタグ・Release作成のGO判断を出すのは、本ポリシーを承認したレビュー担当者・プロジェクトオーナーであり、本ドキュメントはあくまで**推奨**に留まる。
- Release Notesの具体的な文面（v2.22.0までの主な変更点の要約）は、実際の作成PRで改めて作文する。

## Open Questions（未確定事項）

- `index.html`・`viewer.html`・`package.json`間のバージョン表記の**自動同期**（ビルドスクリプトやCIでの整合性チェック等）を導入するかどうかは、本ポリシーでは扱っていない。現状は手動一致の運用に留める。
- `README.md`冒頭のプローズ変更履歴を、将来的に構造化された`CHANGELOG.md`（[Keep a Changelog](https://keepachangelog.com/)形式等）に置き換えるかどうかは未検討。現状はREADMEのプローズ形式を維持しつつ、GitHub Release Notesを別の要約情報源として運用する前提とした。
- プレリリース（`-rc.N`等）の運用が実際に必要になるタイミング（例: 施主への事前確認版配布等）が生じた場合の具体的な手順は、本ポリシーでは骨子（SemVer準拠のpre-release識別子を使う）のみを示しており、詳細な運用フローは未設計。
- Vaultへの記録先（`01_Roadmap.md`か`02_Current_Status.md`か、あるいは新規ページを設けるか）は、本ポリシーでは「記録すべき項目」のみを定義しており、Vault側のページ構成の決定は次のステップ（実際のリリース実施時）に委ねる。
- 案D（Quest-PC間リアルタイム同期）や案E（mp4パノラマ動画対応）等、`docs/ArchView360_Next_Phase_Investigation.md`に記載の他候補が将来実装された場合、それらがMAJORバージョンアップに相当するかどうかの判断基準は、実装内容が具体化した段階で改めて評価が必要。

## 関連

- `docs/ArchView360_Next_Phase_Investigation.md`（次フェーズ候補の比較。案C: リリース管理・バージョンタグ整備の元記述）
- `README.md`冒頭のバージョン履歴（v2.10〜v2.22.0）
- `.github/workflows/playwright.yml`（Release Gateが参照するCI実行）
- obsidian-vault `01_Projects/ArchView360/02_Current_Status.md`「既知の注意点」（GitHub Releases/タグが未整備である旨の既存記載）
