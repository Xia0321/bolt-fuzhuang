import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useNav } from '@/context/NavContext';
import { useAuth } from '@/context/AuthContext';
import { authErrorKey, useAccountConfig } from '@/lib/account';
import { AuthLayout } from '@/components/AuthLayout';
import { Captcha } from '@/components/Captcha';
import { ErrorNote, Field, PrimaryButton } from '@/components/Form';
import { inputClass } from '@/components/formStyles';
import { Eye, EyeOff, Loader2, MailCheck } from 'lucide-react';

const MIN_PASSWORD = 8;

// 注册只需邮箱和密码，不做邮箱验证；由注册服务校验人机验证并限制频率
export function RegisterPage({ next }: { next?: string }) {
  const { t } = useI18n();
  const { navigate, navigateUrl } = useNav();
  const { user, register } = useAuth();
  const [configVersion, setConfigVersion] = useState(0);
  const config = useAccountConfig(configVersion);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 注册成功后显示「请查收确认邮件」
  const [sentTo, setSentTo] = useState('');

  useEffect(() => {
    if (user) {
      if (next) navigateUrl(next);
      else navigate({ name: 'account' }, { replace: true });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const mismatch = confirm.length > 0 && password !== confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD) return setError(t('auth_password_short'));
    if (password !== confirm) return setError(t('auth_password_mismatch'));
    if (!captchaToken) return setError(t('auth_captcha_required'));
    setBusy(true);
    try {
      await register(email.trim(), password, captchaToken);
      setSentTo(email.trim());
    } catch (err) {
      const key = authErrorKey(err);
      setError(key ? t(key) : err instanceof Error ? err.message : t('error_generic'));
      // 验证令牌只能用一次，失败后重新验证
      setCaptchaReset(n => n + 1);
      // 未显示人机验证（绕过开关开启）却被判验证失败，说明开关已被关闭：重新拉取配置以显示验证
      if (authErrorKey(err) === 'auth_err_CAPTCHA_FAILED' && !config?.captchaSiteKey) setConfigVersion(v => v + 1);
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (sentTo) {
    body = (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 mb-5 rounded-full bg-neutral-900 text-white">
          <MailCheck size={24} strokeWidth={1.5} />
        </div>
        <p className="text-[14px] text-neutral-600 leading-relaxed">{t('register_check_email', { email: sentTo })}</p>
        <p className="text-[13px] text-neutral-400 leading-relaxed mt-3">{t('register_check_email_hint')}</p>
      </div>
    );
  } else if (!config) {
    body = <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-neutral-400" /></div>;
  } else if (!config.registerEnabled) {
    body = <ErrorNote>{t('auth_err_DISABLED')}</ErrorNote>;
  } else {
    body = (
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label={t('checkout_email')} required>
          <input type="email" className={inputClass} required value={email} onChange={e => { setEmail(e.target.value); setError(''); }} autoComplete="email" />
        </Field>
        <Field label={t('auth_password')} required hint={t('auth_password_hint')}>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'} className={inputClass} required minLength={MIN_PASSWORD}
              value={password} onChange={e => { setPassword(e.target.value); setError(''); }} autoComplete="new-password"
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <Field label={t('auth_password_confirm')} required>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'} className={`${inputClass} ${mismatch ? 'border-red-400 focus:border-red-500' : ''}`} required
              value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }} autoComplete="new-password"
            />
            <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700">
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        {mismatch && <p className="text-[12px] text-red-600 -mt-2">{t('auth_password_mismatch')}</p>}
        <Captcha siteKey={config.captchaSiteKey} onToken={setCaptchaToken} resetKey={captchaReset} />
        <PrimaryButton busy={busy}>{t('auth_register_button')}</PrimaryButton>
      </form>
    );
  }

  return (
    <AuthLayout title={t('auth_register_title')} subtitle={t('auth_register_benefit')}>
      {body}
      <p className="mt-8 text-center text-[14px] text-neutral-500">
        {t('auth_have_account')}{' '}
        <button onClick={() => navigate({ name: 'login', next })} className="text-neutral-900 underline">
          {t('auth_login_title')}
        </button>
      </p>
    </AuthLayout>
  );
}
