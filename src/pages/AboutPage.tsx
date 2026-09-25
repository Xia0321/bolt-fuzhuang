import { useI18n } from '@/i18n/I18nContext';
import { useStore } from '@/context/StoreContext';
import { useNav } from '@/context/NavContext';
import { FeatureIcon } from '@/components/FeatureIcon';
import { NotFoundPage } from '@/pages/NotFoundPage';

// 内容来自 Saleor 后台 slug 为 about 的页面（横幅 + 正文），数据条来自 placement=about-stats 的 Feature 页面
export function AboutPage() {
  const { t } = useI18n();
  const { store } = useStore();
  const { navigate } = useNav();
  const about = store!.banners['about'];
  const stats = store!.features.filter(f => f.placement === 'about-stats');
  if (!about) return <NotFoundPage />;

  return (
    <div className="bg-white min-h-screen pt-16 md:pt-20">
      {/* Hero */}
      <section className="relative h-[420px] md:h-[520px] overflow-hidden">
        {about.imageUrl && (
          <img
            src={about.imageUrl}
            alt={about.title}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white px-4">
          <div>
            <p className="text-[12px] tracking-[0.3em] uppercase text-white/70 mb-4">{about.eyebrow}</p>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-light tracking-tight mb-4">{about.title}</h1>
            <p className="text-base md:text-lg font-light text-white/80">{about.subtitle}</p>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-3xl mx-auto px-4 md:px-8 py-20 md:py-28 text-center">
        {about.paragraphs.map((p, i) => (
          <p key={i} className="text-[16px] md:text-[18px] leading-[1.8] text-neutral-700 font-light mb-8 last:mb-0">
            {p}
          </p>
        ))}
      </section>

      {/* Stats */}
      {stats.length > 0 && (
      <section className="bg-neutral-50 py-16 md:py-20">
        <div className="max-w-[1000px] mx-auto px-4 md:px-8">
          <div className="flex flex-wrap justify-center gap-y-8">
            {stats.map((s, i) => (
              <div key={i} className="text-center w-1/3 px-3">
                <div className="inline-flex items-center justify-center w-12 h-12 mb-4 text-neutral-700">
                  <FeatureIcon name={s.icon} size={24} strokeWidth={1.2} />
                </div>
                <p className="text-2xl md:text-3xl font-light text-neutral-900 mb-1">{s.value}</p>
                <p className="text-[12px] md:text-[13px] tracking-wide text-neutral-500">{s.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* CTA */}
      <section className="py-20 md:py-28 text-center px-4">
        <h2 className="text-2xl md:text-4xl font-light tracking-tight text-neutral-900 mb-8">
          {t('section_featured')}
        </h2>
        <button
          onClick={() => navigate({ name: 'shop' })}
          className="inline-flex items-center gap-2 bg-neutral-900 text-white px-8 py-3.5 text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-neutral-800 transition-colors"
        >
          {t('nav_shop')}
        </button>
      </section>
    </div>
  );
}
