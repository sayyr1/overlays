import React, { useEffect, useState } from 'react';
import axios from '../../../api/axiosInstance';
import VisualShelfSection from './VisualShelfSection';

const normalizeValue = value => (value ?? '').toString().trim();

export default function CategoriesSection({
  limit,
  products: providedProducts,
  categoriesData: providedCategoriesData,
  loading: providedLoading = false
}) {
  const [categoriesData, setCategoriesData] = useState(providedCategoriesData || {});
  const [products, setProducts] = useState(providedProducts || []);
  const [loading, setLoading] = useState(
    !providedCategoriesData || !providedProducts ? true : Boolean(providedLoading)
  );
  const [error, setError] = useState(null);

  useEffect(() => {
    if (providedCategoriesData && providedProducts) {
      setCategoriesData(providedCategoriesData);
      setProducts(providedProducts);
      setLoading(Boolean(providedLoading));
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [{ data: nextCategories }, { data: nextProducts }] = await Promise.all([
          axios.get('/api/categories'),
          axios.get('/api/products')
        ]);

        if (!cancelled) {
          setCategoriesData(nextCategories || {});
          setProducts(Array.isArray(nextProducts) ? nextProducts : []);
          setError(null);
        }
      } catch (err) {
        console.error('Error cargando categorias', err);
        if (!cancelled) {
          setError('No se pudieron cargar las categorias.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [providedCategoriesData, providedLoading, providedProducts]);

  const categoryValues = Array.isArray(categoriesData?.type) ? categoriesData.type : [];
  const display = (limit ? categoryValues.slice(0, limit) : categoryValues)
    .map(name => {
      const normalizedName = normalizeValue(name);
      const relatedProducts = products.filter(product =>
        normalizeValue(product.type).toLowerCase() === normalizedName.toLowerCase()
      );

      return {
        label: normalizedName,
        to: `/categoria/${encodeURIComponent(normalizedName)}`,
        image: relatedProducts[0]?.images?.[0]?.url || '',
        meta: relatedProducts.length > 0 ? `${relatedProducts.length} productos` : 'Explorar'
      };
    })
    .filter(item => item.label);

  if (error && !loading) {
    return (
      <section className="bg-[#141414] py-8">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="rounded-2xl border border-red-900/40 bg-red-950/30 px-6 py-6 text-center text-sm text-red-200">
            {error}
          </div>
        </div>
      </section>
    );
  }

  return (
    <VisualShelfSection
      title="Categorias"
      to="/categorias"
      items={display}
      loading={loading}
      emptyMessage="Aun no hay categorias configuradas."
    />
  );
}
