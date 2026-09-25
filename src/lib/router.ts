import { useState, useEffect, useCallback } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'shop'; category?: string }
  | { name: 'product'; slug: string }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'order' }
  | { name: 'about' }
  | { name: 'page'; slug: string }
  | { name: 'notFound' };

export function parsePath(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);

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
      return { name: 'order' };
    case 'about':
      return { name: 'about' };
    case 'pages':
      return parts[1] ? { name: 'page', slug: parts[1] } : { name: 'notFound' };
    default:
      return { name: 'notFound' };
  }
}

export function routeToPath(route: Route): string {
  switch (route.name) {
    case 'home': return '/';
    case 'shop': return route.category ? `/shop/${route.category}` : '/shop';
    case 'product': return `/product/${route.slug}`;
    case 'cart': return '/cart';
    case 'checkout': return '/checkout';
    case 'order': return '/order';
    case 'about': return '/about';
    case 'page': return `/pages/${route.slug}`;
    case 'notFound': return '/';
  }
}

export const isExternalUrl = (url: string) => /^(https?:)?\/\//.test(url) || url.startsWith('mailto:');

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parsePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(parsePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((r: Route) => {
    const path = routeToPath(r);
    if (path !== window.location.pathname) window.history.pushState(null, '', path);
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
    navigate(parsePath(url.startsWith('/') ? url : `/${url}`));
  }, [navigate]);

  return { route, navigate, navigateUrl };
}
