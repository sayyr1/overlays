import React from 'react';
import { Link } from 'react-router-dom';
import { usePublicConfig } from '../../../context/PublicConfigContext';
import { trackWhatsAppClick } from '../../../services/crmTracking';

const socialEntries = socialLinks => {
  if (!socialLinks || typeof socialLinks !== 'object') return [];
  return Object.entries(socialLinks).filter(([, value]) => value);
};

const STORE_LINKS = [
  { label: 'Catalogo', to: '/productos' },
  { label: 'Categorias', to: '/categorias' },
  { label: 'Ofertas', to: '/productos?onSale=true' },
  { label: 'Mis pedidos', to: '/mis-pedidos' }
];

export default function Footer() {
  const { settings, branding, storeName, textMap, isModuleEnabled } = usePublicConfig();
  const socials = socialEntries(settings?.socialLinks);
  const sanitizedWhatsapp = String(settings?.whatsapp || '').replace(/\D/g, '');
  const footerText =
    textMap.footer_text ||
    settings?.footerText ||
    `Copyright ${new Date().getFullYear()} ${storeName}.`;

  const handleWhatsAppClick = () => {
    if (!isModuleEnabled('crm')) {
      return;
    }

    trackWhatsAppClick({
      productId: '',
      title: 'WhatsApp tienda',
      href: sanitizedWhatsapp ? `https://wa.me/${sanitizedWhatsapp}` : 'https://wa.me/'
    });
  };

  return (
    <footer className="mt-auto border-t border-white/10 bg-[#252525] text-slate-300">
      <div className="container mx-auto px-4 py-12 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo Footer" className="h-10 object-contain" />
            ) : (
              <h3 className="text-3xl font-semibold text-white">{storeName}</h3>
            )}
            <p className="max-w-xs text-sm text-white/60">{footerText}</p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white">Store</h4>
            <ul className="space-y-2 text-sm text-white/70">
              {STORE_LINKS.map(item => (
                <li key={item.label}>
                  <Link to={item.to} className="transition hover:text-brand">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white">Contacto</h4>
            <ul className="space-y-2 text-sm text-white/70">
              {settings?.contactEmail && <li>{settings.contactEmail}</li>}
              {settings?.phone && <li>{settings.phone}</li>}
              {settings?.whatsapp && (
                <li>
                  <a
                    href={sanitizedWhatsapp ? `https://wa.me/${sanitizedWhatsapp}` : 'https://wa.me/'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={handleWhatsAppClick}
                    className="transition hover:text-brand"
                  >
                    WhatsApp: {settings.whatsapp}
                  </a>
                </li>
              )}
              {settings?.address && <li>{settings.address}</li>}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white">Redes</h4>
            <ul className="space-y-2 text-sm text-white/70">
              {socials.length ? (
                socials.map(([key, value]) => (
                  <li key={key}>
                    <a href={value} target="_blank" rel="noreferrer" className="transition hover:text-brand">
                      {key}
                    </a>
                  </li>
                ))
              ) : (
                <li>Sin redes configuradas</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
