// 把 data.mjs 里的初始数据导入 Saleor。可重复执行：已存在的对象会跳过或更新。
// 用法：
//   SALEOR_API_URL=http://localhost:8000/graphql/ \
//   SALEOR_EMAIL=admin@example.com SALEOR_PASSWORD=xxx \
//   node saleor/seed/seed.mjs
import * as data from './data.mjs';

const API = process.env.SALEOR_API_URL || 'http://localhost:8000/graphql/';
const EMAIL = process.env.SALEOR_EMAIL;
const PASSWORD = process.env.SALEOR_PASSWORD;
const STOCK_PER_VARIANT = 20;

const LANGS = { zh: 'ZH_HANS', ja: 'JA' };

let token = '';

async function gql(query, variables = {}, file) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let body;
  if (file) {
    body = new FormData();
    // file.path 指向变量中占位的 null，例如 variables.input.image；默认 variables.file
    const path = file.path ?? 'variables.file';
    const vars = file.path ? variables : { ...variables, file: null };
    body.append('operations', JSON.stringify({ query, variables: vars }));
    body.append('map', JSON.stringify({ 0: [path] }));
    body.append('0', file.blob, file.name);
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ query, variables });
  }
  const res = await fetch(API, { method: 'POST', headers, body });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join('; '));
  // 每个 mutation 的结果都带 errors 字段，统一检查
  for (const value of Object.values(json.data ?? {})) {
    if (value && Array.isArray(value.errors) && value.errors.length) {
      throw new Error(JSON.stringify(value.errors));
    }
  }
  return json.data;
}

async function download(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const name = new URL(url).pathname.split('/').pop() || 'image.jpg';
      return { blob, name };
    } catch (e) {
      if (attempt >= 3) throw new Error(`下载图片失败 ${url}: ${e.message}`);
    }
  }
}

const rich = paragraphs => JSON.stringify({
  time: Date.now(),
  blocks: paragraphs.map(text => ({ type: 'paragraph', data: { text } })),
  version: '2.24.3',
});

const slugify = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function log(...args) {
  console.log('·', ...args);
}

// ---------- 基础设施：渠道、仓库、配送、支付 ----------

async function login() {
  if (!EMAIL || !PASSWORD) throw new Error('请设置 SALEOR_EMAIL 和 SALEOR_PASSWORD');
  const d = await gql(`mutation($email: String!, $password: String!) {
    tokenCreate(email: $email, password: $password) { token errors { field message } }
  }`, { email: EMAIL, password: PASSWORD });
  token = d.tokenCreate.token;
}

// 店铺名称显示在后台标题和系统邮件中，与站点设置里的品牌名保持一致
async function ensureShopName() {
  const name = data.pages.find(p => p.slug === 'site-settings').attrs['brand-name'];
  await gql(`mutation($name: String!) {
    shopDomainUpdate(input: { name: $name }) { errors { field message } }
  }`, { name });
}

async function ensureWarehouse() {
  const d = await gql(`{ warehouses(first: 100) { edges { node { id slug } } } }`);
  const found = d.warehouses.edges.find(e => e.node.slug === data.warehouse.slug);
  if (found) return found.node.id;
  const { slug, name, email, address } = data.warehouse;
  const c = await gql(`mutation($input: WarehouseCreateInput!) {
    createWarehouse(input: $input) { warehouse { id } errors { field message } }
  }`, { input: { slug, name, email, address } });
  log('仓库', name);
  return c.createWarehouse.warehouse.id;
}

async function ensureChannels(warehouseId) {
  const d = await gql(`{ channels { id slug currencyCode } }`);
  const result = {};
  for (const ch of data.channels) {
    let found = d.channels.find(c => c.slug === ch.slug);
    if (!found) {
      const c = await gql(`mutation($input: ChannelCreateInput!) {
        channelCreate(input: $input) { channel { id slug currencyCode } errors { field message } }
      }`, {
        input: {
          name: ch.name, slug: ch.slug, currencyCode: ch.currency, defaultCountry: ch.country,
          isActive: true, addWarehouses: [warehouseId],
        },
      });
      found = c.channelCreate.channel;
      log('渠道', ch.slug, ch.currency);
    }
    result[ch.slug] = { ...ch, id: found.id };
  }
  return result;
}

