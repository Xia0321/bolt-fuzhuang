import { useI18n } from '@/i18n/I18nContext';
import { useNav } from '@/context/NavContext';

export function NotFoundPage() {
  const { t } = useI18n();
  const { navigate } = useNav();
  return (
    <div className="min-h-screen flex items-center justify-center bg-white pt-20">
      <div className="text-center">
        <p className="text-neutral-400 text-lg mb-4">{t('page_not_found')}</p>
        <button onClick={() => navigate({ name: 'home' })} className="text-neutral-900 underline text-sm">
          {t('back_home')}
        </button>
      </div>
    </div>
  );
}
