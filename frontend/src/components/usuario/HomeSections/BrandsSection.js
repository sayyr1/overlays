import React, { useMemo } from 'react';
import VisualShelfSection from './VisualShelfSection';

const normalizeValue = value => (value ?? '').toString().trim();

export default function BrandsSection({
  products = [],
  loading = false,
  limit = 6,
  title = 'Marcas',
  eyebrow,
  to = '/marcas',
  linkLabel = 'Ver mas'
}) {
  const items = useMemo(() => {
    const grouped = new Map();

    products.forEach(product => {
      const brand = normalizeValue(product.brand);
      if (!brand) return;

      const current = grouped.get(brand) || {
        label: brand,
        image: product.images?.[0]?.url || '',
        count: 0
      };

      current.count += 1;
      if (!current.image && product.images?.[0]?.url) {
        current.image = product.images[0].url;
      }

      grouped.set(brand, current);
    });

    return Array.from(grouped.values())
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'))
      .slice(0, limit)
      .map(item => ({
        ...item,
        meta: `${item.count} productos`,
        to: `/productos?brand=${encodeURIComponent(item.label)}`
      }));
  }, [limit, products]);

  return (
    <VisualShelfSection
      eyebrow={eyebrow}
      title={title}
      to={to}
      linkLabel={linkLabel}
      items={items}
      loading={loading}
      emptyMessage="Aun no hay marcas suficientes para destacar."
    />
  );
}
