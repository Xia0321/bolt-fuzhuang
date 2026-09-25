#!/usr/bin/env bash
# 本地启动 Saleor API（开发用）。依赖：Homebrew 的 postgresql@16、redis、libmagic
# 用法：SALEOR_DIR=~/Desktop/saleor-core ./saleor/local/start-api.sh
set -euo pipefail
SALEOR_DIR="${SALEOR_DIR:-$HOME/Desktop/saleor-core}"
cd "$SALEOR_DIR"

export DATABASE_URL="${DATABASE_URL:-postgres://saleor:saleor@localhost:5432/saleor}"
export SECRET_KEY="${SECRET_KEY:-local-dev-secret}"
export PUBLIC_URL="${PUBLIC_URL:-http://localhost:8000/}"
export ALLOWED_HOSTS="${ALLOWED_HOSTS:-localhost,127.0.0.1}"
export ALLOWED_CLIENT_HOSTS="${ALLOWED_CLIENT_HOSTS:-localhost,127.0.0.1}"
export DEBUG="${DEBUG:-True}"
# libmagic 由 Homebrew 安装，python-magic 需要能找到它
export DYLD_FALLBACK_LIBRARY_PATH="/opt/homebrew/lib:${DYLD_FALLBACK_LIBRARY_PATH:-}"

exec .venv/bin/uvicorn saleor.asgi:application --host 0.0.0.0 --port 8000 --reload
