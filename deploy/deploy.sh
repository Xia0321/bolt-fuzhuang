#!/usr/bin/env bash
# 一键部署：本地打包前台和后台 → 上传 → Docker 运行应用 → 宿主机 Nginx 反向代理 + Let's Encrypt HTTPS
#
# 用法（在项目根目录执行）：
#   SERVER=root@47.84.72.178 SSH_KEY=~/.ssh/pinso.pem DOMAIN=pinso.top ./deploy/deploy.sh
#
# 可选环境变量：
#   DOMAIN          主域名（同时配置 www.主域名）。不设置则只通过 IP 以 HTTP 访问
#   CERTBOT_EMAIL   Let's Encrypt 账号邮箱，不设置则不绑定邮箱注册
#   DASHBOARD_DIR   saleor-dashboard 源码目录，默认 ~/Desktop/saleor-dashboard
#   SKIP_DASHBOARD  设为 1 时跳过后台打包（后台没有变化时可节省时间）
#   REMOTE_DIR      服务器上的部署目录，默认 /opt/pinso
set -euo pipefail

: "${SERVER:?请设置 SERVER，例如 root@47.84.72.178}"
: "${SSH_KEY:?请设置 SSH_KEY，即私钥路径}"
DOMAIN="${DOMAIN:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
DASHBOARD_DIR="${DASHBOARD_DIR:-$HOME/Desktop/saleor-dashboard}"
REMOTE_DIR="${REMOTE_DIR:-/opt/pinso}"
SERVER_IP="${SERVER#*@}"

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

step "检查服务器运行环境（Docker、Nginx、Certbot）"
"${SSH[@]}" "REMOTE_DIR=$REMOTE_DIR bash -s" <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive LC_ALL=C.UTF-8
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null
missing=""
command -v nginx >/dev/null || missing="$missing nginx"
command -v certbot >/dev/null || missing="$missing certbot"
if [ -n "$missing" ]; then
  # 新服务器常在后台自动安装更新，等待 apt 锁释放而不是直接失败
  apt-get -o DPkg::Lock::Timeout=600 update -qq
  apt-get -o DPkg::Lock::Timeout=600 install -y -qq $missing >/dev/null
fi
systemctl enable nginx >/dev/null
rm -f /etc/nginx/sites-enabled/default
mkdir -p "$REMOTE_DIR"/www/storefront "$REMOTE_DIR"/www/dashboard "$REMOTE_DIR"/media "$REMOTE_DIR"/secrets \
         /etc/nginx/pinso /var/www/certbot
echo "docker $(docker version --format '{{.Server.Version}}') · $(nginx -v 2>&1 | cut -d/ -f2) · certbot $(certbot --version 2>&1 | cut -d' ' -f2)"
REMOTE

step "上传到 $SERVER:$REMOTE_DIR"
"${RSYNC[@]}" "$ROOT/deploy/docker-compose.yml" "$SERVER:$REMOTE_DIR/"
"${RSYNC[@]}" "$ROOT/deploy/nginx/" "$SERVER:$REMOTE_DIR/nginx/"
"${RSYNC[@]}" "$ROOT/dist/" "$SERVER:$REMOTE_DIR/www/storefront/"
if [ "${SKIP_DASHBOARD:-0}" != "1" ]; then
  "${RSYNC[@]}" "$DASHBOARD_DIR/build/dashboard/" "$SERVER:$REMOTE_DIR/www/dashboard/"
fi

step "生成或更新应用配置"
"${SSH[@]}" "DOMAIN='$DOMAIN' SERVER_IP=$SERVER_IP REMOTE_DIR=$REMOTE_DIR bash -s" <<'REMOTE'
set -euo pipefail
cd "$REMOTE_DIR"
if [ ! -f secrets/jwt.pem ]; then
  openssl genrsa -out secrets/jwt.pem 2048 2>/dev/null
  chmod 644 secrets/jwt.pem
fi
if [ ! -f .env ]; then
  cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SECRET_KEY=$(openssl rand -hex 48)
DEFAULT_CHANNEL_SLUG=cn
EOF
  chmod 600 .env
fi
# 与访问地址相关的配置每次按 DOMAIN 重新写入
set_env() { grep -q "^$1=" .env && sed -i "s|^$1=.*|$1=$2|" .env || echo "$1=$2" >> .env; }
if [ -n "$DOMAIN" ]; then
  set_env PUBLIC_URL "https://$DOMAIN/"
  set_env ALLOWED_HOSTS "$DOMAIN,www.$DOMAIN,$SERVER_IP,localhost,127.0.0.1"
  set_env ALLOWED_CLIENT_HOSTS "$DOMAIN,www.$DOMAIN"
