import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { countryName } from '@/i18n/translations';
import { fetchAddressRules, fetchChannelCountries, type AddressRules, type Choice } from '@/lib/checkout';
import { Field } from '@/components/Form';
import { inputClass } from '@/components/formStyles';
import type { Address } from '@/types';

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

// 收货地址表单（结算页与地址簿共用）。各国地址格式不同，字段按 Saleor 返回的规则动态显示
export function AddressFields({ address, setAddress }: { address: Address; setAddress: Dispatch<SetStateAction<Address>> }) {
  const { locale, channel, t } = useI18n();
  const [countries, setCountries] = useState<string[]>([]);
  const [rules, setRules] = useState<AddressRules | null>(null);

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

  const isRequired = (field: string) => rules?.requiredFields.includes(field) ?? false;
  const isAllowed = (field: string) => rules?.allowedFields.includes(field) ?? true;
  const update = (field: keyof Address) => (value: string) => setAddress(a => ({ ...a, [field]: value }));

  // 地址簿中已有地址的国家可能不在当前渠道的配送范围内，也保留在选项中
  const countryOptions = countries.includes(address.country) || !address.country ? countries : [address.country, ...countries];

  const lastNameFirst = locale !== 'en';
  const nameFields = [
    <Field key="last" label={t('checkout_last_name')} required>
      <input className={inputClass} required value={address.lastName} onChange={e => update('lastName')(e.target.value)} autoComplete="family-name" />
    </Field>,
    <Field key="first" label={t('checkout_first_name')} required>
      <input className={inputClass} required value={address.firstName} onChange={e => update('firstName')(e.target.value)} autoComplete="given-name" />
    </Field>,
  ];

  return (
    <>
      <Field label={t('checkout_country')} required>
        <select
          className={inputClass}
          value={address.country}
          onChange={e => setAddress(a => ({ ...a, country: e.target.value, countryArea: '', city: '', cityArea: '' }))}
        >
          {countryOptions
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
    </>
  );
}

// 地址的单行展示（结算页、订单详情、地址簿共用）
export function AddressSummary({ address }: { address: Address }) {
  const { locale } = useI18n();
  const name = locale === 'en'
    ? [address.firstName, address.lastName]
    : [address.lastName, address.firstName];
  return (
    <>
      <p>{name.filter(Boolean).join(' ')} · {address.phone}</p>
      <p>
        {[address.streetAddress1, address.streetAddress2, address.cityArea, address.city, address.countryArea, address.postalCode]
          .filter(Boolean).join(', ')}
        {' · '}{countryName(address.country, locale)}
      </p>
    </>
  );
}
