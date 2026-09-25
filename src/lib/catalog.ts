import { saleorFetch, richTextToParagraphs } from '@/lib/saleor';
import type {
  Banner, Category, ContentPage, Feature, MenuLink, Money, Product, ProductColor, ShippingRule, SiteSettings, StoreData,
} from '@/types';

// 小品牌商品量不大，一次取全量，页面切换无需再请求。商品超过 100 件时需要改成分页
const STORE_QUERY = /* GraphQL */ `
  query Store($channel: String!, $lang: LanguageCodeEnum!) {
    products(first: 100, channel: $channel, sortBy: { field: CREATED_AT, direction: DESC }) {
      edges {
        node {
          id slug name description isAvailableForPurchase
          translation(languageCode: $lang) { name description }
          category { id }
          collections { slug }
          media { url(size: 1024) type }
          pricing { priceRange { start { gross { amount currency } } } }
          variants {
            id quantityAvailable
            pricing { price { gross { amount currency } } }
            attributes {
              attribute { slug }
              values { slug name value translation(languageCode: $lang) { name } }
            }
          }
        }
      }
    }
    categories(first: 100) {
      edges {
        node {
          id slug name description
          backgroundImage(size: 1024) { url }
          translation(languageCode: $lang) { name description }
        }
      }
    }
    navbar: menu(slug: "navbar", channel: $channel) { items { ...MenuItemFields } }
    footer: menu(slug: "footer", channel: $channel) { items { ...MenuItemFields } }
    footerLegal: menu(slug: "footer-legal", channel: $channel) { items { ...MenuItemFields } }
    pages(first: 100) {
      edges {
        node {
          slug title content
          pageType { slug }
          translation(languageCode: $lang) { title content }
          attributes {
            attribute { slug }
            values { name slug plainText file { url } translation(languageCode: $lang) { name plainText } }
          }
        }
      }
    }
    shop {
      availableShippingMethods(channel: $channel) {
        name
        price { amount currency }
        minimumOrderPrice { amount }
        maximumOrderPrice { amount }
      }
    }
  }

  fragment MenuItemFields on MenuItem {
    id name url
    translation(languageCode: $lang) { name }
    category { id slug name description backgroundImage(size: 1024) { url } translation(languageCode: $lang) { name description } }
    page { slug }
  }
`;

interface Translated { name?: string | null; description?: string | null }
interface RawCategory {
  id: string; slug: string; name: string; description: string | null;
  backgroundImage: { url: string } | null;
  translation: Translated | null;
}
interface RawAttributeValue {
  slug: string; name: string | null; value?: string | null; plainText?: string | null;
  file?: { url: string } | null;
  translation: { name?: string | null; plainText?: string | null } | null;
}
interface RawAttribute { attribute: { slug: string }; values: RawAttributeValue[] }
interface RawMenuItem {
  id: string; name: string; url: string | null;
  translation: { name: string } | null;
  category: RawCategory | null;
  page: { slug: string } | null;
}
interface RawProduct {
  id: string; slug: string; name: string; description: string | null; isAvailableForPurchase: boolean | null;
  translation: Translated | null;
  category: { id: string } | null;
  collections: { slug: string }[] | null;
  media: { url: string; type: string }[] | null;
  pricing: { priceRange: { start: { gross: Money } | null } | null } | null;
  variants: {
    id: string; quantityAvailable: number | null;
    pricing: { price: { gross: Money } | null } | null;
    attributes: RawAttribute[];
  }[] | null;
}
interface RawPage {
  slug: string; title: string; content: string | null;
  pageType: { slug: string };
  translation: { title?: string | null; content?: string | null } | null;
  attributes: RawAttribute[];
}
interface StoreResponse {
  products: { edges: { node: RawProduct }[] };
  categories: { edges: { node: RawCategory }[] };
  navbar: { items: RawMenuItem[] } | null;
  footer: { items: RawMenuItem[] } | null;
  footerLegal: { items: RawMenuItem[] } | null;
  pages: { edges: { node: RawPage }[] };
  shop: {
    availableShippingMethods: {
      name: string; price: Money;
      minimumOrderPrice: { amount: number } | null;
      maximumOrderPrice: { amount: number } | null;
    }[] | null;
  };
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'ONE SIZE'];

