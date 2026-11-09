# Market Report Curator — Phase M-4

日次JSONを正本のまま保護し、別フォルダの月次JSON派生DBを同期・閲覧する Google Apps Script Web アプリです。レポート詳細は月次DB内の構造化フィールドを標準表示し、必要に応じて原文へ切り替えられます。

## 構成

- `Code.gs`: Web エントリポイントと公開 RPC
- `Config.gs`: 設定・共通エラー
- `MarketReportRepository.gs`: Drive 読み取りとフォルダ所属検証
- `MarketReportService.gs`: 検証・一覧整形・年月・ソート・重複検出
- `MonthlyArchiveRepository.gs`: 月次DB専用の読込・候補書込・検証済み切替
- `MonthlyArchiveService.gs`: 差分同期、重複検出、検証、閲覧API
- `MonthlySyncTriggers.gs`: 1日6回の管理対象トリガー
- `Navigation.gs`: Phase M-1 のローカルナビゲーションデータ
- `Index.html`: 構造化レポート、原文切替、US/JPフィルターを備えたレスポンシブ UI
- `tests/test_market_report.js`: Node.js ローカル単体テスト

## Script Properties

- `MARKET_REPORT_FOLDER_ID`: 日次JSON正本フォルダ（読取専用経路）
- `MARKET_MONTHLY_FOLDER_ID`: 月次DB専用フォルダ

フォルダIDはコードに直書きしません。日次と月次には同じフォルダを設定しないでください。

## 月次DB

`YYYY-MM.json` は `archive_schema_version`, `year_month`, `updated_at_jst`, `record_count`, `records` を持ちます。各recordは日次JSONを欠落なく複製し、`source_file_id`、`source_file_name`、`source_content_sha256` を追加します。同期はファイルIDで冪等性を確保し、同じ `market + market_date` の別ファイルは競合として記録して自動統合しません。登録後に同じファイルIDの日次JSONのハッシュが変わった場合は、`source_file_id` が一致する月次レコードだけを最新内容へ置換します。同期結果では変更を `modifiedSources`、実際の置換件数を `replaced` として確認できます。

書込時は候補ファイルを作成・再読込検証してから、旧版を `.backup-*` として保持し候補を正規名へ切り替えます。失敗した候補はゴミ箱へ移し、正常版を残します。破損DBは自動置換せず同期を停止します。

## ローカルテスト

```powershell
node .\tests\test_market_report.js
node .\tests\test_monthly_archive.js
node .\tests\test_monthly_repository.js
node .\tests\test_monthly_triggers.js
node .\tests\test_ui.js
```

これらは模擬データだけを使い、Drive書込・GAS push・トリガー作成を行いません。

## 構造化レポート表示

選択月の月次JSONを一度だけ読み込み、指標、材料、イベント、見通し、補助データをブラウザ内で描画します。記事選択、US/JP切替、構造化・原文切替では追加のGAS通信を行いません。指標値は `indices` の実データを使用し、`null` は0に変換せず、指標の `as_of` とレポートの `market_date` を別々に表示します。

## 導入手順（ユーザー承認後のみ）

1. Script Properties に上記2項目を設定する。
2. manifestのDrive権限追加に伴う再認証内容を確認する。実行主体はWebアプリのデプロイユーザー。
3. 明示的承認後に `clasp push` し、新バージョンとしてWebアプリをデプロイする。
4. `rebuildPreview()` で初期バックフィル候補を確認する。実書込は `syncMonthlyReports()` を管理者が明示実行する。
5. 内容確認後、`installMonthlySyncTriggers()` を一度実行する。07:30、08:30、09:30、18:00、19:00、20:00 JST付近に全市場を確認する（GAS仕様上、実時刻には幅がある）。
6. `inspectMonthlySyncTriggers()` が6件を返すことを確認する。

## 障害復旧

同期を停止し、正規の `YYYY-MM.json` と `.backup-*` を確認します。日次正本は変更せず、`rebuildPreview()` の結果を検証します。破損版の置換やバックアップ復元は自動実行せず、対象年月・件数・内容を確認した管理者だけが行います。

## 新規 GAS プロジェクトへの導入

1. Apps Script で空の独立プロジェクトを作成する。
2. Script ID を取得し、このディレクトリに `.clasp.json` を作成する。
3. Script Properties に `MARKET_REPORT_FOLDER_ID` を設定する。
4. テスト後、明示的な承認を得てから `clasp push` と Web アプリのデプロイを行う。

`clasp push`、デプロイ、公開範囲変更はこの Phase のローカル実装には含みません。
