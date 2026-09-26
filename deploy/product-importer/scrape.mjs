// 从商品链接抓取名称、描述、价格、图片、尺码、颜色。
// 支持：Shopify 独立站（公开的 products/<handle>.js 接口）、通用独立站（网页中的 JSON-LD / Open Graph 数据）、
// 亚马逊（解析商品页，反爬严格，可能被拦截）。
//
// 返回统一结构：
//   { platform, sourceUrl, name, description, price: { amount, currency } | null,
//     images: [url], sizes: [string], colors: [string], keywords?: string,
//     colorGroups?: [{ color, hint, url, price, images, sizes, differences, current? }] }
//   colorGroups：对方网站把每个颜色做成单独商品时，本商品及页面上其他颜色各一项。
//   differences 为与当前商品在面料、成分、版型、长度、价格等方面的差异：为空的只是颜色不同，可合并为一个商品的多个颜色；
//   不为空的实际是不同商品，应单独导入

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

// 页面上的颜色色块若链接到其他商品（对方网站把每个颜色做成单独商品），收集这些商品的 handle
function siblingHandles(html, current) {
  const handles = [];
  for (const m of html.matchAll(/(?:href=["'][^"']*\/products\/|data-[\w-]*handle=["'])([\w-]+)/gi)) {
    // 所在标签（从 < 到链接处）带有颜色、色块字样才算；有的主题把整段商品数据塞在属性里，标签很长，只看开头
    const start = html.lastIndexOf('<', m.index);
    if (/colou?r|swatch/i.test(html.slice(start, m.index))) handles.push(m[1]);
  }
  return unique(handles).filter(h => h !== current && !/gift-?card/i.test(h)).slice(0, 30);
}

// 面料成分，如「69% Cotton, 29% TENCEL™ Lyocell, 1% Spandex/Lycra」→「69 cotton, 29 lyocell, 1 elastane」，用于比较
function composition(text) {
  const line = String(text).split('\n').find(l => /\d+\s*%\s*[a-z]/i.test(l)) ?? '';
  // 网页转文字时成分后面可能紧跟下一段标题（如 "LycraStretch"），遇到小写接大写处截断
  const found = [...line.matchAll(/(\d+(?:\.\d+)?)\s*%\s*([a-z™®\s/-]+)/gi)]
    .map(([, pct, name]) => [pct, name.replace(/([a-z])[A-Z].*$/, '$1').trim()]);
  const parts = found.map(([pct, name]) => {
    let m = name.toLowerCase().replace(/[™®]/g, '').replace(/\s+/g, ' ').trim();
    if (/lycra|spandex|elastane/.test(m)) m = 'elastane';
    else if (/lyocell|tencel/.test(m)) m = 'lyocell';
    return `${Number(pct)} ${m}`;
  });
  return { key: parts.sort().join(', '), text: found.map(([pct, name]) => `${pct}% ${name}`).join(', ') };
}

// 从 Shopify 商品数据中取出可比较的特征：标签中的面料系列、版型、长度、弹力，描述中的成分，尺码颜色以外的选项，原价
function traits(p) {
  const tag = re => (p.tags || []).map(t => String(t).match(re)?.[1]?.trim().toLowerCase()).filter(Boolean);
  return {
    fabric: unique(tag(/^fabric\s*[-:]\s*(.+)$/i)).join(' / '),
    fit: unique(tag(/^fit\s*:\s*(.+)$/i).map(v => v.replace(/\s*leg$/, ''))).sort().join(' / '),
    length: unique(tag(/^length\s*:\s*(.+)$/i)).sort().join(' / '),
    stretch: unique(tag(/^stretch\s*:\s*(.+)$/i)).join(' / '),
    composition: composition(htmlToText(p.description)),
    options: (p.options || []).filter(o => !SIZE_NAMES.test(o.name) && !COLOR_NAMES.test(o.name))
      .map(o => `${o.name} ${o.values.join('/')}`).join('；'),
    // 打折商品按划线原价比较，避免把促销价差当成不同商品
    price: Math.max(p.price ?? 0, p.compare_at_price ?? 0) / 100,
  };
}