async function ensureShippingZone(channels, warehouseId) {
  const zone = data.shippingZone;
  const d = await gql(`{ shippingZones(first: 100) { edges { node { id name shippingMethods { id name } } } } }`);
  let found = d.shippingZones.edges.find(e => e.node.name === zone.name)?.node;
  if (!found) {
    const c = await gql(`mutation($input: ShippingZoneCreateInput!) {
      shippingZoneCreate(input: $input) { shippingZone { id name shippingMethods { id name } } errors { field message } }
    }`, {
      input: {
        name: zone.name, countries: zone.countries,
        addWarehouses: [warehouseId], addChannels: Object.values(channels).map(c => c.id),
      },
    });
    found = c.shippingZoneCreate.shippingZone;
    log('配送区域', zone.name);
  }
  for (const method of zone.methods) {
    let methodId = found.shippingMethods.find(m => m.name === method.name)?.id;
    if (!methodId) {
      const c = await gql(`mutation($input: ShippingPriceInput!) {
        shippingPriceCreate(input: $input) { shippingMethod { id } errors { field message } }
      }`, {
        input: {
          name: method.name, shippingZone: found.id, type: 'PRICE',
          minimumDeliveryDays: method.minDays, maximumDeliveryDays: method.maxDays,
        },
      });
      methodId = c.shippingPriceCreate.shippingMethod.id;
      log('配送方式', method.name);
    }
    const addChannels = Object.values(channels).map(ch => {
      const p = method.prices[ch.currency];
      return {
        channelId: ch.id, price: p.price,
        ...(p.min != null ? { minimumOrderPrice: p.min } : {}),
        ...(p.max != null ? { maximumOrderPrice: p.max } : {}),
      };
    });
    await gql(`mutation($id: ID!, $input: ShippingMethodChannelListingInput!) {
      shippingMethodChannelListingUpdate(id: $id, input: $input) { errors { field message } }
    }`, { id: methodId, input: { addChannels } });
    for (const [lang, name] of Object.entries(method.translations)) {
      await gql(`mutation($id: ID!, $lang: LanguageCodeEnum!, $input: ShippingPriceTranslationInput!) {
        shippingPriceTranslate(id: $id, languageCode: $lang, input: $input) { errors { field message } }
      }`, { id: methodId, lang: LANGS[lang], input: { name } });
    }
  }
}

// 本地/测试环境用的模拟支付。正式上线改用 Stripe（见 README）
async function enableDummyPayment(channels) {
  for (const ch of Object.values(channels)) {
    await gql(`mutation($channelId: ID!, $input: PluginUpdateInput!) {
      pluginUpdate(id: "mirumee.payments.dummy", channelId: $channelId, input: $input) { errors { field message } }
    }`, {
      channelId: ch.id,
      input: { active: true, configuration: [{ name: 'Supported currencies', value: ch.currency }] },
    });
  }
  log('模拟支付已启用');
}

// ---------- 商品结构：属性、商品类型 ----------

async function getAttribute(slug) {
  const d = await gql(`query($slug: String!) {
    attribute(slug: $slug) { id choices(first: 100) { edges { node { id name slug } } } }
  }`, { slug });
  return d.attribute;
}

async function ensureAttribute(slug, input) {
  let attr = await getAttribute(slug);
  if (!attr) {
    await gql(`mutation($input: AttributeCreateInput!) {
      attributeCreate(input: $input) { attribute { id } errors { field message } }
    }`, { input: { slug, ...input } });
    attr = await getAttribute(slug);
    log('属性', slug);
  }
  return attr;
}

