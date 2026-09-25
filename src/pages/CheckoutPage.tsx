import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { formatPrice } from '@/i18n/translations';
import { useCart } from '@/context/CartContext';
import { useNav } from '@/context/NavContext';
import { useAuth } from '@/context/AuthContext';
import {
  LAST_ORDER_KEY, emptyAddress, payAndComplete, saveContactAndAddress, setDeliveryMethod,
} from '@/lib/checkout';
import { SaleorError } from '@/lib/saleor';
import { authErrorKey, stripSaved, useAccountConfig } from '@/lib/account';
import { Captcha } from '@/components/Captcha';
import { CHANNELS } from '@/config';
import { AddressFields, AddressSummary } from '@/components/AddressFields';
import { ErrorNote, Field, PrimaryButton } from '@/components/Form';
import { inputClass } from '@/components/formStyles';
import type { Address } from '@/types';
import { ArrowLeft, Check, Loader2, Lock } from 'lucide-react';

const DUMMY_GATEWAY = 'mirumee.payments.dummy';

type Step = 'address' | 'delivery' | 'payment';

export function CheckoutPage() {
  const { locale, channel, languageCode, t } = useI18n();
  const { navigate } = useNav();
  const { checkout, loading, setCheckout, clearCart } = useCart();
  const { user } = useAuth();
  const channelConfig = CHANNELS.find(c => c.slug === channel);

  const [step, setStep] = useState<Step>('address');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState<Address>(() => emptyAddress(channelConfig?.defaultCountry ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const accountConfig = useAccountConfig();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const needCaptcha = !!accountConfig?.captchaSiteKey;

  // 已填过的信息（例如刷新页面后）回填到表单；已登录且尚未填写时使用账号邮箱和默认地址
  useEffect(() => {
    if (!checkout) return;
    if (checkout.email) setEmail(checkout.email);
    else if (user) setEmail(user.email);
    if (checkout.shippingAddress) {
      setAddress(checkout.shippingAddress);
      setStep(checkout.deliveryMethodId ? 'payment' : 'delivery');
    } else if (user?.addresses[0]) {
      setAddress(stripSaved(user.addresses[0]));
    }
  }, [checkout?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const fieldLabels: Record<string, string> = {
    email: t('checkout_email'), firstName: t('checkout_first_name'), lastName: t('checkout_last_name'),
    country: t('checkout_country'), countryArea: t('checkout_country_area'), city: t('checkout_city'),
    cityArea: t('checkout_city_area'), postalCode: t('checkout_postal_code'), streetAddress1: t('checkout_street1'),
    streetAddress2: t('checkout_street2'), phone: t('checkout_phone'),
  };

  const withBusy = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      await action();
    } catch (e) {
      const key = authErrorKey(e);
      const message = key ? t(key) : e instanceof Error ? e.message : t('error_generic');
      const field = e instanceof SaleorError && e.field ? e.field : null;
      if (field) {
        setFieldErrors({ [field]: message });
      } else {
        setError(message);
      }
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
    if (needCaptcha && !captchaToken) throw new Error(t('auth_captcha_required'));
    let order;
    try {
      order = await payAndComplete(checkout, gateway.id, captchaToken ?? undefined);
    } finally {
      // 验证令牌只能用一次，提交后（无论成败）都重新验证
      setCaptchaReset(n => n + 1);
    }
    try {
      sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    } catch {
      // 忽略存储失败，订单页会显示通用提示
    }
    clearCart();
    navigate({ name: 'order', id: order.id }, { replace: true });
  });

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
            {error && <ErrorNote>{error}</ErrorNote>}

            {!user && (
              <p className="text-[13px] text-neutral-600 bg-neutral-50 px-4 py-3">
                {t('checkout_login_hint')}{' '}
                <button onClick={() => navigate({ name: 'login', next: '/checkout' })} className="underline text-neutral-900">
                  {t('auth_login_button')}
                </button>
              </p>
            )}

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
                  <Field label={t('checkout_email')} required error={fieldErrors['email']}>
                    <input type="email" className={`${inputClass}${fieldErrors['email'] ? ' border-red-400 focus:border-red-500' : ''}`} required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                  </Field>
                  {user && user.addresses.length > 0 && (
                    <Field label={t('checkout_saved_address')}>
                      <select
                        className={inputClass}
                        defaultValue={user.addresses[0].id}
                        onChange={e => {
                          const saved = user.addresses.find(a => a.id === e.target.value);
                          setAddress(saved ? stripSaved(saved) : emptyAddress(channelConfig?.defaultCountry ?? ''));
                        }}
                      >
                        {user.addresses.map(a => (
                          <option key={a.id} value={a.id}>
                            {[a.lastName + a.firstName, a.streetAddress1, a.city].filter(Boolean).join(' · ')}
                          </option>
                        ))}
                        <option value="">{t('checkout_new_address')}</option>
                      </select>
                    </Field>
                  )}
                  <AddressFields address={address} setAddress={setAddress} fieldErrors={fieldErrors} />
                  <PrimaryButton busy={busy}>{t('checkout_continue_shipping')}</PrimaryButton>
                </form>
              ) : (
                <div className="text-[14px] text-neutral-600 leading-relaxed">
                  <p>{email}</p>
                  <AddressSummary address={address} />
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
                    {needCaptcha && <Captcha siteKey={accountConfig.captchaSiteKey} onToken={setCaptchaToken} resetKey={captchaReset} />}
                    <button
                      onClick={placeOrder}
                      disabled={busy || !accountConfig || (needCaptcha && !captchaToken)}
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
