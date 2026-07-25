#!/bin/bash
# プロキシ設定を --build-arg として渡しつつ server イメージをビルドする。
#
# 注意: apk add (openssh-server) はAlpineの独自パッケージミラーへアクセスするため、
# docker.io/npm限定のホワイトリスト内では実行できない。このスクリプトは
# ホワイトリスト制約のない環境でイメージを作る用途で使い、ビルド後は
# `docker push` でdocker.io(Docker Hub)へ公開する。オンプレ側では
# ./docker-pull.sh のみを使うこと (詳細は ../README.md 参照)。
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1090
source "$SCRIPT_DIR/proxy-env.sh"

cd "$ROOT_DIR/docker"

if docker compose version >/dev/null 2>&1; then
    docker compose build --build-arg HTTP_PROXY="$HTTP_PROXY" --build-arg HTTPS_PROXY="$HTTPS_PROXY"
else
    docker-compose build --build-arg HTTP_PROXY="$HTTP_PROXY" --build-arg HTTPS_PROXY="$HTTPS_PROXY"
fi
