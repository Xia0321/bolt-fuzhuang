// 前台（Saleor Paper）需要的 Saleor 配置，可重复执行：
//   1. 内容模型：创建 Storefront — * 页面类型、属性和页面（首页、购物袋、结算等文案，见 content.mjs）。
//      已存在的页面不会被覆盖，运营在后台改过的文案保持不变。
//   2. 缓存刷新：创建 webhook（挂在 CONTENT_TOKEN 所属应用上），商品、分类、合集、页面、菜单、翻译变化时通知前台
//      <STOREFRONT_URL>/api/revalidate 刷新缓存（以 Authorization: Bearer <REVALIDATE_SECRET> 校验）。
//
// 环境变量：
//   SALEOR_API_URL         默认 http://127.0.0.1:8000/graphql/
//   CONTENT_TOKEN          应用令牌，需要「管理页面」「管理页面类型和属性」「管理翻译」「管理商品」「管理菜单」权限。
//                          webhook 挂在该应用上：Saleor 只把商品、菜单、页面、翻译事件发给有对应权限的应用
//   STOREFRONT_URL         前台公网地址，如 https://pinso.top
//   REVALIDATE_SECRET      前台刷新缓存的密钥
//
// 用法：node saleor/storefront/setup.mjs
// 不依赖任何 npm 包。

import { readFileSync } from 'node:fs';
import { MODELS } from './content.mjs';

const env = process.env;
const API_URL = env.SALEOR_API_URL || 'http://127.0.0.1:8000/graphql/';
const SCHEMA = JSON.parse(readFileSync(new URL('./schema.json', import.meta.url), 'utf8'));
const LANGUAGES = ['ZH_HANS', 'JA'];
const WEBHOOK_NAME = 'PINSO 前台缓存刷新';

async function gql(token, query, variables = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    // X-Forwarded-Proto：在服务器上经内网 HTTP 访问时，告知 Saleor 原始连接已是 HTTPS，避免被重定向
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Forwarded-Proto': 'https' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`Saleor 返回 ${res.status}`);
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join('; '));
  return json.data;
}

// mutation 返回的业务错误
function check(result, name) {
  const errors = result[name]?.errors ?? [];
  if (errors.length) throw new Error(`${name}: ${errors.map(e => `${e.field ?? ''} ${e.code ?? ''} ${e.message ?? ''}`.trim()).join('; ')}`);
  return result[name];
}

// ---------- 内容模型 ----------

async function ensureAttributes(token) {
  const slugs = SCHEMA.contentAttributes.map(a => a.slug);
  const data = await gql(token, `query($slugs: [String!]) {
    attributes(first: 100, filter: { slugs: $slugs, type: PAGE_TYPE }) { edges { node { id slug name inputType } } }
  }`, { slugs });
  const byName = new Map(data.attributes.edges.map(({ node }) => [node.name, node]));
  const bySlug = new Map(data.attributes.edges.map(({ node }) => [node.slug, node]));
  const result = new Map();
  for (const attr of SCHEMA.contentAttributes) {
    let node = bySlug.get(attr.slug) ?? byName.get(attr.name);
    if (!node) {
      const created = await gql(token, `mutation($input: AttributeCreateInput!) {
        attributeCreate(input: $input) { attribute { id slug name inputType } errors { field code message } }
      }`, {
        input: {
          name: attr.name,
          slug: attr.slug,
          type: 'PAGE_TYPE',
          inputType: attr.inputType,
          ...(attr.entityType ? { entityType: attr.entityType } : {}),
        },
      });
      node = check(created, 'attributeCreate').attribute;
      console.log(`  + 属性 ${attr.slug}`);
    }
    result.set(attr.name, node);
  }
  return result;
}

