# onprem_log_training — server (機能/業務ロジック層) コンテナ
# 学習者のAIエージェントがSSH経由でログを収集する練習対象。
#
# ベースイメージは docker.io の Docker公式イメージ (library/node) をフルパスで明示指定する。
# タグ名の短縮形 (node:18-alpine) だとホスト側のレジストリ設定に解決を委ねてしまうため、
# 他のコンテナレジストリが割り込む余地を排除するために docker.io/library/... で完全修飾する。
#
# 注: apk add はオンプレのdocker.io/npm限定ホワイトリストの対象外 (Alpineのパッケージミラーを使う)。
#     そのためこのイメージはホワイトリスト制約のない環境で一度だけビルドし、
#     完成イメージをdocker.io(Docker Hub)へpushする運用を前提とする。
#     オンプレ側では `docker pull` のみを行う (詳細は ../README.md 参照)。
FROM docker.io/library/node:18-alpine

# ビルド時 (apk add / npm install) のみプロキシを使う。HTTP_PROXY/HTTPS_PROXY/NO_PROXY は
# Dockerが特別扱いする予約済みARG名のため、ARG宣言だけで以降のRUN命令に自動的に渡る
# (--build-argで渡した値がビルドキャッシュのキー表示からも除外される)。
# ENV化して完成イメージに焼き込まないのは、実行環境ごとに異なるプロキシ設定が
# イメージに固定されてしまうのを避けるため — 実行時プロキシは docker-compose.yml の
# environment: で別途渡す。
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

RUN apk add --no-cache bash openssh-server sudo

RUN addgroup -g 2000 trainee && \
    adduser -D -u 2000 -G trainee trainee

WORKDIR /app

COPY server/package.json ./
RUN npm install --omit=dev

COPY server/ ./

RUN mkdir -p /app/logs && chown -R trainee:trainee /app

RUN mkdir -p /run/sshd && chmod 755 /run/sshd

COPY docker/sample-data/training_key.pub /tmp/training_key.pub
RUN mkdir -p /home/trainee/.ssh && \
    cp /tmp/training_key.pub /home/trainee/.ssh/authorized_keys && \
    chmod 700 /home/trainee/.ssh && \
    chmod 600 /home/trainee/.ssh/authorized_keys && \
    chown -R trainee:trainee /home/trainee/.ssh && \
    rm /tmp/training_key.pub

COPY docker/startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

ENV NODE_ENV=production \
    PORT=4002

EXPOSE 22 4002

CMD ["/app/startup.sh"]

LABEL description="onprem_log_training - server tier (SSH-accessible log source for training)"
