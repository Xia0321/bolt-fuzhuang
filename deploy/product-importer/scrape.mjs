// 从商品链接抓取名称、描述、价格、图片、尺码、颜色。
// 支持：Shopify 独立站（公开的 products/<handle>.js 接口）、通用独立站（网页中的 JSON-LD / Open Graph 数据）、
// 亚马逊（解析商品页，反爬严格，可能被拦截）。
//
// 返回统一结构：
//   { platform, sourceUrl, name, description, price: { amount, currency } | null,
//     images: [url], sizes: [string], colors: [string], colorHints?: { 颜色: 通用色 }, keywords?: string }
//     aiFilled?: [字段]  脚本没读到、由 AI 从网页正文中补全的字段
//   只取链接对应的这一个商品；对方页面上链接到其他商品的颜色不处理
//   Shopify 用公开接口，数据完整，不用 AI；其他网站脚本没读全时交给 AI 补（见 extract.mjs）

import { fillWithAI, missingFields } from './extract.mjs';

// 脚本结果上附带的已下载网页，供 AI 兜底读取；Symbol 键不会被 JSON 序列化返回给页面
const PAGE = Symbol('page');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export class ScrapeError extends Error {
  constructor(message, code = 'SCRAPE_FAILED') {
    super(message);
    this.code = code;
  }
}

// 一次抓取总共最多 30 秒（含 AI 补全），超时停止，不让运营干等
const SCRAPE_LIMIT = 30_000;
let deadline = Date.now() + SCRAPE_LIMIT;

async function get(url, { json = false, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,ja;q=0.7',
        Accept: json ? 'application/json' : 'text/html,application/xhtml+xml',
        ...headers,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
    });
  } catch (e) {
    if (e.name === 'TimeoutError') throw new ScrapeError('对方网站 30 秒内没有返回数据，已停止抓取', 'TIMEOUT');
    throw new ScrapeError(`无法访问该链接：${e.message}`, 'FETCH_FAILED');
  }
  if (!res.ok) throw new ScrapeError(`对方网站返回 HTTP ${res.status}`, 'FETCH_FAILED');
  return json ? res.json() : res.text();
}

// ---------- 通用工具 ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = s => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

// HTML → 纯文本段落（保留换行）
export function htmlToText(html) {
  if (!html) return '';
  return decode(String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ''))
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

const unique = list => [...new Set(list.filter(Boolean).map(s => String(s).trim()).filter(Boolean))];
const absolute = (url, base) => {
  try {
    return new URL(url.startsWith('//') ? `https:${url}` : url, base).href;
  } catch {
    return null;
  }
};

function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decode(content) : '';
}

// 尺码、颜色选项名的常见写法（含中日文）
const SIZE_NAMES = /^(size|sizes|尺码|尺寸|サイズ|taille|größe)$/i;
const COLOR_NAMES = /^(colou?r|colors|颜色|顏色|カラー|色|couleur|farbe)$/i;

// ---------- Shopify ----------

// 商品图集里混有色块小图（swatch）等非商品图：按说明文字、文件名和尺寸过滤
const isSwatch = m => /swatch/i.test(`${m.alt ?? ''} ${m.src ?? ''}`) || (m.width > 0 && Math.max(m.width, m.height) < 500);

const titleCase = s => String(s).toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase()).trim();

// 标题常见写法「款式 | 颜色」「款式 | 颜色 | 系列」
const titleParts = title => String(title).split(/\s+\|\s+/).map(s => s.trim()).filter(Boolean);

// 没有颜色选项的商品（一个颜色一个商品），从标签「color:颜色名=通用色」或标题中读出颜色
function colorOfProduct(p) {
  for (const tag of p.tags || []) {
    const m = String(tag).match(/^colou?r\s*:\s*([^=]+?)\s*(?:=\s*(.+))?$/i);
    if (m) return { name: titleCase(m[1]), hint: m[2]?.trim() ?? '' };
  }
  const parts = titleParts(p.title);
  return parts.length > 1 ? { name: titleCase(parts[1]), hint: '' } : null;
}