async function ensurePageTypes(token, attributes) {
  const result = new Map();
  for (const type of SCHEMA.modelTypes) {
    const attrIds = type.attributes.map(name => attributes.get(name).id);
    const data = await gql(token, `query($slug: String!) {
      pageTypes(first: 1, filter: { slugs: [$slug] }) { edges { node { id slug attributes { id } } } }
    }`, { slug: type.slug });
    let node = data.pageTypes.edges[0]?.node;
    if (!node) {
      const created = await gql(token, `mutation($input: PageTypeCreateInput!) {
        pageTypeCreate(input: $input) { pageType { id slug } errors { field code message } }
      }`, { input: { name: type.name, slug: type.slug, addAttributes: attrIds } });
      node = check(created, 'pageTypeCreate').pageType;
      console.log(`  + 模型类型 ${type.slug}`);
    } else {
      const have = new Set(node.attributes.map(a => a.id));
      const missing = attrIds.filter(id => !have.has(id));
      if (missing.length) {
        const updated = await gql(token, `mutation($id: ID!, $input: PageTypeUpdateInput!) {
          pageTypeUpdate(id: $id, input: $input) { pageType { id } errors { field code message } }
        }`, { id: node.id, input: { addAttributes: missing } });
        check(updated, 'pageTypeUpdate');
        console.log(`  ~ 模型类型 ${type.slug} 补充 ${missing.length} 个字段`);
      }
    }
    result.set(type.slug, node);
  }
  return result;
}

// 旧首页（home-hero 页面）上的图片地址，用作新首页大图
async function findPageImage(token, pageSlug) {
  const data = await gql(token, `query($slug: String!) {
    page(slug: $slug) { attributes { attribute { inputType } values { file { url contentType } } } }
  }`, { slug: pageSlug });
  for (const attr of data.page?.attributes ?? []) {
    if (attr.attribute.inputType !== 'FILE') continue;
    const file = attr.values[0]?.file;
    if (file?.url) return file;
  }
  return null;
}

async function attributeValueInput(token, attr, value) {
  switch (attr.inputType) {
    case 'NUMERIC':
      return { id: attr.id, numeric: String(value) };
    case 'BOOLEAN':
      return { id: attr.id, boolean: Boolean(value) };
    case 'SINGLE_REFERENCE': {
      const data = await gql(token, `query($slug: String!) { collection(slug: $slug) { id } }`, { slug: value.collection });
      if (!data.collection) {
        console.log(`  ! 未找到合集 ${value.collection}，首页精选区使用默认合集`);
        return null;
      }
      return { id: attr.id, reference: data.collection.id };
    }
    default:
      return { id: attr.id, plainText: String(value) };
  }
}

async function ensurePages(token, attributes, pageTypes) {
  for (const model of MODELS) {
    const existing = await gql(token, `query($slug: String!) { page(slug: $slug) { id } }`, { slug: model.slug });
    if (existing.page) {
      console.log(`  = ${model.slug} 已存在，保留后台中的内容`);
      continue;
    }

    const values = [];
    for (const [name, value] of Object.entries(model.attributes)) {
      const input = await attributeValueInput(token, attributes.get(name), value);
      if (input) values.push(input);
    }
    if (model.heroImageFromPage) {
      const file = await findPageImage(token, model.heroImageFromPage);
      if (file) values.push({ id: attributes.get('Hero image').id, file: file.url, contentType: file.contentType });
    }

    const created = await gql(token, `mutation($input: PageCreateInput!) {
      pageCreate(input: $input) {
        page { id attributes { attribute { name inputType } values { id } } }
        errors { field code message }
      }
    }`, {
      input: {
        title: model.title,
        slug: model.slug,
        pageType: pageTypes.get(model.modelType).id,
        isPublished: true,
        attributes: values,
      },
    });
    const page = check(created, 'pageCreate').page;
    console.log(`  + ${model.slug}`);

    // 文字字段的翻译挂在属性值上
    const valueIds = new Map(page.attributes.map(a => [a.attribute.name, a.values[0]?.id]));
    for (const language of LANGUAGES) {
      for (const [name, text] of Object.entries(model.translations?.[language] ?? {})) {
        const id = valueIds.get(name);
        if (!id) continue;
        const translated = await gql(token, `mutation($id: ID!, $languageCode: LanguageCodeEnum!, $input: AttributeValueTranslationInput!) {
          attributeValueTranslate(id: $id, languageCode: $languageCode, input: $input) { errors { field code message } }
        }`, { id, languageCode: language, input: { plainText: text } });
        check(translated, 'attributeValueTranslate');
      }
    }
  }
}

// ---------- 缓存刷新 webhook ----------

const PRODUCT_FIELDS = 'slug category { slug } collections { slug }';

