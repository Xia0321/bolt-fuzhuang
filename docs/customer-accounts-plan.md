# 顾客账号系统实施方案

状态：2026-09-25 代码已完成并在本地走通验证清单（见文末「实施记录」），**尚未提交、未上线**。工作分支 `feat/customer-accounts`。

## 背景与问题

目前前台只有游客结账，存在三个缺口：
1. 下单后顾客无法再查看订单状态、物流单号（订单完成页只读 sessionStorage，关闭即丢失）
2. 订单完成页文案「订单确认信息将发送至 {email}」**不属实**——服务器尚未配置邮件服务，不会发任何邮件（`src/i18n/translations.ts` 的 `order_email_note`）
3. 老顾客无法保存地址、查看历史订单

## 原则

- **尽量不新增后端**：登录、找回密码、`me.orders`、地址簿直接用 Saleor 自带的顾客账号，后台「客户」菜单即可管理
- **唯一例外：注册网关**。人机验证和注册频率限制必须在服务端校验（只在前端校验，脚本直接调 GraphQL 就绕过了），Saleor 本身没有这两项能力，所以加一个很小的注册服务，见「注册防护」
- **保留游客结账**，账号为可选
- 代码风格与现有项目一致（Context + `src/lib/*.ts` + 页面组件，Tailwind 样式沿用现有设计，中英日三语）
- 发布方式不变：推送 main → Jenkins 点 ▶

## 已在本地验证的接口行为（2026-09-25）

| 验证项 | 结果 |
|---|---|
| `shopSettingsUpdate(input:{enableAccountConfirmationByEmail:false})` | 成功；之后 `accountRegister` 返回 `requiresConfirmation:false`，用户 `isActive:true`，可直接登录 |
| `tokenCreate(email,password)` | 返回 `token`（访问凭证，**5 分钟**）、`refreshToken`（**30 天**），`JWT_TTL_ACCESS/REFRESH` 环境变量可调 |
| `me { email firstName orders(first) addresses defaultShippingAddress }` | 带 `Authorization: Bearer <token>` 可正常读取 |
| 游客 `order(id: <UUID>)` | **匿名可读**：number、created、status、paymentStatus、userEmail、total、lines(含缩略图)、shippingAddress、shippingMethodName、fulfillments(trackingNumber)。订单 ID 为不可猜测的 UUID，可作为「订单专属链接」 |

源码核对结论（saleor-core 3.23）：
- `tokenCreate` **自带登录防爆破**（`saleor/account/throttling.py`）：按 IP、IP+账号计失败次数，指数延迟，最长封 1 小时
- Saleor 取客户端 IP 用的是 `X-Forwarded-For` 中**第一个**合法 IP；而现在 `deploy/nginx/locations.conf` 的 `/graphql/` 用 `$proxy_add_x_forwarded_for`，会保留客户端自己带的该请求头 → **脚本伪造 IP 即可绕过登录防爆破**，需改为 `$remote_addr`（本次一并修）
- 开启邮箱验证时（`enableAccountConfirmationByEmail:true` 且 `allowLoginWithoutConfirmation:false`），`accountRegister` 创建的用户 `is_confirmed=false`，`tokenCreate` 会拒绝登录（`ACCOUNT_NOT_CONFIRMED`）；`customerUpdate(input:{isConfirmed:true})` 可由有 `MANAGE_USERS` 权限的 App 令牌把账号标记为已验证
- `accountRegister` 对已存在的邮箱**同样返回成功**（防止探测邮箱是否注册过），所以网关要先查询邮箱是否已存在
- 开启邮箱验证时 `accountRegister` 必须带 `redirectUrl`

注意：
- 本地库此前为测试关掉了邮箱验证，并留下一个测试账号 `probe…@example.com`；按新方案要**重新打开**（见下），测试账号可删除
- 订单专属链接能看到收货地址和邮箱，属于敏感信息：只在下单成功页展示给本人，不要出现在可被索引或分享的位置

