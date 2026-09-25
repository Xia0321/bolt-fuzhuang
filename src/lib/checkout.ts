import { saleorFetch, throwIfErrors } from '@/lib/saleor';
import type { Address, CartLine, Checkout, Money, PlacedOrder } from '@/types';

// 下单成功后暂存订单摘要，供订单完成页展示
export const LAST_ORDER_KEY = 'last-order';

// 购物袋 = Saleor Checkout。价格、库存、运费都以后端为准
const CHECKOUT_FIELDS = /* GraphQL */ `
  fragment CheckoutFields on Checkout {
    id email
    lines {
      id quantity
      unitPrice { gross { amount currency } }
      totalPrice { gross { amount currency } }
      variant {
        id quantityAvailable
        attributes {
          attribute { slug }
          values { name translation(languageCode: $lang) { name } }
        }
        product {
          slug name
          translation(languageCode: $lang) { name }
          thumbnail(size: 256) { url }
        }
      }
    }
    subtotalPrice { gross { amount currency } }
    shippingPrice { gross { amount currency } }
    totalPrice { gross { amount currency } }
    shippingAddress {
      firstName lastName streetAddress1 streetAddress2 city cityArea postalCode
      country { code } countryArea phone
    }
    deliveryMethod { ... on ShippingMethod { id } }
    shippingMethods {
      id name minimumDeliveryDays maximumDeliveryDays
      translation(languageCode: $lang) { name }
      price { amount currency }
    }
    availablePaymentGateways { id name }
  }
`;

interface RawCheckout {
  id: string;
  email: string | null;
  lines: {
    id: string; quantity: number;
    unitPrice: { gross: Money }; totalPrice: { gross: Money };
    variant: {
      id: string; quantityAvailable: number | null;
      attributes: { attribute: { slug: string }; values: { name: string; translation: { name: string } | null }[] }[];
      product: { slug: string; name: string; translation: { name: string } | null; thumbnail: { url: string } | null };
    };
  }[];
  subtotalPrice: { gross: Money };
  shippingPrice: { gross: Money };
  totalPrice: { gross: Money };
  shippingAddress: (Omit<Address, 'country'> & { country: { code: string } }) | null;
  deliveryMethod: { id?: string } | null;
  shippingMethods: {
    id: string; name: string; minimumDeliveryDays: number | null; maximumDeliveryDays: number | null;
    translation: { name: string } | null; price: Money;
  }[];
  availablePaymentGateways: { id: string; name: string }[];
}

interface MutationResult {
  checkout: RawCheckout | null;
  errors: { field: string | null; message: string | null; code: string }[];
}

function mapCheckout(c: RawCheckout): Checkout {
  const lines: CartLine[] = c.lines.map(l => {
    const attr = (slug: string) => {
      const v = l.variant.attributes.find(a => a.attribute.slug === slug)?.values[0];
      return v ? v.translation?.name || v.name : null;
    };
    return {
      id: l.id,
      quantity: l.quantity,
      variantId: l.variant.id,
      productSlug: l.variant.product.slug,
      name: l.variant.product.translation?.name || l.variant.product.name,
      image: l.variant.product.thumbnail?.url ?? null,
      size: attr('size'),
      color: attr('color'),
      unitPrice: l.unitPrice.gross,
      totalPrice: l.totalPrice.gross,
      quantityAvailable: l.variant.quantityAvailable ?? 0,
    };
  });
  const a = c.shippingAddress;
  return {
    id: c.id,
    email: c.email,
    lines,
    subtotal: c.subtotalPrice.gross,
    shipping: c.shippingPrice.gross,
    total: c.totalPrice.gross,
    shippingAddress: a ? { ...a, country: a.country.code } : null,
    deliveryMethodId: c.deliveryMethod?.id ?? null,
    shippingOptions: c.shippingMethods.map(m => ({
      id: m.id,
      name: m.translation?.name || m.name,
      price: m.price,
      minDays: m.minimumDeliveryDays,
      maxDays: m.maximumDeliveryDays,
    })),
    paymentGateways: c.availablePaymentGateways,
  };
}

function unwrap(result: MutationResult): Checkout {
  throwIfErrors(result.errors);
  if (!result.checkout) throw new Error('Checkout not found');
  return mapCheckout(result.checkout);
}

