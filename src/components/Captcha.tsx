import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import type { Locale } from '@/types';

// Cloudflare Turnstile 人机验证。令牌只能使用一次，提交失败后通过 resetKey 重新验证
interface Turnstile {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window { turnstile?: Turnstile }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const LANGUAGES: Record<Locale, string> = { zh: 'zh-cn', en: 'en', ja: 'ja' };

let scriptPromise: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  scriptPromise ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error('turnstile'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function Captcha({ siteKey, onToken, resetKey }: { siteKey: string; onToken: (token: string | null) => void; resetKey: number }) {
  const { locale, t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then(turnstile => {
        if (cancelled || !ref.current) return;
        widgetRef.current = turnstile.render(ref.current, {
          sitekey: siteKey,
          language: LANGUAGES[locale],
          theme: 'light',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (widgetRef.current) window.turnstile?.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [siteKey, locale]);

  useEffect(() => {
    if (resetKey && widgetRef.current) {
      window.turnstile?.reset(widgetRef.current);
      onTokenRef.current(null);
    }
  }, [resetKey]);

  if (failed) return <p className="text-[13px] text-red-600">{t('auth_captcha_load_failed')}</p>;
  return <div ref={ref} className="min-h-[65px]" />;
}
