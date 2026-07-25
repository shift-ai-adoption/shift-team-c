# AIエージェント向け SSH接続ガイド

このファイルは、学習者が使うAIエージェント(Claude Codeなど)にそのまま読ませることを想定しています。
学習者自身はSSH接続の詳細を意識する必要はありません。

## 前提

- `client` (アプリケーションサーバ役) はローカルの `node` プロセスとして動き、ログはローカルファイルです。SSHは不要です。
  - ログパス: `client/logs/app.log`
- `server` (機能/業務ロジックサーバ役) は Docker コンテナとして動き、SSH経由でログを取得する練習対象です。
  - ログパス(コンテナ内): `/app/logs/service.log`

## server へのSSH接続情報

| 項目 | 値 |
|---|---|
| Host | `localhost` |
| Port | `5101` (`.env` の `SSH_PORT` で変更可) |
| User | `trainee` |
| 秘密鍵パス | `docker/sample-data/training_key` (このリポジトリに同梱、学習用途のため固定・平文) |
| ログファイル | `/app/logs/service.log` |

接続コマンド例:

```bash
ssh -i docker/sample-data/training_key -p 5101 trainee@localhost
```

ログ検索コマンド例(コマンドを直接実行、対話ログインは不要):

```bash
ssh -i docker/sample-data/training_key -p 5101 trainee@localhost "cat /app/logs/service.log"
ssh -i docker/sample-data/training_key -p 5101 trainee@localhost "grep TrackID:ABC1234 /app/logs/service.log"
```

初回接続時にホストキー確認で止まる場合は `-o StrictHostKeyChecking=no` を付与してください(学習用途のため厳密なホスト鍵検証は不要です)。

## TrackIDの書式

- `client/logs/app.log` と `server`側 `/app/logs/service.log` の両方に、同一リクエストについて同じ `TrackID:XXXXXXX` (英数字7文字、例: `TrackID:ABC1234`) が出現します。
- 正規表現: `TrackID:([A-Z0-9]{7})`

## ログの行フォーマット

両ログとも同一フォーマットです:

```
<ISO8601タイムスタンプ> <LEVEL> TrackID:<7文字> [<パス>] method=<HTTPメソッド> key=value ...
```

例(client側 app.log、エラー発生時):

```
2026-07-25T09:00:00.123Z ERROR TrackID:ABC1234 [/api/robots/RBT-DOG-02] method=GET status=500 err=TypeError: Cannot read properties of undefined (reading 'map') at=at getBySku (src/routes/inventory.js:34:33)
```

例(server側 service.log、同一TrackID):

```
2026-07-25T09:00:00.089Z ERROR TrackID:ABC1234 [/internal/inventory/RBT-DOG-02] method=GET status=500 err=TypeError: Cannot read properties of undefined (reading 'map') at=at getBySku (src/routes/inventory.js:34:33)
```

## 想定する収集手順(学習者がAIエージェントに作らせる部分)

1. `client/logs/app.log` を監視し、`ERROR` 行を検知する。
2. その行から `TrackID:` の値を取り出す。
3. 上記SSH接続情報を使い、`server` の `/app/logs/service.log` に同じTrackIDが含まれる行を検索する(`grep`など)。
4. 両方のログをTrackIDで紐づけて、1つのインシデントとしてまとめる。

監視の常駐化・定期実行・自動収集ロジック自体はこのプロジェクトの範囲外です。学習者がAIエージェントと一緒に作る対象です。
