import { useEffect, useState } from 'react';
import { ACCOUNT_API_URL } from '@/config';
import { SaleorError, saleorFetch, setAuthTokens, throwIfErrors } from '@/lib/saleor';
import type { Address, Customer, Money, OrderDetail, OrderStatus, OrderSummary, SavedAddress } from '@/types';

// 顾客账号：登录、注册、找回密码、我的订单、地址簿，使用 Saleor 自带接口。
// 注册、登录、找回密码、结账提交先经过账号服务（deploy/account-gw）校验人机验证并限流，再转交 Saleor；
// 账号服务未配置人机验证时，登录、找回密码、结账直接调用 Saleor

const ADDRESS_FIELDS = 'id firstName lastName streetAddress1 streetAddress2 city cityArea postalCode country { code } countryArea phone';

type RawAddress = Omit<Address, 'country'> & { id: string; country: { code: string } };

const CUSTOMER_FIELDS = /* GraphQL */ `
  fragment CustomerFields on User {
    id email firstName lastName
    addresses { ${ADDRESS_FIELDS} }
    defaultShippingAddress { id }
  }
`;

interface RawCustomer {
  id: string; email: string; firstName: string; lastName: string;
  addresses: RawAddress[];
  defaultShippingAddress: { id: string } | null;
}

type Errors = { field: string | null; message: string | null; code: string }[];

const toAddress = (a: RawAddress): Address => ({ ...a, country: a.country.code });

function mapCustomer(u: RawCustomer): Customer {
  const defaultId = u.defaultShippingAddress?.id;
  const addresses: SavedAddress[] = u.addresses.map(a => ({ ...toAddress(a), id: a.id, isDefaultShipping: a.id === defaultId }));
  // 默认地址排在最前
  addresses.sort((a, b) => Number(b.isDefaultShipping) - Number(a.isDefaultShipping));
  return { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, addresses };
}

// 地址簿的增删改只提交 Saleor AddressInput 接受的字段
const toAddressInput = (a: Address): Address => ({
  firstName: a.firstName, lastName: a.lastName, streetAddress1: a.streetAddress1, streetAddress2: a.streetAddress2,
  city: a.city, cityArea: a.cityArea, postalCode: a.postalCode, country: a.country, countryArea: a.countryArea, phone: a.phone,
});

// 地址簿中的地址去掉 ID 等字段，用于填入表单
export const stripSaved = (a: SavedAddress): Address => toAddressInput(a);

// ---------- 登录与注册 ----------

// 有对应三语文案的错误码（Saleor 登录错误与注册服务错误），其余显示原始信息
const KNOWN_ERRORS = [
  'INVALID_CREDENTIALS', 'LOGIN_ATTEMPT_DELAYED', 'ACCOUNT_NOT_CONFIRMED', 'INACTIVE',
  'CAPTCHA_FAILED', 'RATE_LIMITED', 'EMAIL_EXISTS', 'INVALID_EMAIL', 'INVALID_PASSWORD', 'DISABLED', 'NETWORK',
];

export function authErrorKey(e: unknown): string | null {
  const code = e instanceof SaleorError ? e.code : undefined;
  if (code === 'PASSWORD_TOO_SHORT' || code === 'PASSWORD_TOO_SIMILAR' || code === 'PASSWORD_TOO_COMMON' || code === 'PASSWORD_ENTIRELY_NUMERIC') {
    return 'auth_err_INVALID_PASSWORD';
  }
  return code && KNOWN_ERRORS.includes(code) ? `auth_err_${code}` : null;
}

// ---------- 账号服务 ----------

export interface AccountConfig {
  // 为空表示未启用人机验证
  captchaSiteKey: string;
  registerEnabled: boolean;
}

let configPromise: Promise<AccountConfig> | null = null;
let configFetchedAt = 0;
const CONFIG_TTL = 30_000; // 30 秒后重新拉取，确保 bypass 开关能及时生效

export function fetchAccountConfig(): Promise<AccountConfig> {
  if (configPromise && Date.now() - configFetchedAt < CONFIG_TTL) return configPromise;
  configFetchedAt = Date.now();
  configPromise = fetch(`${ACCOUNT_API_URL}/config`)
    .then(res => (res.ok ? res.json() : Promise.reject()))
    .catch(() => {
      // 服务不可用时不缓存，下次重试
      configPromise = null;
      return { captchaSiteKey: '', registerEnabled: false };
    });
  return configPromise;
}

