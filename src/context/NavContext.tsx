import { createContext, useContext, type ReactNode } from 'react';
import { useRouter, type Route } from '@/lib/router';

interface NavContextValue {
  route: Route;
  navigate: (r: Route) => void;
  navigateUrl: (url: string) => void;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  return <NavContext.Provider value={router}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
