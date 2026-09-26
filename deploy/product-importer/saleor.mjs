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
    categories(first: 100) { edges { node { id name level parent { name } } } }
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

const LANGS = { zh: 'ZH_HANS', ja: 'JA' };

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

  // 2. 商品（英文为主语言），slug 冲突时加后缀
  const base = slugify(data.texts.en.name);
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
          name: data.texts.en.name,
          slug,
          description: rich(data.texts.en.description),
        },
      }, token);
      product = d.productCreate.product;
    } catch (e) {
      if (attempt < 3 && /slug/i.test(e.message)) continue;
      throw e;
    }
  }

  // 3. 中日文翻译
  for (const [lang, code] of Object.entries(LANGS)) {
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
        name: [c?.en, s].filter(Boolean).join(' / ') || data.texts.en.name,
        sku: [product.slug, c && slugify(c.en), s && slugify(s)].filter(Boolean).join('-'),
        trackInventory: true,
        attributes,
        stocks: data.warehouseId ? [{ warehouse: data.warehouseId, quantity: Math.max(0, Math.floor(Number(data.stock) || 0)) }] : [],
        channelListings: priced.map(ch => ({ channelId: ch.id, price: Number(data.prices[ch.id]) })),
      });
    }
  }
  const vb = await gql(`mutation($product: ID!, $variants: [ProductVariantBulkCreateInput!]!) {
    productVariantBulkCreate(product: $product, variants: $variants) {
      errors { field message code }
      results { errors { field message code } }
    }
  }`, { product: product.id, variants }, token);
  const variantError = vb.productVariantBulkCreate.results?.flatMap(r => r.errors ?? [])[0];
  if (variantError) throw new SaleorError(`规格创建失败：${variantError.field ?? ''} ${variantError.message}`);

  // 6. 图片：交给 Saleor 按链接下载，单张失败不影响其余
  const imageErrors = [];
  for (const url of data.images) {
    try {
      await gql(`mutation($input: ProductMediaCreateInput!) {
        productMediaCreate(input: $input) { media { id } errors { field message } }
      }`, { input: { product: product.id, mediaUrl: url, alt: data.texts.en.name } }, token);
    } catch (e) {
      imageErrors.push(`${url}：${e.message}`);
    }
  }

  // 7. 记录来源链接，便于日后核对
  if (data.sourceUrl) {
    await gql(`mutation($id: ID!, $input: [MetadataInput!]!) {
      updatePrivateMetadata(id: $id, input: $input) { errors { field message } }
    }`, { id: product.id, input: [{ key: 'import_source_url', value: data.sourceUrl }] }, token).catch(() => {});
  }

  return { id: product.id, slug: product.slug, variants: variants.length, imageErrors };
}