// null：加载中；每次组件挂载都重新拉取，确保绕过开关即时生效
export function useAccountConfig(): AccountConfig | null {
  const [config, setConfig] = useState<AccountConfig | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${ACCOUNT_API_URL}/config`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .catch(() => ({ captchaSiteKey: '', registerEnabled: false }))
      .then((c: AccountConfig) => { if (!cancelled) setConfig(c); });
    return () => { cancelled = true; };
  }, []);
  return config;
}

// 账号服务的错误码：CAPTCHA_FAILED、RATE_LIMITED、EMAIL_EXISTS、INVALID_EMAIL、INVALID_PASSWORD、DISABLED，
// 以及透传的 Saleor 错误码（如 INVALID_CREDENTIALS）
export async function accountApi<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ACCOUNT_API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SaleorError('Network error', 'NETWORK');
  }
  // Nginx 限流直接返回 429，没有 JSON
  if (res.status === 429) throw new SaleorError('Too many requests', 'RATE_LIMITED');
  const data = await res.json().catch(() => null) as ({ ok?: boolean; code?: string; message?: string } & T) | null;
  if (!res.ok || !data?.ok) throw new SaleorError(data?.message || `HTTP ${res.status}`, data?.code || 'UNKNOWN');
  return data;
}

// 传入人机验证令牌时经账号服务登录
export async function login(email: string, password: string, captchaToken?: string) {
  if (captchaToken) {
    const data = await accountApi<{ token: string; refreshToken: string }>('/login', { email, password, captchaToken });
    setAuthTokens(data.token, data.refreshToken);
    return;
  }
  const data = await saleorFetch<{ tokenCreate: { token: string | null; refreshToken: string | null; errors: Errors } }>(
    `mutation($email: String!, $password: String!) {
      tokenCreate(email: $email, password: $password) { token refreshToken errors { field message code } }
    }`,
    { email, password },
  );
  throwIfErrors(data.tokenCreate.errors);
  setAuthTokens(data.tokenCreate.token, data.tokenCreate.refreshToken);
}

export function logout() {
  setAuthTokens(null, null);
}

export async function fetchMe(): Promise<Customer | null> {
  const data = await saleorFetch<{ me: RawCustomer | null }>(`{ me { ...CustomerFields } } ${CUSTOMER_FIELDS}`);
  return data.me ? mapCustomer(data.me) : null;
}

export async function register(input: { email: string; password: string; captchaToken: string; languageCode: string; channel: string }) {
  await accountApi('/register', input);
}

// 点击注册确认邮件中的链接后确认账号
export async function confirmAccount(email: string, token: string) {
  const data = await saleorFetch<{ confirmAccount: { errors: Errors } }>(
    `mutation($email: String!, $token: String!) {
      confirmAccount(email: $email, token: $token) { errors { field message code } }
    }`,
    { email, token },
  );
  throwIfErrors(data.confirmAccount.errors);
}

// ---------- 找回密码 ----------

// 传入人机验证令牌时经账号服务申请（邮箱是否存在都返回成功）
export async function requestPasswordReset(email: string, channel: string, captchaToken?: string) {
  if (captchaToken) {
    await accountApi('/password/reset', { email, channel, captchaToken });
    return;
  }
  const data = await saleorFetch<{ requestPasswordReset: { errors: Errors } }>(
    `mutation($email: String!, $redirectUrl: String!, $channel: String!) {
      requestPasswordReset(email: $email, redirectUrl: $redirectUrl, channel: $channel) { errors { field message code } }
    }`,
    { email, redirectUrl: `${window.location.origin}/reset-password`, channel },
  );
  throwIfErrors(data.requestPasswordReset.errors);
}

// 设置新密码成功后直接登录
export async function setNewPassword(email: string, token: string, password: string) {
  const data = await saleorFetch<{ setPassword: { token: string | null; refreshToken: string | null; errors: Errors } }>(
    `mutation($email: String!, $token: String!, $password: String!) {
      setPassword(email: $email, token: $token, password: $password) { token refreshToken errors { field message code } }
    }`,
    { email, token, password },
  );
  throwIfErrors(data.setPassword.errors);
  setAuthTokens(data.setPassword.token, data.setPassword.refreshToken);
}

// ---------- 订单 ----------

interface RawOrderSummary {
  id: string; number: string; created: string; status: OrderStatus;
  total: { gross: Money };
  lines: { quantity: number; thumbnail: { url: string } | null }[];
}

const mapSummary = (o: RawOrderSummary): OrderSummary => ({
  id: o.id,
  number: o.number,
  created: o.created,
  status: o.status,
  total: o.total.gross,
  itemCount: o.lines.reduce((sum, l) => sum + l.quantity, 0),
  image: o.lines.find(l => l.thumbnail)?.thumbnail?.url ?? null,
});

export async function fetchMyOrders(): Promise<OrderSummary[]> {
  const data = await saleorFetch<{ me: { orders: { edges: { node: RawOrderSummary }[] } | null } | null }>(
    `{
      me {
        orders(first: 50) {
          edges { node { id number created status total { gross { amount currency } } lines { quantity thumbnail(size: 128) { url } } } }
        }
      }
    }`,
  );
  return (data.me?.orders?.edges ?? []).map(e => mapSummary(e.node)).sort((a, b) => b.created.localeCompare(a.created));
}

interface RawOrderDetail extends RawOrderSummary {
  userEmail: string | null;
  isPaid: boolean;
  subtotal: { gross: Money };
  shippingPrice: { gross: Money };
  shippingMethodName: string | null;
  shippingAddress: RawAddress | null;
  lines: (RawOrderSummary['lines'][number] & {
    productName: string; translatedProductName: string;
    variantName: string; translatedVariantName: string;
    totalPrice: { gross: Money };
  })[];
  fulfillments: { status: string; trackingNumber: string; created: string }[];
}

// 订单 ID 为不可猜测的 UUID，游客凭下单后的专属链接即可查看
export async function fetchOrder(id: string): Promise<OrderDetail | null> {
  const data = await saleorFetch<{ order: RawOrderDetail | null }>(
    `query($id: ID!) {
      order(id: $id) {
        id number created status userEmail isPaid shippingMethodName
        total { gross { amount currency } }
        subtotal { gross { amount currency } }
        shippingPrice { gross { amount currency } }
        shippingAddress { ${ADDRESS_FIELDS} }
        lines {
          quantity productName translatedProductName variantName translatedVariantName
          thumbnail(size: 256) { url }
          totalPrice { gross { amount currency } }
        }
        fulfillments { status trackingNumber created }
      }
    }`,
    { id },
  );
  const o = data.order;
  if (!o) return null;
  return {
    ...mapSummary(o),
    email: o.userEmail ?? '',
    isPaid: o.isPaid,
    subtotal: o.subtotal.gross,
    shipping: o.shippingPrice.gross,
    shippingMethod: o.shippingMethodName ?? '',
    shippingAddress: o.shippingAddress ? toAddress(o.shippingAddress) : null,
    lines: o.lines.map(l => ({
      name: l.translatedProductName || l.productName,
      variant: l.translatedVariantName || l.variantName,
      quantity: l.quantity,
      image: l.thumbnail?.url ?? null,
      totalPrice: l.totalPrice.gross,
    })),
    shipments: o.fulfillments
      .filter(f => f.status !== 'CANCELED' && f.trackingNumber)
      .map(f => ({ trackingNumber: f.trackingNumber, created: f.created })),
  };
}

// ---------- 地址簿 ----------

export async function createAddress(address: Address, makeDefault: boolean): Promise<Customer> {
  const data = await saleorFetch<{ accountAddressCreate: { user: RawCustomer | null; errors: Errors } }>(
    `mutation($input: AddressInput!, $type: AddressTypeEnum) {
      accountAddressCreate(input: $input, type: $type) { user { ...CustomerFields } errors { field message code } }
    } ${CUSTOMER_FIELDS}`,
    { input: toAddressInput(address), type: makeDefault ? 'SHIPPING' : null },
  );
  throwIfErrors(data.accountAddressCreate.errors);
  return mapCustomer(data.accountAddressCreate.user!);
}

export async function updateAddress(id: string, address: Address, makeDefault: boolean): Promise<Customer> {
  const data = await saleorFetch<{ accountAddressUpdate: { errors: Errors } }>(
    `mutation($id: ID!, $input: AddressInput!) {
      accountAddressUpdate(id: $id, input: $input) { errors { field message code } }
    }`,
    { id, input: toAddressInput(address) },
  );
  throwIfErrors(data.accountAddressUpdate.errors);
  return makeDefault ? setDefaultAddress(id) : (await fetchMe())!;
}

export async function deleteAddress(id: string): Promise<Customer> {
  const data = await saleorFetch<{ accountAddressDelete: { user: RawCustomer | null; errors: Errors } }>(
    `mutation($id: ID!) {
      accountAddressDelete(id: $id) { user { ...CustomerFields } errors { field message code } }
    } ${CUSTOMER_FIELDS}`,
    { id },
  );
  throwIfErrors(data.accountAddressDelete.errors);
  return mapCustomer(data.accountAddressDelete.user!);
}

export async function setDefaultAddress(id: string): Promise<Customer> {
  const data = await saleorFetch<{ accountSetDefaultAddress: { user: RawCustomer | null; errors: Errors } }>(
    `mutation($id: ID!) {
      accountSetDefaultAddress(id: $id, type: SHIPPING) { user { ...CustomerFields } errors { field message code } }
    } ${CUSTOMER_FIELDS}`,
    { id },
  );
  throwIfErrors(data.accountSetDefaultAddress.errors);
  return mapCustomer(data.accountSetDefaultAddress.user!);
}
