export type Locale = 'zh' | 'en' | 'ja';

export interface Money {
  amount: number;
  currency: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
}

export interface ProductColor {
  slug: string;
  name: string;
  hex: string;
}

export interface ProductVariant {
  id: string;
  size: string | null;
  colorSlug: string | null;
  price: Money | null;
  quantityAvailable: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string | null;
  images: string[];
  price: Money | null;
  sizes: string[];
  colors: ProductColor[];
  variants: ProductVariant[];
  featured: boolean;
  isAvailable: boolean;
}

export interface MenuLink {
  id: string;
  name: string;
  // 站内路径（如 /shop/outerwear、/pages/returns）或外部链接
  url: string;
  category: Category | null;
}

export interface Banner {
  title: string;
  eyebrow: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  imageUrl: string | null;
  paragraphs: string[];
}

export interface Feature {
  title: string;
  subtitle: string;
  value: string;
  icon: string;
  placement: string;
  sortOrder: number;
}

export interface SiteSettings {
  brandName: string;
  tagline: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  instagramUrl: string;
  faviconUrl: string | null;
}

export interface ContentPage {
  slug: string;
  title: string;
  paragraphs: string[];
}

export interface ShippingRule {
  name: string;
  price: Money;
  minimumOrderPrice: number;
  maximumOrderPrice: number | null;
}

export interface StoreData {
  site: SiteSettings;
  categories: Category[];
  products: Product[];
  navbar: MenuLink[];
  footer: MenuLink[];
  footerLegal: MenuLink[];
  banners: Record<string, Banner>;
  features: Feature[];
  pages: Record<string, ContentPage>;
  shippingRules: ShippingRule[];
}

export interface CartLine {
  id: string;
  quantity: number;
  variantId: string;
  productSlug: string;
  name: string;
  image: string | null;
  size: string | null;
  color: string | null;
  unitPrice: Money;
  totalPrice: Money;
  quantityAvailable: number;
}

export interface Address {
  firstName: string;
  lastName: string;
  streetAddress1: string;
  streetAddress2: string;
  city: string;
  cityArea: string;
  postalCode: string;
  country: string;
  countryArea: string;
  phone: string;
}

export interface ShippingOption {
  id: string;
  name: string;
  price: Money;
  minDays: number | null;
  maxDays: number | null;
}

export interface Checkout {
  id: string;
  email: string | null;
  lines: CartLine[];
  subtotal: Money;
  shipping: Money;
  total: Money;
  shippingAddress: Address | null;
  deliveryMethodId: string | null;
  shippingOptions: ShippingOption[];
  paymentGateways: { id: string; name: string }[];
}

export interface PlacedOrder {
  // 订单 UUID，不可猜测，可作为游客查看订单的专属链接
  id: string;
  number: string;
  total: Money;
  email: string;
}

export interface SavedAddress extends Address {
  id: string;
  isDefaultShipping: boolean;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  addresses: SavedAddress[];
}

export type OrderStatus =
  | 'DRAFT' | 'UNCONFIRMED' | 'UNFULFILLED' | 'PARTIALLY_FULFILLED' | 'PARTIALLY_RETURNED'
  | 'RETURNED' | 'FULFILLED' | 'CANCELED' | 'EXPIRED';

export interface OrderSummary {
  id: string;
  number: string;
  created: string;
  status: OrderStatus;
  total: Money;
  itemCount: number;
  image: string | null;
}

export interface OrderLine {
  name: string;
  variant: string;
  quantity: number;
  image: string | null;
  totalPrice: Money;
}

export interface Shipment {
  trackingNumber: string;
  created: string;
}

export interface OrderDetail extends OrderSummary {
  email: string;
  isPaid: boolean;
  lines: OrderLine[];
  subtotal: Money;
  shipping: Money;
  shippingAddress: Address | null;
  shippingMethod: string;
  shipments: Shipment[];
}