相关接口签名（已核对 schema）：
- `accountRegister(input: {email, password, firstName?, lastName?, languageCode?, channel?, redirectUrl?})` → `requiresConfirmation, user, errors`
- `tokenRefresh(refreshToken)` → `token`
- `requestPasswordReset(email, redirectUrl!, channel)`；`setPassword(email, token, password)` → 直接返回新的 token/refreshToken
- `accountAddressCreate(input, type?)`、`accountAddressUpdate(id, input)`、`accountAddressDelete(id)`、`accountSetDefaultAddress(id, type: SHIPPING|BILLING)`
- `checkoutCustomerAttach(id)`：带登录凭证调用，把当前 checkout 关联到登录用户
- `customerUpdate(id, input: {isConfirmed})`：需 `MANAGE_USERS`，仅注册网关使用
- `redirectUrl` 的域名必须在服务器 `.env` 的 `ALLOWED_CLIENT_HOSTS` 中（线上已包含 pinso.top）

## 注册方式

- 只填 **邮箱 + 密码 + 确认密码**，不填姓名（姓名在结算填地址时再填）
- **不发验证码、不做邮箱验证**；前端校验：邮箱格式、两次密码一致、密码至少 8 位（Saleor 服务端的密码规则同时生效，报错原样翻译提示）
- 注册成功后自动登录，跳回来源页（例如从结算页进入则回到结算页）
- 表单中嵌入人机验证组件，未通过验证不能提交

## 注册防护（人机验证 + 频率限制）

### 思路

Saleor 保持「需要邮箱验证才能登录」的设置。这样任何人直接调用公开的 `accountRegister`，得到的都是**无法登录的未验证账号**，刷接口没有意义。只有经过注册网关（人机验证 + 限流通过）的注册，才由网关用 App 令牌标记为已验证。用户这边感觉不到邮箱验证这一步。

```
浏览器注册页 ──POST /api/register {email, password, captchaToken}──► Nginx（按 IP 限流）
                                                                      │
                                                          account-gw（注册网关）
                                                          1. 校验人机验证令牌（服务端调验证服务）
                                                          2. 按 IP / 全站计数限流
                                                          3. 用 App 令牌查询邮箱是否已存在 → 已存在则返回「邮箱已注册」
                                                          4. accountRegister（带 redirectUrl）
                                                          5. customerUpdate(isConfirmed: true)
                                                                      │
浏览器拿到成功结果 ──► 直接 tokenCreate 登录（走 Saleor，自带防爆破）
```

### 人机验证

推荐 **Cloudflare Turnstile**：免费、大多数情况下无感（不用拼图/点图），自带一套测试密钥方便本地开发。
- 前端：注册页加载 `https://challenges.cloudflare.com/turnstile/v0/api.js`，站点密钥通过 `VITE_TURNSTILE_SITE_KEY` 配置
- 服务端：网关调用 `https://challenges.cloudflare.com/turnstile/v0/siteverify` 校验，密钥 `TURNSTILE_SECRET` 只放服务器 `/opt/pinso/.env`
- 本地测试密钥：站点 `1x00000000000000000000AA` / 密钥 `1x0000000000000000000000000000000AA`（始终通过）
- 风险：中国大陆访问 Cloudflare 偶尔慢。若实测注册页组件加载有问题，改用阿里云验证码 2.0（付费，国内稳定），网关里只需替换校验函数

### 频率限制（三层）

| 层 | 位置 | 规则（初始值，可调） |
|---|---|---|
| 注册接口 | Nginx `limit_req` on `location = /api/register` | 每 IP 3 次/分钟，burst 3，超出返回 429 |
| 注册业务 | 注册网关（内存计数，单实例足够） | 每 IP 5 次/小时、20 次/天；全站 200 次/小时（超过视为被攻击，暂停注册并记日志） |
| 整体 GraphQL | Nginx `limit_req` on `/graphql/` | 每 IP 20 次/秒，burst 60（宽松，只防刷接口，不影响正常浏览；考虑到多人共用出口 IP 的情况） |
| 登录 | Saleor 自带 `tokenCreate` 防爆破 | 修正 `X-Forwarded-For` 后生效 |

