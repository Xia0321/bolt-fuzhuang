// 找货源：按分类用 Claude Code 联网搜索「分类页 / 商品列表页」（Shopify 店铺分类页、品牌独立站分类页、亚马逊品类搜索页），
// 运营打开后自行挑选具体商品，再把商品详情页链接贴回导入页。
// 服务端逐个检查页面能否打开；Shopify 分类页额外读出商品数量和几张缩略图作为预览。
// 使用 Claude 订阅额度（CLAUDE_CODE_OAUTH_TOKEN）。

import { runClaudeCode } from './claude-code.mjs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const SCHEMA = {
  type: 'object',
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          site: { type: 'string' },
          title: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['url', 'site', 'title', 'note'],
        additionalProperties: false,
      },
    },
  },
  required: ['pages'],
  additionalProperties: false,
};

const SYSTEM = `你是服装品牌 PINSO（品帅牛仔，主营牛仔及休闲服饰）独立站的选品助手。
根据给定的商品分类，用网络搜索找出该分类的「分类页 / 商品列表页」链接，运营会打开这些页面自己挑选具体商品。

只要以下三类页面：
- Shopify 店铺的分类页（链接形如 https://店铺域名/collections/分类名）
- 品牌或供应商独立站的分类页、商品列表页
- 亚马逊该品类的搜索结果页或分类页（可自行拼接搜索链接，如 https://www.amazon.com/s?k=women+denim+jacket）

要求：
- 不要单个商品详情页、首页、博客文章
- 优先批发、一件代发（dropshipping）、允许分销的供应商和店铺
- 与分类高度相关，风格偏牛仔、休闲服饰
- 不要淘宝、天猫、京东、1688、拼多多（导入工具无法抓取这些平台的商品）
- 来源尽量多样，同一网站最多 2 条
- 除亚马逊搜索链接外，只返回在搜索结果中实际看到的链接，不要自行拼造
- title 写页面上的分类名称；note 用一句中文说明这个来源的特点（如「牛仔品牌官网，款式偏复古」「批发供应商，支持一件代发」）`;

async function fetchWithTimeout(url, { json = false } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'cart_currency=USD; localization=US' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return json ? res.json() : res.text();
}

// 检查页面能否打开；Shopify 分类页读取商品数量与缩略图
async function inspect(page) {
  const u = new URL(page.url);
  const site = page.site || u.hostname.replace(/^www\./, '');
  const base = { url: u.href, site, title: page.title, note: page.note, platform: 'generic', count: null, previews: [] };
  if (/(^|\.)amazon\./i.test(u.hostname)) {
    // 亚马逊对服务器请求常返回验证页，不做抓取检查，直接交给运营在浏览器中打开
    return { ...base, platform: 'amazon' };
  }
  const collection = u.pathname.match(/\/collections\/([^/?#]+)/)?.[1];
  if (collection) {
    try {
      const d = await fetchWithTimeout(`${u.origin}/collections/${collection}/products.json?limit=250`, { json: true });
      if (Array.isArray(d.products)) {
        return {
          ...base,
          platform: 'shopify',
          count: d.products.length,
          previews: d.products.slice(0, 4).map(p => p.images?.[0]?.src).filter(Boolean),
        };
      }
    } catch {
      // 不是 Shopify，按普通网页检查
    }
  }
  await fetchWithTimeout(u.href);
  return base;
}

async function inspectAll(pages, limit = 4) {
  const results = [];
  let next = 0;
  async function worker() {
    while (next < pages.length) {
      const p = pages[next++];
      try {
        const r = await inspect(p);
        // 分类下没有商品的 Shopify 页面不推荐
        if (r.count !== 0) results.push(r);
      } catch {
        // 打不开的页面不推荐
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

export async function discover(categoryName, count = 8) {
  const { pages } = await runClaudeCode({
    system: SYSTEM,
    input: `商品分类：${categoryName}\n请找出 ${count + 4} 个候选页面（会逐个检查，多给一些以便淘汰）。`,
    schema: SCHEMA,
    tools: 'WebSearch',
    maxTurns: 20,
    timeoutMs: 180_000,
  });
  const seen = new Set();
  const candidates = pages.filter(p => {
    try {
      const u = new URL(p.url);
      const key = u.origin + u.pathname + u.search;
      if (seen.has(key) || !/^https?:$/.test(u.protocol)) return false;
      seen.add(key);
      return true;
    } catch {
      return false;
    }
  });
  const checked = await inspectAll(candidates);
  // 有预览图、商品多的排前面，亚马逊放最后
  const score = r => (r.previews.length ? 2 : 0) + (r.count ? Math.min(r.count, 50) / 50 : 0) - (r.platform === 'amazon' ? 1 : 0);
  return {
    pages: checked.sort((a, b) => score(b) - score(a)).slice(0, count),
    searched: candidates.length,
  };
}
