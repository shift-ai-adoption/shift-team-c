#!/bin/bash
# .env の USE_PROXY を見て HTTP_PROXY/HTTPS_PROXY/NO_PROXY を export/unset する。
# 他のスクリプトから `source scripts/proxy-env.sh` して使う。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

if [ "$USE_PROXY" = "true" ]; then
    export HTTP_PROXY HTTPS_PROXY NO_PROXY
    export http_proxy="$HTTP_PROXY"
    export https_proxy="$HTTPS_PROXY"
    export no_proxy="$NO_PROXY"
    echo "🌐 プロキシ有効: HTTP_PROXY=$HTTP_PROXY"
else
    unset HTTP_PROXY HTTPS_PROXY NO_PROXY http_proxy https_proxy no_proxy
    echo "🌐 プロキシ無効 (直接接続)"
fi
