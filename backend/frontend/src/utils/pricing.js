export const getPriceForUser = (product, membershipLevel = 'STANDARD') => {
  if (!product?.price) return 0;
  const level = membershipLevel?.toUpperCase?.() ?? 'STANDARD';
  switch (level) {
    case 'GOLD':
      return Number(product.price.gold ?? product.price.retail ?? 0);
    case 'PREMIUM':
      return Number(product.price.premium ?? product.price.retail ?? 0);
    case 'PLATINUM':
      return Number(product.price.platinum ?? product.price.retail ?? 0);
    default:
      return Number(product.price.retail ?? 0);
  }
};

export const formatCurrency = value => new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD'
}).format(Number(value ?? 0));
