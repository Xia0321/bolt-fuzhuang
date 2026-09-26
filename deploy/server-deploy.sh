#!/usr/bin/env bash
# 服务器端部署（需要 root）：本地 deploy.sh 与 Jenkins 共用这一份逻辑。
#
# 用法：server-deploy.sh <源码目录> [阶段]
#   源码目录中需要有 deploy/（Compose、Nginx 配置）和 dist/（已打包的前台）；
#   如果存在 dashboard-dist/（已打包的后台），也会一并更新，否则保留服务器上现有的后台页面。
#
#   阶段（可用逗号组合，默认 all 依次执行全部，本地 deploy.sh 使用）：
#     env         检查运行环境（Docker、Nginx、Certbot）
#     files       更新文件（Compose、服务代码、Nginx 配置、前台页面）
#     config      生成或更新应用配置（.env）
#     services    启动或更新应用容器
#     nginx       配置 Nginx 与 HTTPS 证书
#     email       配置邮件服务
#     extensions  安装后台扩展
#     verify      验证服务
#     dashboard   只更新后台页面（dashboard-dist/），供 Jenkins「发布管理后台」使用
#   Jenkins 按阶段分步调用，任务页面上可以看到每一步的进度。
#
# 可选环境变量（首次设置后记录在 /opt/pinso/deploy.conf，之后可省略）：
#   DOMAIN          主域名（同时配置 www.主域名），不设置则只通过 IP 以 HTTP 访问
#   CERTBOT_EMAIL   Let's Encrypt 账号邮箱
#   REMOTE_DIR      部署目录，默认 /opt/pinso
set -euo pipefail

SRC="$(cd "${1:?用法：server-deploy.sh <源码目录> [阶段]}" && pwd)"
PHASES="${2:-all}"
REMOTE_DIR="${REMOTE_DIR:-/opt/pinso}"
CONF="$REMOTE_DIR/deploy.conf"
export DEBIAN_FRONTEND=noninteractive LC_ALL=C.UTF-8

[ "$(id -u)" = 0 ] || { echo "需要 root 权限运行"; exit 1; }

# 只接受已知的阶段名（Jenkins 的 sudo 规则允许传入阶段参数）
for phase in ${PHASES//,/ }; do
  case "$phase" in
    all|env|files|config|services|nginx|email|extensions|verify|dashboard) ;;
    *) echo "未知阶段：$phase"; exit 1 ;;
  esac
done
want() { [ "$PHASES" = all ] || [[ ",$PHASES," == *",$1,"* ]]; }

if want files; then
  [ -f "$SRC/dist/index.html" ] || { echo "缺少已打包的前台：$SRC/dist"; exit 1; }
fi

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

# 向后台 index.html 注入增强脚本（校验失败时自动滚动到错误字段），后台页面每次更新后都要执行
inject_dashboard_enhancements() {
dashboard_html="$REMOTE_DIR/www/dashboard/index.html"
if [ -f "$dashboard_html" ] && ! grep -q 'pinso-enhancements' "$dashboard_html"; then
  python3 - "$dashboard_html" <<'PYEOF'
import sys, pathlib
f = pathlib.Path(sys.argv[1])
html = f.read_text()
script = '''<script id="pinso-enhancements">
(function(){
  // 错误 toast 出现时，自动滚动到页面中第一个报错字段
  function scrollToFirstError() {
    // Saleor Dashboard 错误字段：aria-invalid 或 含 error 类的 input/textarea，
    // 或其下方的错误文字段落
    var selectors = [
      'input[aria-invalid="true"]',
      'textarea[aria-invalid="true"]',
      '[class*="error"] input',
      '[class*="error"] textarea',
      'p[class*="error"]:not(:empty)',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.offsetParent !== null) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
  }
  // 监听 toast 区域：Saleor 把 toast 挂在 body 直接子节点的 portal 里
  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var nodes = mutations[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        var node = nodes[j];
        if (node.nodeType === 1) {
          // 新增节点包含"错误"或 error 字样时触发滚动
          var text = node.textContent || '';
          if (text.indexOf('错误') !== -1 || text.toLowerCase().indexOf('error') !== -1) {
            setTimeout(scrollToFirstError, 100);
            return;
          }
        }
      }
    }
  });
  document.addEventListener('DOMContentLoaded', function(){
    observer.observe(document.body, { childList: true, subtree: false });
  });
})();
</script>'''
html = html.replace('</body>', script + '</body>', 1)
f.write_text(html)
print('已注入 pinso-enhancements')
PYEOF
fi
}

