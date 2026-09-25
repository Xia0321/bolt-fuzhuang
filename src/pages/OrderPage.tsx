import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { formatDate, formatPrice } from '@/i18n/translations';
import { useNav } from '@/context/NavContext';
import { useAuth } from '@/context/AuthContext';
import { LAST_ORDER_KEY } from '@/lib/checkout';
import { fetchOrder } from '@/lib/account';
import { AddressSummary } from '@/components/AddressFields';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import type { OrderDetail, PlacedOrder } from '@/types';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';

function readLastOrder(): PlacedOrder | null {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// /order/<订单ID>：订单详情（游客凭专属链接即可查看）；刚下单时额外显示感谢语
export function OrderPage({ id: routeId }: { id?: string }) {
  const { locale, t } = useI18n();
  const { navigate } = useNav();
  const { user } = useAuth();
  const lastOrder = readLastOrder();
  const id = routeId ?? lastOrder?.id;
  const justPlaced = !!id && lastOrder?.id === id;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    fetchOrder(id)
      .then(o => { if (!cancelled) setOrder(o); })
      .catch(() => { if (!cancelled) setOrder(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // 旧链接 /order 且本次会话没有下单记录
  useEffect(() => {
    if (!routeId && id) navigate({ name: 'order', id }, { replace: true });
  }, [routeId, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="bg-white min-h-screen pt-16 md:pt-20 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-white min-h-screen pt-16 md:pt-20 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-neutral-400 text-lg mb-4">{t('order_not_found')}</p>
          <button onClick={() => navigate({ name: 'shop' })} className="text-neutral-900 underline text-sm">{t('cart_continue')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pt-16 md:pt-20">
      <div className="max-w-[880px] mx-auto px-4 md:px-8 py-10 md:py-14">
        {justPlaced ? (
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-neutral-900 text-white">
              <Check size={28} strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl md:text-3xl font-light tracking-tight text-neutral-900 mb-3">{t('order_thanks')}</h1>
            <p className="text-[14px] text-neutral-500 max-w-md mx-auto leading-relaxed">{t('order_save_link')}</p>
            {!user && (
              <p className="text-[14px] text-neutral-500 mt-2">
                {t('order_register_hint')}{' '}
                <button onClick={() => navigate({ name: 'register' })} className="underline text-neutral-900">{t('auth_register_title')}</button>
              </p>
            )}
          </div>
        ) : (
          <>
            {user && (
              <button
                onClick={() => navigate({ name: 'account' })}
                className="inline-flex items-center gap-2 text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors mb-6"
              >
                <ArrowLeft size={14} />
                {t('account_orders')}
              </button>
            )}
            <h1 className="text-2xl md:text-3xl font-light tracking-tight text-neutral-900 mb-8">{t('order_title')}</h1>
          </>
        )}

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-neutral-200 py-5 mb-8 text-[14px]">
          <p><span className="text-neutral-400">{t('order_number')} </span><span className="text-neutral-900 font-medium">#{order.number}</span></p>
          <p><span className="text-neutral-400">{t('order_placed_on')} </span><span className="text-neutral-900">{formatDate(order.created, locale, true)}</span></p>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="grid md:grid-cols-[1fr_300px] gap-10">
          <section>
            <h2 className="text-[15px] font-medium text-neutral-900 mb-5 tracking-wide">{t('order_items')}</h2>
            <div className="space-y-4 mb-6">
              {order.lines.map((line, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-16 h-20 flex-shrink-0 bg-neutral-100 overflow-hidden">
                    {line.image && <img src={line.image} alt={line.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 text-[14px]">
                    <p className="text-neutral-900">{line.name}</p>
                    <p className="text-neutral-400 mt-0.5">{line.variant} × {line.quantity}</p>
                  </div>
                  <p className="text-[14px] text-neutral-900">{formatPrice(line.totalPrice, locale)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3 text-[14px] border-t border-neutral-200 pt-4">
              <div className="flex justify-between text-neutral-600">
                <span>{t('cart_subtotal')}</span><span>{formatPrice(order.subtotal, locale)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>{t('cart_shipping')}</span>
                <span>{order.shipping.amount === 0 ? t('cart_free') : formatPrice(order.shipping, locale)}</span>
              </div>
              <div className="border-t border-neutral-200 pt-3 flex justify-between text-neutral-900 font-medium text-[16px]">
                <span>{t('cart_total')}</span><span>{formatPrice(order.total, locale)}</span>
              </div>
            </div>
          </section>

          <aside className="space-y-8 text-[14px] text-neutral-600 leading-relaxed">
            <div>
              <h3 className="text-[13px] font-medium text-neutral-900 mb-2 tracking-wide">{t('order_tracking')}</h3>
              {order.shipments.length > 0
                ? order.shipments.map(s => (
                  <p key={s.trackingNumber}>
                    <span className="text-neutral-900 font-medium select-all">{s.trackingNumber}</span>
                    <span className="text-neutral-400"> · {formatDate(s.created, locale)}</span>
                  </p>
                ))
                : <p className="text-neutral-400">{t('order_no_tracking')}</p>}
            </div>
            {order.shippingAddress && (
              <div>
                <h3 className="text-[13px] font-medium text-neutral-900 mb-2 tracking-wide">{t('order_shipping_to')}</h3>
                <AddressSummary address={order.shippingAddress} />
              </div>
            )}
            {order.shippingMethod && (
              <div>
                <h3 className="text-[13px] font-medium text-neutral-900 mb-2 tracking-wide">{t('order_shipping_method')}</h3>
                <p>{order.shippingMethod}</p>
              </div>
            )}
            <div>
              <h3 className="text-[13px] font-medium text-neutral-900 mb-2 tracking-wide">{t('checkout_email')}</h3>
              <p>{order.email}</p>
            </div>
          </aside>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          {user && justPlaced && (
            <button
              onClick={() => navigate({ name: 'account' })}
              className="border border-neutral-900 text-neutral-900 px-8 py-3.5 text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-neutral-50 transition-colors"
            >
              {t('order_view_mine')}
            </button>
          )}
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="bg-neutral-900 text-white px-8 py-3.5 text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-neutral-800 transition-colors"
          >
            {t('cart_continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
