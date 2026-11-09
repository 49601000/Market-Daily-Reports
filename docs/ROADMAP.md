# Roadmap and Progress

Last updated: 2026-11-10
Current status: Schema v1.1.0 compatibility fix prepared for review; deployment pending owner action

## Current position

- 日次JSONから月次派生DBを生成・閲覧するGASアプリを実装済み。
- 同一ファイルIDの内容更新を月次レコードへ反映する同期仕様を実装済み。
- ローカル模擬テスト74件が成功。
- 日次JSONスキーマ1.0.0/1.1.0の併用対応と無効ファイル診断を実装済み。
- GASデプロイと本番データ同期は未実施。

## Next task

- PRをレビューしてmainへマージする。
- 承認後にGASへ反映し、同期プレビューを確認してから実同期する。

## Completed

- 月次アーカイブの候補保存、再読込検証、バックアップ切替。
- 構造化・原文表示とUS/JPフィルター。
- 同一ID・異なるハッシュの対象レコード限定置換と診断件数追加。