async function ensureProductType() {
  const size = await ensureAttribute('size', {
    name: 'Size', type: 'PRODUCT_TYPE', inputType: 'DROPDOWN', valueRequired: true,
    values: data.sizes.map(name => ({ name })),
  });
  const color = await ensureAttribute('color', {
    name: 'Color', type: 'PRODUCT_TYPE', inputType: 'SWATCH', valueRequired: true,
    values: Object.entries(data.colors).map(([name, c]) => ({ name, value: c.hex })),
  });
  await gql(`mutation($input: NameTranslationInput!, $id: ID!, $lang: LanguageCodeEnum!) {
    attributeTranslate(id: $id, languageCode: $lang, input: $input) { errors { field message } }
  }`, { id: size.id, lang: 'ZH_HANS', input: { name: '尺码' } });
  // 颜色名称的翻译
  for (const edge of color.choices.edges) {
    const c = data.colors[edge.node.name];
    if (!c) continue;
    for (const lang of ['zh', 'ja']) {
      await gql(`mutation($id: ID!, $lang: LanguageCodeEnum!, $input: AttributeValueTranslationInput!) {
        attributeValueTranslate(id: $id, languageCode: $lang, input: $input) { errors { field message } }
      }`, { id: edge.node.id, lang: LANGS[lang], input: { name: c[lang] } });
    }
  }

  const d = await gql(`{ productTypes(first: 100) { edges { node { id slug } } } }`);
  let typeId = d.productTypes.edges.find(e => e.node.slug === 'apparel')?.node.id;
  if (!typeId) {
    const c = await gql(`mutation($input: ProductTypeInput!) {
      productTypeCreate(input: $input) { productType { id } errors { field message } }
    }`, { input: { name: 'Apparel', slug: 'apparel', kind: 'NORMAL', isShippingRequired: true } });
    typeId = c.productTypeCreate.productType.id;
    await gql(`mutation($id: ID!, $ops: [ProductAttributeAssignInput!]!) {
      productAttributeAssign(productTypeId: $id, operations: $ops) { errors { field message } }
    }`, {
      id: typeId,
      ops: [
        { id: color.id, type: 'VARIANT', variantSelection: true },
        { id: size.id, type: 'VARIANT', variantSelection: true },
      ],
    });
    log('商品类型 Apparel');
  }
  const bySlug = attr => Object.fromEntries(attr.choices.edges.map(e => [e.node.name, e.node.id]));
  return { typeId, size: { id: size.id, values: bySlug(size) }, color: { id: color.id, values: bySlug(color) } };
}

// ---------- 分类、商品、精选集合 ----------

async function ensureCategories() {
  const ids = {};
  for (const cat of data.categories) {
    const d = await gql(`query($slug: String!) { category(slug: $slug) { id } }`, { slug: cat.slug });
    let id = d.category?.id;
    if (!id) {
      const c = await gql(`mutation($input: CategoryInput!) {
        categoryCreate(input: $input) { category { id } errors { field message } }
      }`, {
        input: { name: cat.name.en, slug: cat.slug, description: rich([cat.description.en]), backgroundImage: null },
      }, { ...(await download(cat.image)), path: 'variables.input.backgroundImage' });
      id = c.categoryCreate.category.id;
      log('分类', cat.slug);
    }
    for (const lang of ['zh', 'ja']) {
      await gql(`mutation($id: ID!, $lang: LanguageCodeEnum!, $input: TranslationInput!) {
        categoryTranslate(id: $id, languageCode: $lang, input: $input) { errors { field message } }
      }`, { id, lang: LANGS[lang], input: { name: cat.name[lang], description: rich([cat.description[lang]]) } });
    }
    ids[cat.slug] = id;
  }
  return ids;
}

