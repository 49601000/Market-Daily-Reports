# Decisions

## 2026-11-10 — 日次JSONスキーマ1.0.0と1.1.0を併用する

- Decision: 日次レポート検証は `schema_version` 1.0.0と1.1.0を許可し、月次DBの `archive_schema_version` は1.0.0のまま維持する。
- Reason: 新しい日次JSONを取り込みつつ、既存日次JSONと月次アーカイブとの互換性を保つため。
- Consequence: 既存の `schemaVersion` は互換用の既定値として残し、許可判定には `supportedSchemaVersions` を使用する。同期結果には既存の `invalid` 件数に加えて `invalidFiles` の詳細を追加する。

## 2026-11-09 — 同一ファイルIDの更新を月次DBへ反映する

- Decision: 日次JSONの `source_file_id` が既存月次レコードと一致し、コンテンツハッシュが異なる場合、そのIDのレコードを日次JSONの全内容から再生成して置換する。
- Reason: Drive上で既存ファイルを修復しても、月次DBと画面表示が古い内容のまま残る問題を解消するため。
- Consequence: 対象月は既存の安全な保存経路で再保存される。別IDの同日レコードは従来どおり競合扱いとし、自動統合しない。
