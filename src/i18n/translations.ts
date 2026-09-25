import type { Locale } from '@/types';

export const locales: Locale[] = ['zh', 'en', 'ja'];

export const localeLabels: Record<Locale, string> = {
  zh: '中文',
  en: 'EN',
  ja: '日本語',
};

export const currencySymbol: Record<Locale, string> = {
  zh: '¥',
  en: '¥',
  ja: '¥',
};

type Dict = Record<string, Record<Locale, string>>;

export const t: Dict = {
  // Nav
  nav_home: { zh: '首页', en: 'Home', ja: 'ホーム' },
  nav_shop: { zh: '全部商品', en: 'Shop All', ja: 'すべての商品' },
  nav_outerwear: { zh: '外套', en: 'Outerwear', ja: 'アウター' },
  nav_knitwear: { zh: '针织', en: 'Knitwear', ja: 'ニット' },
  nav_dresses: { zh: '裙装', en: 'Dresses', ja: 'ドレス' },
  nav_accessories: { zh: '配饰', en: 'Accessories', ja: 'アクセサリー' },
  nav_about: { zh: '品牌故事', en: 'About', ja: 'ブランドについて' },
  nav_cart: { zh: '购物袋', en: 'Bag', ja: 'カート' },

  // Hero
  hero_eyebrow: { zh: '2026 秋冬系列', en: 'Autumn / Winter 2026', ja: '2026 秋冬コレクション' },
  hero_title: { zh: '以织物书写的诗意', en: 'Poetry Woven in Fabric', ja: '織物が紡ぐ詩' },
  hero_subtitle: { zh: '从面料到剪裁，每一件单品都是对品质与永恒风格的承诺。', en: 'From fabric to silhouette, every piece is a commitment to quality and timeless style.', ja: '生地からシルエットまで、すべてのアイテムは品質と時代を超えるスタイルへの約束。' },
  hero_cta: { zh: '探索系列', en: 'Explore the Collection', ja: 'コレクションを見る' },

  // Sections
  section_featured: { zh: '精选单品', en: 'Featured Pieces', ja: 'おすすめアイテム' },
  section_featured_sub: { zh: '本季编辑甄选', en: 'Editor\u2019s picks this season', ja: '今季の編集セレクション' },
  section_categories: { zh: '品类导览', en: 'Shop by Category', ja: 'カテゴリーから選ぶ' },
  section_categories_sub: { zh: '找到属于你的风格语言', en: 'Find your style vocabulary', ja: 'あなたのスタイルを見つける' },
  section_lookbook: { zh: '造型画册', en: 'Lookbook', ja: 'ルックブック' },
  section_lookbook_sub: { zh: '本季搭配灵感', en: 'Styling inspiration this season', ja: '今季のスタイリング灵感' },
  section_values: { zh: '品牌承诺', en: 'Our Promise', ja: 'ブランドの約束' },

  // Product card
  product_view: { zh: '查看详情', en: 'View Details', ja: '詳細を見る' },
  product_add: { zh: '加入购物袋', en: 'Add to Bag', ja: 'カートに追加' },
  product_new: { zh: '新品', en: 'New', ja: '新作' },

  // Shop page
  shop_title: { zh: '全部商品', en: 'Shop All', ja: 'すべての商品' },
  shop_all: { zh: '全部', en: 'All', ja: 'すべて' },
  shop_sort: { zh: '排序', en: 'Sort', ja: '並び替え' },
  sort_featured: { zh: '推荐', en: 'Featured', ja: 'おすすめ' },
  sort_price_low: { zh: '价格从低到高', en: 'Price: Low to High', ja: '価格が低い順' },
  sort_price_high: { zh: '价格从高到低', en: 'Price: High to Low', ja: '価格が高い順' },
  shop_no_results: { zh: '暂无商品', en: 'No products found', ja: '商品が見つかりません' },
  shop_results: { zh: '件商品', en: 'items', ja: '件' },

  // Product detail
  detail_description: { zh: '商品描述', en: 'Description', ja: '商品説明' },
  detail_size: { zh: '尺码', en: 'Size', ja: 'サイズ' },
  detail_color: { zh: '颜色', en: 'Color', ja: 'カラー' },
  detail_quantity: { zh: '数量', en: 'Quantity', ja: '数量' },
  detail_add_cart: { zh: '加入购物袋', en: 'Add to Bag', ja: 'カートに追加' },
  detail_select_size: { zh: '请选择尺码', en: 'Please select a size', ja: 'サイズを選択してください' },
  detail_select_color: { zh: '请选择颜色', en: 'Please select a color', ja: 'カラーを選択してください' },
  detail_added: { zh: '已加入购物袋', en: 'Added to bag', ja: 'カートに追加しました' },
  detail_related: { zh: '你可能还喜欢', en: 'You May Also Like', ja: 'こちらもおすすめ' },
  detail_back: { zh: '返回商品列表', en: 'Back to shop', ja: '商品一覧に戻る' },

  // Cart
  cart_title: { zh: '购物袋', en: 'Shopping Bag', ja: 'ショッピングカート' },
  cart_empty: { zh: '您的购物袋是空的', en: 'Your bag is empty', ja: 'カートは空です' },
  cart_continue: { zh: '继续购物', en: 'Continue Shopping', ja: '買い物を続ける' },
  cart_subtotal: { zh: '小计', en: 'Subtotal', ja: '小計' },
  cart_shipping: { zh: '运费', en: 'Shipping', ja: '送料' },
  cart_free: { zh: '免运费', en: 'Free', ja: '無料' },
  cart_total: { zh: '总计', en: 'Total', ja: '合計' },
  cart_checkout: { zh: '结算', en: 'Checkout', ja: 'ご購入手続き' },
  cart_remove: { zh: '移除', en: 'Remove', ja: '削除' },
  cart_size: { zh: '尺码', en: 'Size', ja: 'サイズ' },
  cart_color: { zh: '颜色', en: 'Color', ja: 'カラー' },

  // About
  about_title: { zh: '品牌故事', en: 'Our Story', ja: 'ブランドストーリー' },
  about_subtitle: { zh: '源于对美的执着', en: 'Born from a pursuit of beauty', ja: '美へのこだわりから生まれた' },
  about_p1: { zh: '我们相信，衣物不仅是遮体的工具，更是个人风格与内在气质的延伸。每一件单品，从面料甄选到最终缝制，都凝聚着匠人的心血与对完美的追求。', en: 'We believe clothing is not merely a covering but an extension of personal style and inner character. Every piece — from fabric selection to final stitch — embodies the dedication of artisans and a pursuit of perfection.', ja: '衣服は単なる身を包むものではなく、個人のスタイルと内面の延長であると信じています。生地の選定から最後の縫製まで、すべてのアイテムに職人の情熱と完璧への追求が込められています。' },
  about_p2: { zh: '我们坚持使用天然纤维与环保工艺，以减少对环境的影响。经典而不追逐潮流，是我们对永恒风格的理解。', en: 'We insist on natural fibers and eco-conscious craftsmanship to minimize environmental impact. Classic, not trend-chasing — that is our understanding of timeless style.', ja: '天然繊維と環境に配慮した工芸を徹底し、環境への影響を最小限に。トレンドを追うのではなく、クラシックであること。それが私たちの時代を超えるスタイルの理解です。' },
  about_stat1: { zh: '天然面料', en: 'Natural Fabrics', ja: '天然素材' },
  about_stat1_val: { zh: '100%', en: '100%', ja: '100%' },
  about_stat2: { zh: '手工工艺', en: 'Handcrafted', ja: '手仕事' },
  about_stat2_val: { zh: '匠心', en: 'Artisan', ja: '職人技' },
  about_stat3: { zh: '环保承诺', en: 'Eco Pledge', ja: 'エコ誓約' },
  about_stat3_val: { zh: '可持续', en: 'Sustainable', ja: 'サステナブル' },

  // Values
  value1_title: { zh: '甄选面料', en: 'Curated Fabrics', ja: '厳選素材' },
  value1_desc: { zh: '全球甄选顶级天然纤维，触感与耐久兼备。', en: 'Premium natural fibers sourced globally for touch and durability.', ja: '世界中から厳選した最高級の天然繊維。肌触りと耐久性を両立。' },
  value2_title: { zh: '匠人手作', en: 'Artisan Craft', ja: '職人技' },
  value2_desc: { zh: '每一件单品经匠人之手，注重每个细节。', en: 'Every piece passes through artisan hands, attentive to every detail.', ja: 'すべてのアイテムは職人の手を経て、細部までこだわります。' },
  value3_title: { zh: '永恒风格', en: 'Timeless Style', ja: '時代を超えるスタイル' },
  value3_desc: { zh: '不追逐潮流，只创造经得起时间考验的经典。', en: 'We do not chase trends — we create classics that endure.', ja: 'トレンドを追わず、時を経ても色褪せないクラシックを。' },
  value4_title: { zh: '环保理念', en: 'Eco Conscious', ja: '環境配慮' },
  value4_desc: { zh: '可持续工艺与环保包装，减少地球负担。', en: 'Sustainable craftsmanship and eco packaging to lighten our footprint.', ja: 'サステナブルな工芸と環境配慮したパッケージで、地球に優しく。' },

  // Footer
  footer_tagline: { zh: '以织物书写的诗意', en: 'Poetry Woven in Fabric', ja: '織物が紡ぐ詩' },
  footer_shop: { zh: '购物', en: 'Shop', ja: 'ショッピング' },
  footer_about: { zh: '品牌', en: 'Brand', ja: 'ブランド' },
  footer_contact: { zh: '联系', en: 'Contact', ja: 'お問い合わせ' },
  footer_email: { zh: '电子邮件', en: 'Email', ja: 'メール' },
  footer_follow: { zh: '关注我们', en: 'Follow Us', ja: 'フォロー' },
  footer_rights: { zh: '保留所有权利', en: 'All rights reserved.', ja: 'All rights reserved.' },
  footer_privacy: { zh: '隐私政策', en: 'Privacy Policy', ja: 'プライバシーポリシー' },
  footer_terms: { zh: '服务条款', en: 'Terms of Service', ja: '利用規約' },
  footer_shipping: { zh: '配送信息', en: 'Shipping Info', ja: '配送情報' },
  footer_returns: { zh: '退换政策', en: 'Returns', ja: '返品ポリシー' },

  // Misc
  loading: { zh: '加载中...', en: 'Loading...', ja: '読み込み中...' },
  error_load: { zh: '加载失败，请刷新重试', en: 'Failed to load. Please refresh.', ja: '読み込みに失敗しました。更新してください。' },
  size_chart: { zh: '尺码表', en: 'Size Chart', ja: 'サイズ表' },
  free_ship_note: { zh: '满 ¥999 免运费', en: 'Free shipping over ¥999', ja: '¥999以上で送料無料' },
};

export function tr(key: string, locale: Locale): string {
  const entry = t[key];
  if (!entry) return key;
  return entry[locale] || entry.en;
}

export function localized(text: { zh: string; en: string; ja: string } | null | undefined, locale: Locale): string {
  if (!text) return '';
  return text[locale] || text.en || text.zh;
}

export function formatPrice(price: number, locale: Locale): string {
  const symbol = currencySymbol[locale];
  return `${symbol}${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