async function uploadProductMedia(productId, p) {
  for (const url of p.images) {
    await gql(`mutation($input: ProductMediaCreateInput!) {
      productMediaCreate(input: $input) { errors { field message } }
    }`, { input: { product: productId, alt: p.name.en, image: null } }, { ...(await download(url)), path: 'variables.input.image' });
  }
}

async function ensureProducts(productType, categoryIds, channels, warehouseId) {
  const ids = {};
  // 倒序创建，使「最新上架」排序与数据文件的顺序一致
  for (const p of [...data.products].reverse()) {
    const d = await gql(`query($slug: String!) { product(slug: $slug) { id media { id } } }`, { slug: p.slug });
    if (d.product) {
      ids[p.slug] = d.product.id;
      // 上次导入中途失败时补传图片
      if (!d.product.media.length) await uploadProductMedia(d.product.id, p);
      continue;
    }

    const c = await gql(`mutation($input: ProductCreateInput!) {
      productCreate(input: $input) { product { id } errors { field message } }
    }`, {
      input: {
        productType: productType.typeId, category: categoryIds[p.category],
        name: p.name.en, slug: p.slug, description: rich([p.description.en]),
      },
    });
    const id = c.productCreate.product.id;
    ids[p.slug] = id;

    for (const lang of ['zh', 'ja']) {
      await gql(`mutation($id: ID!, $lang: LanguageCodeEnum!, $input: TranslationInput!) {
        productTranslate(id: $id, languageCode: $lang, input: $input) { errors { field message } }
      }`, { id, lang: LANGS[lang], input: { name: p.name[lang], description: rich([p.description[lang]]) } });
    }

    await gql(`mutation($id: ID!, $input: ProductChannelListingUpdateInput!) {
      productChannelListingUpdate(id: $id, input: $input) { errors { field message } }
    }`, {
      id,
      input: {
        updateChannels: Object.values(channels).map(ch => ({
          channelId: ch.id, isPublished: true, visibleInListings: true, isAvailableForPurchase: true,
        })),
      },
    });

    const variants = [];
    for (const colorName of p.colors) {
      for (const size of p.sizes) {
        variants.push({
          sku: `${p.slug}-${slugify(colorName)}-${slugify(size)}`,
          name: `${colorName} / ${size}`,
          trackInventory: true,
          attributes: [
            { id: productType.color.id, swatch: { id: productType.color.values[colorName] } },
            { id: productType.size.id, dropdown: { id: productType.size.values[size] } },
          ],
          stocks: [{ warehouse: warehouseId, quantity: STOCK_PER_VARIANT }],
          channelListings: Object.values(channels).map(ch => ({ channelId: ch.id, price: ch.convert(p.price) })),
        });
      }
    }
    // 演示售罄效果：第一件商品的最大尺码库存为 0
    if (p.slug === 'wool-long-coat-camel') variants.find(v => v.sku.endsWith('-xl')).stocks[0].quantity = 0;

    await gql(`mutation($product: ID!, $variants: [ProductVariantBulkCreateInput!]!) {
      productVariantBulkCreate(product: $product, variants: $variants) { errors { field message } }
    }`, { product: id, variants });

    await uploadProductMedia(id, p);
    log('商品', p.slug, `${variants.length} 个规格`);
  }
  return ids;
}

async function ensureFeaturedCollection(productIds, channels) {
  const col = data.featuredCollection;
  const d = await gql(`query($slug: String!, $channel: String!) { collection(slug: $slug, channel: $channel) { id } }`,
    { slug: col.slug, channel: data.channels[0].slug });
  let id = d.collection?.id;
  if (!id) {
    const c = await gql(`mutation($input: CollectionCreateInput!) {
      collectionCreate(input: $input) { collection { id } errors { field message } }
    }`, {
      input: {
        name: col.name.en, slug: col.slug,
        products: data.products.filter(p => p.featured).map(p => productIds[p.slug]),
      },
    });
    id = c.collectionCreate.collection.id;
    await gql(`mutation($id: ID!, $input: CollectionChannelListingUpdateInput!) {
      collectionChannelListingUpdate(id: $id, input: $input) { errors { field message } }
    }`, { id, input: { addChannels: Object.values(channels).map(ch => ({ channelId: ch.id, isPublished: true })) } });
    log('精选集合');
  }
  for (const lang of ['zh', 'ja']) {
    await gql(`mutation($id: ID!, $lang: LanguageCodeEnum!, $input: TranslationInput!) {
      collectionTranslate(id: $id, languageCode: $lang, input: $input) { errors { field message } }
    }`, { id, lang: LANGS[lang], input: { name: col.name[lang] } });
  }
}

