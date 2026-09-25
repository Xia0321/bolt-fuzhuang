import { Instagram, Mail } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { localized } from '@/i18n/translations';
import type { Category } from '@/types';
import type { Route } from '@/lib/router';

interface FooterProps {
  categories: Category[];
  navigate: (r: Route) => void;
}

export function Footer({ categories, navigate }: FooterProps) {
  const { locale, t } = useI18n();

  return (
    <footer className="bg-neutral-950 text-neutral-400 mt-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-white text-xl font-light tracking-[0.25em] uppercase mb-4">Maison</h3>
            <p className="text-[13px] leading-relaxed text-neutral-500 max-w-xs">
              {t('footer_tagline')}
            </p>
            <div className="flex gap-4 mt-6">
              <a href="#" className="text-neutral-500 hover:text-white transition-colors" aria-label="Instagram">
                <Instagram size={18} />
              </a>
              <a href="#" className="text-neutral-500 hover:text-white transition-colors" aria-label="Email">
                <Mail size={18} />
              </a>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-white text-[12px] tracking-[0.15em] uppercase mb-4 font-medium">{t('footer_shop')}</h4>
            <ul className="space-y-2.5">
              <li>
                <button onClick={() => navigate({ name: 'shop' })} className="text-[13px] hover:text-white transition-colors">
                  {t('nav_shop')}
                </button>
              </li>
              {categories.map(cat => (
                <li key={cat.id}>
                  <button
                    onClick={() => navigate({ name: 'shop', category: cat.slug })}
                    className="text-[13px] hover:text-white transition-colors"
                  >
                    {localized(cat.name, locale)}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Brand */}
          <div>
            <h4 className="text-white text-[12px] tracking-[0.15em] uppercase mb-4 font-medium">{t('footer_about')}</h4>
            <ul className="space-y-2.5">
              <li><button onClick={() => navigate({ name: 'about' })} className="text-[13px] hover:text-white transition-colors">{t('nav_about')}</button></li>
              <li><a href="#" className="text-[13px] hover:text-white transition-colors">{t('footer_shipping')}</a></li>
              <li><a href="#" className="text-[13px] hover:text-white transition-colors">{t('footer_returns')}</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white text-[12px] tracking-[0.15em] uppercase mb-4 font-medium">{t('footer_contact')}</h4>
            <ul className="space-y-2.5">
              <li><a href="mailto:hello@maison.com" className="text-[13px] hover:text-white transition-colors">hello@maison.com</a></li>
              <li><span className="text-[13px] text-neutral-500">+86 21 0000 0000</span></li>
              <li><span className="text-[13px] text-neutral-500">Shanghai · Paris · Tokyo</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[12px] text-neutral-600">© 2026 Maison. {t('footer_rights')}</p>
          <div className="flex gap-6">
            <a href="#" className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors">{t('footer_privacy')}</a>
            <a href="#" className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors">{t('footer_terms')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
