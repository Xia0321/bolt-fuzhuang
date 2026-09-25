import { useI18n } from '@/i18n/I18nContext';
import { localized } from '@/i18n/translations';
import type { Category, Product } from '@/types';
import type { Route } from '@/lib/router';
import { ProductCard } from '@/components/ProductCard';
import { ArrowRight, Sparkles, Scissors, Leaf, Globe } from 'lucide-react';

interface HomePageProps {
  categories: Category[];
  products: Product[];
  navigate: (r: Route) => void;
}

export function HomePage({ categories, products, navigate }: HomePageProps) {
  const { locale, t } = useI18n();
  const featured = products.filter(p => p.featured).sort((a, b) => a.sort_order - b.sort_order).slice(0, 8);

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/7871178/pexels-photo-7871178.jpeg?auto=compress&cs=tinysrgb&h=1200&w=1920"
            alt="Hero"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>
        <div className="relative z-10 text-center text-white px-4 max-w-3xl">
          <p className="text-[12px] md:text-[13px] tracking-[0.3em] uppercase mb-6 opacity-80 animate-[fadeInUp_0.8s_ease-out]">
            {t('hero_eyebrow')}
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[1.1] mb-6 animate-[fadeInUp_1s_ease-out]">
            {t('hero_title')}
          </h1>
          <p className="text-base md:text-lg font-light text-white/85 leading-relaxed max-w-xl mx-auto mb-10 animate-[fadeInUp_1.2s_ease-out]">
            {t('hero_subtitle')}
          </p>
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="inline-flex items-center gap-2 bg-white text-neutral-900 px-8 py-3.5 text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-neutral-100 transition-all duration-300 group animate-[fadeInUp_1.4s_ease-out]"
          >
            {t('hero_cta')}
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="w-px h-12 bg-white/40 animate-pulse" />
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 md:py-28 max-w-[1400px] mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <p className="text-[11px] tracking-[0.25em] uppercase text-neutral-400 mb-2">{t('section_categories_sub')}</p>
          <h2 className="text-2xl md:text-4xl font-light tracking-tight text-neutral-900">{t('section_categories')}</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {categories.map((cat, i) => (
            <button
              key={cat.id}
              onClick={() => navigate({ name: 'shop', category: cat.slug })}
              className="group relative aspect-[3/4] overflow-hidden bg-neutral-100 text-left"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <img
                src={cat.image_url || ''}
                alt={localized(cat.name, locale)}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                <h3 className="text-white text-lg md:text-xl font-light tracking-wide mb-1">
                  {localized(cat.name, locale)}
                </h3>
                <p className="text-white/70 text-[12px] md:text-[13px] line-clamp-2 mb-2">
                  {localized(cat.description, locale)}
                </p>
                <span className="inline-flex items-center gap-1.5 text-white/90 text-[11px] tracking-[0.15em] uppercase font-medium">
                  {t('product_view')}
                  <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="py-20 md:py-28 bg-neutral-50">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-4">
            <div>
              <p className="text-[11px] tracking-[0.25em] uppercase text-neutral-400 mb-2">{t('section_featured_sub')}</p>
              <h2 className="text-2xl md:text-4xl font-light tracking-tight text-neutral-900">{t('section_featured')}</h2>
            </div>
            <button
              onClick={() => navigate({ name: 'shop' })}
              className="inline-flex items-center gap-2 text-[13px] tracking-[0.15em] uppercase font-medium text-neutral-900 hover:gap-3 transition-all"
            >
              {t('nav_shop')}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {featured.map(p => (
              <ProductCard key={p.id} product={p} navigate={navigate} />
            ))}
          </div>
        </div>
      </section>

      {/* Lookbook banner */}
      <section className="relative h-[400px] md:h-[500px] overflow-hidden">
        <img
          src="https://images.pexels.com/photos/7871180/pexels-photo-7871180.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1920"
          alt="Lookbook"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white px-4">
          <div>
            <p className="text-[11px] tracking-[0.25em] uppercase text-white/70 mb-3">{t('section_lookbook_sub')}</p>
            <h2 className="text-3xl md:text-5xl font-light tracking-tight mb-8">{t('section_lookbook')}</h2>
            <button
              onClick={() => navigate({ name: 'shop' })}
              className="inline-flex items-center gap-2 border border-white/80 text-white px-8 py-3 text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-white hover:text-neutral-900 transition-all duration-300"
            >
              {t('hero_cta')}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Brand values */}
      <section className="py-20 md:py-28 max-w-[1400px] mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="text-[11px] tracking-[0.25em] uppercase text-neutral-400 mb-2">Maison</p>
          <h2 className="text-2xl md:text-4xl font-light tracking-tight text-neutral-900">{t('section_values')}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6">
          {[
            { icon: Sparkles, title: t('value1_title'), desc: t('value1_desc') },
            { icon: Scissors, title: t('value2_title'), desc: t('value2_desc') },
            { icon: Leaf, title: t('value3_title'), desc: t('value3_desc') },
            { icon: Globe, title: t('value4_title'), desc: t('value4_desc') },
          ].map((v, i) => (
            <div key={i} className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 mb-5 border border-neutral-200 rounded-full text-neutral-800">
                <v.icon size={22} strokeWidth={1.2} />
              </div>
              <h3 className="text-[15px] font-medium text-neutral-900 mb-2">{v.title}</h3>
              <p className="text-[13px] text-neutral-500 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