// ---------- 页面内容（配置化的站点文案、横幅、图片） ----------

async function ensurePageStructure() {
  const attrIds = {};
  for (const [slug, def] of Object.entries(data.pageAttributes)) {
    const attr = await ensureAttribute(slug, {
      name: def.name, type: 'PAGE_TYPE', inputType: def.inputType,
      ...(def.values ? { values: def.values.map(name => ({ name })) } : {}),
    });
    attrIds[slug] = attr.id;
  }
  const d = await gql(`{ pageTypes(first: 100) { edges { node { id slug attributes { slug } } } } }`);
  const typeIds = {};
  for (const [slug, attrs] of Object.entries(data.pageTypes)) {
    const existing = d.pageTypes.edges.find(e => e.node.slug === slug)?.node;
    let id = existing?.id;
    if (existing) {
      // 已有的页面类型补上后来新增的属性
      const missing = attrs.filter(a => !existing.attributes.some(x => x.slug === a));
      if (missing.length) {
        await gql(`mutation($id: ID!, $attrs: [ID!]!) {
          pageAttributeAssign(pageTypeId: $id, attributeIds: $attrs) { errors { field message } }
        }`, { id, attrs: missing.map(a => attrIds[a]) });
        log('页面类型属性', `${slug}: ${missing.join(', ')}`);
      }
    } else {
      const c = await gql(`mutation($input: PageTypeCreateInput!) {
        pageTypeCreate(input: $input) { pageType { id } errors { field message } }
      }`, { input: { name: data.pageTypeNames[slug], slug, addAttributes: attrs.map(a => attrIds[a]) } });
      id = c.pageTypeCreate.pageType.id;
      log('页面类型', slug);
    }
    typeIds[slug] = id;
  }
  return { attrIds, typeIds };
}

async function uploadFile(url) {
  const d = await gql(`mutation($file: Upload!) {
    fileUpload(file: $file) { uploadedFile { url contentType } errors { field message } }
  }`, {}, await download(url));
  return d.fileUpload.uploadedFile;
}

