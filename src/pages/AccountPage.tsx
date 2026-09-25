import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { formatDate, formatPrice } from '@/i18n/translations';
import { useNav } from '@/context/NavContext';
import { useAuth } from '@/context/AuthContext';
import { createAddress, deleteAddress, fetchMyOrders, setDefaultAddress, stripSaved, updateAddress } from '@/lib/account';
import { emptyAddress } from '@/lib/checkout';
import { SaleorError } from '@/lib/saleor';
import { CHANNELS } from '@/config';
import { AddressFields, AddressSummary } from '@/components/AddressFields';
import { ErrorNote, PrimaryButton } from '@/components/Form';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import type { Address, OrderSummary, SavedAddress } from '@/types';
import { ChevronRight, Loader2, Plus } from 'lucide-react';

export function AccountPage({ tab = 'orders' }: { tab?: 'orders' | 'addresses' }) {
  const { t } = useI18n();
  const { navigate } = useNav();
  const { user, ready, logout } = useAuth();

  // 未登录时前往登录页，登录后返回
  useEffect(() => {
    if (ready && !user) navigate({ name: 'login', next: tab === 'addresses' ? '/account/addresses' : '/account' }, { replace: true });
  }, [ready, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <div className="bg-white min-h-screen pt-16 md:pt-20 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  const tabClass = (active: boolean) =>
    `pb-3 text-[13px] tracking-wide uppercase font-medium transition-colors border-b ${
      active ? 'text-neutral-900 border-neutral-900' : 'text-neutral-400 border-transparent hover:text-neutral-700'
    }`;

  return (
    <div className="bg-white min-h-screen pt-16 md:pt-20">
      <div className="max-w-[880px] mx-auto px-4 md:px-8 py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-light tracking-tight text-neutral-900 mb-2">{t('account_title')}</h1>
            <p className="text-[14px] text-neutral-500">{user.email}</p>
          </div>
          <button
            onClick={() => { logout(); navigate({ name: 'home' }); }}
            className="text-[13px] text-neutral-500 underline hover:text-neutral-900"
          >
            {t('account_logout')}
          </button>
        </div>
        <div className="flex gap-8 border-b border-neutral-200 mb-8">
          <button className={tabClass(tab === 'orders')} onClick={() => navigate({ name: 'account', tab: 'orders' })}>
            {t('account_orders')}
          </button>
          <button className={tabClass(tab === 'addresses')} onClick={() => navigate({ name: 'account', tab: 'addresses' })}>
            {t('account_addresses')}
          </button>
        </div>
        {tab === 'orders' ? <OrderList /> : <AddressBook addresses={user.addresses} />}
      </div>
    </div>
  );
}

function OrderList() {
  const { locale, t } = useI18n();
  const { navigate } = useNav();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchMyOrders().then(setOrders).catch(() => setError(true));
  }, []);

  if (error) return <p className="text-neutral-400 text-[14px]">{t('error_load')}</p>;
  if (!orders) return <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-neutral-400" /></div>;
  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-400 mb-4">{t('account_no_orders')}</p>
        <button onClick={() => navigate({ name: 'shop' })} className="text-neutral-900 underline text-sm">{t('cart_continue')}</button>
      </div>
    );
  }

  return (
    <div className="divide-y divide-neutral-100 border-y border-neutral-100">
      {orders.map(order => (
        <button
          key={order.id}
          onClick={() => navigate({ name: 'order', id: order.id })}
          className="w-full flex items-center gap-4 py-4 text-left hover:bg-neutral-50 transition-colors px-1"
        >
          <div className="w-14 h-16 flex-shrink-0 bg-neutral-100 overflow-hidden">
            {order.image && <img src={order.image} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0 text-[14px]">
            <p className="text-neutral-900 font-medium">#{order.number}</p>
            <p className="text-neutral-400 mt-0.5">
              {formatDate(order.created, locale)} · {t('account_order_items', { n: order.itemCount })}
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[14px] text-neutral-900">{formatPrice(order.total, locale)}</p>
            <OrderStatusBadge status={order.status} />
          </div>
          <ChevronRight size={16} className="text-neutral-300 flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}

function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  const { t } = useI18n();
  const { setUser } = useAuth();
  // null：不在编辑；'new'：新增；其他：正在编辑的地址 ID
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error_generic'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorNote>{error}</ErrorNote>}
      {addresses.length === 0 && editing !== 'new' && <p className="text-[14px] text-neutral-400">{t('address_empty')}</p>}

      {addresses.map(a => editing === a.id ? (
        <AddressForm
          key={a.id}
          initial={stripSaved(a)}
          initialDefault={a.isDefaultShipping}
          onCancel={() => setEditing(null)}
          onSave={async (address, makeDefault) => {
            setUser(await updateAddress(a.id, address, makeDefault && !a.isDefaultShipping));
            setEditing(null);
          }}
        />
      ) : (
        <div key={a.id} className="border border-neutral-200 p-5 text-[14px] text-neutral-600 leading-relaxed">
          {a.isDefaultShipping && (
            <span className="inline-block mb-2 px-2 py-0.5 text-[11px] tracking-wide bg-neutral-900 text-white">{t('address_default')}</span>
          )}
          <AddressSummary address={a} />
          <div className="flex flex-wrap gap-5 mt-4 text-[13px]">
            <button onClick={() => { setEditing(a.id); setConfirmDelete(null); }} className="underline hover:text-neutral-900">
              {t('address_edit')}
            </button>
            {!a.isDefaultShipping && (
              <button
                disabled={busyId === a.id}
                onClick={() => run(a.id, async () => setUser(await setDefaultAddress(a.id)))}
                className="underline hover:text-neutral-900"
              >
                {t('address_set_default')}
              </button>
            )}
            {confirmDelete === a.id ? (
              <button
                disabled={busyId === a.id}
                onClick={() => run(a.id, async () => { setUser(await deleteAddress(a.id)); setConfirmDelete(null); })}
                className="underline text-red-600"
              >
                {t('address_confirm_delete')}
              </button>
            ) : (
              <button onClick={() => setConfirmDelete(a.id)} className="underline hover:text-red-600">{t('address_delete')}</button>
            )}
            {busyId === a.id && <Loader2 size={14} className="animate-spin text-neutral-400" />}
          </div>
        </div>
      ))}

      {editing === 'new' ? (
        <AddressForm
          initialDefault={addresses.length === 0}
          onCancel={() => setEditing(null)}
          onSave={async (address, makeDefault) => {
            setUser(await createAddress(address, makeDefault));
            setEditing(null);
          }}
        />
      ) : (
        <button
          onClick={() => { setEditing('new'); setConfirmDelete(null); }}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-neutral-300 py-4 text-[13px] tracking-wide text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
        >
          <Plus size={14} />
          {t('address_add')}
        </button>
      )}
    </div>
  );
}

function AddressForm({ initial, initialDefault, onSave, onCancel }: {
  initial?: Address;
  initialDefault: boolean;
  onSave: (address: Address, makeDefault: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const { channel, t } = useI18n();
  const defaultCountry = CHANNELS.find(c => c.slug === channel)?.defaultCountry ?? '';
  const [address, setAddress] = useState<Address>(() => initial ?? emptyAddress(defaultCountry));
  const [makeDefault, setMakeDefault] = useState(initialDefault);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave(address, makeDefault);
    } catch (err) {
      const field = err instanceof SaleorError && err.field ? `${err.field}: ` : '';
      setError(field + (err instanceof Error ? err.message : t('error_generic')));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border border-neutral-900 p-5 space-y-4">
      {error && <ErrorNote>{error}</ErrorNote>}
      <AddressFields address={address} setAddress={setAddress} />
      <label className="flex items-center gap-2 text-[14px] text-neutral-700">
        <input type="checkbox" checked={makeDefault} disabled={initialDefault && !!initial} onChange={e => setMakeDefault(e.target.checked)} />
        {t('address_make_default')}
      </label>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <PrimaryButton busy={busy}>{t('address_save')}</PrimaryButton>
        <button type="button" onClick={onCancel} className="px-6 border border-neutral-200 text-[13px] text-neutral-600 hover:border-neutral-900">
          {t('address_cancel')}
        </button>
      </div>
    </form>
  );
}
