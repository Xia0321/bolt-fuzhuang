export type Locale = 'zh' | 'en' | 'ja';

export interface LocalizedText {
  zh: string;
  en: string;
  ja: string;
}

export interface ProductColor {
  zh: string;
  en: string;
  ja: string;
  hex: string;
}

export interface Category {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText | null;
  image_url: string | null;
  sort_order: number;
}

export interface Product {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  price: number;
  category_id: string | null;
  images: string[];
  sizes: string[];
  colors: ProductColor[];
  featured: boolean;
  sort_order: number;
}

export interface CartItem {
  productId: string;
  slug: string;
  name: LocalizedText;
  price: number;
  image: string;
  size: string;
  colorIndex: number;
  quantity: number;
}
