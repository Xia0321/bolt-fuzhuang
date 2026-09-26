// 按关键词从现有分类中猜测商品分类，Claude 不可用（额度用完、未配置）时兜底，不消耗额度。
// 同一组里的词视为同一品类；越靠前的组越具体（牛仔裤要排在裤装前面）。

const GROUPS = [
  ['jeans', 'jean', '牛仔裤', 'ジーンズ', 'デニムパンツ'],
  ['denim jacket', '牛仔外套', '牛仔夹克', 'デニムジャケット', 'Gジャン'],
  ['denim skirt', '牛仔裙', 'デニムスカート'],
  ['dress', 'dresses', 'jumpsuit', 'romper', '连衣裙', '裙装', '连体裤', 'ワンピース', 'ドレス'],
  ['skirt', '半身裙', 'スカート'],
  ['shorts', '短裤', 'ショートパンツ', 'ショーツ'],
  ['coat', 'jacket', 'outerwear', 'blazer', 'parka', 'trench', 'gilet', '外套', '夹克', '大衣', '风衣', 'アウター', 'ジャケット', 'コート'],
  ['knit', 'knitwear', 'sweater', 'cardigan', 'jumper', 'pullover', '针织', '毛衣', '开衫', 'ニット', 'セーター', 'カーディガン'],
  ['shirt', 'blouse', 't-shirt', 'tee', 'top', 'tops', 'tank', '衬衫', '上衣', 'T恤', 'シャツ', 'ブラウス', 'トップス'],
  ['pants', 'pant', 'trousers', 'trouser', 'chinos', '裤装', '长裤', '休闲裤', 'パンツ', 'ボトムス'],
  ['bag', 'belt', 'hat', 'cap', 'scarf', 'jewelry', 'jewellery', 'socks', 'accessory', 'accessories', '配饰', '包', '腰带', '帽', '围巾', 'アクセサリー', 'バッグ', 'ベルト', '小物'],
];

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 英文按整词匹配（如 jean 不会匹配 jeanne），中日文按包含匹配
const pattern = word => (/^[\x20-\x7e]+$/.test(word)
  ? new RegExp(`(^|[^a-z])${escape(word)}($|[^a-z])`, 'i')
  : new RegExp(escape(word)));
const MATCHERS = GROUPS.map(words => words.map(pattern));
const hits = (text, group) => MATCHERS[group].some(re => re.test(text));

/**
 * product: { name, keywords }  keywords 为商品类型、标签等
 * categories: [{ id, name, slug, translation?: { name }, parent?: { name } }]
 * 返回最匹配的分类 id，没有把握时返回 null（不落到默认分类）
 */
export function guessCategory(product, categories) {
  const candidates = categories.filter(c => c.slug !== 'default-category');
  // 商品名最能说明品类，优先按名称判断；名称判断不出再看标签
  for (const text of [product.name, product.keywords]) {
    if (!text) continue;
    for (let g = 0; g < GROUPS.length; g++) {
      if (!hits(text, g)) continue;
      const found = candidates.find(c => hits([c.name, c.translation?.name, c.slug.replace(/-/g, ' ')].filter(Boolean).join(' / '), g));
      if (found) return found.id;
    }
  }
  return null;
}
