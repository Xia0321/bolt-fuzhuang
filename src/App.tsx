import { useState, useEffect, useCallback } from 'react';
import { I18nProvider } from '@/i18n/I18nContext';
import { CartProvider } from '@/context/CartContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { HomePage } from '@/pages/HomePage';
import { ShopPage } from '@/pages/ShopPage';
import { ProductDetailPage } from '@/pages/ProductDetailPage';
import { CartPage } from '@/pages/CartPage';
import { AboutPage } from '@/pages/AboutPage';
import { supabase } from '@/lib/supabase';
import { useRouter } from '@/lib/router';
import type { Category, Product } from '@/types';
import { useI18n } from '@/i18n/I18nContext';
import { tr } from '@/i18n/translations';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { locale } = useI18n();
  const { route, navigate } = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [catRes, prodRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('products').select('*').order('sort_order'),
      ]);
      if (catRes.error) throw catRes.error;
      if (prodRes.error) throw prodRes.error;
      setCategories(catRes.data as Category[]);
      setProducts(prodRes.data as Product[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentProduct = route.name === 'product'
    ? products.find(p => p.slug === route.slug)
    : undefined;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 size={24} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-neutral-400 text-lg mb-4">{tr('error_load', locale)}</p>
          <button
            onClick={fetchData}
            className="text-neutral-900 underline text-sm"
          >
            {tr('loading', locale)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar categories={categories} navigate={navigate} route={route} />
      <main className="flex-1">
        {route.name === 'home' && <HomePage categories={categories} products={products} navigate={navigate} />}
        {route.name === 'shop' && <ShopPage categories={categories} products={products} navigate={navigate} initialCategory={route.category} />}
        {route.name === 'product' && <ProductDetailPage product={currentProduct} categories={categories} products={products} navigate={navigate} />}
        {route.name === 'cart' && <CartPage products={products} navigate={navigate} />}
        {route.name === 'about' && <AboutPage navigate={navigate} />}
      </main>
      <Footer categories={categories} navigate={navigate} />
    </div>
  );
}

function App() {
  return (
    <I18nProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </I18nProvider>
  );
}

export default App;
