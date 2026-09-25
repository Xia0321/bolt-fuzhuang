import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useNav } from '@/context/NavContext';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { authErrorKey, requestPasswordReset, setNewPassword, useAccountConfig } from '@/lib/account';
import { Captcha } from '@/components/Captcha';
import { EMAIL_ENABLED } from '@/config';
import { AuthLayout } from '@/components/AuthLayout';
import { ErrorNote, Field, PrimaryButton } from '@/components/Form';
import { inputClass } from '@/components/formStyles';

const MIN_PASSWORD = 8;

// 不带参数：申请重置邮件；带 email 与 token（邮件中的链接）：设置新密码并登录
export function ResetPasswordPage({ email: linkEmail, token }: { email?: string; token?: string }) {
  return linkEmail && token ? <SetPasswordForm email={linkEmail} token={token} /> : <RequestForm />;
}

function RequestForm() {
  const { channel, t } = useI18n();
  const { navigate } = useNav();
  const { store } = useStore();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const config = useAccountConfig();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const needCaptcha = !!config?.captchaSiteKey;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (needCaptcha && !captchaToken) return setError(t('auth_captcha_required'));
    setBusy(true);
    try {
      await requestPasswordReset(email.trim(), channel, captchaToken ?? undefined);
      setSent(true);
    } catch (err) {
      const key = authErrorKey(err);
      setError(key ? t(key) : err instanceof Error ? err.message : t('error_generic'));
      setCaptchaReset(n => n + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('reset_title')} subtitle={EMAIL_ENABLED ? t('reset_desc') : undefined}>
      {!EMAIL_ENABLED ? (
        // 邮件服务开通前如实告知，不假装已发送
        <p className="text-[14px] text-neutral-600 bg-neutral-50 px-4 py-4 leading-relaxed">
          {t('reset_email_unavailable', { email: store?.site.contactEmail ?? '' })}
        </p>
      ) : sent ? (
        <p className="text-[14px] text-neutral-600 bg-neutral-50 px-4 py-4 leading-relaxed">{t('reset_sent')}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <ErrorNote>{error}</ErrorNote>}
          <Field label={t('checkout_email')} required>
            <input type="email" className={inputClass} required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          {needCaptcha && <Captcha siteKey={config.captchaSiteKey} onToken={setCaptchaToken} resetKey={captchaReset} />}
          <PrimaryButton busy={busy} disabled={!config || (needCaptcha && !captchaToken)}>{t('reset_send')}</PrimaryButton>
        </form>
      )}
      <p className="mt-8 text-center text-[14px]">
        <button onClick={() => navigate({ name: 'login' })} className="text-neutral-900 underline">{t('auth_login_title')}</button>
      </p>
    </AuthLayout>
  );
}

function SetPasswordForm({ email, token }: { email: string; token: string }) {
  const { t } = useI18n();
  const { navigate } = useNav();
  const { reloadUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD) return setError(t('auth_password_short'));
    if (password !== confirm) return setError(t('auth_password_mismatch'));
    setBusy(true);
    try {
      await setNewPassword(email, token, password);
      await reloadUser();
      navigate({ name: 'account' }, { replace: true });
    } catch (err) {
      const key = authErrorKey(err);
      setError(key ? t(key) : t('reset_invalid_link'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('reset_new_title')} subtitle={email}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label={t('auth_password')} required hint={t('auth_password_hint')}>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} className={inputClass} required minLength={MIN_PASSWORD} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <Field label={t('auth_password_confirm')} required>
          <div className="relative">
            <input type={showConfirm ? 'text' : 'password'} className={inputClass} required value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
            <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700">
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <PrimaryButton busy={busy}>{t('reset_new_button')}</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