else
  set_env PUBLIC_URL "http://$SERVER_IP/"
  set_env ALLOWED_HOSTS "$SERVER_IP,localhost,127.0.0.1"
  set_env ALLOWED_CLIENT_HOSTS "$SERVER_IP,localhost"
fi
# 旧版部署把图片存在 Docker 卷里，迁移到宿主机目录后由 Nginx 直接提供
if docker volume inspect pinso_media >/dev/null 2>&1 && [ -z "$(ls -A media)" ]; then
  docker run --rm -v pinso_media:/from -v "$REMOTE_DIR/media":/to alpine cp -a /from/. /to/
  echo "已迁移旧版图片到 $REMOTE_DIR/media"
fi
REMOTE

step "启动应用容器"
# --remove-orphans 会移除旧版部署中的 Nginx 容器，释放 80 端口给宿主机 Nginx
"${SSH[@]}" "REMOTE_DIR=$REMOTE_DIR bash -s" <<'REMOTE'
set -euo pipefail
cd "$REMOTE_DIR"
docker compose up -d --remove-orphans
for i in $(seq 1 60); do
  [ "$(docker compose ps api --format '{{.Health}}')" = healthy ] && { echo "✓ API 容器已就绪"; exit 0; }
  sleep 5
done
echo "✗ API 容器未就绪"; docker compose logs api --tail 30; exit 1
REMOTE

step "配置 Nginx 与 HTTPS 证书"
"${SSH[@]}" "DOMAIN='$DOMAIN' CERTBOT_EMAIL='$CERTBOT_EMAIL' REMOTE_DIR=$REMOTE_DIR bash -s" <<'REMOTE'
set -euo pipefail
cp "$REMOTE_DIR"/nginx/locations.conf "$REMOTE_DIR"/nginx/ssl.conf "$REMOTE_DIR"/nginx/security-headers.conf /etc/nginx/pinso/
site=/etc/nginx/sites-available/pinso
ln -sf "$site" /etc/nginx/sites-enabled/pinso

use_https() {
  sed "s/__DOMAIN__/$DOMAIN/g" "$REMOTE_DIR"/nginx/https.conf.template > "$site"
}
use_http() {
  cp "$REMOTE_DIR"/nginx/http.conf "$site"
}
reload() {
  nginx -t -q
  systemctl is-active --quiet nginx && systemctl reload nginx || systemctl restart nginx
}

if [ -n "$DOMAIN" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  use_https
  reload
elif [ -n "$DOMAIN" ]; then
  # 先以 HTTP 提供验证文件，申请证书后切换为 HTTPS
  use_http
  reload
  if [ -n "$CERTBOT_EMAIL" ]; then account=(--email "$CERTBOT_EMAIL"); else account=(--register-unsafely-without-email); fi
  certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" -d "www.$DOMAIN" \
    --cert-name "$DOMAIN" --non-interactive --agree-tos "${account[@]}"
  use_https
  reload
else
  use_http
  reload
fi

# 证书续期：Certbot 自带 systemd 定时器（每天两次检查，到期前 30 天续期），续期成功后重新加载 Nginx
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'HOOK'
#!/bin/sh
systemctl reload nginx
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
systemctl enable --now certbot.timer >/dev/null
REMOTE

BASE_URL="http://$SERVER_IP"
[ -n "$DOMAIN" ] && BASE_URL="https://$DOMAIN"

step "验证服务"
for i in $(seq 1 30); do
  if curl -fsS -m 10 -o /dev/null "$BASE_URL/graphql/" -H 'Content-Type: application/json' \
       -d '{"query":"{ shop { name } }"}'; then
    echo "✓ API 可以通过 $BASE_URL 访问"
    break
  fi
  [ "$i" = 30 ] && { echo "✗ 无法访问 $BASE_URL，请检查安全组是否放行 80/443 端口"; exit 1; }
  sleep 5
done
"${SSH[@]}" "cd $REMOTE_DIR && docker compose ps --format 'table {{.Service}}\t{{.Status}}' && systemctl is-active nginx certbot.timer"

cat <<EOF

前台：$BASE_URL/
后台：$BASE_URL/dashboard/
API ：$BASE_URL/graphql/
EOF
