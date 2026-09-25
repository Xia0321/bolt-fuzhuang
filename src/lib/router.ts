import { useState, useEffect, useCallback } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'shop'; category?: string }
  | { name: 'product'; slug: string }
  | { name: 'cart' }
  | { name: 'checkout' }
  // 不带 id 时显示本次会话最后一笔订单（兼容旧链接）
  | { name: 'order'; id?: string }
  | { name: 'about' }
  | { name: 'page'; slug: string }
  // next：登录/注册成功后返回的站内路径
  // email：预填邮箱（确认账号后跳转）
  | { name: 'login'; next?: string; email?: string }
  | { name: 'register'; next?: string }
  // 带 email 与 token 时为设置新密码（重置邮件中的链接）
  | { name: 'resetPassword'; email?: string; token?: string }
  // 注册确认邮件中的链接
  | { name: 'confirmAccount'; email?: string; token?: string }
  | { name: 'account'; tab?: 'orders' | 'addresses' }
  | { name: 'notFound' };

export function parsePath(pathname: string, search = ''): Route {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const query = new URLSearchParams(search);
  // 只接受站内路径，防止跳转到外部网站
  const next = (() => {
    const v = query.get('next');
    return v && v.startsWith('/') && !v.startsWith('//') ? v : undefined;
  })();

  if (parts.length === 0) return { name: 'home' };
  switch (parts[0]) {
    case 'shop':
      return { name: 'shop', category: parts[1] };
    case 'product':
      return parts[1] ? { name: 'product', slug: parts[1] } : { name: 'shop' };
    case 'cart':
      return { name: 'cart' };
    case 'checkout':
      return { name: 'checkout' };
    case 'order':
      return { name: 'order', id: parts[1] };
    case 'about':
      return { name: 'about' };
    case 'pages':
      return parts[1] ? { name: 'page', slug: parts[1] } : { name: 'notFound' };
    case 'login':
      return { name: 'login', next, email: query.get('email') ?? undefined };
    case 'register':
      return { name: 'register', next };
    case 'reset-password':
      return { name: 'resetPassword', email: query.get('email') ?? undefined, token: query.get('token') ?? undefined };
    case 'confirm-account':
      return { name: 'confirmAccount', email: query.get('email') ?? undefined, token: query.get('token') ?? undefined };
    case 'account':
      return { name: 'account', tab: parts[1] === 'addresses' ? 'addresses' : 'orders' };
    default:
      return { name: 'notFound' };
  }
}

const withQuery = (path: string, params: Record<string, string | undefined>) => {
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  return query ? `${path}?${query}` : path;
};

export function routeToPath(route: Route): string {
  switch (route.name) {
    case 'home': return '/';
    case 'shop': return route.category ? `/shop/${route.category}` : '/shop';
    case 'product': return `/product/${route.slug}`;
    case 'cart': return '/cart';
    case 'checkout': return '/checkout';
    case 'order': return route.id ? `/order/${route.id}` : '/order';
    case 'about': return '/about';
    case 'page': return `/pages/${route.slug}`;
    case 'login': return withQuery('/login', { next: route.next, email: route.email });
    case 'register': return withQuery('/register', { next: route.next });
    case 'resetPassword': return withQuery('/reset-password', { email: route.email, token: route.token });
    case 'confirmAccount': return withQuery('/confirm-account', { email: route.email, token: route.token });
    case 'account': return route.tab === 'addresses' ? '/account/addresses' : '/account';
    case 'notFound': return '/';
  }
}

export const isExternalUrl = (url: string) => /^(https?:)?\/\//.test(url) || url.startsWith('mailto:');

const currentPath = () => window.location.pathname + window.location.search;

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parsePath(window.location.pathname, window.location.search));

  useEffect(() => {
    const onPopState = () => setRoute(parsePath(window.location.pathname, window.location.search));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // replace：用于登录后跳转等不需要保留在浏览历史中的场景
  const navigate = useCallback((r: Route, options?: { replace?: boolean }) => {
    const path = routeToPath(r);
    if (path !== currentPath()) {
      if (options?.replace) window.history.replaceState(null, '', path);
      else window.history.pushState(null, '', path);
    }
    setRoute(r);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  // 后台配置的链接（按钮、菜单）可能是站内路径或外部网址
  const navigateUrl = useCallback((url: string) => {
    if (!url) return;
    if (isExternalUrl(url)) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    const path = url.startsWith('/') ? url : `/${url}`;
    const [pathname, search] = path.split('?');
    navigate(parsePath(pathname, search ? `?${search}` : ''));
  }, [navigate]);

  return { route, navigate, navigateUrl, currentPath };
}
