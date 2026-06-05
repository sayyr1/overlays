import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../api/axiosInstance';
import ProductMobileCard from '../../components/usuario/ProductMobileCard/ProductMobileCard';

const ProductSkeletonCard = () => (
  <div className="animate-pulse">
    <div className="h-[152px] rounded-[18px] bg-[#f1f1f1] sm:h-[164px] lg:h-[172px]" />
    <div className="mt-3 h-4 w-4/5 rounded-full bg-white/10" />
    <div className="mt-2 h-3 w-2/5 rounded-full bg-white/10" />
    <div className="mt-2 h-5 w-1/3 rounded-full bg-white/10" />
    <div className="mt-3 h-6 w-24 rounded-md bg-white/10" />
  </div>
);

export default function SectionProductsPage({
  title,
  description,
  mode = 'all'
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get('/api/products');
        if (!cancelled) {
          setProducts(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error(`Error cargando pagina de ${title}`, error);
        if (!cancelled) {
          setProducts([]);
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
  }, [title]);

  const visibleProducts = useMemo(() => {
    const list = [...products];

    if (mode === 'offers') {
      return list.filter(product =>
        product.onSale === true || (typeof product.discount === 'number' && product.discount > 0)
      );
    }

    if (mode === 'new') {
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return list;
  }, [mode, products]);

  return (
    <main className="min-h-screen bg-[#141414]">
      <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#1a1a1a] p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-white/35">Home section</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/55 sm:text-base">
            {description}
          </p>
        </section>

        {!loading && (
          <section className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-white">
              {visibleProducts.length} productos disponibles
            </p>
          </section>
        )}

        {loading ? (
          <section className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <ProductSkeletonCard key={`product-section-skeleton-${index}`} />
            ))}
          </section>
        ) : visibleProducts.length > 0 ? (
          <section className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {visibleProducts.map(product => (
              <ProductMobileCard key={product._id} product={product} variant="market" />
            ))}
          </section>
        ) : (
          <div className="rounded-[22px] border border-dashed border-white/10 bg-[#1a1a1a] px-6 py-12 text-center text-white/50">
            No encontramos productos para esta seccion.
          </div>
        )}
      </div>
    </main>
  );
}
