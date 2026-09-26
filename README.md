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
| 品牌名、标语、联系邮箱/电话/地址、Instagram、网站图标（Favicon） | Modeling → 页面 `site-settings` |
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
saleor/dashboard/apply-patches.sh ~/Desktop/saleor-dashboard       # 打上本项目的后台定制补丁
node saleor/dashboard/apply-locale.mjs ~/Desktop/saleor-dashboard   # 合并中文语言包
cd ~/Desktop/saleor-dashboard && pnpm install && pnpm dev   # http://localhost:9000

# 4. 前台
cp .env.example .env && npm install && npm run dev           # http://localhost:5173

# 5. 顾客注册服务（需要注册功能时启动，配置见下文「顾客账号」）
node --env-file=deploy/account-gw/.env.local deploy/account-gw/server.mjs   # http://localhost:8100，前台经 Vite 代理 /api 访问
```

国内网络安装依赖慢时，可以使用镜像：PyPI 用 `--index-url https://pypi.tuna.tsinghua.edu.cn/simple`，npm/pnpm 用 `--registry=https://registry.npmmirror.com`。

## 顾客账号

登录、找回密码、我的订单、地址簿都直接使用 Saleor 自带的顾客账号，后台「客户」菜单即可管理。游客仍可直接结账，订单完成页的专属链接 `/order/<订单ID>` 游客也能查看订单状态和物流单号。

注册只需邮箱和密码，不做邮箱验证，但要经过注册服务 `deploy/account-gw`：

- **人机验证**：Cloudflare Turnstile，服务端校验
- **频率限制**：Nginx 每 IP 每分钟 3 次；注册服务每 IP 每小时 5 个、每天 20 个账号，全站每小时 200 个
- **原理**：Saleor 保持「需要邮箱验证才能登录」。直接调用公开接口 `accountRegister` 注册的账号无法登录；注册服务校验通过后，用 App 令牌把账号标记为已验证
- 登录防爆破由 Saleor 自带（按 IP 延迟），Nginx 只向 Saleor 传真实连接 IP，防止伪造 `X-Forwarded-For` 绕过

服务器 `/opt/pinso/.env` 需要以下变量，缺少时注册页显示「注册暂未开放」，其余功能不受影响：

| 变量 | 获取方式 |
|---|---|
| `TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET` | Cloudflare 控制台 → Turnstile → 添加站点（域名 pinso.top） |
| `SALEOR_APP_TOKEN` | 后台 → 扩展 → 添加扩展 → 手动创建本地应用，只勾选「管理客户」权限，生成令牌 |

修改后在 `/opt/pinso` 执行 `docker compose -p pinso up -d account-gw` 生效。

本地开发时在 `deploy/account-gw/.env.local`（不提交）中配置同样的变量，并额外设置 `SALEOR_API_URL=http://localhost:8000/graphql/`、`STOREFRONT_URL=http://localhost:5173`；Turnstile 可用官方测试密钥（站点 `1x00000000000000000000AA`，密钥 `1x0000000000000000000000000000000AA`，始终通过）。

注册后 Saleor 会发送确认邮件，顾客点击链接（前台 `/confirm-account`）确认后才能登录；忘记密码时发送重置链接（前台 `/reset-password`）。

## 邮件

