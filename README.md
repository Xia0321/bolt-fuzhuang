# PINSO Denim（品帅牛仔）独立站

前台：React + Vite + Tailwind（本仓库）
后端 / 后台管理：[Saleor](https://github.com/saleor/saleor) 3.23（GraphQL API + Dashboard）

```
浏览器 ──► 前台 (本仓库, :5173) ──GraphQL──► Saleor API (:8000) ──► PostgreSQL / Redis
                                             ▲
运营人员 ──► Saleor Dashboard 后台 (:9000) ───┘
```

## 目录

| 路径 | 说明 |
|---|---|
| `src/config.ts` | API 地址、语言与 Saleor 语言代码的对应、可选币种（渠道） |
| `src/lib/catalog.ts` | 读取商品、分类、菜单、页面内容、运费规则 |
| `src/lib/checkout.ts` | 购物袋与结算（Saleor Checkout） |
| `src/i18n/translations.ts` | 只放界面固定文案（按钮、提示）。内容类文案都在后台配置 |
| `saleor/seed/` | 初始数据导入脚本（渠道、仓库、运费、商品、页面、菜单） |
| `saleor/local/start-api.sh` | 本地启动 Saleor API |
| `saleor/dashboard/` | 后台完整中文语言包及合并脚本，见 [saleor/dashboard/README.md](saleor/dashboard/README.md) |

## 后台可配置的内容

前台不写死任何商品和运营内容，在 Saleor 后台修改后刷新前台即可生效。

| 前台位置 | 后台位置 |
|---|---|
| 商品、价格、尺码/颜色、库存、图片 | Catalog → Products（尺码和颜色是规格属性，库存按规格设置） |
| 分类名称、描述、封面图 | Catalog → Categories |
| 首页「精选单品」及「精选」角标 | Catalog → Collections → `featured` |
| 顶部导航、首页分类区顺序 | Configuration → Navigation → `navbar` |
| 页脚「品牌」栏 / 底部链接 | Navigation → `footer` / `footer-legal` |
| 品牌名、标语、联系邮箱/电话/地址、Instagram | Modeling → 页面 `site-settings` |
| 首页大图（文字、按钮、图片） | 页面 `home-hero` |
| 首页造型画册横幅 | 页面 `home-lookbook` |
| 品牌故事页（横幅 + 正文） | 页面 `about` |
| 首页「品牌承诺」、品牌故事页数据条 | 类型为 Feature 的页面，`placement` 决定位置，`sort-order` 决定顺序 |
| 配送信息、退换政策、隐私政策、服务条款 | 页面 `shipping` / `returns` / `privacy` / `terms` |
| 运费和免运费门槛 | Configuration → Shipping Methods → `Worldwide` |
| 币种与价格 | Configuration → Channels（`cn` 人民币 / `global` 美元 / `jp` 日元） |
| 中文 / 日文翻译 | Translations（商品、分类、页面、菜单、颜色都在这里翻译） |

页面、属性的 slug（如 `home-hero`、`button-link`）是前台读取时的约定，不要修改；新增 Feature 页面、菜单项、商品都不需要改代码。

新增币种：在后台新建渠道（并加入配送区域、给商品设置该渠道价格），再在 `src/config.ts` 的 `CHANNELS` 里加一行。

## 本地开发

依赖：Node 20+、Python 3.12、PostgreSQL 16、Redis（macOS 可用 Homebrew 安装 `postgresql@16 redis libmagic uv`）。

```bash
# 1. Saleor 后端（仓库放在 ~/Desktop/saleor-core，版本 3.23.36）
git clone -b 3.23.36 https://github.com/saleor/saleor.git ~/Desktop/saleor-core
cd ~/Desktop/saleor-core && uv sync --no-dev
DATABASE_URL=postgres://saleor:saleor@localhost:5432/saleor SECRET_KEY=dev .venv/bin/python manage.py migrate
DATABASE_URL=postgres://saleor:saleor@localhost:5432/saleor SECRET_KEY=dev .venv/bin/python manage.py createsuperuser
./saleor/local/start-api.sh            # 在本仓库根目录执行，API 在 http://localhost:8000/graphql/

# 2. 导入初始数据（可重复执行）
SALEOR_EMAIL=管理员邮箱 SALEOR_PASSWORD=管理员密码 node saleor/seed/seed.mjs

# 3. 后台管理界面（仓库 saleor-dashboard 3.23.34，需要 Node 24 + pnpm 11）
node saleor/dashboard/apply-locale.mjs ~/Desktop/saleor-dashboard   # 合并中文语言包
cd ~/Desktop/saleor-dashboard && pnpm install && pnpm dev   # http://localhost:9000

# 4. 前台
cp .env.example .env && npm install && npm run dev           # http://localhost:5173
```

国内网络安装依赖慢时，可以使用镜像：PyPI 用 `--index-url https://pypi.tuna.tsinghua.edu.cn/simple`，npm/pnpm 用 `--registry=https://registry.npmmirror.com`。

## 部署

```
浏览器 ──HTTPS──► 宿主机 Nginx（Let's Encrypt 证书，HTTP 自动跳转 HTTPS，www 跳转主域名）
                    ├─ /、/dashboard/、/media/ → /opt/pinso 下的静态文件
                    └─ /graphql/、/thumbnail/  → 127.0.0.1:8000（Docker 中的 Saleor）
Docker Compose：Saleor API、Worker、PostgreSQL、Redis（均不对公网开放）
```

```bash
# 本地打包前台和后台 → 上传 → 启动 → 配置 Nginx 与证书（首次会自动申请 Let's Encrypt 证书）
SERVER=root@47.84.72.178 SSH_KEY=~/.ssh/pinso.pem DOMAIN=pinso.top ./deploy/deploy.sh

# 后台没有变化时跳过后台打包
SKIP_DASHBOARD=1 SERVER=... SSH_KEY=... DOMAIN=pinso.top ./deploy/deploy.sh
```

- 脚本可重复执行：缺少 Docker / Nginx / Certbot 时自动安装；数据库密码、SECRET_KEY、JWT 密钥首次随机生成并保留
- 服务器目录 `/opt/pinso`：`.env`、`secrets/` 仅存在于服务器，不进入代码仓库；`media/` 为上传的图片
- Nginx 配置在 `deploy/nginx/`，部署到 `/etc/nginx/pinso/` 和 `/etc/nginx/sites-enabled/pinso`
- 证书续期：Certbot 自带的 `certbot.timer`（每天两次检查，到期前 30 天续期），续期后通过 `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` 重新加载 Nginx
- 开机自启：`docker`、`nginx`、`certbot.timer` 均为 enabled，容器 `restart: unless-stopped`
- 数据库迁移由一次性的 `migrate` 服务在每次启动时执行，完成后才启动 API
- 常用命令：`docker compose ps`、`docker compose logs -f api`（在 `/opt/pinso` 下），`nginx -t && systemctl reload nginx`，`certbot certificates`

首次部署后需要创建管理员并导入初始数据：

```bash
ssh root@<IP> "cd /opt/pinso && docker compose exec -T -e DJANGO_SUPERUSER_PASSWORD='<密码>' api \
  sh -c 'export RSA_PRIVATE_KEY=\"\$(cat /run/secrets/jwt.pem)\" && python3 manage.py createsuperuser --noinput --email <邮箱>'"
SALEOR_API_URL=http://<IP>/graphql/ SALEOR_EMAIL=<邮箱> SALEOR_PASSWORD=<密码> node saleor/seed/seed.mjs
```

## 上线前待办

- **支付**：当前使用 Saleor 自带的测试网关（`mirumee.payments.dummy`），不会真实扣款。上线需在后台启用 Stripe 插件并填入密钥，前台在 `CheckoutPage` 接入 Stripe.js 获取支付凭证后传给 `payAndComplete`
- **图片**：商品、分类、横幅目前是 Pexels 示例图，需要在后台替换成品牌实拍图（商品图建议 3:4 竖图）
- **政策文本**：隐私政策、服务条款是占位内容
- **邮件**：订单确认邮件需要在后台配置 SMTP 插件
- **价格**：美元、日元价格是按汇率从人民币换算的，需要在后台逐一核对
- **部署**：生产环境需设置 `SECRET_KEY`、`ALLOWED_HOSTS`、`ALLOWED_CLIENT_HOSTS`、`PUBLIC_URL`，并由 Nginx 提供 `/media/` 静态文件；前台是单页应用，Nginx 需配置 `try_files $uri /index.html`
- **商品数量**：前台一次读取最多 100 件商品，超过后需要改为分页
