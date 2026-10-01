#!/usr/bin/env bash
# 把本仓库维护的前台定制（saleor/storefront/patches/*.patch）打到 Saleor Paper 前台源码上。
# 已打过的补丁跳过；无法干净应用（上游代码变化）时报错退出，需要在新版本源码上重新生成补丁。
#
# 用法：saleor/storefront/apply-patches.sh <storefront 源码目录>
# 源码版本见 saleor/storefront/REF（GitHub 打包与本地开发使用同一版本）。
set -euo pipefail

STOREFRONT_DIR="$(cd "${1:?用法：apply-patches.sh <storefront 源码目录>}" && pwd)"
PATCH_DIR="$(cd "$(dirname "$0")/patches" && pwd)"

shopt -s nullglob
for patch in "$PATCH_DIR"/*.patch; do
  name="$(basename "$patch")"
  if git -C "$STOREFRONT_DIR" apply --reverse --check "$patch" 2>/dev/null; then
    echo "已应用，跳过：$name"
  elif git -C "$STOREFRONT_DIR" apply --check "$patch" 2>/dev/null; then
    git -C "$STOREFRONT_DIR" apply "$patch"
    echo "✓ 已应用：$name"
  else
    echo "✗ 无法应用：$name（前台源码可能已变化，需要重新生成该补丁）" >&2
    exit 1
  fi
done

# 官方的 Paper 品牌图片：分享图按文件约定自动生效，删除后改用 /api/og 生成的 PINSO 分享图
rm -f "$STOREFRONT_DIR"/src/app/opengraph-image.png "$STOREFRONT_DIR"/src/app/twitter-image.png \
      "$STOREFRONT_DIR"/public/screenshot.png "$STOREFRONT_DIR"/public/github-mark.svg \
      "$STOREFRONT_DIR"/public/logo.svg "$STOREFRONT_DIR"/public/logo-dark.svg
