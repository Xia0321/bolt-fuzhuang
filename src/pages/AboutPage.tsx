import { useI18n } from '@/i18n/I18nContext';
import type { Route } from '@/lib/router';
import { Sparkles, Scissors, Leaf } from 'lucide-react';

interface AboutPageProps {
  navigate: (r: Route) => void;
}

export function AboutPage({ navigate }: AboutPageProps) {
  const { t } = useI18n();

  return (
    <div className="bg-white min-h-screen pt-16 md:pt-20">
      {/* Hero */}
      <section className="relative h-[420px] md:h-[520px] overflow-hidden">
        <img
          src="https://images.pexels.com/photos/7450781/pexels-photo-7450781.jpeg?auto=compress&cs=tinysrgb&h=1200&w=1920"
          alt="About"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white px-4">
          <div>
            <p className="text-[12px] tracking-[0.3em] uppercase text-white/70 mb-4">Maison</p>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-light tracking-tight mb-4">{t('about_title')}</h1>
            <p className="text-base md:text-lg font-light text-white/80">{t('about_subtitle')}</p>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-3xl mx-auto px-4 md:px-8 py-20 md:py-28 text-center">
        <p className="text-[16px] md:text-[18px] leading-[1.8] text-neutral-700 font-light mb-8">
          {t('about_p1')}
        </p>
        <p className="text-[16px] md:text-[18px] leading-[1.8] text-neutral-700 font-light">
          {t('about_p2')}
        </p>
      </section>

      {/* Stats */}
      <section className="bg-neutral-50 py-16 md:py-20">
        <div className="max-w-[1000px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-3 gap-6 md:gap-12">
            {[
              { icon: Leaf, val: t('about_stat1_val'), label: t('about_stat1') },
              { icon: Scissors, val: t('about_stat2_val'), label: t('about_stat2') },
              { icon: Sparkles, val: t('about_stat3_val'), label: t('about_stat3') },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 mb-4 text-neutral-700">
                  <s.icon size={24} strokeWidth={1.2} />
                </div>
                <p className="text-2xl md:text-3xl font-light text-neutral-900 mb-1">{s.val}</p>
                <p className="text-[12px] md:text-[13px] tracking-wide text-neutral-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
