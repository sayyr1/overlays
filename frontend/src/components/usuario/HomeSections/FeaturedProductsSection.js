import React, { useEffect, useState } from 'react';
import axios from '../../../api/axiosInstance';
import EnPromocion from '../CardStyles/EnPromocion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const loadingSkeleton = Array.from({ length: 4 }, (_, index) => index);

const FeaturedProductsSection = () => {
  const [promoProducts, setPromoProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAndFilter = async () => {
      try {
        const { data } = await axios.get('/api/products');
        const filtered = (data || []).filter(product =>
          product.onSale === true || (typeof product.discount === 'number' && product.discount > 0)
        );
        setPromoProducts(filtered);
      } catch (err) {
        console.error('Error cargando productos destacados', err);
        setError('No se pudieron cargar los productos destacados.');
      } finally {
        setLoading(false);
      }
    };

    fetchAndFilter();
  }, []);

  return (
    <section className="relative isolate overflow-hidden py-16">
      <div className="absolute inset-x-0 top-0 -z-10 h-full bg-gradient-to-b from-surface-50 via-white to-surface-50/40" />
      <div className="container mx-auto px-4 lg:px-10">
        <div className="flex flex-col gap-4 text-center">
          <span className="pill-badge mx-auto bg-brand/10 text-brand">
            Seleccion editorial
          </span>
          <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Productos en promocion
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-slate-500 sm:text-base">
            Merchandising curado con descuentos dinamicos y disponibilidad garantizada. Actualizamos la seleccion cada 12 horas para maximizar conversion.
          </p>
        </div>

        <div className="mt-10">
          {loading && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {loadingSkeleton.map(item => (
                <div
                  key={`promo-skeleton-${item}`}
                  className="h-72 animate-pulse rounded-2xl border border-surface-200/60 bg-white/70"
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="mt-12 rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && promoProducts.length === 0 && (
            <div className="mt-12 rounded-3xl border border-surface-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
              No hay productos destacados por el momento. Vuelve a revisar en unas horas.
            </div>
          )}

          {!loading && !error && promoProducts.length > 0 && (
            <Swiper
              modules={[Navigation, Pagination, A11y]}
              spaceBetween={24}
              slidesPerView={1.2}
              navigation
              pagination={{ clickable: true }}
              breakpoints={{
                640: { slidesPerView: 1.6 },
                768: { slidesPerView: 2.2 },
                1024: { slidesPerView: 3 },
                1280: { slidesPerView: 3.5 }
              }}
              className="!pb-12"
            >
              {promoProducts.map(product => (
                <SwiperSlide key={product._id}>
                  <div className="px-2">
                    <EnPromocion product={product} />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          )}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProductsSection;