const firstParagraph = (json: string | null | undefined) => richTextToParagraphs(json).join(' ');

function mapCategory(c: RawCategory): Category {
  return {
    id: c.id,
    slug: c.slug,
    name: c.translation?.name || c.name,
    description: firstParagraph(c.translation?.description) || firstParagraph(c.description),
    imageUrl: c.backgroundImage?.url ?? null,
  };
}

const valueName = (v: RawAttributeValue) => v.translation?.name || v.name || '';
const valueText = (v: RawAttributeValue) => v.translation?.plainText || v.plainText || v.translation?.name || v.name || '';

function attrMap(attributes: RawAttribute[]) {
  const map: Record<string, RawAttributeValue | undefined> = {};
  for (const a of attributes) map[a.attribute.slug] = a.values[0];
  return map;
}

function mapProduct(p: RawProduct): Product {
  const rawVariants = (p.variants || []).map(v => ({ raw: v, attrs: attrMap(v.attributes) }));
  const variants = rawVariants.map(({ raw, attrs }) => ({
    id: raw.id,
    size: attrs.size ? valueName(attrs.size) : null,
    colorSlug: attrs.color?.slug ?? null,
    price: raw.pricing?.price?.gross ?? null,
    quantityAvailable: raw.quantityAvailable ?? 0,
  }));

  const colors: ProductColor[] = [];
  const sizes: string[] = [];
  for (const { attrs } of rawVariants) {
    const color = attrs.color;
    if (color && !colors.some(c => c.slug === color.slug)) {
      colors.push({ slug: color.slug, name: valueName(color), hex: color.value || '#cccccc' });
    }
  }
  for (const v of variants) {
    if (v.size && !sizes.includes(v.size)) sizes.push(v.size);
  }
  sizes.sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.toUpperCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return {
    id: p.id,
    slug: p.slug,
    name: p.translation?.name || p.name,
    description: richTextToParagraphs(p.translation?.description).join('\n\n') || richTextToParagraphs(p.description).join('\n\n'),
    categoryId: p.category?.id ?? null,
    images: (p.media || []).filter(m => m.type === 'IMAGE').map(m => m.url),
    price: p.pricing?.priceRange?.start?.gross ?? null,
    sizes,
    colors,
    variants,
    featured: (p.collections || []).some(c => c.slug === 'featured'),
    isAvailable: !!p.isAvailableForPurchase && variants.some(v => v.quantityAvailable > 0),
  };
}

function menuItemUrl(item: RawMenuItem): string {
  if (item.category) return `/shop/${item.category.slug}`;
  if (item.page) return item.page.slug === 'about' ? '/about' : `/pages/${item.page.slug}`;
  return item.url || '/';
}

function mapMenu(menu: { items: RawMenuItem[] } | null): MenuLink[] {
  return (menu?.items || []).map(item => ({
    id: item.id,
    name: item.translation?.name || item.name,
    url: menuItemUrl(item),
    category: item.category ? mapCategory(item.category) : null,
  }));
}

function translatedParagraphs(page: RawPage): string[] {
  const translated = richTextToParagraphs(page.translation?.content);
  return translated.length ? translated : richTextToParagraphs(page.content);
}

function mapBanner(page: RawPage): Banner {
  const a = attrMap(page.attributes);
  const text = (slug: string) => (a[slug] ? valueText(a[slug]!) : '');
  return {
    title: page.translation?.title || page.title,
    eyebrow: text('eyebrow'),
    subtitle: text('subtitle'),
    buttonText: text('button-text'),
    buttonLink: text('button-link'),
    imageUrl: a.image?.file?.url ?? null,
    paragraphs: translatedParagraphs(page),
  };
}

