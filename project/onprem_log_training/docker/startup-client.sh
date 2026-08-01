#!/bin/sh
# client コンテナ起動スクリプト
# bind mount された /app/logs のパーミッションを node ユーザーが書き込めるよう修正してから
# アプリを起動する。研修生が手動で chmod を実行する必要はない。
set -e

mkdir -p /app/logs
chmod 777 /app/logs
# ログファイルが既に存在する場合はパーミッションを修正する
if [ -f /app/logs/app.log ]; then
  chmod 666 /app/logs/app.log
fi

# node ユーザーに切り替えてアプリを起動
exec su-exec node node server.js
