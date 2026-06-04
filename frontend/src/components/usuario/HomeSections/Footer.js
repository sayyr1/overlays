import React from 'react';
import { usePublicConfig } from '../../../context/PublicConfigContext';
import { trackWhatsAppClick } from '../../../services/crmTracking';

const socialEntries = socialLinks => {
  if (!socialLinks || typeof socialLinks !== 'object') return [];
  return Object.entries(socialLinks).filter(([, value]) => value);
};

export default function Footer() {
  const { settings, branding, textMap, isModuleEnabled } = usePublicConfig();
  const socials = socialEntries(settings?.socialLinks);
  const sanitizedWhatsapp = String(settings?.whatsapp || '').replace(/\D/g, '');
  const footerText =
    textMap.footer_text ||
    settings?.footerText ||
    `Copyright ${new Date().getFullYear()} ${settings?.tradeName || 'Niway Store'}.`;

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
    <footer className="bg-slate-950 text-slate-300 py-10 mt-auto">
      <div className="container mx-auto px-4 grid grid-cols-1 gap-8 md:grid-cols-3">
        <div>
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo Footer" className="h-10 mb-4 object-contain" />
          ) : null}
          <p className="text-sm">{footerText}</p>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-white">Contacto</h4>
          <ul className="space-y-1 text-sm">
            {settings?.contactEmail && <li>{settings.contactEmail}</li>}
            {settings?.phone && <li>{settings.phone}</li>}
            {settings?.whatsapp && (
              <li>
                <a
                  href={sanitizedWhatsapp ? `https://wa.me/${sanitizedWhatsapp}` : 'https://wa.me/'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleWhatsAppClick}
                  className="hover:text-white"
                >
                  WhatsApp: {settings.whatsapp}
                </a>
              </li>
            )}
            {settings?.address && <li>{settings.address}</li>}
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-white">Redes</h4>
          <ul className="space-y-1 text-sm">
            {socials.length ? (
              socials.map(([key, value]) => (
                <li key={key}>
                  <a href={value} target="_blank" rel="noreferrer" className="hover:text-white">
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
    </footer>
  );
}
