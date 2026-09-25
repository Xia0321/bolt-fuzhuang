import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Locale } from '@/types';
import { tr } from '@/i18n/translations';
import { CHANNELS, DEFAULT_CHANNEL_BY_LOCALE, LANGUAGE_CODES } from '@/config';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  languageCode: string;
  // 当前渠道（币种），对应 Saleor Channel slug
  channel: string;
  setChannel: (channel: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const LOCALE_KEY = 'app-locale';
const CHANNEL_KEY = 'app-channel';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 隐私模式等情况下无法写入，忽略
  }
}

function getInitialLocale(): Locale {
  const stored = readStorage(LOCALE_KEY);
  if (stored === 'zh' || stored === 'en' || stored === 'ja') return stored;
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('ja')) return 'ja';
  if (browserLang.startsWith('en')) return 'en';
  return 'zh';
}

function getInitialChannel(locale: Locale): string {
  const stored = readStorage(CHANNEL_KEY);
  if (stored && CHANNELS.some(c => c.slug === stored)) return stored;
  return DEFAULT_CHANNEL_BY_LOCALE[locale];
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [channel, setChannelState] = useState<string>(() => getInitialChannel(locale));

  useEffect(() => {
    writeStorage(LOCALE_KEY, locale);
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
  }, [locale]);

  useEffect(() => {
    writeStorage(CHANNEL_KEY, channel);
  }, [channel]);

  const value: I18nContextValue = {
    locale,
    setLocale: setLocaleState,
    languageCode: LANGUAGE_CODES[locale],
    channel,
    setChannel: setChannelState,
    t: (key, params) => tr(key, locale, params),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
