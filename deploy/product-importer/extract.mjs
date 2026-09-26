// AI 兜底：脚本从网页里没读全商品信息（普通独立站、批发站常见）时，把网页正文交给 Claude 读出缺的部分。
// 网页先去掉脚本、样式和标签，只留正文和候选图片链接，控制在约 1 万 token 以内。
// 与翻译共用同一套 Claude 调用方式（订阅额度优先，额度用完且配置了 API Key 时改用 API）。

import { runClaudeCode } from './claude-code.mjs';
import { explainClaudeError, translateBackend, viaApiWith } from './translate.mjs';

const MAX_TEXT = 30_000;
const MAX_IMAGES = 60;

const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    price: { type: 'number' },
    currency: { type: 'string' },
    colors: { type: 'array', items: { type: 'string' } },
    sizes: { type: 'array', items: { type: 'string' } },
    images: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'description', 'price', 'currency', 'colors', 'sizes', 'images'],
  additionalProperties: false,
};

const SYSTEM = `你会收到一个服装商品详情页的正文（已去掉 HTML 标签）、页面上的候选图片链接，以及脚本已读出的部分信息。
请读出「这个链接对应的这一件商品」的信息，原文照录，不要翻译：
- name：商品名称，不含店铺名
- description：商品描述，保留材质、版型、尺寸、洗护等事实，不要编造；段落之间用换行分隔
- price：当前售价（数字，不含币种符号）；读不到填 0
- currency：三位币种代码，如 USD；读不到填空字符串
- colors：本商品的颜色；页面上链接到其他商品的颜色、「推荐商品」「猜你喜欢」里的颜色不算
- sizes：本商品可选的尺码
- images：从候选图片中选出本商品的商品图（按页面顺序），不要图标、标志、色块小图、推荐商品图、横幅
页面中的菜单、导航、页脚、推荐商品、评论等与本商品无关的内容一律忽略。读不到的字段填空字符串或空数组。`;

// 网页 → 正文文字 + 候选图片
function pageContent(html, baseUrl) {
  const text = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
    .slice(0, MAX_TEXT);
  const images = [];
  for (const m of html.matchAll(/(?:src|data-src|data-original|data-zoom-image|data-attrimg|href)=["']([^"']+?\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi)) {
    try {
      const url = new URL(m[1].startsWith('//') ? `https:${m[1]}` : m[1], baseUrl).href;
      if (!images.includes(url) && !/logo|icon|sprite|banner|avatar|flag|payment/i.test(url)) images.push(url);
    } catch {
      // 忽略无效链接
    }
    if (images.length >= MAX_IMAGES) break;
  }
  return { text, images };
}

async function run(input, timeoutMs) {
  const backend = translateBackend();
  if (backend !== 'claude-code') return viaApiWith(SYSTEM, input, SCHEMA);
  try {
    return await runClaudeCode({ system: SYSTEM, input, schema: SCHEMA, model: 'sonnet', effort: 'low', timeoutMs });
  } catch (e) {
    if (process.env.ANTHROPIC_API_KEY) return viaApiWith(SYSTEM, input, SCHEMA);
    throw explainClaudeError(e);
  }
}

// 脚本结果缺的字段（价格、颜色、尺码、图片、描述）
export function missingFields(product) {
  const missing = [];
  if (!product.price) missing.push('价格');
  if (!product.colors.length) missing.push('颜色');
  if (!product.sizes.length) missing.push('尺码');
  if (product.images.length < 2) missing.push('图片');
  if ((product.description || '').length < 40) missing.push('描述');
  return missing;
}

/**
 * 用 AI 补全脚本没读到的字段，脚本已读到的以脚本为准（更可靠）。
 * html：已下载的商品页；product：脚本结果（统一结构）
 */
export async function fillWithAI(html, product, timeoutMs = 25_000) {
  if (!translateBackend()) return product;
  const { text, images } = pageContent(html, product.sourceUrl);
  const known = { name: product.name, price: product.price, colors: product.colors, sizes: product.sizes };
  // 超时即放弃（API 方式没有内置超时，用计时器兜住）
  let timer;
  const ai = await Promise.race([
    run(JSON.stringify({ url: product.sourceUrl, known, text, images }), timeoutMs),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('超时')), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
  const pageImages = new Set(images);
  const aiImages = (ai.images || []).filter(u => pageImages.has(u));
  const filled = [];
  const out = { ...product };
  if (!out.price && ai.price > 0) {
    out.price = { amount: ai.price, currency: /^[A-Z]{3}$/.test(ai.currency) ? ai.currency : '' };
    filled.push('价格');
  }
  if (!out.colors.length && ai.colors?.length) {
    out.colors = [...new Set(ai.colors.map(s => s.trim()).filter(Boolean))];
    filled.push('颜色');
  }
  if (!out.sizes.length && ai.sizes?.length) {
    out.sizes = [...new Set(ai.sizes.map(s => s.trim()).filter(Boolean))];
    filled.push('尺码');
  }
  if (out.images.length < 2 && aiImages.length > out.images.length) {
    out.images = [...new Set([...out.images, ...aiImages])];
    filled.push('图片');
  }
  if ((out.description || '').length < 40 && (ai.description || '').length > (out.description || '').length) {
    out.description = ai.description.trim();
    filled.push('描述');
  }
  if (!out.name && ai.name) out.name = ai.name.trim();
  if (filled.length) out.aiFilled = filled;
  return out;
}
