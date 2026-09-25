import { SALEOR_API_URL } from '@/config';

export class SaleorError extends Error {
  code?: string;
  field?: string | null;
  constructor(message: string, code?: string, field?: string | null) {
    super(message);
    this.code = code;
    this.field = field;
  }
}

interface MutationError {
  field?: string | null;
  message?: string | null;
  code?: string;
}

// ---------- 登录凭证 ----------
// 访问凭证（5 分钟）只放内存；续期凭证（30 天）存 localStorage，刷新页面后用它恢复登录
const REFRESH_KEY = 'auth-refresh';
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
// 续期失败（凭证失效、账号被停用）时通知 AuthContext 清除登录状态
let onSessionExpired: (() => void) | null = null;

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setAuthTokens(access: string | null, refresh?: string | null) {
  accessToken = access;
  if (refresh === undefined) return;
  try {
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    // 隐私模式等情况下无法保存，只在本次访问内保持登录
  }
}

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

// 读取凭证中的过期时间（秒），无法解析时视为已过期
function tokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : 0;
  } catch {
    return 0;
  }
}

// 同一时间只发一个续期请求，并发的请求共用结果
export function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve(null);
  refreshing ??= rawFetch<{ tokenRefresh: { token: string | null; errors: MutationError[] } }>(
    `mutation($refreshToken: String!) { tokenRefresh(refreshToken: $refreshToken) { token errors { code } } }`,
    { refreshToken: refresh },
    null,
  )
    .then(data => {
      const token = data.tokenRefresh.token;
      if (!token) {
        setAuthTokens(null, null);
        onSessionExpired?.();
        return null;
      }
      accessToken = token;
      return token;
    })
    // 网络错误时保留续期凭证，下次再试
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
}

// 当前有效的访问凭证（快过期时先续期），未登录返回 null
export async function currentToken(): Promise<string | null> {
  if (accessToken && tokenExpiry(accessToken) - Date.now() / 1000 > 30) return accessToken;
  if (accessToken || getRefreshToken()) return refreshAccessToken();
  return null;
}

const AUTH_ERROR_CODES = ['ExpiredSignatureError', 'InvalidTokenError', 'DecodeError', 'InvalidSignatureError'];

interface GraphQLError {
  message: string;
  extensions?: { exception?: { code?: string } };
}

class AuthTokenError extends SaleorError {}

async function rawFetch<T>(query: string, variables: Record<string, unknown>, token: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(SALEOR_API_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  if (!res.ok) throw new SaleorError(`HTTP ${res.status}`);
  const json = await res.json();
  const errors: GraphQLError[] | undefined = json.errors;
  if (errors?.length) {
    const code = errors[0].extensions?.exception?.code;
    if (token && code && AUTH_ERROR_CODES.includes(code)) throw new AuthTokenError(errors[0].message, code);
    throw new SaleorError(errors[0].message, code);
  }
  return json.data as T;
}

// 已登录时自动附带访问凭证；凭证过期则续期后重试一次，续期失败按未登录重试
export async function saleorFetch<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = await currentToken();
  try {
    return await rawFetch<T>(query, variables, token);
  } catch (e) {
    if (!(e instanceof AuthTokenError)) throw e;
    accessToken = null;
    return rawFetch<T>(query, variables, await refreshAccessToken());
  }
}

// mutation 返回的业务错误（库存不足、地址不合法等）统一抛出
export function throwIfErrors(errors: MutationError[] | undefined | null) {
  if (errors && errors.length) {
    const e = errors[0];
    throw new SaleorError(e.message || e.code || 'Error', e.code, e.field);
  }
}

// Saleor 富文本为 EditorJS JSON，这里取出纯文本段落
export function richTextToParagraphs(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const doc = JSON.parse(json);
    return (doc.blocks || [])
      .map((b: { data?: { text?: string; items?: string[] } }) => b.data?.text ?? (b.data?.items || []).join('\n'))
      .map((html: string) => (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
