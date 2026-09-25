import { useI18n } from '@/i18n/I18nContext';
import { formatPrice } from '@/i18n/translations';
import { useNav } from '@/context/NavContext';
import { LAST_ORDER_KEY } from '@/lib/checkout';
import type { PlacedOrder } from '@/types';
import { Check } from 'lucide-react';

function readLastOrder(): PlacedOrder | null {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function OrderPage() {
  const { locale, t } = useI18n();
  const { navigate } = useNav();
  const order = readLastOrder();

  return (
    <div className="bg-white min-h-screen pt-16 md:pt-20 flex items-center justify-center">
      <div className="text-center px-4 py-20 max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-neutral-900 text-white">
          <Check size={28} strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-neutral-900 mb-4">{t('order_thanks')}</h1>
        {order && (
          <div className="text-[14px] text-neutral-600 space-y-2 mb-10">
            <p>{t('order_number')}: <span className="text-neutral-900 font-medium">#{order.number}</span></p>
            <p>{t('cart_total')}: {formatPrice(order.total, locale)}</p>
            {order.email && <p className="text-neutral-400">{t('order_email_note', { email: order.email })}</p>}
          </div>
        )}
        <button
          onClick={() => navigate({ name: 'shop' })}
          className="inline-flex items-center gap-2 bg-neutral-900 text-white px-8 py-3.5 text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-neutral-800 transition-colors"
        >
          {t('cart_continue')}
        </button>
      </div>
    </div>
  );
}
