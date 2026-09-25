/*
# Create fashion brand store schema (single-brand, multilingual, no auth)

Single-brand independent fashion store. One merchant only, no customer sign-in.
Schema is single-tenant with anon+authenticated read access.

## 1. New Tables
### categories
- id, slug, name(jsonb i18n), description(jsonb i18n), image_url, sort_order, created_at
### products
- id, slug, name(jsonb i18n), description(jsonb i18n), price, category_id(FK), images(jsonb), sizes(text[]), colors(jsonb), featured, sort_order, created_at

## 2. Security
- RLS enabled on both tables
- anon+authenticated SELECT policies (public storefront)

## 3. Seed Data
- 4 categories: Outerwear, Knitwear, Dresses, Accessories
- 16 products with multilingual names/descriptions
*/

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name jsonb NOT NULL,
  description jsonb,
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name jsonb NOT NULL,
  description jsonb NOT NULL,
  price numeric(10,2) NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  images jsonb NOT NULL DEFAULT '[]',
  sizes text[] NOT NULL DEFAULT '{}',
  colors jsonb NOT NULL DEFAULT '[]',
  featured boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured) WHERE featured = true;

INSERT INTO categories (slug, name, description, image_url, sort_order) VALUES
('outerwear', '{"zh":"外套","en":"Outerwear","ja":"アウター"}', '{"zh":"精选面料与利落剪裁，定义每一段出行的优雅基调。","en":"Curated fabrics and sharp tailoring — the elegant foundation for every journey.","ja":"厳選した生地と洗練されたシルエットで、あらゆる外出の基調を定義します。"}', 'https://images.pexels.com/photos/19196498/pexels-photo-19196498.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 1),
('knitwear', '{"zh":"针织","en":"Knitwear","ja":"ニット"}', '{"zh":"柔软触感与温暖包裹，日常穿搭的从容之选。","en":"Soft touch and warm embrace — the effortless choice for everyday wear.","ja":"柔らかな肌触りと温もり、日常着こなしの心地よい選択。"}', 'https://images.pexels.com/photos/5789598/pexels-photo-5789598.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 2),
('dresses', '{"zh":"裙装","en":"Dresses","ja":"ドレス"}', '{"zh":"流动的线条与精致细节，每一个场合都值得被盛装以待。","en":"Fluid lines and refined details — every occasion deserves to be dressed for.","ja":"流れるようなラインと洗練されたディテール。特別な場にふさわしい装いを。"}', 'https://images.pexels.com/photos/34160661/pexels-photo-34160661.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 3),
('accessories', '{"zh":"配饰","en":"Accessories","ja":"アクセサリー"}', '{"zh":"点睛之笔，完成整体造型的最后一步。","en":"The finishing touch that completes the entire look.","ja":"全体のスタイリングを完成させる、最後のひとひねり。"}', 'https://images.pexels.com/photos/7953286/pexels-photo-7953286.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (slug, name, description, price, category_id, images, sizes, colors, featured, sort_order) VALUES
('wool-long-coat-camel', '{"zh":"驼色羊毛长大衣","en":"Camel Wool Long Coat","ja":"キャメル ウール ロングコート"}', '{"zh":"100%美利奴羊毛，经典双排扣设计，腰带可拆卸。落肩剪裁包容多种身形。","en":"100% merino wool with classic double-breasted design and removable belt. Relaxed shoulder cut flatters every silhouette.","ja":"100%メリノウール。クラシックなダブルボタン、取り外し可能なベルト付き。"}', 2680.00, (SELECT id FROM categories WHERE slug='outerwear'), '["https://images.pexels.com/photos/19196498/pexels-photo-19196498.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","https://images.pexels.com/photos/19112767/pexels-photo-19112767.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['S','M','L','XL'], '[{"zh":"驼色","en":"Camel","ja":"キャメル","hex":"#c19a6b"},{"zh":"炭灰","en":"Charcoal","ja":"チャコール","hex":"#36454f"}]', true, 1),
('checked-trench-coat', '{"zh":"格纹风衣","en":"Checked Trench Coat","ja":"チェック トレンチコート"}', '{"zh":"经典格纹内衬，防水棉质面料，系带腰部塑形。","en":"Classic check lining with water-resistant cotton shell and waist-defining belt.","ja":"クラシックなチェック裏地、撥水性コットン素材、ウエストベルト付き。"}', 1980.00, (SELECT id FROM categories WHERE slug='outerwear'), '["https://images.pexels.com/photos/16811964/pexels-photo-16811964.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","https://images.pexels.com/photos/14316782/pexels-photo-14316782.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['XS','S','M','L'], '[{"zh":"米白","en":"Cream","ja":"クリーム","hex":"#f5f5dc"},{"zh":"卡其","en":"Khaki","ja":"カーキ","hex":"#c3b091"}]', true, 2),
('oversized-wool-blazer', '{"zh":"宽松羊毛西装","en":"Oversized Wool Blazer","ja":"オーバーサイズ ウールジャケット"}', '{"zh":"Oversize廓形，垫肩设计，可正反两穿。搭配裤装或裙装皆宜。","en":"Oversized silhouette with structured shoulder pads and reversible styling.","ja":"オーバーサイズシルエット、肩パッド付き、リバーシブル仕様。"}', 1580.00, (SELECT id FROM categories WHERE slug='outerwear'), '["https://images.pexels.com/photos/30676585/pexels-photo-30676585.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['S','M','L'], '[{"zh":"黑色","en":"Black","ja":"ブラック","hex":"#1a1a1a"},{"zh":"燕麦色","en":"Oatmeal","ja":"オートミール","hex":"#d4c5a9"}]', false, 3),
('classic-long-coat-black', '{"zh":"经典黑色长大衣","en":"Classic Black Long Coat","ja":"クラシック ブラック ロングコート"}', '{"zh":"极简单排扣设计，垂坠感面料，适合通勤与正式场合。","en":"Minimalist single-breasted silhouette with beautifully draping fabric.","ja":"ミニマルなシングルブレスト、美しいドレープ素材。"}', 2280.00, (SELECT id FROM categories WHERE slug='outerwear'), '["https://images.pexels.com/photos/1467571/pexels-photo-1467571.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['XS','S','M','L','XL'], '[{"zh":"黑色","en":"Black","ja":"ブラック","hex":"#1a1a1a"}]', false, 4),
('merino-crewneck-sweater', '{"zh":"美利奴圆领毛衣","en":"Merino Crewneck Sweater","ja":"メリノ クルーネックセーター"}', '{"zh":"细密美利奴羊毛织造，圆领基础款，四季皆宜的内搭之选。","en":"Finely knitted merino wool in a versatile crewneck — the year-round layering essential.","ja":"細密なメリノウール編み、クルーネックのベーシック。"}', 680.00, (SELECT id FROM categories WHERE slug='knitwear'), '["https://images.pexels.com/photos/14641597/pexels-photo-14641597.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","https://images.pexels.com/photos/14641596/pexels-photo-14641596.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['S','M','L','XL'], '[{"zh":"奶白","en":"Ivory","ja":"アイボリー","hex":"#fffff0"},{"zh":"雾灰","en":"Mist Grey","ja":"ミストグレー","hex":"#cdcdcd"}]', true, 5),
('cashmere-v-neck-sweater', '{"zh":"羊绒V领毛衣","en":"Cashmere V-Neck Sweater","ja":"カシミヤ Vネックセーター"}', '{"zh":"100%内蒙古羊绒，V领设计修饰颈部线条，轻盈而温暖。","en":"100% Inner Mongolian cashmere with a flattering V-neck — lightweight yet deeply warm.","ja":"100%内モンゴルカシミヤ、首元を美しく見せるVネック。"}', 1280.00, (SELECT id FROM categories WHERE slug='knitwear'), '["https://images.pexels.com/photos/5789598/pexels-photo-5789598.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['S','M','L'], '[{"zh":"粉色","en":"Rose","ja":"ローズ","hex":"#d4a5a5"},{"zh":"米色","en":"Beige","ja":"ベージュ","hex":"#f5f5dc"}]', true, 6),
('chunky-knit-pullover', '{"zh":"粗针套头毛衣","en":"Chunky Knit Pullover","ja":"チャンキーニット プルオーバー"}', '{"zh":"粗针手织感纹理，宽松落肩，冬日里的温暖拥抱。","en":"Hand-knit texture with a relaxed drop-shoulder fit — a warm embrace for winter days.","ja":"手編み風のチャンキーなテクスチャー、ゆったりとした落肩仕様。"}', 580.00, (SELECT id FROM categories WHERE slug='knitwear'), '["https://images.pexels.com/photos/7585639/pexels-photo-7585639.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","https://images.pexels.com/photos/6660711/pexels-photo-6660711.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['S','M','L'], '[{"zh":"粉色","en":"Pink","ja":"ピンク","hex":"#e8b4b8"},{"zh":"黑色","en":"Black","ja":"ブラック","hex":"#1a1a1a"}]', false, 7),
('ribbed-turtleneck-sweater', '{"zh":"罗纹高领毛衣","en":"Ribbed Turtleneck Sweater","ja":"リブタートルネックセーター"}', '{"zh":"高领罗纹织法，修身剪裁，叠穿的完美内搭。","en":"Slim-fit turtleneck in a ribbed knit — the perfect base for layering.","ja":"リブ編みのタートルネック、スリムフィット。重ね着のベースに。"}', 480.00, (SELECT id FROM categories WHERE slug='knitwear'), '["https://images.pexels.com/photos/21126/pexels-photo.jpg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['XS','S','M','L'], '[{"zh":"白色","en":"White","ja":"ホワイト","hex":"#ffffff"},{"zh":"黑色","en":"Black","ja":"ブラック","hex":"#1a1a1a"}]', false, 8),
('silk-slip-dress-red', '{"zh":"真丝吊带裙","en":"Silk Slip Dress","ja":"シルク スリップドレス"}', '{"zh":"100%桑蚕丝，细腻垂坠，细肩带可调节。适合宴会与约会场合。","en":"100% mulberry silk with fluid drape and adjustable straps.","ja":"100%桑蚕シルク、美しいドレープ、調節可能なストラップ。"}', 980.00, (SELECT id FROM categories WHERE slug='dresses'), '["https://images.pexels.com/photos/34160661/pexels-photo-34160661.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['XS','S','M','L'], '[{"zh":"红色","en":"Red","ja":"レッド","hex":"#c41e3a"}]', true, 9),
('sequin-evening-dress', '{"zh":"亮片晚礼服","en":"Sequin Evening Dress","ja":"シークイン イブニングドレス"}', '{"zh":"全身亮片手工缝制，修身鱼尾裙摆，宴会焦点之选。","en":"Hand-sewn sequins throughout with a mermaid silhouette.","ja":"全体に手縫いのシークイン、マーメイドシルエット。"}', 1880.00, (SELECT id FROM categories WHERE slug='dresses'), '["https://images.pexels.com/photos/37607882/pexels-photo-37607882.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['XS','S','M'], '[{"zh":"黑色","en":"Black","ja":"ブラック","hex":"#1a1a1a"}]', true, 10),
('polka-dot-midi-dress', '{"zh":"波点midi裙","en":"Polka Dot Midi Dress","ja":"ポルカドット ミディドレス"}', '{"zh":"复古波点图案，A字midi裙摆，系带腰部。轻松优雅的日常之选。","en":"Retro polka-dot print with A-line midi skirt and waist tie.","ja":"レトロなポルカドット柄、Aラインミディ、ウエストタイブ。"}', 780.00, (SELECT id FROM categories WHERE slug='dresses'), '["https://images.pexels.com/photos/8576047/pexels-photo-8576047.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['S','M','L'], '[{"zh":"红白","en":"Red & White","ja":"レッド&ホワイト","hex":"#c41e3a"}]', false, 11),
('white-maxi-dress', '{"zh":"白色长裙","en":"White Maxi Dress","ja":"ホワイト マキシドレス"}', '{"zh":"流畅垂感面料，高腰设计，裙摆随风而动。夏日浪漫之选。","en":"Fluid drape fabric with a high waist and wind-swept hem.","ja":"流れるような素材、ハイウエスト、風になびく裾。"}', 880.00, (SELECT id FROM categories WHERE slug='dresses'), '["https://images.pexels.com/photos/27580017/pexels-photo-27580017.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['XS','S','M','L'], '[{"zh":"白色","en":"White","ja":"ホワイト","hex":"#ffffff"}]', false, 12),
('black-column-dress', '{"zh":"黑色修身长裙","en":"Black Column Dress","ja":"ブラック コラムドレス"}', '{"zh":"极简修身剪裁，及膝长度，经典小黑裙的现代演绎。","en":"Minimalist column silhouette at knee length — the modern little black dress.","ja":"ミニマルなスリムシルエット、膝下丈。モダンなLBD。"}', 1080.00, (SELECT id FROM categories WHERE slug='dresses'), '["https://images.pexels.com/photos/18731383/pexels-photo-18731383.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","https://images.pexels.com/photos/34171256/pexels-photo-34171256.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['XS','S','M','L'], '[{"zh":"黑色","en":"Black","ja":"ブラック","hex":"#1a1a1a"}]', true, 13),
('leather-tote-bag', '{"zh":"皮质托特包","en":"Leather Tote Bag","ja":"レザー トートバッグ"}', '{"zh":"头层牛皮，大容量长方形包身，可容纳15寸笔记本电脑。","en":"Full-grain leather with a spacious rectangular body — fits a 15-inch laptop.","ja":"本革のトートバッグ、15インチPC対応の大容量。"}', 1480.00, (SELECT id FROM categories WHERE slug='accessories'), '["https://images.pexels.com/photos/7953286/pexels-photo-7953286.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['ONE SIZE'], '[{"zh":"棕色","en":"Brown","ja":"ブラウン","hex":"#8b4513"}]', true, 14),
('mini-shoulder-bag', '{"zh":"迷你斜挎包","en":"Mini Shoulder Bag","ja":"ミニ ショルダーバッグ"}', '{"zh":"精致迷你包型，可斜挎可手提，链条肩带可调节。","en":"Refined mini silhouette with adjustable chain strap.","ja":"上品なミニサイズ、チェーンストラップ調節可能。"}', 980.00, (SELECT id FROM categories WHERE slug='accessories'), '["https://images.pexels.com/photos/20380724/pexels-photo-20380724.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['ONE SIZE'], '[{"zh":"蓝色","en":"Blue","ja":"ブルー","hex":"#4a6fa5"}]', false, 15),
('structured-handbag', '{"zh":"挺括手提包","en":"Structured Handbag","ja":"スクエア ハンドバッグ"}', '{"zh":"几何线条设计，硬挺包型，五金锁扣开合。通勤与社交兼备。","en":"Geometric lines with a structured body and hardware clasp closure.","ja":"幾何学的ライン、スクエアボディ、金具留め。"}', 1280.00, (SELECT id FROM categories WHERE slug='accessories'), '["https://images.pexels.com/photos/7747109/pexels-photo-7747109.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","https://images.pexels.com/photos/19354613/pexels-photo-19354613.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['ONE SIZE'], '[{"zh":"棕色","en":"Tan","ja":"タン","hex":"#d2b48c"}]', false, 16),
('classic-leather-handbag', '{"zh":"经典皮手提包","en":"Classic Leather Handbag","ja":"クラシック レザーハンドバッグ"}', '{"zh":"简约包型，皮质细腻，日常百搭之选。","en":"Clean silhouette with supple leather — an everyday companion.","ja":"シンプルなフォルム、しなやかなレザー。日常に寄り添う一つ。"}', 1180.00, (SELECT id FROM categories WHERE slug='accessories'), '["https://images.pexels.com/photos/27810464/pexels-photo-27810464.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]', ARRAY['ONE SIZE'], '[{"zh":"棕色","en":"Tan","ja":"タン","hex":"#d2b48c"}]', false, 17)
ON CONFLICT (slug) DO NOTHING;