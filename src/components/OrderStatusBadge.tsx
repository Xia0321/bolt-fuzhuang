import { useI18n } from '@/i18n/I18nContext';
import type { OrderStatus } from '@/types';

const STYLES: Partial<Record<OrderStatus, string>> = {
  FULFILLED: 'bg-emerald-50 text-emerald-700',
  PARTIALLY_FULFILLED: 'bg-emerald-50 text-emerald-700',
  CANCELED: 'bg-neutral-100 text-neutral-500',
  EXPIRED: 'bg-neutral-100 text-neutral-500',
  RETURNED: 'bg-neutral-100 text-neutral-500',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  return (
    <span className={`inline-block px-2 py-0.5 text-[12px] ${STYLES[status] ?? 'bg-amber-50 text-amber-800'}`}>
      {t(`order_status_${status}`)}
    </span>
  );
}
