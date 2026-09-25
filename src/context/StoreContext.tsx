import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { loadStore } from '@/lib/catalog';
import type { StoreData } from '@/types';

interface StoreContextValue {
  store: StoreData | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

// 切换语言或币种时重新拉取对应翻译和价格
export function StoreProvider({ children }: { children: ReactNode }) {
  const { channel, languageCode } = useI18n();
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    loadStore(channel, languageCode)
      .then(data => { if (!cancelled) setStore(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channel, languageCode]);

  useEffect(() => reload(), [reload]);

  return (
    <StoreContext.Provider value={{ store, loading, error, reload }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
