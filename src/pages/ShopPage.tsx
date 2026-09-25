import { useState, useMemo } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useStore } from '@/context/StoreContext';
import { useNav } from '@/context/NavContext';
import { ProductCard } from '@/components/ProductCard';
import { SlidersHorizontal } from 'lucide-react';

type SortMode = 'newest' | 'price_low' | 'price_high';

export function ShopPage({ category }: { category?: string }) {
  const { t } = useI18n();
  const { store } = useStore();
  const { navigate } = useNav();
  const { categories, products } = store!;
  const selectedCategory = category;
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  const filtered = useMemo(() => {
    let result = selectedCategory
      ? products.filter(p => {
          const cat = categories.find(c => c.slug === selectedCategory);
          return cat && p.categoryId === cat.id;
        })
      : products;

    switch (sortMode) {
      case 'price_low':
        result = [...result].sort((a, b) => (a.price?.amount ?? 0) - (b.price?.amount ?? 0));
        break;
      case 'price_high':
        result = [...result].sort((a, b) => (b.price?.amount ?? 0) - (a.price?.amount ?? 0));
        break;
      default:
        // 接口已按上架时间倒序返回
        break;
    }
    return result;
  }, [products, categories, selectedCategory, sortMode]);

  const activeCat = categories.find(c => c.slug === selectedCategory);

  return (
    <div className="bg-white min-h-screen pt-16 md:pt-20">
      {/* Header */}
      <div className="border-b border-neutral-100">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 md:py-14">
          <div className="text-center">
            <h1 className="text-3xl md:text-5xl font-light tracking-tight text-neutral-900 mb-3">
              {activeCat ? activeCat.name : t('shop_title')}
            </h1>
            <p className="text-[14px] text-neutral-500 max-w-lg mx-auto">
              {activeCat ? activeCat.description : t('section_featured_sub')}
            </p>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="sticky top-16 md:top-20 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-100">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          {/* Category tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
            <button
              onClick={() => navigate({ name: 'shop' })}
              className={`text-[12px] md:text-[13px] tracking-wide uppercase font-medium px-3 py-1.5 whitespace-nowrap transition-colors ${!selectedCategory ? 'text-neutral-900 border-b border-neutral-900' : 'text-neutral-400 hover:text-neutral-700'}`}
            >
              {t('shop_all')}
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate({ name: 'shop', category: cat.slug })}
                className={`text-[12px] md:text-[13px] tracking-wide uppercase font-medium px-3 py-1.5 whitespace-nowrap transition-colors ${selectedCategory === cat.slug ? 'text-neutral-900 border-b border-neutral-900' : 'text-neutral-400 hover:text-neutral-700'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative flex items-center gap-2 flex-shrink-0">
            <SlidersHorizontal size={15} className="text-neutral-400" />
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="text-[12px] md:text-[13px] text-neutral-700 bg-transparent border-none outline-none cursor-pointer font-medium"
            >
              <option value="newest">{t('sort_newest')}</option>
              <option value="price_low">{t('sort_price_low')}</option>
              <option value="price_high">{t('sort_price_high')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products grid */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 md:py-14">
        <p className="text-[13px] text-neutral-400 mb-8">
          {filtered.length} {t('shop_results')}
        </p>
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-400 text-lg">{t('shop_no_results')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
