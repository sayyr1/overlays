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
    <section className="relative isolate overflow-hidden bg-slate-50/80 py-16">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white via-slate-50 to-white" />
      <div className="container mx-auto px-4 lg:px-10">
        <div className="flex flex-col gap-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-lime-500">
            Selección editorial
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.3rem]">
            Productos en promoción
          </h2>
          <p className="mx-auto max-w-2xl text-base text-[#5f6168] sm:text-lg">
            Mercaderia en oferta o con descuento especial por tiempo limitado.
          </p>
        </div>

        <div className="mt-10">
          {loading && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {loadingSkeleton.map(item => (
                <div
                  key={`promo-skeleton-${item}`}
                  className="h-72 animate-pulse rounded-[32px] border border-white/70 bg-white/80 shadow-inner shadow-slate-200"
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="mt-12 rounded-[32px] border border-red-200 bg-red-50/90 px-6 py-8 text-center text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && promoProducts.length === 0 && (
            <div className="mt-12 rounded-[32px] border border-slate-100 bg-white/90 px-6 py-10 text-center text-sm text-slate-500 shadow-inner">
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
              className="mt-6 !pb-16"
            >
              {promoProducts.map(product => (
                <SwiperSlide key={product._id}>
                  <div className="px-2">
                    <div className="rounded-[32px] border border-white/70 bg-white/95 p-2 shadow-xl shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-2xl">
                      <EnPromocion product={product} />
                    </div>
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
