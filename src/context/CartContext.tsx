import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/context/AuthContext';
import {
  addCheckoutLine, attachCustomer, createCheckout, fetchCheckout, removeCheckoutLine, updateCheckoutLine,
} from '@/lib/checkout';
import { CHANNELS } from '@/config';
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
  const { user } = useAuth();
  const [checkout, setCheckoutState] = useState<Checkout | null>(null);
  const [loading, setLoading] = useState(true);
  const attachedRef = useRef('');
  const prevUserRef = useRef<string | null>(null);

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

  // 登录后把登录前加购的购物袋关联到账号，下单后订单才会出现在「我的订单」中
  useEffect(() => {
    if (!user || !checkout) return;
    const key = `${user.id}:${checkout.id}`;
    if (attachedRef.current === key) return;
    attachedRef.current = key;
    attachCustomer(checkout.id, languageCode)
      .then(c => setCheckoutState(c))
      .catch(() => { /* 关联失败不影响继续购物，下单时按填写的邮箱处理 */ });
  }, [user, checkout, languageCode]);

  // 退出登录后清空购物袋，避免共用设备时下一位访客看到上一位的购物袋和地址
  useEffect(() => {
    const prev = prevUserRef.current;
    prevUserRef.current = user?.id ?? null;
    if (prev && !user) {
      for (const c of CHANNELS) writeId(c.slug, null);
      setCheckoutState(null);
      attachedRef.current = '';
    }
  }, [user]);

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
