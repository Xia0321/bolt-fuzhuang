import { useState, useEffect } from 'react';
import { ShoppingBag, Menu, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useCart } from '@/context/CartContext';
import { useStore } from '@/context/StoreContext';
import { useNav } from '@/context/NavContext';
import { locales, localeLabels } from '@/i18n/translations';
import { CHANNELS } from '@/config';
import { routeToPath } from '@/lib/router';
import type { MenuLink } from '@/types';

export function Navbar() {
  const { locale, setLocale, channel, setChannel, t } = useI18n();
  const { totalItems } = useCart();
  const { store } = useStore();
  const { route, navigate, navigateUrl } = useNav();
  const links = store?.navbar ?? [];
  const brandName = store?.site.brandName ?? '';
  const currentChannel = CHANNELS.find(c => c.slug === channel);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [localeOpen, setLocaleOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [route]);

  const isHome = route.name === 'home';
  const headerClass = scrolled
    ? 'bg-white/95 backdrop-blur-md shadow-sm'
    : isHome
      ? 'bg-transparent'
      : 'bg-white';

  const linkClass = scrolled || !isHome
    ? 'text-neutral-800 hover:text-neutral-500'
    : 'text-white hover:text-white/70';

  const logoClass = scrolled || !isHome
    ? 'text-neutral-900'
    : 'text-white';

  const currentPath = routeToPath(route);

  const navLink = (key: string, label: string, url: string) => (
    <button
      key={key}
      onClick={() => navigateUrl(url)}
      className={`text-[13px] tracking-wide uppercase font-medium transition-colors duration-200 relative py-1 ${linkClass} ${currentPath === url ? 'after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-px after:bg-current' : ''}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerClass}`}>
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Left: mobile menu + nav */}
            <div className="flex items-center gap-6 flex-1">
              <button
                className={`md:hidden ${linkClass}`}
                onClick={() => setMobileOpen(true)}
                aria-label="Menu"
              >
                <Menu size={22} />
              </button>
              <nav className="hidden md:flex items-center gap-6">
                {navLink('shop', t('nav_shop'), '/shop')}
                {links.map((link: MenuLink) => navLink(link.id, link.name, link.url))}
              </nav>
            </div>

            {/* Center: logo */}
            <button onClick={() => navigate({ name: 'home' })} className="flex items-center justify-center flex-shrink-0">
              <span className={`text-xl md:text-2xl font-light tracking-[0.3em] uppercase ${logoClass} transition-colors duration-300`}>
                {brandName}
              </span>
            </button>

            {/* Right: locale + cart */}
            <div className="flex items-center gap-4 flex-1 justify-end">
              <div className="relative hidden sm:block">
                <button
                  className={`text-[13px] tracking-wide font-medium flex items-center gap-1 transition-colors ${linkClass}`}
                  onClick={() => setLocaleOpen(!localeOpen)}
                >
                  {localeLabels[locale]} · {currentChannel?.currency}
                  <span className="text-[10px]">▾</span>
                </button>
                {localeOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setLocaleOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 bg-white shadow-lg rounded-sm border border-neutral-100 py-2 z-20 min-w-[140px]">
                      <p className="px-4 pt-1 pb-1.5 text-[10px] tracking-[0.15em] uppercase text-neutral-400">{t('nav_language')}</p>
                      {locales.map(l => (
                        <button
                          key={l}
                          onClick={() => { setLocale(l); setLocaleOpen(false); }}
                          className={`block w-full text-left px-4 py-1.5 text-[13px] transition-colors hover:bg-neutral-50 ${locale === l ? 'text-neutral-900 font-medium' : 'text-neutral-500'}`}
                        >
                          {localeLabels[l]}
                        </button>
                      ))}
                      <div className="my-2 border-t border-neutral-100" />
                      <p className="px-4 pt-1 pb-1.5 text-[10px] tracking-[0.15em] uppercase text-neutral-400">{t('nav_currency')}</p>
                      {CHANNELS.map(c => (
                        <button
                          key={c.slug}
                          onClick={() => { setChannel(c.slug); setLocaleOpen(false); }}
                          className={`block w-full text-left px-4 py-1.5 text-[13px] transition-colors hover:bg-neutral-50 ${channel === c.slug ? 'text-neutral-900 font-medium' : 'text-neutral-500'}`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                className={`relative ${linkClass}`}
                onClick={() => navigate({ name: 'cart' })}
                aria-label={t('nav_cart')}
              >
                <ShoppingBag size={22} strokeWidth={1.5} />
                {totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-neutral-900 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-medium">
                    {totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-white flex flex-col">
            <div className="flex items-center justify-between px-6 h-16 border-b border-neutral-100">
              <span className="text-lg font-light tracking-[0.2em] uppercase">{brandName}</span>
              <button onClick={() => setMobileOpen(false)}><X size={22} /></button>
            </div>
            <nav className="flex flex-col py-4">
              <button onClick={() => navigate({ name: 'home' })} className="text-left px-6 py-3 text-[15px] tracking-wide hover:bg-neutral-50">
                {t('nav_home')}
              </button>
              <button onClick={() => navigate({ name: 'shop' })} className="text-left px-6 py-3 text-[15px] tracking-wide hover:bg-neutral-50">
                {t('nav_shop')}
              </button>
              {links.map(link => (
                <button
                  key={link.id}
                  onClick={() => navigateUrl(link.url)}
                  className="text-left px-6 py-3 text-[15px] tracking-wide hover:bg-neutral-50 text-neutral-600 pl-12"
                >
                  {link.name}
                </button>
              ))}
              {(store?.footer ?? []).map(link => (
                <button key={link.id} onClick={() => navigateUrl(link.url)} className="text-left px-6 py-3 text-[15px] tracking-wide hover:bg-neutral-50">
                  {link.name}
                </button>
              ))}
            </nav>
            <div className="mt-auto px-6 py-6 border-t border-neutral-100 space-y-4">
              <div className="flex gap-4">
                {locales.map(l => (
                  <button
                    key={l}
                    onClick={() => setLocale(l)}
                    className={`text-[14px] ${locale === l ? 'text-neutral-900 font-medium' : 'text-neutral-400'}`}
                  >
                    {localeLabels[l]}
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                {CHANNELS.map(c => (
                  <button
                    key={c.slug}
                    onClick={() => setChannel(c.slug)}
                    className={`text-[13px] ${channel === c.slug ? 'text-neutral-900 font-medium' : 'text-neutral-400'}`}
                  >
                    {c.currency}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
