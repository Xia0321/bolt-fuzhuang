import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useNav } from '@/context/NavContext';
import { confirmAccount } from '@/lib/account';
import { AuthLayout } from '@/components/AuthLayout';
import { ErrorNote } from '@/components/Form';
import { primaryButtonClass } from '@/components/formStyles';
import { Check, Loader2 } from 'lucide-react';

// 注册确认邮件中的链接：/confirm-account?email=&token=
export function ConfirmAccountPage({ email, token }: { email?: string; token?: string }) {
  const { t } = useI18n();
  const { navigate } = useNav();
  const [state, setState] = useState<'loading' | 'done' | 'failed'>(email && token ? 'loading' : 'failed');
  // 开发模式下 StrictMode 会执行两次副作用，确认令牌只能用一次
  const started = useRef(false);

  useEffect(() => {
    if (!email || !token || started.current) return;
    started.current = true;
    confirmAccount(email, token)
      .then(() => setState('done'))
      .catch(() => setState('failed'));
  }, [email, token]);

  return (
    <AuthLayout title={t('confirm_title')}>
      {state === 'loading' && (
        <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-neutral-400" /></div>
      )}
      {state === 'done' && (
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-5 rounded-full bg-neutral-900 text-white">
            <Check size={24} strokeWidth={1.5} />
          </div>
          <p className="text-[14px] text-neutral-600 mb-8">{t('confirm_done')}</p>
          <button onClick={() => navigate({ name: 'login', email }, { replace: true })} className={primaryButtonClass}>
            {t('auth_login_button')}
          </button>
        </div>
      )}
      {state === 'failed' && (
        <div className="space-y-6">
          <ErrorNote>{t('confirm_failed')}</ErrorNote>
          <div className="flex justify-center gap-6 text-[14px]">
            <button onClick={() => navigate({ name: 'login', email })} className="text-neutral-900 underline">{t('auth_login_title')}</button>
            <button onClick={() => navigate({ name: 'register' })} className="text-neutral-900 underline">{t('auth_register_title')}</button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
