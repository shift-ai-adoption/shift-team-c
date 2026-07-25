#!/bin/bash
# onprem_log_training — server コンテナのライフサイクル管理

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

if command_exists docker; then
    :
else
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command_exists docker-compose; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Docker Compose not found."
    exit 1
fi

# ../scripts/proxy-env.sh がある場合はプロキシ設定を反映する
if [ -f "../scripts/proxy-env.sh" ]; then
    source "../scripts/proxy-env.sh"
fi

case "$1" in
  rebuild)
    echo "🧹 Cleaning up existing container..."
    $COMPOSE_CMD down --volumes --remove-orphans 2>/dev/null || true
    docker rm -f onprem-log-training-server 2>/dev/null || true
    docker rmi onprem-log-training-server:latest 2>/dev/null || true
    echo "🏗️  Building image..."
    $COMPOSE_CMD build --no-cache
    echo "🚀 Starting container..."
    $COMPOSE_CMD up -d
    ;;
  start)
    echo "🚀 Starting container..."
    $COMPOSE_CMD up -d --build
    ;;
  stop)
    echo "🛑 Stopping container..."
    $COMPOSE_CMD stop
    ;;
  status)
    $COMPOSE_CMD ps
    ;;
  clean)
    echo "🧹 Removing container, image, network..."
    $COMPOSE_CMD down --volumes --remove-orphans 2>/dev/null || true
    docker rmi onprem-log-training-server:latest 2>/dev/null || true
    ;;
  *)
    echo "Usage: $0 {rebuild|start|stop|status|clean}"
    exit 1
    ;;
esac
