#!/usr/bin/env bash
# 等待 GitHub Actions 打包出包含所需改动的版本，下载并解压（Jenkins「发布商城前台」使用）。
#
# 用法：deploy/fetch-github-build.sh <workflow 文件名> <release 名> <解压目录> <路径>...
#   路径：决定「需要的版本」的仓库路径，取其中最近一次改动的提交，打包结果必须包含它
# 例：deploy/fetch-github-build.sh storefront.yml storefront-latest storefront-dist saleor/storefront .github/workflows/storefront.yml
#
# 在本仓库的 git 工作区中执行。仓库为公开仓库时无需令牌。
set -uo pipefail

WORKFLOW="${1:?workflow 文件名}"
RELEASE="${2:?release 名}"
OUT="${3:?解压目录}"
shift 3
GITHUB_REPO="${GITHUB_REPO:-Xia0321/bolt-fuzhuang}"
RELEASE_URL="https://github.com/$GITHUB_REPO/releases/download/$RELEASE"
TIMEOUT_MINUTES="${TIMEOUT_MINUTES:-45}"

REQUIRED_COMMIT="$(git log -1 --format=%H -- "$@")"
[ -n "$REQUIRED_COMMIT" ] || { echo "✗ 找不到 $* 的提交记录"; exit 1; }
echo "需要包含的提交：${REQUIRED_COMMIT:0:7}（$(git log -1 --format='%s' "$REQUIRED_COMMIT")）"

started=$(date +%s)
last_api=0
while true; do
  built=$(curl -fsSL -m 20 "$RELEASE_URL/pinso-version.txt?t=$(date +%s)" 2>/dev/null | sed -n 's/^commit=//p')
  if [ -n "$built" ]; then
    # 打包结果的提交等于或晚于需要的提交即可（本地没有该提交说明它比本次拉取的代码更新）
    if [ "$built" = "$REQUIRED_COMMIT" ] || ! git cat-file -e "$built^{commit}" 2>/dev/null \
       || git merge-base --is-ancestor "$REQUIRED_COMMIT" "$built"; then
      echo "✓ GitHub 上的打包结果已包含所需改动（打包自提交 ${built:0:7}）"
      break
    fi
  fi
  waited=$(( ($(date +%s) - started) / 60 ))
  # 每分钟查一次 GitHub 打包状态（未登录的接口每小时限 60 次）
  if [ $(( $(date +%s) - last_api )) -ge 60 ]; then
    last_api=$(date +%s)
    status=$(curl -fsSL -m 20 "https://api.github.com/repos/$GITHUB_REPO/actions/workflows/$WORKFLOW/runs?per_page=5" 2>/dev/null \
      | REQUIRED_COMMIT="$REQUIRED_COMMIT" python3 -c "
import json, sys, os
runs = json.load(sys.stdin).get('workflow_runs', [])
need = os.environ['REQUIRED_COMMIT']
run = next((r for r in runs if r['head_sha'] == need), None)
if not run:
    print('未找到对应的打包任务（GitHub 可能还没开始）||')
else:
    names = {'queued': '排队中', 'in_progress': '打包中', 'completed': '已结束'}
    print(names.get(run['status'], run['status']) + '|' + (run['conclusion'] or '') + '|' + run['html_url'])
" 2>/dev/null || echo '无法查询 GitHub 状态||')
    state=${status%%|*}
    rest=${status#*|}
    conclusion=${rest%%|*}
    url=${rest#*|}
    if [ "$conclusion" = failure ] || [ "$conclusion" = cancelled ]; then
      echo "✗ GitHub 打包失败（$conclusion），请查看：$url"
      exit 1
    fi
    echo "⏳ 已等待 ${waited} 分钟 · GitHub 状态：${state}${url:+ · $url}"
  fi
  if [ "$waited" -ge "$TIMEOUT_MINUTES" ]; then
    echo "✗ 等待超过 $TIMEOUT_MINUTES 分钟，请到 https://github.com/$GITHUB_REPO/actions 查看打包情况"
    exit 1
  fi
  sleep 30
done

set -e
# release「storefront-latest」中的打包文件名为 storefront.tar.gz
archive="${RELEASE%-latest}.tar.gz"
rm -rf "$OUT" "$archive"
curl -fsSL -m 600 -o "$archive" "$RELEASE_URL/$archive?t=$(date +%s)"
mkdir -p "$OUT"
tar -xzf "$archive" -C "$OUT"
rm -f "$archive"
echo "✓ 已下载并解压到 $OUT，共 $(find "$OUT" -type f | wc -l) 个文件"
sed 's/^/  /' "$OUT/pinso-version.txt"