async function ensurePages({ attrIds, typeIds }) {
  const ids = {};
  for (const page of data.pages) {
    const d = await gql(`query($slug: String!) { page(slug: $slug) { id } }`, { slug: page.slug });
    let id = d.page?.id;
    if (!id) {
      const attributes = [];
      for (const [slug, value] of Object.entries(page.attrs)) {
        const def = data.pageAttributes[slug];
        const attrId = attrIds[slug];
        if (def.inputType === 'PLAIN_TEXT') {
          attributes.push({ id: attrId, plainText: typeof value === 'object' ? value.en : String(value) });
        } else if (def.inputType === 'FILE') {
          const file = await uploadFile(value);
          attributes.push({ id: attrId, file: file.url, contentType: file.contentType });
        } else if (def.inputType === 'NUMERIC') {
          attributes.push({ id: attrId, numeric: String(value) });
        } else if (def.inputType === 'DROPDOWN') {
          attributes.push({ id: attrId, dropdown: { value } });
        }
      }
      const c = await gql(`mutation($input: PageCreateInput!) {
        pageCreate(input: $input) { page { id } errors { field message } }
      }`, {
        input: {
          slug: page.slug, title: page.title.en, pageType: typeIds[page.type], isPublished: true,
          ...(page.content ? { content: rich(page.content.en) } : {}),
          attributes,
        },
      });
      id = c.pageCreate.page.id;
      log('页面', page.slug);
    }
    ids[page.slug] = id;

    // 页面标题/正文翻译
    for (const lang of ['zh', 'ja']) {
      await gql(`mutation($id: ID!, $lang: LanguageCodeEnum!, $input: PageTranslationInput!) {
        pageTranslate(id: $id, languageCode: $lang, input: $input) { errors { field message } }
      }`, {
        id, lang: LANGS[lang],
        input: { title: page.title[lang], ...(page.content ? { content: rich(page.content[lang]) } : {}) },
      });
    }

    // 纯文本属性值翻译
    const translatable = Object.entries(page.attrs).filter(([slug, v]) => data.pageAttributes[slug].translatable && typeof v === 'object');
    if (translatable.length) {
      const q = await gql(`query($slug: String!) {
        page(slug: $slug) { attributes { attribute { slug } values { id } } }
      }`, { slug: page.slug });
      for (const [slug, value] of translatable) {
        const valueId = q.page.attributes.find(a => a.attribute.slug === slug)?.values[0]?.id;
        if (!valueId) continue;
        for (const lang of ['zh', 'ja']) {
          await gql(`mutation($id: ID!, $lang: LanguageCodeEnum!, $input: AttributeValueTranslationInput!) {
            attributeValueTranslate(id: $id, languageCode: $lang, input: $input) { errors { field message } }
          }`, { id: valueId, lang: LANGS[lang], input: { name: value[lang], plainText: value[lang] } });
        }
      }
    }
  }
  return ids;
}

// ---------- 菜单 ----------

async function ensureMenus(categoryIds, pageIds) {
  for (const [slug, items] of Object.entries(data.menus)) {
    const d = await gql(`query($slug: String!) { menu(slug: $slug) { id items { id } } }`, { slug });
    let menu = d.menu;
    if (!menu) {
      const c = await gql(`mutation($input: MenuCreateInput!) {
        menuCreate(input: $input) { menu { id items { id } } errors { field message } }
      }`, { input: { name: slug, slug } });
      menu = c.menuCreate.menu;
    }
    if (menu.items?.length) continue; // 已经在后台配置过，不覆盖
    for (const item of items) {
      const c = await gql(`mutation($input: MenuItemCreateInput!) {
        menuItemCreate(input: $input) { menuItem { id } errors { field message } }
      }`, {
        input: {
          menu: menu.id, name: item.name.en,
          ...(item.category ? { category: categoryIds[item.category] } : {}),
          ...(item.page ? { page: pageIds[item.page] } : {}),
        },
      });
      for (const lang of ['zh', 'ja']) {
        await gql(`mutation($id: ID!, $lang: LanguageCodeEnum!, $input: NameTranslationInput!) {
          menuItemTranslate(id: $id, languageCode: $lang, input: $input) { errors { field message } }
        }`, { id: c.menuItemCreate.menuItem.id, lang: LANGS[lang], input: { name: item.name[lang] } });
      }
    }
    log('菜单', slug);
  }
}

async function main() {
  console.log(`Saleor API: ${API}`);
  await login();
  await ensureShopName();
  const warehouseId = await ensureWarehouse();
  const channels = await ensureChannels(warehouseId);
  await ensureShippingZone(channels, warehouseId);
  await enableDummyPayment(channels);
  const productType = await ensureProductType();
  const categoryIds = await ensureCategories();
  const productIds = await ensureProducts(productType, categoryIds, channels, warehouseId);
  await ensureFeaturedCollection(productIds, channels);
  const pageStructure = await ensurePageStructure();
  const pageIds = await ensurePages(pageStructure);
  await ensureMenus(categoryIds, pageIds);
  console.log('✓ 导入完成');
}

main().catch(e => {
  console.error('✗', e.message);
  process.exit(1);
});
