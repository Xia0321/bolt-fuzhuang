import { useState, useEffect, useCallback } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'shop'; category?: string }
  | { name: 'product'; slug: string }
  | { name: 'cart' }
  | { name: 'about' };

function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const parts = clean.split('/').filter(Boolean);

  if (parts.length === 0) return { name: 'home' };

  if (parts[0] === 'shop') {
    return { name: 'shop', category: parts[1] };
  }

  if (parts[0] === 'product' && parts[1]) {
    return { name: 'product', slug: parts[1] };
  }

  if (parts[0] === 'cart') return { name: 'cart' };
  if (parts[0] === 'about') return { name: 'about' };

  return { name: 'home' };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'home': return '#/';
    case 'shop': return route.category ? `#/shop/${route.category}` : '#/shop';
    case 'product': return `#/product/${route.slug}`;
    case 'cart': return '#/cart';
    case 'about': return '#/about';
  }
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((r: Route) => {
    window.location.hash = routeToHash(r);
  }, []);

  return { route, navigate };
}
