import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { fetchMe, login as loginRequest, logout as logoutRequest, register as registerRequest } from '@/lib/account';
import { getRefreshToken, setSessionExpiredHandler } from '@/lib/saleor';
import type { Customer } from '@/types';

interface AuthContextValue {
  user: Customer | null;
  // 页面加载时恢复登录状态完成前为 false，避免已登录用户被误判为未登录
  ready: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<void>;
  // 注册后需点击确认邮件中的链接才能登录
  register: (email: string, password: string, captchaToken: string) => Promise<void>;
  logout: () => void;
  // 地址簿修改、设置新密码后更新
  setUser: (user: Customer) => void;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { channel, languageCode } = useI18n();
  const [user, setUserState] = useState<Customer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSessionExpiredHandler(() => setUserState(null));
    // 有续期凭证时用它换取访问凭证，恢复登录
    if (!getRefreshToken()) {
      setReady(true);
    } else {
      fetchMe()
        .then(setUserState)
        .catch(() => setUserState(null))
        .finally(() => setReady(true));
    }
    return () => setSessionExpiredHandler(null);
  }, []);

  const reloadUser = useCallback(async () => {
    setUserState(await fetchMe());
  }, []);

  const login = useCallback(async (email: string, password: string, captchaToken?: string) => {
    await loginRequest(email, password, captchaToken);
    await reloadUser();
  }, [reloadUser]);

  const register = useCallback(async (email: string, password: string, captchaToken: string) => {
    await registerRequest({ email, password, captchaToken, languageCode, channel });
  }, [channel, languageCode]);

  const logout = useCallback(() => {
    logoutRequest();
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, setUser: setUserState, reloadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
