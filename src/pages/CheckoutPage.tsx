import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { formatPrice, countryName } from '@/i18n/translations';
import { useCart } from '@/context/CartContext';
import { useNav } from '@/context/NavContext';
import {
  LAST_ORDER_KEY, fetchAddressRules, fetchChannelCountries, payAndComplete, saveContactAndAddress, setDeliveryMethod,
  type AddressRules, type Choice,
} from '@/lib/checkout';
import { SaleorError } from '@/lib/saleor';
import { CHANNELS } from '@/config';
import type { Address } from '@/types';
import { ArrowLeft, Check, Loader2, Lock } from 'lucide-react';

const DUMMY_GATEWAY = 'mirumee.payments.dummy';

// 同一个区域会同时返回本地写法和拉丁写法（如 上海市 / Shanghai Shi），按当前语言各保留一个
function localizeChoices(choices: Choice[], preferLatin: boolean): Choice[] {
  const byRaw = new Map<string, Choice[]>();
  for (const c of choices) byRaw.set(c.raw, [...(byRaw.get(c.raw) ?? []), c]);
  return [...byRaw.values()].map(group => {
    const local = group.find(c => c.verbose === c.raw);
    const latin = group.find(c => c.verbose !== c.raw);
    return (preferLatin ? latin ?? local : local ?? latin) ?? group[0];
  });
}

const emptyAddress = (country: string): Address => ({
  firstName: '', lastName: '', streetAddress1: '', streetAddress2: '', city: '', cityArea: '',
  postalCode: '', country, countryArea: '', phone: '',
});

type Step = 'address' | 'delivery' | 'payment';