找回密码（`requestPasswordReset`）目前不发邮件，暂不处理；第二步开通邮件时改为同样经过网关（人机验证 + 每邮箱/每 IP 限流），防止被用来轰炸别人的邮箱。

### 网关实现

- `deploy/account-gw/server.mjs`：Node 22，**不引入依赖**（内置 `http` + `fetch`），约 150 行
- 加入 `deploy/docker-compose.yml`，服务名 `account-gw`，镜像 `node:22-alpine`，只监听 `127.0.0.1:8100`，restart unless-stopped
- 需要的环境变量（写在 `/opt/pinso/.env`，不进仓库）：`TURNSTILE_SECRET`、`SALEOR_APP_TOKEN`（后台「应用」里建一个只有 `MANAGE_USERS` 权限的本地 App 生成的令牌）、`SALEOR_API_URL`（容器内网地址）、`STOREFRONT_URL`（`https://pinso.top`，用作 redirectUrl）
- 返回给前端的错误码固定几种：`CAPTCHA_FAILED`、`RATE_LIMITED`、`EMAIL_EXISTS`、`INVALID_PASSWORD`（附 Saleor 原始信息）、`INVALID_EMAIL`，前端翻成三语
- 日志：每次拒绝记录 IP、原因（不记密码）
- 本地开发：`node deploy/account-gw/server.mjs`（用 Turnstile 测试密钥），Vite 配置 `/api` 代理到 `localhost:8100`

## 功能范围

```
右上角「账号」图标
  ├─ 未登录 → /login、/register（邮箱 + 密码 + 确认密码 + 人机验证）、/reset-password（含 ?email=&token= 设置新密码）
  └─ 已登录 → /account
               ├─ 我的订单：列表 → /account/orders/<id> 详情（状态、商品、金额、地址、物流单号）
               ├─ 地址簿：新增 / 编辑 / 删除 / 设为默认
               └─ 退出登录
结算页：已登录自动填入邮箱和默认地址、可从地址簿选择；未登录保留游客结算并提示可登录
下单成功页：显示订单号 +「查看订单」按钮，链接 /order/<订单UUID>（游客也可查看）
```

## 代码改动清单

| 类型 | 文件 | 内容 |
|---|---|---|
| 新增 | `src/lib/account.ts` | 登录、注册（调用 `/api/register`）、续期、退出、找回/重置密码、`me`、我的订单、订单详情、地址簿 CRUD |
| 新增 | `src/context/AuthContext.tsx` | 全局登录状态（user、login、logout、register），风格同 `CartContext` |
| 新增 | `src/components/Captcha.tsx` | 按需加载 Turnstile 脚本，渲染组件，回传令牌；令牌过期或提交失败后重置 |
| 修改 | `src/lib/saleor.ts` | `saleorFetch` 自动附带访问凭证；遇到过期（`ExpiredSignatureError` / 401 类错误）用 refreshToken 续期后重试一次 |
| 新增 | `src/pages/LoginPage.tsx`、`RegisterPage.tsx`、`ResetPasswordPage.tsx`、`AccountPage.tsx`（订单列表/详情、地址簿） | 页面 |
| 修改 | `src/pages/OrderPage.tsx` | 支持 `/order/<id>` 从接口读取真实订单；删除不实的「确认邮件已发送」文案，改为提示保存订单号/链接 |
| 修改 | `src/pages/CheckoutPage.tsx` | 已登录预填邮箱与默认地址、可选地址簿；下单成功跳转 `/order/<id>` |
| 修改 | `src/lib/checkout.ts` | `payAndComplete` 额外返回订单 `id`；新增 `attachCustomer` |
| 修改 | `src/context/CartContext.tsx` | 登录后对当前 checkout 调用 `checkoutCustomerAttach`，保证登录前加购的商品不丢 |
| 修改 | `src/components/Navbar.tsx` | 账号入口（桌面与手机抽屉） |
| 修改 | `src/lib/router.ts`、`src/App.tsx` | 新路由：login、register、reset-password、account、account/orders/:id、order/:id |
| 修改 | `src/i18n/translations.ts` | 三语文案 |
| 修改 | `src/config.ts`、`.env.example` | 注册接口地址、`EMAIL_ENABLED` 开关 |
| 修改 | `vite.config.ts` | 开发时 `/api` 代理到本地网关 |
| 新增 | `deploy/account-gw/server.mjs` | 注册网关 |
| 修改 | `deploy/docker-compose.yml` | 新增 `account-gw` 服务 |
| 修改 | `deploy/nginx/locations.conf` | `location = /api/register` 反代网关 + 限流；`/graphql/` 限流；`/graphql/` 的 `X-Forwarded-For` 改为 `$remote_addr` |
| 修改 | 宿主机 Nginx `http {}` 段（`limit_req_zone` 定义） | 两个限流区：`register`、`api`；由 `server-deploy.sh` 写入 `/etc/nginx/conf.d/pinso-ratelimit.conf` |
| 修改 | `deploy/server-deploy.sh` | 部署限流配置；`.env` 缺少网关变量时给出提示 |
| 修改 | `saleor/seed/seed.mjs` | 确保 `enableAccountConfirmationByEmail:true`、`allowLoginWithoutConfirmation:false` |
| 修改 | `README.md` | 注册网关与 Turnstile 配置说明 |

