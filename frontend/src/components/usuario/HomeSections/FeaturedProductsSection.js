import React, { useEffect, useState } from 'react';
import axios from '../../../api/axiosInstance';
import ProductShelfSection from './ProductShelfSection';

const FeaturedProductsSection = ({ products: providedProducts, loading: providedLoading = false }) => {
  const [promoProducts, setPromoProducts] = useState([]);
  const [loading, setLoading] = useState(!providedProducts);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (providedProducts) {
      const filtered = providedProducts.filter(product =>
        product.onSale === true || (typeof product.discount === 'number' && product.discount > 0)
      );
      setPromoProducts(filtered.slice(0, 12));
      setLoading(Boolean(providedLoading));
      setError(null);
      return;
    }

    const fetchAndFilter = async () => {
      try {
        const { data } = await axios.get('/api/products');
        const filtered = (data || []).filter(product =>
          product.onSale === true || (typeof product.discount === 'number' && product.discount > 0)
        );
        setPromoProducts(filtered.slice(0, 12));
      } catch (err) {
        console.error('Error cargando productos destacados', err);
        setError('No se pudieron cargar los productos destacados.');
      } finally {
        setLoading(false);
      }
    };

    fetchAndFilter();
  }, [providedLoading, providedProducts]);

  if (error && !loading) {
    return (
      <section className="bg-[#141414] py-8">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="rounded-[24px] border border-red-900/40 bg-red-950/30 px-6 py-8 text-center text-sm font-medium text-red-200">
            {error}
          </div>
        </div>
      </section>
    );
  }

  return (
    <ProductShelfSection
      title="Ofertas"
      to="/ofertas"
      products={promoProducts}
      loading={loading}
      emptyMessage="No hay productos destacados por el momento. Vuelve a revisar en unas horas."
    />
  );
};

export default FeaturedProductsSection;
