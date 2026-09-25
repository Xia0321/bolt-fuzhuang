import type { Locale } from '@/types';

// Saleor GraphQL 地址，按环境在 .env 中配置
export const SALEOR_API_URL: string = import.meta.env.VITE_SALEOR_API_URL || 'http://localhost:8000/graphql/';

// 前端语言 → Saleor 翻译语言代码
export const LANGUAGE_CODES: Record<Locale, string> = {
  zh: 'ZH_HANS',
  en: 'EN',
  ja: 'JA',
};

export interface ChannelOption {
  slug: string;
  currency: string;
  label: string;
  // 结算页默认选中的收货国家
  defaultCountry: string;
}

// 可选币种，与 Saleor 后台的渠道（Channel）一一对应
export const CHANNELS: ChannelOption[] = [
  { slug: 'cn', currency: 'CNY', label: 'CNY ¥', defaultCountry: 'CN' },
  { slug: 'global', currency: 'USD', label: 'USD $', defaultCountry: 'US' },
  { slug: 'jp', currency: 'JPY', label: 'JPY ¥', defaultCountry: 'JP' },
];

// 首次访问时按语言选择默认币种，之后以用户选择为准
export const DEFAULT_CHANNEL_BY_LOCALE: Record<Locale, string> = {
  zh: 'cn',
  en: 'global',
  ja: 'jp',
};
