// 初始化数据：首次部署时导入 Saleor，之后都在 Saleor 后台维护。
// 文案以英文为主语言，zh / ja 作为翻译写入。图片为 Pexels 示例图，上线前请在后台替换成品牌自己的照片。

const px = (id, w = 940, h = 1250) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;
const pxWide = id => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1200&fit=crop`;

// 渠道 = 币种/地区。商品价格以 CNY 录入，其他币种按汇率换算后取整
export const channels = [
  { slug: 'cn', name: 'China (CNY)', currency: 'CNY', country: 'CN', convert: cny => cny },
  { slug: 'global', name: 'Global (USD)', currency: 'USD', country: 'US', convert: cny => Math.round(cny / 7 / 5) * 5 },
  { slug: 'jp', name: 'Japan (JPY)', currency: 'JPY', country: 'JP', convert: cny => Math.round((cny * 20) / 100) * 100 },
];

export const warehouse = {
  slug: 'main-warehouse',
  name: 'Main Warehouse',
  email: 'warehouse@pinsodenim.com',
  address: {
    streetAddress1: '88 Century Avenue',
    city: 'Shanghai',
    postalCode: '200120',
    country: 'CN',
    countryArea: 'Shanghai',
    skipValidation: true,
  },
};

export const shippingZone = {
  name: 'Worldwide',
  countries: ['CN', 'HK', 'TW', 'JP', 'KR', 'SG', 'US', 'CA', 'GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'AU'],
  // 每个方法按渠道币种给出价格；free 方法只在订单金额达到门槛时出现
  methods: [
    {
      name: 'Standard Shipping',
      translations: { zh: '标准配送', ja: '通常配送' },
      minDays: 5, maxDays: 10,
      prices: { CNY: { price: 30, max: 999 }, USD: { price: 10, max: 150 }, JPY: { price: 800, max: 20000 } },
    },
    {
      name: 'Free Shipping',
      translations: { zh: '免运费', ja: '送料無料' },
      minDays: 5, maxDays: 10,
      prices: { CNY: { price: 0, min: 999 }, USD: { price: 0, min: 150 }, JPY: { price: 0, min: 20000 } },
    },
    {
      name: 'Express Shipping',
      translations: { zh: '加急配送', ja: '速達配送' },
      minDays: 2, maxDays: 4,
      prices: { CNY: { price: 60 }, USD: { price: 25 }, JPY: { price: 1500 } },
    },
  ],
};

export const sizes = ['XS', 'S', 'M', 'L', 'XL', 'ONE SIZE'];

export const colors = {
  Camel: { hex: '#c19a6b', zh: '驼色', ja: 'キャメル' },
  Charcoal: { hex: '#36454f', zh: '炭灰', ja: 'チャコール' },
  Cream: { hex: '#f5f5dc', zh: '米白', ja: 'クリーム' },
  Khaki: { hex: '#c3b091', zh: '卡其', ja: 'カーキ' },
  Black: { hex: '#1a1a1a', zh: '黑色', ja: 'ブラック' },
  Oatmeal: { hex: '#d4c5a9', zh: '燕麦色', ja: 'オートミール' },
  Ivory: { hex: '#fffff0', zh: '奶白', ja: 'アイボリー' },
  'Mist Grey': { hex: '#cdcdcd', zh: '雾灰', ja: 'ミストグレー' },
  Rose: { hex: '#d4a5a5', zh: '粉色', ja: 'ローズ' },
  Beige: { hex: '#e8dcc4', zh: '米色', ja: 'ベージュ' },
  Pink: { hex: '#e8b4b8', zh: '粉色', ja: 'ピンク' },
  White: { hex: '#ffffff', zh: '白色', ja: 'ホワイト' },
  Red: { hex: '#c41e3a', zh: '红色', ja: 'レッド' },
  'Red & White': { hex: '#d9485f', zh: '红白', ja: 'レッド&ホワイト' },
  Brown: { hex: '#8b4513', zh: '棕色', ja: 'ブラウン' },
  Blue: { hex: '#4a6fa5', zh: '蓝色', ja: 'ブルー' },
  Tan: { hex: '#d2b48c', zh: '浅棕', ja: 'タン' },
};

export const categories = [
  {
    slug: 'outerwear', image: px(19196498),
    name: { en: 'Outerwear', zh: '外套', ja: 'アウター' },
    description: {
      en: 'Curated fabrics and sharp tailoring — the elegant foundation for every journey.',
      zh: '精选面料与利落剪裁，定义每一段出行的优雅基调。',
      ja: '厳選した生地と洗練されたシルエットで、あらゆる外出の基調を定義します。',
    },
  },
  {
    slug: 'knitwear', image: px(5789598),
    name: { en: 'Knitwear', zh: '针织', ja: 'ニット' },
    description: {
      en: 'Soft touch and warm embrace — the effortless choice for everyday wear.',
      zh: '柔软触感与温暖包裹，日常穿搭的从容之选。',
      ja: '柔らかな肌触りと温もり、日常着こなしの心地よい選択。',
    },
  },
  {
    slug: 'dresses', image: px(34160661),
    name: { en: 'Dresses', zh: '裙装', ja: 'ドレス' },
    description: {
      en: 'Fluid lines and refined details — every occasion deserves to be dressed for.',
      zh: '流动的线条与精致细节，每一个场合都值得被盛装以待。',
      ja: '流れるようなラインと洗練されたディテール。特別な場にふさわしい装いを。',
    },
  },
  {
    slug: 'accessories', image: px(7953286),
    name: { en: 'Accessories', zh: '配饰', ja: 'アクセサリー' },
    description: {
      en: 'The finishing touch that completes the entire look.',
      zh: '点睛之笔，完成整体造型的最后一步。',
      ja: '全体のスタイリングを完成させる、最後のひとひねり。',
    },
  },
];

// price 为 CNY
export const products = [
  { slug: 'wool-long-coat-camel', category: 'outerwear', price: 2680, featured: true, images: [px(19196498), px(19112767)], sizes: ['S', 'M', 'L', 'XL'], colors: ['Camel', 'Charcoal'],
    name: { en: 'Camel Wool Long Coat', zh: '驼色羊毛长大衣', ja: 'キャメル ウール ロングコート' },
    description: { en: '100% merino wool with classic double-breasted design and removable belt. Relaxed shoulder cut flatters every silhouette.', zh: '100%美利奴羊毛，经典双排扣设计，腰带可拆卸。落肩剪裁包容多种身形。', ja: '100%メリノウール。クラシックなダブルボタン、取り外し可能なベルト付き。' } },
  { slug: 'checked-trench-coat', category: 'outerwear', price: 1980, featured: true, images: [px(16811964), px(14316782)], sizes: ['XS', 'S', 'M', 'L'], colors: ['Cream', 'Khaki'],
    name: { en: 'Checked Trench Coat', zh: '格纹风衣', ja: 'チェック トレンチコート' },
    description: { en: 'Classic check lining with water-resistant cotton shell and waist-defining belt.', zh: '经典格纹内衬，防水棉质面料，系带腰部塑形。', ja: 'クラシックなチェック裏地、撥水性コットン素材、ウエストベルト付き。' } },
  { slug: 'oversized-wool-blazer', category: 'outerwear', price: 1580, featured: false, images: [px(30676585)], sizes: ['S', 'M', 'L'], colors: ['Black', 'Oatmeal'],
    name: { en: 'Oversized Wool Blazer', zh: '宽松羊毛西装', ja: 'オーバーサイズ ウールジャケット' },
    description: { en: 'Oversized silhouette with structured shoulder pads and reversible styling.', zh: 'Oversize廓形，垫肩设计，可正反两穿。搭配裤装或裙装皆宜。', ja: 'オーバーサイズシルエット、肩パッド付き、リバーシブル仕様。' } },
  { slug: 'classic-long-coat-black', category: 'outerwear', price: 2280, featured: false, images: [px(1467571)], sizes: ['XS', 'S', 'M', 'L', 'XL'], colors: ['Black'],
    name: { en: 'Classic Black Long Coat', zh: '经典黑色长大衣', ja: 'クラシック ブラック ロングコート' },
    description: { en: 'Minimalist single-breasted silhouette with beautifully draping fabric.', zh: '极简单排扣设计，垂坠感面料，适合通勤与正式场合。', ja: 'ミニマルなシングルブレスト、美しいドレープ素材。' } },
  { slug: 'merino-crewneck-sweater', category: 'knitwear', price: 680, featured: true, images: [px(14641597), px(14641596)], sizes: ['S', 'M', 'L', 'XL'], colors: ['Ivory', 'Mist Grey'],
    name: { en: 'Merino Crewneck Sweater', zh: '美利奴圆领毛衣', ja: 'メリノ クルーネックセーター' },
    description: { en: 'Finely knitted merino wool in a versatile crewneck — the year-round layering essential.', zh: '细密美利奴羊毛织造，圆领基础款，四季皆宜的内搭之选。', ja: '細密なメリノウール編み、クルーネックのベーシック。' } },
  { slug: 'cashmere-v-neck-sweater', category: 'knitwear', price: 1280, featured: true, images: [px(5789598)], sizes: ['S', 'M', 'L'], colors: ['Rose', 'Beige'],
    name: { en: 'Cashmere V-Neck Sweater', zh: '羊绒V领毛衣', ja: 'カシミヤ Vネックセーター' },
    description: { en: '100% Inner Mongolian cashmere with a flattering V-neck — lightweight yet deeply warm.', zh: '100%内蒙古羊绒，V领设计修饰颈部线条，轻盈而温暖。', ja: '100%内モンゴルカシミヤ、首元を美しく見せるVネック。' } },
  { slug: 'chunky-knit-pullover', category: 'knitwear', price: 580, featured: false, images: [px(7585639), px(6660711)], sizes: ['S', 'M', 'L'], colors: ['Pink', 'Black'],
    name: { en: 'Chunky Knit Pullover', zh: '粗针套头毛衣', ja: 'チャンキーニット プルオーバー' },
    description: { en: 'Hand-knit texture with a relaxed drop-shoulder fit — a warm embrace for winter days.', zh: '粗针手织感纹理，宽松落肩，冬日里的温暖拥抱。', ja: '手編み風のチャンキーなテクスチャー、ゆったりとした落肩仕様。' } },
  { slug: 'ribbed-turtleneck-sweater', category: 'knitwear', price: 480, featured: false, images: ['https://images.pexels.com/photos/21126/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=940&h=1250&fit=crop'], sizes: ['XS', 'S', 'M', 'L'], colors: ['White', 'Black'],
    name: { en: 'Ribbed Turtleneck Sweater', zh: '罗纹高领毛衣', ja: 'リブタートルネックセーター' },
    description: { en: 'Slim-fit turtleneck in a ribbed knit — the perfect base for layering.', zh: '高领罗纹织法，修身剪裁，叠穿的完美内搭。', ja: 'リブ編みのタートルネック、スリムフィット。重ね着のベースに。' } },
  { slug: 'silk-slip-dress-red', category: 'dresses', price: 980, featured: true, images: [px(34160661)], sizes: ['XS', 'S', 'M', 'L'], colors: ['Red'],
    name: { en: 'Silk Slip Dress', zh: '真丝吊带裙', ja: 'シルク スリップドレス' },
    description: { en: '100% mulberry silk with fluid drape and adjustable straps.', zh: '100%桑蚕丝，细腻垂坠，细肩带可调节。适合宴会与约会场合。', ja: '100%桑蚕シルク、美しいドレープ、調節可能なストラップ。' } },
  { slug: 'sequin-evening-dress', category: 'dresses', price: 1880, featured: true, images: [px(37607882)], sizes: ['XS', 'S', 'M'], colors: ['Black'],
    name: { en: 'Sequin Evening Dress', zh: '亮片晚礼服', ja: 'シークイン イブニングドレス' },
    description: { en: 'Hand-sewn sequins throughout with a mermaid silhouette.', zh: '全身亮片手工缝制，修身鱼尾裙摆，宴会焦点之选。', ja: '全体に手縫いのシークイン、マーメイドシルエット。' } },
  { slug: 'polka-dot-midi-dress', category: 'dresses', price: 780, featured: false, images: [px(8576047)], sizes: ['S', 'M', 'L'], colors: ['Red & White'],
    name: { en: 'Polka Dot Midi Dress', zh: '波点midi裙', ja: 'ポルカドット ミディドレス' },
    description: { en: 'Retro polka-dot print with A-line midi skirt and waist tie.', zh: '复古波点图案，A字midi裙摆，系带腰部。轻松优雅的日常之选。', ja: 'レトロなポルカドット柄、Aラインミディ、ウエストタイ付き。' } },
  { slug: 'white-maxi-dress', category: 'dresses', price: 880, featured: false, images: [px(27580017)], sizes: ['XS', 'S', 'M', 'L'], colors: ['White'],
    name: { en: 'White Maxi Dress', zh: '白色长裙', ja: 'ホワイト マキシドレス' },
    description: { en: 'Fluid drape fabric with a high waist and wind-swept hem.', zh: '流畅垂感面料，高腰设计，裙摆随风而动。夏日浪漫之选。', ja: '流れるような素材、ハイウエスト、風になびく裾。' } },
  { slug: 'black-column-dress', category: 'dresses', price: 1080, featured: true, images: [px(18731383), px(34171256)], sizes: ['XS', 'S', 'M', 'L'], colors: ['Black'],
    name: { en: 'Black Column Dress', zh: '黑色修身长裙', ja: 'ブラック コラムドレス' },
    description: { en: 'Minimalist column silhouette at knee length — the modern little black dress.', zh: '极简修身剪裁，及膝长度，经典小黑裙的现代演绎。', ja: 'ミニマルなスリムシルエット、膝下丈。モダンなLBD。' } },
  { slug: 'leather-tote-bag', category: 'accessories', price: 1480, featured: true, images: [px(7953286)], sizes: ['ONE SIZE'], colors: ['Brown'],
    name: { en: 'Leather Tote Bag', zh: '皮质托特包', ja: 'レザー トートバッグ' },
    description: { en: 'Full-grain leather with a spacious rectangular body — fits a 15-inch laptop.', zh: '头层牛皮，大容量长方形包身，可容纳15寸笔记本电脑。', ja: '本革のトートバッグ、15インチPC対応の大容量。' } },
  { slug: 'mini-shoulder-bag', category: 'accessories', price: 980, featured: false, images: [px(20380724)], sizes: ['ONE SIZE'], colors: ['Blue'],
    name: { en: 'Mini Shoulder Bag', zh: '迷你斜挎包', ja: 'ミニ ショルダーバッグ' },
    description: { en: 'Refined mini silhouette with adjustable chain strap.', zh: '精致迷你包型，可斜挎可手提，链条肩带可调节。', ja: '上品なミニサイズ、チェーンストラップ調節可能。' } },
  { slug: 'structured-handbag', category: 'accessories', price: 1280, featured: false, images: [px(7747109), px(19354613)], sizes: ['ONE SIZE'], colors: ['Tan'],
    name: { en: 'Structured Handbag', zh: '挺括手提包', ja: 'スクエア ハンドバッグ' },
    description: { en: 'Geometric lines with a structured body and hardware clasp closure.', zh: '几何线条设计，硬挺包型，五金锁扣开合。通勤与社交兼备。', ja: '幾何学的ライン、スクエアボディ、金具留め。' } },
  { slug: 'classic-leather-handbag', category: 'accessories', price: 1180, featured: false, images: [px(27810464)], sizes: ['ONE SIZE'], colors: ['Tan'],
    name: { en: 'Classic Leather Handbag', zh: '经典皮手提包', ja: 'クラシック レザーハンドバッグ' },
    description: { en: 'Clean silhouette with supple leather — an everyday companion.', zh: '简约包型，皮质细腻，日常百搭之选。', ja: 'シンプルなフォルム、しなやかなレザー。日常に寄り添う一つ。' } },
];

// ---------- 页面内容（Saleor 后台「Models / 页面」里维护） ----------

// 页面类型及其属性。slug 是前端读取时的约定，不要改
export const pageTypes = {
  'site-settings': ['brand-name', 'tagline', 'contact-email', 'contact-phone', 'contact-address', 'instagram-url', 'favicon'],
  banner: ['eyebrow', 'subtitle', 'button-text', 'button-link', 'image'],
  feature: ['placement', 'sort-order', 'icon', 'value', 'subtitle'],
  content: [],
};

export const pageTypeNames = {
  'site-settings': 'Site Settings',
  banner: 'Banner',
  feature: 'Feature',
  content: 'Content Page',
};

// 页面属性定义。translatable 的属性值会写入 zh / ja 翻译
export const pageAttributes = {
  'brand-name': { name: 'Brand Name', inputType: 'PLAIN_TEXT' },
  tagline: { name: 'Tagline', inputType: 'PLAIN_TEXT', translatable: true },
  'contact-email': { name: 'Contact Email', inputType: 'PLAIN_TEXT' },
  'contact-phone': { name: 'Contact Phone', inputType: 'PLAIN_TEXT' },
  'contact-address': { name: 'Contact Address', inputType: 'PLAIN_TEXT', translatable: true },
  'instagram-url': { name: 'Instagram URL', inputType: 'PLAIN_TEXT' },
  eyebrow: { name: 'Eyebrow', inputType: 'PLAIN_TEXT', translatable: true },
  subtitle: { name: 'Subtitle', inputType: 'PLAIN_TEXT', translatable: true },
  'button-text': { name: 'Button Text', inputType: 'PLAIN_TEXT', translatable: true },
  'button-link': { name: 'Button Link', inputType: 'PLAIN_TEXT' },
  image: { name: 'Image', inputType: 'FILE' },
  // 浏览器标签页图标，建议上传正方形 PNG（≥ 64×64）或 ICO；不上传时使用前台自带的默认图标
  favicon: { name: 'Favicon', inputType: 'FILE' },
  value: { name: 'Value', inputType: 'PLAIN_TEXT', translatable: true },
  'sort-order': { name: 'Sort Order', inputType: 'NUMERIC' },
  placement: { name: 'Placement', inputType: 'DROPDOWN', values: ['home-values', 'about-stats'] },
  icon: { name: 'Icon', inputType: 'DROPDOWN', values: ['sparkles', 'scissors', 'leaf', 'globe', 'gem', 'heart', 'truck', 'shield'] },
};

const t3 = (en, zh, ja) => ({ en, zh, ja });

export const pages = [
  {
    slug: 'site-settings', type: 'site-settings', title: t3('Site Settings', '站点设置', 'サイト設定'),
    attrs: {
      'brand-name': 'PINSO Denim',
      tagline: t3('Poetry Woven in Fabric', '以织物书写的诗意', '織物が紡ぐ詩'),
      'contact-email': 'hello@pinsodenim.com',
      'contact-phone': '+86 21 0000 0000',
      'contact-address': t3('Shanghai · Paris · Tokyo', '上海 · 巴黎 · 东京', '上海 · パリ · 東京'),
      'instagram-url': 'https://www.instagram.com/',
    },
  },
  {
    slug: 'home-hero', type: 'banner', title: t3('Poetry Woven in Fabric', '以织物书写的诗意', '織物が紡ぐ詩'),
    attrs: {
      eyebrow: t3('Autumn / Winter 2026', '2026 秋冬系列', '2026 秋冬コレクション'),
      subtitle: t3(
        'From fabric to silhouette, every piece is a commitment to quality and timeless style.',
        '从面料到剪裁，每一件单品都是对品质与永恒风格的承诺。',
        '生地からシルエットまで、すべてのアイテムは品質と時代を超えるスタイルへの約束。',
      ),
      'button-text': t3('Explore the Collection', '探索系列', 'コレクションを見る'),
      'button-link': '/shop',
      image: pxWide(7871178),
    },
  },
  {
    slug: 'home-lookbook', type: 'banner', title: t3('Lookbook', '造型画册', 'ルックブック'),
    attrs: {
      eyebrow: t3('Styling inspiration this season', '本季搭配灵感', '今季のスタイリングのヒント'),
      'button-text': t3('Explore the Collection', '探索系列', 'コレクションを見る'),
      'button-link': '/shop',
      image: pxWide(7871180),
    },
  },
  {
    slug: 'about', type: 'banner', title: t3('Our Story', '品牌故事', 'ブランドストーリー'),
    content: t3(
      [
        'We believe clothing is not merely a covering but an extension of personal style and inner character. Every piece — from fabric selection to final stitch — embodies the dedication of artisans and a pursuit of perfection.',
        'We insist on natural fibers and eco-conscious craftsmanship to minimize environmental impact. Classic, not trend-chasing — that is our understanding of timeless style.',
      ],
      [
        '我们相信，衣物不仅是遮体的工具，更是个人风格与内在气质的延伸。每一件单品，从面料甄选到最终缝制，都凝聚着匠人的心血与对完美的追求。',
        '我们坚持使用天然纤维与环保工艺，以减少对环境的影响。经典而不追逐潮流，是我们对永恒风格的理解。',
      ],
      [
        '衣服は単なる身を包むものではなく、個人のスタイルと内面の延長であると信じています。生地の選定から最後の縫製まで、すべてのアイテムに職人の情熱と完璧への追求が込められています。',
        '天然繊維と環境に配慮した工芸を徹底し、環境への影響を最小限に。トレンドを追うのではなく、クラシックであること。それが私たちの時代を超えるスタイルの理解です。',
      ],
    ),
    attrs: {
      eyebrow: t3('PINSO Denim', '品帅牛仔', 'PINSO Denim'),
      subtitle: t3('Born from a pursuit of beauty', '源于对美的执着', '美へのこだわりから生まれた'),
      image: pxWide(7450781),
    },
  },
  ...[
    ['sparkles', t3('Curated Fabrics', '甄选面料', '厳選素材'), t3('Premium natural fibers sourced globally for touch and durability.', '全球甄选顶级天然纤维，触感与耐久兼备。', '世界中から厳選した最高級の天然繊維。肌触りと耐久性を両立。')],
    ['scissors', t3('Artisan Craft', '匠人手作', '職人技'), t3('Every piece passes through artisan hands, attentive to every detail.', '每一件单品经匠人之手，注重每个细节。', 'すべてのアイテムは職人の手を経て、細部までこだわります。')],
    ['leaf', t3('Timeless Style', '永恒风格', '時代を超えるスタイル'), t3('We do not chase trends — we create classics that endure.', '不追逐潮流，只创造经得起时间考验的经典。', 'トレンドを追わず、時を経ても色褪せないクラシックを。')],
    ['globe', t3('Eco Conscious', '环保理念', '環境配慮'), t3('Sustainable craftsmanship and eco packaging to lighten our footprint.', '可持续工艺与环保包装，减少地球负担。', 'サステナブルな工芸と環境配慮したパッケージで、地球に優しく。')],
  ].map(([icon, title, subtitle], i) => ({
    slug: `home-value-${i + 1}`, type: 'feature', title,
    attrs: { placement: 'home-values', 'sort-order': i + 1, icon, subtitle },
  })),
  ...[
    ['leaf', t3('Natural Fabrics', '天然面料', '天然素材'), t3('100%', '100%', '100%')],
    ['scissors', t3('Handcrafted', '手工工艺', '手仕事'), t3('Artisan', '匠心', '職人技')],
    ['sparkles', t3('Eco Pledge', '环保承诺', 'エコ誓約'), t3('Sustainable', '可持续', 'サステナブル')],
  ].map(([icon, title, value], i) => ({
    slug: `about-stat-${i + 1}`, type: 'feature', title,
    attrs: { placement: 'about-stats', 'sort-order': i + 1, icon, value },
  })),
  ...[
    ['shipping', t3('Shipping Info', '配送信息', '配送情報'), t3(
      ['Orders are dispatched within 1–2 business days. Standard delivery takes 5–10 business days; express delivery takes 2–4 business days.', 'Free standard shipping applies to orders above the threshold shown at checkout.'],
      ['订单将在 1–2 个工作日内发出。标准配送 5–10 个工作日送达，加急配送 2–4 个工作日送达。', '订单金额达到结算页显示的门槛即可享受免费标准配送。'],
      ['ご注文は1〜2営業日以内に発送します。通常配送は5〜10営業日、速達配送は2〜4営業日でお届けします。', 'チェックアウト画面に表示される金額以上のご注文は、通常配送が無料になります。'],
    )],
    ['returns', t3('Returns', '退换政策', '返品ポリシー'), t3(
      ['Unworn items with original tags may be returned within 14 days of delivery.', 'Please contact our customer service team to arrange a return.'],
      ['商品签收后 14 天内，吊牌完好且未穿着的商品可申请退换。', '请联系客服为您安排退换货。'],
      ['お届けから14日以内、タグ付きの未着用品は返品を承ります。', '返品をご希望の際はカスタマーサービスまでご連絡ください。'],
    )],
    ['privacy', t3('Privacy Policy', '隐私政策', 'プライバシーポリシー'), t3(
      ['This is a placeholder privacy policy. Replace it with your own policy in the Saleor dashboard before launch.'],
      ['这是隐私政策的占位内容，上线前请在 Saleor 后台替换为正式条款。'],
      ['これはプライバシーポリシーの仮の内容です。公開前に Saleor 管理画面で正式な内容に置き換えてください。'],
    )],
    ['terms', t3('Terms of Service', '服务条款', '利用規約'), t3(
      ['This is a placeholder terms of service. Replace it with your own terms in the Saleor dashboard before launch.'],
      ['这是服务条款的占位内容，上线前请在 Saleor 后台替换为正式条款。'],
      ['これは利用規約の仮の内容です。公開前に Saleor 管理画面で正式な内容に置き換えてください。'],
    )],
  ].map(([slug, title, content]) => ({ slug, type: 'content', title, content, attrs: {} })),
];

// ---------- 菜单（Saleor 后台「Navigation」里维护） ----------
// navbar：顶部导航 + 首页分类区；footer：页脚「品牌」栏；footer-legal：页脚底部链接
export const menus = {
  navbar: categories.map(c => ({ category: c.slug, name: c.name })),
  footer: [
    { page: 'about', name: t3('About', '品牌故事', 'ブランドについて') },
    { page: 'shipping', name: t3('Shipping Info', '配送信息', '配送情報') },
    { page: 'returns', name: t3('Returns', '退换政策', '返品ポリシー') },
  ],
  'footer-legal': [
    { page: 'privacy', name: t3('Privacy Policy', '隐私政策', 'プライバシーポリシー') },
    { page: 'terms', name: t3('Terms of Service', '服务条款', '利用規約') },
  ],
};

export const featuredCollection = {
  slug: 'featured',
  name: t3('Featured', '精选', 'おすすめ'),
};
