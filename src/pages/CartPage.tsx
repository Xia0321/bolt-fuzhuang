import { useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { formatPrice } from '@/i18n/translations';
import { useCart } from '@/context/CartContext';
import { useStore } from '@/context/StoreContext';
import { useNav } from '@/context/NavContext';
import { estimateShipping, freeShippingThreshold } from '@/lib/catalog';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

export function CartPage() {
  const { locale, t } = useI18n();
  const { store } = useStore();
  const { navigate } = useNav();
  const { checkout, loading, removeItem, updateQuantity, totalItems } = useCart();
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [error, setError] = useState('');

  const run = async (lineId: string, action: () => Promise<void>) => {
    setBusyLine(lineId);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error && /stock/i.test(e.message) ? t('error_stock') : t('error_generic'));
    } finally {
      setBusyLine(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen pt-16 md:pt-20 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!checkout || checkout.lines.length === 0) {
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

  const { subtotal } = checkout;
  // 购物袋阶段还没有收货地址，按后台配置的运费规则预估；结算时以 Saleor 计算为准
  const rules = store?.shippingRules ?? [];
  const shipping = estimateShipping(rules, subtotal.amount);
  const threshold = freeShippingThreshold(rules);
  const total = { amount: subtotal.amount + (shipping?.amount ?? 0), currency: subtotal.currency };

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
            {error && <p className="text-[13px] text-red-500">{error}</p>}
            {checkout.lines.map(item => (
              <div key={item.id} className={`flex gap-4 pb-6 border-b border-neutral-100 last:border-b-0 transition-opacity ${busyLine === item.id ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Image */}
                <button
                  onClick={() => navigate({ name: 'product', slug: item.productSlug })}
                  className="flex-shrink-0 w-24 h-32 md:w-28 md:h-36 overflow-hidden bg-neutral-100"
                >
                  {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover" />}
                </button>

                {/* Info */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <button
                      onClick={() => navigate({ name: 'product', slug: item.productSlug })}
                      className="text-[15px] font-medium text-neutral-900 hover:text-neutral-600 transition-colors text-left"
                    >
                      {item.name}
                    </button>
                    <div className="flex gap-4 mt-1.5 text-[12px] text-neutral-400">
                      {item.color && <span>{t('cart_color')}: {item.color}</span>}
                      {item.size && <span>{t('cart_size')}: {item.size}</span>}
                    </div>
                  </div>

                  {/* Quantity + remove */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="inline-flex items-center border border-neutral-200">
                      <button
                        onClick={() => run(item.id, () => updateQuantity(item.id, item.quantity - 1))}
                        disabled={item.quantity <= 1}
                        className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors disabled:text-neutral-300"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-10 text-center text-[13px] font-medium">{item.quantity}</span>
                      <button
                        onClick={() => run(item.id, () => updateQuantity(item.id, item.quantity + 1))}
                        disabled={item.quantity >= item.quantityAvailable}
                        className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors disabled:text-neutral-300"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[15px] font-medium text-neutral-900">
                        {formatPrice(item.totalPrice, locale)}
                      </span>
                      <button
                        onClick={() => run(item.id, () => removeItem(item.id))}
                        className="text-neutral-300 hover:text-red-500 transition-colors"
                        aria-label={t('cart_remove')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={() => navigate({ name: 'shop' })}
              className="text-[13px] text-neutral-500 hover:text-neutral-900 transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
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
                {shipping && (
                  <div className="flex justify-between text-neutral-600">
                    <span>{t('cart_shipping_estimate')}</span>
                    <span>{shipping.amount === 0 ? t('cart_free') : formatPrice(shipping, locale)}</span>
                  </div>
                )}
                <div className="border-t border-neutral-200 pt-3 flex justify-between text-neutral-900 font-medium text-[16px]">
                  <span>{t('cart_total')}</span>
                  <span>{formatPrice(total, locale)}</span>
                </div>
              </div>
              <button
                onClick={() => navigate({ name: 'checkout' })}
                className="w-full mt-6 bg-neutral-900 text-white py-4 text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-neutral-800 transition-colors"
              >
                {t('cart_checkout')}
              </button>
              {threshold != null && subtotal.amount < threshold && (
                <p className="text-[12px] text-neutral-400 mt-3 text-center">
                  {t('free_ship_remaining', { amount: formatPrice({ amount: threshold - subtotal.amount, currency: subtotal.currency }, locale) })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
