import type { Locale, Money } from '@/types';

// 这里只放界面固定文案（按钮、提示等）。
// 品牌名、首页横幅、品牌故事、分类、商品、菜单等内容都在 Saleor 后台配置。

export const locales: Locale[] = ['zh', 'en', 'ja'];

export const localeLabels: Record<Locale, string> = {
  zh: '中文',
  en: 'EN',
  ja: '日本語',
};

const intlLocale: Record<Locale, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
};

type Dict = Record<string, Record<Locale, string>>;

export const t: Dict = {
  // Nav
  nav_home: { zh: '首页', en: 'Home', ja: 'ホーム' },
  nav_shop: { zh: '全部商品', en: 'Shop All', ja: 'すべての商品' },
  nav_cart: { zh: '购物袋', en: 'Bag', ja: 'カート' },
  nav_language: { zh: '语言', en: 'Language', ja: '言語' },
  nav_currency: { zh: '币种', en: 'Currency', ja: '通貨' },

  // Sections
  section_featured: { zh: '精选单品', en: 'Featured Pieces', ja: 'おすすめアイテム' },
  section_featured_sub: { zh: '本季编辑甄选', en: 'Editor’s picks this season', ja: '今季の編集セレクション' },
  section_categories: { zh: '品类导览', en: 'Shop by Category', ja: 'カテゴリーから選ぶ' },
  section_categories_sub: { zh: '找到属于你的风格语言', en: 'Find your style vocabulary', ja: 'あなたのスタイルを見つける' },
  section_values: { zh: '品牌承诺', en: 'Our Promise', ja: 'ブランドの約束' },

  // Product card
  product_view: { zh: '查看详情', en: 'View Details', ja: '詳細を見る' },
  product_new: { zh: '精选', en: 'Featured', ja: 'おすすめ' },
  product_sold_out: { zh: '售罄', en: 'Sold Out', ja: '完売' },

  // Shop page
  shop_title: { zh: '全部商品', en: 'Shop All', ja: 'すべての商品' },
  shop_all: { zh: '全部', en: 'All', ja: 'すべて' },
  sort_newest: { zh: '最新上架', en: 'Newest', ja: '新着順' },
  sort_price_low: { zh: '价格从低到高', en: 'Price: Low to High', ja: '価格が低い順' },
  sort_price_high: { zh: '价格从高到低', en: 'Price: High to Low', ja: '価格が高い順' },
  shop_no_results: { zh: '暂无商品', en: 'No products found', ja: '商品が見つかりません' },
  shop_results: { zh: '件商品', en: 'items', ja: '件' },

  // Product detail
  detail_size: { zh: '尺码', en: 'Size', ja: 'サイズ' },
  detail_color: { zh: '颜色', en: 'Color', ja: 'カラー' },
  detail_quantity: { zh: '数量', en: 'Quantity', ja: '数量' },
  detail_add_cart: { zh: '加入购物袋', en: 'Add to Bag', ja: 'カートに追加' },
  detail_adding: { zh: '正在加入…', en: 'Adding…', ja: '追加中…' },
  detail_select_size: { zh: '请选择尺码', en: 'Please select a size', ja: 'サイズを選択してください' },
  detail_added: { zh: '已加入购物袋', en: 'Added to bag', ja: 'カートに追加しました' },
  detail_related: { zh: '你可能还喜欢', en: 'You May Also Like', ja: 'こちらもおすすめ' },
  detail_back: { zh: '返回商品列表', en: 'Back to shop', ja: '商品一覧に戻る' },
  detail_not_found: { zh: '商品不存在或已下架', en: 'This product is unavailable', ja: 'この商品は現在お取り扱いがありません' },
  detail_low_stock: { zh: '仅剩 {n} 件', en: 'Only {n} left', ja: '残り{n}点' },

  // Cart
  cart_title: { zh: '购物袋', en: 'Shopping Bag', ja: 'ショッピングカート' },
  cart_empty: { zh: '您的购物袋是空的', en: 'Your bag is empty', ja: 'カートは空です' },
  cart_continue: { zh: '继续购物', en: 'Continue Shopping', ja: '買い物を続ける' },
  cart_subtotal: { zh: '小计', en: 'Subtotal', ja: '小計' },
  cart_shipping: { zh: '运费', en: 'Shipping', ja: '送料' },
  cart_shipping_estimate: { zh: '运费（预估）', en: 'Shipping (estimated)', ja: '送料（目安）' },
  cart_free: { zh: '免运费', en: 'Free', ja: '無料' },
  cart_total: { zh: '总计', en: 'Total', ja: '合計' },
  cart_checkout: { zh: '结算', en: 'Checkout', ja: 'ご購入手続き' },
  cart_remove: { zh: '移除', en: 'Remove', ja: '削除' },
  cart_size: { zh: '尺码', en: 'Size', ja: 'サイズ' },
  cart_color: { zh: '颜色', en: 'Color', ja: 'カラー' },
  free_ship_remaining: { zh: '再购 {amount} 即可免运费', en: 'Add {amount} more for free shipping', ja: 'あと{amount}で送料無料' },
  free_ship_over: { zh: '满 {amount} 免运费', en: 'Free shipping over {amount}', ja: '{amount}以上で送料無料' },

  // Checkout
  checkout_title: { zh: '结算', en: 'Checkout', ja: 'ご購入手続き' },
  checkout_contact: { zh: '联系方式', en: 'Contact', ja: '連絡先' },
  checkout_email: { zh: '电子邮箱', en: 'Email', ja: 'メールアドレス' },
  checkout_address: { zh: '收货地址', en: 'Shipping Address', ja: 'お届け先' },
  checkout_first_name: { zh: '名', en: 'First name', ja: '名' },
  checkout_last_name: { zh: '姓', en: 'Last name', ja: '姓' },
  checkout_country: { zh: '国家/地区', en: 'Country / Region', ja: '国・地域' },
  checkout_country_area: { zh: '省/州', en: 'State / Province', ja: '都道府県' },
  checkout_city: { zh: '城市', en: 'City', ja: '市区町村' },
  checkout_city_area: { zh: '区/县', en: 'District', ja: '地区' },
  checkout_street1: { zh: '详细地址', en: 'Address', ja: '番地' },
  checkout_street2: { zh: '门牌号、楼层等（选填）', en: 'Apartment, suite, etc. (optional)', ja: '建物名・部屋番号（任意）' },
  checkout_postal_code: { zh: '邮政编码', en: 'Postal code', ja: '郵便番号' },
  checkout_phone: { zh: '手机号码', en: 'Phone', ja: '電話番号' },
  checkout_select: { zh: '请选择', en: 'Select', ja: '選択してください' },
  checkout_continue_shipping: { zh: '继续选择配送方式', en: 'Continue to shipping', ja: '配送方法の選択へ' },
  checkout_delivery: { zh: '配送方式', en: 'Delivery', ja: '配送方法' },
  checkout_days: { zh: '{min}–{max} 个工作日', en: '{min}–{max} business days', ja: '{min}〜{max}営業日' },
  checkout_edit: { zh: '修改', en: 'Edit', ja: '変更' },
  checkout_payment: { zh: '支付', en: 'Payment', ja: 'お支払い' },
  checkout_pay: { zh: '支付并下单', en: 'Pay & Place Order', ja: '支払って注文する' },
  checkout_placing: { zh: '正在提交订单…', en: 'Placing order…', ja: '注文を送信中…' },
  checkout_test_payment: {
    zh: '当前为测试支付，不会真实扣款。正式上线后替换为 Stripe 等支付方式。',
    en: 'Test payment mode — no real charge is made. Replace with Stripe before launch.',
    ja: 'テスト決済モードです。実際の請求は発生しません。公開前に Stripe などに切り替えてください。',
  },
  checkout_no_gateway: {
    zh: '当前币种未配置可用的支付方式，请在后台启用支付插件。',
    en: 'No payment method is configured for this currency.',
    ja: 'この通貨で利用できる決済方法が設定されていません。',
  },
  checkout_summary: { zh: '订单摘要', en: 'Order Summary', ja: 'ご注文内容' },
  checkout_required: { zh: '必填', en: 'Required', ja: '必須' },

  // Order confirmation
  order_thanks: { zh: '感谢您的订购', en: 'Thank you for your order', ja: 'ご注文ありがとうございます' },
  order_number: { zh: '订单号', en: 'Order number', ja: '注文番号' },
  order_email_note: { zh: '订单确认信息将发送至 {email}', en: 'A confirmation will be sent to {email}', ja: '確認メールを {email} にお送りします' },

  // Footer
  footer_shop: { zh: '购物', en: 'Shop', ja: 'ショッピング' },
  footer_about: { zh: '品牌', en: 'Brand', ja: 'ブランド' },
  footer_contact: { zh: '联系', en: 'Contact', ja: 'お問い合わせ' },
  footer_rights: { zh: '保留所有权利', en: 'All rights reserved.', ja: 'All rights reserved.' },

  // Misc
  loading: { zh: '加载中...', en: 'Loading...', ja: '読み込み中...' },
  retry: { zh: '重试', en: 'Retry', ja: '再試行' },
  error_load: { zh: '加载失败，请刷新重试', en: 'Failed to load. Please refresh.', ja: '読み込みに失敗しました。更新してください。' },
  error_generic: { zh: '操作失败，请重试', en: 'Something went wrong. Please try again.', ja: 'エラーが発生しました。もう一度お試しください。' },
  error_stock: { zh: '库存不足', en: 'Not enough stock', ja: '在庫が不足しています' },
  page_not_found: { zh: '页面不存在', en: 'Page not found', ja: 'ページが見つかりません' },
  back_home: { zh: '返回首页', en: 'Back to home', ja: 'ホームに戻る' },
};

export function tr(key: string, locale: Locale, params?: Record<string, string | number>): string {
  const entry = t[key];
  let text = entry ? entry[locale] || entry.en : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) text = text.replace(`{${k}}`, String(v));
  }
  return text;
}

export function formatPrice(money: Money | null | undefined, locale: Locale): string {
  if (!money) return '';
  return new Intl.NumberFormat(intlLocale[locale], {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: money.amount % 1 === 0 ? 0 : 2,
  }).format(money.amount);
}

export function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([intlLocale[locale]], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

export function freeShippingNote(threshold: number, currency: string, locale: Locale): string {
  return tr('free_ship_over', locale, { amount: formatPrice({ amount: threshold, currency }, locale) });
}
