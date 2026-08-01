# onprem_log_training — オンプレ研修用ログ収集対象環境

`projects/log_collector` のデモアプリ(RoboMart)とログ出力部分を、別のオンプレミス環境でも動かせるよう
切り出した独立プロジェクトです ([Issue #40](https://github.com/shiftrepo/ai_workshop/issues/40))。

既存の `log_collector` とは異なり、このプロジェクトは**研修受講者がAIエージェントを使って
自分でログ収集ツールを作ってみる練習環境**です。そのため、SSHログ収集ツール本体
(`log_collector/log-collector-skill`)は含みません — 受講者が自作する対象です。

---

## 研修の目的

実際の業務システムでは、複数のサーバーがそれぞれ独立にログを出力しており、
障害発生時に「どのサーバーの、どの時刻の、どのログが同じ処理に関するものか」を
特定するのが困難です。この研修環境では、その状況を小規模・安全に再現し、
**AIエージェントを使ってログ収集・分析ツールを自作する体験**を提供します。

---

## 全体構成

```
onprem_log_training/
├── client/          # アプリケーションサーバ役（RoboMart Web/API層）
│   └── logs/
│       └── app.log  # clientログ（ホストへbind mount、SSH不要で直接読める）
├── server/          # 機能サーバ役（在庫・注文の業務ロジック）
│   └── (コンテナ内) /app/logs/service.log  # SSH経由でのみアクセス可
├── log-viewer/      # ログ可視化ダッシュボード（研修完成物サンプル）
├── docker/          # docker-compose.yml / Dockerfile
├── docs/            # 研修資料（Markdown + インフォグラフ）
├── scripts/         # npm install / docker build / pull ヘルパー
├── AGENT_SSH_GUIDE.md  # AIエージェント向けSSH接続情報
└── README.md        # このファイル
```

### サービス構成

| 役割 | コンテナ名 | 公開ポート | ログの場所 |
|---|---|---|---|
| **client**（アプリ層） | `onprem-log-training-client` | `:3002` | `client/logs/app.log`（ホストbind mount） |
| **server**（業務ロジック層） | `onprem-log-training-server` | `:4002`（HTTP）/ `:5101`（SSH） | コンテナ内 `/app/logs/service.log` |
| **log-viewer**（ダッシュボード） | `onprem-log-viewer` | `${LOG_VIEWER_PORT:-8090}`（デフォルト`:8090`） | — |

---

## TrackIDによるログ相関

1つのユーザー操作が発生すると、`client` は7文字のランダムな識別子（**TrackID**）を発行します。
この TrackID は `client` → `server` へのHTTPヘッダ（`X-Track-Id`）で伝播し、
**両方のログに同じ TrackID が残ります**。

```
ブラウザ操作
   │
   ▼
client  (TrackID: ABC1234 を発行)
   │  X-Track-Id: ABC1234 を付けて問い合わせ
   ▼
server  (受け取った ABC1234 を自分のログにも記録)
```

| ログファイル | 場所 | アクセス方法 |
|---|---|---|
| `client/logs/app.log` | ホストにbind mount | 直接ファイル読み込み |
| `/app/logs/service.log` | コンテナ内 | SSH経由（ポート`:5101`） |

**この「同じ TrackID が複数ログに分散する」状態を解決することが研修の核心です。**

---

## 意図的に仕込まれたバグ

研修体験のため、`server` 側に2つのバグが仕込まれています（`server/bug-config.json` で有効/無効切替可）。

| 操作 | エラー内容 | バグID |
|---|---|---|
| WalkyDog Mk2の詳細ページを開く | `TypeError: Cannot read properties of undefined (reading 'map')` | `PRODUCT_STOCK_ZERO_NPE` |
| 請求書払いで注文確定 | `Invoice payment method not supported` | `ORDER_TOTAL_UNDEFINED_TAX` |

どちらもブラウザ操作でエラーを発生させ、TrackIDを使って2つのログを突き合わせる体験ができます。

---

## クイックスタート（Docker、推奨）

```bash
cp .env.example .env
# 必要に応じて .env の LOG_VIEWER_PORT を環境のSG/ファイアウォールで開放済みのポートに変更する
cd docker
docker-compose up -d --build
```

ブラウザで以下のURLにアクセスします（`<外部ドメイン>` は環境に応じて読み替えてください）。

| サービス | URL |
|---|---|
| RoboMart ECサイト | `http://<外部ドメイン>:3002/` |
| Log Viewer ダッシュボード | `http://<外部ドメイン>:<LOG_VIEWER_PORT>/` |

停止・削除:

```bash
docker-compose stop
docker-compose down
```

---

## クイックスタート（ローカル、Dockerなし）

```bash
# server（機能サーバ）を起動
cd server && npm install
PORT=4002 node server.js &

# client（アプリ）を起動
cd ../client && npm install
PORT=3002 SERVER_BASE_URL=http://localhost:4002 node server.js &

# log-viewerを起動
cd ../log-viewer
node server.js
```

`client/logs/app.log` はホストに直接書き込まれるため、log-viewer はコンテナなしでも実ログを読めます。

---

## 研修の流れ

受講者はAIエージェント（Claude Codeなど）に指示を出しながら、以下を自作します。

1. **エラー検知** — `client/logs/app.log` を監視し、ERROR行を検出する
2. **TrackID抽出** — 検出行から `TrackID:[A-Z0-9]{7}` を取り出す
3. **SSH収集** — `AGENT_SSH_GUIDE.md` を参考に、server側ログを SSH経由で検索する
4. **ログ紐づけ** — 2つのログを TrackID でまとめ、1インシデントとして表示する

SSH接続情報（ホスト・ポート・鍵・ログパス）は [AGENT_SSH_GUIDE.md](AGENT_SSH_GUIDE.md) にまとめています。
AIエージェントにこのファイルを読ませるだけで、受講者がSSH詳細を覚える必要はありません。

---

## 研修完成物サンプル

`log-viewer/` には、上記ログ収集ツールの**完成物サンプル**としてダッシュボードが実装されています。
詳細は [log-viewer/README.md](log-viewer/README.md) を参照してください。

---

## プロキシ設定（オンプレ環境向け）

`.env` の `USE_PROXY` で切替可能です。

```bash
cp .env.example .env
# USE_PROXY=true にして HTTP_PROXY / HTTPS_PROXY / NO_PROXY を設定
```

| スクリプト | 用途 |
|---|---|
| `scripts/npm-install.sh` | プロキシ設定を反映して client/server の `npm install` を実行 |
| `scripts/docker-build.sh` | プロキシを `--build-arg` で渡して server イメージをビルド |
| `scripts/docker-pull.sh` | ビルド済みイメージを `docker pull` するだけの手順 |

> **補足（ホワイトリスト環境）:** `apk add` は Alpine独自ミラーにアクセスするため、
> docker.io / npm のみ許可された環境ではビルドできません。
> ホワイトリスト制限のない環境でイメージをビルド → Docker Hub に push → オンプレ側は `docker pull` のみ、
> という運用を推奨します（詳細は `scripts/docker-pull.sh` 内コメント参照）。

---

## 学習者向け解説資料

| ドキュメント | 内容 |
|---|---|
| [docs/01_environment_overview.md](docs/01_environment_overview.md) | 環境全体構成・TrackIDによるログ相関の説明 |
| [docs/02_building_log_collector_with_ai.md](docs/02_building_log_collector_with_ai.md) | AIエージェントでログ収集ツールを作る際のポイントとプロンプト例 |
| [docs/03_container_basics.md](docs/03_container_basics.md) | コンテナ(Docker)の説明と仮想マシンとの違い |
