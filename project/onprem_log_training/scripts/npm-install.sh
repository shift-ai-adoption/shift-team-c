#!/bin/bash
# プロキシ設定を反映してから client/ と server/ に npm install する。
# 使い方: ./scripts/npm-install.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1090
source "$SCRIPT_DIR/proxy-env.sh"

for dir in client server; do
    echo "📦 npm install: $dir/"
    (cd "$ROOT_DIR/$dir" && npm install)
done
