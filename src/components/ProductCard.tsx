import { useI18n } from '@/i18n/I18nContext';
import { useNav } from '@/context/NavContext';
import { formatPrice } from '@/i18n/translations';
import type { Product } from '@/types';
import { ShoppingBag } from 'lucide-react';

export function ProductCard({ product }: { product: Product }) {
  const { locale, t } = useI18n();
  const { navigate } = useNav();

  return (
    <div className="group cursor-pointer" onClick={() => navigate({ name: 'product', slug: product.slug })}>
      <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100 mb-3">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          loading="lazy"
        />
        {/* Hover image */}
        {product.images[1] && (
          <img
            src={product.images[1]}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            loading="lazy"
          />
        )}
        {/* Quick add overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm py-3 px-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <div className="flex items-center justify-center gap-2 text-[12px] tracking-wide uppercase font-medium text-neutral-900">
            <ShoppingBag size={14} strokeWidth={1.5} />
            {t('product_view')}
          </div>
        </div>
        {!product.isAvailable ? (
          <span className="absolute top-3 left-3 bg-neutral-900/80 backdrop-blur-sm text-white text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 font-medium">
            {t('product_sold_out')}
          </span>
        ) : product.featured && (
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-neutral-900 text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 font-medium">
            {t('product_new')}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-[14px] font-medium text-neutral-900 leading-snug line-clamp-2">
          {product.name}
        </h3>
        <p className="text-[13px] text-neutral-500">
          {formatPrice(product.price, locale)}
        </p>
      </div>
    </div>
  );
}
