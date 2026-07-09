import React, { useMemo } from 'react';
import VisualShelfSection from './VisualShelfSection';

const normalizeValue = value => (value ?? '').toString().trim();

export default function CollectionsSection({
  products = [],
  loading = false,
  limit = 6,
  title = 'Coleccion',
  eyebrow,
  to = '/colecciones',
  linkLabel = 'Ver mas'
}) {
  const items = useMemo(() => {
    const grouped = new Map();

    products.forEach(product => {
      const collection = normalizeValue(product.collection);
      if (!collection) return;

      const current = grouped.get(collection) || {
        label: collection,
        image: product.images?.[0]?.url || '',
        count: 0
      };

      current.count += 1;
      if (!current.image && product.images?.[0]?.url) {
        current.image = product.images[0].url;
      }

      grouped.set(collection, current);
    });

    return Array.from(grouped.values())
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'))
      .slice(0, limit)
      .map(item => ({
        ...item,
        meta: `${item.count} piezas`,
        to: `/productos?collection=${encodeURIComponent(item.label)}`
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
    />
  );
}
