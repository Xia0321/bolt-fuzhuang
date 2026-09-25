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
  order_title: { zh: '订单详情', en: 'Order Details', ja: 'ご注文詳細' },
  order_placed_on: { zh: '下单时间', en: 'Placed on', ja: 'ご注文日時' },
  order_status: { zh: '订单状态', en: 'Status', ja: 'ステータス' },
  order_items: { zh: '商品', en: 'Items', ja: '商品' },
  order_shipping_to: { zh: '收货地址', en: 'Shipping address', ja: 'お届け先' },
  order_shipping_method: { zh: '配送方式', en: 'Delivery method', ja: '配送方法' },
  order_tracking: { zh: '物流单号', en: 'Tracking number', ja: '追跡番号' },
  order_no_tracking: { zh: '发货后将在这里显示物流单号', en: 'Tracking number will appear here once shipped', ja: '発送後、追跡番号がここに表示されます' },
  order_save_link: {
    zh: '请记下订单号，或收藏本页链接，随时回来查看订单状态和物流信息。',
    en: 'Keep your order number or bookmark this page to check order status and tracking anytime.',
    ja: '注文番号を控えるか、このページをブックマークすると、いつでも注文状況と配送状況を確認できます。',
  },
  order_register_hint: {
    zh: '注册账号后，之后的订单都可以在「我的订单」中查看。',
    en: 'Create an account to find future orders under My Orders.',
    ja: '会員登録すると、今後のご注文を「注文履歴」で確認できます。',
  },
  order_not_found: { zh: '订单不存在或链接无效', en: 'Order not found', ja: 'ご注文が見つかりません' },
  order_view_mine: { zh: '查看我的订单', en: 'View my orders', ja: '注文履歴を見る' },
  order_status_DRAFT: { zh: '草稿', en: 'Draft', ja: '下書き' },
  order_status_UNCONFIRMED: { zh: '待确认', en: 'Awaiting confirmation', ja: '確認待ち' },
  order_status_UNFULFILLED: { zh: '待发货', en: 'Processing', ja: '発送準備中' },
  order_status_PARTIALLY_FULFILLED: { zh: '部分发货', en: 'Partially shipped', ja: '一部発送済み' },
  order_status_FULFILLED: { zh: '已发货', en: 'Shipped', ja: '発送済み' },
  order_status_PARTIALLY_RETURNED: { zh: '部分退货', en: 'Partially returned', ja: '一部返品' },
  order_status_RETURNED: { zh: '已退货', en: 'Returned', ja: '返品済み' },
  order_status_CANCELED: { zh: '已取消', en: 'Canceled', ja: 'キャンセル済み' },
  order_status_EXPIRED: { zh: '已过期', en: 'Expired', ja: '期限切れ' },

  // Account
  nav_account: { zh: '账号', en: 'Account', ja: 'アカウント' },
  auth_login_title: { zh: '登录', en: 'Sign In', ja: 'ログイン' },
  auth_register_title: { zh: '注册账号', en: 'Create Account', ja: '会員登録' },
  auth_register_benefit: {
    zh: '注册后可随时查看订单和物流，并保存常用收货地址。',
    en: 'Track orders and shipments, and save your addresses for faster checkout.',
    ja: 'ご注文・配送状況の確認や、お届け先の保存ができます。',
  },
  auth_password: { zh: '密码', en: 'Password', ja: 'パスワード' },
  auth_password_confirm: { zh: '确认密码', en: 'Confirm password', ja: 'パスワード（確認）' },
  auth_password_hint: { zh: '至少 8 位', en: 'At least 8 characters', ja: '8文字以上' },
  auth_password_short: { zh: '密码至少需要 8 位', en: 'Password must be at least 8 characters', ja: 'パスワードは8文字以上で入力してください' },
  auth_password_mismatch: { zh: '两次输入的密码不一致', en: 'Passwords do not match', ja: 'パスワードが一致しません' },
  auth_login_button: { zh: '登录', en: 'Sign In', ja: 'ログイン' },
  auth_register_button: { zh: '注册', en: 'Create Account', ja: '登録する' },
  auth_no_account: { zh: '还没有账号？', en: 'New here?', ja: 'はじめてご利用の方' },
  auth_have_account: { zh: '已有账号？', en: 'Already have an account?', ja: 'アカウントをお持ちの方' },
  auth_forgot: { zh: '忘记密码？', en: 'Forgot password?', ja: 'パスワードをお忘れの方' },
  auth_captcha_required: { zh: '请先完成人机验证', en: 'Please complete the verification', ja: '認証を完了してください' },
  auth_captcha_load_failed: {
    zh: '人机验证加载失败，请检查网络后刷新页面',
    en: 'Verification failed to load. Please check your connection and refresh.',
    ja: '認証の読み込みに失敗しました。通信環境をご確認のうえ再読み込みしてください。',
  },
  auth_err_INVALID_CREDENTIALS: { zh: '邮箱或密码不正确', en: 'Incorrect email or password', ja: 'メールアドレスまたはパスワードが正しくありません' },
  auth_err_LOGIN_ATTEMPT_DELAYED: { zh: '尝试次数过多，请稍后再试', en: 'Too many attempts. Please try again later.', ja: '試行回数が多すぎます。しばらくしてからお試しください。' },
  auth_err_ACCOUNT_NOT_CONFIRMED: { zh: '该账号暂时无法登录，请联系客服', en: 'This account cannot sign in. Please contact us.', ja: 'このアカウントはログインできません。お問い合わせください。' },
  auth_err_INACTIVE: { zh: '该账号已停用，请联系客服', en: 'This account is disabled. Please contact us.', ja: 'このアカウントは無効です。お問い合わせください。' },
  auth_err_CAPTCHA_FAILED: { zh: '人机验证未通过，请重试', en: 'Verification failed. Please try again.', ja: '認証に失敗しました。もう一度お試しください。' },
  auth_err_RATE_LIMITED: { zh: '操作过于频繁，请稍后再试', en: 'Too many requests. Please try again later.', ja: 'リクエストが多すぎます。しばらくしてからお試しください。' },
  auth_err_EMAIL_EXISTS: { zh: '该邮箱已注册，请直接登录', en: 'This email is already registered. Please sign in.', ja: 'このメールアドレスは登録済みです。ログインしてください。' },
  auth_err_INVALID_EMAIL: { zh: '邮箱格式不正确', en: 'Invalid email address', ja: 'メールアドレスの形式が正しくありません' },
  auth_err_INVALID_PASSWORD: { zh: '密码过于简单或过短，请换一个', en: 'Password is too weak or too short', ja: 'パスワードが短すぎるか、推測されやすいものです' },
  auth_err_DISABLED: { zh: '注册暂未开放', en: 'Registration is currently unavailable', ja: '現在、会員登録を受け付けていません' },
  auth_err_NETWORK: { zh: '网络连接失败，请重试', en: 'Network error. Please try again.', ja: '通信エラーが発生しました。もう一度お試しください。' },
  reset_title: { zh: '找回密码', en: 'Reset Password', ja: 'パスワード再設定' },
  reset_desc: { zh: '输入注册邮箱，我们会发送重置密码的链接。', en: 'Enter your email and we’ll send you a reset link.', ja: 'ご登録のメールアドレスに再設定用のリンクをお送りします。' },
  reset_send: { zh: '发送重置链接', en: 'Send Reset Link', ja: 'リンクを送信' },
  reset_sent: { zh: '如果该邮箱已注册，重置链接已发送，请查收邮件。', en: 'If that email is registered, a reset link is on its way.', ja: 'ご登録済みの場合、再設定用のリンクをお送りしました。' },
  reset_email_unavailable: {
    zh: '邮件服务正在开通中，暂时无法在线找回密码。请联系客服 {email} 协助处理。',
    en: 'Email service is not available yet, so online password reset is disabled. Please contact {email} for help.',
    ja: 'メール配信の準備中のため、オンラインでのパスワード再設定はご利用いただけません。{email} までお問い合わせください。',
  },
  reset_new_title: { zh: '设置新密码', en: 'Set New Password', ja: '新しいパスワードを設定' },
  reset_new_button: { zh: '保存并登录', en: 'Save & Sign In', ja: '保存してログイン' },
  reset_invalid_link: { zh: '链接无效或已过期，请重新申请', en: 'This link is invalid or has expired', ja: 'リンクが無効か、有効期限が切れています' },
  account_title: { zh: '我的账号', en: 'My Account', ja: 'マイアカウント' },
  account_orders: { zh: '我的订单', en: 'My Orders', ja: '注文履歴' },
  account_addresses: { zh: '地址簿', en: 'Address Book', ja: 'お届け先' },
  account_logout: { zh: '退出登录', en: 'Sign Out', ja: 'ログアウト' },
  account_no_orders: { zh: '还没有订单', en: 'No orders yet', ja: 'ご注文はまだありません' },
  account_order_items: { zh: '共 {n} 件', en: 'Items: {n}', ja: '{n}点' },
  address_add: { zh: '新增地址', en: 'Add Address', ja: 'お届け先を追加' },
  address_edit: { zh: '编辑', en: 'Edit', ja: '編集' },
  address_delete: { zh: '删除', en: 'Delete', ja: '削除' },
  address_confirm_delete: { zh: '确认删除', en: 'Confirm delete', ja: '削除する' },
  address_default: { zh: '默认', en: 'Default', ja: 'デフォルト' },
  address_set_default: { zh: '设为默认', en: 'Set as default', ja: 'デフォルトに設定' },
  address_make_default: { zh: '设为默认收货地址', en: 'Use as default shipping address', ja: 'デフォルトのお届け先にする' },
  address_save: { zh: '保存地址', en: 'Save Address', ja: '保存する' },
  address_cancel: { zh: '取消', en: 'Cancel', ja: 'キャンセル' },
  address_empty: { zh: '还没有保存的地址。下单时填写的地址也会自动保存到这里。', en: 'No saved addresses yet. Addresses used at checkout are saved here automatically.', ja: '保存されたお届け先はありません。ご注文時のお届け先は自動で保存されます。' },
  checkout_login_hint: { zh: '已有账号？登录后可使用地址簿，订单也会保存到账号中。', en: 'Have an account? Sign in to use your address book and keep track of orders.', ja: 'アカウントをお持ちの方はログインすると、保存したお届け先を使え、注文履歴にも残ります。' },
  checkout_saved_address: { zh: '地址簿', en: 'Saved addresses', ja: '保存したお届け先' },
  checkout_new_address: { zh: '填写新地址', en: 'Enter a new address', ja: '新しい住所を入力' },

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

export function formatDate(iso: string, locale: Locale, withTime = false): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    year: 'numeric', month: 'short', day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(iso));
}