export async function fetchCheckout(id: string, lang: string): Promise<Checkout | null> {
  const data = await saleorFetch<{ checkout: RawCheckout | null }>(
    `query($id: ID!, $lang: LanguageCodeEnum!) { checkout(id: $id) { ...CheckoutFields } } ${CHECKOUT_FIELDS}`,
    { id, lang },
  );
  return data.checkout ? mapCheckout(data.checkout) : null;
}

export async function createCheckout(channel: string, lang: string, variantId: string, quantity: number) {
  const data = await saleorFetch<{ checkoutCreate: MutationResult }>(
    `mutation($input: CheckoutCreateInput!, $lang: LanguageCodeEnum!) {
      checkoutCreate(input: $input) { checkout { ...CheckoutFields } errors { field message code } }
    } ${CHECKOUT_FIELDS}`,
    { input: { channel, languageCode: lang, lines: [{ variantId, quantity }] }, lang },
  );
  return unwrap(data.checkoutCreate);
}

export async function addCheckoutLine(id: string, lang: string, variantId: string, quantity: number) {
  const data = await saleorFetch<{ checkoutLinesAdd: MutationResult }>(
    `mutation($id: ID!, $lines: [CheckoutLineInput!]!, $lang: LanguageCodeEnum!) {
      checkoutLinesAdd(id: $id, lines: $lines) { checkout { ...CheckoutFields } errors { field message code } }
    } ${CHECKOUT_FIELDS}`,
    { id, lines: [{ variantId, quantity }], lang },
  );
  return unwrap(data.checkoutLinesAdd);
}

export async function updateCheckoutLine(id: string, lang: string, lineId: string, quantity: number) {
  const data = await saleorFetch<{ checkoutLinesUpdate: MutationResult }>(
    `mutation($id: ID!, $lines: [CheckoutLineUpdateInput!]!, $lang: LanguageCodeEnum!) {
      checkoutLinesUpdate(id: $id, lines: $lines) { checkout { ...CheckoutFields } errors { field message code } }
    } ${CHECKOUT_FIELDS}`,
    { id, lines: [{ lineId, quantity }], lang },
  );
  return unwrap(data.checkoutLinesUpdate);
}

export async function removeCheckoutLine(id: string, lang: string, lineId: string) {
  const data = await saleorFetch<{ checkoutLinesDelete: MutationResult }>(
    `mutation($id: ID!, $linesIds: [ID!]!, $lang: LanguageCodeEnum!) {
      checkoutLinesDelete(id: $id, linesIds: $linesIds) { checkout { ...CheckoutFields } errors { field message code } }
    } ${CHECKOUT_FIELDS}`,
    { id, linesIds: [lineId], lang },
  );
  return unwrap(data.checkoutLinesDelete);
}

// 保存邮箱、收货地址（同时作为账单地址）和订单语言
export async function saveContactAndAddress(id: string, lang: string, email: string, address: Address) {
  const data = await saleorFetch<{
    checkoutEmailUpdate: MutationResult;
    checkoutLanguageCodeUpdate: MutationResult;
    checkoutShippingAddressUpdate: MutationResult;
    checkoutBillingAddressUpdate: MutationResult;
  }>(
    `mutation($id: ID!, $email: String!, $address: AddressInput!, $lang: LanguageCodeEnum!) {
      checkoutEmailUpdate(id: $id, email: $email) { checkout { id } errors { field message code } }
      checkoutLanguageCodeUpdate(id: $id, languageCode: $lang) { checkout { id } errors { field message code } }
      checkoutShippingAddressUpdate(id: $id, shippingAddress: $address) { checkout { id } errors { field message code } }
      checkoutBillingAddressUpdate(id: $id, billingAddress: $address) { checkout { ...CheckoutFields } errors { field message code } }
    } ${CHECKOUT_FIELDS}`,
    { id, email, address, lang },
  );
  throwIfErrors(data.checkoutEmailUpdate.errors);
  throwIfErrors(data.checkoutLanguageCodeUpdate.errors);
  throwIfErrors(data.checkoutShippingAddressUpdate.errors);
  return unwrap(data.checkoutBillingAddressUpdate);
}

