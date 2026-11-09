# Specification

Status: Active

## Purpose

Google Drive上の日次市場レポートJSONを正本として保護し、月次アーカイブへ同期してWeb画面から閲覧できるようにする。

## Intended users and environment

- Intended user: Personal use
- Runtime / platform: Google Apps Script Web app
- Data sources: `MARKET_REPORT_FOLDER_ID` 内の日次JSON
- Derived data: `MARKET_MONTHLY_FOLDER_ID` 内の `YYYY-MM.json`
- Source of truth: 日次JSON。月次JSONは再生成可能な派生DB。

## Required behavior

- 日次JSONを検証し、月次JSONへ全フィールドを欠落なく複製する。
- 日次JSONの `schema_version` は `1.0.0` と `1.1.0` を受け付け、その他は `UNSUPPORTED_SCHEMA` とする。
- 月次DBの `archive_schema_version` は `1.0.0` を維持し、日次スキーマ1.0.0と1.1.0のレコード共存を許可する。
- 同じ `source_file_id` と同じコンテンツハッシュは再同期時に変更しない。
- 同じ `source_file_id` でコンテンツハッシュが変わった場合、そのIDの月次レコードだけを最新の日次JSON由来レコードへ置換する。
- 同じ `market + market_date` を持つ別ファイルIDは競合として記録し、自動統合しない。
- 変更検知は `modifiedSources`、置換件数は `replaced` で報告する。
- 同期結果の `invalid` 件数を維持し、`invalidFiles` に対象ファイル名と検証エラーコードを報告する。
- 月次DB保存時は候補ファイルを再読込検証し、既存正規版をバックアップしてから切り替える。
- UIの原文と構造化表示は同じ月次レコードを参照する。

## Data handling and recoverability

日次JSONは同期処理から変更しない。月次DBは保存前の正規版を `.backup-*` として保持し、候補の検証失敗時は正規版を維持する。

## Out of scope

- 日次JSONの自動修復
- 競合する別ファイルIDの自動統合
- 本リポジトリ変更だけによるGASデプロイや本番同期

## Acceptance

同一IDの更新が対象レコードだけへ完全反映され、再同期が冪等であり、保存検証失敗時に既存月次DBが保護されること。
