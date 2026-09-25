#!/usr/bin/env bash
# 从本地部署：打包前台（和后台）→ 上传 → 在服务器上执行 server-deploy.sh
# 日常只更新前台和服务配置时，可直接在 Jenkins 中点击构建；后台页面需要更新时用本脚本。
#
# 用法（在项目根目录执行）：
#   SERVER=root@47.84.72.178 SSH_KEY=~/.ssh/pinso.pem DOMAIN=pinso.top ./deploy/deploy.sh
#
# 可选环境变量：
#   DOMAIN          主域名（首次部署后服务器会记住，之后可省略）
#   CERTBOT_EMAIL   Let's Encrypt 账号邮箱
#   DASHBOARD_DIR   saleor-dashboard 源码目录，默认 ~/Desktop/saleor-dashboard
#   SKIP_DASHBOARD  设为 1 时跳过后台打包，服务器保留现有后台页面
#   REMOTE_DIR      服务器上的部署目录，默认 /opt/pinso
set -euo pipefail

: "${SERVER:?请设置 SERVER，例如 root@47.84.72.178}"
: "${SSH_KEY:?请设置 SSH_KEY，即私钥路径}"
DASHBOARD_DIR="${DASHBOARD_DIR:-$HOME/Desktop/saleor-dashboard}"
REMOTE_DIR="${REMOTE_DIR:-/opt/pinso}"
RELEASE="$REMOTE_DIR/release"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o SetEnv=LC_ALL=C.UTF-8 "$SERVER")
RSYNC=(rsync -az --delete -e "ssh -i $SSH_KEY")
step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

step "打包前台"
cd "$ROOT"
VITE_SALEOR_API_URL=/graphql/ npm run build

if [ "${SKIP_DASHBOARD:-0}" != "1" ]; then
  step "打包后台（合并中文语言包）"
  node "$ROOT/saleor/dashboard/apply-locale.mjs" "$DASHBOARD_DIR"
  # 后台需要 Node 24 + pnpm 11，打包约需 8GB 内存，因此在本地而不是服务器上打包
  (
    cd "$DASHBOARD_DIR"
    export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
    API_URL=/graphql/ APP_MOUNT_URI=/dashboard/ STATIC_URL=/dashboard/ LOCALE_CODE=ZH_HANS \
      npx -y pnpm@11 build
  )
fi

step "上传到 $SERVER:$RELEASE"
"${SSH[@]}" "mkdir -p $RELEASE && rm -rf $RELEASE/dashboard-dist"
"${RSYNC[@]}" "$ROOT/deploy" "$ROOT/dist" "$SERVER:$RELEASE/"
if [ "${SKIP_DASHBOARD:-0}" != "1" ]; then
  "${RSYNC[@]}" "$DASHBOARD_DIR/build/dashboard/" "$SERVER:$RELEASE/dashboard-dist/"
fi

"${SSH[@]}" "DOMAIN='${DOMAIN:-}' CERTBOT_EMAIL='${CERTBOT_EMAIL:-}' REMOTE_DIR=$REMOTE_DIR bash $RELEASE/deploy/server-deploy.sh $RELEASE"
