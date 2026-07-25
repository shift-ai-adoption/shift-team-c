#!/bin/bash
# オンプレ環境(docker.io/npmのみホワイトリスト)向け: 完成イメージを docker pull するだけの手順。
#
# 前提: server イメージは、ホワイトリスト制約のない環境で ./docker-build.sh によって
# 事前にビルドされ、docker.io (Docker Hub) へ push 済みであること。
# apk add 等を実行する `docker build` はオンプレ側では行わない。
#
# DOCKER_IMAGE は docker.io のフルパス (docker.io/<user>/<repo>:<tag>) で指定すること。
# 名前空間を省略した短縮名だと、コンテナ作成時にDocker側が他のレジストリ設定と解決を
# 迷う余地が生まれるため、必ずフルパスを .env の DOCKER_IMAGE に設定する。
#
# 注意: docker pull 自体のプロキシは Docker デーモン側の設定で決まり、
# このスクリプトが export する HTTP_PROXY 等のシェル環境変数では効かない。
# プロキシが必要な場合は、ホスト側で一度だけ以下を設定する(このスクリプトの範囲外):
#   /etc/systemd/system/docker.service.d/http-proxy.conf に
#     [Service]
#     Environment="HTTP_PROXY=http://proxy.example.internal:8080"
#     Environment="HTTPS_PROXY=http://proxy.example.internal:8080"
#   を書き、 `systemctl daemon-reload && systemctl restart docker`

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1090
source "$SCRIPT_DIR/proxy-env.sh"

if [ -z "$DOCKER_IMAGE" ]; then
    echo "❌ DOCKER_IMAGE が未設定です。.env に docker.io/<user>/<repo>:<tag> 形式で設定してください。" >&2
    exit 1
fi

echo "🐳 docker pull $DOCKER_IMAGE"
docker pull "$DOCKER_IMAGE"