// Paper 的 /api/revalidate 按 saleor-event 请求头判断事件类型，按负载中的 slug 刷新对应缓存。
// 对照 Saleor 全部事件整理（saleor/webhook/event_types.py），凡是影响前台显示的都订阅：
//   - 能定位到具体商品 / 分类 / 合集 / 页面 / 菜单的，负载带 slug，只刷新对应缓存
//   - 无法定位的（配送区域、仓库、渠道影响能否购买，促销影响价格，配送价格影响免运费门槛，
//     属性值影响颜色名称和色块，商品图片负载只有商品 ID），前台刷新全部缓存（补丁 0005 的 FULL_PURGE_EVENTS）
// 不订阅：优惠码（只在结算时用，结算不缓存）、订单、顾客等与页面缓存无关的事件
const VARIANT_PRODUCT = `productVariant { product { ${PRODUCT_FIELDS} } }`;
const FULL_PURGE = '__typename';
// 以下三个事件的 productVariant 是非空类型，与其他事件的同名字段冲突，用别名 variant（前台同样识别）
const VARIANT_PRODUCT_NON_NULL = `variant: productVariant { product { ${PRODUCT_FIELDS} } }`;
const WEBHOOK_EVENTS = {
  // 商品、规格（含上下架、价格：规格的渠道价格修改会触发 ProductVariantUpdated）
  ProductCreated: `product { ${PRODUCT_FIELDS} }`,
  ProductUpdated: `product { ${PRODUCT_FIELDS} }`,
  ProductDeleted: `product { ${PRODUCT_FIELDS} }`,
  ProductMetadataUpdated: `product { ${PRODUCT_FIELDS} }`,
  ProductVariantCreated: VARIANT_PRODUCT,
  ProductVariantUpdated: VARIANT_PRODUCT,
  ProductVariantDeleted: VARIANT_PRODUCT,
  ProductVariantMetadataUpdated: VARIANT_PRODUCT,
  ProductVariantDiscountedPriceUpdated: VARIANT_PRODUCT_NON_NULL,
  // 库存（后台改数量、下单后售罄、补货）
  ProductVariantStockUpdated: VARIANT_PRODUCT,
  ProductVariantOutOfStock: VARIANT_PRODUCT,
  ProductVariantBackInStock: VARIANT_PRODUCT,
  ProductVariantOutOfStockInChannel: VARIANT_PRODUCT_NON_NULL,
  ProductVariantBackInStockInChannel: VARIANT_PRODUCT_NON_NULL,
  // 商品图片：负载只有商品 ID，刷新全部
  ProductMediaCreated: FULL_PURGE,
  ProductMediaUpdated: FULL_PURGE,
  ProductMediaDeleted: FULL_PURGE,
  // 分类、合集、页面（含首页等文案模型）、菜单
  CategoryCreated: 'category { slug }',
  CategoryUpdated: 'category { slug }',
  CategoryDeleted: 'category { slug }',
  CollectionCreated: 'collection { slug }',
  CollectionUpdated: 'collection { slug }',
  CollectionDeleted: 'collection { slug }',
  CollectionMetadataUpdated: 'collection { slug }',
  PageCreated: 'page { slug }',
  PageUpdated: 'page { slug }',
  PageDeleted: 'page { slug }',
  MenuCreated: 'menu { slug }',
  MenuUpdated: 'menu { slug }',
  MenuDeleted: 'menu { slug }',
  MenuItemCreated: 'menuItem { menu { slug } }',
  MenuItemUpdated: 'menuItem { menu { slug } }',
  MenuItemDeleted: 'menuItem { menu { slug } }',
  // 翻译：商品、分类、合集、页面按 slug 刷新，其他（菜单项、属性值、规格等）刷新全部
  TranslationCreated: 'translation { ...PinsoTranslation }',
  TranslationUpdated: 'translation { ...PinsoTranslation }',
  // 能否购买：配送区域、仓库、渠道
  ShippingZoneCreated: FULL_PURGE,
  ShippingZoneUpdated: FULL_PURGE,
  ShippingZoneDeleted: FULL_PURGE,
  WarehouseCreated: FULL_PURGE,
  WarehouseUpdated: FULL_PURGE,
  WarehouseDeleted: FULL_PURGE,
  ChannelCreated: FULL_PURGE,
  ChannelUpdated: FULL_PURGE,
  ChannelDeleted: FULL_PURGE,
  ChannelStatusChanged: FULL_PURGE,
  // 免运费门槛（前台从配送方式读取）
  ShippingPriceCreated: FULL_PURGE,
  ShippingPriceUpdated: FULL_PURGE,
  ShippingPriceDeleted: FULL_PURGE,
  // 价格：促销活动（含旧版 Sale）
  PromotionCreated: FULL_PURGE,
  PromotionUpdated: FULL_PURGE,
  PromotionDeleted: FULL_PURGE,
  PromotionStarted: FULL_PURGE,
  PromotionEnded: FULL_PURGE,
  PromotionRuleCreated: FULL_PURGE,
  PromotionRuleUpdated: FULL_PURGE,
  PromotionRuleDeleted: FULL_PURGE,
  SaleCreated: FULL_PURGE,
  SaleUpdated: FULL_PURGE,
  SaleDeleted: FULL_PURGE,
  SaleToggle: FULL_PURGE,
  // 属性与属性值（颜色名称、色块等）
  AttributeCreated: FULL_PURGE,
  AttributeUpdated: FULL_PURGE,
  AttributeDeleted: FULL_PURGE,
  AttributeValueCreated: FULL_PURGE,
  AttributeValueUpdated: FULL_PURGE,
  AttributeValueDeleted: FULL_PURGE,
};

