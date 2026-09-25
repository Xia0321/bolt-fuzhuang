import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import {
  addCheckoutLine, createCheckout, fetchCheckout, removeCheckoutLine, updateCheckoutLine,
} from '@/lib/checkout';
import type { Checkout } from '@/types';

interface CartContextValue {
  checkout: Checkout | null;
  loading: boolean;
  totalItems: number;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  updateQuantity: (lineId: string, quantity: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  // 结算页更新地址、配送方式后回写
  setCheckout: (checkout: Checkout) => void;
  // 下单成功后清空
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// 每个渠道（币种）各自一个 Saleor Checkout
const storageKey = (channel: string) => `checkout:${channel}`;

function readId(channel: string): string | null {
  try {
    return localStorage.getItem(storageKey(channel));
  } catch {
    return null;
  }
}

function writeId(channel: string, id: string | null) {
  try {
    if (id) localStorage.setItem(storageKey(channel), id);
    else localStorage.removeItem(storageKey(channel));
  } catch {
    // 忽略存储失败
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { channel, languageCode } = useI18n();
  const [checkout, setCheckoutState] = useState<Checkout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const id = readId(channel);
    setCheckoutState(null);
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCheckout(id, languageCode)
      .then(c => {
        if (cancelled) return;
        // 已下单或过期的 checkout 会查不到
        if (!c) writeId(channel, null);
        setCheckoutState(c);
      })
      .catch(() => { if (!cancelled) setCheckoutState(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channel, languageCode]);

  const setCheckout = useCallback((c: Checkout) => {
    writeId(channel, c.id);
    setCheckoutState(c);
  }, [channel]);

  const addItem = useCallback(async (variantId: string, quantity: number) => {
    const c = checkout
      ? await addCheckoutLine(checkout.id, languageCode, variantId, quantity)
      : await createCheckout(channel, languageCode, variantId, quantity);
    setCheckout(c);
  }, [checkout, channel, languageCode, setCheckout]);

  const updateQuantity = useCallback(async (lineId: string, quantity: number) => {
    if (!checkout || quantity < 1) return;
    setCheckout(await updateCheckoutLine(checkout.id, languageCode, lineId, quantity));
  }, [checkout, languageCode, setCheckout]);

  const removeItem = useCallback(async (lineId: string) => {
    if (!checkout) return;
    setCheckout(await removeCheckoutLine(checkout.id, languageCode, lineId));
  }, [checkout, languageCode, setCheckout]);

  const clearCart = useCallback(() => {
    writeId(channel, null);
    setCheckoutState(null);
  }, [channel]);

  const totalItems = checkout ? checkout.lines.reduce((sum, l) => sum + l.quantity, 0) : 0;

  return (
    <CartContext.Provider value={{ checkout, loading, totalItems, addItem, updateQuantity, removeItem, setCheckout, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
