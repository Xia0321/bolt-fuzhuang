#!/usr/bin/env bash
# 把本仓库维护的后台代码补丁（saleor/dashboard/patches/*.patch）打到 Saleor Dashboard 源码上。
# 已打过的补丁跳过；无法干净应用（上游代码变化）时报错退出，需要重新生成补丁。
#
# 用法：saleor/dashboard/apply-patches.sh <saleor-dashboard 目录>
# 生成补丁：在 saleor-dashboard 中修改后执行
#   git add -N <新文件> && git diff -- src/ > <本仓库>/saleor/dashboard/patches/NNNN-说明.patch
set -euo pipefail

DASHBOARD_DIR="$(cd "${1:?用法：apply-patches.sh <saleor-dashboard 目录>}" && pwd)"
PATCH_DIR="$(cd "$(dirname "$0")/patches" && pwd)"

shopt -s nullglob
for patch in "$PATCH_DIR"/*.patch; do
  name="$(basename "$patch")"
  if git -C "$DASHBOARD_DIR" apply --reverse --check "$patch" 2>/dev/null; then
    echo "已应用，跳过：$name"
  elif git -C "$DASHBOARD_DIR" apply --check "$patch" 2>/dev/null; then
    git -C "$DASHBOARD_DIR" apply "$patch"
    echo "✓ 已应用：$name"
  else
    echo "✗ 无法应用：$name（Saleor Dashboard 源码可能已变化，需要重新生成该补丁）" >&2
    exit 1
  fi
done
