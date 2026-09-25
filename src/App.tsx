import { useEffect } from 'react';
import { I18nProvider, useI18n } from '@/i18n/I18nContext';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { StoreProvider, useStore } from '@/context/StoreContext';
import { NavProvider, useNav } from '@/context/NavContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { HomePage } from '@/pages/HomePage';
import { ShopPage } from '@/pages/ShopPage';
import { ProductDetailPage } from '@/pages/ProductDetailPage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { OrderPage } from '@/pages/OrderPage';
import { AboutPage } from '@/pages/AboutPage';
import { ContentPage } from '@/pages/ContentPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { AccountPage } from '@/pages/AccountPage';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { t } = useI18n();
  const { route } = useNav();
  const { store, loading, error, reload } = useStore();

  useEffect(() => {
    if (store) document.title = store.site.tagline ? `${store.site.brandName} — ${store.site.tagline}` : store.site.brandName;
  }, [store]);

  // 后台上传了网站图标时替换 index.html 中的默认图标
  const faviconUrl = store?.site.faviconUrl;
  useEffect(() => {
    if (!faviconUrl) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) {
      link.removeAttribute('type');
      link.removeAttribute('sizes');
      link.href = faviconUrl;
    }
  }, [faviconUrl]);

  // 首次加载显示 loading；切换语言/币种时保留旧内容，避免闪屏
  if (!store && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 size={24} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!store || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-neutral-400 text-lg mb-4">{t('error_load')}</p>
          <button onClick={reload} className="text-neutral-900 underline text-sm">
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />
      <main className="flex-1">
        {route.name === 'home' && <HomePage />}
        {route.name === 'shop' && <ShopPage key={route.category ?? 'all'} category={route.category} />}
        {route.name === 'product' && <ProductDetailPage slug={route.slug} />}
        {route.name === 'cart' && <CartPage />}
        {route.name === 'checkout' && <CheckoutPage />}
        {route.name === 'order' && <OrderPage key={route.id ?? ''} id={route.id} />}
        {route.name === 'about' && <AboutPage />}
        {route.name === 'page' && <ContentPage slug={route.slug} />}
        {route.name === 'login' && <LoginPage next={route.next} />}
        {route.name === 'register' && <RegisterPage next={route.next} />}
        {route.name === 'resetPassword' && <ResetPasswordPage email={route.email} token={route.token} />}
        {route.name === 'account' && <AccountPage tab={route.tab} />}
        {route.name === 'notFound' && <NotFoundPage />}
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <I18nProvider>
      <NavProvider>
        <StoreProvider>
          <AuthProvider>
            <CartProvider>
              <AppContent />
            </CartProvider>
          </AuthProvider>
        </StoreProvider>
      </NavProvider>
    </I18nProvider>
  );
}

export default App;