export async function setDeliveryMethod(id: string, lang: string, deliveryMethodId: string) {
  const data = await saleorFetch<{ checkoutDeliveryMethodUpdate: MutationResult }>(
    `mutation($id: ID!, $deliveryMethodId: ID!, $lang: LanguageCodeEnum!) {
      checkoutDeliveryMethodUpdate(id: $id, deliveryMethodId: $deliveryMethodId) {
        checkout { ...CheckoutFields } errors { field message code }
      }
    } ${CHECKOUT_FIELDS}`,
    { id, deliveryMethodId, lang },
  );
  return unwrap(data.checkoutDeliveryMethodUpdate);
}

// 创建支付并完成下单。测试环境使用 Saleor 自带的 dummy 网关；
// 接入 Stripe 时需在前端先用 Stripe.js 拿到支付凭证，再作为 token 传入
export async function payAndComplete(checkout: Checkout, gatewayId: string, token = 'charged'): Promise<PlacedOrder> {
  const pay = await saleorFetch<{ checkoutPaymentCreate: { errors: MutationResult['errors'] } }>(
    `mutation($id: ID!, $input: PaymentInput!) {
      checkoutPaymentCreate(id: $id, input: $input) { errors { field message code } }
    }`,
    { id: checkout.id, input: { gateway: gatewayId, token, amount: checkout.total.amount } },
  );
  throwIfErrors(pay.checkoutPaymentCreate.errors);

  const done = await saleorFetch<{
    checkoutComplete: {
      order: { number: string; userEmail: string | null; total: { gross: Money } } | null;
      confirmationNeeded: boolean;
      errors: MutationResult['errors'];
    };
  }>(
    `mutation($id: ID!) {
      checkoutComplete(id: $id) {
        order { number userEmail total { gross { amount currency } } }
        confirmationNeeded
        errors { field message code }
      }
    }`,
    { id: checkout.id },
  );
  throwIfErrors(done.checkoutComplete.errors);
  const order = done.checkoutComplete.order;
  if (!order) throw new Error('Payment requires additional confirmation');
  return { number: order.number, total: order.total.gross, email: order.userEmail || checkout.email || '' };
}

export interface Choice { raw: string; verbose: string }

export interface AddressRules {
  requiredFields: string[];
  allowedFields: string[];
  countryAreaChoices: Choice[];
  cityChoices: Choice[];
  cityAreaChoices: Choice[];
  postalCodeExamples: string[];
}

type RawChoice = { raw: string | null; verbose: string | null };
const toChoices = (list: RawChoice[] | undefined) =>
  (list ?? []).filter(c => c.raw).map(c => ({ raw: c.raw!, verbose: c.verbose || c.raw! }));

// 各国地址格式不同（中国需要省份、美国需要州等），表单字段按 Saleor 返回的规则动态显示。
// 部分国家（如中国）的城市、区县需要从标准列表中选择，传入上级区域后返回下级选项
export async function fetchAddressRules(countryCode: string, countryArea?: string, city?: string): Promise<AddressRules> {
  const data = await saleorFetch<{
    addressValidationRules: {
      requiredFields: string[]; allowedFields: string[]; postalCodeExamples: string[];
      countryAreaChoices: RawChoice[]; cityChoices: RawChoice[]; cityAreaChoices: RawChoice[];
    } | null;
  }>(
    `query($country: CountryCode!, $countryArea: String, $city: String) {
      addressValidationRules(countryCode: $country, countryArea: $countryArea, city: $city) {
        requiredFields allowedFields postalCodeExamples
        countryAreaChoices { raw verbose }
        cityChoices { raw verbose }
        cityAreaChoices { raw verbose }
      }
    }`,
    { country: countryCode, countryArea: countryArea || null, city: city || null },
  );
  const r = data.addressValidationRules;
  return {
    requiredFields: r?.requiredFields ?? [],
    allowedFields: r?.allowedFields ?? [],
    countryAreaChoices: toChoices(r?.countryAreaChoices),
    cityChoices: toChoices(r?.cityChoices),
    cityAreaChoices: toChoices(r?.cityAreaChoices),
    postalCodeExamples: r?.postalCodeExamples ?? [],
  };
}

export async function fetchChannelCountries(channel: string): Promise<string[]> {
  const data = await saleorFetch<{ channel: { countries: { code: string }[] | null } | null }>(
    `query($channel: String!) { channel(slug: $channel) { countries { code } } }`,
    { channel },
  );
  return (data.channel?.countries ?? []).map(c => c.code);
}
