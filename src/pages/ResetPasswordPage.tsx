import { useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useNav } from '@/context/NavContext';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { authErrorKey, requestPasswordReset, setNewPassword } from '@/lib/account';
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await requestPasswordReset(email.trim(), channel);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_generic'));
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
          <PrimaryButton busy={busy}>{t('reset_send')}</PrimaryButton>
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
          <input type="password" className={inputClass} required minLength={MIN_PASSWORD} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label={t('auth_password_confirm')} required>
          <input type="password" className={inputClass} required value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        <PrimaryButton busy={busy}>{t('reset_new_button')}</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
