import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useNav } from '@/context/NavContext';
import { useAuth } from '@/context/AuthContext';
import { authErrorKey } from '@/lib/account';
import { AuthLayout } from '@/components/AuthLayout';
import { ErrorNote, Field, PrimaryButton } from '@/components/Form';
import { inputClass } from '@/components/formStyles';

export function LoginPage({ next }: { next?: string }) {
  const { t } = useI18n();
  const { navigate, navigateUrl } = useNav();
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 已登录时直接前往目标页
  useEffect(() => {
    if (user) {
      if (next) navigateUrl(next);
      else navigate({ name: 'account' }, { replace: true });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (err) {
      const key = authErrorKey(err);
      setError(key ? t(key) : err instanceof Error ? err.message : t('error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('auth_login_title')}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label={t('checkout_email')} required>
          <input type="email" className={inputClass} required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label={t('auth_password')} required>
          <input type="password" className={inputClass} required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <div className="text-right">
          <button type="button" onClick={() => navigate({ name: 'resetPassword' })} className="text-[13px] text-neutral-500 underline hover:text-neutral-900">
            {t('auth_forgot')}
          </button>
        </div>
        <PrimaryButton busy={busy}>{t('auth_login_button')}</PrimaryButton>
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