export function CheckoutPage() {
  const { locale, channel, languageCode, t } = useI18n();
  const { navigate } = useNav();
  const { checkout, loading, setCheckout, clearCart } = useCart();
  const channelConfig = CHANNELS.find(c => c.slug === channel);

  const [step, setStep] = useState<Step>('address');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState<Address>(() => emptyAddress(channelConfig?.defaultCountry ?? ''));
  const [countries, setCountries] = useState<string[]>([]);
  const [rules, setRules] = useState<AddressRules | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 已填过的信息（例如刷新页面后）回填到表单
  useEffect(() => {
    if (!checkout) return;
    if (checkout.email) setEmail(checkout.email);
    if (checkout.shippingAddress) {
      setAddress(checkout.shippingAddress);
      setStep(checkout.deliveryMethodId ? 'payment' : 'delivery');
    }
  }, [checkout?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchChannelCountries(channel).then(setCountries).catch(() => setCountries([]));
  }, [channel]);

  // 省 → 市 → 区逐级联动：选了上级后重新获取下级的可选项
  useEffect(() => {
    if (!address.country) return;
    let cancelled = false;
    fetchAddressRules(address.country, address.countryArea, address.city)
      .then(r => { if (!cancelled) setRules(r); })
      .catch(() => { if (!cancelled) setRules(null); });
    return () => { cancelled = true; };
  }, [address.country, address.countryArea, address.city]);

  const preferLatin = locale === 'en';
  const areaChoices = useMemo(() => localizeChoices(rules?.countryAreaChoices ?? [], preferLatin), [rules, preferLatin]);
  const cityChoices = useMemo(() => localizeChoices(rules?.cityChoices ?? [], preferLatin), [rules, preferLatin]);
  const cityAreaChoices = useMemo(() => localizeChoices(rules?.cityAreaChoices ?? [], preferLatin), [rules, preferLatin]);

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
        <div className="text-center">
          <p className="text-neutral-400 text-lg mb-4">{t('cart_empty')}</p>
          <button onClick={() => navigate({ name: 'shop' })} className="text-neutral-900 underline text-sm">
            {t('cart_continue')}
          </button>
        </div>
      </div>
    );
  }

  const isRequired = (field: string) => rules?.requiredFields.includes(field) ?? false;
  const isAllowed = (field: string) => rules?.allowedFields.includes(field) ?? true;
  const update = (field: keyof Address) => (value: string) => setAddress(a => ({ ...a, [field]: value }));

  const fieldLabels: Record<string, string> = {
    email: t('checkout_email'), firstName: t('checkout_first_name'), lastName: t('checkout_last_name'),
    country: t('checkout_country'), countryArea: t('checkout_country_area'), city: t('checkout_city'),
    cityArea: t('checkout_city_area'), postalCode: t('checkout_postal_code'), streetAddress1: t('checkout_street1'),
    streetAddress2: t('checkout_street2'), phone: t('checkout_phone'),
  };

  const withBusy = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      // Saleor 的错误信息为英文，前面加上出错字段的名称方便定位
      const label = e instanceof SaleorError && e.field ? fieldLabels[e.field] : '';
      const message = e instanceof Error ? e.message : t('error_generic');
      setError(label ? `${label}: ${message}` : message);
    } finally {
      setBusy(false);
    }
  };

  const submitAddress = (e: FormEvent) => {
    e.preventDefault();
    withBusy(async () => {
      const updated = await saveContactAndAddress(checkout.id, languageCode, email.trim(), address);
      setCheckout(updated);
      // 只有一种可用配送方式时直接选中
      if (updated.shippingOptions.length === 1) {
        setCheckout(await setDeliveryMethod(checkout.id, languageCode, updated.shippingOptions[0].id));
        setStep('payment');
      } else {
        setStep('delivery');
      }
    });
  };

  const chooseDelivery = (id: string) => withBusy(async () => {
    setCheckout(await setDeliveryMethod(checkout.id, languageCode, id));
    setStep('payment');
  });

  const gateway = checkout.paymentGateways[0];
  const placeOrder = () => withBusy(async () => {
    if (!gateway) return;
    const order = await payAndComplete(checkout, gateway.id);
    try {
      sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    } catch {
      // 忽略存储失败，订单页会显示通用提示
    }
    clearCart();
    navigate({ name: 'order' });
  });

  const lastNameFirst = locale !== 'en';
  const nameFields = [
    <Field key="last" label={t('checkout_last_name')} required>
      <input className={inputClass} required value={address.lastName} onChange={e => update('lastName')(e.target.value)} autoComplete="family-name" />
    </Field>,
    <Field key="first" label={t('checkout_first_name')} required>
      <input className={inputClass} required value={address.firstName} onChange={e => update('firstName')(e.target.value)} autoComplete="given-name" />
    </Field>,
  ];
  const selectedDelivery = checkout.shippingOptions.find(o => o.id === checkout.deliveryMethodId);

  return (
    <div className="bg-white min-h-screen pt-16 md:pt-20">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-10 md:py-14">
        <button
          onClick={() => navigate({ name: 'cart' })}
          className="inline-flex items-center gap-2 text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          {t('cart_title')}
        </button>
        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-neutral-900 mb-10">{t('checkout_title')}</h1>

        <div className="grid md:grid-cols-[1fr_380px] gap-10 md:gap-14">
          <div className="space-y-10">
            {error && <p className="text-[13px] text-red-600 bg-red-50 px-4 py-3">{error}</p>}

            {/* 1. 联系方式与地址 */}
            <section>
              <StepHeader
                index={1}
                title={t('checkout_address')}
                done={step !== 'address'}
                onEdit={step !== 'address' ? () => setStep('address') : undefined}
                editLabel={t('checkout_edit')}
              />
              {step === 'address' ? (
                <form onSubmit={submitAddress} className="space-y-4">
                  <Field label={t('checkout_email')} required>
                    <input type="email" className={inputClass} required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                  </Field>
                  <Field label={t('checkout_country')} required>
                    <select
                      className={inputClass}
                      value={address.country}
                      onChange={e => setAddress(a => ({ ...a, country: e.target.value, countryArea: '', city: '', cityArea: '' }))}
                    >
                      {countries
                        .map(code => ({ code, name: countryName(code, locale) }))
                        .sort((a, b) => a.name.localeCompare(b.name, locale))
                        .map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-4">{lastNameFirst ? nameFields : [...nameFields].reverse()}</div>
                  {isAllowed('countryArea') && (
                    <Field label={t('checkout_country_area')} required={isRequired('countryArea')}>
                      {areaChoices.length > 0 ? (
                        <select
                          className={inputClass}
                          required={isRequired('countryArea')}
                          value={address.countryArea}
                          onChange={e => setAddress(a => ({ ...a, countryArea: e.target.value, city: '', cityArea: '' }))}
                        >
                          <option value="">{t('checkout_select')}</option>
                          {areaChoices.map(c => <option key={c.raw} value={c.raw}>{c.verbose}</option>)}
                        </select>
                      ) : (
                        <input className={inputClass} required={isRequired('countryArea')} value={address.countryArea} onChange={e => update('countryArea')(e.target.value)} />
                      )}
                    </Field>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {isAllowed('city') && (
                      <Field label={t('checkout_city')} required={isRequired('city')}>
                        {cityChoices.length > 0 ? (
                          <select
                            className={inputClass}
                            required={isRequired('city')}
                            value={address.city}
                            onChange={e => setAddress(a => ({ ...a, city: e.target.value, cityArea: '' }))}
                          >
                            <option value="">{t('checkout_select')}</option>
                            {cityChoices.map(c => <option key={c.raw} value={c.raw}>{c.verbose}</option>)}
                          </select>
                        ) : (
                          <input className={inputClass} required={isRequired('city')} value={address.city} onChange={e => update('city')(e.target.value)} autoComplete="address-level2" />
                        )}
                      </Field>
                    )}
                    {isAllowed('cityArea') && (
                      <Field label={t('checkout_city_area')} required={isRequired('cityArea')}>
                        {cityAreaChoices.length > 0 ? (
                          <select className={inputClass} required={isRequired('cityArea')} value={address.cityArea} onChange={e => update('cityArea')(e.target.value)}>
                            <option value="">{t('checkout_select')}</option>
                            {cityAreaChoices.map(c => <option key={c.raw} value={c.raw}>{c.verbose}</option>)}
                          </select>
                        ) : (
                          <input className={inputClass} required={isRequired('cityArea')} value={address.cityArea} onChange={e => update('cityArea')(e.target.value)} />
                        )}
                      </Field>
                    )}
                    {isAllowed('postalCode') && (
                      <Field label={t('checkout_postal_code')} required={isRequired('postalCode')}>
                        <input
                          className={inputClass}
                          required={isRequired('postalCode')}
                          value={address.postalCode}
                          placeholder={rules?.postalCodeExamples[0]}
                          onChange={e => update('postalCode')(e.target.value)}
                          autoComplete="postal-code"
                        />
                      </Field>
                    )}
                  </div>
                  <Field label={t('checkout_street1')} required>
                    <input className={inputClass} required value={address.streetAddress1} onChange={e => update('streetAddress1')(e.target.value)} autoComplete="address-line1" />
                  </Field>
                  <Field label={t('checkout_street2')}>
                    <input className={inputClass} value={address.streetAddress2} onChange={e => update('streetAddress2')(e.target.value)} autoComplete="address-line2" />
                  </Field>
                  <Field label={t('checkout_phone')} required>
                    <input type="tel" className={inputClass} required value={address.phone} onChange={e => update('phone')(e.target.value)} autoComplete="tel" />
                  </Field>
                  <PrimaryButton busy={busy}>{t('checkout_continue_shipping')}</PrimaryButton>
                </form>
              ) : (
                <div className="text-[14px] text-neutral-600 leading-relaxed">
                  <p>{email}</p>
                  <p>{[address.lastName, address.firstName].filter(Boolean).join(' ')} · {address.phone}</p>
                  <p>
                    {[address.streetAddress1, address.streetAddress2, address.cityArea, address.city, address.countryArea, address.postalCode]
                      .filter(Boolean).join(', ')}
                    {' · '}{countryName(address.country, locale)}
                  </p>
                </div>
              )}
            </section>

            {/* 2. 配送方式 */}
            <section className={step === 'address' ? 'opacity-40' : ''}>
              <StepHeader
                index={2}
                title={t('checkout_delivery')}
                done={step === 'payment'}
                onEdit={step === 'payment' ? () => setStep('delivery') : undefined}
                editLabel={t('checkout_edit')}
              />
              {step === 'delivery' && (
                <div className="space-y-3">
                  {checkout.shippingOptions.map(option => (
                    <button
                      key={option.id}
                      disabled={busy}
                      onClick={() => chooseDelivery(option.id)}
                      className={`w-full flex items-center justify-between border px-5 py-4 text-left transition-colors ${
                        checkout.deliveryMethodId === option.id ? 'border-neutral-900' : 'border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      <span>
                        <span className="block text-[14px] text-neutral-900">{option.name}</span>
                        {option.minDays != null && option.maxDays != null && (
                          <span className="block text-[12px] text-neutral-400 mt-0.5">
                            {t('checkout_days', { min: option.minDays, max: option.maxDays })}
                          </span>
                        )}
                      </span>
                      <span className="text-[14px] text-neutral-900">
                        {option.price.amount === 0 ? t('cart_free') : formatPrice(option.price, locale)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {step === 'payment' && selectedDelivery && (
                <p className="text-[14px] text-neutral-600">
                  {selectedDelivery.name} · {selectedDelivery.price.amount === 0 ? t('cart_free') : formatPrice(selectedDelivery.price, locale)}
                </p>
              )}
            </section>

            {/* 3. 支付 */}
            <section className={step !== 'payment' ? 'opacity-40' : ''}>
              <StepHeader index={3} title={t('checkout_payment')} done={false} />
              {step === 'payment' && (
                gateway ? (
                  <div className="space-y-4">
                    {gateway.id === DUMMY_GATEWAY && (
                      <p className="text-[13px] text-amber-800 bg-amber-50 px-4 py-3">{t('checkout_test_payment')}</p>
                    )}
                    <button
                      onClick={placeOrder}
                      disabled={busy}
                      className="w-full py-4 bg-neutral-900 text-white text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={14} />}
                      {busy ? t('checkout_placing') : `${t('checkout_pay')} · ${formatPrice(checkout.total, locale)}`}
                    </button>
                  </div>
                ) : (
                  <p className="text-[13px] text-red-600">{t('checkout_no_gateway')}</p>
                )
              )}
            </section>
          </div>

          {/* 订单摘要 */}
          <aside className="md:sticky md:top-28 md:self-start bg-neutral-50 p-6 md:p-8">
            <h2 className="text-[15px] font-medium text-neutral-900 mb-6 tracking-wide">{t('checkout_summary')}</h2>
            <div className="space-y-4 mb-6">
              {checkout.lines.map(line => (
                <div key={line.id} className="flex gap-3">
                  <div className="relative w-16 h-20 flex-shrink-0 bg-neutral-100 overflow-hidden">
                    {line.image && <img src={line.image} alt={line.name} className="w-full h-full object-cover" />}
                    <span className="absolute -top-0 -right-0 bg-neutral-900 text-white text-[10px] w-5 h-5 flex items-center justify-center">{line.quantity}</span>
                  </div>
                  <div className="flex-1 text-[13px]">
                    <p className="text-neutral-900">{line.name}</p>
                    <p className="text-neutral-400 mt-0.5">{[line.color, line.size].filter(Boolean).join(' / ')}</p>
                  </div>
                  <p className="text-[13px] text-neutral-900">{formatPrice(line.totalPrice, locale)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3 text-[14px] border-t border-neutral-200 pt-4">
              <div className="flex justify-between text-neutral-600">
                <span>{t('cart_subtotal')}</span>
                <span>{formatPrice(checkout.subtotal, locale)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>{t('cart_shipping')}</span>
                <span>{checkout.deliveryMethodId ? (checkout.shipping.amount === 0 ? t('cart_free') : formatPrice(checkout.shipping, locale)) : '—'}</span>
              </div>
              <div className="border-t border-neutral-200 pt-3 flex justify-between text-neutral-900 font-medium text-[16px]">
                <span>{t('cart_total')}</span>
                <span>{formatPrice(checkout.total, locale)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

const inputClass = 'w-full border border-neutral-200 px-3.5 py-2.5 text-[14px] text-neutral-900 bg-white focus:outline-none focus:border-neutral-900 transition-colors';

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] tracking-[0.05em] text-neutral-500 mb-1.5">
        {label}{required && <span className="text-neutral-900"> *</span>}
      </span>
      {children}
    </label>
  );
}

function StepHeader({ index, title, done, onEdit, editLabel }: {
  index: number; title: string; done: boolean; onEdit?: () => void; editLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="flex items-center gap-3 text-[15px] font-medium text-neutral-900 tracking-wide">
        <span className={`w-6 h-6 rounded-full text-[12px] flex items-center justify-center ${done ? 'bg-neutral-900 text-white' : 'border border-neutral-300 text-neutral-500'}`}>
          {done ? <Check size={12} /> : index}
        </span>
        {title}
      </h2>
      {onEdit && (
        <button onClick={onEdit} className="text-[13px] text-neutral-500 underline hover:text-neutral-900">{editLabel}</button>
      )}
    </div>
  );
}

function PrimaryButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full py-4 bg-neutral-900 text-white text-[13px] tracking-[0.15em] uppercase font-medium hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
    >
      {busy && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