async function scrapeShopify(url) {
  const u = new URL(url);
  const handle = u.pathname.match(/\/products\/([^/?#]+)/)?.[1];
  if (!handle) throw new ScrapeError('不是 Shopify 商品链接（应包含 /products/商品名）', 'BAD_URL');
  // Shopify 会按访问者所在地区换算币种，固定请求美元（店铺不支持时仍按其实际币种返回，由 cart.js 读出）
  const headers = { Cookie: 'cart_currency=USD; localization=US' };
  const p = await get(`${u.origin}/products/${handle}.js`, { json: true, headers });
  // 店铺币种：cart.js 不创建购物车，只返回空购物车信息
  const cart = await get(`${u.origin}/cart.js`, { json: true, headers }).catch(() => null);
  const optionIndex = pattern => (p.options || []).findIndex(o => pattern.test(o.name ?? o));
  const values = idx => (idx >= 0 ? unique(p.variants.map(v => v[`option${idx + 1}`])) : []);
  const media = p.media?.length ? p.media.filter(m => m.media_type === 'image' && !isSwatch(m)).map(m => m.src) : p.images || [];
  const result = {
    platform: 'shopify',
    sourceUrl: url,
    name: p.title,
    description: htmlToText(p.description),
    price: p.price != null ? { amount: p.price / 100, currency: cart?.currency || '' } : null,
    images: unique(media.map(i => absolute(i, u.origin))),
    sizes: values(optionIndex(SIZE_NAMES)),
    colors: values(optionIndex(COLOR_NAMES)),
    colorHints: {},
    keywords: [p.type, ...(p.tags || [])].filter(Boolean).join(', '),
  };
  // 没有颜色选项的商品（对方一个颜色一个商品）：从标签或标题读出本商品的颜色，只取本商品，不管页面上的其他颜色
  if (!result.colors.length) {
    const own = colorOfProduct(p);
    if (own) {
      result.colors = [own.name];
      if (own.hint) result.colorHints[own.name] = own.hint;
      if (titleParts(p.title).length > 1) result.name = titleParts(p.title)[0];
    }
  }
  return result;
}

// ---------- 通用独立站（JSON-LD / Open Graph） ----------

function findProductLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const products = [];
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const type = node['@type'];
    if (type === 'Product' || type === 'ProductGroup' || (Array.isArray(type) && type.includes('Product'))) products.push(node);
    if (node['@graph']) walk(node['@graph']);
  };
  for (const [, text] of blocks) {
    try {
      walk(JSON.parse(text.trim()));
    } catch {
      // 个别网站的 JSON-LD 不合法，跳过
    }
  }
  return products[0] ?? null;
}

function ldPrice(offers) {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const o of list) {
    const amount = Number(o.price ?? o.lowPrice ?? o.priceSpecification?.price);
    if (Number.isFinite(amount) && amount > 0) return { amount, currency: o.priceCurrency ?? o.priceSpecification?.priceCurrency ?? '' };
  }
  return null;
}

async function scrapeGeneric(url) {
  const html = await get(url);
  const ld = findProductLd(html);
  const images = [];
  const variants = ld?.hasVariant ?? [];
  if (ld) {
    for (const img of [ld.image, ...variants.map(v => v.image)].flat()) {
      images.push(typeof img === 'string' ? img : img?.url ?? img?.contentUrl);
    }
  }
  images.push(meta(html, 'og:image'), meta(html, 'og:image:secure_url'));
  const name = ld?.name || meta(html, 'og:title') || decode(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '');
  if (!name) throw new ScrapeError('页面中没有找到商品信息，可能不是商品详情页', 'NOT_FOUND');
  const metaAmount = Number(meta(html, 'product:price:amount') || meta(html, 'og:price:amount'));
  const price = ldPrice(ld?.offers) ?? ldPrice(variants.map(v => v.offers).flat())
    ?? (metaAmount > 0 ? { amount: metaAmount, currency: meta(html, 'product:price:currency') || meta(html, 'og:price:currency') } : null);
  return {
    platform: 'generic',
    sourceUrl: url,
    name: name.trim(),
    description: htmlToText(ld?.description || meta(html, 'og:description') || meta(html, 'description')),
    price,
    images: unique(images.filter(Boolean).map(i => absolute(i, url))),
    sizes: unique([ld?.size, ...variants.map(v => v.size)].flat().map(s => (typeof s === 'string' ? s : s?.name))),
    colors: unique([ld?.color, ...variants.map(v => v.color)].flat()),
    [PAGE]: html,
  };
}