# 用 dashboard-dist/ 替换后台页面
install_dashboard() {
  [ -f "$SRC/dashboard-dist/index.html" ] || { echo "缺少已打包的后台：$SRC/dashboard-dist"; exit 1; }
  mkdir -p "$REMOTE_DIR/www/dashboard"
  rsync -a --delete "$SRC/dashboard-dist/" "$REMOTE_DIR/www/dashboard/"
  inject_dashboard_enhancements
  [ -f "$SRC/dashboard-dist/pinso-version.txt" ] && sed 's/^/后台版本：/' "$SRC/dashboard-dist/pinso-version.txt"
  echo "✓ 后台页面已更新"
}

if want env; then
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
mkdir -p "$REMOTE_DIR"/www/storefront "$REMOTE_DIR"/www/dashboard "$REMOTE_DIR"/www/admin-tools "$REMOTE_DIR"/media "$REMOTE_DIR"/secrets \
         /etc/nginx/pinso /var/www/certbot
echo "docker $(docker version --format '{{.Server.Version}}') · $(nginx -v 2>&1 | cut -d/ -f2) · certbot $(certbot --version 2>&1 | cut -d' ' -f2)"
fi

if want dashboard; then
  step "更新后台页面"
  install_dashboard
fi

if want files; then
step "更新文件"
cp "$SRC/deploy/docker-compose.yml" "$REMOTE_DIR/"
rsync -a --delete "$SRC/deploy/account-gw/" "$REMOTE_DIR/account-gw/"
rsync -a --delete "$SRC/deploy/saleor/" "$REMOTE_DIR/saleor/"
rsync -a --delete --exclude node_modules "$SRC/deploy/product-importer/" "$REMOTE_DIR/product-importer/"
rsync -a --delete "$SRC/deploy/nginx/" "$REMOTE_DIR/nginx/"
rsync -a --delete "$SRC/deploy/admin-panel/" "$REMOTE_DIR/www/admin-tools/"
rsync -a --delete "$SRC/dist/" "$REMOTE_DIR/www/storefront/"
if [ -f "$SRC/dashboard-dist/index.html" ]; then
  install_dashboard
  echo "前台和后台已更新"
else
  echo "前台已更新（后台保持不变）"
fi
inject_dashboard_enhancements
fi

if want config; then
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
# 首次部署时自动生成管理工具密钥
grep -q "^GW_ADMIN_SECRET=." .env || echo "GW_ADMIN_SECRET=$(openssl rand -hex 20)" >> .env
# 与访问地址相关的配置每次按 DOMAIN 重新写入
set_env() { grep -q "^$1=" .env && sed -i "s|^$1=.*|$1=$2|" .env || echo "$1=$2" >> .env; }
if [ -n "$DOMAIN" ]; then
  set_env PUBLIC_URL "https://$DOMAIN/"
  set_env ALLOWED_HOSTS "$DOMAIN,www.$DOMAIN,$SERVER_IP,localhost,127.0.0.1"
  set_env ALLOWED_CLIENT_HOSTS "$DOMAIN,www.$DOMAIN"
  set_env STOREFRONT_URL "https://$DOMAIN"
else
  set_env PUBLIC_URL "http://$SERVER_IP/"
  set_env ALLOWED_HOSTS "$SERVER_IP,localhost,127.0.0.1"
  set_env ALLOWED_CLIENT_HOSTS "$SERVER_IP,localhost"
  set_env STOREFRONT_URL "http://$SERVER_IP"
fi
# 顾客注册需要 Turnstile 密钥和 Saleor App 令牌（见 README「顾客注册」），缺少时注册功能关闭
grep -qE "^(CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY)=." .env || echo "提示：.env 中未配置 CLAUDE_CODE_OAUTH_TOKEN 或 ANTHROPIC_API_KEY，后台商品导入无法翻译"
for key in TURNSTILE_SITE_KEY TURNSTILE_SECRET SALEOR_APP_TOKEN; do
  grep -q "^$key=." .env || echo "提示：.env 中未配置 $key，顾客注册暂不可用"
