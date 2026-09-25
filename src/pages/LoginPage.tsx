import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useNav } from '@/context/NavContext';
import { useAuth } from '@/context/AuthContext';
import { authErrorKey, useAccountConfig } from '@/lib/account';
import { Captcha } from '@/components/Captcha';
import { AuthLayout } from '@/components/AuthLayout';
import { ErrorNote, Field, PrimaryButton } from '@/components/Form';
import { inputClass } from '@/components/formStyles';

export function LoginPage({ next, email: initialEmail }: { next?: string; email?: string }) {
  const { t } = useI18n();
  const { navigate, navigateUrl } = useNav();
  const { user, login } = useAuth();
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const config = useAccountConfig();
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const needCaptcha = !!config?.captchaSiteKey;

  // 已登录时直接前往目标页
  useEffect(() => {
    if (user) {
      if (next) navigateUrl(next);
      else navigate({ name: 'account' }, { replace: true });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (needCaptcha && !captchaToken) return setError(t('auth_captcha_required'));
    setBusy(true);
    try {
      await login(email.trim(), password, captchaToken ?? undefined);
    } catch (err) {
      const key = authErrorKey(err);
      setError(key ? t(key) : err instanceof Error ? err.message : t('error_generic'));
      // 验证令牌只能用一次，失败后重新验证
      setCaptchaReset(n => n + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('auth_login_title')}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label={t('checkout_email')} required>
          <input type="email" className={inputClass} required value={email} onChange={e => { setEmail(e.target.value); setError(''); }} autoComplete="email" />
        </Field>
        <Field label={t('auth_password')} required>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} className={inputClass} required value={password} onChange={e => { setPassword(e.target.value); setError(''); }} autoComplete="current-password" />
            <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <div className="text-right">
          <button type="button" onClick={() => navigate({ name: 'resetPassword' })} className="text-[13px] text-neutral-500 underline hover:text-neutral-900">
            {t('auth_forgot')}
          </button>
        </div>
        {needCaptcha && <Captcha siteKey={config.captchaSiteKey} onToken={setCaptchaToken} resetKey={captchaReset} />}
        <PrimaryButton busy={busy} disabled={!config || (needCaptcha && !captchaToken)}>{t('auth_login_button')}</PrimaryButton>
      </form>
      <p className="mt-8 text-center text-[14px] text-neutral-500">
        {t('auth_no_account')}{' '}
        <button onClick={() => navigate({ name: 'register', next })} className="text-neutral-900 underline">
          {t('auth_register_title')}
        </button>
      </p>
    </AuthLayout>
  );
}
