#!/usr/bin/env bash
# 服务器端部署（需要 root）：本地 deploy.sh 与 Jenkins 共用这一份逻辑。
#
# 用法：server-deploy.sh <源码目录>
#   源码目录中需要有 deploy/（Compose、Nginx 配置）和 dist/（已打包的前台）；
#   如果存在 dashboard-dist/（已打包的后台），也会一并更新，否则保留服务器上现有的后台页面。
#
# 可选环境变量（首次设置后记录在 /opt/pinso/deploy.conf，之后可省略）：
#   DOMAIN          主域名（同时配置 www.主域名），不设置则只通过 IP 以 HTTP 访问
#   CERTBOT_EMAIL   Let's Encrypt 账号邮箱
#   REMOTE_DIR      部署目录，默认 /opt/pinso
set -euo pipefail

SRC="$(cd "${1:?用法：server-deploy.sh <源码目录>}" && pwd)"
REMOTE_DIR="${REMOTE_DIR:-/opt/pinso}"
CONF="$REMOTE_DIR/deploy.conf"
export DEBIAN_FRONTEND=noninteractive LC_ALL=C.UTF-8

[ "$(id -u)" = 0 ] || { echo "需要 root 权限运行"; exit 1; }
[ -f "$SRC/dist/index.html" ] || { echo "缺少已打包的前台：$SRC/dist"; exit 1; }

mkdir -p "$REMOTE_DIR"
# 读取上次部署记录的域名等配置，命令行传入的环境变量优先
if [ -f "$CONF" ]; then
  saved_domain="$(sed -n 's/^DOMAIN=//p' "$CONF")"
  saved_email="$(sed -n 's/^CERTBOT_EMAIL=//p' "$CONF")"
fi
DOMAIN="${DOMAIN:-${saved_domain:-}}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-${saved_email:-}}"
printf 'DOMAIN=%s\nCERTBOT_EMAIL=%s\n' "$DOMAIN" "$CERTBOT_EMAIL" > "$CONF"

SERVER_IP="$(curl -fsS -m 5 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null \
  || curl -fsS -m 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

step "检查运行环境（Docker、Nginx、Certbot）"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1
missing=""
command -v nginx >/dev/null || missing="$missing nginx"
command -v certbot >/dev/null || missing="$missing certbot"
if [ -n "$missing" ]; then
  # 新服务器常在后台自动安装更新，等待 apt 锁释放而不是直接失败
  apt-get -o DPkg::Lock::Timeout=600 update -qq
  apt-get -o DPkg::Lock::Timeout=600 install -y -qq $missing >/dev/null
fi
systemctl enable nginx >/dev/null 2>&1
rm -f /etc/nginx/sites-enabled/default
mkdir -p "$REMOTE_DIR"/www/storefront "$REMOTE_DIR"/www/dashboard "$REMOTE_DIR"/media "$REMOTE_DIR"/secrets \
         /etc/nginx/pinso /var/www/certbot
echo "docker $(docker version --format '{{.Server.Version}}') · $(nginx -v 2>&1 | cut -d/ -f2) · certbot $(certbot --version 2>&1 | cut -d' ' -f2)"

step "更新文件"
cp "$SRC/deploy/docker-compose.yml" "$REMOTE_DIR/"
rsync -a --delete "$SRC/deploy/nginx/" "$REMOTE_DIR/nginx/"
rsync -a --delete "$SRC/dist/" "$REMOTE_DIR/www/storefront/"
if [ -f "$SRC/dashboard-dist/index.html" ]; then
  rsync -a --delete "$SRC/dashboard-dist/" "$REMOTE_DIR/www/dashboard/"
  echo "前台和后台已更新"
else
  echo "前台已更新（后台保持不变）"
fi

step "生成或更新应用配置"
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

step "启动应用容器"
docker compose -p pinso up -d --remove-orphans
for i in $(seq 1 60); do
  [ "$(docker compose -p pinso ps api --format '{{.Health}}')" = healthy ] && { echo "✓ API 容器已就绪"; break; }
  [ "$i" = 60 ] && { echo "✗ API 容器未就绪"; docker compose -p pinso logs api --tail 30; exit 1; }
  sleep 5
done

step "配置 Nginx 与 HTTPS 证书"
cp nginx/locations.conf nginx/ssl.conf nginx/security-headers.conf /etc/nginx/pinso/
site=/etc/nginx/sites-available/pinso
ln -sf "$site" /etc/nginx/sites-enabled/pinso
use_https() { sed "s/__DOMAIN__/$DOMAIN/g" nginx/https.conf.template > "$site"; }
use_http() { cp nginx/http.conf "$site"; }
reload_nginx() {
  nginx -t -q
  if systemctl is-active --quiet nginx; then systemctl reload nginx; else systemctl restart nginx; fi
}

if [ -n "$DOMAIN" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  use_https
  reload_nginx
elif [ -n "$DOMAIN" ]; then
  # 先以 HTTP 提供验证文件，申请证书后切换为 HTTPS
  use_http
  reload_nginx
  if [ -n "$CERTBOT_EMAIL" ]; then account=(--email "$CERTBOT_EMAIL"); else account=(--register-unsafely-without-email); fi
  certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" -d "www.$DOMAIN" \
    --cert-name "$DOMAIN" --non-interactive --agree-tos "${account[@]}"
  use_https
  reload_nginx
else
  use_http
  reload_nginx
fi

# 证书续期：Certbot 自带 systemd 定时器（每天两次检查，到期前 30 天续期），续期成功后重新加载 Nginx
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'HOOK'
#!/bin/sh
systemctl reload nginx
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
systemctl enable --now certbot.timer >/dev/null 2>&1

step "验证服务"
if [ -n "$DOMAIN" ]; then
  base="https://$DOMAIN"; resolve=(--resolve "$DOMAIN:443:127.0.0.1")
else
  base="http://127.0.0.1"; resolve=()
fi
code="$(curl -sS -o /dev/null -w '%{http_code}' "${resolve[@]}" "$base/graphql/" \
  -H 'Content-Type: application/json' -d '{"query":"{ shop { name } }"}')"
[ "$code" = 200 ] || { echo "✗ API 返回 $code"; exit 1; }
code="$(curl -sS -o /dev/null -w '%{http_code}' "${resolve[@]}" "$base/")"
[ "$code" = 200 ] || { echo "✗ 前台返回 $code"; exit 1; }
echo "✓ 前台与 API 正常"
docker compose -p pinso ps --format 'table {{.Service}}\t{{.Status}}'

[ -n "$DOMAIN" ] || base="http://$SERVER_IP"
cat <<EOF

前台：$base/
后台：$base/dashboard/
EOF
