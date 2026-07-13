const randomChunk = () => Math.random().toString(36).slice(2, 6).toUpperCase();

export const generateLeadCode = (prefix = 'RC') => {
  const timeChunk = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${timeChunk}${randomChunk()}`;
};

export const buildWhatsAppMessage = ({
  title = '',
  price = '',
  url = '',
  leadCode = ''
}) => {
  const lines = [
    'Hola, me interesa este producto:',
    `- Nombre: ${title || 'Producto'}`,
    `- Precio: ${price || 'Consultar'}`,
    url ? `- URL: ${url}` : '',
    leadCode ? `- Ref: ${leadCode}` : ''
  ].filter(Boolean);

  return encodeURIComponent(lines.join('\n'));
};

export const buildWhatsAppHref = ({
  phone = '',
  title = '',
  price = '',
  url = '',
  leadCode = ''
}) => {
  const sanitizedPhone = String(phone || '').replace(/\D/g, '');
  const base = sanitizedPhone ? `https://wa.me/${sanitizedPhone}` : 'https://wa.me/';
  return `${base}?text=${buildWhatsAppMessage({ title, price, url, leadCode })}`;
};
