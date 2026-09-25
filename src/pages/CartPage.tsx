import { useI18n } from '@/i18n/I18nContext';
import { localized, formatPrice } from '@/i18n/translations';
import { useCart } from '@/context/CartContext';
import type { Product } from '@/types';
import type { Route } from '@/lib/router';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, ArrowLeft } from 'lucide-react';

interface CartPageProps {
  products: Product[];
  navigate: (r: Route) => void;
}

export function CartPage({ navigate }: CartPageProps) {
  const { locale, t } = useI18n();
  const { items, removeItem, updateQuantity, subtotal, totalItems } = useCart();

  const shipping = subtotal >= 999 || subtotal === 0 ? 0 : 30;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="bg-white min-h-screen pt-16 md:pt-20 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-6 border border-neutral-200 rounded-full text-neutral-300">
            <ShoppingBag size={32} strokeWidth={1} />
          </div>
          <h1 className="text-2xl font-light text-neutral-900 mb-3">{t('cart_empty')}</h1>
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="inline-flex items-center gap-2 bg-neutral-900 text-white px-8 py-3.5 text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-neutral-800 transition-colors"
          >
            {t('cart_continue')}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pt-16 md:pt-20">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-10 md:py-14">
        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-neutral-900 mb-2">
          {t('cart_title')}
        </h1>
        <p className="text-[13px] text-neutral-400 mb-10">{totalItems} {t('shop_results')}</p>

        <div className="grid md:grid-cols-[1fr_350px] gap-8 md:gap-12">
          {/* Items */}
          <div className="space-y-6">
            {items.map(item => {
              const key = `${item.productId}__${item.size}__${item.colorIndex}`;
              return (
                <div key={key} className="flex gap-4 pb-6 border-b border-neutral-100 last:border-b-0">
                  {/* Image */}
                  <button
                    onClick={() => navigate({ name: 'product', slug: item.slug })}
                    className="flex-shrink-0 w-24 h-32 md:w-28 md:h-36 overflow-hidden bg-neutral-100"
                  >
                    <img src={item.image} alt={localized(item.name, locale)} className="w-full h-full object-cover" />
                  </button>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <button
                        onClick={() => navigate({ name: 'product', slug: item.slug })}
                        className="text-[15px] font-medium text-neutral-900 hover:text-neutral-600 transition-colors text-left"
                      >
                        {localized(item.name, locale)}
                      </button>
                      <div className="flex gap-4 mt-1.5 text-[12px] text-neutral-400">
                        <span>{t('cart_size')}: {item.size}</span>
                      </div>
                    </div>

                    {/* Quantity + remove */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="inline-flex items-center border border-neutral-200">
                        <button
                          onClick={() => updateQuantity(item.productId, item.size, item.colorIndex, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-10 text-center text-[13px] font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.size, item.colorIndex, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[15px] font-medium text-neutral-900">
                          {formatPrice(item.price * item.quantity, locale)}
                        </span>
                        <button
                          onClick={() => removeItem(item.productId, item.size, item.colorIndex)}
                          className="text-neutral-300 hover:text-red-500 transition-colors"
                          aria-label={t('cart_remove')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => navigate({ name: 'shop' })}
              className="text-[13px] text-neutral-500 hover:text-neutral-900 transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft size={14} className="rotate-180" />
              {t('cart_continue')}
            </button>
          </div>

          {/* Summary */}
          <div className="md:sticky md:top-28 md:self-start">
            <div className="bg-neutral-50 p-6 md:p-8">
              <h2 className="text-[15px] font-medium text-neutral-900 mb-6 tracking-wide">
                {t('cart_total')}
              </h2>
              <div className="space-y-3 text-[14px]">
                <div className="flex justify-between text-neutral-600">
                  <span>{t('cart_subtotal')}</span>
                  <span>{formatPrice(subtotal, locale)}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>{t('cart_shipping')}</span>
                  <span>{shipping === 0 ? t('cart_free') : formatPrice(shipping, locale)}</span>
                </div>
                <div className="border-t border-neutral-200 pt-3 flex justify-between text-neutral-900 font-medium text-[16px]">
                  <span>{t('cart_total')}</span>
                  <span>{formatPrice(total, locale)}</span>
                </div>
              </div>
              <button className="w-full mt-6 bg-neutral-900 text-white py-4 text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-neutral-800 transition-colors">
                {t('cart_checkout')}
              </button>
              {subtotal < 999 && subtotal > 0 && (
                <p className="text-[12px] text-neutral-400 mt-3 text-center">
                  {formatPrice(999 - subtotal, locale)} {t('free_ship_note')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
