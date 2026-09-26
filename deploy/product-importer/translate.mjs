// 用 Claude 把抓取到的商品名称、描述、颜色名翻译为英文、简体中文、日文，并为颜色给出色值。
// 两种方式，按环境变量自动选择：
//   CLAUDE_CODE_OAUTH_TOKEN  以无人值守模式运行 Claude Code（claude -p），使用 Claude 订阅额度，
//                            令牌由 `claude setup-token` 生成，有效期一年
//   ANTHROPIC_API_KEY        调用 Claude API，按用量计费（Claude Console 充值）
// 也可用 TRANSLATE_BACKEND=claude-code|api 强制指定（本地开发时可直接用本机已登录的 Claude Code）。

import Anthropic from '@anthropic-ai/sdk';
import { runClaudeCode } from './claude-code.mjs';

export function translateBackend() {
  if (process.env.TRANSLATE_BACKEND) return process.env.TRANSLATE_BACKEND;
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return 'claude-code';
  if (process.env.ANTHROPIC_API_KEY) return 'api';
  return '';
}

let apiClient = null;

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
请输出英文（en）、简体中文（zh）、日文（ja）三个版本。简体中文是本店主语言（运营都是中国人），zh 的名称和描述要是自然规范的中文，不要夹带英文原文（品牌名、面料商标如 TENCEL™ 可保留）：
- name：简洁的商品名，去掉原平台的店铺名、促销词、SEO 堆砌词和尺码信息，保留品类与关键材质/版型，例如「Camel Wool Long Coat」「驼色羊毛长大衣」
- description：自然流畅的商品描述，保留材质、版型、尺寸说明、洗护等事实信息，去掉原平台的物流、售后、促销、店铺相关内容，不要编造原文没有的信息；段落之间用换行分隔
- colors：原文每个颜色名各一项，source 与原文完全一致；en/zh/ja 为该颜色在服装电商中的常用叫法；hex 为该颜色的近似色值（#RRGGBB）。
  colorHints 给出部分颜色的通用色（如 "Nightfall Rinse" → "dark wash blue"），牛仔水洗名这类花式名称请参考通用色给出易懂的中日文叫法（如「深蓝水洗」「ダークウォッシュ」）和色值
- categoryId：如果提供了 categories（本店现有分类），从中选出最适合该商品的一个，返回其 id`;

// Claude Code 的报错里带有额度恢复时间，如 "You've hit your session limit · resets 8:50am (UTC)"，转成中文
export function explainClaudeError(e) {
  const m = String(e.message).match(/(?:session|usage|weekly)?\s*limit[^·]*·\s*resets\s+([^()]+?)\s*\((UTC|[^)]+)\)/i);
  if (!m) return e;
  let when = m[1].trim();
  const t = when.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (t && m[2] === 'UTC') {
    const hour = (Number(t[1]) % 12) + (/pm/i.test(t[3]) ? 12 : 0);
    when = `北京时间 ${String((hour + 8) % 24).padStart(2, '0')}:${t[2] ?? '00'}`;
  }
  return new Error(`Claude 订阅额度暂时用完，${when} 恢复`);
}

// categories: [{ id, name }]，本店现有分类，用于推荐
// colorHints: { 颜色名: 通用色 }
export async function translateProduct({ name, description, colors, colorHints = {}, categories = [] }) {
  const input = JSON.stringify({ name, description, colors, colorHints, categories });
  const format = schema(categories.map(c => c.id));
  if (translateBackend() !== 'claude-code') return viaApi(input, format);
  try {
    return await viaClaudeCode(input, format);
  } catch (e) {
    // 订阅额度用完等情况下，配置了 API Key 就改用 API（按用量计费）
    if (process.env.ANTHROPIC_API_KEY) return viaApi(input, format);
    throw explainClaudeError(e);
  }
}

// Claude Code 无人值守模式：关闭所有工具，只做翻译
function viaClaudeCode(input, format) {
  return runClaudeCode({ system: SYSTEM, input, schema: format });
}

function viaApi(input, format) {
  return viaApiWith(SYSTEM, input, format);
}

async function viaApiWith(system, input, format) {
  apiClient ??= new Anthropic();
  const response = await apiClient.beta.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    // 安全分类器误拒时由服务端自动改用推荐的后备模型重试
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: format },
    },
    system,
    messages: [{
      role: 'user',
      content: input,
    }],
  });

  if (response.stop_reason === 'refusal') throw new Error('翻译请求被模型拒绝，请修改描述后重试');
  if (response.stop_reason === 'max_tokens') throw new Error('描述过长，翻译被截断，请删减后重试');
  const text = response.content.find(b => b.type === 'text')?.text;
  if (!text) throw new Error('翻译结果为空');
  return JSON.parse(text);
}

// ---------- 后台表单字段翻译（如新建分类弹窗） ----------

const FIELDS_SCHEMA = {
  type: 'object',
  properties: { en: localized, zh: localized, ja: localized },
  required: ['en', 'zh', 'ja'],
  additionalProperties: false,
};

const FIELDS_SYSTEM = `你是服装品牌 PINSO（品帅牛仔）独立站的编辑。你会收到后台表单中的名称和描述（原文可能是任何语言，描述可能为空），
请给出英文（en）、简体中文（zh）、日文（ja）三个版本：
- name：简洁准确，使用服装电商的常用叫法（如分类「牛仔裤」→ Jeans / 牛仔裤 / ジーンズ）
- description：自然流畅的翻译，不增删事实；原文描述为空时返回空字符串；段落之间用换行分隔`;

// 翻译后台表单中的名称与描述，返回 { en, zh, ja }，每项为 { name, description }
export async function translateFields({ name, description }) {
  const input = JSON.stringify({ name, description });
  return translateBackend() === 'claude-code'
    ? runClaudeCode({ system: FIELDS_SYSTEM, input, schema: FIELDS_SCHEMA, effort: 'low' })
    : viaApiWith(FIELDS_SYSTEM, input, FIELDS_SCHEMA);
}
