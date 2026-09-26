// 访问 Saleor：校验后台员工身份、读取入库选项、创建商品（含规格、图片、三语翻译、各渠道价格）。

import http from 'node:http';
import https from 'node:https';

const SALEOR_API_URL = process.env.SALEOR_API_URL || 'http://api:8000/graphql/';
// 在容器内网访问 Saleor 时使用的 Host 头，需在 Saleor 的 ALLOWED_HOSTS 中
const SALEOR_HOST = process.env.SALEOR_HOST || 'localhost';

export class SaleorError extends Error {}

function request(url, { headers = {}, body = '' }) {
  const target = new URL(url);
  const lib = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(target, {
      method: 'POST',
      headers: { 'Content-Length': Buffer.byteLength(body), ...headers },
      timeout: 60_000,
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

export async function gql(query, variables, token) {
  const headers = { 'Content-Type': 'application/json', Host: SALEOR_HOST, 'X-Forwarded-Proto': 'https' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await request(SALEOR_API_URL, { headers, body: JSON.stringify({ query, variables }) });
  let json;
  try {
    json = JSON.parse(res.body);
  } catch {
    throw new SaleorError(`Saleor 返回异常（HTTP ${res.status}）`);
  }
  if (json.errors?.length) throw new SaleorError(json.errors[0].message);
  // 每个 mutation 的结果都带 errors 字段，统一检查
  for (const value of Object.values(json.data ?? {})) {
    const err = value && Array.isArray(value.errors) ? value.errors[0] : null;
    if (err) throw new SaleorError(`${err.field ? `${err.field}: ` : ''}${err.message || err.code}`);
  }
  return json.data;
}

// ---------- 员工身份 ----------

const staffCache = new Map(); // token → { email, expires }

// 后台打开扩展页面时会把员工的凭证交给页面，页面调用本服务时带上，这里用它查询员工身份与权限
export async function verifyStaff(token) {
  if (!token) return null;
  const cached = staffCache.get(token);
  if (cached && cached.expires > Date.now()) return cached.email;
  const d = await gql(`{ me { email isStaff userPermissions { code } } }`, {}, token).catch(() => null);
  const me = d?.me;
  const ok = me?.isStaff && me.userPermissions.some(p => p.code === 'MANAGE_PRODUCTS');
  if (!ok) return null;
  staffCache.set(token, { email: me.email, expires: Date.now() + 60_000 });
  if (staffCache.size > 500) staffCache.clear();
  return me.email;
}

// ---------- 入库选项 ----------

export async function loadOptions(appToken) {
  return gql(`{
    productTypes(first: 50) {
      edges { node { id name hasVariants variantAttributes { id slug name inputType } } }
    }
    categories(first: 100) { edges { node { id name slug level parent { name } translation(languageCode: EN) { name } } } }
    channels { id slug name currencyCode }
    warehouses(first: 20) { edges { node { id name } } }
  }`, {}, appToken).then(d => ({
    productTypes: d.productTypes.edges.map(e => e.node).filter(t => t.hasVariants),
    categories: d.categories.edges.map(e => e.node),
    channels: d.channels,
    warehouses: d.warehouses.edges.map(e => e.node),
  }));
}

// ---------- 入库 ----------

// 商品以中文为主语言（运营使用中文后台），英文、日文写入翻译
const LANGS = { zh: 'ZH_HANS', en: 'EN', ja: 'JA' };
const PRODUCT_TRANSLATIONS = ['en', 'ja'];

// 按币种习惯取整：日元到 10 元，人民币到 1 元，其余保留两位小数
function roundPrice(v, currency) {
  if (currency === 'JPY' || currency === 'KRW') return Math.round(v / 10) * 10;
  if (currency === 'CNY' || currency === 'TWD') return Math.round(v);
  return Math.round(v * 100) / 100;
}

const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'product';

// Saleor 富文本为 EditorJS JSON，每行一个段落
const rich = text => JSON.stringify({
  time: Date.now(),
  blocks: String(text || '').split('\n').map(s => s.trim()).filter(Boolean)
    .map((t, i) => ({ id: `p${i}`, type: 'paragraph', data: { text: t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') } })),
  version: '2.30.7',
});

async function attributeValues(attributeId, token) {
  const values = [];
  let after = null;
  for (;;) {
    const d = await gql(`query($id: ID!, $after: String) {
      attribute(id: $id) { choices(first: 100, after: $after) { edges { node { id name } } pageInfo { hasNextPage endCursor } } }
    }`, { id: attributeId, after }, token);
    const c = d.attribute.choices;
    values.push(...c.edges.map(e => e.node));
    if (!c.pageInfo.hasNextPage) return values;
    after = c.pageInfo.endCursor;
  }
}

// 按名称（不区分大小写）找到已有的属性值，没有则创建；新建颜色写入色值和中日文翻译
async function ensureValue(attr, existing, { name, hex, zh, ja }, token) {
  const found = existing.find(v => v.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  const input = { name, ...(attr.inputType === 'SWATCH' && hex ? { value: hex } : {}) };
  const d = await gql(`mutation($attr: ID!, $input: AttributeValueCreateInput!) {
    attributeValueCreate(attribute: $attr, input: $input) { attributeValue { id name } errors { field message code } }
  }`, { attr: attr.id, input }, token);
  const value = d.attributeValueCreate.attributeValue;
  existing.push(value);
  for (const [lang, text] of Object.entries({ zh, ja })) {
    if (!text || text === name) continue;
    await gql(`mutation($id: ID!, $lang: LanguageCodeEnum!, $input: AttributeValueTranslationInput!) {
      attributeValueTranslate(id: $id, languageCode: $lang, input: $input) { errors { field message } }
    }`, { id: value.id, lang: LANGS[lang], input: { name: text } }, token);
  }
  return value.id;
}

/**
 * data: {
 *   productTypeId, categoryId, warehouseId, stock, sourceUrl,
 *   texts: { en: { name, description }, zh: {...}, ja: {...} },
 *   colors: [{ en, zh, ja, hex }], sizes: [string],
 *   prices: { <channelId>: number }, images: [url]
 * }
 * 商品名称、描述以中文为主，英文、日文为翻译；网址标识用英文名生成
 */
export async function importProduct(data, token) {
  const { productTypes, channels } = await loadOptions(token);
  const type = productTypes.find(t => t.id === data.productTypeId);
  if (!type) throw new SaleorError('商品类型不存在或不支持规格');
  const colorAttr = type.variantAttributes.find(a => a.slug === 'color');
  const sizeAttr = type.variantAttributes.find(a => a.slug === 'size');
  const colors = data.colors.length ? data.colors : [null];
  const sizes = data.sizes.length ? data.sizes : [null];
  if (colorAttr && !data.colors.length) throw new SaleorError('该商品类型需要至少一个颜色');
  if (sizeAttr && !data.sizes.length) throw new SaleorError('该商品类型需要至少一个尺码');
  const priced = channels.filter(ch => Number(data.prices[ch.id]) > 0);
  if (!priced.length) throw new SaleorError('请至少填写一个渠道的售价');

  // 1. 颜色、尺码属性值（缺少的自动创建）
  const colorIds = new Map();
  if (colorAttr) {
    const existing = await attributeValues(colorAttr.id, token);
    for (const c of data.colors) colorIds.set(c.en, await ensureValue(colorAttr, existing, { name: c.en, hex: c.hex, zh: c.zh, ja: c.ja }, token));
  }
  const sizeIds = new Map();
  if (sizeAttr) {
    const existing = await attributeValues(sizeAttr.id, token);
    for (const s of data.sizes) sizeIds.set(s, await ensureValue(sizeAttr, existing, { name: s }, token));
  }

  // 2. 商品（中文为主语言），slug 用英文名生成，冲突时加后缀
  const base = slugify(data.texts.en?.name || data.texts.zh.name);
  let product;
  for (let attempt = 0; !product; attempt++) {
    const slug = attempt ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base;
    try {
      const d = await gql(`mutation($input: ProductCreateInput!) {
        productCreate(input: $input) { product { id slug } errors { field message code } }
      }`, {
        input: {
          productType: type.id,
          category: data.categoryId,
          name: data.texts.zh.name,
          slug,
          description: rich(data.texts.zh.description),
        },
      }, token);
      product = d.productCreate.product;
    } catch (e) {
      if (attempt < 3 && /slug/i.test(e.message)) continue;
      throw e;
    }
  }

  // 3. 英文、日文翻译
  for (const lang of PRODUCT_TRANSLATIONS) {
    const code = LANGS[lang];
    const t = data.texts[lang];
    if (!t?.name) continue;
    await gql(`mutation($id: ID!, $lang: LanguageCodeEnum!, $input: TranslationInput!) {
      productTranslate(id: $id, languageCode: $lang, input: $input) { errors { field message } }
    }`, { id: product.id, lang: code, input: { name: t.name, description: rich(t.description) } }, token);
  }

  // 4. 渠道：先不发布，检查无误后在后台手动发布
  await gql(`mutation($id: ID!, $input: ProductChannelListingUpdateInput!) {
    productChannelListingUpdate(id: $id, input: $input) { errors { field message } }
  }`, {
    id: product.id,
    input: {
      updateChannels: priced.map(ch => ({
        channelId: ch.id, isPublished: false, visibleInListings: true, isAvailableForPurchase: true,
      })),
    },
  }, token);

  // 5. 规格：颜色 × 尺码
  const variants = [];
  for (const c of colors) {
    for (const s of sizes) {
      const attributes = [];
      if (colorAttr && c) attributes.push({ id: colorAttr.id, swatch: { id: colorIds.get(c.en) } });
      if (sizeAttr && s) attributes.push({ id: sizeAttr.id, dropdown: { id: sizeIds.get(s) } });
      variants.push({
        name: [c?.zh || c?.en, s].filter(Boolean).join(' / ') || data.texts.zh.name,
        sku: [product.slug, c && slugify(c.en), s && slugify(s)].filter(Boolean).join('-'),
        trackInventory: true,
        attributes,
        stocks: data.warehouseId ? [{ warehouse: data.warehouseId, quantity: Math.max(0, Math.floor(Number(data.stock) || 0)) }] : [],
        channelListings: priced.map(ch => ({
          channelId: ch.id,
          price: roundPrice(Number(data.prices[ch.id]), ch.currencyCode),
        })),
      });
    }
  }
  const vb = await gql(`mutation($product: ID!, $variants: [ProductVariantBulkCreateInput!]!) {
    productVariantBulkCreate(product: $product, variants: $variants) {
      errors { field message code }
      results { errors { field message code } }
    }
  }`, { product: product.id, variants }, token);
  const variantError = (vb.productVariantBulkCreate.results ?? []).flatMap(r => r.errors ?? [])[0];
  if (variantError) throw new SaleorError(`规格创建失败：${variantError.field ?? ''} ${variantError.message}`);

  // 6. 图片：交给 Saleor 按链接下载，4 张并行，单张失败不影响其余
  const imageErrors = [];
  const mediaIds = new Array(data.images.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < data.images.length) {
      const i = next++;
      const url = data.images[i];
      try {
        const d = await gql(`mutation($input: ProductMediaCreateInput!) {
          productMediaCreate(input: $input) { media { id } errors { field message } }
        }`, { input: { product: product.id, mediaUrl: url, alt: data.texts.zh.name } }, token);
        mediaIds[i] = d.productMediaCreate.media?.id;
      } catch (e) {
        imageErrors.push(`${url}：${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  // 并行下载打乱了先后，按提交顺序重新排列（第一张为主图）
  const ordered = mediaIds.filter(Boolean);
  if (ordered.length > 1) {
    await gql(`mutation($product: ID!, $media: [ID!]!) {
      productMediaReorder(productId: $product, mediaIds: $media) { errors { field message } }
    }`, { product: product.id, media: ordered }, token).catch(() => {});
  }

  // 7. 记录来源链接，便于日后核对
  if (data.sourceUrl) {
    await gql(`mutation($id: ID!, $input: [MetadataInput!]!) {
      updatePrivateMetadata(id: $id, input: $input) { errors { field message } }
    }`, { id: product.id, input: [{ key: 'import_source_url', value: data.sourceUrl }] }, token).catch(() => {});
  }

  return { id: product.id, slug: product.slug, variants: variants.length, imageErrors };
}

// ---------- 名称查重 ----------

// 文字语言：含假名为日文，含汉字为中文，否则按英文
export const detectLang = text => (/[\u3040-\u30ff]/.test(text) ? 'ja' : /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en');

// 比较用：统一全半角、大小写，去掉空格和标点
const normalize = text => String(text ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');

// 来源链接统一写法后比较：去掉参数、锚点和结尾斜杠，Shopify 的「/collections/分类/products/商品」统一为「/products/商品」
function sameSource(a, b) {
  const key = url => {
    try {
      const u = new URL(url);
      return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/^\/collections\/[^/]+(?=\/products\/)/, '').replace(/\/+$/, '')}`.toLowerCase();
    } catch {
      return '';
    }
  };
  return Boolean(a && b) && key(a) !== '' && key(a) === key(b);
}

/**
 * 与已有商品比较同一语言的名称（原文是中文就比中文名，英文就比英文名），并检查该来源链接是否导入过。
 * names：要比较的名称（原文名称、表单中该语言的名称）
 * 返回 [{ id, name, matched, reason }]，reason 为「同一来源链接」「同名」「名称相近」
 */
export async function findDuplicates({ names, lang, sourceUrl }, token) {
  const wanted = [...new Set(names.map(normalize).filter(Boolean))];
  const matches = [];
  let after = null;
  for (;;) {
    const d = await gql(`query($after: String) {
      products(first: 100, after: $after) {
        edges { node {
          id name
          en: translation(languageCode: EN) { name }
          zh: translation(languageCode: ZH_HANS) { name }
          ja: translation(languageCode: JA) { name }
          source: privateMetafield(key: "import_source_url")
        } }
        pageInfo { hasNextPage endCursor }
      }
    }`, { after }, token);
    for (const { node: p } of d.products.edges) {
      // 该语言下的名称：翻译，或主名称本身就是该语言（早期商品以英文为主名称）
      const own = [p[lang]?.name, detectLang(p.name) === lang ? p.name : null].filter(Boolean);
      let reason = sameSource(p.source, sourceUrl) ? '同一来源链接' : null;
      let matched = reason ? p.name : null;
      for (const candidate of own) {
        if (reason) break;
        const c = normalize(candidate);
        for (const w of wanted) {
          const [short, long] = c.length <= w.length ? [c, w] : [w, c];
          if (c === w) reason = '同名';
          // 一个包含另一个且长度相近（避免「牛仔裤」这类短名称误报）
          else if (short.length >= 4 && long.includes(short) && short.length / long.length >= 0.6) reason = '名称相近';
          if (reason) { matched = candidate; break; }
        }
      }
      if (reason) matches.push({ id: p.id, name: p.name, matched, reason });
    }
    if (!d.products.pageInfo.hasNextPage) break;
    after = d.products.pageInfo.endCursor;
  }
  return matches;
}
