# onprem_log_training — オンプレ研修用ログ収集対象環境

`projects/log_collector` のデモアプリ(RoboMart)とログ出力部分を、別のオンプレミス環境でも動かせるよう
切り出した独立プロジェクトです ([Issue #40](https://github.com/shiftrepo/ai_workshop/issues/40))。

既存の `log_collector` とは異なり、このプロジェクトは**研修受講者がAIエージェントを使って
自分でログ収集ツールを作ってみる練習環境**です。そのため、SSHログ収集ツール本体
(`log_collector/log-collector-skill`)は含みません — 受講者が自作する対象です。

## 構成

- **`client/`** — アプリケーションサーバ役。RoboMart(架空のロボット販売ECサイト)のWeb/API層。
  ローカルの `node` プロセスとして動作し、`client/logs/app.log` にリクエストログを記録します。
- **`server/`** — 機能(業務ロジック)サーバ役。在庫・注文計算などの業務ロジックを提供するAPI。
  Dockerコンテナとして動作し、SSH経由でログ(`server/logs/service.log`)にアクセスできます
  (収集練習の対象)。
- `client` → `server` へのHTTP呼び出しには `X-Track-Id` ヘッダでTrackIDを伝播させ、
  両方のログに同一TrackIDが残るようにしています。これにより「別サーバーのログをTrackIDで
  紐づけて収集する」という研修テーマを体験できます。

## クイックスタート(ローカル、Dockerなし)

```bash
# server (機能サーバ) を起動
cd server
npm install
PORT=4002 node server.js

# 別ターミナルで client (アプリケーションサーバ) を起動
cd client
npm install
PORT=3002 SERVER_BASE_URL=http://localhost:4002 node server.js
```

ブラウザで `http://localhost:3002/` を開きます。

- 在庫切れ商品「WalkyDog Mk2」の詳細ページを開く → 500エラー(`PRODUCT_STOCK_ZERO_NPE`)
- カートに商品を追加し、決済方法「請求書払い」で注文確定 → 500エラー(`ORDER_TOTAL_UNDEFINED_TAX`)

いずれのエラーもレスポンスに `track_id` が含まれ、`client/logs/app.log` と
`server/logs/service.log` の両方に同じTrackIDでログが残ります。

バグは `server/bug-config.json` の `enabled` を `false` にすると個別に無効化できます。

## server をDocker/SSHで動かす(収集練習用)

```bash
cp .env.example .env
cd docker
./setup-containers.sh start
```

これで `server` がコンテナとして起動し、SSH(既定ポート `5101`)でログにアクセスできます。
学習者のAIエージェント向けの接続情報は [AGENT_SSH_GUIDE.md](AGENT_SSH_GUIDE.md) にまとめています。
学習者はこのファイルをAIエージェントに読ませるだけで、SSH接続の詳細を意識せずに使えます。

コンテナの停止/削除:

```bash
./setup-containers.sh stop
./setup-containers.sh clean
```

## プロキシ切替(オンプレ環境向け)

`.env` の `USE_PROXY` で切替可能です。

```bash
cp .env.example .env
# USE_PROXY=true にしてHTTP_PROXY/HTTPS_PROXY/NO_PROXYを設定
```

- `scripts/npm-install.sh` — プロキシ設定を反映して `client`/`server` の `npm install` を実行します。
- `scripts/docker-build.sh` — プロキシ設定を `--build-arg` として渡し、`server` イメージをビルドします。
- `scripts/docker-pull.sh` — ビルド済みイメージを `docker pull` するだけの手順です(下記参照)。

### プロキシが関わる3つの場面と対応状況

コンテナ関連の通信は「ビルド時」「pull時(コンテナ作成時)」「実行時(コンテナ内プロセス)」の
3つに分かれ、それぞれ効くレイヤーが異なります。

| 場面 | プロキシの効くレイヤー | 本プロジェクトの対応 |
|---|---|---|
| ①`docker build`中の`apk add`/`npm install` | Dockerfile内の`RUN`が使うシェル環境変数 | `docker/Dockerfile`で`ARG HTTP_PROXY/HTTPS_PROXY/NO_PROXY`を宣言し、`docker-compose.yml`の`build.args`から渡す。**完成イメージには焼き込まない**(ビルド環境と実行環境のプロキシ設定が違っても影響しないようにするため) |
| ②`docker pull`(コンテナ作成時) | Dockerデーモン自体の設定 | シェルの環境変数では効かない。ホスト側で一度だけ`/etc/systemd/system/docker.service.d/http-proxy.conf`を設定する(下記参照、本プロジェクトのスクリプトの範囲外) |
| ③コンテナ実行時(`node server.js`プロセス) | コンテナに渡された環境変数 | `docker-compose.yml`の`environment:`で`HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`をコンテナに渡す。現状の`server`は外部通信をしないため実害はないが、将来学習者がコードを拡張して外部通信を追加した場合にも自動的にプロキシが効く |

いずれも `.env` の `USE_PROXY` 一つで切替可能です(`scripts/proxy-env.sh`が`USE_PROXY=false`のとき
これらの変数を空にするため、①③は自動的にプロキシなしになります)。

### ホワイトリスト(docker.io / npm のみ)への対応

このオンプレ環境のネットワークホワイトリストは `docker.io` と `npm` のみです。
一方、既存のDocker構築パターンが使う `apk add openssh-server` はAlpine独自の
パッケージミラー(`dl-cdn.alpinelinux.org`)にアクセスするため、**プロキシを経由しても
ホワイトリストの対象外**になります。これはプロキシ設定では解決できません。

そのため、次の運用を前提とします:

1. `server` のDockerイメージは、ホワイトリスト制約のない環境で `scripts/docker-build.sh` を使って
   一度だけビルドする(ベースイメージは `docker.io/library/node:18-alpine` をフルパスで指定済み、
   Docker公式イメージ)。
2. ビルドしたイメージに `docker.io/your-dockerhub-username/onprem-log-training-server:latest`
   のようなフルパスのタグを付け、`docker push` でdocker.io(Docker Hub)へ公開する。
3. `.env` の `DOCKER_IMAGE` に、公開した上記フルパスを設定する。
4. オンプレ環境側では `scripts/docker-pull.sh` で `docker pull` するだけとし、
   `docker build`/`apk add` は一切実行しない。`DOCKER_IMAGE` を常にdocker.ioのフルパスで
   指定することで、コンテナ作成時に他のレジストリと解決を迷う余地をなくしている(上表②)。

`docker pull` 自体のプロキシは、シェルの環境変数ではなくDockerデーモン側の設定
(`/etc/systemd/system/docker.service.d/http-proxy.conf`)で決まります。これはホスト側で
一度だけ行う設定であり、本プロジェクトのスクリプトの範囲外です(詳細は
`scripts/docker-pull.sh`内のコメントを参照)。

## 学習者向け解説資料

インフォグラフ(一枚絵)作成の元原稿として、以下のドキュメントを用意しています。

| ドキュメント | 内容 |
|---|---|
| [docs/01_environment_overview.md](docs/01_environment_overview.md) | この環境の全体構成、client/server分離とTrackIDによるログ相関の説明 |
| [docs/02_building_log_collector_with_ai.md](docs/02_building_log_collector_with_ai.md) | AIエージェントでログ収集ツールを作る際のポイントとプロンプト例 |
| [docs/03_container_basics.md](docs/03_container_basics.md) | コンテナ(Docker)の説明と仮想マシンとの違い |

## 変更していないもの

このプロジェクトは `projects/log_collector/` 配下のいずれのファイルも変更していません
(`demo-app`, `dev-environment`, `auto-repair-demo`, `log-collector-skill` はすべて既存のまま)。