## 登录状态保存

- 访问凭证只放内存；refreshToken 放 localStorage（键名如 `auth-refresh`，读写包 try/catch），页面加载时用它续期恢复登录
- 请求过期自动续期并重试一次；续期失败则清除登录状态
- 已知取舍：refreshToken 在 localStorage 中，若站点被注入脚本可被读取；这是纯前端店铺的通用做法（Saleor 官方 storefront 同样如此），后续可加 CSP 缓解

## 分两步

1. **账号系统本身**（本次）：邮箱 + 密码注册，人机验证 + 限流，注册即可登录；「忘记密码」页面做好，但在邮件配置前发不出邮件（页面上如实提示）
2. **邮件**（等用户决定发信方式：Gmail SMTP 测试 / 阿里云邮件推送正式）：配置 SMTP 后开启下单确认、发货通知、密码重置；找回密码接入网关防护

## 验证清单

本地和线上各走一遍：
- 注册：两次密码不一致 → 前端拦截；人机验证未通过 → 拒绝；已注册邮箱 → 提示「邮箱已注册」；正常注册 → 自动登录
- 防护：直接调用 GraphQL `accountRegister` 注册的账号**无法登录**；同一 IP 连续注册超过限额 → 429 / `RATE_LIMITED`；伪造 `X-Forwarded-For` 连续输错密码 → 仍被 Saleor 延迟
- 主流程：登录 → 加购 → 下单 → 「我的订单」出现该订单 → 后台发货填物流单号 → 前台显示物流单号 → 退出再登录（30 天免登录）→ 游客用 `/order/<id>` 查看订单 → 登录前加购、登录后购物车仍在 → 刷新页面访问凭证过期后自动续期
- 正常浏览（首页、列表、详情快速切换）不触发 GraphQL 限流
- `npx tsc --noEmit -p tsconfig.app.json` 与 `npx eslint .` 通过

## 上线

1. 功能分支提交 → fast-forward 合并 main → 推送（提交信息只写做了什么）
2. 准备工作（需要用户操作）：
   - 在 Cloudflare 控制台创建 Turnstile 站点（域名 pinso.top），得到站点密钥与密钥
   - 在 Saleor 后台「扩展」创建本地应用，只勾选「管理客户」权限，生成令牌
   - 以上两项写入服务器 `/opt/pinso/.env`（站点密钥由注册服务提供给前台，不需要配到 Jenkins）
3. 线上确认店铺设置：开启邮箱验证、关闭「未验证可登录」
4. Jenkins 点 ▶ 发布（会同时启动 `account-gw`、更新 Nginx 配置），按验证清单在 https://pinso.top 再走一遍

## 实施记录（2026-09-25）

