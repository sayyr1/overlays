import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../../api/axiosInstance';
import VisualShelfSection from './VisualShelfSection';

const normalizeValue = value => (value ?? '').toString().trim();

export default function OrigenSection({
  title = 'Explora por origen',
  limit = 6,
  products: providedProducts,
  categoriesData: providedCategoriesData,
  loading: providedLoading = false
}) {
  const [values, setValues] = useState([]);
  const [products, setProducts] = useState(providedProducts || []);
  const [loading, setLoading] = useState(
    !providedCategoriesData || !providedProducts ? true : Boolean(providedLoading)
  );
  const [keyName, setKeyName] = useState('ORIGEN');

  const origenKey = useMemo(() => 'ORIGEN', []);

  useEffect(() => {
    if (providedCategoriesData && providedProducts) {
      const keys = Object.keys(providedCategoriesData || {});
      const resolved = keys.find(k => k.toLowerCase() === 'origen') || origenKey;
      const arr = Array.isArray(providedCategoriesData?.[resolved])
        ? providedCategoriesData[resolved].filter(Boolean)
        : [];

      setValues(arr);
      setProducts(providedProducts);
      setKeyName(resolved);
      setLoading(Boolean(providedLoading));
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [{ data }, { data: productsData }] = await Promise.all([
          axios.get('/api/categories'),
          axios.get('/api/products')
        ]);
        const keys = Object.keys(data || {});
        const resolved = keys.find(k => k.toLowerCase() === 'origen') || origenKey;
        const arr = Array.isArray(data?.[resolved]) ? data[resolved].filter(Boolean) : [];
        if (!cancelled) {
          setValues(arr);
          setProducts(Array.isArray(productsData) ? productsData : []);
          setKeyName(resolved);
        }
      } catch {
        if (!cancelled) {
          setValues([]);
          setProducts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [origenKey, providedCategoriesData, providedLoading, providedProducts]);

  const list = useMemo(() => (limit ? values.slice(0, limit) : values), [values, limit]);

  const items = useMemo(
    () =>
      list
        .map(value => {
          const normalizedLabel = normalizeValue(value);
          const relatedProducts = products.filter(product => {
            const attrValue = normalizeValue(product.attributes?.[keyName]);
            return attrValue.toLowerCase() === normalizedLabel.toLowerCase();
          });

          return {
            label: normalizedLabel,
            to: `/productos?${encodeURIComponent(keyName)}=${encodeURIComponent(normalizedLabel)}`,
            image: relatedProducts[0]?.images?.[0]?.url || '',
            meta: relatedProducts.length > 0 ? `${relatedProducts.length} productos` : 'Ver productos'
          };
        })
        .filter(item => item.label),
    [keyName, list, products]
  );

  return (
    <VisualShelfSection
      title="Origen"
      to="/origen"
      items={items}
      loading={loading}
      emptyMessage="No encontramos origenes disponibles por ahora."
    />
  );
}
