import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CartItem, Locale } from '@/types';
import { localized } from '@/i18n/translations';

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, size: string, colorIndex: number) => void;
  updateQuantity: (productId: string, size: string, colorIndex: number, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  getItemKey: (productId: string, size: string, colorIndex: number) => string;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'app-cart';

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getItemKey(productId: string, size: string, colorIndex: number): string {
  return `${productId}__${size}__${colorIndex}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item: CartItem) => {
    setItems(prev => {
      const key = getItemKey(item.productId, item.size, item.colorIndex);
      const existing = prev.find(i => getItemKey(i.productId, i.size, i.colorIndex) === key);
      if (existing) {
        return prev.map(i =>
          getItemKey(i.productId, i.size, i.colorIndex) === key
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  };

  const removeItem = (productId: string, size: string, colorIndex: number) => {
    const key = getItemKey(productId, size, colorIndex);
    setItems(prev => prev.filter(i => getItemKey(i.productId, i.size, i.colorIndex) !== key));
  };

  const updateQuantity = (productId: string, size: string, colorIndex: number, quantity: number) => {
    if (quantity < 1) return;
    const key = getItemKey(productId, size, colorIndex);
    setItems(prev => prev.map(i =>
      getItemKey(i.productId, i.size, i.colorIndex) === key
        ? { ...i, quantity }
        : i
    ));
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal, getItemKey }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function cartItemName(item: CartItem, locale: Locale): string {
  return localized(item.name, locale);
}
