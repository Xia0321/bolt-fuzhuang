import { createContext, useContext, type ReactNode } from 'react';
import { useRouter, type Route } from '@/lib/router';

interface NavContextValue {
  route: Route;
  navigate: (r: Route, options?: { replace?: boolean }) => void;
  navigateUrl: (url: string) => void;
  // 当前地址（路径 + 查询参数），用于登录后返回
  currentPath: () => string;
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