// ---------- 亚马逊 ----------

const AMAZON_CURRENCY = {
  'amazon.com': 'USD', 'amazon.co.jp': 'JPY', 'amazon.co.uk': 'GBP', 'amazon.de': 'EUR', 'amazon.fr': 'EUR',
  'amazon.it': 'EUR', 'amazon.es': 'EUR', 'amazon.ca': 'CAD', 'amazon.com.au': 'AUD', 'amazon.sg': 'SGD',
  'amazon.cn': 'CNY',
};

function jsonAfter(html, marker) {
  // 取 marker 之后的第一个完整 JSON 对象/数组
  const start = html.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  while (i < html.length && html[i] !== '{' && html[i] !== '[') i++;
  const open = html[i];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (inString) {
      if (ch === '\\') j++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) {
      try {
        return JSON.parse(html.slice(i, j + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function scrapeAmazon(url) {
  const u = new URL(url);
  const asin = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1];
  if (!asin) throw new ScrapeError('不是亚马逊商品链接（应包含 /dp/商品编号）', 'BAD_URL');
  const host = u.hostname.replace(/^www\./, '');
  const siteCurrency = AMAZON_CURRENCY[host] ?? '';
  // 亚马逊按访问者所在地区换算显示币种，用偏好 Cookie 固定为站点本币
  const html = await get(`${u.origin}/dp/${asin}`, {
    headers: siteCurrency ? { Cookie: `i18n-prefs=${siteCurrency}; lc-main=en_US` } : {},
  });
  if (/captcha|Robot Check|api-services-support@amazon/i.test(html) && !/id="productTitle"/.test(html)) {
    throw new ScrapeError('被亚马逊的反爬验证拦截，请稍后重试，或换用商品的其他链接', 'BLOCKED');
  }
  const text = id => htmlToText(html.match(new RegExp(`id=["']${id}["'][^>]*>([\\s\\S]*?)</(?:span|div|ul)>`, 'i'))?.[1] ?? '');
  const name = text('productTitle');
  if (!name) throw new ScrapeError('没有解析到商品名称，页面结构可能已变化', 'NOT_FOUND');

  // 「About this item」要点：旧版在 #feature-bullets 中，新版为 a-list-item 列表项
  const bulletsHtml = html.match(/id=["']feature-bullets["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? '';
  const bullets = bulletsHtml
    ? [htmlToText(bulletsHtml)]
    : unique([...html.matchAll(/class=["']a-list-item a-size-base a-color-base["']>([\s\S]*?)<\/span>/gi)].map(m => htmlToText(m[1])));
  // 页面上有多个 id="productDescription"（外层容器和正文），取文字最长的一个
  const productDescription = [...html.matchAll(/id=["']productDescription["'][^>]*>([\s\S]*?)<\/(?:div|p)>\s*<\/div>/gi)]
    .map(m => htmlToText(m[1].replace(/<style[\s\S]*?<\/style>/gi, '')))
    .sort((a, b) => b.length - a.length)[0] ?? '';
  const description = [...bullets, productDescription].filter(Boolean).join('\n');

  const priceText = decode(html.match(/class=["']a-price[^"']*["'][^>]*>\s*<span class=["']a-offscreen["']>([^<]+)</i)?.[1] ?? '');
  const amount = Number(priceText.replace(/[^\d.,]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
  // 价格文字自带币种时以其为准，如 "LKR56,803.00"、"€12,99"
  const SYMBOLS = { '€': 'EUR', '£': 'GBP', '₹': 'INR' };
  const currency = priceText.match(/^[A-Z]{3}/)?.[0] ?? SYMBOLS[priceText.trim()[0]] ?? siteCurrency;

  // 图集数据形如 'colorImages': { 'initial': A.$.parseJSON('[...]') }
  const galleryAt = html.indexOf('colorImages');
  const gallery = galleryAt >= 0 ? jsonAfter(html.slice(galleryAt), "'initial':") : null;
  const images = (Array.isArray(gallery) ? gallery : []).map(i => i.hiRes || i.large);
  const dynamic = html.match(/id=["']landingImage["'][^>]+data-a-dynamic-image=["']([^"']+)["']/i)?.[1];
  if (dynamic) {
    try {
      images.push(...Object.keys(JSON.parse(decode(dynamic))));
    } catch {
      // 忽略
    }
  }

  // 颜色、尺码：只取链接对应的颜色（链接可能是父商品，页面会选中一个子商品，以页面选中的为准）
  // dimensionValuesDisplayData 形如 { 子商品编号: [特殊尺码, 尺码, 颜色] }，顺序见 dimensions
  const variations = jsonAfter(html, '"variationValues" :') ?? jsonAfter(html, '"variationValues":') ?? {};
  const children = jsonAfter(html, '"dimensionValuesDisplayData" :') ?? jsonAfter(html, '"dimensionValuesDisplayData":') ?? {};
  const dims = jsonAfter(html, '"dimensions" :') ?? jsonAfter(html, '"dimensions":') ?? [];
  const current = html.match(/"currentAsin"\s*:\s*"(\w{10})"/)?.[1] ?? asin;
  const at = key => (Array.isArray(dims) ? dims.indexOf(key) : -1);
  const [ci, si] = [at('color_name'), at('size_name')];
  const color = ci >= 0 ? (children[asin] ?? children[current])?.[ci] : null;
  const sizes = color && si >= 0
    ? Object.values(children).filter(v => v[ci] === color).map(v => v[si])
    : variations.size_name ?? [];
  const sizeOrder = variations.size_name ?? [];
  return {
    platform: 'amazon',
    sourceUrl: `${u.origin}/dp/${asin}`,
    name,
    description,
    price: amount > 0 ? { amount, currency } : null,
    images: unique(images),
    sizes: unique(sizes).sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b)),
    colors: color ? [color] : unique(variations.color_name ?? []).slice(0, 1),
    [PAGE]: html,
  };
}

// ---------- 自动识别 ----------

// 亚马逊链接按亚马逊解析；其他链接先试 Shopify 公开接口，拿不到再从网页中读取商品数据
async function scrapeAuto(url) {
  const u = new URL(url);
  if (/(^|\.)amazon\./i.test(u.hostname)) return scrapeAmazon(url);
  if (/\/products\/[^/?#]+/.test(u.pathname)) {
    try {
      return await scrapeShopify(url);
    } catch {
      // 不是 Shopify 网站，按通用方式处理
    }
  }
  return scrapeGeneric(url);
}

// ---------- 入口 ----------

export const PLATFORMS = {
  auto: scrapeAuto,
  shopify: scrapeShopify,
  generic: scrapeGeneric,
  amazon: scrapeAmazon,
};

export async function scrape(platform = 'auto', url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ScrapeError('链接格式不正确', 'BAD_URL');
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new ScrapeError('只支持 http/https 链接', 'BAD_URL');
  // 防止被用来访问服务器内网
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/.test(parsed.hostname) || !parsed.hostname.includes('.')) {
    throw new ScrapeError('不支持内网地址', 'BAD_URL');
  }
  const fn = PLATFORMS[platform];
  if (!fn) throw new ScrapeError('不支持的平台', 'BAD_PLATFORM');
  deadline = Date.now() + SCRAPE_LIMIT;
  let product = await fn(parsed.href);
  const missing = product[PAGE] ? missingFields(product) : [];
  const left = deadline - Date.now();
  if (missing.length && left < 5_000) {
    product.warnings = [...(product.warnings ?? []), `已到 30 秒上限，${missing.join('、')}没有用 AI 补全，请手动填写`];
  } else if (missing.length) {
    try {
      product = await fillWithAI(product[PAGE], product, left);
    } catch (e) {
      product.warnings = [...(product.warnings ?? []), `AI 补全${missing.join('、')}失败：${e.message}`];
    }
  }
  if (!product.images.length) product.warnings = [...(product.warnings ?? []), '没有抓到商品图片'];
  if (!product.price) product.warnings = [...(product.warnings ?? []), '没有抓到价格，请手动填写'];
  return product;
}
