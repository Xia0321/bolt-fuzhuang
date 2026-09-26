// 从商品链接抓取名称、描述、价格、图片、尺码、颜色。
// 支持：Shopify 独立站（公开的 products/<handle>.js 接口）、通用独立站（网页中的 JSON-LD / Open Graph 数据）、
// 亚马逊（解析商品页，反爬严格，可能被拦截）。
//
// 返回统一结构：
//   { platform, sourceUrl, name, description, price: { amount, currency } | null,
//     images: [url], sizes: [string], colors: [string] }

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export class ScrapeError extends Error {
  constructor(message, code = 'SCRAPE_FAILED') {
    super(message);
    this.code = code;
  }
}

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
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
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

async function scrapeShopify(url) {
  const u = new URL(url);
  const handle = u.pathname.match(/\/products\/([^/?#]+)/)?.[1];
  if (!handle) throw new ScrapeError('不是 Shopify 商品链接（应包含 /products/商品名）', 'BAD_URL');
  const p = await get(`${u.origin}/products/${handle}.js`, { json: true });
  // 店铺币种：cart.js 不创建购物车，只返回空购物车信息
  const cart = await get(`${u.origin}/cart.js`, { json: true }).catch(() => null);
  const optionIndex = pattern => (p.options || []).findIndex(o => pattern.test(o.name ?? o));
  const values = idx => (idx >= 0 ? unique(p.variants.map(v => v[`option${idx + 1}`])) : []);
  return {
    platform: 'shopify',
    sourceUrl: url,
    name: p.title,
    description: htmlToText(p.description),
    price: p.price != null ? { amount: p.price / 100, currency: cart?.currency || '' } : null,
    images: unique((p.images || []).map(i => absolute(i, u.origin))),
    sizes: values(optionIndex(SIZE_NAMES)),
    colors: values(optionIndex(COLOR_NAMES)),
  };
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

  const bullets = html.match(/id=["']feature-bullets["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? '';
  const description = [htmlToText(bullets), text('productDescription')].filter(Boolean).join('\n');

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

  const variations = jsonAfter(html, '"variationValues" :') ?? jsonAfter(html, '"variationValues":') ?? {};
  return {
    platform: 'amazon',
    sourceUrl: `${u.origin}/dp/${asin}`,
    name,
    description,
    price: amount > 0 ? { amount, currency } : null,
    images: unique(images),
    sizes: unique(variations.size_name ?? []),
    colors: unique(variations.color_name ?? []),
  };
}

// ---------- 入口 ----------

export const PLATFORMS = {
  shopify: scrapeShopify,
  generic: scrapeGeneric,
  amazon: scrapeAmazon,
};

export async function scrape(platform, url) {
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
  const product = await fn(parsed.href);
  if (!product.images.length) product.warnings = [...(product.warnings ?? []), '没有抓到商品图片'];
  if (!product.price) product.warnings = [...(product.warnings ?? []), '没有抓到价格，请手动填写'];
  return product;
}