使用 Saleor 自带的邮件插件（User emails / Admin emails），经 [Resend](https://resend.com) 的 SMTP 发出，发件域名 pinso.top 已在 Resend 验证。会发送：注册确认、找回密码、订单详情、支付确认、发货通知（含物流单号）等，模板为 Saleor 默认的英文模板，可在后台「扩展 → User emails」按渠道修改。

服务器 `/opt/pinso/.env` 需要：

```
RESEND_API_KEY=re_xxx
MAIL_FROM=notice@pinso.top
MAIL_SENDER_NAME=PINSO Denim
```

每次部署时 `deploy/server-deploy.sh` 会执行 `deploy/saleor/setup_email.py` 把上述配置写入插件（保存时会实际登录一次 SMTP 校验）。手动执行并发送测试邮件：

```bash
cd /opt/pinso && docker compose -p pinso exec -T -e MAIL_TEST_TO=delivered@resend.dev api \
  sh -c 'export RSA_PRIVATE_KEY="$(cat /run/secrets/jwt.pem)" && python3 manage.py shell' < saleor/setup_email.py
```

本地开发把同样的变量写在 `saleor/local/.env.local`（不提交）。

- 额度：Resend 免费版每天 100 封、每月 3,000 封，超出后发不出去，订单多了需要升级套餐
- Saleor 发信失败不会重试，只记录在 worker 日志中（`docker compose -p pinso logs worker`）
- 注册确认邮件同一邮箱只在首次注册时发送；找回密码同一账号 15 分钟内只发一次

## 后台扩展：商品导入

后台「商品目录 → 商品导入」（代码 `deploy/product-importer`，Saleor 应用 + 后台扩展）：

1. **分类**：「自动分类」（默认，Claude 根据商品内容从现有分类中选择；Claude 不可用时按商品名称关键词匹配，匹配不到留空让人选，不会落到 Default Category；入库前可改）或「指定分类」。指定分类后可点「帮我找货源」：Claude Code 联网搜索该分类的货源**分类页 / 列表页**（Shopify 店铺分类页、品牌或批发供应商独立站、亚马逊品类搜索页），服务端检查能否打开，Shopify 分类页附商品数量和预览图；运营打开后自己挑选商品
2. **商品链接**：粘贴商品详情页链接，自动识别亚马逊 / Shopify / 其他独立站，抓取名称、描述、价格、图片、尺码、颜色。色块小图（说明为 swatch 或边长不足 500px）自动过滤。
   - Shopify 商品没有颜色选项时，从标签 `color:颜色名=通用色` 或标题「款式 | 颜色」读出颜色
   - 对方网站把每个颜色做成单独商品（页面色块链接到其他商品）时，列出同款其他颜色供勾选，合并为一个商品的多个颜色：每个颜色的图片关联到该颜色的规格（前台切换颜色时显示对应图片），原价不同的颜色按原价比例换算售价
3. **核对内容**：Claude（`claude-opus-5` 或订阅额度下的 Claude Code）翻译为英、中、日三语并给出颜色色值，可逐项修改
4. **入库**：商品、颜色 × 尺码规格、图片、中日文翻译、各渠道价格、新颜色的色值与翻译，状态为**未发布**，来源链接记在商品私有元数据 `import_source_url`

- 翻译二选一，配置在服务器 `/opt/pinso/.env`（都未配置时仍可抓取入库，只是不能自动翻译）：
  - `CLAUDE_CODE_OAUTH_TOKEN`（推荐）：在自己电脑上运行 `claude setup-token` 生成，使用 Claude 订阅额度，有效期一年；导入服务以无人值守模式运行 Claude Code 翻译，额度与本人使用 Claude Code 共用，用完时页面提示恢复时间，同时配置了 `ANTHROPIC_API_KEY` 则自动改用 API；都不可用时改为原文预填，颜色按常用色名预填中日文与色值
  - `ANTHROPIC_API_KEY`：Claude Console 的 API Key，按用量计费
- 首次部署时部署脚本会自动安装扩展（`manage.py install_app https://pinso.top/importer/manifest`），也可在后台「扩展」中用该清单地址手动安装
- 只有具备「管理商品」权限的后台员工能使用；安装回调收到的令牌会先向 Saleor 验证属于本应用才启用
- 亚马逊反爬严格，抓取可能失败；价格按参考汇率预填，请按实际定价修改
- 仅导入自有或已获授权的商品，别人的图片和描述有版权

本地开发：`cd deploy/product-importer && npm install && PORT=8200 DATA_DIR=./data SALEOR_API_URL=http://localhost:8000/graphql/ PUBLIC_URL=http://localhost:8200 ANTHROPIC_API_KEY=... node server.mjs`，再在本地后台「扩展」中用 `http://localhost:8200/importer/manifest` 安装（本地 Saleor 需设置 `HTTP_IP_FILTER_ALLOW_LOOPBACK_IPS=True` 才能回传令牌）。

## 后台定制：新建分类时补充翻译

后台「商品目录 → 分类 → 新建分类」（及分类详情页的「新建子分类」）弹窗中增加「补充其他语言翻译」，默认关闭。打开后调用商品导入服务的 `/importer/api/translate-fields`，由 Claude 把名称和描述翻译为英文、日文并填入弹窗（可修改），点「创建」后一并保存为该分类的 English、日本語 翻译。

这是对 Saleor Dashboard 源码的改动，以补丁 `saleor/dashboard/patches/0001-category-create-translations.patch` 维护，GitHub 打包后台（及本地 `deploy/deploy.sh`）前自动应用，通过 Jenkins「发布管理后台」上线。勾选翻译时分类网址标识使用英文名（如 `/shop/denim-jackets`），被占用时依次加 `-2`、`-3`。本地开发时后台（:9000）与导入服务（:8200）不同源：导入服务设置 `CORS_ORIGINS=http://localhost:9000`，并在后台页面的浏览器控制台执行 `localStorage.setItem("pinsoImporterUrl", "http://localhost:8200/importer")`。

## 部署

```
浏览器 ──HTTPS──► 宿主机 Nginx（Let's Encrypt 证书，HTTP 自动跳转 HTTPS，www 跳转主域名）
                    ├─ /、/dashboard/、/media/ → /opt/pinso 下的静态文件
                    └─ /graphql/、/thumbnail/  → 127.0.0.1:8000（Docker 中的 Saleor）
Docker Compose：Saleor API、Worker、PostgreSQL、Redis（均不对公网开放）
```

### 日常发布：Jenkins

打开 https://pinso.top/jenkins/ ，有两个任务，进入后点「立即构建」，任务页面按步骤显示进度、耗时和结果：

| 任务 | 发布内容 | 步骤 |
|---|---|---|
| 发布商城前台 | 顾客看到的网站 + 后端服务（Saleor 接口、注册服务、商品导入、Nginx、邮件） | 安装依赖 → 打包前台 → 检查运行环境 → 更新文件与配置 → 更新后端服务 → Nginx 与证书 → 邮件与后台扩展 → 验证 |
| 发布管理后台 | Saleor 管理后台页面（`/dashboard/`） | 检查需要的后台版本 → 等待 GitHub 打包（显示已等待时间与状态）→ 下载并校验 → 更新后台页面 |

- 管理后台打包需要约 8GB 内存，服务器不够，由 GitHub Actions（`.github/workflows/dashboard.yml`）在 `saleor/dashboard/` 有改动时自动打包，发布到 Release `dashboard-latest`；「发布管理后台」等 GitHub 打包出包含最新改动的版本后再下载部署
- 流水线定义在 `deploy/Jenkinsfile`（商城前台）与 `deploy/Jenkinsfile.dashboard`（管理后台），每个步骤调用 `deploy/server-deploy.sh` 的一个阶段
- Jenkins 的安装与配置在 `deploy/jenkins/`（`setup.sh` 可重复执行；新增或修改任务、权限后需在服务器上重新执行）
- Jenkins 以 systemd 服务运行，只监听 127.0.0.1:8080，内存上限 512MB；管理员密码在服务器 `/etc/jenkins/admin.env`
- 仓库改为私有后，Jenkins 下载后台打包结果需要 GitHub 令牌

### 本地部署（首次部署，或不经 Jenkins 一次性发布全部内容）

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
- **邮件模板**：目前是 Saleor 默认的英文模板，需要按品牌风格和中日英三语修改
- **价格**：美元、日元价格是按汇率从人民币换算的，需要在后台逐一核对
- **部署**：生产环境需设置 `SECRET_KEY`、`ALLOWED_HOSTS`、`ALLOWED_CLIENT_HOSTS`、`PUBLIC_URL`，并由 Nginx 提供 `/media/` 静态文件；前台是单页应用，Nginx 需配置 `try_files $uri /index.html`
- **商品数量**：前台一次读取最多 100 件商品，超过后需要改为分页