done
# 旧版部署把图片存在 Docker 卷里，迁移到宿主机目录后由 Nginx 直接提供
if docker volume inspect pinso_media >/dev/null 2>&1 && [ -z "$(ls -A media)" ]; then
  docker run --rm -v pinso_media:/from -v "$REMOTE_DIR/media":/to alpine cp -a /from/. /to/
  echo "已迁移旧版图片到 $REMOTE_DIR/media"
fi
fi

cd "$REMOTE_DIR"

if want services; then
step "启动应用容器"
docker compose -p pinso up -d --build --remove-orphans
# account-gw 以卷挂载运行，文件更新后需手动重启才能加载新代码
docker compose -p pinso restart account-gw
for i in $(seq 1 60); do
  [ "$(docker compose -p pinso ps api --format '{{.Health}}')" = healthy ] && { echo "✓ API 容器已就绪"; break; }
  [ "$i" = 60 ] && { echo "✗ API 容器未就绪"; docker compose -p pinso logs api --tail 30; exit 1; }
  sleep 5
done
fi

if want email; then
step "配置邮件服务"
# 读取 .env 中的 RESEND_API_KEY / MAIL_FROM，启用 Saleor 自带的邮件插件（未配置时跳过）
if grep -q "^RESEND_API_KEY=." .env && grep -q "^MAIL_FROM=." .env; then
  docker compose -p pinso exec -T api sh -c 'export RSA_PRIVATE_KEY="$(cat /run/secrets/jwt.pem)" && python3 manage.py shell' \
    < saleor/setup_email.py 2>&1 | grep -E "已启用|测试邮件|跳过|Error|error" || true
else
  echo "提示：.env 中未配置 RESEND_API_KEY / MAIL_FROM，邮件服务未启用"
fi
fi

if want nginx; then
step "配置 Nginx 与 HTTPS 证书"
cp nginx/locations.conf nginx/ssl.conf nginx/security-headers.conf /etc/nginx/pinso/
cp nginx/ratelimit.conf /etc/nginx/conf.d/pinso-ratelimit.conf
cp nginx/cloudflare-realip.conf /etc/nginx/conf.d/pinso-cloudflare-realip.conf
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
fi

if want extensions; then
step "安装后台扩展：商品导入"
# 首次部署时从清单安装；已安装则跳过。安装后 Saleor 会把应用令牌回传给导入服务
if [ -n "$DOMAIN" ]; then
  saleor_shell() { docker compose -p pinso exec -T api sh -c 'export RSA_PRIVATE_KEY="$(cat /run/secrets/jwt.pem)" && python3 manage.py '"$1"; }
  if saleor_shell 'shell -c "from saleor.app.models import App; import sys; sys.exit(0 if App.objects.filter(identifier=\"pinso.product-importer\", is_installed=True).exists() else 1)"' >/dev/null 2>&1; then
    echo "已安装，跳过"
  else
    saleor_shell "install_app https://$DOMAIN/importer/manifest --activate --quiet" && echo "✓ 已安装，后台「商品目录」菜单中出现「商品导入」" || echo "✗ 安装失败，可在后台「扩展」中手动安装：https://$DOMAIN/importer/manifest"
  fi
else
  echo "未配置域名，跳过（扩展需要 HTTPS 地址）"
fi
fi

if want verify || want dashboard; then
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
code="$(curl -sS -o /dev/null -w '%{http_code}' "${resolve[@]}" "$base/dashboard/")"
[ "$code" = 200 ] || { echo "✗ 后台返回 $code"; exit 1; }
echo "✓ 前台、后台与 API 正常"
docker compose -p pinso ps --format 'table {{.Service}}\t{{.Status}}'
fi

if want verify; then
[ -n "$DOMAIN" ] || base="http://$SERVER_IP"
gw_secret="$(grep "^GW_ADMIN_SECRET=" .env | cut -d= -f2-)"
cat <<EOF

前台：$base/
后台：$base/dashboard/
运营工具：$base/dashboard/tools/  （密钥：$gw_secret）
EOF
fi