按方案实现，人机验证用 Cloudflare Turnstile，限流按上表初始值。与方案不同或补充的地方：

- **订单详情统一用 `/order/<订单ID>`**：登录用户从「我的订单」点进去、游客用专属链接看的是同一个页面，没有再单独做 `/account/orders/<id>`
- **注册服务先查后确认**：开启邮箱验证时 `accountRegister` 不返回用户，注册服务注册后用 App 令牌按邮箱查出账号再标记为已验证
- **防抢注**：若邮箱已存在但**未验证**（只可能来自绕过注册服务直接调接口），注册服务会删除该账号后重新注册，避免他人抢先占用别人的邮箱
- **站点设置**：前台启动时从注册服务 `GET /api/register/config` 读取 Turnstile 站点密钥，不需要在 Jenkins 打包时注入；服务器未配置密钥时注册页显示「注册暂未开放」
- **退出登录**：账号页、电脑端右上角账号菜单、手机侧边菜单都有；退出时清空各币种的购物袋，避免共用设备泄露地址
- **移动端**：手机顶栏增加账号图标，侧边菜单增加「我的账号 / 退出登录」；所有新页面按 390×844 手机尺寸验证过中、英、日三语
- 结算页地址表单抽成 `src/components/AddressFields.tsx`，结算与地址簿共用
- 下单时 Saleor 会自动把收货地址存进地址簿并设为默认

本地已验证：正常注册并自动登录；两次密码不一致被拦截；重复邮箱提示已注册；直接调用接口注册的账号无法登录；防抢注；密码过短、邮箱格式错误；人机验证失败被拒；同 IP 第 6 次注册被限流；登录前加购、登录后购物车仍在；已登录结算自动填邮箱；下单后「我的订单」出现订单；后台发货填物流单号后前台显示；游客凭链接查看订单；刷新页面保持登录；密码错误提示；登录后按 `next` 返回原页面；地址簿增删改与设默认；退出登录；手机端中/日文页面。

未在本地验证：Nginx 配置（本机无 Nginx，部署脚本会先 `nginx -t`）；访问凭证 5 分钟过期后的自动续期只验证了刷新页面的场景。

## 上线前需要用户提供

1. Cloudflare Turnstile 站点密钥与密钥（域名 pinso.top）
2. Saleor 后台「扩展」中创建只有「管理客户」权限的本地应用令牌
3. 写入服务器 `/opt/pinso/.env`：`TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET`、`SALEOR_APP_TOKEN`

## 第二步：邮件（2026-09-25）

用户决定使用 Saleor 自带的邮件插件，经 Resend SMTP（发件 notice@pinso.top）发送，注册确认与找回密码采用邮件链接：

- 注册：邮箱 + 密码 + 确认密码 + 人机验证 → 注册服务调用 `accountRegister`（redirectUrl 为 `/confirm-account`）→ Saleor 发确认邮件 → 顾客点链接，前台调用 `confirmAccount` → 登录。注册服务不再自动确认账号
- 找回密码：`requestPasswordReset` → Saleor 发重置邮件 → `/reset-password?email=&token=` 设置新密码并登录；前台 `EMAIL_ENABLED = true`
- 订单：下单后发订单详情与支付确认，发货（勾选通知顾客）后发发货通知（含物流单号）
- 配置：`deploy/saleor/setup_email.py` 从 `.env` 读取 `RESEND_API_KEY`、`MAIL_FROM`、`MAIL_SENDER_NAME`，启用各渠道的 User emails 插件和 Admin emails 插件；部署脚本每次执行
- 本地已用 Resend 测试地址 delivered@resend.dev 实测：测试邮件、注册确认、支付确认、订单详情、发货通知、找回密码均显示 delivered，确认链接和重置链接在前台可正常完成流程

已知限制：模板为 Saleor 默认英文模板；发信失败不重试；Resend 免费版每天 100 封；绕过人机验证直接调用公开接口批量注册会消耗发信额度（同一邮箱只发一次确认邮件，找回密码同一账号 15 分钟一次）。
