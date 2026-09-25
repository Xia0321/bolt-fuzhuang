import { useI18n } from '@/i18n/I18nContext';
import { useStore } from '@/context/StoreContext';
import { useNav } from '@/context/NavContext';
import { ProductCard } from '@/components/ProductCard';
import { FeatureIcon } from '@/components/FeatureIcon';
import { ArrowRight } from 'lucide-react';

export function HomePage() {
  const { t } = useI18n();
  const { store } = useStore();
  const { navigate, navigateUrl } = useNav();
  const { categories, products, banners, features, site } = store!;
  // 首页横幅、品牌承诺都在 Saleor 后台「页面」中配置
  const hero = banners['home-hero'];
  const lookbook = banners['home-lookbook'];
  const values = features.filter(f => f.placement === 'home-values');
  const featured = products.filter(p => p.featured).slice(0, 8);

  return (
    <div className="bg-white">
      {/* Hero */}
      {hero && (
      <section className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          {hero.imageUrl && (
            <img
              src={hero.imageUrl}
              alt={hero.title}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/30" />
        </div>
        <div className="relative z-10 text-center text-white px-4 max-w-3xl">
          <p className="text-[12px] md:text-[13px] tracking-[0.3em] uppercase mb-6 opacity-80 animate-[fadeInUp_0.8s_ease-out]">
            {hero.eyebrow}
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[1.1] mb-6 animate-[fadeInUp_1s_ease-out]">
            {hero.title}
          </h1>
          <p className="text-base md:text-lg font-light text-white/85 leading-relaxed max-w-xl mx-auto mb-10 animate-[fadeInUp_1.2s_ease-out]">
            {hero.subtitle}
          </p>
          {hero.buttonText && (
          <button
            onClick={() => navigateUrl(hero.buttonLink || '/shop')}
            className="inline-flex items-center gap-2 bg-white text-neutral-900 px-8 py-3.5 text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-neutral-100 transition-all duration-300 group animate-[fadeInUp_1.4s_ease-out]"
          >
            {hero.buttonText}
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
          )}
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="w-px h-12 bg-white/40 animate-pulse" />
        </div>
      </section>
      )}

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
                src={cat.imageUrl || ''}
                alt={cat.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                <h3 className="text-white text-lg md:text-xl font-light tracking-wide mb-1">
                  {cat.name}
                </h3>
                <p className="text-white/70 text-[12px] md:text-[13px] line-clamp-2 mb-2">
                  {cat.description}
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
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Lookbook banner */}
      {lookbook && (
      <section className="relative h-[400px] md:h-[500px] overflow-hidden">
        {lookbook.imageUrl && (
          <img
            src={lookbook.imageUrl}
            alt={lookbook.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white px-4">
          <div>
            <p className="text-[11px] tracking-[0.25em] uppercase text-white/70 mb-3">{lookbook.eyebrow}</p>
            <h2 className="text-3xl md:text-5xl font-light tracking-tight mb-8">{lookbook.title}</h2>
            {lookbook.buttonText && (
            <button
              onClick={() => navigateUrl(lookbook.buttonLink || '/shop')}
              className="inline-flex items-center gap-2 border border-white/80 text-white px-8 py-3 text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-white hover:text-neutral-900 transition-all duration-300"
            >
              {lookbook.buttonText}
              <ArrowRight size={16} />
            </button>
            )}
          </div>
        </div>
      </section>
      )}

      {/* Brand values */}
      {values.length > 0 && (
      <section className="py-20 md:py-28 max-w-[1400px] mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="text-[11px] tracking-[0.25em] uppercase text-neutral-400 mb-2">{site.brandName}</p>
          <h2 className="text-2xl md:text-4xl font-light tracking-tight text-neutral-900">{t('section_values')}</h2>
        </div>
        {/* 条目数量由后台决定，用 flex 居中以适配 3 条、4 条等情况 */}
        <div className="flex flex-wrap justify-center gap-y-8">
          {values.map((v, i) => (
            <div key={i} className="text-center w-1/2 md:w-1/4 px-3">
              <div className="inline-flex items-center justify-center w-14 h-14 mb-5 border border-neutral-200 rounded-full text-neutral-800">
                <FeatureIcon name={v.icon} size={22} strokeWidth={1.2} />
              </div>
              <h3 className="text-[15px] font-medium text-neutral-900 mb-2">{v.title}</h3>
              <p className="text-[13px] text-neutral-500 leading-relaxed">{v.subtitle}</p>
            </div>
          ))}
        </div>
      </section>
      )}
    </div>
  );
}