function mapFeature(page: RawPage): Feature {
  const a = attrMap(page.attributes);
  const text = (slug: string) => (a[slug] ? valueText(a[slug]!) : '');
  return {
    title: page.translation?.title || page.title,
    subtitle: text('subtitle'),
    value: text('value'),
    icon: a.icon?.slug || '',
    placement: a.placement?.slug || '',
    sortOrder: Number(a['sort-order']?.name) || 0,
  };
}

function mapSite(page: RawPage | undefined): SiteSettings {
  const a = page ? attrMap(page.attributes) : {};
  const text = (slug: string) => (a[slug] ? valueText(a[slug]!) : '');
  return {
    brandName: text('brand-name'),
    tagline: text('tagline'),
    contactEmail: text('contact-email'),
    contactPhone: text('contact-phone'),
    contactAddress: text('contact-address'),
    instagramUrl: text('instagram-url'),
    faviconUrl: a.favicon?.file?.url ?? null,
  };
}

export async function loadStore(channel: string, languageCode: string): Promise<StoreData> {
  const data = await saleorFetch<StoreResponse>(STORE_QUERY, { channel, lang: languageCode });

  const pages = data.pages.edges.map(e => e.node);
  const banners: Record<string, Banner> = {};
  const contentPages: Record<string, ContentPage> = {};
  const features: Feature[] = [];
  for (const page of pages) {
    const type = page.pageType.slug;
    if (type === 'banner') banners[page.slug] = mapBanner(page);
    if (type === 'feature') features.push(mapFeature(page));
    if (type === 'content') {
      contentPages[page.slug] = { slug: page.slug, title: page.translation?.title || page.title, paragraphs: translatedParagraphs(page) };
    }
  }
  features.sort((a, b) => a.sortOrder - b.sortOrder);

  const shippingRules: ShippingRule[] = (data.shop.availableShippingMethods || []).map(m => ({
    name: m.name,
    price: m.price,
    minimumOrderPrice: m.minimumOrderPrice?.amount ?? 0,
    maximumOrderPrice: m.maximumOrderPrice?.amount ?? null,
  }));

  const navbar = mapMenu(data.navbar);
  const products = data.products.edges.map(e => mapProduct(e.node));
  // 只展示当前渠道下有商品的分类（Saleor 自带的 default-category 等空分类不显示）
  const allCategories = data.categories.edges
    .map(e => mapCategory(e.node))
    .filter(c => products.some(p => p.categoryId === c.id));
  // 分类的展示顺序跟随后台的 navbar 菜单；菜单里没有的分类排在后面
  const menuOrder = navbar.filter(l => l.category).map(l => l.category!.slug);
  const categories = [...allCategories].sort((a, b) => {
    const ia = menuOrder.indexOf(a.slug);
    const ib = menuOrder.indexOf(b.slug);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return {
    site: mapSite(pages.find(p => p.slug === 'site-settings')),
    categories,
    products,
    navbar,
    footer: mapMenu(data.footer),
    footerLegal: mapMenu(data.footerLegal),
    banners,
    features,
    pages: contentPages,
    shippingRules,
  };
}

// 按订单小计估算运费：取当前金额下可用的最便宜配送方式
export function estimateShipping(rules: ShippingRule[], subtotal: number): Money | null {
  const applicable = rules.filter(r =>
    subtotal >= r.minimumOrderPrice && (r.maximumOrderPrice == null || subtotal <= r.maximumOrderPrice));
  if (!applicable.length) return null;
  return applicable.reduce((min, r) => (r.price.amount < min.price.amount ? r : min)).price;
}

// 免运费门槛：价格为 0 的配送方式的最低订单金额
export function freeShippingThreshold(rules: ShippingRule[]): number | null {
  const free = rules.filter(r => r.price.amount === 0);
  if (!free.length) return null;
  return Math.min(...free.map(r => r.minimumOrderPrice));
}
