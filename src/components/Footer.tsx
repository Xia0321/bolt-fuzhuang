import { Instagram, Mail } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useStore } from '@/context/StoreContext';
import { useNav } from '@/context/NavContext';

export function Footer() {
  const { t } = useI18n();
  const { store } = useStore();
  const { navigate, navigateUrl } = useNav();
  if (!store) return null;
  const { site, navbar, footer, footerLegal } = store;

  return (
    <footer className="bg-neutral-950 text-neutral-400 mt-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-white text-xl font-light tracking-[0.25em] uppercase mb-4">{site.brandName}</h3>
            <p className="text-[13px] leading-relaxed text-neutral-500 max-w-xs">
              {site.tagline}
            </p>
            <div className="flex gap-4 mt-6">
              {site.instagramUrl && (
                <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white transition-colors" aria-label="Instagram">
                  <Instagram size={18} />
                </a>
              )}
              {site.contactEmail && (
                <a href={`mailto:${site.contactEmail}`} className="text-neutral-500 hover:text-white transition-colors" aria-label="Email">
                  <Mail size={18} />
                </a>
              )}
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
              {navbar.map(link => (
                <li key={link.id}>
                  <button onClick={() => navigateUrl(link.url)} className="text-[13px] hover:text-white transition-colors">
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Brand */}
          <div>
            <h4 className="text-white text-[12px] tracking-[0.15em] uppercase mb-4 font-medium">{t('footer_about')}</h4>
            <ul className="space-y-2.5">
              {footer.map(link => (
                <li key={link.id}>
                  <button onClick={() => navigateUrl(link.url)} className="text-[13px] hover:text-white transition-colors">
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white text-[12px] tracking-[0.15em] uppercase mb-4 font-medium">{t('footer_contact')}</h4>
            <ul className="space-y-2.5">
              {site.contactEmail && (
                <li><a href={`mailto:${site.contactEmail}`} className="text-[13px] hover:text-white transition-colors">{site.contactEmail}</a></li>
              )}
              {site.contactPhone && <li><span className="text-[13px] text-neutral-500">{site.contactPhone}</span></li>}
              {site.contactAddress && <li><span className="text-[13px] text-neutral-500">{site.contactAddress}</span></li>}
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[12px] text-neutral-600">© {new Date().getFullYear()} {site.brandName}. {t('footer_rights')}</p>
          <div className="flex gap-6">
            {footerLegal.map(link => (
              <button key={link.id} onClick={() => navigateUrl(link.url)} className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors">
                {link.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
