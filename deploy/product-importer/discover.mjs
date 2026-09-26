// 找货源：按分类联网搜索「分类页 / 商品列表页」，运营打开后自行挑选具体商品，再把商品详情页链接贴回导入页。
//
// 分两路同时搜索（Claude Code + Sonnet，使用 Claude 订阅额度）：
//   独立站：Shopify 店铺、品牌独立站的分类页
//   亚马逊：亚马逊该品类的搜索结果页
// 不找批发、一件代发网站（运营要求）
// 过程通过 emit 实时推送：搜索关键词、每个检查通过的页面、完成。
// 服务端逐个检查页面能否打开；Shopify 分类页额外读出商品数量和几张缩略图作为预览。

import { runClaudeCodeStream } from './claude-code.mjs';

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

const COMMON = `你是服装品牌 PINSO（品帅牛仔，主营牛仔及休闲服饰）独立站的选品助手。
根据给定的商品分类，用网络搜索找出该分类的「分类页 / 商品列表页」链接，运营会打开这些页面自己挑选具体商品。

通用要求：
- 不要单个商品详情页、首页、博客文章
- 与分类高度相关，风格偏牛仔、休闲服饰
- 不要淘宝、天猫、京东、1688、拼多多（导入工具无法抓取这些平台的商品）
- 不要批发、一件代发（dropshipping）、分销供应商网站
- 每个网站只给 1 个页面，不要同一网站的不同筛选、排序、分页链接
- 只返回在搜索结果中实际看到的链接，不要自行拼造（亚马逊搜索链接除外）
- 最多搜索 2 次，找够数量立即停止并输出结果，不要为了更好的结果继续搜索
- title 写页面上的分类名称；note 用一句中文说明这个来源的特点（如「牛仔品牌官网，款式偏复古」）`;

const GROUPS = [
  {
    key: 'site',
    label: '独立站',
    count: 6,
    focus: '本次只找：品牌独立站的分类页，优先 Shopify 店铺（链接形如 https://店铺域名/collections/分类名）。不要批发站、亚马逊及其他电商平台。',
  },
  {
    key: 'amazon',
    label: '亚马逊',
    count: 2,
    focus: '本次只找：亚马逊（amazon.com）该品类的搜索结果页或分类页；可按品类英文关键词自行拼接搜索链接，如 https://www.amazon.com/s?k=women+denim+jacket，不必联网搜索。不要其他网站。',
  },
];

async function fetchWithTimeout(url, { json = false } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'cart_currency=USD; localization=US' },
    redirect: 'follow',
    // 只是检查能否打开，慢的网站直接跳过
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return json ? res.json() : res.text();
}

// 检查页面能否打开；Shopify 分类页读取商品数量与缩略图
async function inspect(page, group) {
  const u = new URL(page.url);
  const base = { url: u.href, site: siteKey(u.href), title: page.title, note: page.note, group, platform: 'generic', count: null, previews: [] };
  if (/(^|\.)amazon\./i.test(u.hostname)) {
    // 亚马逊对服务器请求常返回验证页，不做检查，直接交给运营在浏览器中打开
    return { ...base, platform: 'amazon' };
  }
  const collection = u.pathname.match(/\/collections\/([^/?#]+)/)?.[1];
  if (collection) {
    try {
      const d = await fetchWithTimeout(`${u.origin}/collections/${collection}/products.json?limit=250`, { json: true });
      if (Array.isArray(d.products)) {
        if (!d.products.length) throw new Error('分类下没有商品');
        return {
          ...base,
          platform: 'shopify',
          count: d.products.length,
          previews: d.products.slice(0, 4).map(p => p.images?.[0]?.src).filter(Boolean),
        };
      }
    } catch (e) {
      if (e.message === '分类下没有商品') throw e;
      // 不是 Shopify，按普通网页检查
    }
  }
  await fetchWithTimeout(u.href);
  return base;
}

const siteKey = url => new URL(url).hostname.replace(/^www\./, '').toLowerCase();

// 同一分类 12 小时内重复搜索直接返回上次结果，不消耗额度；refresh 为 true 时重新搜索
const CACHE_TTL = 12 * 3600_000;
const cache = new Map(); // 分类名 → { pages, at }

/**
 * emit 事件：
 *   { type: 'cached', at }                        使用缓存结果
 *   { type: 'stage', text }                       当前阶段说明
 *   { type: 'search', group, query }              某一路正在搜索的关键词
 *   { type: 'groupDone', group, found }           某一路搜索结束，找到的候选数
 *   { type: 'page', page }                        检查通过的货源页
 *   { type: 'done', total, searchMs, elapsedMs }  全部完成
 */
export async function discoverStream(categoryName, { refresh = false, emit }) {
  const cached = cache.get(categoryName);
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL) {
    emit({ type: 'cached', at: cached.at });
    for (const page of cached.pages) emit({ type: 'page', page });
    emit({ type: 'done', total: cached.pages.length, cached: true });
    return;
  }

  const t0 = Date.now();
  const seen = new Set(); // 已采用的网站，两路之间去重
  const found = [];
  let searchMs = 0;
  emit({ type: 'stage', text: `正在联网搜索「${categoryName}」的货源（独立站、亚马逊两路同时进行）` });

  await Promise.all(GROUPS.map(async g => {
    let pages = [];
    try {
      ({ pages } = await runClaudeCodeStream({
        system: `${COMMON}\n\n${g.focus}`,
        input: `商品分类：${categoryName}\n请找出 ${g.count} 个页面。`,
        schema: SCHEMA,
        tools: 'WebSearch',
        // 找链接用更快的 Sonnet，推理强度低
        model: 'sonnet',
        effort: 'low',
        maxTurns: 6,
        timeoutMs: 150_000,
        onTool: (name, input) => {
          if (name === 'WebSearch' && input.query) emit({ type: 'search', group: g.label, query: input.query });
        },
      }));
    } catch (e) {
      emit({ type: 'groupDone', group: g.label, found: 0, error: e.message });
      return;
    }
    searchMs = Math.max(searchMs, Date.now() - t0);
    const candidates = pages.filter(p => {
      try {
        const u = new URL(p.url);
        if (!/^https?:$/.test(u.protocol) || seen.has(siteKey(u.href))) return false;
        // 每一路只收自己的渠道：亚马逊一路只要亚马逊，独立站一路不要亚马逊
        if (/(^|\.)amazon\./i.test(u.hostname) !== (g.key === 'amazon')) return false;
        seen.add(siteKey(u.href));
        return true;
      } catch {
        return false;
      }
    });
    emit({ type: 'groupDone', group: g.label, found: candidates.length });
    // 这一路的候选并行检查，通过一个显示一个
    await Promise.all(candidates.map(async p => {
      try {
        const page = await inspect(p, g.label);
        found.push(page);
        emit({ type: 'page', page });
      } catch {
        // 打不开的页面不推荐
      }
    }));
  }));

  cache.set(categoryName, { pages: found, at: Date.now() });
  emit({ type: 'done', total: found.length, searchMs, elapsedMs: Date.now() - t0 });
}