const WEBHOOK_QUERY = `subscription {
  event {
${Object.entries(WEBHOOK_EVENTS).map(([type, fields]) => `    ... on ${type} { ${fields} }`).join('\n')}
  }
}

# 翻译负载里没有所属对象，用别名拼成前台识别的形状（translation.product.slug 等）；
# 菜单项、属性值（内容模型文案）的翻译由前台按 __typename 刷新全部菜单 / 全部文案
fragment PinsoTranslation on TranslationTypes {
  __typename
  ... on ProductTranslation { product: translatableContent { slug } }
  ... on CategoryTranslation { category: translatableContent { slug } }
  ... on CollectionTranslation { collection: translatableContent { slug } }
  ... on PageTranslation { page: translatableContent { slug } }
}`;

async function ensureWebhook(token) {
  const targetUrl = `${env.STOREFRONT_URL.replace(/\/$/, '')}/api/revalidate`;
  const input = {
    name: WEBHOOK_NAME,
    targetUrl,
    isActive: true,
    query: WEBHOOK_QUERY,
    asyncEvents: Object.keys(WEBHOOK_EVENTS).map(type => type.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()),
    customHeaders: JSON.stringify({ Authorization: `Bearer ${env.REVALIDATE_SECRET}` }),
  };
  const data = await gql(token, `{ app { id webhooks { id name } } }`);
  const existing = data.app.webhooks.find(w => w.name === WEBHOOK_NAME);
  if (existing) {
    check(await gql(token, `mutation($id: ID!, $input: WebhookUpdateInput!) {
      webhookUpdate(id: $id, input: $input) { webhook { id } errors { field code message } }
    }`, { id: existing.id, input }), 'webhookUpdate');
    console.log(`  = webhook 已更新 → ${targetUrl}`);
  } else {
    check(await gql(token, `mutation($input: WebhookCreateInput!) {
      webhookCreate(input: $input) { webhook { id } errors { field code message } }
    }`, { input }), 'webhookCreate');
    console.log(`  + webhook → ${targetUrl}`);
  }
}

// ---------- 入口 ----------

// 先建 webhook：之后新建的内容页面会通知前台刷新缓存
if (env.CONTENT_TOKEN && env.STOREFRONT_URL && env.REVALIDATE_SECRET) {
  console.log('前台缓存刷新：');
  await ensureWebhook(env.CONTENT_TOKEN);
} else {
  console.log('未设置 CONTENT_TOKEN / STOREFRONT_URL / REVALIDATE_SECRET，跳过 webhook');
}

if (env.CONTENT_TOKEN) {
  console.log('前台内容模型：');
  const attributes = await ensureAttributes(env.CONTENT_TOKEN);
  const pageTypes = await ensurePageTypes(env.CONTENT_TOKEN, attributes);
  await ensurePages(env.CONTENT_TOKEN, attributes, pageTypes);
} else {
  console.log('未设置 CONTENT_TOKEN，跳过内容模型');
}
