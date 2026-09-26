// 用 Claude 把抓取到的商品名称、描述、颜色名翻译为英文、简体中文、日文，并为颜色给出色值。
// 需要环境变量 ANTHROPIC_API_KEY。

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const localized = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['name', 'description'],
  additionalProperties: false,
};

const schema = categoryIds => ({
  type: 'object',
  properties: {
    // 从后台现有分类中推荐一个，页面上预选，可人工修改
    ...(categoryIds.length ? { categoryId: { type: 'string', enum: categoryIds } } : {}),
    en: localized,
    zh: localized,
    ja: localized,
    colors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          en: { type: 'string' },
          zh: { type: 'string' },
          ja: { type: 'string' },
          hex: { type: 'string' },
        },
        required: ['source', 'en', 'zh', 'ja', 'hex'],
        additionalProperties: false,
      },
    },
  },
  required: ['en', 'zh', 'ja', 'colors', ...(categoryIds.length ? ['categoryId'] : [])],
  additionalProperties: false,
});

const SYSTEM = `你是服装品牌 PINSO（品帅牛仔）独立站的商品编辑。你会收到从其他电商平台抓取的商品名称、描述和颜色名，原文可能是任何语言。
请输出英文（en）、简体中文（zh）、日文（ja）三个版本：
- name：简洁的商品名，去掉原平台的店铺名、促销词、SEO 堆砌词和尺码信息，保留品类与关键材质/版型，例如「Camel Wool Long Coat」「驼色羊毛长大衣」
- description：自然流畅的商品描述，保留材质、版型、尺寸说明、洗护等事实信息，去掉原平台的物流、售后、促销、店铺相关内容，不要编造原文没有的信息；段落之间用换行分隔
- colors：原文每个颜色名各一项，source 与原文完全一致；en/zh/ja 为该颜色在服装电商中的常用叫法；hex 为该颜色的近似色值（#RRGGBB）
- categoryId：如果提供了 categories（本店现有分类），从中选出最适合该商品的一个，返回其 id`;

// categories: [{ id, name }]，本店现有分类，用于推荐
export async function translateProduct({ name, description, colors, categories = [] }) {
  const response = await client.beta.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    // 安全分类器误拒时由服务端自动改用推荐的后备模型重试
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: schema(categories.map(c => c.id)) },
    },
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: JSON.stringify({ name, description, colors, categories }),
    }],
  });

  if (response.stop_reason === 'refusal') throw new Error('翻译请求被模型拒绝，请修改描述后重试');
  if (response.stop_reason === 'max_tokens') throw new Error('描述过长，翻译被截断，请删减后重试');
  const text = response.content.find(b => b.type === 'text')?.text;
  if (!text) throw new Error('翻译结果为空');
  return JSON.parse(text);
}