// 与当前商品逐项比较，返回差异说明；只比较双方都有的特征
function differences(a, b, currency) {
  const out = [];
  const both = (x, y) => x && y && x !== y;
  if (both(a.fabric, b.fabric)) out.push(`面料系列不同：${titleCase(b.fabric)}`);
  if (both(a.composition.key, b.composition.key)) out.push(`成分不同：${b.composition.text}`);
  if (both(a.fit, b.fit)) out.push(`版型不同：${b.fit}`);
  if (both(a.length, b.length)) out.push(`长度不同：${b.length}`);
  if (both(a.stretch, b.stretch)) out.push(`弹力不同：${b.stretch}`);
  if (both(a.options, b.options)) out.push(`选项不同：${b.options}`);
  if (a.price && b.price && a.price !== b.price) out.push(`原价不同：${b.price} ${currency}`.trim());
  return out;
}

async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i]).catch(() => null);
    }
  }));
  return out;
}

async function scrapeShopify(url) {
  const u = new URL(url);
  const handle = u.pathname.match(/\/products\/([^/?#]+)/)?.[1];
  if (!handle) throw new ScrapeError('不是 Shopify 商品链接（应包含 /products/商品名）', 'BAD_URL');
  // Shopify 会按访问者所在地区换算币种，固定请求美元（店铺不支持时仍按其实际币种返回，由 cart.js 读出）
  const headers = { Cookie: 'cart_currency=USD; localization=US' };
  const load = h => get(`${u.origin}/products/${h}.js`, { json: true, headers });
  const p = await load(handle);
  // 店铺币种：cart.js 不创建购物车，只返回空购物车信息
  const cart = await get(`${u.origin}/cart.js`, { json: true, headers }).catch(() => null);
  const currency = cart?.currency || '';
  const optionIndex = (prod, pattern) => (prod.options || []).findIndex(o => pattern.test(o.name ?? o));
  const values = (prod, idx) => (idx >= 0 ? unique(prod.variants.map(v => v[`option${idx + 1}`])) : []);
  const imagesOf = prod => unique((prod.media?.length ? prod.media.filter(m => m.media_type === 'image' && !isSwatch(m)).map(m => m.src) : prod.images || [])
    .map(i => absolute(i, u.origin)));
  const priceOf = prod => (prod.price != null ? { amount: prod.price / 100, currency } : null);

  const result = {
    platform: 'shopify',
    sourceUrl: url,
    name: p.title,
    description: htmlToText(p.description),
    price: priceOf(p),
    images: imagesOf(p),
    sizes: values(p, optionIndex(p, SIZE_NAMES)),
    colors: values(p, optionIndex(p, COLOR_NAMES)),
    keywords: [p.type, ...(p.tags || [])].filter(Boolean).join(', '),
  };
  if (result.colors.length) return result;

  // 没有颜色选项：本商品就是一个颜色，再找同款的其他颜色（各自是单独的商品）
  const own = colorOfProduct(p);
  if (!own) return result;
  const style = titleParts(p.title)[0];
  if (titleParts(p.title).length > 1) result.name = style;
  result.colors = [own.name];
  const base = traits(p);
  const group = prod => ({
    color: colorOfProduct(prod).name,
    // 与当前商品的差异；为空说明只是颜色不同，可合并为同一商品的多个颜色
    differences: prod === p ? [] : differences(base, traits(prod), currency),
    hint: colorOfProduct(prod).hint,
    url: `${u.origin}/products/${prod.handle}`,
    price: priceOf(prod),
    images: imagesOf(prod),
    sizes: values(prod, optionIndex(prod, SIZE_NAMES)),
  });
  const html = await get(url).catch(() => '');
  const siblings = (await mapLimit(siblingHandles(html, handle), 6, load))
    // 只保留同一款式：标题的款式部分相同、有颜色、不重复
    .filter(s => s && titleParts(s.title)[0] === style && colorOfProduct(s))
    .map(group)
    .filter((g, i, list) => g.color !== own.name && list.findIndex(x => x.color === g.color) === i)
    // 同款（只有颜色不同）排在前面
    .sort((x, y) => x.differences.length - y.differences.length);
  result.colorGroups = [{ ...group(p), current: true }, ...siblings];
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
  const product = await fn(parsed.href);
  if (!product.images.length) product.warnings = [...(product.warnings ?? []), '没有抓到商品图片'];
  if (!product.price) product.warnings = [...(product.warnings ?? []), '没有抓到价格，请手动填写'];
  return product;
}
