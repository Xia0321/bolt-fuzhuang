# Saleor 后台中文语言包

Saleor Dashboard 官方的简体中文只翻译了不到一成，且用词不统一（“下发”“变体”“产品”混用）。
这里维护一份完整的中文翻译，**不修改 Saleor 源码**，打包后台前合并进去即可。

```
locale/zh-Hans.json   翻译文件：id → { context, source(英文原文), string(译文) }
apply-locale.mjs      合并脚本：官方语言包 + 本翻译 → saleor-dashboard/locale/zh-Hans.json
```

## 使用

```bash
# 合并（在 pnpm build / pnpm dev 之前执行）
node saleor/dashboard/apply-locale.mjs ~/Desktop/saleor-dashboard

# 只检查不写入（CI 用），并导出待补译条目
node saleor/dashboard/apply-locale.mjs ~/Desktop/saleor-dashboard --check --report missing.tsv
```

脚本会用后台自带的 ICU 解析器逐条校验语法，并确认译文的占位符（如 `{count}`、复数、`<b>` 标签）与原文一致，有错误时不会写入。

后台语言在右下角账号菜单 → 账号设置中切换，或在后台的 `.env` 里设置 `LOCALE_CODE="ZH_HANS"` 作为默认语言。

## 升级 Saleor 后

1. 运行带 `--report` 的检查命令
2. `missing`：新版本新增的文字；`outdated`：英文原文改动过、需要复核的译文
3. 在 `locale/zh-Hans.json` 中补充或修改对应条目（`source` 同步更新为新的英文原文），再合并

## 术语表

| 英文 | 中文 | 英文 | 中文 |
|---|---|---|---|
| Product | 商品 | Variant | 规格 |
| Attribute | 属性 | Category | 分类 |
| Collection | 集合 | Channel | 渠道 |
| Warehouse | 仓库 | Stock / Inventory | 库存 |
| Fulfill / Fulfillment | 发货 | Unfulfilled | 未发货 |
| Refund | 退款 | Return | 退货 |
| Capture | 收款 | Authorize | 授权 |
| Charge | 扣款 | Void | 作废 |
| Draft order | 草稿订单 | Voucher | 优惠券 |
| Promotion / Sale | 促销 | Gift card | 礼品卡 |
| Shipping zone | 配送区域 | Shipping method | 配送方式 |
| Model（原 Page） | 模型 | Structure / Menu | 结构 / 菜单 |
| Metadata | 元数据 | Slug | URL 标识 |
| Extension / App | 扩展 / 应用 | Playground | 调试台 |
