# 商城前台：Saleor Paper + PINSO 定制

前台使用 Saleor 官方开源前台 [Paper](https://github.com/saleor/storefront)（Next.js 16），版本固定在 `REF` 中的提交。本仓库不保存前台源码，只保存对它的定制补丁，打包时「官方源码 + 补丁」，做法与管理后台（`saleor/dashboard/`）相同。

```
REF                 官方源码版本（提交号），GitHub 打包与本地开发使用同一版本
patches/            定制补丁，按文件名顺序应用
apply-patches.sh    应用补丁：已应用的跳过，无法干净应用时报错；并删除官方的 Paper 品牌图片
build.env           生产环境打包参数（API 地址、渠道、语言等），运行时同样加载
setup.mjs           Saleor 端初始化：缓存刷新 webhook、首页等文案的内容模型（部署时自动执行）
content.mjs         内容模型的初始文案（英文为主，简体中文、日文翻译）
schema.json         内容模型结构，从官方 config/saleor/storefront-content.snapshot.json 复制
```

## 定制内容（patches/）

| 补丁 | 内容 |
|---|---|
| `0001-zh-locale` | 新增简体中文（网址 `/zh/…`，Saleor 翻译语言 `ZH_HANS`）及完整中文语言包；新增文案的英、日文；首页精选区无商品时的提示多语言化 |
| `0002-pinso-brand` | 店名、PINSO 字标、网站图标、页脚（标语、隐私政策/服务条款链接多语言化、去掉 Powered by Paper；页脚菜单平铺的页面链接直接显示为链接）、首页占位图 |
| `0003-register-via-account-gw` | 注册改为经注册服务 `deploy/account-gw`：Cloudflare Turnstile 人机验证、注册频率限制、替换未确认的同邮箱账号；登录时账号未确认、已停用给出明确提示 |
| `0004-checkout` | 结算页：选择省份后城市改为下拉（中国地址 Saleor 只接受地址库中的城市）、配送方式名称取翻译、工作日/免费/选填/必填等文案多语言化、货币符号显示为 ¥；支持 Saleor 自带的测试支付插件 `mirumee.payments.dummy`（官方只支持 Dummy Payment App） |
| `0005-self-hosting` | 自建服务器：免运费门槛从后台「配送方式」中免运费规则的最低订单金额实时读取；缓存刷新时商品事件刷新全部渠道、支持翻译事件；可关闭 Next 图片压缩 |
| `0006-header-region-picker` | 顶部导航栏搜索框右侧加语言/币种切换（与页脚的相同，手机上只显示地球图标），菜单向下展开 |

## 网址

`/{语言}/{渠道}/…`：语言 `zh` / `en` / `ja`，渠道 `cn`（人民币）/ `global`（美元）/ `jp`（日元）。首页 `/` 跳转到 `/zh/cn`。语言和币种在顶部导航栏右侧或页脚切换。结算 `/checkout`，订单查看 `/order/…`。

## 文案在哪里改

- **商品、分类、菜单、内容页**（品牌故事、配送信息等）：与之前相同，后台对应菜单及「翻译」
- **首页、公告栏、购物袋、结算页文案**：后台「内容 → 模型」中的 Storefront — Homepage / Chrome / Cart / Checkout / Products / Policies，英文改页面本身，中文、日文在「翻译」中改。首页大图是 Storefront — Homepage 的 Hero image
- **按钮、提示等界面固定文字**：补丁中的 `messages/zh.json`（及 en、ja）
- **免运费门槛**：后台「配送 → 配送方式」中价格为 0 的方式的最低订单金额
- **退换天数**：模型 Storefront — Policies 的 Returns window days

后台修改后通过 webhook 自动刷新前台缓存（商品图片单独增删除外，最多 1 小时后生效）。

## 修改补丁

```bash
git clone https://github.com/saleor/storefront.git ~/Desktop/saleor-storefront
cd ~/Desktop/saleor-storefront && git checkout $(cat <本仓库>/saleor/storefront/REF)
<本仓库>/saleor/storefront/apply-patches.sh .
git add -A && git commit -m pinso      # 作为基准，便于之后生成补丁
# 修改代码 …
git diff --binary <REF> HEAD -- <该补丁涉及的文件> > <本仓库>/saleor/storefront/patches/000N-说明.patch
```

每个文件只属于一个补丁（`messages/*.json` 都在 0001 中），修改后按文件重新生成对应补丁，再用 `apply-patches.sh` 在干净的官方源码上验证。

升级官方版本：修改 `REF` 后逐个应用补丁，无法应用的在新版本上重新修改并生成；同时用新版本的 `config/saleor/storefront-content.snapshot.json` 更新 `schema.json`。

## 本地开发

```bash
cd ~/Desktop/saleor-storefront            # 已按上文打好补丁
npx -y pnpm@10.28.1 install
cat > .env.local <<'EOF'
NEXT_PUBLIC_SALEOR_API_URL=http://localhost:8000/graphql/
NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_CHANNEL=cn
STOREFRONT_CHANNELS=cn,global,jp
NEXT_PUBLIC_DEFAULT_LOCALE=zh
NEXT_PUBLIC_STOREFRONT_LOCALES=zh,en,ja
NEXT_PUBLIC_DEFAULT_TIME_ZONE=Asia/Shanghai
ALLOW_DUMMY_PAYMENT=true
NEXT_PUBLIC_ALLOW_DUMMY_PAYMENT=true
REVALIDATE_SECRET=dev-secret
# 可选：注册服务（不设置时直接调用 Saleor 注册，没有人机验证）
# ACCOUNT_GW_URL=http://127.0.0.1:8100
# 可选：「PINSO 前台」应用令牌，显示币种切换、按订单号查询订单
# SALEOR_APP_TOKEN=
EOF
npx -y pnpm@10.28.1 dev                   # http://localhost:3000，需要 Node 24
```

本地 Saleor 初始化内容模型与 webhook（令牌需要「管理页面」「管理页面类型和属性」「管理翻译」「管理商品」权限）：

```bash
CONTENT_TOKEN=<令牌> node saleor/storefront/setup.mjs
```

## 已知情况

- 服务端日志中每个页面会出现一次 `Couldn't find all resumable slots … fallback to client rendering`：官方当前版本在自建服务器上同样出现（已用未打补丁的官方版本验证），页面会改为在浏览器端渲染，显示和功能不受影响
- 登录由前台服务端调用 Saleor，Saleor 的登录防爆破看到的是服务器本机 IP；前台自身按顾客 IP 限制登录频率（每 15 分钟 10 次），Nginx 另有每分钟 20 次的限制
- 订单完成页中的配送方式名称、国家名为 Saleor 中保存的原文
