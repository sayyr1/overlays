import React, { useEffect, useState } from 'react';
import axios from '../../../api/axiosInstance';
import Nuevos from '../CardStyles/Nuevos';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const MoreProductsSection = () => {
  const [recentProducts, setRecentProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentProducts = async () => {
      try {
        const { data } = await axios.get('/api/products');
        const allProducts = Array.isArray(data) ? data : [];

        const twoWeeksAgo = new Date();
        twoWeeksAgo.setHours(0, 0, 0, 0);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const filtered = allProducts.filter(product => {
          const createdAt = new Date(product.createdAt);
          return !Number.isNaN(createdAt.valueOf()) && createdAt >= twoWeeksAgo;
        });

        const sorted = filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRecentProducts(sorted.slice(0, 12));
      } catch (error) {
        console.error('Error cargando productos recientes', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentProducts();
  }, []);

  if (!loading && recentProducts.length === 0) {
    return null;
  }

  return (
    <section className="relative isolate overflow-hidden py-16">
      <div className="absolute inset-x-0 top-0 -z-10 h-full bg-gradient-to-b from-white via-surface-50 to-white" />

      <div className="container mx-auto px-4 lg:px-10">
        <div className="flex flex-col gap-3 text-center">
          <span className="pill-badge mx-auto bg-brand/5 text-brand">Ultimos lanzamientos</span>
          <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Recien agregados</h2>
          <p className="mx-auto max-w-2xl text-sm text-slate-500 sm:text-base">
            Productos fresh-from-production listos para publicar. Sincronizamos inventario en tiempo real para garantizar disponibilidad y tallajes.
          </p>
        </div>

        {loading && (
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={`recent-skeleton-${index}`}
                className="h-72 animate-pulse rounded-2xl border border-surface-200 bg-white/70"
              />
            ))}
          </div>
        )}

        {!loading && recentProducts.length > 0 && (
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
            className="mt-10 !pb-12"
          >
            {recentProducts.map(product => (
              <SwiperSlide key={product._id}>
                <div className="px-2">
                  <Nuevos product={product} />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        )}
      </div>
    </section>
  );
};

export default MoreProductsSection;
